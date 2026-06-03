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
          <button class="tab-close" @click.stop="closeTab(tab.id)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
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
        <div class="feature-card" @click="openFeature('agent')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="3" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <circle cx="7" cy="8.5" r="1.5" fill="currentColor" opacity="0.5"/>
            <circle cx="11" cy="8.5" r="1.5" fill="currentColor" opacity="0.5"/>
            <path d="M6 12h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <div class="feature-card-title">{{ t('agentMode') }}</div>
          <div class="feature-card-desc">{{ t('agentModeDesc') }}</div>
        </div>
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
        <div class="input-box">
          <textarea
            ref="textareaRef"
            v-model="inputText"
            :placeholder="t('askPlaceholder')"
            @keydown="onKey"
            @input="autoResize"
            rows="1"
          />
          <div class="input-toolbar">
            <div class="toolbar-left">
              <button class="tool-btn" @click="quickStart('agent')">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                {{ t('agent') }}
              </button>
              <button class="tool-btn" :class="{ active: thinking !== 'medium' }" @click="cycleThinking">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6.5 3v3.5L9 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                {{ thinkingLabel }}
              </button>
            </div>
            <div class="toolbar-right">
              <button class="model-selector" @click="cycleModel">
                <span class="model-dot" />
                {{ modelLabel }}
              </button>
              <button class="send-btn" @click="quickStart('chat')" :disabled="!inputText.trim()">
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

const router = useRouter()
const route = useRoute()
const store = useChatStore()
const { t } = useI18n()
const openSettings = inject('openSettings')

const inputText = ref('')
const textareaRef = ref(null)
const loggedIn = ref(isLoggedIn())
const model = ref('deepseek-v4-flash')
const thinking = ref('medium')

const userName = computed(() => {
  try { return JSON.parse(localStorage.getItem('bbot_user')).name } catch { return '' }
})

const greeting = computed(() => {
  const h = new Date().getHours()
  const key = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const name = userName.value
  return name ? `${t(key)}, ${name}` : t(key)
})

const thinkingLabel = computed(() => ({ low: t('quick'), medium: t('think'), high: t('deep') })[thinking.value])
const modelLabel = computed(() => model.value.includes('pro') ? t('v4pro') : t('v4flash'))
const TAB_COLORS = ['#4f7dff', '#7c5cfc', '#3fb950', '#f0883e', '#f85149', '#d2991d']

function tabColor(i) { return TAB_COLORS[i % TAB_COLORS.length] }

function cycleThinking() {
  const o = ['low','medium','high']
  thinking.value = o[(o.indexOf(thinking.value) + 1) % 3]
}
function cycleModel() {
  model.value = model.value.includes('flash') ? 'deepseek-v4-pro' : 'deepseek-v4-flash'
}

function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); quickStart('chat') }
}
function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

function quickStart(mode) {
  const text = inputText.value.trim()
  if (!text && mode === 'chat') return
  if (!store.apikey) { openSettings('api'); return }
  const id = 'conv_' + Date.now()
  store.createConversation(id)
  if (text) store.addUserMessage(text, [])
  router.push('/chat/' + id)
}

function newChat() {
  if (!store.apikey) { openSettings('api'); return }
  const id = 'conv_' + Date.now()
  store.createConversation(id)
  router.push('/chat/' + id)
}

function switchTab(id) { store.switchTab(id); router.push('/chat/' + id) }
function closeTab(id) {
  store.closeTab(id)
  if (store.currentId === id) {
    if (store.openTabs.length) switchTab(store.openTabs[0])
    else store.currentId = null
  }
}

function openFeature(type) {
  if (!store.apikey) { openSettings('api'); return }
  const id = 'conv_' + Date.now()
  store.createConversation(id)
  const prompts = {
    agent: 'List the files in this project and tell me what you can do',
    design: 'Create a modern landing page with HTML/CSS',
    code: 'Write a Python script that fetches and parses JSON from an API',
  }
  const text = prompts[type] || ''
  if (text) store.addUserMessage(text, [])
  router.push('/chat/' + id)
}

// Sync URL param → store tab
function syncRoute() {
  const id = route.params.id
  if (id && id !== store.currentId) {
    store.loadMessages(id)
  }
}

watch(() => route.params.id, (id) => {
  if (id) {
    if (!store.messagesMap[id]) store.loadMessages(id)
    else store.switchTab(id)
  }
})

onMounted(() => {
  store.loadApiKey()
  store.loadConversations()
  loggedIn.value = isLoggedIn()
  syncRoute()
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
