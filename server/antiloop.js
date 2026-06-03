// ══════════════════════════════════════════════════════
// Anti-Loop System — CC-style loop detection & prevention
// Ported from CC's query.ts noop detection + enhanced
// ══════════════════════════════════════════════════════

const MAX_NOOP_REPEAT = 3       // same tool+args N times → loop
const MAX_OSCILLATION = 3       // A→B→A→B... N cycles → loop
const MAX_ERROR_REPEAT = 2      // same error N times → loop
const MAX_CONSECUTIVE_NOOP = 4  // consecutive identical actions → stuck
const HISTORY_SIZE = 15         // how many recent actions to track

/**
 * Create a loop detector instance for one agent run.
 */
function createLoopDetector(options = {}) {
  const maxNoop = options.maxNoopRepeat || MAX_NOOP_REPEAT
  const maxOsc = options.maxOscillation || MAX_OSCILLATION
  const maxErr = options.maxErrorRepeat || MAX_ERROR_REPEAT

  const actionHistory = []      // [{tool, argsHash, resultPreview, thinking}]
  const errorHistory = []       // [{message, count}]
  let consecutiveNoop = 0
  let interventionCount = 0   // how many times we've already intervened

  function hashArgs(args) {
    try { return JSON.stringify(args) } catch { return String(args) }
  }

  function recordAction(toolName, args, result, thinking) {
    const entry = {
      tool: toolName,
      argsHash: hashArgs(args),
      resultPreview: String(result || '').slice(0, 200),
      thinking: String(thinking || '').slice(0, 200),
      timestamp: Date.now()
    }
    actionHistory.push(entry)
    if (actionHistory.length > HISTORY_SIZE) actionHistory.shift()
    return entry
  }

  function recordError(errorMessage) {
    const existing = errorHistory.find(e => e.message === errorMessage)
    if (existing) {
      existing.count++
      existing.lastSeen = Date.now()
    } else {
      errorHistory.push({ message: errorMessage, count: 1, lastSeen: Date.now() })
      if (errorHistory.length > 10) errorHistory.shift()
    }
  }

  function checkLoop() {
    if (actionHistory.length < maxNoop) {
      return { isLoop: false }
    }

    // ─── Check 1: consecutive identical actions ───
    const recent = actionHistory.slice(-maxNoop)
    const allSame = recent.every(a => a.tool === recent[0].tool && a.argsHash === recent[0].argsHash)

    if (allSame) {
      consecutiveNoop++
      const severity = Math.min(consecutiveNoop, 3)
      let action, message

      if (severity >= 3) {
        action = 'stop'
        message = `[System] CRITICAL: You have repeated "${recent[0].tool}" ${consecutiveNoop + maxNoop - 1} times with the same arguments. This is a loop. The agent will now stop. Please summarize what you have accomplished.`
      } else if (severity >= 2) {
        action = 'redirect'
        message = `[System] WARNING: You have repeated "${recent[0].tool}" multiple times with the same args. This is not productive. You MUST try a completely different approach or tool. Do NOT call ${recent[0].tool} again.`
      } else {
        action = 'warn'
        message = `[System] Notice: You just called "${recent[0].tool}" with the same arguments again. If this was unintentional, please try a different approach.`
      }

      interventionCount++
      return { isLoop: true, severity, action, message, tool: recent[0].tool, consecutiveNoop }
    }

    // ─── Check 2: oscillation detection (A→B→A→B pattern) ───
    if (actionHistory.length >= maxOsc * 2) {
      const last4 = actionHistory.slice(-4)
      if (last4.length === 4) {
        const pair1 = last4[0].tool + last4[0].argsHash
        const pair2 = last4[1].tool + last4[1].argsHash
        const pair3 = last4[2].tool + last4[2].argsHash
        const pair4 = last4[3].tool + last4[3].argsHash
        // A→B→A→B
        if (pair1 === pair3 && pair2 === pair4 && pair1 !== pair2) {
          consecutiveNoop++
          interventionCount++
          return {
            isLoop: true,
            severity: 2,
            action: 'redirect',
            message: `[System] WARNING: Detected oscillation between "${last4[0].tool}" and "${last4[1].tool}". You are going back and forth without making progress. Pick ONE direction and commit to it. Do NOT switch back.`,
            tool: `${last4[0].tool}<->${last4[1].tool}`,
            consecutiveNoop
          }
        }
      }
    }

    // ─── Check 3: error repetition ───
    for (const err of errorHistory) {
      if (err.count > maxErr) {
        interventionCount++
        return {
          isLoop: true,
          severity: 2,
          action: 'redirect',
          message: `[System] WARNING: The error "${err.message.slice(0, 80)}" has occurred ${err.count} times. Stop trying the same approach. Acknowledge the error and try something completely different, or ask for help.`,
          tool: 'error',
          consecutiveNoop: err.count
        }
      }
    }

    // ─── Reset noop counter if we got here (action was different) ───
    consecutiveNoop = 0
    return { isLoop: false }
  }

  function isStuck() {
    return consecutiveNoop >= 3 || interventionCount >= 5
  }

  function reset() {
    actionHistory.length = 0
    errorHistory.length = 0
    consecutiveNoop = 0
    interventionCount = 0
  }

  function getStats() {
    return {
      totalActions: actionHistory.length,
      consecutiveNoop,
      interventionCount,
      uniqueErrors: errorHistory.length,
      recentTools: actionHistory.slice(-5).map(a => a.tool)
    }
  }

  return { recordAction, recordError, checkLoop, isStuck, reset, getStats }
}

module.exports = { createLoopDetector, MAX_NOOP_REPEAT, MAX_OSCILLATION, MAX_ERROR_REPEAT, MAX_CONSECUTIVE_NOOP }
