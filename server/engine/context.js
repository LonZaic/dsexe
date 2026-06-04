// ══════════════════════════════════════════════════════
// Context Manager — CC-style system prompt & compaction
// Ported from CC's src/context.ts + src/services/compact/*
// ══════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')

// DeepSeek v4 context ≈ 64K tokens. Compact at 75%.
const MAX_CONTEXT_TOKENS = 64000
const COMPACT_THRESHOLD = 0.75
const MAX_FILE_SIZE = 80 * 1024  // max size for auto-read project files

/**
 * Rough token counter for mixed Chinese/English text.
 * DeepSeek uses a BPE tokenizer; 2.5 chars/token is a conservative
 * estimate (English ~4, Chinese ~1.5, mixed ~2.5).
 */
function estimateTokenCount(messages) {
  if (!messages || !messages.length) return 0
  let totalChars = 0
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      totalChars += msg.content.length
    } else if (Array.isArray(msg.content)) {
      // content array (multimodal)
      for (const block of msg.content) {
        if (block.text) totalChars += block.text.length
        if (block.content) totalChars += String(block.content).length
      }
    }
    // Count tool_calls as well
    if (msg.tool_calls) {
      totalChars += JSON.stringify(msg.tool_calls).length
    }
    // Count tool_call_id and role
    if (msg.tool_call_id) totalChars += msg.tool_call_id.length
    totalChars += (msg.role || '').length
  }
  return Math.ceil(totalChars / 2.5)
}

/**
 * Check if messages should be compacted.
 */
function shouldCompact(messages, maxTokens = MAX_CONTEXT_TOKENS) {
  const estimated = estimateTokenCount(messages)
  return {
    shouldCompact: estimated >= maxTokens * COMPACT_THRESHOLD,
    estimatedTokens: estimated,
    maxTokens,
    threshold: maxTokens * COMPACT_THRESHOLD,
    pct: Math.round(estimated / maxTokens * 100)
  }
}

/**
 * Build the CC-style system prompt.
 *
 * @param {Object} options
 * @param {string} options.workspaceRoot - agent workspace root
 * @param {Array<{name:string,content:string}>} options.projectContext - auto-read project files
 * @param {string} [options.memoryPrompt] - memory system instructions from memory.js
 * @param {string} [options.permissionMode] - current permission mode
 * @param {Array} [options.tools] - tool definitions for the tool table
 */
function buildSystemPrompt(options = {}) {
  const {
    workspaceRoot = process.cwd(),
    projectContext = [],
    memoryPrompt = '',
    permissionMode = 'default',
    tools = []
  } = options

  const isWindows = process.platform === 'win32'
  const homeDir = isWindows ? (process.env.USERPROFILE || 'C:\\Users\\') : (process.env.HOME || '/home')

  // ─── Part 1: Identity ───
  let prompt = `You are an AI coding agent with full access to the user's computer. You function like Claude Code — you can read/write files, execute commands, search the web, and complete complex multi-step tasks autonomously.

## Session Info

- **Date**: ${new Date().toISOString().split('T')[0]}
- **Platform**: ${process.platform} (${process.arch})
- **Workspace**: ${workspaceRoot}
- **Home**: ${homeDir}
- **Permission Mode**: ${permissionMode}
`

  // ─── Part 2: Core Principles (CC harness philosophy) ───
  prompt += `
## Core Principles

1. **Read before you act** — Always read files before modifying them. Never guess.
2. **Use edit_file for small changes** — For existing files, prefer edit_file (exact string replacement). Only use write_file for new files or complete rewrites.
3. **Verify after changes** — Read the file back or run a test to confirm correctness.
4. **Handle errors gracefully** — If something fails, analyze why and try a different approach. Never repeat the same failing action.
5. **Output immediately** — Once you have the answer (from tools, thinking, or knowledge), output it right away. Do NOT call extra tools just to verify or double-check. The user wants speed.
6. **Narrate every step** — After each tool result, explain what you found or did in a short sentence.
7. **Stop when done** — Once the task is complete, stop calling tools and provide a clear summary. One round of thinking + one round of output is ideal for simple queries.
`

  // ─── Part 3: Tool Capabilities ───
  prompt += `
## Your Toolkit

You have access to these tools (invoked via function calling):

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| list_files | List directory contents | dir (path, optional) |
| read_file | Read file with line numbers | path (required), offset, limit |
| write_file | Create or overwrite a file | path, content (required) |
| edit_file | Precise text replacement (PREFERRED for modifications) | path, old_string, new_string, replace_all |
| glob | Find files by glob pattern | pattern (e.g. **/*.js) |
| grep | Search file contents with regex | pattern, path?, glob?, context |
| run_command | Execute shell commands | command (required) |
| web_search | Search the web via DuckDuckGo | query (required) |

**Rules for tool use:**
- You can call multiple tools per round (they execute in sequence)
- edit_file's old_string must match EXACTLY including indentation
- Absolute paths work everywhere — use them! (E:\\, C:\\, etc.)
- read_file automatically shows line numbers for easy reference
- run_command: dangerous commands (format, shutdown, rm -rf, sudo) are BLOCKED
- Run commands in the workspace directory unless specified otherwise
`

  // ─── Part 4: Workflow ───
  prompt += `
## Workflow

For each task, follow this order:
1. **Explore** — Use list_files or glob to understand the project structure
2. **Understand** — Read relevant files before changing them
3. **Plan** — Think about what changes are needed (briefly, in your thinking)
4. **Execute** — Make changes using edit_file (preferred) or write_file
5. **Verify** — Confirm correctness by reading back or running commands
6. **Report** — Summarize what you accomplished clearly
`

  // ─── Part 5: Memory Instructions (from memory.js) ───
  if (memoryPrompt) {
    prompt += `\n## Memory System\n${memoryPrompt}\n`
  }

  // ─── Part 6: Anti-Loop Rules ───
  prompt += `
## Loop Prevention

- Never repeat the same tool with the same arguments more than 3 times
- If a tool fails, analyze the error and try something DIFFERENT
- If you're stuck, acknowledge it and suggest alternatives to the user
- After the task is done, do NOT keep exploring — stop and report
`

  // ─── Part 7: Output Style ───
  prompt += `
## Communication Style

- Be concise but informative
- Explain what you're doing as you do it (e.g., "Let me read package.json first...")
- After tool results, give a one-line observation
- When done, provide a clear summary of what was accomplished
- If you encounter an error you can't resolve, be honest about it
`

  // ─── Part 8: Project Context ───
  if (projectContext.length > 0) {
    prompt += `\n## Project Context (auto-detected from workspace)\n\n`
    for (const f of projectContext) {
      prompt += `### ${f.name}\n\`\`\`\n${f.content}\n\`\`\`\n\n`
    }
  }

  // ─── Part 9: Begin ───
  prompt += `\nNow begin. Explore the relevant directories, understand the task, and complete it thoroughly. Remember: read before you write, verify after you change, and stop when done.`

  return prompt
}

