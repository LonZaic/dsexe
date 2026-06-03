// ══════════════════════════════════════
// Agent Store — agent session state per conversation
// ══════════════════════════════════════

import { defineStore } from 'pinia'

export const useAgentStore = defineStore('agent', {
  state: () => ({
    // Agent running state per conversation ID
    agentRunningMap: {},        // { [convId]: true }
    agentAbortMap: {},          // { [convId]: AbortController }
    agentEventsMap: {},         // { [convId]: event[] }
    agentPanelVisible: false,
    thinkingDepth: 'medium',    // 'low' | 'medium' | 'high'
    webSearchEnabled: false,
  }),

  getters: {
    isAgentRunning(state) {
      return (convId) => !!state.agentRunningMap[convId]
    },

    agentEvents(state) {
      return (convId) => state.agentEventsMap[convId] || []
    },
  },

  actions: {
    startAgent(convId, abortController) {
      this.agentRunningMap = { ...this.agentRunningMap, [convId]: true }
      this.agentAbortMap = { ...this.agentAbortMap, [convId]: abortController }
      this.agentEventsMap = { ...this.agentEventsMap, [convId]: [] }
      this.agentPanelVisible = true
    },

    stopAgent(convId) {
      const ctrl = this.agentAbortMap[convId]
      if (ctrl) {
        try { ctrl.abort() } catch {}
      }
      this.agentRunningMap = { ...this.agentRunningMap, [convId]: false }
    },

    finishAgent(convId) {
      this.agentRunningMap = { ...this.agentRunningMap, [convId]: false }
    },

    addAgentEvent(convId, event) {
      const events = [...(this.agentEventsMap[convId] || []), event]
      this.agentEventsMap = { ...this.agentEventsMap, [convId]: events }
    },

    clearAgentEvents(convId) {
      this.agentEventsMap = { ...this.agentEventsMap, [convId]: [] }
    },

    setThinkingDepth(depth) {
      this.thinkingDepth = depth
    },

    setWebSearchEnabled(enabled) {
      this.webSearchEnabled = enabled
    },

    togglePanel() {
      this.agentPanelVisible = !this.agentPanelVisible
    },

    hidePanel() {
      this.agentPanelVisible = false
    },
  },
})
