import { createApp } from 'vue'
import { createPinia } from 'pinia'
// ─── CSS Architecture: design tokens first, then legacy styles ───
import './assets/styles/variables.css'
import './assets/styles/reset.css'
import './assets/styles/theme-dark.css'
import './assets/styles/theme-light.css'
import './assets/styles/animations.css'
import './style.css'
// ─── Router & App ───
import router from './router/index.js'
import App from './App.vue'
// ─── Database ───
import { initDB } from './db/database.js'
import { vDebounce } from './directives/index.js'

// Create Vue instance
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.directive('debounce', vDebounce)

// Initialize settings (theme, API key) after pinia is ready
import { useSettingsStore } from './stores/settingsStore.js'
import { useChatStore } from './store/chatStore.js'
const settingsStore = useSettingsStore()
settingsStore.init()

// Global error handler — show errors on screen instead of white screen
app.config.errorHandler = (err, vm, info) => {
  console.error('[Vue Error]', info, err)
  const el = document.getElementById('app')
  if (el) {
    el.innerHTML += `<div style="position:fixed;top:0;left:0;right:0;background:#dc2626;color:#fff;padding:12px 20px;z-index:99999;font-family:monospace;font-size:13px;white-space:pre-wrap;">[Error] ${err.message || err}</div>`
  }
}

// Mount app
// Only init client-side sql.js when NOT logged in (logged-in users use server API)
const token = localStorage.getItem('bbot_token')
if (!token) {
  await initDB().catch(err => {
    console.error('DB init failed:', err)
  })
}
app.mount('#app')

// Ensure session state is persisted on page close/refresh
window.addEventListener('beforeunload', () => {
  try {
    const store = useChatStore()
    store._saveSession()
  } catch {}
})
