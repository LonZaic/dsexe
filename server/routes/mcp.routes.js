// ═══════════════════════════════════════════
// MCP Routes — API for managing MCP servers
// ═══════════════════════════════════════════

const { Router } = require('express')
const mcpController = require('../controllers/mcp.controller')

const router = Router()

// List all configured MCP servers (with connection status)
router.get('/', mcpController.listServers)

// Add a new MCP server config
router.post('/', mcpController.addServer)

// Update an MCP server config
router.put('/:name', mcpController.updateServer)

// Delete an MCP server config
router.delete('/:name', mcpController.deleteServer)

// Test connection to an MCP server
router.post('/test', mcpController.testServer)

// Reconnect to an MCP server
router.post('/:name/reconnect', mcpController.reconnectServer)

// Get marketplace MCP servers
router.get('/marketplace', mcpController.getMarketplace)

// Install a marketplace MCP server
router.post('/marketplace/install', mcpController.installFromMarketplace)

// Upload MCP config file (.json)
router.post('/upload', mcpController.uploadConfig)

module.exports = router
