<template>
  <div class="cv-root" ref="rootRef">
    <!-- ═══ Code Area (center) ═══ -->
    <div class="cv-main">
      <div v-if="!store.projectPath" class="cv-empty">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="4" width="32" height="28" rx="4" stroke="var(--accent)" stroke-width="1.5"/>
          <path d="M14 18l4 4 8-8" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="cv-empty-title">{{ t('codeEmptyTitle') }}</span>
        <span class="cv-empty-desc">{{ t('codeEmptyDesc') }}</span>
        <div class="cv-empty-actions">
          <button class="cv-act-btn" @click="showOpenProject = true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h3.8L7 4.5H12V11H2V3z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
            {{ t('codeOpenProject') }}
          </button>
          <button class="cv-act-btn" @click="showNewProject = true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            {{ t('codeNewProject') }}
          </button>
        </div>
      </div>

      <template v-else>
        <div class="cv-tabs" v-if="store.openFiles.length">
          <div v-for="f in store.openFiles" :key="f.path"
            :class="['cv-tab', { active: f.path === store.activeFilePath }]"
            @click="store.activeFilePath = f.path">
            <span class="cv-tab-name">{{ f.name }}</span>
            <button class="cv-tab-close" @click.prevent.stop="store.closeFile(f.path)">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <div class="cv-code" v-if="activeFile">
          <div class="cv-code-inner" ref="codeRef">
            <div v-for="(line, i) in displayLines" :key="i" class="cv-line"
              :class="{ 'cv-line-del': line._deleted, 'cv-line-add': line._added }">
              <span class="cv-line-num">{{ line._num }}</span>
              <span class="cv-line-code">{{ line.text }}</span>
            </div>
          </div>
          <!-- Diff actions -->
          <div v-if="store.pendingDiffs.length" class="cv-diff-actions">
            <button class="cv-diff-btn accept" @click="acceptAll">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5L10 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {{ t('codeAcceptAll') }}
            </button>
            <button class="cv-diff-btn reject" @click="rejectAll">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              {{ t('codeRejectAll') }}
            </button>
          </div>
        </div>
        <div v-else class="cv-code-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" opacity=".3">
            <path d="M5 3h9l5 5v13H5V3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M14 3v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
          <span>{{ t('codeSelectFile') }}</span>
        </div>
      </template>
    </div>

    <!-- ═══ Resize handle: code | chat ═══ -->
    <div class="cv-resize-handle" @mousedown="startResize('chat', $event)" v-if="store.projectPath"></div>

    <!-- ═══ AI Chat (right) ═══ -->
    <div class="cv-chat" v-if="store.projectPath" :style="{ width: chatWidth + 'px' }">
      <div class="cv-chat-top">
        <div class="cv-chat-tabs" v-if="store.openTabs.length">
          <div v-for="tab in store.openTabList" :key="tab.id"
            :class="['cv-ctab', { active: tab.id === store.currentId }]"
            @click="store.switchTab(tab.id)">
            <span class="cv-ctab-title">{{ tab.title }}</span>
            <button class="cv-ctab-close" @click.prevent.stop="store.closeTab(tab.id)">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 2l5 5M7 2l-5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="cv-chat-acts">
          <button class="cv-chat-act" @click="newCodeConv" title="新对话">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="cv-chat-act" @click="showSwitch = true" title="切换项目">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h5.5L8.5 5H11v5.5H2V3.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="cv-chat-msgs" ref="chatRef">
        <template v-for="m in store.messages" :key="m._id">
          <!-- Round marker -->
          <div v-if="m._isRoundMarker" class="cv-round-marker">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4" stroke="var(--accent)" stroke-width="1"/><path d="M4 6l1.5 1.5L8 4.5" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {{ t('codeNewRound') }}
          </div>
          <div v-else-if="m.role === 'user'" class="cv-msg cv-msg-user">
            <div class="cv-bubble cv-bubble-user">{{ m.text }}</div>
          </div>
          <div v-else class="cv-msg cv-msg-ai">
            <div v-if="m.thinking" class="cv-think">
              <div class="cv-think-hdr" @click="m._thinkOpen = !m._thinkOpen">
                <svg class="cv-think-dot" width="7" height="7" viewBox="0 0 7 7" fill="none"><circle cx="3.5" cy="3.5" r="2.5" fill="var(--accent)" opacity=".6"/></svg>
                <span>{{ t('codeThinking') }}</span>
              </div>
              <div v-if="m._thinkOpen" class="cv-think-body">{{ m.thinking }}</div>
            </div>
            <div class="cv-bubble cv-bubble-ai markdown-body" v-html="m.html"></div>
          </div>
        </template>
        <div v-if="!store.messages.length && store.currentId" class="cv-chat-hint">
          {{ t('codeChatHint') }}
        </div>
      </div>
      <div class="cv-chat-bar">
        <div class="cv-chat-row">
          <textarea ref="inputRef" v-model="task" :placeholder="t('codePlaceholder')" :rows="1"
            @keydown="onKey" @input="autoResize" class="cv-input" />
          <div class="cv-model-wrap">
            <button class="cv-model-btn" @click="showModelMenu = !showModelMenu">
              <span class="cv-model-dot" :class="{ pro: (codeModel || '').includes('pro') }"></span>
            </button>
            <Transition name="hist-pop">
              <div v-if="showModelMenu" class="cv-model-menu">
                <button :class="['cv-model-opt', { active: codeModel === 'deepseek-v4-pro' }]" @click="pickModel('deepseek-v4-pro')">
                  <span class="cv-model-dot pro"></span>V4-Pro
                </button>
                <button :class="['cv-model-opt', { active: codeModel === 'deepseek-v4-flash' }]" @click="pickModel('deepseek-v4-flash')">
                  <span class="cv-model-dot"></span>V4-Flash
                </button>
              </div>
            </Transition>
          </div>
          <button class="cv-send" :class="{ off: !task.trim() }" :disabled="!task.trim()" @click="send">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 1.5l11 5.5-11 5.5 3-5.5-3-5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ Open Project Modal ═══ -->
    <div v-if="showOpenProject" class="cv-modal-overlay" @click.self="showOpenProject = false">
      <div class="cv-modal">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4h4L8.3 5.5H13V12H3V4z" stroke="var(--accent)" stroke-width="1.2" stroke-linejoin="round"/></svg>
          <span>{{ t('codeOpenProject') }}</span>
          <button class="cv-modal-close" @click="showOpenProject = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="cv-modal-body">
          <div class="cv-field">
            <label class="cv-label">{{ t('codeProjectPath') || '项目路径' }}</label>
            <input v-model="openProjectPath" class="cv-field-input" placeholder="E:\MyProject" @keydown.enter="confirmOpenProject" />
          </div>
          <div class="cv-field-hint">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--text3)" stroke-width="1"/><path d="M6 3.5v2.5M6 8.5v.01" stroke="var(--text3)" stroke-width="1.2" stroke-linecap="round"/></svg>
            {{ t('codeInputPath') }}
          </div>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showOpenProject = false">{{ t('codeCancel') }}</button>
          <button class="cv-modal-btn ok" :disabled="!openProjectPath.trim()" @click="confirmOpenProject">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4 6.5l1.5 1.5L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            确认
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ SuperDS接管确认 ═══ -->
    <div v-if="showConfirmTakeover" class="cv-modal-overlay">
      <div class="cv-modal" style="width:380px">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="var(--accent)" stroke-width="1.2"/><path d="M8 5v3.5M8 11v.01" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round"/></svg>
          <span>SuperDS</span>
        </div>
        <div class="cv-modal-body">
          <p class="cv-confirm-text">{{ t('codeTakeover') }}</p>
          <p class="cv-confirm-sub">{{ t('codeTakeoverSub') }}</p>
          <p class="cv-confirm-path">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h3L6 4h4v5.5H2V3z" stroke="var(--text3)" stroke-width="1" stroke-linejoin="round"/></svg>
            {{ takeoverPath }}
          </p>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showConfirmTakeover = false">{{ t('codeReject') }}</button>
          <button class="cv-modal-btn ok" @click="confirmTakeover">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5L5 9l5.5-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            同意
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ New Project Modal ═══ -->
    <div v-if="showNewProject" class="cv-modal-overlay" @click.self="showNewProject = false">
      <div class="cv-modal">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7 1v14M1 7h14" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>{{ t('codeNewProject') }}</span>
          <button class="cv-modal-close" @click="showNewProject = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="cv-modal-body">
          <div class="cv-field">
            <label class="cv-label">{{ t('codeProjectName') }}</label>
            <input v-model="newProjectName" class="cv-field-input" :placeholder="t('codeProjectNameHint') || '输入项目名称...'" @keydown.enter="confirmNewProject" />
          </div>
          <div class="cv-field">
            <label class="cv-label">{{ t('codeParentDir') }}</label>
            <input v-model="newProjectParent" class="cv-field-input" :placeholder="t('codeParentDirHint') || '如 E:\\'" />
          </div>
          <div class="cv-field-hint">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v6M6 10v.01" stroke="var(--text3)" stroke-width="1.2" stroke-linecap="round"/></svg>
            将在 {{ previewPath }} 创建项目文件夹
          </div>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showNewProject = false">{{ t('codeCancel') }}</button>
          <button class="cv-modal-btn ok" :disabled="!newProjectName.trim()" @click="confirmNewProject">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5L5 9l5.5-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            创建
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ Switch project confirm ═══ -->
    <div v-if="showSwitch" class="cv-modal-overlay" @click.self="showSwitch = false">
      <div class="cv-modal" style="width:360px">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="var(--accent)" stroke-width="1.2"/><path d="M8 5v3.5M8 11v.01" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round"/></svg>
          <span>{{ t('codeSwitchProj') }}</span>
        </div>
        <div class="cv-modal-body" style="text-align:center">
          <p class="cv-confirm-text">{{ t('codeOneProject') }}</p>
          <p class="cv-confirm-sub" style="margin-bottom:0">{{ t('codeSwitchSub') }}</p>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showSwitch = false">{{ t('codeCancel') }}</button>
          <button class="cv-modal-btn ok" @click="doSwitchProject">{{ t('codeConfirmSwitch') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue'
import { useCodeStore } from '../stores/codeStore.js'
import { renderMarkdown } from '../utils/markdown.js'
import { scanFileTree, readFileContent, newProject, runCodeAgent } from '../api/code.api.js'
import { useI18n } from '../composables/useI18n.js'

const { t } = useI18n()
const store = useCodeStore()
const task = ref('')
const inputRef = ref(null)
const codeRef = ref(null)
const chatRef = ref(null)
const rootRef = ref(null)
const showOpenProject = ref(false)
const openProjectPath = ref('')
const showConfirmTakeover = ref(false)
const takeoverPath = ref('')
const showNewProject = ref(false)
const newProjectName = ref('')
const newProjectParent = ref('E:\\')
const loading = ref(false)
const codeModel = ref(localStorage.getItem('code_model') || 'deepseek-v4-pro')
const showModelMenu = ref(false)
let _isCreatingProject = false

function pickModel(m) {
  codeModel.value = m
  showModelMenu.value = false
  try { localStorage.setItem('code_model', m) } catch {}
}

const previewPath = computed(() => {
  const base = newProjectParent.value.replace(/\\$/, '')
  const name = newProjectName.value.trim() || 'NewProject'
  return base + '\\' + name
})

// ─── Chat panel width ───
const chatWidth = ref(360)
let _resizeStartX = 0
let _resizeStartW = 0

  function startResize(target, e) {
    _resizeStartX = e.clientX
    _resizeStartW = chatWidth.value
    document.addEventListener("mousemove", onResize)
    document.addEventListener("mouseup", stopResize)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }

  function onResize(e) {
    chatWidth.value = Math.max(280, Math.min(600, _resizeStartW + (_resizeStartX - e.clientX)))
  }

  function stopResize() {
    document.removeEventListener("mousemove", onResize)
    document.removeEventListener("mouseup", stopResize)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
    localStorage.setItem("code_chat_width", chatWidth.value)
  }

  try {
    const saved = localStorage.getItem("code_chat_width")
    if (saved) chatWidth.value = parseInt(saved) || 360
  } catch {}

const activeFile = computed(() =>
  store.openFiles.find(f => f.path === store.activeFilePath)
)

const displayLines = computed(() => {
  const f = activeFile.value
  if (!f) return []
  const lines = (f.content || '').split('\n')
  let result = lines.map((text, i) => ({ text, _num: i + 1, _deleted: false, _added: false }))
  for (const diff of store.pendingDiffs) {
    if (diff.filePath !== f.path) continue
    const oldLen = diff.oldCode.split('\n').length
    const newLines = diff.newCode.split('\n')
    result = result.map((l, i) => {
      if (i + 1 >= diff.lineStart && i + 1 < diff.lineStart + oldLen) {
        return { ...l, _deleted: true }
      }
      return l
    })
    // Insert new lines as added after the deleted section
    if (diff.newCode) {
      const insertIdx = result.findIndex(l => l._deleted)
      if (insertIdx >= 0) {
        const added = newLines.map((text, j) => ({
          text, _num: diff.lineStart + j, _added: true, _deleted: false
        }))
        result.splice(insertIdx, 0, ...added)
      }
    }
  }
  return result
})

onMounted(() => {
  store.restoreSession()
  if (store.projectPath) loadProject(store.projectPath)
})

// Watch file tree selection — auto-load content
watch(() => store.activeFilePath, async (fp) => {
  if (!fp) return
  const existing = store.openFiles.find(f => f.path === fp)
  // Load content if empty or placeholder
  if (existing && existing.content && existing.content.length > 10) return
  try {
    const { content, name } = await readFileContent(fp)
    store.updateFileContent(fp, content)
    if (!existing) store.openFile(fp, name, content)
  } catch {}
})

async function loadProject(projectPath) {
  store.setProject(projectPath, projectPath.split('\\').pop() || projectPath)
  try {
    const { tree } = await scanFileTree(projectPath)
    store.setFileTree(tree || [])
    console.log('[Code] loaded', tree?.length || 0, 'files from', projectPath)
  } catch (e) {
    console.error('[Code] loadProject failed:', e)
    store.setFileTree([])
  }
}

// ─── Open Project Flow ───
function confirmOpenProject() {
  const p = openProjectPath.value.trim()
  if (!p) return
  takeoverPath.value = p
  _isCreatingProject = false
  showConfirmTakeover.value = true
}

async function doOpenProject() {
  const p = takeoverPath.value
  showConfirmTakeover.value = false
  showOpenProject.value = false
  openProjectPath.value = ''
  store.setProject(p, p.split('\\').pop() || p)
  store.createConversation('Code 对话')
  await loadProject(p)
}

// ─── New Project Flow ───
function confirmNewProject() {
  const name = newProjectName.value.trim()
  if (!name) return
  const base = newProjectParent.value.replace(/\\$/, '')
  const fullPath = base + '\\' + name
  takeoverPath.value = fullPath
  _isCreatingProject = true
  showConfirmTakeover.value = true
}

async function doCreateProject() {
  const name = takeoverPath.value.split('\\').pop()
  const fullPath = takeoverPath.value
  showConfirmTakeover.value = false
  showNewProject.value = false
  newProjectName.value = ''
  try {
    const { tree } = await newProject(fullPath, name)
    store.setFileTree(tree || [])
    store.setProject(fullPath, name)
    store.createConversation(name)
  } catch (e) { alert('创建失败: ' + e.message) }
}

function confirmTakeover() {
  if (_isCreatingProject) doCreateProject()
  else doOpenProject()
}

async function onFileSelect(item) {
  try {
    const { content, name } = await readFileContent(item.path)
    store.openFile(item.path, name, content)
  } catch (e) { alert('读取失败: ' + e.message) }
}

function acceptAll() {
  while (store.pendingDiffs.length) store.acceptDiff(0)
}

function rejectAll() {
  while (store.pendingDiffs.length) store.rejectDiff(0)
}

function scrollDown() { nextTick(() => { if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight }) }

const showSwitch = ref(false)

function newCodeConv() {
  store.createConversation('Code 对话')
}

function doSwitchProject() {
  showSwitch.value = false
  store.openFiles = []
  store.activeFilePath = ''
  store.currentId = null
  store.openTabs = []
  store.messagesMap = {}
  store.setProject('', '')
  store.setFileTree([])
  store.saveSession()
}

function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}

function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 100) + 'px'
}

