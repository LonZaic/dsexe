// ══════════════════════════════════════════════════════
// Permission System — CC-style tool permission management
// Ported from CC's src/utils/permissions/*
// ══════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')

// ─── Permission Modes ───
const MODES = {
  DEFAULT: 'default',           // ask for dangerous, allow safe
  PLAN: 'plan',                 // read-only: allow reads, deny writes/commands
  ACCEPT_EDITS: 'acceptEdits',  // allow read/write/edit, deny commands
  BYPASS: 'bypassPermissions'   // allow everything (dangerous)
}

// ─── Default permission rules ───
const DEFAULT_RULES = {
  // Block obvious danger
  'Bash(rm -rf *)': 'deny',
  'Bash(sudo *)': 'deny',
  'Bash(format *)': 'deny',
  'Bash(shutdown *)': 'deny',
  'Bash(reboot *)': 'deny',
  'Bash(dd if=*)': 'deny',
  'Bash(mkfs *)': 'deny',
  'Bash(:(){ :|:& };:)': 'deny',
  'Bash(diskpart *)': 'deny',
  'Bash(del /F /S *)': 'deny',

  // Allow common dev tools
  'Bash(node *)': 'allow',
  'Bash(npm *)': 'allow',
  'Bash(npx *)': 'allow',
  'Bash(git *)': 'allow',
  'Bash(python *)': 'allow',
  'Bash(pip *)': 'allow',
  'Bash(ls *)': 'allow',
  'Bash(dir *)': 'allow',
  'Bash(cat *)': 'allow',
  'Bash(type *)': 'allow',
  'Bash(echo *)': 'allow',
  'Bash(cd *)': 'allow',
  'Bash(pwd)': 'allow',
  'Bash(mkdir *)': 'allow',
  'Bash(cp *)': 'allow',
  'Bash(mv *)': 'allow',
  'Bash(copy *)': 'allow',
  'Bash(xcopy *)': 'allow',
  'Bash(curl *)': 'allow',
  'Bash(find *)': 'allow',
  'Bash(where *)': 'allow',
  'Bash(whoami)': 'allow',
  'Bash(set *)': 'allow',

  // Allow all file operations by default
  'Read(*)': 'allow',
  'Write(*)': 'allow',
  'Edit(*)': 'allow',
  'Glob(*)': 'allow',
  'Grep(*)': 'allow',
  'WebSearch(*)': 'allow',
  'WebFetch(*)': 'allow',
  'List(*)': 'allow',
}

// ─── Protected system directories ───
const PROTECTED_DIRS = process.platform === 'win32' ? [
  'C:\\Windows',
  'C:\\Windows\\System32',
  'C:\\Windows\\SysWOW64',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData\\Microsoft',
  'C:\\System Volume Information',
  'C:\\$Recycle.Bin',
] : [
  '/System', '/etc', '/boot', '/usr/lib', '/usr/bin',
  '/sbin', '/bin', '/sys', '/proc', '/dev',
]

function isProtectedPath(p) {
  const resolved = path.resolve(p)
  return PROTECTED_DIRS.some(d => resolved.toLowerCase().startsWith(d.toLowerCase()))
}

