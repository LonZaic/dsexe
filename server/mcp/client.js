// ═══════════════════════════════════════════
// MCP Client — Enhanced Model Context Protocol
// Supports: stdio, SSE, HTTP transports
// Config: .mcp.json, settings.json, .superds/settings.json
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const os = require('os')

const _connections = {}
const MCP_CONFIG_FILENAME = '.mcp.json'
const DS_SETTINGS_DIR = '.superds'

function loadMcpConfig(projectPath) {
  const servers = {}

  // Load from project .mcp.json
  if (projectPath) {
    const projectConfig = path.join(projectPath, MCP_CONFIG_FILENAME)
    if (fs.existsSync(projectConfig)) {
      try {
        const json = JSON.parse(fs.readFileSync(projectConfig, 'utf-8'))
        Object.assign(servers, json.mcpServers || {})
      } catch {}
    }

    // Load from .superds/settings.json
    const dsSettingsPath = path.join(projectPath, DS_SETTINGS_DIR, 'settings.json')
    if (fs.existsSync(dsSettingsPath)) {
      try {
        const json = JSON.parse(fs.readFileSync(dsSettingsPath, 'utf-8'))
        Object.assign(servers, json.mcpServers || {})
      } catch {}
    }
  }

  // Load from user settings
  const userSettingsPath = path.join(os.homedir(), DS_SETTINGS_DIR, 'settings.json')
  if (fs.existsSync(userSettingsPath)) {
    try {
      const json = JSON.parse(fs.readFileSync(userSettingsPath, 'utf-8'))
      Object.assign(servers, json.mcpServers || {})
    } catch {}
  }

  return servers
}

function saveMcpConfig(projectPath, servers) {
  const configDir = projectPath
    ? path.join(projectPath, DS_SETTINGS_DIR)
    : path.join(os.homedir(), DS_SETTINGS_DIR)
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true })
  const settingsPath = path.join(configDir, 'settings.json')
  let settings = {}
  if (fs.existsSync(settingsPath)) {
    try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) } catch {}
  }
  settings.mcpServers = servers
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}

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
    type: 'stdio', name, process: child,
    tools: [], connected: true,
    _buf: '', _pending: new Map(), _nextId: 1,
  }

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
    // silent — stderr from MCP servers is not user-facing
  })

  child.on('exit', () => { conn.connected = false })
  child.on('error', () => { conn.connected = false })

  const initResult = await sendMcpRequest(conn, {
    jsonrpc: '2.0', method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'superds', version: '1.0.0' },
    },
  })

  if (!initResult || initResult.error) {
    try { child.kill() } catch {}
    return { type: 'stdio', name, connected: false, tools: [], error: initResult?.error?.message || 'Initialization failed' }
  }

  _connections[key] = conn
  return conn
}

function sendMcpRequest(conn, request) {
  return new Promise((resolve, reject) => {
    const id = conn._nextId++
    const req = { ...request, id }
    conn._pending.set(id, resolve)
    try {
      conn.process.stdin.write(JSON.stringify(req) + '\n')
    } catch (e) {
      conn._pending.delete(id)
      reject(new Error('Failed to write to stdin: ' + e.message))
    }
    setTimeout(() => {
      if (conn._pending.has(id)) {
        conn._pending.delete(id)
        reject(new Error('MCP request timeout after 30s'))
      }
    }, 30000)
  })
}

async function fetchHttpMcpTools(name, config) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(`${config.url}/tools/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
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
  } catch (e) { return [] }
}

async function fetchMcpTools(name, config) {
  try {
    if (config.type === 'sse' || config.type === 'streamable-http' || config.type === 'http') {
      return await fetchHttpMcpTools(name, config)
    }

    const conn = await connectStdioServer(name, config)
    if (!conn || !conn.connected) return []

    const result = await sendMcpRequest(conn, { jsonrpc: '2.0', method: 'tools/list', params: {} })
    if (!result || result.error) return []

    return (result.result?.tools || []).map(t => ({
      type: 'function',
      function: {
        name: `mcp__${name}__${t.name}`,
        description: `[MCP:${name}] ${t.description || t.name}`,
        parameters: t.inputSchema || { type: 'object', properties: {} },
      },
      _mcp: { server: name, toolName: t.name, config },
      _isMcp: true,
    }))
  } catch (e) {
    return []
  }
}

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
      jsonrpc: '2.0', method: 'tools/call',
      params: { name: mcpInfo.toolName, arguments: args },
    })

    if (result.error) return `MCP error: ${result.error.message}`
    const content = result.result?.content
    if (Array.isArray(content)) {
      return content.map(c => (c.type === 'text' ? c.text : JSON.stringify(c))).join('\n')
    }
    return JSON.stringify(result.result, null, 2)
  } catch (e) {
    return `MCP execution error: ${e.message}`
  }
}

function extractMcpInfo(toolName) {
  const m = toolName.match(/^mcp__(.+?)__(.+)$/)
  if (!m) return null
  return { server: m[1], toolName: m[2] }
}

async function loadAllMcpTools(projectPath) {
  const configs = loadMcpConfig(projectPath)
  const allTools = []
  for (const [name, config] of Object.entries(configs)) {
    if (config.disabled) continue
    try {
      const tools = await fetchMcpTools(name, config)
      const allowedTools = config.allowedTools || config.alwaysAllow || []
      const filtered = allowedTools.length
        ? tools.filter(t => allowedTools.includes(t._mcp.toolName) || allowedTools.includes('*'))
        : tools
      allTools.push(...filtered)
    } catch (e) {
      // server fails to load — skip silently
    }
  }
  return allTools
}

async function testConnection(name, config) {
  try {
    if (config.type === 'sse' || config.type === 'http') {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`${config.url}/tools/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      return { success: res.ok, status: res.status }
    }

    const conn = await connectStdioServer(name, config)
    return { success: conn && conn.connected, tools: (conn?.tools || []).length }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

function disconnectServer(name) {
  const key = `${name}-stdio`
  if (_connections[key]) {
    try { _connections[key].process.kill() } catch {}
    delete _connections[key]
  }
}

module.exports = {
  loadMcpConfig, saveMcpConfig,
  fetchMcpTools, loadAllMcpTools,
  executeMcpTool, extractMcpInfo,
  testConnection, connectStdioServer,
  disconnectServer,
}
