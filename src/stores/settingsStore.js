// ══════════════════════════════════════
// Settings Store — user preferences
// ══════════════════════════════════════

import { defineStore } from 'pinia'

const THEME_KEY = 'ds_theme'
const API_KEY_KEY = 'ds_api_key'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: localStorage.getItem(THEME_KEY) || 'dark',
    apiKey: localStorage.getItem(API_KEY_KEY) || '',
    defaultModel: 'deepseek-v4-flash',
    agentModel: 'deepseek-v4-pro',
    defaultPermissionMode: 'default',
    defaultThinkingDepth: 'medium',
    sidebarCollapsed: false,
  }),

  getters: {
    isDark(state) { return state.theme === 'dark' },
    hasApiKey(state) { return state.apiKey.length > 0 },
  },

  actions: {
    setTheme(theme) {
      this.theme = theme
      localStorage.setItem(THEME_KEY, theme)
      document.documentElement.setAttribute('data-theme', theme)
    },

    toggleTheme() {
      const next = this.theme === 'dark' ? 'light' : 'dark'
      this.setTheme(next)
    },

    setApiKey(key) {
      this.apiKey = key
      localStorage.setItem(API_KEY_KEY, key)
    },

    setDefaultModel(model) {
      this.defaultModel = model
      localStorage.setItem('model', model)
    },

    setAgentModel(model) {
      this.agentModel = model
    },

    setDefaultPermissionMode(mode) {
      this.defaultPermissionMode = mode
      localStorage.setItem('permissionMode', mode)
    },

    init() {
      // Apply saved theme on startup
      document.documentElement.setAttribute('data-theme', this.theme)
    },
  },
})
