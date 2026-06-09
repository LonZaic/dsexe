<template>
  <div class="mkt-root">
    <div class="mkt-header">
      <h3>MCP 市场</h3>
      <p class="mkt-sub">安装预配置的 MCP 服务器，一键扩展 AI 能力</p>
    </div>

    <div class="mkt-grid" v-if="!loading">
      <div v-for="s in servers" :key="s.id" class="mkt-card">
        <div class="mkt-card-icon" :class="s.category">
          <svg v-if="s.icon === 'github'" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else-if="s.icon === 'database'" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <svg v-else-if="s.icon === 'search'" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/>
            <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="mkt-card-body">
          <div class="mkt-card-name">{{ s.name }}</div>
          <div class="mkt-card-desc">{{ s.description }}</div>
          <div class="mkt-card-tags">
            <span v-for="t in s.tags" :key="t" class="mkt-tag">{{ t }}</span>
          </div>
          <div class="mkt-card-meta">
            <span class="mkt-installs">{{ formatInstalls(s.installs) }} 次安装</span>
            <span v-if="s.official" class="mkt-official">官方</span>
          </div>
        </div>
        <button
          class="mkt-install-btn"
          :class="{ installed: installedIds.has(s.id) }"
          :disabled="installing === s.id || installedIds.has(s.id)"
          @click="install(s)"
        >
          <template v-if="installing === s.id">
            <svg class="spin" width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1" opacity=".25"/>
              <path d="M11.5 6.5a5 5 0 00-4-4.8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
            </svg>
          </template>
          <template v-else-if="installedIds.has(s.id)">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width=".8"/>
              <path d="M4 6.5l2 2 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            已安装
          </template>
          <template v-else>安装</template>
        </button>
      </div>
    </div>

    <div v-else class="mkt-loading"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMcpStore } from '../../stores/mcpStore.js'

const emit = defineEmits(['installed'])

const mcpStore = useMcpStore()
const loading = computed(() => mcpStore.marketplaceLoading)
const servers = computed(() => mcpStore.marketplaceServers)
const installing = ref(null)
const installedIds = ref(new Set())

onMounted(async () => {
  await mcpStore.loadMarketplace()
  // Check what's already installed
  try {
    const data = await mcpStore.loadServers(null)
    if (Array.isArray(data?.servers)) {
      data.servers.forEach(s => installedIds.value.add(s.name))
    }
  } catch {}
})

function formatInstalls(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

async function install(server) {
  installing.value = server.id
  try {
    await mcpStore.installFromMarketplace(server.id, null)
    installedIds.value.add(server.id)
    emit('installed', server.id)
  } catch (e) {
    // install failed
  } finally {
    installing.value = null
  }
}
</script>

<style scoped>
.mkt-root { padding: 0; }
.mkt-header { margin-bottom: 16px; }
.mkt-header h3 { font-size: 15px; font-weight: 500; color: var(--text); margin-bottom: 4px; }
.mkt-sub { font-size: 11px; color: var(--text3); font-weight: 300; }

.mkt-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mkt-card {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
  transition: border-color .15s;
}
.mkt-card:hover { border-color: var(--border2); }

.mkt-card-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--bg4); display: flex; align-items: center; justify-content: center;
  color: var(--text3); flex-shrink: 0;
}
.mkt-card-icon.development { color: var(--accent); }
.mkt-card-icon.database { color: var(--green); }
.mkt-card-icon.search { color: var(--yellow); }

.mkt-card-body { flex: 1; }
.mkt-card-name { font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 2px; }
.mkt-card-desc {
  font-size: 11px; color: var(--text3); font-weight: 300;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; line-height: 1.4; margin-bottom: 4px;
}
.mkt-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; }
.mkt-tag { font-size: 9px; padding: 1px 6px; border-radius: var(--radius-full); background: var(--bg4); color: var(--text3); }
.mkt-card-meta { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--text3); }
.mkt-official { color: var(--accent); background: var(--accent-muted); padding: 1px 6px; border-radius: var(--radius-full); }

.mkt-install-btn {
  padding: 6px 12px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg4);
  color: var(--text2); font-size: 11px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .12s; display: flex; align-items: center; gap: 5px;
  justify-content: center;
}
.mkt-install-btn:hover:not(:disabled) { background: var(--accent); color: #fff; border-color: var(--accent); }
.mkt-install-btn.installed { color: var(--green); border-color: rgba(63,185,80,.3); background: rgba(63,185,80,.08); cursor: default; }
.mkt-install-btn:disabled { cursor: default; }

.mkt-loading { text-align: center; color: var(--text3); font-size: 13px; font-weight: 300; padding: 32px; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
</style>
