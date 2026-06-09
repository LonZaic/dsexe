// ═══════════════════════════════════════════
// MCP Controller — CRUD + connection management
// ═══════════════════════════════════════════

const { loadMcpConfig, saveMcpConfig, testConnection, fetchMcpTools, disconnectServer } = require('../mcp/client')
const { MCP_SERVERS } = require('../marketplace/registry')

// GET /api/mcp
async function listServers(req, res) {
  try {
    const projectPath = req.query.project || req.body?.projectPath || process.cwd()
    const configs = loadMcpConfig(projectPath)

    const servers = []
    for (const [name, config] of Object.entries(configs)) {
      let status = 'unknown'
      let toolCount = 0
      let error = null

      try {
        const result = await testConnection(name, config)
        if (result.success) {
          status = 'connected'
          toolCount = result.tools || 0
        } else {
          status = 'disconnected'
          error = result.error || 'Connection failed'
        }
      } catch (e) {
        status = 'disconnected'
        error = e.message
      }

      servers.push({
        name,
        config: { ...config, env: undefined },
        status,
        toolCount,
        error,
      })
    }

    res.json({ servers })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// POST /api/mcp
async function addServer(req, res) {
  try {
    const { name, config, projectPath } = req.body
    if (!name || !config) {
      return res.status(400).json({ error: 'name and config are required' })
    }

    const servers = loadMcpConfig(projectPath || process.cwd())
    servers[name] = config
    saveMcpConfig(projectPath || process.cwd(), servers)

    res.json({ success: true, name })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// PUT /api/mcp/:name
async function updateServer(req, res) {
  try {
    const { name } = req.params
    const { config, projectPath } = req.body
    const servers = loadMcpConfig(projectPath || process.cwd())
    if (!servers[name]) return res.status(404).json({ error: 'Server not found' })

    servers[name] = { ...servers[name], ...config }
    saveMcpConfig(projectPath || process.cwd(), servers)

    // If disabled, disconnect
    if (config?.disabled) disconnectServer(name)

    res.json({ success: true, name })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// DELETE /api/mcp/:name
async function deleteServer(req, res) {
  try {
    const { name } = req.params
    const projectPath = req.body?.projectPath || process.cwd()
    const servers = loadMcpConfig(projectPath)
    if (!servers[name]) return res.status(404).json({ error: 'Server not found' })

    disconnectServer(name)
    delete servers[name]
    saveMcpConfig(projectPath, servers)

    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// POST /api/mcp/test
async function testServer(req, res) {
  try {
    const { name, config } = req.body
    const result = await testConnection(name, config)
    // also fetch tools count
    let toolCount = 0
    if (result.success) {
      const tools = await fetchMcpTools(name, config)
      toolCount = tools.length
    }
    res.json({ ...result, toolCount })
  } catch (e) {
    res.json({ success: false, error: e.message })
  }
}

// POST /api/mcp/:name/reconnect
async function reconnectServer(req, res) {
  try {
    const { name } = req.params
    const projectPath = req.body?.projectPath || process.cwd()
    const servers = loadMcpConfig(projectPath)
    if (!servers[name]) return res.status(404).json({ error: 'Server not found' })

    disconnectServer(name)
    const result = await testConnection(name, servers[name])

    res.json({ success: result.success, error: result.error })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// GET /api/mcp/marketplace
function getMarketplace(req, res) {
  res.json({ servers: MCP_SERVERS })
}

// POST /api/mcp/marketplace/install
async function installFromMarketplace(req, res) {
  try {
    const { mcpId, projectPath } = req.body
    const server = MCP_SERVERS.find(s => s.id === mcpId)
    if (!server) return res.status(404).json({ error: 'Server not found in marketplace' })

    const config = {
      type: server.type,
      command: server.command,
      args: server.args,
      env: server.env,
      description: server.description,
    }

    const servers = loadMcpConfig(projectPath || process.cwd())
    servers[server.id] = config
    saveMcpConfig(projectPath || process.cwd(), servers)

    res.json({ success: true, name: server.id, server: { ...server, config: undefined } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// POST /api/mcp/upload — Upload .json config file
async function uploadConfig(req, res) {
  try {
    const { filename, content, projectPath } = req.body
    if (!content) return res.status(400).json({ error: 'File content is required' })

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON file: ' + e.message })
    }

    // Accept both top-level mcpServers object and raw server configs
    const mcpServers = parsed.mcpServers || parsed
    if (!mcpServers || typeof mcpServers !== 'object') {
      return res.status(400).json({ error: 'JSON must contain "mcpServers" object or server name→config map' })
    }

    const servers = loadMcpConfig(projectPath || process.cwd())
    let added = 0
    for (const [name, config] of Object.entries(mcpServers)) {
      if (!config || typeof config !== 'object') continue
      if (!config.command && !config.url) continue
      servers[name] = { ...config }
      added++
    }

    if (!added) return res.status(400).json({ error: 'No valid MCP server configs found. Each server needs at least command+url.' })

    saveMcpConfig(projectPath || process.cwd(), servers)
    res.json({ success: true, added, servers: Object.keys(mcpServers) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = {
  listServers, addServer, updateServer, deleteServer,
  testServer, reconnectServer,
  getMarketplace, installFromMarketplace,
  uploadConfig,
}
