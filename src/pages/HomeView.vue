<template>
  <div class="home-page">
    <!-- Top bar with tabs -->
    <div class="topbar">
      <div class="tab-bar" v-if="store.openTabs.length">
        <div
          v-for="(tab, i) in store.openTabList"
          :key="tab.id"
          :class="['tab', { active: tab.id === store.currentId }]"
          :style="{ borderColor: tabColor(i) }"
          @click="switchTab(tab.id)"
        >
          <span class="tab-title">{{ tab.title || t('newChatTab') }}</span>
          <button class="tab-close" @click.prevent.stop="closeTab(tab.id)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" pointer-events="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="topbar-right">
        <span class="topbar-user" v-if="loggedIn">{{ userName }}</span>
      </div>
    </div>

    <!-- Empty State -->
    <div class="content" v-if="!store.currentId">
      <div class="greeting">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <circle cx="19" cy="19" r="17" stroke="var(--accent)" stroke-width="2"/>
          <path d="M12 19h14M19 12v14M12 12l14 14M12 26l14-14" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="greeting-text">{{ greeting }}</span>
      </div>

      <div class="feature-grid">
        <div class="feature-card" @click="openFeature('design')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <path d="M1 6h16M5 6v11" stroke="currentColor" stroke-width="1.3"/>
          </svg>
          <div class="feature-card-title">{{ t('livePreview') }}</div>
          <div class="feature-card-desc">{{ t('livePreviewDesc') }}</div>
        </div>
        <div class="feature-card" @click="openFeature('code')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M5 5L2 9l3 4M13 5l3 4-3 4M10 3l-2 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div class="feature-card-title">{{ t('codePanel') }}</div>
          <div class="feature-card-desc">{{ t('codePanelDesc') }}</div>
        </div>
        <div class="feature-card" @click="$router.push('/groups')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
            <circle cx="13" cy="4" r="2" stroke="currentColor" stroke-width="1.3"/>
            <path d="M1 14c0-2.4 2-4.5 5-4.5s5 2.1 5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <path d="M12 8.5c1.8 0 3.5 1.3 3.5 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <div class="feature-card-title">{{ t('groupChatTitle') }}</div>
          <div class="feature-card-desc">{{ t('groupChatDesc') }}</div>
        </div>
        <div class="feature-card" @click="openSettings('api')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 5h14M2 9h8M2 13h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <circle cx="14" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/>
            <path d="M16.5 14.5l1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <div class="feature-card-title">{{ t('apiCard') }}</div>
          <div class="feature-card-desc">{{ t('apiCardDesc') }}</div>
        </div>
        <div class="feature-card" @click="openSettings('email')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <path d="M2 6.5l7 4.5 7-4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <div class="feature-card-title">{{ t('emailCard') }}</div>
          <div class="feature-card-desc">{{ t('emailCardDesc') }}</div>
        </div>
      </div>

      <!-- Inline input for quick start -->
      <div class="input-wrap">
        <!-- File chips -->
        <div v-if="pendingFiles.length" class="hp-file-chips">
          <div v-for="(f, i) in pendingFiles" :key="i" class="hp-file-chip" :title="f.name">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M14 2H6C5.47 2 5 2.47 5 3V21C5 21.53 5.47 22 6 22H18C18.53 22 19 21.53 19 21V7L14 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V7H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="hp-file-chip-name">{{ f.name }}</span>
            <button class="hp-file-chip-remove" @click="pendingFiles.splice(i, 1)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="input-box">
          <textarea
            ref="textareaRef"
            v-model="inputText"
            :placeholder="t('askPlaceholder')"
            @keydown="onKey"
            @input="autoResize"
            @paste="onPaste"
            rows="1"
          />
          <div class="input-toolbar">
            <div class="toolbar-left">
              <button :class="['tool-btn', { active: thinking === 'on' }]" @click="cycleThinking">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6.5 3v3.5L9 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                {{ thinkingLabel }}
              </button>
              <input ref="fileInputRef" type="file" multiple class="hp-hidden-input" @change="onFilesSelected" />
              <button class="tool-btn" title="添加文件" @click="fileInputRef?.click()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
            </div>
            <div class="toolbar-right">
              <button class="model-selector" @click="cycleModel">
                <span class="model-dot" />
                {{ modelLabel }}
              </button>
              <button class="send-btn" @click="quickStart()" :disabled="!inputText.trim() && !pendingFiles.length">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M3 5l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat View (when a tab is open) -->
    <ChatView v-else :key="store.currentId" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '../store/chatStore.js'
import { isLoggedIn } from '../api/index.js'
import { useI18n } from '../composables/useI18n.js'
import ChatView from './ChatView.vue'
import TokenBar from '../components/common/TokenBar.vue'

