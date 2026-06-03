<template>
  <aside class="sidebar">
    <div class="sidebar-top">
      <div class="logo" @click="goHome">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="9" stroke="var(--accent)" stroke-width="1.5"/>
          <path d="M7 11h8M11 7v8M7 7l8 8M7 15l8-8" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        {{ t('brand') }}
      </div>
    </div>

    <button class="new-chat-btn" @click="newChat">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      {{ t('newChat') }}
    </button>

    <div class="nav-section">
      <button class="nav-item" :class="{ active: route.path === '/' }" @click="goHome">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 6.5L7.5 2 13 6.5V13H9.5v-3.5h-4V13H2V6.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        {{ t('home') }}
      </button>
      <button class="nav-item" @click="openSettings('api')">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 4h11M2 7.5h6M2 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="11.5" cy="10" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M13.5 12l1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        {{ t('apiKey') }}
        <span class="nav-dot" v-if="!apiKeySet" />
      </button>
      <button class="nav-item" @click="openSettings('email')">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1.5" y="3.5" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 5l6 4 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        {{ t('email') }}
      </button>
      <button class="nav-item" :class="{ active: isSocialActive }" @click="$router.push('/social')">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5.5" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="4" r="1.8" stroke="currentColor" stroke-width="1.3"/><path d="M1 13c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11 8c1.7 0 3 1.2 3 2.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        {{ t('social') }}
      </button>
    </div>

    <div class="recents-header"><span>{{ t('recent') }}</span></div>
    <div class="recents-list">
      <div v-for="conv in store.conversations" :key="conv.id" :class="['recent-item', { active: conv.id === store.currentId }]" @click="openChat(conv.id)">{{ conv.title || t('newChat') }}</div>
      <div v-if="!store.conversations.length" class="recents-empty">{{ t('noConvs') }}</div>
    </div>

    <div class="sidebar-bottom">
      <!-- ═══ Language Switcher Dropdown ═══ -->
      <div class="lang-switcher" ref="langSwitcherRef">
        <button class="lang-btn" @click="showLangMenu = !showLangMenu" :title="t('switchLang')">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.2"/>
            <ellipse cx="7.5" cy="7.5" rx="2.8" ry="6" stroke="currentColor" stroke-width="1.2"/>
            <path d="M1.5 7.5h12M7.5 1.5v12" stroke="currentColor" stroke-width="0.9" stroke-linecap="round"/>
          </svg>
          <span class="lang-label">{{ currentLangLabel }}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="lang-chevron" :class="{ open: showLangMenu }">
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <Transition name="lang-drop">
          <div v-if="showLangMenu" class="lang-menu" @click.stop>
            <button
              v-for="m in LANG_META"
              :key="m.code"
              :class="['lang-option', { active: lang === m.code }]"
              @click="selectLang(m.code)"
            >
              <span class="lang-option-name">{{ isZh ? m.native : m.en }}</span>
              <svg v-if="lang === m.code" width="14" height="14" viewBox="0 0 14 14" fill="none" class="lang-check">
                <path d="M3 7.5l2.5 2.5L11 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </Transition>
      </div>

      <template v-if="loggedIn">
        <div class="user-row">
          <div class="user-avatar">{{ userName?.charAt(0) || 'U' }}</div>
          <span class="user-name">{{ userName || 'User' }}</span>
          <button class="logout-btn" @click="doLogout" :title="t('signOut')">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 1.5H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 4l2.5 2.5L9 9M11.5 6.5H4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </template>
      <template v-else>
        <button class="login-prompt" @click="$router.push('/login')">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.8" stroke="currentColor" stroke-width="1.3"/><path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          {{ t('signIn') }}
        </button>
      </template>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '../../store/chatStore.js'
import { isLoggedIn, logout } from '../../api/index.js'
import { disconnect } from '../../api/ws.js'
import { useI18n } from '../../composables/useI18n.js'

const router = useRouter()
const route = useRoute()
const store = useChatStore()
const { t, lang, setLang, langDisplay, LANG_META, isZh } = useI18n()
const loggedIn = ref(isLoggedIn())
const apiKeySet = ref(false)
const openSettings = inject('openSettings')

const showLangMenu = ref(false)
const langSwitcherRef = ref(null)

const isSocialActive = computed(() => ['/social','/friends','/groups','/dm','/group'].some(p => route.path.startsWith(p)))

const currentLangLabel = computed(() => langDisplay(lang.value))

const userName = computed(() => { try { return JSON.parse(localStorage.getItem('bbot_user')).name } catch { return null } })

function goHome() { router.push('/') }
function newChat() { if (!apiKeySet.value) { openSettings('api'); return }; const id = 'conv_' + Date.now(); store.createConversation(id); router.push('/chat/' + id) }
function openChat(id) { store.switchTab(id); router.push('/chat/' + id) }
function doLogout() { logout(); disconnect(); loggedIn.value = false; router.push('/') }

function selectLang(code) {
  setLang(code)
  showLangMenu.value = false
}

