<template>
    <!-- Hamburger button (mobile only) -->
    <button class="hamburger-btn" @click="toggleSidebar" title="菜单">|||</button>

    <!-- Overlay for mobile -->
    <div :class="['sidebar-overlay', { show: mobileOpen }]" @click="closeSidebar"></div>

    <div :class="['sidebar', { open: mobileOpen }]">
        <div class="sidebar-header">
            <span class="logo">AI Chat</span>
            <button class="btn-close-mobile" @click="closeSidebar">&times;</button>
        </div>

        <button class="btn-new" @click="newConversation">+ 新对话</button>

        <div class="nav-links">
          <router-link to="/" class="nav-link" @click="closeSidebar">首页</router-link>
          <router-link to="/friends" class="nav-link" @click="closeSidebar">好友</router-link>
          <router-link to="/groups" class="nav-link" @click="closeSidebar">群聊</router-link>
        </div>

        <div class="conv-list">
            <div
                v-for="conv in store.conversations"
                :key="conv.id"
                :class="['conv-item', { active: conv.id === store.currentId }]"
                @click="goToChat(conv.id)"
            >
                <span class="conv-title" :title="'双击改名: ' + (conv.title || '新对话')">{{ conv.title || '新对话' }}</span>
                <button class="btn-rename" @click.stop="rename(conv)" title="改名">改</button>
                <button class="btn-delete" @click.stop="deleteChat(conv.id)">x</button>
            </div>
        </div>

        <div class="sidebar-footer">
            <button class="btn-theme" @click="theme.toggleTheme">
                {{ theme.isDark.value ? '亮色' : '暗色' }}
            </button>
            <button class="btn-home" @click="goHome">首页</button>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../store/chatStore.js'

const theme = inject('theme')
const router = useRouter()
const store = useChatStore()
const mobileOpen = ref(false)

function toggleSidebar() {
    mobileOpen.value = !mobileOpen.value
}
function closeSidebar() {
    mobileOpen.value = false
}

async function newConversation() {
    closeSidebar()
    if (!store.apikey) {
        alert('请先输入 API Key')
        return
    }
    const id = 'conv_' + Date.now()
    await store.createConversation(id)
    router.push('/chat/' + id)
}

function goToChat(id) {
    closeSidebar()
    if (id !== store.currentId) {
        store.switchTab(id)
        router.push('/chat/' + id)
    }
}

function rename(conv) {
    const newTitle = prompt('修改标题:', conv.title || '')
    if (newTitle && newTitle.trim() && newTitle.trim() !== conv.title) {
        store.updateConvTitle(conv.id, newTitle.trim())
    }
}

function deleteChat(id) {
    store.deleteConv(id)
}

function goHome() {
    closeSidebar()
    router.push('/')
}
</script>

<style scoped>
.sidebar {
    width: 260px;
    min-width: 260px;
    height: 100vh;
    border-right: 2px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    transition: background 0.2s, border-color 0.2s, transform 0.25s ease;
}
.sidebar-header {
    height: 48px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid var(--border);
    flex-shrink: 0;
    transition: border-color 0.2s;
}
.logo {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
}
.btn-close-mobile {
    display: none;
    border: 1px solid var(--border-light);
    background: transparent;
    color: var(--text-muted);
    width: 28px; height: 28px;
    font-size: 16px;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    line-height: 1;
    padding: 0;
}
.btn-new {
    margin: 10px 16px;
    border: 2px solid var(--primary);
    background: var(--primary);
    color: #fff;
    padding: 9px 0;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    flex-shrink: 0;
    transition: background 0.15s;
}
.btn-new:hover {
    background: var(--primary-hover);
}
.nav-links {
    display: flex;
    gap: 0;
    padding: 0 16px;
    margin-bottom: 8px;
}
.nav-link {
    flex: 1;
    text-align: center;
    padding: 6px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-decoration: none;
    border: 1px solid var(--border-light);
    transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.nav-link:hover {
    background: var(--bg-hover);
    color: var(--text);
}
.nav-link.router-link-active {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-bg);
}
.conv-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 8px;
    min-height: 0;
}
.conv-item {
    border: 1px solid var(--border-light);
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    margin-bottom: 6px;
    transition: background 0.1s, border-color 0.1s;
}
.conv-item:hover {
    background: var(--bg-hover);
}
.conv-item.active {
    border-color: var(--primary);
    background: var(--primary-bg);
}
.conv-title {
    font-size: 12px;
    color: var(--text);
    font-weight: 500;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.btn-rename {
    border: none;
    background: transparent;
    width: 20px;
    height: 20px;
    font-size: 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 0.1s, color 0.1s;
}
.conv-item:hover .btn-rename { opacity: 1; }
.btn-rename:hover { color: var(--primary); }
.btn-delete {
    border: none;
    background: transparent;
    width: 20px;
    height: 20px;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text-muted);
    transition: color 0.1s, background 0.1s;
}
.btn-delete:hover {
    color: var(--red);
    background: var(--bg-hover);
}
.sidebar-footer {
    height: 44px;
    border-top: 2px solid var(--border);
    padding: 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    transition: border-color 0.2s;
}
.btn-theme,
.btn-home {
    flex: 1;
    border: 1px solid var(--border-light);
    background: transparent;
    padding: 5px 0;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    text-align: center;
    color: var(--text-secondary);
    transition: background 0.1s, color 0.1s;
}
.btn-theme:hover,
.btn-home:hover {
    background: var(--bg-hover);
    color: var(--text);
}

/* ═══ Mobile ═══ */
@media (max-width: 768px) {
    .sidebar {
        position: fixed;
        top: 0; left: 0;
        z-index: 1000;
        height: 100vh;
        height: 100dvh;
        transform: translateX(-100%);
    }
    .sidebar.open {
        transform: translateX(0);
    }
    .sidebar-header {
        padding-top: env(safe-area-inset-top, 0px);
        min-height: 44px;
    }
    .sidebar-footer {
        padding-bottom: env(safe-area-inset-bottom, 0px);
        min-height: 44px;
    }
    .btn-close-mobile {
        display: flex;
    }
    .btn-new {
        margin: 8px 12px;
        padding: 12px 0;
        font-size: 14px;
    }
    .nav-links {
        padding: 0 12px;
    }
    .nav-link {
        padding: 10px 0;
        font-size: 13px;
    }
    .conv-list {
        padding: 0 12px 8px;
    }
    .conv-item {
        padding: 10px;
    }
    .conv-title {
        font-size: 13px;
    }
    .sidebar-footer {
        padding: 0 12px;
    }
    .btn-theme, .btn-home {
        padding: 8px 0;
        font-size: 12px;
    }
}
</style>
