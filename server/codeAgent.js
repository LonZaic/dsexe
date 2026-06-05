// ═══════════════════════════════════════════
// Code Agent Engine — Long-running task support
// Integrates: hooks, permissions, MCP, skills, sub-agents, session recovery, todo tracking
// Inspired by Claude Code
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const os = require('os')
const { initFollow, updateFollowSection, readFollow, hybridSearch } = require('./followManager')
const { initTask, readTask, writeTasks } = require('./taskManager')
const { initKeep, generateHandoff, buildNewSessionPrompt } = require('./keepManager')
const { loadHooks, executePreToolUse, executePostToolUse, executePostAgentStop } = require('./hooks')
const { checkToolPermission, classifyCommand, loadPermissionRules, MODES } = require('./permissions')
const { loadAllMcpTools, executeMcpTool } = require('./mcp/client')
const { getSkillsPrompt } = require('./skills/skillLoader')
const { recordEvents, loadSession, buildRecoveryPrompt } = require('./sessionRecovery')
// subAgent imported lazily inside executeCodeTask to avoid circular dep

const AGENT_TIMEOUT = 3600000
const MAX_ROUNDS = 200
const MAX_ROUNDS_PER_TASK = 10
const WORKSPACE = process.env.AGENT_WORKSPACE || os.homedir()
const CONTEXT_LIMIT = 60000
const COMPACT_THRESHOLD = 48000
const CONTINUE_MAX = 10

// ─── Pause/Resume support ───
let _paused = false
function pauseAgent() { _paused = true }
function resumeAgent() { _paused = false }
function isPaused() { return _paused }

