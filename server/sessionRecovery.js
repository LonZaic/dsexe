// ═══════════════════════════════════════════
// Session Recovery — JSONL transcript + crash resume
// Inspired by Claude Code: sessionStorage.ts, conversationRecovery.ts
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const os = require('os')

const SESSIONS_DIR = path.join(os.homedir(), '.deepseek-super', 'sessions')

function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

/**
 * Get session JSONL path for a project
 */
function getSessionPath(projectPath, sessionId) {
  ensureSessionsDir()
  const projectHash = Buffer.from(projectPath).toString('base64').replace(/[/+=]/g, '_').slice(0, 32)
  const dir = path.join(SESSIONS_DIR, projectHash)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${sessionId}.jsonl`)
}

/**
 * Append events to session JSONL (idempotent by event index)
 */
function recordEvents(projectPath, sessionId, events) {
  try {
    const filePath = getSessionPath(projectPath, sessionId)
    const existing = new Set()
    // Read existing IDs
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
      for (const line of lines) {
        try { const e = JSON.parse(line); if (e._idx !== undefined) existing.add(e._idx) } catch {}
      }
    }
    // Append only new events
    const stream = fs.createWriteStream(filePath, { flags: 'a' })
    for (let i = 0; i < events.length; i++) {
      if (!existing.has(i)) {
        stream.write(JSON.stringify({ _idx: i, ...events[i] }) + '\n')
      }
    }
    stream.end()
  } catch {}
}

/**
 * Load events from session JSONL
 */
function loadSession(projectPath, sessionId) {
  try {
    const filePath = getSessionPath(projectPath, sessionId)
    if (!fs.existsSync(filePath)) return null
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean)
    const events = lines.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    // Sort by index
    events.sort((a, b) => (a._idx || 0) - (b._idx || 0))
    return {
      sessionId,
      events,
      lastTask: events.length ? events[events.length - 1] : null,
      completedTasks: events.filter(e => e.type === 'task_done').map(e => e.taskId),
      recoveryPoint: events.length, // resume from this index
      hasState: events.length > 0,
    }
  } catch { return null }
}

/**
 * List recent sessions for a project
 */
function listSessions(projectPath) {
  try {
    const projectHash = Buffer.from(projectPath).toString('base64').replace(/[/+=]/g, '_').slice(0, 32)
    const dir = path.join(SESSIONS_DIR, projectHash)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace('.jsonl', ''))
      .sort()
      .reverse()
      .slice(0, 10)
  } catch { return [] }
}

/**
 * Delete a session
 */
function deleteSession(projectPath, sessionId) {
  try {
    const filePath = getSessionPath(projectPath, sessionId)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}
}

/**
 * Build recovery prompt from saved session
 */
function buildRecoveryPrompt(projectPath, sessionId, originalTask) {
  const session = loadSession(projectPath, sessionId)
  if (!session || !session.hasState) return null

  const completedTaskIds = session.completedTasks
  const lastEvents = session.events.slice(-20)
  const summary = lastEvents
    .filter(e => e.type === 'task_done' || e.type === 'task_start' || e.type === 'tool_result')
    .map(e => `[${e.type}] ${e.text || e.taskId || e.tool || ''}`)
    .join('\n')

  return `## 会话恢复

之前的会话 ${sessionId} 在以下位置中断。已完成 ${completedTaskIds.length} 个步骤。

### 最近活动
${summary.slice(0, 1000)}

### 用户原始任务
${originalTask}

### 指令
请从断点继续工作。不要重复已完成的步骤。先检查项目当前状态，然后继续未完成的工作。`
}

module.exports = {
  SESSIONS_DIR, ensureSessionsDir,
  getSessionPath, recordEvents, loadSession,
  listSessions, deleteSession, buildRecoveryPrompt
}
