// ══════════════════════════════════════════════════════
// Hook System — CC-style hook execution framework
// Ported from CC's src/utils/hooks.ts + src/utils/hooks/*
//
// Supports 3 hook types:
//   1. shell  — execute a command, pass context via stdin JSON
//   2. function — require() a module exporting async fn(ctx)
//   3. http   — POST context JSON to a URL
//
// Hook events:
//   PreToolUse, PostToolUse, PostAgentStop, UserPromptSubmit, PermissionRequest
// ══════════════════════════════════════════════════════

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const https = require('http')

const DEFAULT_HOOK_TIMEOUT = 30000  // 30s per hook

// ─── Hook config loading ───
function loadHooks(configPath) {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('[Hooks] Failed to load config:', e.message)
  }
  return { hooks: {} }
}

/**
 * Execute a single hook.
 *
 * @param {{ type: 'shell'|'function'|'http', command?: string, module?: string, url?: string, timeout?: number }} hook
 * @param {Object} context — { event, toolName?, input?, result?, task?, messages? }
 * @param {AbortSignal} [signal]
 * @returns {Promise<{ allow: boolean, message: string, modifiedInput?: any, modifiedResult?: any }>}
 */
async function executeHook(hook, context) {
  const timeout = hook.timeout || DEFAULT_HOOK_TIMEOUT

  try {
    switch (hook.type) {
      case 'shell': {
        const ctxJson = JSON.stringify(context)
        const options = { timeout, encoding: 'utf-8', maxBuffer: 1024 * 1024, input: ctxJson }
        try {
          const output = execSync(hook.command, options)
          return parseHookOutput(output)
        } catch (e) {
          return { allow: true, message: `Hook "${hook.command}" failed: ${e.message}` }
        }
      }

      case 'function': {
        try {
          const modPath = path.resolve(hook.module)
          // Clear require cache so hook changes take effect
          delete require.cache[require.resolve(modPath)]
          const fn = require(modPath)
          if (typeof fn !== 'function') {
            return { allow: true, message: `Hook module ${hook.module} does not export a function` }
          }
          const result = await Promise.race([
            fn(context),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
          ])
          return normalizeHookResult(result)
        } catch (e) {
          return { allow: true, message: `Hook "${hook.module}" error: ${e.message}` }
        }
      }

      case 'http': {
        const result = await httpPost(hook.url, context, timeout)
        return normalizeHookResult(result)
      }

      default:
        return { allow: true, message: `Unknown hook type: ${hook.type}` }
    }
  } catch (e) {
    return { allow: true, message: `Hook execution error: ${e.message}` }
  }
}

/**
 * Execute all hooks for a given event type.
 */
async function executeHooks(hooksConfig, eventName, context) {
  const hooks = (hooksConfig.hooks && hooksConfig.hooks[eventName]) || []
  if (hooks.length === 0) return { allowed: true, results: [] }

  const results = []
  for (const hook of hooks) {
    const result = await executeHook(hook, { event: eventName, ...context })
    results.push({ hook: hook.type === 'shell' ? hook.command : (hook.module || hook.url), result })
    if (!result.allow) {
      return { allowed: false, results, blockReason: result.message }
    }
  }

  return { allowed: true, results }
}

// ─── Convenience wrappers for each event type ───

async function executePreToolUse(hooksConfig, toolName, input, agentContext) {
  const ctx = {
    toolName,
    input,
    round: agentContext.round,
    task: agentContext.task,
    workspace: agentContext.workspace
  }
  const result = await executeHooks(hooksConfig, 'PreToolUse', ctx)

  // Check for modified input from hooks
  let modifiedInput = input
  for (const r of result.results || []) {
    if (r.result && r.result.modifiedInput) {
      modifiedInput = r.result.modifiedInput
    }
  }

  return { ...result, modifiedInput }
}

async function executePostToolUse(hooksConfig, toolName, input, result, agentContext) {
  const ctx = {
    toolName,
    input,
    result: String(result).slice(0, 2000),
    round: agentContext.round,
    task: agentContext.task
  }
  const hookResult = await executeHooks(hooksConfig, 'PostToolUse', ctx)

  // Check for modified result from hooks
  let modifiedResult = result
  for (const r of hookResult.results || []) {
    if (r.result && r.result.modifiedResult) {
      modifiedResult = r.result.modifiedResult
    }
  }

  return { ...hookResult, modifiedResult }
}

async function executePostAgentStop(hooksConfig, messages, finalResult, agentContext) {
  const ctx = {
    messages: messages.slice(-10).map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content.slice(0, 500) : '',
      tool_calls: m.tool_calls ? m.tool_calls.map(t => t.function?.name) : undefined
    })),
    finalResult,
    task: agentContext.task,
    rounds: agentContext.rounds || 0
  }
  return executeHooks(hooksConfig, 'PostAgentStop', ctx)
}

async function executeUserPromptSubmit(hooksConfig, task, agentContext) {
  const ctx = {
    task,
    timestamp: new Date().toISOString()
  }
  const result = await executeHooks(hooksConfig, 'UserPromptSubmit', ctx)

  // Check for task modification
  let modifiedTask = task
  for (const r of result.results || []) {
    if (r.result && r.result.modifiedTask) {
      modifiedTask = r.result.modifiedTask
    }
  }

  return { ...result, modifiedTask }
}

// ─── Helpers ───

function parseHookOutput(output) {
  const trimmed = String(output).trim()
  try {
    const parsed = JSON.parse(trimmed)
    return normalizeHookResult(parsed)
  } catch {
    // Non-JSON output: if it contains "deny" or "block", treat as deny
    if (/^(deny|block|reject|false|no)/i.test(trimmed)) {
      return { allow: false, message: trimmed }
    }
    return { allow: true, message: trimmed }
  }
}

function normalizeHookResult(result) {
  if (!result || typeof result !== 'object') {
    return { allow: true, message: String(result) }
  }
  return {
    allow: result.allow !== false,
    message: result.message || result.reason || '',
    modifiedInput: result.modifiedInput,
    modifiedResult: result.modifiedResult,
    modifiedTask: result.modifiedTask,
    ...result
  }
}

function httpPost(url, data, timeout) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data)
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout
    }

    const req = https.request(options, (res) => {
      let responseData = ''
      res.on('data', chunk => responseData += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData))
        } catch {
          resolve({ allow: true, message: responseData })
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}

module.exports = {
  loadHooks,
  executeHook,
  executeHooks,
  executePreToolUse,
  executePostToolUse,
  executePostAgentStop,
  executeUserPromptSubmit
}
