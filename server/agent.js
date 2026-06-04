// ══════════════════════════════════════════════════════
// BBot Agent Engine v4 — Full CC Harness Architecture
//
// Integrated subsystems:
//   - antiloop.js    → loop detection & prevention
//   - tokenBudget.js → token budget tracking
//   - context.js     → system prompt + compaction
//   - permissions.js → tool permission checks
//   - hooks.js       → PreToolUse/PostToolUse/Stop hooks
//   - memory.js      → file-based persistent memory
// ══════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const https = require('https')
const os = require('os')

// ─── Subsystem imports ───
const { createLoopDetector } = require('./antiloop')
const { createBudgetTracker } = require('./tokenBudget')
const { buildSystemPrompt, estimateTokenCount, shouldCompact, compactHistory, readProjectContext } = require('./context')
const { checkToolPermission, classifyCommand, loadPermissionRules, MODES } = require('./permissions')
const { loadHooks, executePreToolUse, executePostToolUse, executePostAgentStop, executeUserPromptSubmit } = require('./hooks')
const { ensureMemDir, getMemoryPrompt, findRelevantMemories, extractMemoriesFromConversation, MEMORY_DIR } = require('./memory')

// ─── Config ───
const MAX_ROUNDS_BEFORE_COMPACT = 40   // compact & auto-continue at this round
const TOOL_TIMEOUT_MS = 30000
const AGENT_TIMEOUT_MS = 600000
const MAX_FILE_SIZE = 500 * 1024
const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE || os.homedir()

// ─── Protected directories ───
const PROTECTED_DIRS = process.platform === 'win32' ? [
  'C:\\Windows', 'C:\\Windows\\System32', 'C:\\Windows\\SysWOW64',
  'C:\\Program Files', 'C:\\Program Files (x86)',
  'C:\\ProgramData\\Microsoft', 'C:\\System Volume Information',
  'C:\\$Recycle.Bin',
] : [
  '/System', '/etc', '/boot', '/usr/lib', '/usr/bin', '/sbin', '/bin',
]

function isSystemPath(p) {
  const r = path.resolve(p)
  return PROTECTED_DIRS.some(d => r.toLowerCase().startsWith(d.toLowerCase()))
}

function resolvePath(p) {
  if (path.isAbsolute(p)) return path.normalize(p)
  return path.resolve(WORKSPACE_ROOT, p)
}

// ─── Danger check for commands ───
function isCommandSafe(cmd) {
  const classification = classifyCommand(cmd)
  if (!classification.safe) return { safe: false, reason: classification.reason }
  return { safe: true }
}

// ─── DuckDuckGo Web Search ───
function duckDuckGoSearch(query) {
  return new Promise((resolve) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    https.get(url, { timeout: 10000 }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          const results = []
          if (j.AbstractText) results.push(` ${j.AbstractText}`)
          if (j.AbstractURL) results.push(` ${j.AbstractURL}`)
          if (j.RelatedTopics) {
            for (const t of j.RelatedTopics.slice(0, 5)) {
              if (t.Text) results.push(`• ${t.Text}${t.FirstURL ? ' — ' + t.FirstURL : ''}`)
            }
          }
          resolve(results.length ? results.join('\n') : `No results found for: ${query}`)
        } catch { resolve(`Search completed but could not parse results for: ${query}`) }
      })
    }).on('error', () => resolve(`Search failed (network error) for: ${query}`))
  })
}

