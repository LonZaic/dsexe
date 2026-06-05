// ══════════════════════════════════════
// Code Mode Store — project + conversations
// SQLite persistence for all data
// ══════════════════════════════════════

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createCodeConversation as dbCreate,
  getCodeConversations,
  getCodeMessages,
  addCodeMessage,
  updateCodeMessage,
  updateCodeConversationTitle,
  updateCodeConversationProject,
  deleteCodeConversation,
} from '../db/database.js'
import { readFileContent } from '../api/code.api.js'

export const useCodeStore = defineStore('code', () => {
  const projectPath = ref('')
  const projectName = ref('')
  const fileTree = ref([])
  const conversations = ref([])
  const currentId = ref(null)
  const messagesMap = ref({})
  const openTabs = ref([])
  const openFiles = ref([])
  const activeFilePath = ref('')
  const pendingDiffs = ref([])
  const tasks = ref([])
  const handoffCount = ref(0) // track context handoffs

  const messages = computed(() => messagesMap.value[currentId.value] || [])
  const openTabList = computed(() =>
    openTabs.value.map(id => {
      const conv = conversations.value.find(c => c.id === id)
      return { id, title: conv?.title || 'Code 对话' }
    })
  )

  function setProject(path, name) {
    projectPath.value = path
    projectName.value = name
    if (currentId.value) updateCodeConversationProject(currentId.value, path, name)
    saveSession()
  }

  function setFileTree(tree) { fileTree.value = tree }

  // ─── Open files ───
  function openFile(filePath, name, content) {
    const existing = openFiles.value.find(f => f.path === filePath)
    if (existing) { activeFilePath.value = filePath; return }
    openFiles.value.push({ path: filePath, name, content, originalContent: content })
    activeFilePath.value = filePath
  }

  function closeFile(filePath) {
    openFiles.value = openFiles.value.filter(f => f.path !== filePath)
    if (activeFilePath.value === filePath) {
      activeFilePath.value = openFiles.value.length ? openFiles.value[openFiles.value.length - 1].path : ''
    }
  }

  function updateFileContent(filePath, content) {
    const f = openFiles.value.find(x => x.path === filePath)
    if (f) f.content = content
  }

  // ─── Diffs ───
  function addDiff(diff) { pendingDiffs.value.push(diff) }

  async function acceptDiff(diffIdx) {
    const d = pendingDiffs.value[diffIdx]
    if (!d) return
    pendingDiffs.value.splice(diffIdx, 1)
    // Re-read actual file content from disk instead of using truncated diff data
    try {
      const { content } = await readFileContent(d.filePath)
      const f = openFiles.value.find(x => x.path === d.filePath)
      if (f) { f.content = content; f.originalContent = content }
    } catch {
      // Fallback: use diff content if file read fails
      const f = openFiles.value.find(x => x.path === d.filePath)
      if (f) f.content = d.newCode
    }
  }

  function rejectDiff(diffIdx) { pendingDiffs.value.splice(diffIdx, 1) }

  // ─── Conversations (persisted to SQLite) ───
  function loadConversations() {
    conversations.value = getCodeConversations()
  }

  function createConversation(title) {
    const id = 'code_' + Date.now()
    dbCreate(id, title || 'Code 对话', projectPath.value, projectName.value)
    conversations.value = getCodeConversations()
    currentId.value = id
    messagesMap.value[id] = []
    if (!openTabs.value.includes(id)) openTabs.value.push(id)
    saveSession()
    return id
  }

  function openConversation(id) {
    if (!messagesMap.value[id]) {
      const rows = getCodeMessages(id)
      messagesMap.value[id] = rows.map(r => {
        let events = []
        try { events = JSON.parse(r.events_json || '[]') } catch {}
        return {
          id: r.id,
          _id: r.role + '_' + r.id,
          role: r.role,
          text: r.text || '',
          html: r.html || '',
          thinking: r.thinking || '',
          _thinkOpen: false,
          _events: events,
          _done: r.done === 1,
          _error: r.error === 1,
          _timer: r.timer || '',
          _expanded: true,
        }
      })
      // Load task state from last message
      const last = rows[rows.length - 1]
      if (last?.tasks_json) {
        try { tasks.value = JSON.parse(last.tasks_json) } catch {}
      }
    }
    currentId.value = id
    if (!openTabs.value.includes(id)) openTabs.value.push(id)
    // Restore project from conversation
    const conv = conversations.value.find(c => c.id === id)
    if (conv?.project_path) {
      projectPath.value = conv.project_path
      projectName.value = conv.project_name
    }
    saveSession()
  }

  function switchTab(id) {
    if (id === currentId.value) return
    openConversation(id)
  }

  function closeTab(id) {
    openTabs.value = openTabs.value.filter(t => t !== id)
    if (currentId.value === id) {
      currentId.value = openTabs.value.length ? openTabs.value[openTabs.value.length - 1] : null
    }
    saveSession()
  }

  function pushMessage(msg) {
    if (!currentId.value) return
    const msgs = messagesMap.value[currentId.value] || []
    msgs.push(msg)
    messagesMap.value[currentId.value] = [...msgs]
  }

  function addUserMessage(text) {
    if (!currentId.value) return -1
    return addCodeMessage(currentId.value, 'user', text, '', '', '[]', '[]', false, false, '')
  }

  function addAiMessage(text, html, thinking, tasksJson, eventsJson, done, error, timer) {
    if (!currentId.value) return -1
    return addCodeMessage(currentId.value, 'ai', text, html, thinking,
      tasksJson || JSON.stringify(tasks.value),
      eventsJson || '[]',
      done || false, error || false, timer || ''
    )
  }

  function updateMessageText(dbId, text, html, thinking, eventsJson, done, error, timer) {
    if (!dbId || dbId < 0) return
    updateCodeMessage(dbId, text, html, thinking, JSON.stringify(tasks.value),
      eventsJson || '[]', done ? 1 : 0, error ? 1 : 0, timer || '')
  }

  function renameConversation(id, title) {
    updateCodeConversationTitle(id, title)
    conversations.value = getCodeConversations()
  }

  function deleteConversation(id) {
    deleteCodeConversation(id)
    conversations.value = getCodeConversations()
    delete messagesMap.value[id]
    openTabs.value = openTabs.value.filter(t => t !== id)
    if (currentId.value === id) currentId.value = openTabs.value.length ? openTabs.value[openTabs.value.length - 1] : null
    saveSession()
  }

  // ─── Tasks ───
  function setTasks(list) { tasks.value = list }
  function markTaskDone(taskId) {
    const t = tasks.value.find(x => x.id === taskId)
    if (t) t.done = true
  }

  // ─── Handoff ───
  function startNewRound() {
    handoffCount.value++
    // Clear messages but keep project + tasks
    if (currentId.value) {
      const msgs = messagesMap.value[currentId.value] || []
      msgs.push({
        _id: 'round_' + Date.now(), role: 'ai', text: '', html: '',
        thinking: '', _thinkOpen: false,
        _isRoundMarker: true,
      })
    }
  }

  // ─── Session ───
  function saveSession() {
    try {
      localStorage.setItem('code_session', JSON.stringify({
        currentId: currentId.value,
        openTabs: openTabs.value,
        projectPath: projectPath.value,
        projectName: projectName.value,
      }))
    } catch {}
  }

  function restoreSession() {
    loadConversations()
    try {
      const raw = localStorage.getItem('code_session')
      if (!raw) return
      const data = JSON.parse(raw)
      if (data.projectPath) { projectPath.value = data.projectPath; projectName.value = data.projectName }
      if (data.openTabs?.length) {
        const existing = conversations.value.map(c => c.id)
        openTabs.value = data.openTabs.filter(id => existing.includes(id))
      }
      if (data.currentId && openTabs.value.length) {
        const exists = conversations.value.some(c => c.id === data.currentId)
        if (exists) openConversation(data.currentId)
        else if (openTabs.value.length) openConversation(openTabs.value[openTabs.value.length - 1])
      }
    } catch {}
  }

  return {
    projectPath, projectName, fileTree,
    conversations, currentId, messagesMap, openTabs, messages, openTabList,
    openFiles, activeFilePath, pendingDiffs,
    tasks, handoffCount,
    setProject, setFileTree,
    openFile, closeFile, updateFileContent,
    addDiff, acceptDiff, rejectDiff,
    loadConversations, createConversation, openConversation, switchTab, closeTab,
    pushMessage, addUserMessage, addAiMessage, updateMessageText,
    renameConversation, deleteConversation,
    setTasks, markTaskDone,
    startNewRound,
    saveSession, restoreSession,
  }
})
