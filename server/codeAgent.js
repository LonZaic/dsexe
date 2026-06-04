// ═══════════════════════════════════════════
// Code Agent Engine — Sub-AI Planner + Main AI
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const os = require('os')
const { initFollow, updateFollowSection, readFollow, hybridSearch } = require('./followManager')
const { initTask, readTask, writeTasks } = require('./taskManager')
const { initKeep, generateHandoff, buildNewSessionPrompt } = require('./keepManager')

const AGENT_TIMEOUT = 600000
const MAX_ROUNDS = 40
const WORKSPACE = process.env.AGENT_WORKSPACE || os.homedir()

// ─── Tool definitions (same as agent) ───
const TOOLS = [
  { type: 'function', function: { name: 'list_files', description: 'List files and directories', parameters: { type: 'object', properties: { dir: { type: 'string' } }, required: [] } } },
  { type: 'function', function: { name: 'read_file', description: 'Read file with line numbers', parameters: { type: 'object', properties: { path: { type: 'string' }, offset: { type: 'number' }, limit: { type: 'number' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Create or overwrite file', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'edit_file', description: 'Replace exact text in file', parameters: { type: 'object', properties: { path: { type: 'string' }, old_string: { type: 'string' }, new_string: { type: 'string' }, replace_all: { type: 'boolean' } }, required: ['path', 'old_string', 'new_string'] } } },
  { type: 'function', function: { name: 'glob', description: 'Find files by glob pattern', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } } },
  { type: 'function', function: { name: 'grep', description: 'Search file contents with regex', parameters: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern'] } } },
  { type: 'function', function: { name: 'run_command', description: 'Execute shell command', parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } } },
]

// ─── Tool executors ───
const executors = require('./agent').executors || {}
// Fallback: inline basic executor
function executeTool(name, args) {
  try {
    switch (name) {
      case 'list_files': {
        const dir = args.dir || WORKSPACE
        if (!fs.existsSync(dir)) return `Dir not found: ${dir}`
        return fs.readdirSync(dir, { withFileTypes: true })
          .map(i => `${i.isDirectory() ? '[DIR]' : '[FILE]'} ${i.name}${i.isDirectory() ? '/' : ''}`).join('\n') || '(empty)'
      }
      case 'read_file': {
        const fp = args.path
        if (!fs.existsSync(fp)) return `File not found: ${fp}`
        const lines = fs.readFileSync(fp, 'utf-8').split('\n')
        const off = Math.max(0, (args.offset || 1) - 1)
        const lim = args.limit || 200
        return lines.slice(off, off + lim).map((l, i) => `${String(off + i + 1).padStart(4)}| ${l}`).join('\n')
      }
      case 'write_file': {
        const fp = args.path; const dir = path.dirname(fp)
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(fp, args.content, 'utf-8')
        return `[OK] Wrote ${fp} (${args.content.length} chars)`
      }
      case 'edit_file': {
        const fp = args.path; const content = fs.readFileSync(fp, 'utf-8')
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
        scan(args.path ? path.resolve(args.path) : WORKSPACE)
        return results.slice(0, 100).join('\n') || 'No matches'
      }
      case 'grep': {
        const results = []; const searchDir = args.path || WORKSPACE
        function scan(d) {
          try { for (const i of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, i.name); if (i.name.startsWith('.')) continue; if (i.isDirectory()) scan(f); else { try { const lines = fs.readFileSync(f, 'utf-8').split('\n'); for (let j = 0; j < lines.length; j++) { if (lines[j].toLowerCase().includes(args.pattern.toLowerCase())) results.push(`${f}:${j + 1}: ${lines[j].trim().slice(0, 120)}`) } } catch {} } } } catch {}
        }
        scan(searchDir); return results.slice(0, 60).join('\n') || 'No matches'
      }
      case 'run_command': {
        const { execSync } = require('child_process')
        return execSync(args.command, { cwd: WORKSPACE, timeout: 30000, encoding: 'utf-8', shell: true }).trim() || '(ok)'
      }
      default: return `Unknown tool: ${name}`
    }
  } catch (e) { return `Tool error: ${e.message}` }
}

// ─── Step 1: Sub-AI Planner — creates task list ───
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
1. 分解为 3-8 个具体可执行的步骤
2. 每个步骤必须具体：操作哪个文件、做什么改动
3. 按依赖关系排序
4. 输出纯 JSON 数组：[{"id":"1","text":"步骤描述"}]

只输出 JSON，不要其他内容。`

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: planPrompt }], max_tokens: 1024, temperature: 0.3 }),
    signal
  })
  const data = await res.json()
  const reply = data.choices?.[0]?.message?.content || '[]'
  try {
    return JSON.parse(reply.replace(/```json|```/g, '').trim())
  } catch { return [{ id: '1', text: task }] }
}

// ─── Step 2: Main AI — execute plan step by step ───
async function executeCodeTask({ projectPath, task, apiKey, model = 'deepseek-v4-pro', onProgress, signal }) {
  // Ensure absolute path
  projectPath = path.isAbsolute(projectPath) ? projectPath : path.resolve(WORKSPACE, projectPath)

  // Initialize project docs
  initFollow(projectPath)
  initTask(projectPath)
  initKeep(projectPath)
  const followContent = readFollow(projectPath)

  // Check if this is a handoff session (has actual handoff content, not just template)
  const keepContent = require('./keepManager').readKeep(projectPath)
  const isHandoff = keepContent && keepContent.includes('（等待 AI 在上下文满时生成）') ? false : (keepContent && keepContent.length > 100)

  onProgress({ type: 'start', task, projectPath: projectPath, isHandoff })

  // ─── Phase 1: Plan ───
  onProgress({ type: 'planning', text: '子 AI 正在规划任务...' })
  let tasks = []
  try {
    tasks = await planTask(projectPath, task, apiKey, model, signal)
    writeTasks(projectPath, tasks)
    onProgress({ type: 'plan_done', tasks: tasks.map(t => ({ id: t.id, text: t.text, done: false })) })
  } catch (e) {
    tasks = [{ id: '1', text: task }]
    onProgress({ type: 'plan_done', tasks })
  }

  // ─── Phase 2: Execute each task ───
  // Build system prompt with handoff context if available
  let systemPrompt = buildCodeSystemPrompt(projectPath, followContent, tasks)
  let userPrompt = `## 任务计划\n${tasks.map(t => `- [ ] ${t.id}. ${t.text}`).join('\n')}\n\n## 开始执行\n从第 1 步开始。每完成一步，立即标记完成并进入下一步。完成后调用 done。`

  if (isHandoff) {
    systemPrompt += '\n\n' + buildNewSessionPrompt(projectPath)
    userPrompt = '## 接力继续\n你已拿到 Follow.md + Task.md + Keep.md 三个文档。请先通读项目代码，100% 理解后继续执行未完成的任务。\n\n' + userPrompt
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  let rounds = 0, finalResult = ''
  const startTime = Date.now()

  for (const taskItem of tasks) {
    if (signal?.aborted) break
    if (Date.now() - startTime > AGENT_TIMEOUT) break

    onProgress({ type: 'task_start', taskId: taskItem.id, text: taskItem.text })
    messages.push({ role: 'user', content: `## 执行第 ${taskItem.id} 步\n${taskItem.text}\n\n直接执行此步骤。完成后回复"步骤完成"。` })

    rounds++
    onProgress({ type: 'round', round: rounds })

    // ─── Streaming API call (same format as chat mode) ───
    let response
    try {
      response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 4096, temperature: 0.3, stream: true }),
        signal
      })
    } catch (e) {
      console.error('[codeAgent] fetch error:', e.message)
      onProgress({ type: 'error', text: e.message })
      break
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error('[codeAgent] API error', response.status, errText.slice(0, 200))
      onProgress({ type: 'error', text: 'API error ' + response.status + ': ' + errText.slice(0, 100) })
      break
    }

    // ─── Parse SSE stream — real-time output like chat mode ───
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let sseBuf = ''
    let fullContent = ''
    const toolAcc = {} // index → { id, name, arguments }

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
          // Stream text content in real-time
          if (delta.content) {
            fullContent += delta.content
            onProgress({ type: 'thinking', text: delta.content })
          }
          // Accumulate tool call chunks
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              if (!toolAcc[idx]) toolAcc[idx] = { id: '', name: '', arguments: '' }
              if (tc.id) toolAcc[idx].id = tc.id
              if (tc.function?.name) toolAcc[idx].name += tc.function.name
              if (tc.function?.arguments) toolAcc[idx].arguments += tc.function.arguments
            }
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // Build final message from accumulated stream
    const toolCalls = Object.values(toolAcc).map(a => ({
      id: a.id, type: 'function', function: { name: a.name, arguments: a.arguments }
    }))
    const msg = { role: 'assistant', content: fullContent || null, tool_calls: toolCalls.length ? toolCalls : undefined }

    // Execute tool calls
    let toolResults = ''
    if (msg.tool_calls && msg.tool_calls.length) {
      messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls })
      for (const tc of msg.tool_calls) {
        const name = tc.function?.name
        let args = {}
        try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}

        onProgress({ type: 'tool_start', tool: name, args })

        // For file edits, capture diff for UI
        if (name === 'edit_file' && args.path) {
          const oldContent = fs.existsSync(args.path) ? fs.readFileSync(args.path, 'utf-8') : ''
          const result = executeTool(name, args)
          // Emit diff info for the frontend
          if (!result.startsWith('[ERROR]')) {
            const oldLines = oldContent.split('\n')
            const diffLine = findDiffLine(oldLines, args.old_string)
            onProgress({
              type: 'code_diff',
              filePath: args.path,
              fileName: path.basename(args.path),
              oldCode: args.old_string.slice(0, 500),
              newCode: args.new_string.slice(0, 500),
              lineStart: diffLine,
            })
          }
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
          toolResults += result + '\n'
          onProgress({ type: 'tool_result', tool: name, result: result.slice(0, 300) })
        } else if (name === 'write_file' && args.path) {
          const result = executeTool(name, args)
          onProgress({
            type: 'code_diff',
            filePath: args.path,
            fileName: path.basename(args.path),
            oldCode: '',
            newCode: args.content.slice(0, 1000),
            lineStart: 1,
            isNewFile: true,
          })
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
          onProgress({ type: 'tool_result', tool: name, result: result.slice(0, 300) })
        } else {
          const result = executeTool(name, args)
          messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
          onProgress({ type: 'tool_result', tool: name, result: String(result).slice(0, 300) })
          toolResults += String(result).slice(0, 200) + '\n'
        }
      }
    } else {
      // No tool calls = step response
      messages.push({ role: 'assistant', content: msg.content || '' })
    }

    // Mark task done
    taskItem.done = true
    writeTasks(projectPath, tasks)
    onProgress({ type: 'task_done', taskId: taskItem.id, text: taskItem.text })
    finalResult = msg.content || toolResults || '步骤完成'
  }

  // ─── Check context usage ───
  const totalChars = JSON.stringify(messages).length
  const estimatedTokens = Math.ceil(totalChars / 2.5)
  const pctUsed = Math.round(estimatedTokens / 64000 * 100)
  onProgress({ type: 'context_usage', pct: pctUsed, tokens: estimatedTokens })

  if (pctUsed >= 90) {
    onProgress({ type: 'handoff_needed', text: `上下文使用 ${pctUsed}%，生成接力文档...` })
    // Generate Keep.md handoff
    const completed = tasks.filter(t => t.done)
    const pending = tasks.filter(t => !t.done)
    try {
      const handoffText = await generateHandoff(projectPath, task, messages, completed, pending, apiKey, signal)
      onProgress({ type: 'handoff_done', text: 'Keep.md 已生成，下次会话将自动接力' })
    } catch {}
  }

  // ─── Phase 3: Summarize round → update Follow.md ───
  try {
    await summarizeRound(projectPath, task, finalResult, messages, apiKey, signal)
  } catch {}

  // ─── Report done ───
  onProgress({ type: 'done', text: finalResult, tasks })
  return finalResult
}