// ─── Built-in tool definitions ───
const BASE_TOOLS = [
  { type: 'function', function: { name: 'list_files', description: 'List files and directories', parameters: { type: 'object', properties: { dir: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'read_file', description: 'Read file with line numbers', parameters: { type: 'object', properties: { path: { type: 'string' }, offset: { type: 'number' }, limit: { type: 'number' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Create or overwrite file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'edit_file', description: 'Replace exact text in file', parameters: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, required: ['path', 'old_string', 'new_string'] } } },
  { type: 'function', function: { name: 'glob', description: 'Find files by glob pattern', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } } },
  { type: 'function', function: { name: 'grep', description: 'Search file contents with regex', parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern'] } } },
  { type: 'function', function: { name: 'run_command', description: 'Execute shell command', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
  // ─── New tools ───
  { type: 'function', function: { name: 'write_todos', description: 'Write/update task tracking list. Use to track progress on complex multi-step work. Each item has id, text, status (pending/in_progress/completed).', parameters: { type: 'object', properties: { todos: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' }, status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] } }, required: ['id', 'text', 'status'] } } }, required: ['todos'] } } },
  { type: 'function', function: { name: 'task', description: 'Launch a sub-agent to handle a specific sub-task in parallel. Use for independent work that can run concurrently.', parameters: { type: 'object', properties: { description: { type: 'string' }, prompt: { type: 'string' } }, required: ['description', 'prompt'] } } },
]

// MCP tools cache (loaded lazily)
let _mcpToolsCache = null
let _mcpCacheProject = null

// ─── Path resolver (scoped to project) ───
function resolvePath(inputPath, projectRoot) {
  if (!inputPath) return projectRoot
  if (path.isAbsolute(inputPath)) return inputPath
  return path.resolve(projectRoot, inputPath)
}

// ─── Tool executors ───
function executeTool(name, args, projectRoot) {
  const root = projectRoot || WORKSPACE
  try {
    switch (name) {
      case 'list_files': {
        const dir = resolvePath(args.dir || '.', root)
        if (!fs.existsSync(dir)) return `Dir not found: ${dir}`
        return fs.readdirSync(dir, { withFileTypes: true })
          .map(i => `${i.isDirectory() ? '[DIR]' : '[FILE]'} ${i.name}${i.isDirectory() ? '/' : ''}`).join('\n') || '(empty)'
      }
      case 'read_file': {
        const fp = resolvePath(args.path, root)
        if (!fs.existsSync(fp)) return `File not found: ${fp}`
        const lines = fs.readFileSync(fp, 'utf-8').split('\n')
        const off = Math.max(0, (args.offset || 1) - 1)
        const lim = args.limit || 200
        return lines.slice(off, off + lim).map((l, i) => `${String(off + i + 1).padStart(4)}| ${l}`).join('\n')
      }
      case 'write_file': {
        const fp = resolvePath(args.path, root); const dir = path.dirname(fp)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(fp, args.content, 'utf-8')
        return `[OK] Wrote ${fp} (${args.content.length} chars)`
      }
      case 'edit_file': {
        const fp = resolvePath(args.path, root); const content = fs.readFileSync(fp, 'utf-8')
        if (!content.includes(args.old_string)) return `[ERROR] old_string not found in ${fp}`
        const nc = content.replace(args.old_string, args.new_string)
        fs.writeFileSync(fp, nc, 'utf-8')
        return `[OK] Edited ${fp}`
      }
      case 'glob': {
        const re = new RegExp('^' + args.pattern.replace(/\./g, '\\.').replace(/\*\*/g, '<<D>>').replace(/\*/g, '[^/\\\\]*').replace(/<<D>>/g, '.*') + '$', 'i')
        const results = []
        function scan(d) {
          try { for (const i of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, i.name); if (i.name.startsWith('.')) continue; if (i.isDirectory()) scan(f); else if (re.test(i.name)) results.push(f) } } catch {}
        }
        scan(resolvePath(args.path || '.', root))
        return results.slice(0, 100).join('\n') || 'No matches'
      }
      case 'grep': {
        const results = []; const searchDir = resolvePath(args.path || '.', root)
        function scan(d) {
          try { for (const i of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, i.name); if (i.name.startsWith('.')) continue; if (i.isDirectory()) scan(f); else { try { const lines = fs.readFileSync(f, 'utf-8').split('\n'); for (let j = 0; j < lines.length; j++) { if (lines[j].toLowerCase().includes(args.pattern.toLowerCase())) results.push(`${f}:${j + 1}: ${lines[j].trim().slice(0, 120)}`) } } catch {} } } } catch {}
        }
        scan(searchDir); return results.slice(0, 60).join('\n') || 'No matches'
      }
      case 'run_command': {
        const { execSync } = require('child_process')
        return execSync(args.command, { cwd: root, timeout: 30000, encoding: 'utf-8', shell: true }).trim() || '(ok)'
      }
      default: return `Unknown tool: ${name}`
    }
  } catch (e) { return `Tool error: ${e.message}` }
}

// ─── MCP tool loading (lazy + cached) ───
async function getMcpTools(projectPath) {
  if (_mcpToolsCache && _mcpCacheProject === projectPath) return _mcpToolsCache
  try {
    _mcpToolsCache = await loadAllMcpTools(projectPath)
    _mcpCacheProject = projectPath
    return _mcpToolsCache
  } catch { return [] }
}

// ─── Execute tool with hooks + permissions ───
async function executeToolWithHooks(name, args, projectPath, hooksConfig, permissionMode, agentCtx) {
  // Permission check
  const perm = checkToolPermission(name, args, permissionMode, loadPermissionRules(projectPath))
  if (!perm.allowed) {
    return `[DENIED] ${perm.reason || 'Permission denied for ' + name}`
  }

  // PreToolUse hook
  const preHook = await executePreToolUse(hooksConfig, name, args, { ...agentCtx, workspace: projectPath })
  if (!preHook.allowed) {
    return `[BLOCKED by hook] ${preHook.blockReason || 'PreToolUse hook blocked ' + name}`
  }
  const effectiveArgs = preHook.modifiedInput || args

  // Execute
  let result
  if (name.startsWith('mcp__')) {
    result = await executeMcpTool(name, effectiveArgs, projectPath)
  } else if (name === 'write_todos') {
    result = executeWriteTodos(effectiveArgs, projectPath)
  } else if (name === 'task') {
    // Sub-agent spawning is handled at the caller level
    result = '[NOTE] Sub-agent tasks are handled by the orchestrator'
  } else {
    result = executeTool(name, effectiveArgs, projectPath)
  }

  // PostToolUse hook
  const postHook = await executePostToolUse(hooksConfig, name, effectiveArgs, result, { ...agentCtx, workspace: projectPath })
  const finalResult = postHook.modifiedResult || result

  return finalResult
}

// ─── Todo tracking ───
let _todos = [] // In-memory todo state for the current session

function executeWriteTodos(args, projectPath) {
  try {
    const todos = args.todos || []
    _todos = todos
    // Also write to Task.md for persistence
    const done = todos.filter(t => t.status === 'completed')
    const active = todos.filter(t => t.status !== 'completed')
    let content = '# Task.md\n\n> Todo tracking\n\n## 进行中\n'
    if (active.length) {
      for (const t of active) content += `- [${t.status === 'in_progress' ? '~' : ' '}] ${t.id}. ${t.text}\n`
    } else { content += '（全部完成）\n' }
    content += '\n## 已完成\n'
    if (done.length) {
      for (const t of done) content += `- [x] ~~${t.text}~~\n`
    } else { content += '（暂无）\n' }
    writeTasks(projectPath, todos.map(t => ({ id: t.id, text: t.text, done: t.status === 'completed' })))
    return `[OK] Updated ${todos.length} todos (${active.length} active, ${done.length} done)`
  } catch (e) { return `[ERROR] write_todos failed: ${e.message}` }
}

function getTodos() { return _todos }

// ─── Step 1: Planner ───
async function planTask(projectPath, task, apiKey, model = 'deepseek-v4-pro', signal) {
  const followContent = readFollow(projectPath) || ''
  const fileTree = listTree(projectPath, 2)
  const planPrompt = `你是一个项目规划 AI。阅读以下信息，为编码任务制定详细的分步计划。

## 项目路径
${projectPath}

## 项目文件结构
\`\`\`
${fileTree.slice(0, 2000)}
\`\`\`

## Follow.md（项目记忆）
\`\`\`
${followContent.slice(0, 2000)}
\`\`\`

## 用户需求
${task}

## 要求
1. 分解为 5-15 个具体可执行的步骤（复杂项目多拆几步）
2. 每个步骤必须具体：操作哪个文件、创建什么、写什么内容
3. 按依赖关系排序，先创建项目结构再写代码
4. 输出纯 JSON 数组：[{"id":"1","text":"步骤描述"}]

只输出 JSON，不要其他内容。`
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: planPrompt }], max_tokens: 2048, temperature: 0.3 }),
    signal
  })
  const data = await res.json()
  const reply = data.choices?.[0]?.message?.content || '[]'
  try { return JSON.parse(reply.replace(/```json|```/g, '').trim()) }
  catch { return [{ id: '1', text: task }] }
}

// ─── Quick question detection ───
function isQuestionTask(task) {
  const t = (task || '').toLowerCase()
  // Question patterns (user just wants to understand, not change code)
  const questionPatterns = [
    /^(这是什么|这是啥|这是什么项目|这个项目是|介绍|说明|解释|讲讲|说说|看看|看一下|了解|怎么|如何|what|how|explain|describe|tell me|show me|list|summarize)/,
    /(是什么|干嘛的|做什么的|有什么用|怎么用|怎么样|如何|什么意思)/,
    /^(read|check|find|search|grep|look|see|inspect)/,
  ]
  // Code action patterns (user wants to create/modify code)
  const actionPatterns = [
    /(创建|新建|生成|写|编写|添加|增加|修改|改|删除|删掉|修复|fix|优化|重构|实现|create|make|build|write|add|edit|modify|delete|remove|refactor|implement|change|update)/,
  ]

  const isQuestion = questionPatterns.some(r => r.test(t))
  const isAction = actionPatterns.some(r => r.test(t))

  // If it looks like a question AND NOT an action request → quick mode
  return isQuestion && !isAction
}
async function executeCodeTask({ projectPath, task, apiKey, model = 'deepseek-v4-pro', onProgress, signal, existingTasks = null }) {
  projectPath = path.isAbsolute(projectPath) ? projectPath : path.resolve(WORKSPACE, projectPath)

  // Initialize project docs
  initFollow(projectPath); initTask(projectPath); initKeep(projectPath)
  const followContent = readFollow(projectPath)

  const keepContent = require('./keepManager').readKeep(projectPath)
  const isHandoff = keepContent && !keepContent.includes('等待 AI 在上下文满时生成') && keepContent.length > 100

  onProgress({ type: 'start', task, projectPath, isHandoff })

  // ─── Phase 1: Plan (skip for simple questions) ───
  const quickMode = !existingTasks && isQuestionTask(task)
  let allTasks = []
  if (existingTasks && existingTasks.length > 0) {
    allTasks = existingTasks.map(t => ({ id: t.id, text: t.text, done: !!t.done }))
    const pendingCount = allTasks.filter(t => !t.done).length
    onProgress({ type: 'plan_reused', tasks: allTasks.map(t => ({ id: t.id, text: t.text, done: !!t.done })), pendingCount })
  } else if (quickMode) {
    // Quick question: just read and answer, no planning needed
    allTasks = [{ id: '1', text: task, done: false }]
    onProgress({ type: 'plan_done', tasks: [{ id: '1', text: task, done: false }], quickMode: true })
  } else {
    onProgress({ type: 'planning', text: '正在规划任务...' })
    try {
      allTasks = await planTask(projectPath, task, apiKey, model, signal)
      writeTasks(projectPath, allTasks)
      onProgress({ type: 'plan_done', tasks: allTasks.map(t => ({ id: t.id, text: t.text, done: false })) })
    } catch (e) {
      allTasks = [{ id: '1', text: task }]
      onProgress({ type: 'plan_done', tasks: allTasks.map(t => ({ id: t.id, text: t.text, done: false })) })
    }
  }

  // ─── Load MCP tools ───
  let mcpTools = []
  try { mcpTools = await getMcpTools(projectPath) } catch {}
  const allTools = [...BASE_TOOLS, ...mcpTools]

  // ─── Load hooks & permissions config ───
  const hooksConfigPath = path.join(projectPath, 'hooks-config.json')
  const hooksConfig = loadHooks(fs.existsSync(hooksConfigPath) ? hooksConfigPath : path.join(__dirname, 'hooks-config.json'))
  const permMode = MODES.ACCEPT_EDITS // default: allow reads/writes/edits, deny dangerous commands

  // ─── Check for session recovery ───
  const sessionId = 'code_' + Date.now()
  const savedSession = loadSession(projectPath, sessionId)
  let recoveryPrompt = ''
  if (savedSession && savedSession.hasState && savedSession.events.length > 5) {
    recoveryPrompt = buildRecoveryPrompt(projectPath, sessionId, task)
    if (recoveryPrompt) {
      onProgress({ type: 'recovery_found', sessionId, eventsCount: savedSession.events.length })
    }
  }

  // ─── Phase 2: Execute ───
  const skillsPrompt = getSkillsPrompt(projectPath, null)
  let systemPrompt, userPrompt
  if (quickMode) {
    systemPrompt = `你是项目分析助手。用户想了解项目"${projectPath}"。先读关键文件(README/package.json/主要代码)，再用自然语言简要回答用户的问题。如果用户要画架构图/流程图，可以写 SVG 文件。不要创建或修改其他文件。一定要回复，不能空响应。`
    userPrompt = `## 用户问题\n${task}\n\n先浏览项目文件了解情况，然后直接回答。`
  } else {
    systemPrompt = buildCodeSystemPrompt(projectPath, followContent, allTasks) + skillsPrompt
    userPrompt = `## 任务计划\n${allTasks.map(t => `- [ ] ${t.id}. ${t.text}`).join('\n')}\n\n## 开始执行\n从第 1 步开始，一步一步执行。每完成一步立即标记并进入下一步。全部完成后给出最终汇报。`
  }
  if (recoveryPrompt) userPrompt = recoveryPrompt + '\n\n' + userPrompt
  if (isHandoff) {
    systemPrompt += '\n\n' + buildNewSessionPrompt(projectPath)
    userPrompt = '## 接力继续\n你已拿到 Follow.md + Task.md + Keep.md 三个文档。请先通读项目代码，100% 理解后继续执行未完成的任务。\n\n' + userPrompt
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  let totalRounds = 0, finalResult = '', totalFilesCreated = 0
  let continueCount = 0
  const startTime = Date.now()
  let pendingTasks = allTasks.filter(t => !t.done)

  // ═══ OUTER LOOP: iterate over planned tasks ═══
  while (pendingTasks.length > 0 && totalRounds < MAX_ROUNDS) {
    if (signal?.aborted) break
    if (Date.now() - startTime > AGENT_TIMEOUT) break

    // Pause check
    while (_paused && !signal?.aborted) {
      await new Promise(r => setTimeout(r, 500))
    }

    const taskItem = pendingTasks.shift()
    onProgress({ type: 'task_start', taskId: taskItem.id, text: taskItem.text })
    messages.push({ role: 'user', content: `## 执行第 ${taskItem.id} 步: ${taskItem.text}\n\n请使用工具完成此步骤。先读相关文件了解现状，再动手写代码。完成后确认结果。` })

    let taskRounds = 0
    let taskComplete = false

    // ═══ INNER LOOP: multi-round tool calling per step (like Claude Code) ═══
    while (taskRounds < MAX_ROUNDS_PER_TASK && !taskComplete && !signal?.aborted) {
      // Pause check inside inner loop
      while (_paused && !signal?.aborted) {
        await new Promise(r => setTimeout(r, 500))
      }

      totalRounds++
      taskRounds++
      onProgress({ type: 'round', round: totalRounds, taskRound: taskRounds })

      // ═══ Context compaction check (improved) ═══
      const currentTokens = estimateTokens(messages)
      if (currentTokens > COMPACT_THRESHOLD) {
        onProgress({ type: 'thinking', text: '\n[上下文压缩中...]' })
        try {
          const compacted = await compactMessagesImproved(messages, task, apiKey, signal)
          if (compacted && compacted.length > 2) {
            messages.length = 0
            messages.push(...compacted)
            onProgress({ type: 'thinking', text: '\n[上下文已精简，继续工作]' })
          }
        } catch {}
      }

      // ═══ Streaming API call ═══
      let response
      try {
        response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages, tools: allTools, tool_choice: 'auto', max_tokens: 8192, temperature: 0.3, stream: true }),
          signal
        })
      } catch (e) {
        if (e.name === 'AbortError') break
        console.error('[codeAgent] fetch error:', e.message)
        onProgress({ type: 'error', text: e.message })
        break
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        if (response.status === 413 && totalRounds > 3) {
          onProgress({ type: 'thinking', text: '\n[上下文过大，紧急精简...]' })
          try {
            const compacted = await compactMessagesImproved(messages, task, apiKey, signal)
            if (compacted && compacted.length > 2) {
              messages.length = 0; messages.push(...compacted)
              pendingTasks.unshift(taskItem)
              onProgress({ type: 'thinking', text: '\n[已精简，重试中...]' })
              continue
            }
          } catch {}
        }
        console.error('[codeAgent] API error', response.status, errText.slice(0, 200))
        onProgress({ type: 'error', text: 'API error ' + response.status + ': ' + errText.slice(0, 100) })
        break
      }

      // ═══ Parse SSE stream (accumulate, don't emit per-chunk) ═══
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let sseBuf = '', fullContent = '', finishReason = ''
      const toolAcc = {}

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        sseBuf += decoder.decode(value, { stream: true })
        const lines = sseBuf.split('\n')
        sseBuf = lines.pop() || ''
        for (const line of lines) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const raw = t.slice(5).trim()
          if (raw === '[DONE]') break
          try {
            const chunk = JSON.parse(raw)
            const delta = chunk.choices?.[0]?.delta
            if (!delta) continue
            if (delta.content) {
              fullContent += delta.content
              // Emit streaming hint so frontend knows AI is alive (not full thinking yet)
              onProgress({ type: 'streaming', text: delta.content.slice(0, 20) })
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolAcc[idx]) toolAcc[idx] = { id: '', name: '', arguments: '' }
                if (tc.id) toolAcc[idx].id = tc.id
                if (tc.function?.name) toolAcc[idx].name += tc.function.name
                if (tc.function?.arguments) toolAcc[idx].arguments += tc.function.arguments
              }
            }
            if (chunk.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason
          } catch {}
        }
      }

      // ═══ Max-output-token recovery ═══
      if (finishReason === 'length' && continueCount < 3) {
        onProgress({ type: 'step_thinking', text: fullContent || '(truncated)' })
        onProgress({ type: 'step_report', text: '输出被截断，自动恢复继续...' })
        messages.push({ role: 'assistant', content: fullContent || null })
        messages.push({ role: 'user', content: '输出被截断了。直接从断点继续，不要道歉不要重复，接着写。' })
        continueCount++
        continue
      }

      // Build message from stream
      const toolCalls = Object.values(toolAcc).filter(a => a.id).map(a => ({
        id: a.id, type: 'function', function: { name: a.name, arguments: a.arguments }
      }))

      // ═══ DECISION: does AI want to call tools? ═══
      if (toolCalls.length === 0) {
        // No tool calls → AI is reporting/analyzing
        const responseText = (fullContent || '').trim()
        messages.push({ role: 'assistant', content: responseText || '完成' })
        onProgress({ type: 'step_report', text: responseText || '步骤完成' })
        finalResult = responseText || '步骤完成'
        taskComplete = true
        break
      }

      // ═══ HAS tool calls → AI is thinking then acting ═══
      // Emit the AI's real thinking before tool execution
      if (fullContent && fullContent.trim()) {
        onProgress({ type: 'step_thinking', text: fullContent })
      }

      messages.push({ role: 'assistant', content: fullContent || null, tool_calls: toolCalls })

      let toolResults = ''
      for (const tc of toolCalls) {
        const name = tc.function?.name
        let args = {}
        try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}

        onProgress({ type: 'tool_start', tool: name, args })

        // Handle sub-agent spawning
        if (name === 'task' && args.prompt) {
          const { spawnSubAgent } = require('./subAgent')
          const subResult = await spawnSubAgent({
            projectPath, task: args.prompt, apiKey, model: 'deepseek-v4-flash',
            onProgress, signal, parentId: taskItem?.id || 'main'
          })
          const resultStr = `[Sub-agent ${subResult.taskId}] ${subResult.success ? 'OK' : 'FAILED'}: ${(subResult.result || '').slice(0, 300)}`
          messages.push({ role: 'tool', tool_call_id: tc.id, content: resultStr })
          toolResults += resultStr + '\n'
          onProgress({ type: 'tool_result', tool: name, result: resultStr.slice(0, 300) })
          continue
        }

        // Execute with hooks + permissions
        const agentCtx = { round: totalRounds, taskRound: taskRounds, task: taskItem?.text || task, workspace: projectPath }
        const result = await executeToolWithHooks(name, args, projectPath, hooksConfig, permMode, agentCtx)
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result })

        // Emit diff events for file ops — use RESOLVED absolute paths
        if (name === 'edit_file' && args.path && !result.startsWith('[DENIED]') && !result.startsWith('[BLOCKED]')) {
          const fp = resolvePath(args.path, projectPath)
          const oldContent = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf-8') : ''
          if (!result.startsWith('[ERROR]')) {
            onProgress({ type: 'code_diff', filePath: fp, fileName: path.basename(fp),
              oldCode: args.old_string?.slice(0, 8000) || '', newCode: args.new_string?.slice(0, 8000) || '',
              lineStart: findDiffLine(oldContent.split('\n'), args.old_string) })
          }
        } else if (name === 'write_file' && args.path && !result.startsWith('[DENIED]') && !result.startsWith('[BLOCKED]')) {
          totalFilesCreated++
          const fp = resolvePath(args.path, projectPath)
          onProgress({ type: 'code_diff', filePath: fp, fileName: path.basename(fp),
            oldCode: '', newCode: (args.content || '').slice(0, 8000), lineStart: 1, isNewFile: true })
        }

        onProgress({ type: 'tool_result', tool: name, result: String(result).slice(0, 300) })
        toolResults += String(result).slice(0, 200) + '\n'
      }

      // After executing tools, the inner loop continues —
      // AI will see tool results in the next iteration and can iterate/verify/fix
      finalResult = fullContent || '步骤进行中'
    } // end inner multi-round loop

    // Mark task done after inner loop completes (AI confirmed no more tool calls)
    taskItem.done = true
    writeTasks(projectPath, allTasks)
    onProgress({ type: 'task_done', taskId: taskItem.id, text: taskItem.text })

    // Update Follow.md after each task (incremental)
    try { await summarizeRound(projectPath, task, finalResult, messages, apiKey, signal) } catch {}

    if (pendingTasks.length === 0) break
  } // end outer main while loop

  // ═══ Phase 3: Post-agent hook ═══
  try {
    const stopHook = await executePostAgentStop(hooksConfig, messages, finalResult, { task, rounds: totalRounds, workspace: projectPath })
    if (!stopHook.allowed) {
      onProgress({ type: 'thinking', text: '\n[Stop hook blocked completion]' })
    }
  } catch {}

  // ═══ Phase 4: Generate natural language final report (Bug 7 fix) ═══
  const isRawOutput = finalResult.startsWith('[OK]') || finalResult.startsWith('[ERROR]') ||
    finalResult.startsWith('[Sub-agent') || !finalResult || finalResult.length < 50
  if (isRawOutput || !finalResult.includes('完成')) {
    try {
      const summaryPrompt = `你刚完成了一个编码任务。请用自然语言写一段简洁的最终汇报（100字内），内容包括：
- 本次做了什么改动
- 涉及了哪些文件（列出路径）
- 有没有需要注意的地方
像同事做完事跟你同步一样，用随和的口吻汇报。

原始任务: ${task}
创建了 ${totalFilesCreated} 个文件。
完成了 ${allTasks.filter(t => t.done).length}/${allTasks.length} 个步骤。`

      messages.push({ role: 'user', content: summaryPrompt })
      const finalRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: messages.slice(-12), max_tokens: 500, temperature: 0.3 }),
        signal
      })
      const finalData = await finalRes.json()
      const report = finalData.choices?.[0]?.message?.content
      if (report && report.length > 10) finalResult = report
    } catch {}
  }

  // ═══ Phase 5: Final context usage stats ═══
  const totalChars = JSON.stringify(messages).length
  const estimatedTokens = Math.ceil(totalChars / 2.5)
  const pctUsed = Math.round(estimatedTokens / CONTEXT_LIMIT * 100)
  onProgress({ type: 'context_usage', pct: pctUsed, tokens: estimatedTokens, rounds: totalRounds, filesCreated: totalFilesCreated, todos: _todos })

  // Session recording
  try { recordEvents(projectPath, sessionId, [{ type: 'complete', task, rounds: totalRounds, filesCreated: totalFilesCreated }]) } catch {}

  // Final Follow.md update
  try { await summarizeRound(projectPath, task, finalResult, messages, apiKey, signal) } catch {}

  onProgress({ type: 'done', text: finalResult, tasks: allTasks, filesCreated: totalFilesCreated, totalRounds, todos: _todos })
  return finalResult
}

