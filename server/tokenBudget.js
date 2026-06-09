// ══════════════════════════════════════════════════════
// Token Budget Tracker — CC-style budget management
// Ported from CC's query/tokenBudget.ts pattern
// ══════════════════════════════════════════════════════

const DEFAULT_BUDGET = 800000       // total token budget per agent run (1M context, leave margin)
const NUDGE_THRESHOLD = 0.85        // 85% → warn
const FORCE_THRESHOLD = 0.95        // 95% → force stop
const DIMINISHING_WINDOW = 3        // check last N rounds for diminishing returns
const DIMINISHING_THRESHOLD = 1000   // if per-round output drops below this, consider stopping

/**
 * Create a token budget tracker for one agent run.
 */
function createBudgetTracker(totalBudget = DEFAULT_BUDGET) {
  let inputTokens = 0
  let outputTokens = 0
  const roundOutputs = []           // [{round, tokens}]

  function recordInput(tokens) {
    inputTokens += Math.max(0, Math.round(tokens))
  }

  function recordOutput(tokens, round) {
    const t = Math.max(0, Math.round(tokens))
    outputTokens += t
    roundOutputs.push({ round, tokens: t })
    // Keep only last 10 rounds for diminishing check
    if (roundOutputs.length > 10) roundOutputs.shift()
  }

  function getStatus() {
    const totalUsed = inputTokens + outputTokens
    const remaining = Math.max(0, totalBudget - totalUsed)
    const pct = totalBudget > 0 ? totalUsed / totalBudget : 0

    const shouldNudge = pct >= NUDGE_THRESHOLD && pct < FORCE_THRESHOLD
    const shouldForceStop = pct >= FORCE_THRESHOLD

    // Diminishing returns check: look at last N rounds
    let diminishing = false
    if (roundOutputs.length >= DIMINISHING_WINDOW) {
      const recent = roundOutputs.slice(-DIMINISHING_WINDOW)
      const allSmall = recent.every(r => r.tokens < DIMINISHING_THRESHOLD)
      diminishing = allSmall && pct > 0.5  // only flag if we've used meaningful budget
    }

    return {
      used: totalUsed,
      inputTokens,
      outputTokens,
      remaining,
      pct: Math.round(pct * 100) / 100,
      shouldNudge,
      shouldForceStop,
      diminishing,
      totalBudget
    }
  }

  function getNudgeMessage() {
    const status = getStatus()
    if (status.shouldForceStop) {
      return `[System] CRITICAL: Token budget nearly exhausted (${Math.round(status.pct * 100)}% used, ${status.remaining} remaining). You MUST stop calling tools and provide a final summary NOW. Just output text — no more tool calls.`
    }
    if (status.shouldNudge && status.diminishing) {
      return `[System] Notice: Token budget at ${Math.round(status.pct * 100)}%. Your recent rounds have produced little new output. Consider wrapping up and providing a summary of what you've accomplished.`
    }
    if (status.shouldNudge) {
      return `[System] Heads up: Token budget at ${Math.round(status.pct * 100)}% (${status.remaining} tokens remaining). Prioritize completing the core task and avoid unnecessary exploration.`
    }
    return null
  }

  function reset() {
    inputTokens = 0
    outputTokens = 0
    roundOutputs.length = 0
  }

  return { recordInput, recordOutput, getStatus, getNudgeMessage, reset }
}

module.exports = { createBudgetTracker, DEFAULT_BUDGET, NUDGE_THRESHOLD, FORCE_THRESHOLD }
