<template>
  <div class="app-layout">
    <Sidebar />
    <div class="main-area">
      <div class="page-header">
        <h2>群聊大厅</h2>
      </div>

      <!-- Create group -->
      <div class="bar">
        <input v-model="newGroupName" placeholder="输入群名创建新群..." @keydown.enter="createGroup" />
        <button class="btn-primary" @click="createGroup">创建群聊</button>
      </div>

      <!-- Join group -->
      <div class="bar">
        <input v-model="inviteCode" placeholder="输入邀请码加入群聊..." @keydown.enter="joinGroup" />
        <button class="btn-primary" @click="joinGroup">加入</button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <!-- My groups -->
      <div class="section">
        <div class="section-title">我的群聊 ({{ myGroups.length }})</div>
        <div
          v-for="g in myGroups"
          :key="g.id"
          class="group-row"
          @click="$router.push('/group/' + g.id)"
        >
          <span class="group-name">{{ g.name }}</span>
          <span class="group-meta">{{ g.member_count }} 人</span>
          <span class="group-code">{{ g.invite_code }}</span>
        </div>
        <p v-if="!myGroups.length" class="empty">还没有加入任何群聊</p>
      </div>

      <!-- All groups -->
      <div class="section">
        <div class="section-title">所有群聊</div>
        <div
          v-for="g in allGroups"
          :key="g.id"
          class="group-row"
          @click="tryJoinOrOpen(g)"
        >
          <span class="group-name">{{ g.name }}</span>
          <span class="group-meta">{{ g.member_count }} 人</span>
          <span class="group-code">{{ g.invite_code }}</span>
          <button v-if="!myGroupIds.has(g.id)" class="btn-join" @click.stop="joinById(g.id)">加入</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { groups } from '../api/index.js'
import Sidebar from '../components/Sidebar.vue'

const router = useRouter()
const newGroupName = ref('')
const inviteCode = ref('')
const myGroups = ref([])
const allGroups = ref([])
const myGroupIds = ref(new Set())
const error = ref('')

async function load() {
  try {
    const [my, all] = await Promise.all([groups.myList(), groups.all()])
    myGroups.value = my
    allGroups.value = all
    myGroupIds.value = new Set(my.map(g => g.id))
  } catch {}
}

async function createGroup() {
  if (!newGroupName.value.trim()) return
  try {
    const g = await groups.create(newGroupName.value.trim())
    newGroupName.value = ''
    error.value = ''
    router.push('/group/' + g.id)
  } catch (e) {
    error.value = e.message
  }
}

async function joinGroup() {
  if (!inviteCode.value.trim()) return
  try {
    const g = await groups.join(inviteCode.value.trim())
    inviteCode.value = ''
    error.value = ''
    router.push('/group/' + g.id)
  } catch (e) {
    error.value = e.message
  }
}

async function joinById(id) {
  try {
    const g = allGroups.value.find(x => x.id === id)
    if (g) {
      await groups.join(g.invite_code)
      router.push('/group/' + id)
    }
  } catch (e) {
    error.value = e.message
  }
}

function tryJoinOrOpen(g) {
  if (myGroupIds.value.has(g.id)) {
    router.push('/group/' + g.id)
  }
}

onMounted(load)
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  background: var(--bg);
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
.bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.bar input {
  flex: 1;
  border: 2px solid var(--border);
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
}
.bar input:focus { border-color: var(--primary); }
.btn-primary {
  border: 2px solid var(--primary);
  background: var(--primary);
  color: #fff;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.btn-primary:hover { background: var(--primary-hover); }
.error {
  font-size: 12px;
  color: var(--red);
  margin-bottom: 8px;
}
.section { margin-bottom: 20px; }
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-light);
}
.group-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-light);
  margin-bottom: 4px;
  cursor: pointer;
  transition: background 0.1s;
}
.group-row:hover { background: var(--bg-hover); }
.group-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.group-meta {
  font-size: 11px;
  color: var(--text-muted);
}
.group-code {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
  border: 1px solid var(--border-light);
  padding: 2px 6px;
}
.btn-join {
  border: 1px solid var(--primary);
  background: var(--bg);
  color: var(--primary);
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.1s;
}
.btn-join:hover { background: var(--primary-bg); }
.empty {
  font-size: 13px;
  color: var(--text-muted);
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
  .bar input {
    font-size: 16px;
    padding: 10px 12px;
  }
  .btn-primary {
    padding: 10px 14px;
    font-size: 14px;
  }
  .group-row {
    padding: 12px 10px;
    gap: 6px;
  }
  .group-name {
    font-size: 14px;
  }
}
</style>