// ═══ Context compaction — improved: preserve recent context ═══
async function compactMessagesImproved(messages, task, apiKey, signal) {
  const systemMsg = messages.find(m => m.role === 'system')
  const recent = messages.slice(-10) // keep last 10 messages
  const oldMessages = messages.slice(1, -10).filter(m => m.role !== 'system')

  if (oldMessages.length === 0) return null // nothing to compact

  // Build summary of old messages
  const oldSummary = oldMessages.map(m => {
    const r = m.role?.toUpperCase() || ''
    if (m.tool_calls) return `[${r}] TOOL_CALLS: ${m.tool_calls.map(t => t.function?.name).join(', ')}`
    const c = typeof m.content === 'string' ? m.content.slice(0, 200) : ''
    return `[${r}] ${c}`
  }).join('\n')

  const compactPrompt = `Summarize this conversation history into 3-5 key points. Include:
1. What files were created/modified
2. What was accomplished
3. Current state / what's next

Conversation:
${oldSummary.slice(0, 4000)}

Output a 3-5 line plain text summary in Chinese.`

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: compactPrompt }], max_tokens: 500, temperature: 0.1 }),
      signal
    })
    const data = await res.json()
    const summary = data.choices?.[0]?.message?.content || 'Previous work completed.'

    // Build new message array: system + compact summary + recent context
    const result = [systemMsg]
    result.push({ role: 'user', content: `[上下文压缩] 已完成的工作摘要:\n${summary}\n\n继续执行剩余任务。` })
    result.push(...recent)
    return result
  } catch { return null }
}

