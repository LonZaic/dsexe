<template>
  <div class="app-shell">
    <AppSidebar />
    <!-- ═══ Sidebar resize handle ═══ -->
    <div class="app-resize" @mousedown="startResize"></div>
    <main class="main-area">
      <router-view v-slot="{ Component, route: r }">
        <transition name="fade-up" mode="out-in">
          <component :is="Component" :key="r.fullPath" />
        </transition>
      </router-view>
    </main>
    <SettingsModal v-if="settingsOpen" :tab="settingsTab" @close="settingsOpen = false" />
  </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue'
import AppSidebar from './components/layout/AppSidebar.vue'
import SettingsModal from './components/layout/SettingsModal.vue'
import { useTheme } from './composables/useTheme.js'
import { connect } from './api/ws.js'

const theme = useTheme()
provide('theme', theme)

const settingsOpen = ref(false)
const settingsTab = ref(null)

provide('openSettings', (tab) => {
  settingsTab.value = tab || null
  settingsOpen.value = true
})

onMounted(() => {
  const token = localStorage.getItem('bbot_token')
  if (token) connect(token)
})

// ─── Sidebar resize ───
let _resizeStart = 0
function startResize(e) {
  _resizeStart = e.clientX
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResize(e) {
  const w = Math.max(200, Math.min(500, e.clientX))
  document.documentElement.style.setProperty('--sidebar-w', w + 'px')
}

function stopResize() {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  const w = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim()
  localStorage.setItem('sb_width', w)
}

// Restore saved sidebar width
try {
  const saved = localStorage.getItem('sb_width')
  if (saved) document.documentElement.style.setProperty('--sidebar-w', saved)
} catch {}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500&display=swap');

.app-shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
.app-resize {
  width: 5px; cursor: col-resize; flex-shrink: 0;
  background: transparent; transition: background .15s;
  position: relative; z-index: 20;
}
.app-resize::after {
  content: ''; position: absolute; inset: 0 2px;
  background: var(--border); opacity: 0; transition: opacity .15s;
}
.app-resize:hover::after,
.app-resize:active::after { opacity: 1; }
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  background: var(--bg);
}

.fade-up-enter-active { animation: fadeUp .35s ease both; }
.fade-up-leave-active { animation: fadeUp .2s ease both reverse; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
