<template>
  <div class="app-layout">
    <Sidebar />
    <div class="main-area">
      <div class="page-header">
        <h2>好友列表</h2>
      </div>

      <!-- Add friend -->
      <div class="add-friend-bar">
        <input
          v-model="searchQuery"
          placeholder="输入昵称搜索添加好友..."
          @keydown.enter="searchUsers"
        />
        <button class="btn-search" @click="searchUsers">搜索</button>
      </div>

      <!-- Search results -->
      <div v-if="searchResults.length" class="section">
        <div class="section-title">搜索结果</div>
        <div
          v-for="u in searchResults"
          :key="u.id"
          class="user-row"
        >
          <span class="status-dot" :class="u.status"></span>
          <span class="user-name">{{ u.name }}</span>
          <button class="btn-add" @click="addFriend(u)">添加好友</button>
        </div>
      </div>
      <p v-if="searchDone && !searchResults.length" class="empty">未找到匹配的用户</p>

      <!-- Pending requests -->
      <div v-if="pending.length" class="section">
        <div class="section-title">待处理的好友申请</div>
        <div
          v-for="req in pending"
          :key="req.id"
          class="user-row"
        >
          <span class="user-name">{{ req.name }}</span>
          <button class="btn-accept" @click="acceptFriend(req)">接受</button>
          <button class="btn-reject" @click="rejectFriend(req)">拒绝</button>
        </div>
      </div>

      <!-- Friend list -->
      <div class="section">
        <div class="section-title">我的好友 ({{ friends.length }})</div>
        <div
          v-for="f in friends"
          :key="f.id"
          class="friend-row"
          @click="goDM(f.id)"
        >
          <span class="status-dot" :class="f.status"></span>
          <span class="friend-name">{{ f.name }}</span>
          <span class="friend-status">{{ f.status === 'online' ? '在线' : '离线' }}</span>
          <button class="btn-msg" @click.stop="goDM(f.id)">发消息</button>
          <button class="btn-del" @click.stop="removeFriend(f)">删除</button>
        </div>
        <p v-if="!friends.length" class="empty">还没有好友，搜索昵称添加吧</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { friends, users } from '../api/index.js'
import { on as wsOn, send as wsSend } from '../api/ws.js'
import Sidebar from '../components/Sidebar.vue'

const router = useRouter()
const friendsList = ref([])
const pending = ref([])
const searchQuery = ref('')
const searchResults = ref([])
const searchDone = ref(false)

let unsubs = []

async function loadFriends() {
  try {
    const data = await friends.list()
    friendsList.value = data.list
    pending.value = data.pending
  } catch {}
}

async function searchUsers() {
  if (!searchQuery.value.trim()) return
  try {
    searchResults.value = await users.search(searchQuery.value.trim())
    searchDone.value = true
  } catch {}
}

async function addFriend(u) {
  try {
    await friends.add(u.name)
    searchResults.value = []
    searchQuery.value = ''
    loadFriends()
  } catch (e) {
    alert(e.message)
  }
}

async function acceptFriend(req) {
  await friends.accept(req.id)
  wsSend({ type: 'friend_accepted', to: req.id })
  loadFriends()
}

async function rejectFriend(req) {
  await friends.reject(req.id)
  loadFriends()
}

async function removeFriend(f) {
  if (!confirm('确定删除好友 ' + f.name + ' ？')) return
  await friends.remove(f.id)
  loadFriends()
}

function goDM(friendId) {
  router.push('/dm/' + friendId)
}

// WebSocket listeners
function setupWS() {
  unsubs.push(wsOn('friend_request', (msg) => {
    loadFriends()
  }))
  unsubs.push(wsOn('friend_accepted', (msg) => {
    loadFriends()
  }))
  unsubs.push(wsOn('friend_status', (msg) => {
    const f = friendsList.value.find(x => x.id === msg.userId)
    if (f) f.status = msg.status
  }))
}

onMounted(() => {
  loadFriends()
  setupWS()
})

onUnmounted(() => {
  unsubs.forEach(fn => fn())
})
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  background: var(--bg2);
}
.main-area {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px 24px;
}
.page-header {
  height: 48px;
  display: flex;
  align-items: center;
  border-bottom: 2px solid var(--border);
  margin-bottom: 20px;
}
.page-header h2 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.add-friend-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.add-friend-bar input {
  flex: 1;
  border: 1px solid var(--border); border-radius: var(--radius); border-radius: var(--radius-lg);
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
  background: var(--bg2);
  color: var(--text);
  font-family: inherit;
}
.add-friend-bar input:focus { border-color: var(--primary); }
.btn-search {
  border: 1px solid var(--border); border-radius: var(--radius); border-radius: var(--radius-lg);
  background: var(--bg2);
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text);
  font-weight: 600;
  transition: background 0.15s;
}
.btn-search:hover { background: var(--bg-hover); }
.section { margin-bottom: 20px; }
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.user-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  margin-bottom: 4px;
}
.friend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  margin-bottom: 4px;
  cursor: pointer;
  transition: background 0.1s;
}
.friend-row:hover { background: var(--bg-hover); }
.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-muted);
}
.status-dot.online { background: var(--green); }
.user-name, .friend-name {
  flex: 1;
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
}
.friend-status {
  font-size: 11px;
  color: var(--text3);
}
.btn-add, .btn-accept, .btn-msg {
  border: 1px solid var(--primary);
  background: var(--bg2);
  color: var(--primary);
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.1s;
}
.btn-add:hover, .btn-accept:hover, .btn-msg:hover {
  background: var(--primary-bg);
}
.btn-reject, .btn-del {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text3);
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: color 0.1s;
}
.btn-reject:hover, .btn-del:hover { color: var(--red); }
.empty {
  font-size: 13px;
  color: var(--text3);
  padding: 12px 0;
}
@media (max-width: 768px) {
  .main-area {
    padding: 12px;
    padding-top: 44px;
  }
  .page-header {
    height: 36px;
    margin-bottom: 12px;
  }
  .page-header h2 {
    font-size: 15px;
  }
  .add-friend-bar input {
    font-size: 16px;
    padding: 10px 12px;
  }
  .btn-search {
    padding: 10px 14px;
    font-size: 14px;
  }
  .friend-row {
    padding: 12px 10px;
    gap: 6px;
  }
  .friend-name {
    font-size: 14px;
  }
}
</style>
