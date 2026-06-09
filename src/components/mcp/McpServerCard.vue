<template>
  <div class="mcp-card" :class="{ disconnected: server.status !== 'connected', disabled: server.config?.disabled }">
    <div class="mcp-card-main">
      <div class="mcp-card-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="mcp-card-info">
        <div class="mcp-card-name">{{ server.name }}</div>
        <div class="mcp-card-desc">{{ server.config?.description || server.config?.command || 'No description' }}</div>
        <div class="mcp-card-meta">
          <span :class="['mcp-status', server.status]">
            <span class="mcp-status-dot"></span>
            {{ statusLabel }}
          </span>
          <span v-if="server.status === 'connected'" class="mcp-tool-count">{{ server.toolCount }} tools</span>
          <span v-if="server.error" class="mcp-err">{{ server.error }}</span>
          <span v-if="server.config?.disabled" class="mcp-disabled-tag">Disabled</span>
        </div>
      </div>
    </div>
    <div class="mcp-card-actions">
      <button
        v-if="server.status !== 'connected' && !server.config?.disabled"
        class="mcp-act-btn reconnect"
        title="Reconnect"
        @click="$emit('reconnect', server.name)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button
        class="mcp-act-btn edit"
        title="Edit"
        @click="$emit('edit', server.name)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button
        class="mcp-act-btn remove"
        title="Remove"
        @click="$emit('remove', server.name)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  server: { type: Object, required: true },
})

defineEmits(['reconnect', 'edit', 'remove'])

const statusLabel = computed(() => {
  if (props.server.config?.disabled) return 'Disabled'
  if (props.server.status === 'connected') return 'Connected'
  if (props.server.status === 'connecting') return 'Connecting...'
  return 'Disconnected'
})
</script>

<style scoped>
.mcp-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px; border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg3);
  transition: border-color .15s, background .15s;
  margin-bottom: 6px;
}
.mcp-card:hover { border-color: var(--border2); background: var(--bg3); }
.mcp-card.disconnected { border-color: rgba(248,81,73,0.2); background: rgba(248,81,73,0.04); }
.mcp-card.disabled { opacity: 0.55; }

.mcp-card-main { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }

.mcp-card-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--bg4); display: flex; align-items: center; justify-content: center;
  color: var(--text2); flex-shrink: 0;
}

.mcp-card-info { flex: 1; min-width: 0; }
.mcp-card-name {
  font-size: 13px; font-weight: 500; color: var(--text);
  margin-bottom: 2px;
}
.mcp-card-desc {
  font-size: 11px; color: var(--text3); font-weight: 300;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mcp-card-meta {
  display: flex; align-items: center; gap: 10px;
  margin-top: 6px; font-size: 11px; font-weight: 300;
}

.mcp-status { display: flex; align-items: center; gap: 5px; color: var(--text2); }
.mcp-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text3); }
.mcp-status.connected .mcp-status-dot { background: var(--green); }
.mcp-status.disconnected .mcp-status-dot { background: var(--red); }
.mcp-status.connecting .mcp-status-dot { background: var(--yellow); animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

.mcp-tool-count { color: var(--accent); background: var(--accent-muted); padding: 1px 6px; border-radius: var(--radius-full); }
.mcp-err { color: var(--red); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.mcp-disabled-tag { color: var(--text3); background: var(--bg4); padding: 1px 6px; border-radius: var(--radius-full); }

.mcp-card-actions { display: flex; gap: 2px; flex-shrink: 0; }
.mcp-act-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent;
  color: var(--text3); cursor: pointer;
  transition: all .12s;
}
.mcp-act-btn:hover { background: var(--bg4); color: var(--text2); }
.mcp-act-btn.remove:hover { background: rgba(248,81,73,0.12); color: var(--red); }
.mcp-act-btn.reconnect:hover { color: var(--accent); background: var(--accent-muted); }
</style>