let _abortCtrl = null
async function send() {
  const txt = task.value.trim()
  if (!txt || loading.value || !store.projectPath) return
  task.value = ''
  loading.value = true

  if (!store.currentId) store.createConversation(txt.slice(0, 30))
  store.pushMessage({ _id: 'u_' + Date.now(), role: 'user', text: txt })
  store.addUserMessage(txt)

  const aiMsg = reactive({ _id: 'a_' + Date.now(), role: 'ai', text: '', html: '', thinking: '', _thinkOpen: false })
  store.pushMessage(aiMsg)
  const dbId = store.addAiMessage('', '', '', '[]')
  scrollDown()

  _abortCtrl = new AbortController()

  try {
    await runCodeAgent(txt, store.projectPath, codeModel.value, async (event) => {
      const e = event
      if (e.type === 'thinking' && e.text) {
        // Stream text into message body like chat mode
        aiMsg.text = (aiMsg.text || '') + e.text
        aiMsg.html = renderMarkdown(aiMsg.text)
        if (dbId > 0) store.updateMessageText(dbId, aiMsg.text, aiMsg.html, aiMsg.thinking)
      }
      if (e.type === 'code_diff') {
        store.addDiff({
          filePath: e.filePath,
          oldCode: e.oldCode || '',
          newCode: e.newCode || '',
          lineStart: e.lineStart || 1,
          isNewFile: e.isNewFile || false,
        })
        const fname = e.fileName || e.filePath.split('\\').pop()
        store.openFile(e.filePath, fname, '// 加载中...')
        try {
          const { content } = await readFileContent(e.filePath)
          store.updateFileContent(e.filePath, content)
        } catch {}
      }
      if (e.type === 'tool_start') {
        aiMsg.thinking = (aiMsg.thinking || '') + '\n[' + e.tool + ']'
        aiMsg._thinkOpen = true
      }
      if (e.type === 'plan_done' && e.tasks) {
        store.setTasks(e.tasks)
        aiMsg.thinking = (aiMsg.thinking || '') + '\n[' + t('codePlanDone') + ']'
        aiMsg._thinkOpen = true
      }
      if (e.type === 'task_done' && e.taskId) {
        store.markTaskDone(e.taskId)
        aiMsg.thinking = (aiMsg.thinking || '') + '\n[' + t('codeStepDone') + ' ' + e.taskId + ']'
        aiMsg._thinkOpen = true
      }
      if (e.type === 'handoff_needed') {
        aiMsg.thinking = (aiMsg.thinking || '') + '\n[上下文使用率较高，准备接力...]'
        aiMsg._thinkOpen = true
      }
      if (e.type === 'handoff_done') {
        store.startNewRound()
        aiMsg.thinking = (aiMsg.thinking || '') + '\n[Keep.md 接力文档已生成]'
        aiMsg._thinkOpen = true
      }
      if (e.type === 'context_usage' && e.pct >= 90) {
        aiMsg.thinking = (aiMsg.thinking || '') + '\n[上下文 ' + e.pct + '%，触发接力]'
        aiMsg._thinkOpen = true
      }
      if (e.type === 'done' && e.text) {
        // Final text already streamed; set final render
        aiMsg.text = e.text
        aiMsg.html = renderMarkdown(e.text)
        aiMsg._thinkOpen = false
        if (dbId > 0) store.updateMessageText(dbId, e.text, renderMarkdown(e.text), aiMsg.thinking)
      }
      if (e.type === 'error') {
        aiMsg.html = renderMarkdown('**出错**: ' + (e.text || '未知'))
        if (dbId > 0) store.updateMessageText(dbId, aiMsg.text, aiMsg.html, aiMsg.thinking)
      }
      await nextTick(); scrollDown()
    }, _abortCtrl.signal)
  } catch (e) {
    if (e.name !== 'AbortError') {
      aiMsg.html = renderMarkdown('**出错**: ' + (e.message || '未知'))
    }
  }

  loading.value = false
  _abortCtrl = null
  // Refresh file tree after changes
  if (store.projectPath) loadProject(store.projectPath)
  scrollDown()
}
</script>

