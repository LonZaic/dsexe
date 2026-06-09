// ═══════════════════════════════════════════
// MCP API Client
// ═══════════════════════════════════════════

import client from './client.js'

const BASE = '/api/mcp'

export const mcpApi = {
  listServers(projectPath) {
    const params = projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''
    return client.get(`${BASE}${params}`)
  },

  addServer(name, config, projectPath) {
    return client.post(BASE, { name, config, projectPath })
  },

  updateServer(name, config, projectPath) {
    return client.put(`${BASE}/${encodeURIComponent(name)}`, { config, projectPath })
  },

  deleteServer(name, projectPath) {
    return client.delete(`${BASE}/${encodeURIComponent(name)}`, { data: { projectPath } })
  },

  testConnection(name, config) {
    return client.post(`${BASE}/test`, { name, config })
  },

  reconnectServer(name, projectPath) {
    return client.post(`${BASE}/${encodeURIComponent(name)}/reconnect`, { projectPath })
  },

  getMarketplace() {
    return client.get(`${BASE}/marketplace`)
  },

  installFromMarketplace(mcpId, projectPath) {
    return client.post(`${BASE}/marketplace/install`, { mcpId, projectPath })
  },

  uploadConfig(filename, content, projectPath) {
    return client.post(`${BASE}/upload`, { filename, content, projectPath })
  },
}
