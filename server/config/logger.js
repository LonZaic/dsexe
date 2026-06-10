// ══════════════════════════════════════
// SuperDS Logger
// Simple structured logger — no heavy dependencies
// ══════════════════════════════════════

const config = require('./index')

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const currentLevel = LEVELS[config.logLevel] || LEVELS.info

function formatTimestamp() {
  return new Date().toISOString()
}

function shouldLog(level) {
  return (LEVELS[level] || 99) >= currentLevel
}

const logger = {
  debug(msg, meta = {}) {
    if (!shouldLog('debug')) return
    console.debug(`[${formatTimestamp()}] DEBUG ${msg}`, Object.keys(meta).length ? meta : '')
  },

  info(msg, meta = {}) {
    if (!shouldLog('info')) return
    console.log(`[${formatTimestamp()}] INFO  ${msg}`, Object.keys(meta).length ? meta : '')
  },

  warn(msg, meta = {}) {
    if (!shouldLog('warn')) return
    console.warn(`[${formatTimestamp()}] WARN  ${msg}`, Object.keys(meta).length ? meta : '')
  },

  error(msg, meta = {}) {
    if (!shouldLog('error')) return
    console.error(`[${formatTimestamp()}] ERROR ${msg}`, Object.keys(meta).length ? meta : '')
  },

  // Request logger middleware for Express
  requestLogger(req, res, next) {
    const start = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - start
      const level = res.statusCode >= 400 ? 'warn' : 'info'
      logger[level]('request', {
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        duration: duration + 'ms',
      })
    })
    next()
  },
}

module.exports = logger
