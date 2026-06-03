<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sidebar-top">
      <div class="logo" @click="goHome">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <circle cx="11" cy="11" r="9" stroke="var(--accent)" stroke-width="1.5"/>
          <path d="M7 11h8M11 7v8M7 7l8 8M7 15l8-8" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        DeepSeek-Super
      </div>
    </div>

    <!-- New Chat -->
    <button class="new-chat-btn" @click="newChat">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      New Chat
    </button>

    <!-- Main Nav -->
    <div class="nav-section">
      <button class="nav-item" :class="{ active: route.path === '/' }" @click="goHome">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M2 6.5L7.5 2 13 6.5V13H9.5v-3.5h-4V13H2V6.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
        Home
      </button>
      <button class="nav-item" @click="openSettings('api')">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M2 4h11M2 7.5h6M2 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="11.5" cy="10" r="2.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M13.5 12l1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        API Key
        <span class="nav-dot" v-if="!apiKeySet" />
      </button>
      <button class="nav-item" @click="openSettings('email')">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <rect x="1.5" y="3.5" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M1.5 5l6 4 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        Email
      </button>
      <button class="nav-item" @click="$router.push('/friends')">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="5.5" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
          <circle cx="11" cy="4" r="1.8" stroke="currentColor" stroke-width="1.3"/>
          <path d="M1 13c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M11 8c1.7 0 3 1.2 3 2.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        Social
      </button>
      <button class="nav-item" @click="$router.push('/groups')">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <rect x="2" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M5 7h5M5 9.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        Groups
      </button>
    </div>

    <!-- Recent Chats -->
    <div class="recents-header">
      <span>Recent</span>
    </div>
    <div class="recents-list" ref="recentsRef">
      <div
        v-for="conv in store.conversations"
        :key="conv.id"
        :class="['recent-item', { active: conv.id === store.currentId }]"
        @click="openChat(conv.id)"
      >
        {{ conv.title || 'New Chat' }}
      </div>
      <div v-if="!store.conversations.length" class="recents-empty">
        No conversations yet
      </div>
    </div>

    <!-- Bottom: Login / User Status -->
    <div class="sidebar-bottom">
      <template v-if="loggedIn">
        <div class="user-row">
          <div class="user-avatar">{{ userName?.charAt(0) || 'U' }}</div>
          <span class="user-name">{{ userName || 'User' }}</span>
          <button class="logout-btn" @click="doLogout" title="Logout">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M5 1.5H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 4l2.5 2.5L9 9M11.5 6.5H4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </template>
      <template v-else>
        <button class="login-prompt" @click="$router.push('/login')">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="5" r="2.8" stroke="currentColor" stroke-width="1.3"/>
            <path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          Sign in
        </button>
      </template>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '../../store/chatStore.js'
import { isLoggedIn, logout } from '../../api/index.js'
import { disconnect } from '../../api/ws.js'

const router = useRouter()
const route = useRoute()
const store = useChatStore()
const loggedIn = ref(isLoggedIn())
const apiKeySet = ref(false)

const openSettings = inject('openSettings')

const userName = computed(() => {
  try { return JSON.parse(localStorage.getItem('bbot_user')).name } catch { return null }
})

function goHome() { router.push('/') }
function newChat() {
  if (!apiKeySet.value) { openSettings('api'); return }
  const id = 'conv_' + Date.now()
  store.createConversation(id)
  router.push('/chat/' + id)
}
function openChat(id) {
  store.switchTab(id)
  router.push('/chat/' + id)
}

function doLogout() {
  logout()
  disconnect()
  loggedIn.value = false
  router.push('/')
}

onMounted(() => {
  store.loadApiKey()
  store.loadConversations()
  apiKeySet.value = store.apikey.length > 0
  loggedIn.value = isLoggedIn()
  // Re-check periodically (user might login on another page)
  setInterval(() => { loggedIn.value = isLoggedIn(); apiKeySet.value = store.apikey.length > 0 }, 2000)
})
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  height: 100vh;
  height: 100dvh;
  background: var(--bg2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.sidebar-top {
  padding: 16px 12px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 500;
  color: var(--text);
  letter-spacing: -0.3px;
  cursor: pointer;
  user-select: none;
}

.new-chat-btn {
  margin: 4px 12px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  font-weight: 300;
  transition: background .15s, color .15s, border-color .15s;
  width: calc(100% - 24px);
}
.new-chat-btn:hover { background: var(--bg3); color: var(--text); border-color: var(--border2); }

.nav-section { padding: 0 8px 4px; }

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text2);
  font-size: 14px;
  font-weight: 300;
  transition: background .12s, color .12s;
  border: none;
  background: transparent;
  width: 100%;
  font-family: inherit;
  text-align: left;
}
.nav-item:hover { background: var(--bg3); color: var(--text); }
.nav-item.active { background: var(--bg3); color: var(--text); }

.nav-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--accent);
  margin-left: auto;
}

.recents-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 6px;
  font-size: 12px;
  color: var(--text3);
  letter-spacing: .04em;
}

.recents-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}
.recents-list::-webkit-scrollbar { width: 4px; }
.recents-list::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }

.recent-item {
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text3);
  font-size: 13px;
  font-weight: 300;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background .12s, color .12s;
  border: none;
  background: transparent;
  width: 100%;
  font-family: inherit;
  text-align: left;
}
.recent-item:hover { background: var(--bg3); color: var(--text2); }
.recent-item.active { background: var(--bg3); color: var(--text); }

.recents-empty {
  padding: 20px 12px;
  font-size: 12px;
  color: var(--text3);
  font-weight: 300;
}

.sidebar-bottom {
  padding: 10px 8px;
  border-top: 1px solid var(--border);
}

.user-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
}

.user-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--accent-muted);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
}

.user-name {
  flex: 1;
  font-size: 13px;
  color: var(--text2);
  font-weight: 300;
}

.logout-btn {
  width: 28px; height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .12s, color .12s;
}
.logout-btn:hover { background: var(--bg3); color: var(--red); }

.login-prompt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text3);
  font-size: 13px;
  font-weight: 300;
  transition: background .12s, color .12s;
  border: none;
  background: transparent;
  width: 100%;
  font-family: inherit;
}
.login-prompt:hover { background: var(--bg3); color: var(--text); }
</style>
