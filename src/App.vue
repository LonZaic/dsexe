<template>
  <div class="app-shell">
    <AppSidebar />
    <main class="main-area">
      <router-view v-slot="{ Component }">
        <transition name="fade-up" mode="out-in">
          <component :is="Component" />
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
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500&display=swap');

.app-shell {
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}
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