<style scoped>
.cv-root { display: flex; height: 100%; overflow: hidden; }
.cv-resize-handle {
  width: 4px; cursor: col-resize; flex-shrink: 0;
  background: transparent; transition: background .2s;
  z-index: 10;
}
.cv-resize-handle:hover { background: var(--accent); opacity: .4; }
.cv-round-marker {
  display: flex; align-items: center; gap: 8px; justify-content: center;
  padding: 12px 0; font-size: 12px; color: var(--accent); font-weight: 400;
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  margin: 8px 0;
}
.cv-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; background: var(--bg); }
.cv-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; height: 100%;
}
.cv-empty-title { font-size: 18px; font-weight: 400; color: var(--text); }
.cv-empty-desc { font-size: 13px; color: var(--text3); font-weight: 300; }
.cv-empty-actions { display: flex; gap: 10px; margin-top: 12px; }
.cv-act-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 16px; border-radius: var(--radius); border: 1px solid var(--border);
  background: var(--bg2); color: var(--text2); cursor: pointer;
  font-size: 13px; font-family: inherit; font-weight: 300; transition: all .12s;
}
.cv-act-btn:hover { background: var(--bg3); border-color: var(--accent); color: var(--text); }
.cv-tabs {
  display: flex; gap: 2px; padding: 4px 8px 0;
  background: var(--bg2); border-bottom: 1px solid var(--border);
  overflow-x: auto; flex-shrink: 0;
}
.cv-tabs::-webkit-scrollbar { height: 2px; }
.cv-tab {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 10px 5px; border-radius: 6px 6px 0 0;
  cursor: pointer; font-size: 12px; font-weight: 300; color: var(--text3);
  border: 1px solid transparent; border-bottom: none; white-space: nowrap; transition: all .12s;
}
.cv-tab:hover { background: var(--bg3); color: var(--text2); }
.cv-tab.active { background: var(--bg); color: var(--text); border-color: var(--border); }
.cv-tab-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.cv-tab-close {
  display: flex; align-items: center; justify-content: center; width: 14px; height: 14px;
  border-radius: 3px; border: none; background: transparent; color: var(--text3); cursor: pointer;
}
.cv-tab-close:hover { background: var(--bg4); color: var(--red); }
.cv-code { flex: 1; overflow: auto; padding: 8px 0; position: relative; }
.cv-code::-webkit-scrollbar { width: 4px; }
.cv-code::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }
.cv-code-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8px; color: var(--text3); font-size: 13px; font-weight: 300;
}
.cv-code-inner { font-family: var(--font-mono); font-size: 13px; line-height: 1.65; }
.cv-line { display: flex; gap: 0; padding: 0 12px; transition: background .15s; }
.cv-line:hover { background: var(--bg3); }
.cv-line-num {
  width: 42px; text-align: right; padding-right: 14px;
  color: var(--text3); font-size: 11px; user-select: none; flex-shrink: 0;
}
.cv-line-code { white-space: pre; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; }
.cv-line-del { background: rgba(248,81,73,.1); }
.cv-line-del .cv-line-code { text-decoration: line-through; color: var(--red); opacity: .8; }
.cv-line-add { background: rgba(63,185,80,.1); }
.cv-line-add .cv-line-code { color: var(--green); text-decoration: none; }
.cv-diff-actions {
  position: sticky; bottom: 0; display: flex; gap: 8px; justify-content: center;
  padding: 10px; background: var(--bg2); border-top: 1px solid var(--border);
}
.cv-diff-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border);
  font-size: 12px; font-family: inherit; cursor: pointer; transition: all .12s;
}
.cv-diff-btn.accept { background: rgba(63,185,80,.15); color: var(--green); border-color: rgba(63,185,80,.3); }
.cv-diff-btn.accept:hover { background: rgba(63,185,80,.25); }
.cv-diff-btn.reject { background: rgba(248,81,73,.1); color: var(--red); border-color: rgba(248,81,73,.25); }
.cv-diff-btn.reject:hover { background: rgba(248,81,73,.2); }
.cv-chat {
  width: 360px; display: flex; flex-direction: column;
  border-left: 1px solid var(--border); background: var(--bg2); flex-shrink: 0; overflow: hidden;
}
.cv-chat-top {
  display: flex; align-items: center; padding: 4px 4px 0;
  border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.cv-chat-tabs { display: flex; gap: 2px; overflow-x: auto; flex: 1; min-width: 0; }
.cv-chat-tabs::-webkit-scrollbar { height: 2px; }
.cv-chat-acts { display: flex; gap: 2px; flex-shrink: 0; padding-left: 4px; }
.cv-chat-act {
  width: 26px; height: 26px; border-radius: 5px;
  border: none; background: transparent; color: var(--text3); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all .12s;
}
.cv-chat-act:hover { background: var(--bg3); color: var(--text); }
.cv-ctab {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 8px; border-radius: 6px 6px 0 0;
  cursor: pointer; font-size: 11px; font-weight: 300; color: var(--text3);
  border: 1px solid transparent; border-bottom: none; white-space: nowrap;
}
.cv-ctab:hover { color: var(--text2); }
.cv-ctab.active { background: var(--bg); color: var(--text); border-color: var(--border); }
.cv-ctab-title { max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
.cv-ctab-close { display: flex; align-items: center; width: 12px; height: 12px; border: none; background: transparent; color: var(--text3); cursor: pointer; }
.cv-chat-msgs { flex: 1; overflow-y: auto; padding: 12px; }
.cv-chat-msgs::-webkit-scrollbar { width: 3px; }
.cv-msg { margin-bottom: 10px; }
.cv-msg-user { display: flex; justify-content: flex-end; }
.cv-bubble { padding: 8px 12px; font-size: 13px; line-height: 1.55; font-weight: 300; word-break: break-word; }
.cv-bubble-user { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-lg); max-width: 85%; }
.cv-bubble-ai { border-left: 2px solid var(--accent); padding-left: 10px; max-width: 100%; }
.cv-think { margin-bottom: 6px; border-left: 2px solid var(--accent-muted); padding-left: 8px; }
.cv-think-hdr { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; color: var(--text3); }
.cv-think-body { font-size: 11px; color: var(--text3); white-space: pre-wrap; padding: 3px 0; max-height: 100px; overflow-y: auto; font-style: italic; }
.cv-chat-hint { padding: 20px 0; text-align: center; font-size: 12px; color: var(--text3); font-weight: 300; }
.cv-chat-bar { padding: 8px 10px 12px; border-top: 1px solid var(--border); flex-shrink: 0; }
.cv-chat-row { display: flex; align-items: center; gap: 6px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; }
.cv-input { flex: 1; resize: none; background: none; border: none; outline: none; color: var(--text); font: 300 13px/1.5 var(--font-sans); min-height: 22px; max-height: 100px; }
.cv-input::placeholder { color: var(--text3); }
.cv-send {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: var(--accent); color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity .12s;
}
.cv-send.off { background: var(--bg4); color: var(--text3); cursor: not-allowed; }
.cv-model-btn {
  width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
  border: none; background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.cv-model-dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--yellow);
  transition: background .15s;
}
.cv-model-dot.pro { background: var(--accent); }
.cv-model-wrap { position: relative; }
.cv-model-menu {
  position: absolute; bottom: 100%; right: 0; margin-bottom: 6px;
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,.35);
  padding: 4px; z-index: var(--z-dropdown); min-width: 130px;
}
.cv-model-opt {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 7px 10px; border-radius: 6px;
  border: none; background: transparent; color: var(--text2);
  font-size: 12px; font-family: inherit; font-weight: 300; cursor: pointer;
  transition: background .1s;
}
.cv-model-opt:hover { background: var(--bg3); }
.cv-model-opt.active { background: var(--accent-muted); color: var(--accent); }