// ─── Summarize one round → update Follow.md ───
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
格式: {"章节名":"新内容","章节名2":"新内容2"}

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
  } catch { /* skip */ }
}

// ─── Build code-focused system prompt ───
function buildCodeSystemPrompt(projectPath, followContent, tasks) {
  let p = `你是一个专业代码 AI，工作在项目: ${projectPath}

## 核心规则
1. 使用 edit_file 修改现有文件，使用 write_file 创建新文件
2. 读写前先理解项目文件结构
3. 每完成一步立即报告
4. 只用 SVG 图标，禁止 emoji

## 项目记忆 (Follow.md)
${followContent.slice(0, 1500)}

## 任务列表
${tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.id}. ${t.text}`).join('\n')}

按顺序执行，完成一步再做下一步。`
  return p
}

// ─── Helper: list file tree ───
function listTree(dir, maxDepth, depth = 0) {
  if (depth > maxDepth) return ''
  let out = ''
  try {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue
      const indent = '  '.repeat(depth)
      if (item.isDirectory()) {
        out += `${indent}[DIR] ${item.name}/\n`
        out += listTree(path.join(dir, item.name), maxDepth, depth + 1)
      } else {
        try { const s = fs.statSync(path.join(dir, item.name)); out += `${indent}[FILE] ${item.name} (${s.size}B)\n` } catch { out += `${indent}[FILE] ${item.name}\n` }
      }
    }
  } catch {}
  return out
}

// ─── Find which line old_string is on ───
function findDiffLine(lines, oldString) {
  if (!oldString) return 1
  const firstLine = oldString.split('\n')[0].trim()
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(firstLine)) return i + 1
  }
  return 1
}

module.exports = { executeCodeTask, planTask, summarizeRound }