const router = useRouter()
const route = useRoute()
const store = useChatStore()
const { t } = useI18n()
const openSettings = inject('openSettings')

const inputText = ref('')
const textareaRef = ref(null)
const fileInputRef = ref(null)
const pendingFiles = ref([])
const loggedIn = ref(isLoggedIn())
const model = ref('deepseek-v4-flash')
const thinking = ref('on')

const userName = computed(() => {
  try { return JSON.parse(localStorage.getItem('bbot_user')).name } catch { return '' }
})

const greeting = computed(() => {
  const h = new Date().getHours()
  const key = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const name = userName.value
  return name ? `${t(key)}, ${name}` : t(key)
})

const thinkingLabel = computed(() => thinking.value === 'off' ? t('thinkOff') : t('thinkOn'))
const modelLabel = computed(() => model.value.includes('pro') ? t('v4pro') : t('v4flash'))
const TAB_COLORS = ['#4f7dff', '#7c5cfc', '#3fb950', '#f0883e', '#f85149', '#d2991d']

function tabColor(i) { return TAB_COLORS[i % TAB_COLORS.length] }

function cycleThinking() {
  thinking.value = thinking.value === 'off' ? 'on' : 'off'
}
function cycleModel() {
  model.value = model.value.includes('flash') ? 'deepseek-v4-pro' : 'deepseek-v4-flash'
}

function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    if (!inputText.value.trim() && !pendingFiles.value.length) return
    e.preventDefault(); quickStart()
  }
}
function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

// ═══ File handling ═══
function onPaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  const files = []
  for (const item of items) {
    if (item.kind === 'file') files.push(item.getAsFile())
  }
  if (files.length) {
    e.preventDefault()
    processFiles(files)
  }
}
async function onFilesSelected(e) {
  if (e.target.files?.length) {
    processFiles(Array.from(e.target.files))
    e.target.value = ''
  }
}
async function processFiles(files) {
  for (const f of files) {
    let content = ''
    const isText = ['txt','js','ts','py','html','css','json','xml','md','yml','yaml','sh','bat','c','cpp','h','java','go','rs','rb','php','sql','csv','log','ini','cfg','toml','vue','svelte','less','scss','env','gitignore'].includes((f.name.split('.').pop()||'').toLowerCase())
    if (f.type?.startsWith('image/')) {
      content = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(f) })
    } else if (isText) {
      content = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(f) })
    } else {
      // Try extractFile for docx/pdf/etc — import dynamically
      try {
        const { extractFileContent } = await import('../utils/extractFile.js')
        content = await extractFileContent(f) || ''
      } catch { content = '' }
    }
    pendingFiles.value = [...pendingFiles.value, { name: f.name, type: f.type, size: f.size, content }]
  }
}
function removeFile(i) { pendingFiles.value.splice(i, 1) }

async function quickStart() {
  const text = inputText.value.trim()
  const hasFiles = pendingFiles.value.length > 0
  if (!text && !hasFiles) return
  try {
    inputText.value = ''
    const files = pendingFiles.value.map(f => ({ name: f.name, type: f.type, size: f.size, content: f.content || '' }))
    pendingFiles.value = []
    const id = 'conv_' + Date.now()
    await store.createConversation(id)
    await store.addUserMessage(text || '(文件)', files)
    // 必须在 addUserMessage 之后设置——确保 ChatView 检测时消息已入库
    store._pendingAutoReply = id
    router.push('/chat/' + id)
  } catch (e) {
    delete store._pendingAutoReply
    alert('发送失败: ' + (e.message || '未知错误'))
    inputText.value = text
  }
}

async function newChat() {
  const id = 'conv_' + Date.now()
  await store.createConversation(id)
  router.push('/chat/' + id)
}

function switchTab(id) { store.switchTab(id); router.push('/chat/' + id) }
function closeTab(id) {
  store.closeTab(id)
  // Store already switched currentId — sync the route
  if (store.currentId) {
    router.push('/chat/' + store.currentId)
  } else {
    router.push('/')
  }
}

async function openFeature(type) {
  const id = 'conv_' + Date.now()
  await store.createConversation(id)
  const prompts = {
    design: 'Create a modern landing page with HTML/CSS',
    code: 'Write a Python script that fetches and parses JSON from an API',
  }
  const text = prompts[type] || ''
  if (text) await store.addUserMessage(text, [])
  store._pendingAutoReply = id
  router.push('/chat/' + id)
}

