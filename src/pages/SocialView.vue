<template>
  <div class="social-page">
    <div class="social-tabs">
      <button :class="['social-tab', { active: tab === 'friends' }]" @click="tab = 'friends'">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5.5" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="4" r="1.8" stroke="currentColor" stroke-width="1.3"/><path d="M1 13c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11 8c1.7 0 3 1.2 3 2.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        {{ t('friends') }}
      </button>
      <button :class="['social-tab', { active: tab === 'groups' }]" @click="tab = 'groups'">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="2.5" width="11" height="10" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 7h5M5 9.5h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        {{ t('groups2') }}
      </button>
    </div>

    <!-- Friends tab -->
    <div v-if="tab === 'friends'" class="social-content">
      <div class="search-row">
        <div class="input-wrap">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="s-icon"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M9.5 9.5L12.5 12.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          <input v-model="searchQuery" :placeholder="t('searchUsers')" @keydown.enter="searchUsers" />
        </div>
      </div>
      <div v-if="searchResults.length" class="list-section">
        <div class="list-label">{{ t('results') }}</div>
        <div v-for="u in searchResults" :key="u.id" class="list-row">
          <div class="list-avatar">{{ u.name.charAt(0) }}</div>
          <span class="list-name">{{ u.name }}</span>
          <span class="list-status" :class="u.status" />
          <button class="act-btn primary" @click="addFriend(u)">{{ t('addFriend') }}</button>
        </div>
      </div>
      <p v-if="searchDone && !searchResults.length" class="empty-msg">{{ t('noUsers') }}</p>
      <div v-if="pending.length" class="list-section">
        <div class="list-label">{{ t('pending') }} ({{ pending.length }})</div>
        <div v-for="r in pending" :key="r.id" class="list-row">
          <div class="list-avatar">{{ r.name.charAt(0) }}</div>
          <span class="list-name">{{ r.name }}</span>
          <div class="list-row-actions">
            <button class="act-btn primary" @click="acceptFriend(r)">{{ t('accept') }}</button>
            <button class="act-btn danger" @click="rejectFriend(r)">{{ t('reject') }}</button>
          </div>
        </div>
      </div>
      <div class="list-section">
        <div class="list-label">{{ t('myFriends') }} ({{ friends.length }})</div>
        <div v-for="f in friends" :key="f.id" class="list-row" @click="$router.push('/dm/' + f.id)">
          <div class="list-avatar" :class="{ online: f.status === 'online' }">{{ f.name.charAt(0) }}</div>
          <span class="list-name">{{ f.name }}</span>
          <span class="list-meta">{{ f.status === 'online' ? t('online') : t('offline') }}</span>
          <button class="act-btn ghost" @click.stop="removeFriend(f)">{{ t('remove') }}</button>
        </div>
        <p v-if="!friends.length" class="empty-msg">{{ t('noFriends') }}</p>
      </div>
    </div>

    <!-- Groups tab -->
    <div v-if="tab === 'groups'" class="social-content">
      <div class="search-row">
        <div class="input-wrap">
          <input v-model="newGroupName" :placeholder="t('groupName')" @keydown.enter="createGroup" />
          <button class="act-btn primary" @click="createGroup">{{ t('createGroup') }}</button>
        </div>
      </div>
      <div class="search-row">
        <div class="input-wrap">
          <input v-model="inviteCode" :placeholder="t('inviteCode')" @keydown.enter="joinGroup" />
          <button class="act-btn primary" @click="joinGroup">{{ t('joinGroup') }}</button>
        </div>
      </div>
      <p v-if="error" class="error-msg">{{ error }}</p>
      <div class="list-section">
        <div class="list-label">{{ t('myGroups') }} ({{ myGroups.length }})</div>
        <div v-for="g in myGroups" :key="g.id" class="list-row" @click="$router.push('/group/' + g.id)">
          <div class="list-avatar group-av">{{ g.name.charAt(0) }}</div>
          <span class="list-name">{{ g.name }}</span>
          <span class="list-meta">{{ g.member_count }} {{ t('members') }}</span>
          <span class="list-code">{{ g.invite_code }}</span>
        </div>
        <p v-if="!myGroups.length" class="empty-msg">{{ t('noGroups') }}</p>
      </div>
      <div class="list-section">
        <div class="list-label">{{ t('allGroups') }}</div>
        <div v-for="g in allGroups" :key="g.id" class="list-row" @click="tryJoinOrOpen(g)">
          <div class="list-avatar group-av">{{ g.name.charAt(0) }}</div>
          <span class="list-name">{{ g.name }}</span>
          <span class="list-meta">{{ g.member_count }} {{ t('members') }}</span>
          <button v-if="!myGroupIds.has(g.id)" class="act-btn ghost" @click.stop="joinById(g.id)">{{ t('joinGroup') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '../composables/useI18n.js'
import { friends, users, groups } from '../api/index.js'

const router = useRouter()
const { t } = useI18n()
const tab = ref('friends')

const friendsList = ref([]), pending = ref([]), searchQuery = ref(''), searchResults = ref([]), searchDone = ref(false)
const newGroupName = ref(''), inviteCode = ref(''), myGroups = ref([]), allGroups = ref([]), myGroupIds = ref(new Set()), error = ref('')

async function loadFriends() { try { const d = await friends.list(); friendsList.value = d.list; pending.value = d.pending } catch {} }
async function searchUsers() { if (!searchQuery.value.trim()) return; try { searchResults.value = await users.search(searchQuery.value.trim()); searchDone.value = true } catch {} }
async function addFriend(u) { try { await friends.add(u.name); loadFriends(); searchResults.value = []; searchDone.value = false; searchQuery.value = '' } catch(e) { alert(e.message) } }
async function acceptFriend(r) { try { await friends.accept(r.id); loadFriends() } catch(e) { alert(e.message) } }
async function rejectFriend(r) { try { await friends.reject(r.id); loadFriends() } catch(e) { alert(e.message) } }
async function removeFriend(f) { try { await friends.remove(f.id); loadFriends() } catch(e) { alert(e.message) } }

async function loadGroups() { try { const my = await groups.myList(); myGroups.value = my||[]; myGroupIds.value = new Set((my||[]).map(g => g.id)); allGroups.value = (await groups.all())||[] } catch {} }
async function createGroup() { if (!newGroupName.value.trim()) return; try { await groups.create(newGroupName.value.trim()); newGroupName.value = ''; loadGroups() } catch(e) { error.value = e.message } }
async function joinGroup() { if (!inviteCode.value.trim()) return; try { await groups.join(inviteCode.value.trim()); inviteCode.value = ''; loadGroups() } catch(e) { error.value = e.message } }
async function joinById(id) { const g = allGroups.value.find(g => g.id === id); if (g?.invite_code) { try { await groups.join(g.invite_code); loadGroups() } catch(e) { error.value = e.message } } }
function tryJoinOrOpen(g) { if (myGroupIds.value.has(g.id)) router.push('/group/' + g.id) }

onMounted(() => { loadFriends(); loadGroups() })
</script>

<style scoped>
.social-page { display: flex; flex-direction: column; height: 100%; background: var(--bg); }
.social-tabs { display: flex; gap: 0; padding: 8px 12px 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.social-tab { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; background: transparent; color: var(--text3); font-size: 13px; font-family: inherit; font-weight: 300; cursor: pointer; border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; }
.social-tab:hover { color: var(--text2); }
.social-tab.active { color: var(--text); border-bottom-color: var(--accent); }
.social-content { flex: 1; overflow-y: auto; padding: 12px 16px; }
.search-row { margin-bottom: 10px; }
.input-wrap { display: flex; align-items: center; gap: 8px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; transition: border-color .15s; }
.input-wrap:focus-within { border-color: var(--border2); }
.input-wrap input { flex: 1; border: none; outline: none; background: transparent; color: var(--text); font-size: 13px; font-family: inherit; font-weight: 300; }
.input-wrap input::placeholder { color: var(--text3); }
.s-icon { color: var(--text3); flex-shrink: 0; }
.list-section { margin-bottom: 16px; }
.list-label { font-size: 11px; color: var(--text3); font-weight: 400; letter-spacing: .04em; margin-bottom: 6px; }
.list-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius); cursor: pointer; transition: background .12s; }
.list-row:hover { background: var(--bg3); }
.list-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--bg3); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; color: var(--text2); flex-shrink: 0; }
.list-avatar.online { border-color: var(--accent); color: var(--accent); background: var(--accent-muted); }
.list-avatar.group-av { border-radius: var(--radius); }
.list-name { flex: 1; font-size: 13px; font-weight: 300; color: var(--text); }
.list-meta { font-size: 11px; color: var(--text3); font-weight: 300; }
.list-code { font-size: 10px; color: var(--text3); font-family: monospace; }
.list-status { width: 6px; height: 6px; border-radius: 50%; background: var(--text3); flex-shrink: 0; }
.list-status.online { background: var(--green); }
.list-row-actions { display: flex; gap: 6px; }
.act-btn { padding: 4px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: transparent; color: var(--text2); font-size: 11px; font-family: inherit; font-weight: 300; cursor: pointer; transition: all .12s; white-space: nowrap; }
.act-btn:hover { background: var(--bg3); color: var(--text); }
.act-btn.primary { border-color: var(--accent); color: var(--accent); }
.act-btn.primary:hover { background: var(--accent-muted); }
.act-btn.danger:hover { border-color: var(--red); color: var(--red); background: rgba(248,81,73,0.08); }
.act-btn.ghost { border-color: transparent; color: var(--text3); font-size: 10px; }
.empty-msg { font-size: 12px; color: var(--text3); padding: 12px 0; font-weight: 300; }
.error-msg { font-size: 12px; color: var(--red); margin-bottom: 8px; font-weight: 300; }
</style>