// ═══════════════════════════════════════
// Tool definitions — CC-style
// ═══════════════════════════════════════
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories. Use any path — you have access to the entire computer. Default: current directory.',
      parameters: {
        type: 'object',
        properties: { dir: { type: 'string', description: 'Directory path. Accepts absolute paths (E:\\, C:\\Users\\...) or relative paths.' } },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read any file on the computer. Shows line numbers. Use offset/limit for large files. ALWAYS read before editing.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path. Accepts absolute (E:\\file.txt) or relative paths.' },
          offset: { type: 'number', description: 'Start line (1-based). Optional.' },
          limit: { type: 'number', description: 'Max lines to read. Default 2000. Optional.' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file. For small changes to existing files, prefer edit_file instead.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Complete file content' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace exact text in a file. old_string must match exactly (including indentation). PREFERRED way to modify existing files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          old_string: { type: 'string', description: 'Exact text to replace (must match exactly)' },
          new_string: { type: 'string', description: 'Replacement text' },
          replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' }
        },
        required: ['path', 'old_string', 'new_string']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'glob',
      description: 'Find files by glob pattern. E.g. **/*.js, src/**/*.vue, *.json',
      parameters: {
        type: 'object',
        properties: { pattern: { type: 'string', description: 'Glob pattern like **/*.js or src/**/*.ts' } },
        required: ['pattern']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'grep',
      description: 'Search file contents with regex. Shows file:line matches.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern or search text' },
          glob: { type: 'string', description: 'Filter files by name pattern, e.g. *.js' },
          context: { type: 'number', description: 'Show N lines before/after each match' }
        },
        required: ['pattern']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute commands on the computer (node, python, git, npm, dir, ls, etc.). Dangerous commands are blocked.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Command to execute' } },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web using DuckDuckGo. Use for looking up current information or documentation.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query']
      }
    }
  }
]

