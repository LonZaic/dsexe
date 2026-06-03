// ══════════════════════════════════════
// DeepSeek-Super Express Application Factory
// Registers all middleware and routes
// ══════════════════════════════════════

const path = require('path')
const fs = require('fs')
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

  // ─── Mount all API routes ───
  app.use(routes)

  // ─── Serve built frontend (production only) ───
  const distPath = path.join(__dirname, '..', 'dist')
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath))
    // SPA fallback: non-API routes → index.html
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) return
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  // ─── Global error handler (must be last) ───
  app.use(errorHandler)

  return app
}

module.exports = createApp