// ─── Dangerous command patterns ───
const DANGEROUS_PATTERNS = [
  // Destructive file operations
  { pattern: /rm\s+-rf\s+\//, reason: 'Recursive root delete' },
  { pattern: /rm\s+-rf\s+\/\*/, reason: 'Recursive root delete' },
  { pattern: /sudo\s+rm/, reason: 'Privileged delete' },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: 'Raw device overwrite' },
  { pattern: /dd\s+if=/, reason: 'Raw disk operation' },
  { pattern: /mkfs\./, reason: 'Filesystem format' },
  { pattern: /:\s*\(\)\s*\{/, reason: 'Fork bomb pattern' },
  { pattern: /fork\s*bomb/i, reason: 'Fork bomb' },

  // System disruption
  { pattern: /shutdown/, reason: 'System shutdown' },
  { pattern: /reboot/, reason: 'System reboot' },
  { pattern: /init\s+[0-6]/, reason: 'Runlevel change' },
  { pattern: /systemctl\s+(stop|disable|mask)/, reason: 'Service disruption' },

  // Windows-specific
  { pattern: /diskpart/i, reason: 'Disk partitioning tool' },
  { pattern: /format\s+[a-z]:/i, reason: 'Disk format' },
  { pattern: /del\s+\/F\s+\/S\s+\/\w:\\/, reason: 'Force recursive delete from root' },
  { pattern: /rd\s+\/s\s+\/\w:\\/, reason: 'Remove directory from root' },

  // Privilege escalation
  { pattern: /sudo\s/, reason: 'Privilege escalation' },
  { pattern: /chmod\s+777/, reason: 'World-writable permissions' },
  { pattern: /chmod\s+[0-7]*7[0-7]*7/, reason: 'Overly permissive chmod' },
  { pattern: /chown\s+root/, reason: 'Ownership change to root' },

  // Network danger
  { pattern: /iptables\s+-F/, reason: 'Flush firewall rules' },
  { pattern: /nc\s+-[lL].*\/bin/, reason: 'Reverse shell listener' },
  { pattern: /bash\s+-i\s+>&.*\/dev\/tcp/, reason: 'Reverse shell' },

  // Data exfiltration
  { pattern: /curl.*\|\s*(ba)?sh/, reason: 'Pipe curl to shell' },
  { pattern: /wget.*\|\s*(ba)?sh/, reason: 'Pipe wget to shell' },
  { pattern: /eval\s/, reason: 'Code evaluation' },
]

/**
 * Classify a shell command for danger level.
 */
function classifyCommand(cmd) {
  const trimmed = cmd.trim()
  if (!trimmed) return { safe: true, reason: '' }

  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Blocked: ${reason} (matched: "${trimmed.slice(0, 60)}")` }
    }
  }

  return { safe: true, reason: '' }
}

/**
 * Match a tool call against permission rules using glob-style matching.
 * Rules format: "ToolName(argument-pattern)"
 */
function matchRule(toolName, input, rules) {
  for (const [rulePattern, behavior] of Object.entries(rules)) {
    // Parse: "Bash(rm -rf *)" → tool="Bash", pattern="rm -rf *"
    const match = rulePattern.match(/^(\w+)\((.*)\)$/)
    if (!match) continue

    const [, ruleTool, rulePatternStr] = match
    if (ruleTool.toLowerCase() !== toolName.toLowerCase()) continue

    // Determine what to match against
    let matchTarget = ''
    if (toolName.toLowerCase() === 'bash' || toolName.toLowerCase() === 'run_command') {
      matchTarget = (input.command || input.cmd || '').trim()
    } else if (input.path) {
      matchTarget = input.path
    } else if (input.pattern) {
      matchTarget = input.pattern
    } else if (input.query) {
      matchTarget = input.query
    } else if (input.dir) {
      matchTarget = input.dir
    } else {
      matchTarget = JSON.stringify(input)
    }

    // Convert rule pattern to regex: * → .*
    const regexStr = '^' + rulePatternStr
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      + '$'
    try {
      if (new RegExp(regexStr, 'i').test(matchTarget)) {
        return { matched: true, behavior }
      }
    } catch {
      // Invalid regex in rule, skip
    }
  }

  return { matched: false, behavior: null }
}

/**
 * Check if a tool invocation is allowed under the current permission mode and rules.
 *
 * @returns {{ allowed: boolean, reason: string, needsConfirmation: boolean }}
 */
function checkToolPermission(toolName, input, permissionMode, rules = {}) {
  const mergedRules = { ...DEFAULT_RULES, ...rules }
  const mode = permissionMode || MODES.DEFAULT

  // ─── BYPASS mode: allow everything ───
  if (mode === MODES.BYPASS) {
    return { allowed: true, reason: 'bypass mode', needsConfirmation: false }
  }

  // ─── Check explicit rule match first ───
  const ruleMatch = matchRule(toolName, input, mergedRules)
  if (ruleMatch.matched) {
    switch (ruleMatch.behavior) {
      case 'deny':
        return { allowed: false, reason: 'Blocked by permission rule', needsConfirmation: false }
      case 'allow':
        return { allowed: true, reason: 'Allowed by permission rule', needsConfirmation: false }
      case 'ask':
        return { allowed: true, reason: 'Requires confirmation by rule', needsConfirmation: true }
    }
  }

  // ─── PLAN mode: read-only ───
  if (mode === MODES.PLAN) {
    const readTools = ['read_file', 'list_files', 'glob', 'grep', 'web_search']
    if (!readTools.includes(toolName)) {
      return { allowed: false, reason: `Plan mode: only read operations allowed. "${toolName}" is blocked.`, needsConfirmation: false }
    }
    return { allowed: true, reason: 'plan mode (read-only)', needsConfirmation: false }
  }

  // ─── ACCEPT_EDITS mode: allow file ops, deny commands ───
  if (mode === MODES.ACCEPT_EDITS) {
    const commandTools = ['run_command', 'bash']
    if (commandTools.includes(toolName)) {
      // Allow safe commands only
      if (input.command) {
        const classification = classifyCommand(input.command)
        if (!classification.safe) {
          return { allowed: false, reason: classification.reason, needsConfirmation: false }
        }
        return { allowed: true, reason: 'safe command', needsConfirmation: false }
      }
      return { allowed: false, reason: 'acceptEdits mode: command execution requires confirmation', needsConfirmation: true }
    }
    return { allowed: true, reason: 'acceptEdits mode', needsConfirmation: false }
  }

  // ─── DEFAULT mode: allow safe, block dangerous ───
  if (toolName === 'run_command' || toolName === 'bash') {
    if (input.command) {
      const classification = classifyCommand(input.command)
      if (!classification.safe) {
        return { allowed: false, reason: classification.reason, needsConfirmation: false }
      }
      return { allowed: true, reason: 'safe command', needsConfirmation: false }
    }
    return { allowed: true, reason: 'default', needsConfirmation: true }
  }

  // ─── File write protection ───
  if (['write_file', 'edit_file'].includes(toolName)) {
    if (input.path && isProtectedPath(input.path)) {
      return { allowed: false, reason: `Protected system path: ${input.path}`, needsConfirmation: false }
    }
    return { allowed: true, reason: 'default', needsConfirmation: false }
  }

  // ─── Default: allow all other tools ───
  return { allowed: true, reason: 'default', needsConfirmation: false }
}

/**
 * Load permission rules from config file.
 */
function loadPermissionRules(configPath) {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(raw)
      return config.rules || {}
    }
  } catch { /* use defaults */ }
  return {}
}

/**
 * Get all current permission rules (merging defaults with user config).
 */
function getAllRules(configPath) {
  const userRules = loadPermissionRules(configPath)
  return { ...DEFAULT_RULES, ...userRules }
}

module.exports = {
  MODES,
  DEFAULT_RULES,
  classifyCommand,
  checkToolPermission,
  matchRule,
  loadPermissionRules,
  getAllRules,
  isProtectedPath,
  PROTECTED_DIRS
}
