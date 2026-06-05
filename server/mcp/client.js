// ═══════════════════════════════════════════
// MCP Client — Model Context Protocol integration
// Connects to MCP servers, fetches tools as function definitions
// Config: settings.json mcpServers or .mcp.json in project
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

// Store active connections
const _connections = {}

/**
 * Load MCP server configs from all sources
 */
function loadMcpConfig(projectPath) {
  const servers = {}

  // Load from project .mcp.json
  if (projectPath) {
    const projectConfig = path.join(projectPath, '.mcp.json')
    if (fs.existsSync(projectConfig)) {
      try { Object.assign(servers, JSON.parse(fs.readFileSync(projectConfig, 'utf-8')).mcpServers || {}) } catch {}
    }
  }

  // Load from settings
  const settingsPath = path.join(projectPath || process.cwd(), '.deepseek-super', 'settings.json')
  if (fs.existsSync(settingsPath)) {
    try { Object.assign(servers, JSON.parse(fs.readFileSync(settingsPath, 'utf-8')).mcpServers || {}) } catch {}
  }

  return servers
}

/**
 * Start a stdio-based MCP server and return connection
 */
async function connectStdioServer(name, config) {
  const key = `${name}-stdio`
  if (_connections[key] && _connections[key].process && !_connections[key].process.killed) {
    return _connections[key]
  }

  const child = spawn(config.command, config.args || [], {
    env: { ...process.env, ...config.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: config.cwd || process.cwd(),
  })

  const conn = {
    type: 'stdio',
    name,
    process: child,
    tools: [],
    connected: true,
    _buf: '',
    _pending: new Map(),
    _nextId: 1,
  }

  // Read responses
  child.stdout.on('data', (chunk) => {
    conn._buf += chunk.toString()
    const lines = conn._buf.split('\n')
    conn._buf = lines.pop() || ''
    for (const line of lines) {
      try {
        const msg = JSON.parse(line)
        if (msg.id && conn._pending.has(msg.id)) {
          conn._pending.get(msg.id)(msg)
          conn._pending.delete(msg.id)
        }
      } catch {}
    }
  })

  child.stderr.on('data', (d) => {
    console.error(`[MCP:${name}] stderr:`, d.toString().slice(0, 200))
  })

  child.on('exit', () => { conn.connected = false })
  child.on('error', () => { conn.connected = false })

  // Send initialize
  const initResult = await sendMcpRequest(conn, {
    jsonrpc: '2.0', method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'deepseek-super', version: '1.0.0' } },
  })

  if (!initResult || initResult.error) {
    child.kill()
    return { type: 'stdio', name, connected: false, tools: [], error: initResult?.error?.message || 'Init failed' }
  }

  _connections[key] = conn
  return conn
}

function sendMcpRequest(conn, request) {
  return new Promise((resolve, reject) => {
    const id = conn._nextId++
    const req = { ...request, id }
    conn._pending.set(id, resolve)
    conn.process.stdin.write(JSON.stringify(req) + '\n')
    setTimeout(() => {
      if (conn._pending.has(id)) {
        conn._pending.delete(id)
        reject(new Error('MCP request timeout'))
      }
    }, 30000)
  })
}

/**
 * Fetch tool list from an MCP server
 */
async function fetchMcpTools(name, config) {
  try {
    let conn
    if (config.type === 'stdio' || !config.type) {
      conn = await connectStdioServer(name, config)
    } else if (config.type === 'sse' || config.type === 'streamable-http') {
      // HTTP-based MCP — fetch tools via HTTP
      return await fetchHttpMcpTools(name, config)
    } else {
      return []
    }

    if (!conn || !conn.connected) return []

    const result = await sendMcpRequest(conn, {
      jsonrpc: '2.0', method: 'tools/list', params: {}
    })

    if (!result || result.error) return []

    const tools = (result.result?.tools || []).map(t => ({
      type: 'function',
      function: {
        name: `mcp__${name}__${t.name}`,
        description: `[MCP:${name}] ${t.description || t.name}`,
        parameters: t.inputSchema || { type: 'object', properties: {} },
      },
      _mcp: { server: name, toolName: t.name, config },
      _isMcp: true,
    }))

    conn.tools = tools
    return tools
  } catch (e) {
    console.error(`[MCP:${name}] Error:`, e.message)
    return []
  }
}

/**
 * Fetch tools from HTTP-based MCP server
 */
async function fetchHttpMcpTools(name, config) {
  try {
    const res = await fetch(`${config.url}/tools/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...config.headers },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 }),
    })
    const data = await res.json()
    return (data.result?.tools || []).map(t => ({
      type: 'function',
      function: {
        name: `mcp__${name}__${t.name}`,
        description: `[MCP:${name}] ${t.description || t.name}`,
        parameters: t.inputSchema || { type: 'object', properties: {} },
      },
      _mcp: { server: name, toolName: t.name, config },
      _isMcp: true,
    }))
  } catch { return [] }
}

/**
 * Execute an MCP tool
 */
async function executeMcpTool(toolName, args, projectPath) {
  const mcpInfo = extractMcpInfo(toolName)
  if (!mcpInfo) return `Unknown MCP tool: ${toolName}`

  const configs = loadMcpConfig(projectPath)
  const config = configs[mcpInfo.server]
  if (!config) return `MCP server not configured: ${mcpInfo.server}`

  try {
    const conn = await connectStdioServer(mcpInfo.server, config)
    if (!conn || !conn.connected) return `MCP server disconnected: ${mcpInfo.server}`

    const result = await sendMcpRequest(conn, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: mcpInfo.toolName, arguments: args },
    })

    if (result.error) return `MCP error: ${result.error.message}`
    return JSON.stringify(result.result?.content || result.result, null, 2)
  } catch (e) {
    return `MCP execution error: ${e.message}`
  }
}

/**
 * Parse mcp__server__tool to { server, toolName }
 */
function extractMcpInfo(toolName) {
  const m = toolName.match(/^mcp__(.+?)__(.+)$/)
  if (!m) return null
  return { server: m[1], toolName: m[2] }
}

/**
 * Load all MCP tools for a project, combine with built-in tools
 */
async function loadAllMcpTools(projectPath) {
  const configs = loadMcpConfig(projectPath)
  const allTools = []

  for (const [name, config] of Object.entries(configs)) {
    if (config.disabled) continue
    try {
      const tools = await fetchMcpTools(name, config)
      const allowed = config.allowedTools || config.alwaysAllow || []
      const filtered = allowed.length
        ? tools.filter(t => allowed.includes(t._mcp.toolName) || allowed.includes('*'))
        : tools
      allTools.push(...filtered)
    } catch (e) {
      console.error(`[MCP] Failed to load tools from ${name}:`, e.message)
    }
  }

  return allTools
}

module.exports = {
  loadMcpConfig,
  fetchMcpTools,
  loadAllMcpTools,
  executeMcpTool,
  extractMcpInfo,
}