/* Hidden file input */
.cv-folder-input { display: none; }

/* Modal */
.cv-modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center;
}
.cv-modal {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); width: 420px;
  box-shadow: 0 12px 40px rgba(0,0,0,.4);
}
.cv-modal-hdr {
  display: flex; align-items: center; gap: 8px;
  padding: 16px 18px; border-bottom: 1px solid var(--border);
  font-size: 15px; font-weight: 500; color: var(--text);
}
.cv-modal-hdr svg { color: var(--accent); flex-shrink: 0; }
.cv-modal-close {
  margin-left: auto; width: 26px; height: 26px; border-radius: 6px;
  border: none; background: transparent; color: var(--text3); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all .12s;
}
.cv-modal-close:hover { background: var(--bg3); color: var(--text); }
.cv-modal-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.cv-field { display: flex; flex-direction: column; gap: 5px; }
.cv-label { font-size: 12px; font-weight: 500; color: var(--text2); }
.cv-field-row { display: flex; gap: 8px; }
.cv-field-input {
  flex: 1; padding: 8px 10px; border-radius: var(--radius-sm);
  background: var(--bg3); border: 1px solid var(--border);
  color: var(--text); font-size: 13px; font-family: inherit; font-weight: 300; outline: none;
  transition: border-color .15s;
}
.cv-field-input:focus { border-color: var(--accent); }
.cv-field-input::placeholder { color: var(--text3); }
.cv-field-btn {
  width: 34px; height: 34px; border-radius: var(--radius-sm); flex-shrink: 0;
  border: 1px solid var(--border); background: var(--bg3); color: var(--text2);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .12s;
}
.cv-field-btn:hover { background: var(--bg4); color: var(--text); border-color: var(--border2); }
.cv-field-hint {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--text3); font-weight: 300;
}
.cv-modal-ft {
  display: flex; gap: 8px; justify-content: flex-end;
  padding: 12px 18px 16px;
}
.cv-modal-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 8px 16px; border-radius: var(--radius-sm);
  font-size: 13px; font-family: inherit; font-weight: 400;
  border: 1px solid var(--border); cursor: pointer; transition: all .12s;
}
.cv-modal-btn.cancel { background: var(--bg3); color: var(--text2); }
.cv-modal-btn.cancel:hover { background: var(--bg4); color: var(--text); }
.cv-modal-btn.ok { background: var(--accent); color: #fff; border-color: var(--accent); }
.cv-modal-btn.ok:hover { background: var(--accent-hover); }
.cv-modal-btn.ok:disabled { background: var(--bg4); color: var(--text3); border-color: var(--border); cursor: not-allowed; }
.cv-confirm-text { font-size: 15px; color: var(--text); font-weight: 400; margin: 0 0 4px; }
.cv-confirm-sub { font-size: 12px; color: var(--text3); font-weight: 300; margin: 0 0 12px; }
.cv-confirm-path {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--text3); font-family: var(--font-mono);
  background: var(--bg3); padding: 6px 10px; border-radius: 4px;
  word-break: break-all;
}
.cv-folder-input { display: none; }
</style>