// Sync URL param → store tab
async function syncRoute() {
  const id = route.params.id
  if (!id) return
  // Guard: don't reload messages during pending auto-reply (quickStart flow)
  if (store._pendingAutoReply === id) {
    store.switchTab(id)
    return
  }
  // Load messages if not in cache (after refresh, session restores currentId but messagesMap is empty)
  if (!store.messagesMap[id] || !store.messagesMap[id].length) {
    await store.loadMessages(id)
  } else if (id !== store.currentId) {
    store.switchTab(id)
  }
}

watch(() => route.params.id, (id) => {
  if (id) {
    // Guard: don't reload messages during pending auto-reply (quickStart flow)
    if (store._pendingAutoReply === id) {
      store.switchTab(id)
      return
    }
    if (!store.messagesMap[id] || !store.messagesMap[id].length) store.loadMessages(id)
    else store.switchTab(id)
  }
})

onMounted(async () => {
  store.loadApiKey()
  await store.loadConversations()
  await store._restoreSession()
  loggedIn.value = isLoggedIn()
  await syncRoute()
})
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

/* Top bar with tabs */
.topbar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 8px;
}

.tab-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
}
.tab-bar::-webkit-scrollbar { height: 2px; }

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 13px;
  color: var(--text3);
  font-weight: 300;
  white-space: nowrap;
  transition: all .15s;
  flex-shrink: 0;
  border: none;
  background: transparent;
  font-family: inherit;
}
.tab::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent-muted);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity .15s;
}
.tab:hover { color: var(--text2); background: rgba(255,255,255,0.03); }
.tab:hover::before { opacity: 1; }
.tab.active { color: var(--text); background: rgba(79,125,255,0.08); }
.tab.active::before { opacity: 1; background: var(--accent); }

.tab-title { max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
.tab-close {
  width: 16px; height: 16px;
  margin-left: 4px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity .1s, background .1s;
}
.tab:hover .tab-close { opacity: 1; }
.tab-close:hover { background: var(--bg3); color: var(--red); }

.topbar-right { display: flex; align-items: center; gap: 8px; }
.topbar-user { font-size: 13px; color: var(--text2); font-weight: 300; }

/* Content area */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
}

.greeting {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 40px;
  animation: fadeUp .5s ease both;
}
.greeting-text {
  font-size: 38px;
  font-weight: 300;
  letter-spacing: -1px;
  color: var(--text);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 680px;
  margin-bottom: 32px;
  animation: fadeUp .5s .1s ease both;
}

.feature-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  cursor: pointer;
  transition: background .15s, border-color .15s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.feature-card:hover { background: var(--bg3); border-color: var(--border2); }
.feature-card-icon { color: var(--text2); }
.feature-card-title { font-size: 13px; font-weight: 500; color: var(--text); }
.feature-card-desc { font-size: 12px; color: var(--text3); line-height: 1.5; font-weight: 300; }

/* Input */
/* File chips */
.hp-file-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.hp-file-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; background: var(--bg2); border: 1px solid var(--border);
  border-radius: 10px; font-size: 11px; color: var(--text2); max-width: 200px;
}
.hp-file-chip svg { flex-shrink: 0; color: var(--text-muted); }
.hp-file-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hp-file-chip-remove {
  display: flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; border-radius: 50%; border: none; background: transparent;
  color: var(--text3); flex-shrink: 0; cursor: pointer; transition: all .12s;
}
.hp-file-chip-remove:hover { background: rgba(248,81,73,0.12); color: var(--red); }
.hp-hidden-input { display: none; }

.input-wrap {
  width: 100%;
  max-width: 680px;
  flex-shrink: 0;
  animation: fadeUp .5s .18s ease both;
}

.input-box {
  background: var(--bg2);
  border: 1px solid var(--border2);
  border-radius: var(--radius-lg);
  padding: 14px 16px 10px;
}

.input-box textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 15px;
  font-family: inherit;
  font-weight: 300;
  resize: none;
  line-height: 1.6;
  min-height: 28px;
  max-height: 160px;
}
.input-box textarea::placeholder { color: var(--text3); }

.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 6px;
}

.toolbar-left { display: flex; align-items: center; gap: 4px; }

.tool-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  font-weight: 300;
  transition: background .12s, color .12s;
}
.tool-btn:hover { background: var(--bg3); color: var(--text2); }
.tool-btn.active { color: var(--accent); }

.toolbar-right { display: flex; align-items: center; gap: 8px; }

.model-selector {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  font-weight: 300;
  transition: background .12s;
}
.model-selector:hover { background: var(--bg3); color: var(--text2); }

.model-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--accent);
}

.send-btn {
  width: 32px; height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .15s, transform .1s;
}
.send-btn:hover { background: var(--accent-hover); }
.send-btn:active { transform: scale(.95); }
.send-btn:disabled { background: var(--bg4); color: var(--text3); cursor: not-allowed; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