// Close lang menu on outside click
function onOutsideClick(e) {
  if (showLangMenu.value && langSwitcherRef.value && !langSwitcherRef.value.contains(e.target)) {
    showLangMenu.value = false
  }
}

onMounted(() => {
  store.loadApiKey(); store.loadConversations()
  apiKeySet.value = store.apikey.length > 0; loggedIn.value = isLoggedIn()
  setInterval(() => { loggedIn.value = isLoggedIn(); apiKeySet.value = store.apikey.length > 0 }, 2000)
  document.addEventListener('click', onOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onOutsideClick)
})
</script>

<style scoped>
.sidebar { width: var(--sidebar-w); height: 100vh; height: 100dvh; background: var(--bg2); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; }
.sidebar-top { padding: 16px 12px 8px; display: flex; align-items: center; justify-content: space-between; }
.logo { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 500; color: var(--text); letter-spacing: -0.3px; cursor: pointer; user-select: none; }
.new-chat-btn { margin: 4px 12px 10px; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: var(--radius); border: 1px solid var(--border2); background: transparent; color: var(--text2); cursor: pointer; font-size: 14px; font-family: inherit; font-weight: 300; transition: background .15s, color .15s, border-color .15s; width: calc(100% - 24px); }
.new-chat-btn:hover { background: var(--bg3); color: var(--text); border-color: var(--border2); }
.nav-section { padding: 0 8px 4px; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; cursor: pointer; color: var(--text2); font-size: 14px; font-weight: 300; transition: background .12s, color .12s; border: none; background: transparent; width: 100%; font-family: inherit; text-align: left; }
.nav-item:hover { background: var(--bg3); color: var(--text); }
.nav-item.active { background: var(--bg3); color: var(--text); }
.nav-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-left: auto; }
.recents-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 6px; font-size: 12px; color: var(--text3); letter-spacing: .04em; }
.recents-list { flex: 1; overflow-y: auto; padding: 0 8px; }
.recents-list::-webkit-scrollbar { width: 4px; }
.recents-list::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }
.recent-item { padding: 6px 10px; border-radius: 8px; cursor: pointer; color: var(--text3); font-size: 13px; font-weight: 300; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background .12s, color .12s; border: none; background: transparent; width: 100%; font-family: inherit; text-align: left; }
.recent-item:hover { background: var(--bg3); color: var(--text2); }
.recent-item.active { background: var(--bg3); color: var(--text); }
.recents-empty { padding: 20px 12px; font-size: 12px; color: var(--text3); font-weight: 300; }
.sidebar-bottom { padding: 8px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; }

/* ═══ Language Switcher ═══ */
.lang-switcher { position: relative; }
.lang-btn {
  display: flex; align-items: center; gap: 7px;
  width: 100%; padding: 6px 9px;
  border-radius: 8px; border: 1px solid transparent;
  background: transparent; color: var(--text2);
  font-size: 12px; font-family: inherit; font-weight: 300;
  cursor: pointer; transition: all .12s;
}
.lang-btn:hover { background: var(--bg3); color: var(--text); border-color: var(--border2); }
.lang-label { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lang-chevron { color: var(--text3); flex-shrink: 0; transition: transform .18s ease; }
.lang-chevron.open { transform: rotate(180deg); }

.lang-menu {
  position: absolute; bottom: 100%; left: 0; right: 0;
  margin-bottom: 4px;
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,.35);
  padding: 4px; z-index: var(--z-dropdown);
  min-width: 180px;
}

.lang-option {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 7px 10px; border-radius: 6px;
  border: none; background: transparent;
  color: var(--text2); font-size: 12px; font-family: inherit; font-weight: 300;
  cursor: pointer; transition: all .1s; text-align: left;
}
.lang-option:hover { background: var(--bg3); color: var(--text); }
.lang-option.active { background: var(--accent-muted); color: var(--accent); font-weight: 400; }
.lang-option-name { flex: 1; }
.lang-check { color: var(--accent); flex-shrink: 0; }

/* Dropdown transitions */
.lang-drop-enter-active { animation: langIn .18s ease both; transform-origin: bottom center; }
.lang-drop-leave-active { animation: langOut .12s ease both; transform-origin: bottom center; }
@keyframes langIn { from { opacity: 0; transform: translateY(6px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes langOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(6px) scale(.96); } }

.user-row { display: flex; align-items: center; gap: 8px; padding: 4px 2px; }
.user-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-muted); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; }
.user-name { flex: 1; font-size: 13px; color: var(--text2); font-weight: 300; }
.logout-btn { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .12s, color .12s; }
.logout-btn:hover { background: var(--bg3); color: var(--red); }
.login-prompt { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; cursor: pointer; color: var(--text3); font-size: 13px; font-weight: 300; transition: background .12s, color .12s; border: none; background: transparent; width: 100%; font-family: inherit; }
.login-prompt:hover { background: var(--bg3); color: var(--text); }
</style>
