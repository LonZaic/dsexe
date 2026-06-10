// ══════════════════════════════════════
// DeepSeek-Super Server Entry Point
// Just starts the server — all setup is in app.js
// ══════════════════════════════════════

const http = require('http')
const createApp = require('./app')
const config = require('./config')
const logger = require('./config/logger')
const { user } = require('./db')
const { ensureMemDir, MEMORY_DIR } = require('./engine/memory')
const { setupWebSocket } = require('./ws')

// Ensure memory directory on startup
ensureMemDir(MEMORY_DIR)

// Create Express app
const app = createApp()

// Create HTTP server
const server = http.createServer(app)

// Reset all users to offline on startup
user.setAllOffline()

// Setup WebSocket
setupWebSocket(server)

// Start listening
server.listen(config.port, () => {
  logger.info(`DeepSeek-Super API server running on http://localhost:${config.port}`)
  logger.info(`WebSocket on ws://localhost:${config.port}/ws`)
  logger.info(`Environment: ${config.nodeEnv}`)
  logger.info(`Log level: ${config.logLevel}`)
})