// ═══════════════════════════════════════
// Tool executors
// ═══════════════════════════════════════
const executors = {
  list_files(args) {
    const dirPath = args.dir ? resolvePath(args.dir) : WORKSPACE_ROOT
    if (!fs.existsSync(dirPath)) return `Error: directory not found: ${args.dir || '.'}`
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    const lines = items.map(i => {
      try {
        const full = path.join(dirPath, i.name)
        const stat = fs.statSync(full)
        return `${i.isDirectory() ? '[DIR]' : '[FILE]'} ${i.name}${i.isDirectory() ? '/' : ''}  ${stat.isFile() ? stat.size + 'B' : ''}`
      } catch { return `${i.isDirectory() ? '[DIR]' : '[FILE]'} ${i.name}` }
    })
    return lines.join('\n') || '(empty)'
  },

  read_file(args) {
    const fp = resolvePath(args.path)
    if (!fs.existsSync(fp)) return `Error: file not found: ${args.path}`
    const stat = fs.statSync(fp)
    if (stat.size > MAX_FILE_SIZE) return `Error: file too large (${(stat.size / 1024).toFixed(0)}KB). Use offset/limit to read in chunks.`
    const content = fs.readFileSync(fp, 'utf-8')
    const lines = content.split('\n')
    const offset = args.offset ? Math.max(0, args.offset - 1) : 0
    const limit = args.limit || 2000
    const slice = lines.slice(offset, offset + limit)
    const numbered = slice.map((l, i) => `${String(offset + i + 1).padStart(4)}| ${l}`).join('\n')
    const hdr = `[FILE] ${args.path} (${lines.length} lines, ${stat.size}B)`
    if (lines.length > limit) return `${hdr}\nShowing lines ${offset + 1}-${offset + slice.length}:\n${numbered}\n... ${lines.length} total. Use offset/limit for more.`
    return `${hdr}\n${numbered}`
  },

  write_file(args) {
    const fp = resolvePath(args.path)
    if (isSystemPath(fp)) return `[ERROR] Cannot write to system path: ${args.path}. Protected directories: ${PROTECTED_DIRS.join(', ')}`
    const dir = path.dirname(fp)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(fp, args.content, 'utf-8')
    return `[OK] Wrote: ${args.path} (${args.content.length} chars, ${args.content.split('\n').length} lines)`
  },

  edit_file(args) {
    const fp = resolvePath(args.path)
    if (!fs.existsSync(fp)) return `Error: file not found: ${args.path}. Use write_file to create new files.`
    if (isSystemPath(fp)) return `[ERROR] Cannot edit system path: ${args.path}.`
    const content = fs.readFileSync(fp, 'utf-8')
    if (!content.includes(args.old_string)) {
      const search = args.old_string.split('\n')[0].trim().slice(0, 30)
      const lines = content.split('\n')
      const hints = []
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(search)) hints.push(`  line ${i + 1}: ${lines[i].trim().slice(0, 80)}`)
      }
      let msg = `[ERROR] Edit failed: old_string not found in ${args.path}.\n`
      if (hints.length) msg += `Possible matches:\n${hints.slice(0, 5).join('\n')}\n`
      msg += `Tip: use read_file first to confirm the exact content, including indentation.`
      return msg
    }
    const count = args.replace_all ? content.split(args.old_string).length - 1 : 1
    const newContent = args.replace_all ? content.split(args.old_string).join(args.new_string) : content.replace(args.old_string, args.new_string)
    fs.writeFileSync(fp, newContent, 'utf-8')
    const preview = args.old_string.length > 30 ? `"${args.old_string.slice(0, 30)}..."` : `"${args.old_string}"`
    return `[OK] Edited: ${args.path} — replaced ${count} occurrence(s) of ${preview}`
  },

  glob(args) {
    const pattern = args.pattern
    const regexStr = pattern.replace(/\./g, '\\.').replace(/\*\*/g, '<<<DS>>>').replace(/\*/g, '[^/\\\\]*').replace(/<<<DS>>>/g, '.*')
    const re = new RegExp('^' + regexStr + '$', 'i')
    const results = []
    function scan(dir) {
      try {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, item.name); const rel = path.relative(WORKSPACE_ROOT, full)
          if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '$RECYCLE.BIN') continue
          if (item.isDirectory()) { if (!isSystemPath(full)) scan(full) }
          else if (re.test(rel) || re.test(item.name)) {
            try { results.push(`${full}  (${fs.statSync(full).size}B)`) } catch { results.push(full) }
          }
        }
      } catch {}
    }
    scan(WORKSPACE_ROOT)
    return results.length ? `Found ${results.length} files:\n${results.slice(0, 100).join('\n')}` : `No files matching "${pattern}"`
  },

  grep(args) {
    const results = []
    const fileGlob = args.glob || '*'
    const ctx = args.context || 0
    const searchDir = args.path ? resolvePath(args.path) : WORKSPACE_ROOT
    const reGlob = new RegExp('^' + fileGlob.replace(/\./g, '\\.').replace(/\*/g, '[^/\\\\]*').replace(/\*\*/g, '.*') + '$', 'i')
    function scan(dir) {
      try {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, item.name)
          if (item.name.startsWith('.') || item.name === 'node_modules') continue
          if (item.isDirectory()) { if (!isSystemPath(full)) scan(full) }
          else if (reGlob.test(item.name)) {
            try {
              const lines = fs.readFileSync(full, 'utf-8').split('\n')
              for (let i = 0; i < lines.length; i++) {
                let matched = false
                try { matched = new RegExp(args.pattern, 'i').test(lines[i]) } catch { matched = lines[i].toLowerCase().includes(args.pattern.toLowerCase()) }
                if (matched) {
                  if (ctx > 0) {
                    const s = Math.max(0, i - ctx); const e = Math.min(lines.length, i + ctx + 1)
                    const block = []; for (let j = s; j < e; j++) block.push(`${j === i ? '>' : ' '}${String(j + 1).padStart(4)}| ${lines[j].slice(0, 120)}`)
                    results.push(`\n[FILE] ${full}:\n${block.join('\n')}`)
                  } else {
                    results.push(`${full}:${i + 1}: ${lines[i].trim().slice(0, 120)}`)
                  }
                }
              }
            } catch {}
          }
        }
      } catch {}
    }
    scan(searchDir)
    return results.length ? results.slice(0, 60).join('\n') + (results.length > 60 ? `\n... +${results.length - 60} more` : '') : `No matches for "${args.pattern}"`
  },

  run_command(args) {
    const check = isCommandSafe(args.command)
    if (!check.safe) return `[ERROR] ${check.reason}`
    try {
      const r = execSync(args.command, { cwd: WORKSPACE_ROOT, timeout: TOOL_TIMEOUT_MS, encoding: 'utf-8', maxBuffer: 1024 * 1024, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash' })
      const out = r.trim() || '(ok, no output)'
      return out
    } catch (e) {
      return `[ERROR] Command failed (exit ${e.status}): ${(e.stderr || e.message).slice(0, 800)}`
    }
  },

  web_search(args) {
    return duckDuckGoSearch(args.query)
  }
}

// ═══════════════════════════════════════
// CC-Style Agent Loop — Full Harness
// ═══════════════════════════════════════
async function runAgent({ task, apiKey, model = 'deepseek-v4-pro', onProgress, signal, permissionMode = 'default' }) {
  // ─── Initialize subsystems ───
  const workspaceRoot = WORKSPACE_ROOT

  // Ensure memory dir exists
  ensureMemDir(MEMORY_DIR)

  // Load hook & permission configs
  const hooksConfigPath = path.join(__dirname, 'hooks-config.json')
  const hooksConfig = loadHooks(hooksConfigPath)
  const permissionRulesPath = path.join(__dirname, 'permissions-config.json')
  const permissionRules = loadPermissionRules(permissionRulesPath)

  // Create detectors/trackers
  const loopDetector = createLoopDetector()
  const budgetTracker = createBudgetTracker()

  const agentContext = {
    task,
    workspace: workspaceRoot,
    round: 0,
    rounds: 0,
    startTime: Date.now(),
    permissionMode,
    hooksConfig,
    hooksFired: 0,
    memoriesFound: 0
  }

  onProgress({ type: 'start', task, mode: permissionMode })

  // ─── Step 1: UserPromptSubmit hooks ───
  const hookResult = await executeUserPromptSubmit(hooksConfig, task, agentContext)
  if (!hookResult.allowed) {
    onProgress({ type: 'hook_blocked', text: hookResult.blockReason || 'Task blocked by UserPromptSubmit hook' })
    return 'Task was blocked by a hook.'
  }
  const effectiveTask = hookResult.modifiedTask || task
  if (effectiveTask !== task) {
    onProgress({ type: 'hook_modified', text: 'Task modified by hook' })
  }
  agentContext.hooksFired++

  // ─── Step 2: Find relevant memories (CC side-query pattern) ───
  let relevantMemories = []
  try {
    relevantMemories = await findRelevantMemories(effectiveTask, MEMORY_DIR, apiKey, signal)
    agentContext.memoriesFound = relevantMemories.length
    if (relevantMemories.length > 0) {
      onProgress({
        type: 'memory_found',
        text: `Found ${relevantMemories.length} relevant memories`,
        memories: relevantMemories.map(m => ({ name: m.name, type: m.type }))
      })
    }
  } catch (e) {
    // Memory search is best-effort, don't block the agent
    onProgress({ type: 'warning', text: 'Memory search failed, continuing without memories' })
  }

  // ─── Step 3: Read project context ───
  const projectContext = readProjectContext(workspaceRoot)
  if (projectContext.length > 0) {
    onProgress({ type: 'context', text: 'Found ' + projectContext.length + ' project file(s): ' + projectContext.map(f => f.name).join(', ') })
  }

  // ─── Step 4: Build system prompt with all context ───
  const memoryPrompt = getMemoryPrompt(MEMORY_DIR)
  const systemPrompt = buildSystemPrompt({
    workspaceRoot,
    projectContext,
    memoryPrompt,
    permissionMode,
    tools: TOOLS
  })

  // ─── Step 5: Inject relevant memory content as context ───
  let memoryContextMessage = ''
  if (relevantMemories.length > 0) {
    memoryContextMessage = '## Relevant Memories (from previous sessions)\n\n'
    for (const mem of relevantMemories) {
      const content = (mem.content || '').slice(0, 1000)
      memoryContextMessage += `### ${mem.type}: ${mem.name}\n${content}\n\n`
    }
    memoryContextMessage += '---\nUse the above memories to inform your work. They provide context from past sessions.\n'
  }

  // ─── Step 6: Build initial messages ───
  let taskMessage = `## Task\n\n${effectiveTask}\n\nStart by exploring the relevant paths. Use list_files to understand what you are working with, then complete the task thoroughly. Remember: read before you write, verify after you change, and stop when done.`
  if (memoryContextMessage) {
    taskMessage = memoryContextMessage + '\n' + taskMessage
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: taskMessage }
  ]

  // ─── Step 7: Main agent loop ───
  let rounds = 0
  let compactCount = 0
  let finalResult = ''
  let lastError = ''
  const startTime = Date.now()

  // CC-style: no hard round limit — auto-compact and continue
  // Only stop when: task done, user aborts, budget exhausted, or truly stuck
  while (true) {
    // ─── Abort check ───
    if (signal && signal.aborted) {
      onProgress({ type: 'aborted' })
      finalResult = 'Task was aborted.'
      break
    }

    // ─── Timeout check ───
    if (Date.now() - startTime > AGENT_TIMEOUT_MS) {
      onProgress({ type: 'warning', text: 'Agent timeout reached (10 min)' })
      finalResult = lastError || 'Timeout — agent ran for 10 minutes. Check workspace for partial results.'
      break
    }

    // ─── Token budget check ───
    const budgetStatus = budgetTracker.getStatus()
    if (budgetStatus.shouldForceStop) {
      onProgress({ type: 'budget_warning', text: `Token budget exhausted (${Math.round(budgetStatus.pct * 100)}%). Stopping.` })
      messages.push({ role: 'user', content: budgetTracker.getNudgeMessage() })
      // Give one more round for the model to respond without tools
      finalResult = await forceFinalResponse(messages, apiKey, model, onProgress)
      break
    }
    if (budgetStatus.shouldNudge) {
      const nudge = budgetTracker.getNudgeMessage()
      if (nudge) {
        onProgress({ type: 'budget_warning', text: `Budget: ${Math.round(budgetStatus.pct * 100)}% used` })
        messages.push({ role: 'user', content: nudge })
      }
    }

    // ─── Context compaction check ───
    const compactCheck = shouldCompact(messages)
    if (compactCheck.shouldCompact) {
      onProgress({ type: 'compact_start', text: `Compacting context (${compactCheck.estimatedTokens} tokens, ${compactCheck.pct}%)` })
      try {
        const compacted = await compactHistory(messages, apiKey, signal)
        if (compacted.length < messages.length) {
          messages.length = 0
          messages.push(...compacted)
          onProgress({ type: 'compact_done', text: `Compacted: ${compactCheck.estimatedTokens} → ~${estimateTokenCount(compacted)} tokens` })
        }
      } catch (e) {
        onProgress({ type: 'warning', text: 'Compaction failed, continuing...' })
      }
    }

    // ─── Anti-loop check ───
    const loopStatus = loopDetector.checkLoop()
    if (loopStatus.isLoop) {
      onProgress({ type: 'loop_warning', text: `Loop detected: ${loopStatus.message.slice(0, 100)}` })
      messages.push({ role: 'user', content: loopStatus.message })
    }

    rounds++
    agentContext.round = rounds
    agentContext.rounds = rounds
    onProgress({ type: 'round', round: rounds, max: 0 })  // 0 = unlimited, auto-compact

    // ─── Auto-compact before hitting limits (CC-style) ───
    if (rounds > 0 && rounds % MAX_ROUNDS_BEFORE_COMPACT === 0) {
      compactCount++
      onProgress({ type: 'compact_start', text: `Auto-compacting at round ${rounds} (compaction #${compactCount})...` })
      try {
        const compacted = await compactHistory(messages, apiKey, signal)
        if (compacted.length < messages.length) {
          messages.length = 0
          messages.push(...compacted)
          // Reset loop detector after compaction
          loopDetector.reset()
          onProgress({ type: 'compact_done', text: `Compacted — continuing. Round ${rounds}, compaction #${compactCount}. Task still in progress.` })
        }
      } catch (e) {
        onProgress({ type: 'warning', text: 'Compaction failed, continuing anyway...' })
      }
    }

    // ─── Call DeepSeek API ───
    let response
    try {
      // Estimate input tokens
      const inputTokens = estimateTokenCount(messages)
      budgetTracker.recordInput(inputTokens)

      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 8192, temperature: 0.3 }),
        signal
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`)
      }

      response = await res.json()

      // Track output tokens
      if (response.usage) {
        budgetTracker.recordOutput(response.usage.completion_tokens || 0, rounds)
      } else {
        // Estimate from response content
        const msg = response.choices?.[0]?.message
        const outputChars = (msg?.content || '').length + JSON.stringify(msg?.tool_calls || []).length
        budgetTracker.recordOutput(Math.ceil(outputChars / 2.5), rounds)
      }
    } catch (e) {
      const errMsg = `API call failed: ${e.message}`
      onProgress({ type: 'error', text: errMsg })
      loopDetector.recordError(errMsg)
      lastError = errMsg

      // Retry once for network errors
      if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('ECONN') || e.message.includes('aborted')) {
        if (signal && signal.aborted) break
        onProgress({ type: 'thinking', text: 'Network error, retrying in 2s...' })
        await new Promise(r => setTimeout(r, 2000))
        try {
          const retryRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 8192, temperature: 0.3 }),
            signal
          })
          if (retryRes.ok) { response = await retryRes.json(); onProgress({ type: 'thinking', text: 'Retry succeeded.' }) }
          else { finalResult = errMsg; break }
        } catch { finalResult = errMsg; break }
      } else {
        finalResult = errMsg
        break
      }
    }

    if (!response) continue

    const msg = response.choices?.[0]?.message
    if (!msg) { onProgress({ type: 'error', text: 'Model returned empty response.' }); break }

    // Report thinking content
    if (msg.content) {
      onProgress({ type: 'thinking', text: msg.content })
    }

    // ─── No tool calls → agent is done ───
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      finalResult = msg.content || 'Task completed.'
      // Send done immediately so frontend can show the result right away
      onProgress({ type: 'done', text: finalResult, rounds })

      // Memory extraction: fire-and-forget, don't block the response
      extractMemoriesFromConversation(messages, apiKey, signal).then(extractedMemories => {
        if (extractedMemories && extractedMemories.length > 0) {
          onProgress({ type: 'memory_extracted', text: `Extracted ${extractedMemories.length} new memories`, memories: extractedMemories.map(m => m.name) })
          for (const mem of extractedMemories) {
            try { saveMemory(MEMORY_DIR, mem.name, mem.description, mem.type, mem.content) } catch {}
          }
        }
      }).catch(() => {})

      break
    }

    // ─── Add assistant message ───
    messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls })

    // ─── Execute tool calls (with hooks & permissions) ───
    for (const tc of msg.tool_calls) {
      const toolName = tc.function?.name
      let args = {}
      try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}

      onProgress({ type: 'tool_start', tool: toolName, args })

      // ─── PreToolUse hooks ───
      const preHookResult = await executePreToolUse(hooksConfig, toolName, args, agentContext)
      if (!preHookResult.allowed) {
        const blockMsg = `Tool "${toolName}" blocked by PreToolUse hook: ${preHookResult.blockReason}`
        onProgress({ type: 'hook_blocked', text: blockMsg, tool: toolName })
        messages.push({ role: 'tool', tool_call_id: tc.id, content: `[Blocked by hook] ${blockMsg}` })
        continue
      }
      if (preHookResult.modifiedInput && preHookResult.modifiedInput !== args) {
        const oldArgs = JSON.stringify(args)
        args = preHookResult.modifiedInput
        onProgress({ type: 'hook_modified', text: `Input modified by hook for ${toolName}`, tool: toolName })
      }
      if (preHookResult.results && preHookResult.results.length > 0) {
        agentContext.hooksFired += preHookResult.results.length
      }

      // ─── Permission check ───
      const permCheck = checkToolPermission(toolName, args, permissionMode, permissionRules)
      if (!permCheck.allowed) {
        const denyMsg = `Permission denied: ${permCheck.reason}`
        onProgress({ type: 'permission_denied', text: denyMsg, tool: toolName })
        messages.push({ role: 'tool', tool_call_id: tc.id, content: `[Permission Denied] ${denyMsg}. You do not have permission to perform this operation under "${permissionMode}" mode. Try a different approach.` })
        continue
      }
      if (permCheck.needsConfirmation) {
        onProgress({ type: 'permission_needed', text: `Permission needed for ${toolName}: ${permCheck.reason}`, tool: toolName })
        // In default mode with no interactive prompt available, allow with warning
        messages.push({ role: 'tool', tool_call_id: tc.id, content: `[Notice] This operation requires confirmation but is being auto-allowed. Proceed with caution.` })
      }

      // ─── Execute tool ───
      const executor = executors[toolName]
      let result
      if (!executor) {
        result = `Unknown tool: ${toolName}. Available: ${Object.keys(executors).join(', ')}`
      } else {
        try {
          const p = await executor(args)
          result = typeof p === 'string' ? p : JSON.stringify(p)
        } catch (e) {
          result = `Tool error: ${e.message}`
          loopDetector.recordError(result)
        }
      }

      // ─── PostToolUse hooks ───
      const postHookResult = await executePostToolUse(hooksConfig, toolName, args, result, agentContext)
      if (postHookResult.modifiedResult && postHookResult.modifiedResult !== result) {
        result = postHookResult.modifiedResult
      }
      if (postHookResult.results && postHookResult.results.length > 0) {
        agentContext.hooksFired += postHookResult.results.length
      }

      onProgress({ type: 'tool_result', tool: toolName, result: String(result).slice(0, 500) })

      // Record action for loop detection
      loopDetector.recordAction(toolName, args, result, msg.content)

      messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }

    // ─── Check if stuck ───
    if (loopDetector.isStuck()) {
      onProgress({ type: 'warning', text: 'Agent is stuck in a loop. Forcing summary.' })
      messages.push({ role: 'user', content: '[System] You appear to be stuck in a loop. STOP calling tools immediately and provide a detailed summary of what you have accomplished and what remains to be done.' })
      finalResult = await forceFinalResponse(messages, apiKey, model, onProgress)
      break
    }
  }

  // ─── Agent stopped ───

  // ─── Stream the final result word by word (do this FIRST, before any post-processing) ───
  if (finalResult) {
    const words = finalResult.split('')
    let chunk = ''
    for (let i = 0; i < words.length; i++) {
      chunk += words[i]
      if (chunk.length >= 4 || i === words.length - 1 || words[i] === '\n') {
        onProgress({ type: 'final_chunk', text: chunk, index: i, total: words.length })
        chunk = ''
        // Yield to event loop for streaming — use 0ms for fastest streaming
        await new Promise(r => setTimeout(r, 0))
      }
    }
  }

  // ─── Post-processing: non-critical, fire after streaming ───
  const duration = Date.now() - startTime
  onProgress({ type: 'stats', rounds, hooksFired: agentContext.hooksFired, memoriesFound: agentContext.memoriesFound, budgetUsed: budgetTracker.getStatus().used, duration })

  // PostAgentStop hooks (fire-and-forget)
  executePostAgentStop(hooksConfig, messages, finalResult, agentContext).catch(() => {})

  // Workspace state (fire-and-forget)
  setImmediate(() => {
    try {
      function listAll(d, pre = '') {
        const r = []
        try {
          for (const item of fs.readdirSync(d, { withFileTypes: true })) {
            if (item.name.startsWith('.') || item.name === 'node_modules') continue
            const rel = pre + item.name
            if (item.isDirectory()) { r.push(rel + '/'); r.push(...listAll(path.join(d, item.name), rel + '/')) }
            else { try { r.push(`${rel} (${fs.statSync(path.join(d, item.name)).size}B)`) } catch { r.push(rel) } }
          }
        } catch {}
        return r
      }
      onProgress({ type: 'workspace', files: listAll(workspaceRoot).slice(0, 100) })
    } catch {}
  })

  return finalResult
}

// ─── Helper: force a final text-only response ───
async function forceFinalResponse(messages, apiKey, model, onProgress) {
  try {
    const summaryMessages = messages.slice(-15)
    summaryMessages.push({ role: 'user', content: 'You have reached the limit of this agent session. Provide a concise summary of what you accomplished. Do NOT call any tools — just output text.' })
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: summaryMessages, max_tokens: 1024, temperature: 0.3 }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content || 'Agent reached max rounds. Check workspace for results.'
  } catch (e) {
    return 'Agent session ended. Check workspace for partial results.'
  }
}

// ─── Clean workspace ───
function cleanWorkspace() {
  try {
    for (const item of fs.readdirSync(WORKSPACE_ROOT)) {
      fs.rmSync(path.join(WORKSPACE_ROOT, item), { recursive: true, force: true })
    }
  } catch {}
}

module.exports = { runAgent, cleanWorkspace, WORKSPACE_ROOT, TOOLS, executors }
