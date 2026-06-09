// ═══════════════════════════════════════════
// MCP Store — MCP server state management
// ═══════════════════════════════════════════

import { ref, computed } from 'vue'
import { mcpApi } from '../api/mcp.api.js'

// Singleton state shared across components
const servers = ref([])
const loading = ref(false)
const error = ref(null)
const marketplaceServers = ref([])
const marketplaceLoading = ref(false)

export function useMcpStore() {
  const connectedServers = computed(() =>
    servers.value.filter(s => s.status === 'connected')
  )
  const disconnectedServers = computed(() =>
    servers.value.filter(s => s.status !== 'connected')
  )
  const totalToolCount = computed(() =>
    servers.value.reduce((sum, s) => sum + (s.toolCount || 0), 0)
  )

  async function loadServers(projectPath) {
    loading.value = true
    error.value = null
    try {
      const data = await mcpApi.listServers(projectPath)
      servers.value = data.servers || []
    } catch (e) {
      error.value = e.message
      servers.value = []
    } finally {
      loading.value = false
    }
  }

  async function addServer(name, config, projectPath) {
    await mcpApi.addServer(name, config, projectPath)
    await loadServers(projectPath)
  }

  async function updateServer(name, config, projectPath) {
    await mcpApi.updateServer(name, config, projectPath)
    await loadServers(projectPath)
  }

  async function deleteServer(name, projectPath) {
    await mcpApi.deleteServer(name, projectPath)
    await loadServers(projectPath)
  }

  async function testConnection(name, config) {
    return await mcpApi.testConnection(name, config)
  }

  async function reconnectServer(name, projectPath) {
    const result = await mcpApi.reconnectServer(name, projectPath)
    await loadServers(projectPath)
    return result
  }

  async function loadMarketplace() {
    marketplaceLoading.value = true
    try {
      const data = await mcpApi.getMarketplace()
      marketplaceServers.value = data.servers || []
    } catch (e) {
      marketplaceServers.value = []
    } finally {
      marketplaceLoading.value = false
    }
  }

  async function installFromMarketplace(mcpId, projectPath) {
    const result = await mcpApi.installFromMarketplace(mcpId, projectPath)
    await loadServers(projectPath)
    return result
  }

  return {
    servers, loading, error,
    marketplaceServers, marketplaceLoading,
    connectedServers, disconnectedServers, totalToolCount,
    loadServers, addServer, updateServer, deleteServer,
    testConnection, reconnectServer,
    loadMarketplace, installFromMarketplace,
  }
}
