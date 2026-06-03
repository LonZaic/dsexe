// ══════════════════════════════════════
// DeepSeek-Super Express Application Factory
// Registers all middleware and routes
// ══════════════════════════════════════

const express = require('express')
const cors = require('cors')
const logger = require('./config/logger')
const { errorHandler } = require('./middleware/errorHandler')
const rateLimiter = require('./middleware/rateLimiter')
const routes = require('./routes/index')

function createApp() {
  const app = express()

  // ─── Core middleware ───
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))

  // ─── Request logging ───
  app.use(logger.requestLogger)

  // ─── Rate limiting ───
  app.use(rateLimiter)

  // ─── Mount all routes ───
  app.use(routes)

  // ─── Global error handler (must be last) ───
  app.use(errorHandler)

  return app
}

module.exports = createApp