/**
 * Read project context files from workspace root.
 * Mirrors CC's auto-read of CLAUDE.md, README.md, package.json, etc.
 */
function readProjectContext(workspaceRoot) {
  const contextFiles = []
  const priorityFiles = [
    'CLAUDE.md',
    'README.md',
    'package.json',
    'tsconfig.json',
    'vite.config.js',
    'vite.config.ts',
    '.gitignore',
    'Dockerfile',
    'docker-compose.yml',
    'Makefile',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod'
  ]

  // Also check nested project config files (NOT Claude Code internals)
  const extraPaths = [
    '.github/CLAUDE.md',
  ]

  const allPaths = [
    ...priorityFiles.map(f => path.join(workspaceRoot, f)),
    ...extraPaths.map(f => path.join(workspaceRoot, f))
  ]

  for (const fullPath of allPaths) {
    if (fs.existsSync(fullPath)) {
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isFile() && stat.size < MAX_FILE_SIZE) {
          const relName = path.relative(workspaceRoot, fullPath)
          contextFiles.push({
            name: relName,
            content: fs.readFileSync(fullPath, 'utf-8').slice(0, 5000)
          })
        }
      } catch { /* skip inaccessible files */ }
    }
  }

  return contextFiles
}

/**
 * Compact conversation history using a summary model.
 * Keeps system message + last 4 messages intact, summarizes middle.
 */
async function compactHistory(messages, apiKey, signal) {
  if (messages.length < 8) return messages  // not enough to compact

  const systemMsg = messages.find(m => m.role === 'system')
  const recentMessages = messages.slice(-4)  // keep last 4 intact
  const middleMessages = messages.slice(1, -4).filter(m => m.role !== 'system')

  if (middleMessages.length < 2) return messages

  // Build summary request
  const summaryContent = middleMessages.map(m => {
    const role = m.role.toUpperCase()
    if (m.tool_calls) {
      return `[${role} tool_calls: ${m.tool_calls.map(t => t.function?.name).join(', ')}]`
    }
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    return `[${role}] ${text.slice(0, 500)}`
  }).join('\n')

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: 'Summarize this conversation history concisely. Keep key facts, decisions, file paths, and task progress. Output as a paragraph.' },
          { role: 'user', content: summaryContent }
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal
    })

    if (!res.ok) return messages  // fail safe — don't compact if API fails

    const data = await res.json()
    const summary = data.choices?.[0]?.message?.content || ''

    // Rebuild: system + summary + recent
    const compacted = []
    if (systemMsg) compacted.push(systemMsg)
    compacted.push({
      role: 'user',
      content: `[Context Summary — previous conversation compressed]\n${summary}\n[/Context Summary]`
    })
    compacted.push(...recentMessages)

    return compacted
  } catch {
    return messages  // fail safe
  }
}

module.exports = {
  buildSystemPrompt,
  estimateTokenCount,
  shouldCompact,
  compactHistory,
  readProjectContext,
  MAX_CONTEXT_TOKENS,
  COMPACT_THRESHOLD
}