// Keep old compactMessages as fallback reference
async function compactMessages(messages, task, apiKey, signal) {
  return compactMessagesImproved(messages, task, apiKey, signal)
}

// ═══ Estimate token count ═══
function estimateTokens(messages) {
  return Math.ceil(JSON.stringify(messages).length / 2.5)
}

// ─── Summarize → update Follow.md ───
async function summarizeRound(projectPath, task, result, messages, apiKey, signal) {
  const followContent = readFollow(projectPath) || ''
  const conversation = messages.slice(-10).map(m => {
    const r = m.role?.toUpperCase() || ''
    const c = typeof m.content === 'string' ? m.content.slice(0, 300) : ''
    return `[${r}] ${c}`
  }).join('\n')

  const summaryPrompt = `分析以下一轮 AI 编码对话，提取值得更新的 Follow.md 章节。

## 当前 Follow.md
${followContent.slice(0, 2000)}

## 本轮对话
用户需求: ${task}
结果: ${result.slice(0, 500)}
对话摘要:
${conversation.slice(0, 1500)}

## 要求
输出 JSON 对象，键为 Follow.md 章节名，值为该章节应更新的新内容。
只输出需要更新的章节。如果无需更新，输出 {}。

章节名必须是以下之一: 用户警告, 代码风格约定, 项目样式风格, 用户提供的代码仓库, 技术栈与依赖, 架构决策, 关键文件与路径, 未完成任务, 已知问题, 常用命令`

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: summaryPrompt }], max_tokens: 1024, temperature: 0.2 }),
    signal
  })
  const data = await res.json()
  const reply = data.choices?.[0]?.message?.content || '{}'
  try {
    const updates = JSON.parse(reply.replace(/```json|```/g, '').trim())
    for (const [section, content] of Object.entries(updates)) {
      updateFollowSection(projectPath, section, content)
    }
  } catch {}
}

