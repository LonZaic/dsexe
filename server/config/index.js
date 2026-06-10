// ══════════════════════════════════════
// DeepSeek-Super Environment Configuration
// ══════════════════════════════════════

const path = require('path')

// Try to load .env from project root (simple parser, no dependency needed)
function loadEnv(filePath) {
  const fs = require('fs')
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

// Load .env from project root (E:\DeepSeek-Super\.env)
loadEnv(path.join(__dirname, '..', '..', '.env'))

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'bbot.db'),
  logLevel: process.env.LOG_LEVEL || 'info',
  agentWorkspace: process.env.AGENT_WORKSPACE || require('os').homedir(),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',
}

module.exports = config