// ─── Build system prompt ───
function buildCodeSystemPrompt(projectPath, followContent, tasks) {
  return `你是一个专业代码 AI，工作在项目: ${projectPath}

## 核心规则（非常重要！）
1. 你必须真正创建和修改文件！不要只探索，要动手写代码！
2. 使用 write_file 创建新文件，使用 edit_file 修改现有文件
3. 每个文件都要写完整、可运行的代码，不要写占位符或 TODO
4. 代码要健壮，包含必要的错误处理和导入
5. 只用 SVG 图标，禁止 emoji
6. 用户要画架构图/流程图/时序图时，直接用 mermaid 代码块输出（语言标记为 mermaid），系统会自动渲染
7. 也可以用 ASCII 字符画简单图表（┌─┐└─┘├─┤│ 等 box-drawing 字符）
8. 即使用户请求做不到的事，也要文字回复替代方案
9. 任务按顺序执行，完成一步再做下一步
10. 不要提前结束！所有步骤完成后才能说完成

## 项目记忆 (Follow.md)
${followContent.slice(0, 1500)}

## 任务列表
${tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.id}. ${t.text}`).join('\n')}

按顺序执行，完成一步再做下一步。

## 最终汇报
全部步骤完成后，必须写一段简洁的最终汇报（100字内），内容包括：
- 本次做了什么改动
- 涉及了哪些文件
- 有没有需要注意的地方
格式：用自然语言向用户汇报，就像同事做完事跟你同步一样。`
}

// ─── Helpers ───
function listTree(dir, maxDepth, depth = 0) {
  if (depth > maxDepth) return ''
  let out = ''
  try {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue
      const indent = '  '.repeat(depth)
      if (item.isDirectory()) { out += `${indent}[DIR] ${item.name}/\n`; out += listTree(path.join(dir, item.name), maxDepth, depth + 1) }
      else { try { const s = fs.statSync(path.join(dir, item.name)); out += `${indent}[FILE] ${item.name} (${s.size}B)\n` } catch { out += `${indent}[FILE] ${item.name}\n` } }
    }
  } catch {}
  return out
}

function findDiffLine(lines, oldString) {
  if (!oldString) return 1
  const firstLine = oldString.split('\n')[0].trim()
  for (let i = 0; i < lines.length; i++) { if (lines[i].includes(firstLine)) return i + 1 }
  return 1
}

module.exports = { executeCodeTask, planTask, summarizeRound, pauseAgent, resumeAgent, isPaused }
