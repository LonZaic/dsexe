<template>
  <div class="dm-page">
    <div class="dm-header">
      <button class="back-btn" @click="$router.push('/social')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="dm-avatar" :class="{ online: friendStatus === 'online' }">{{ friendName.charAt(0) }}</div>
      <div class="dm-info">
        <span class="dm-name">{{ friendName }}</span>
        <span class="dm-status">{{ friendStatus === 'online' ? '在线' : '离线' }}</span>
      </div>
    </div>

    <div class="dm-messages" ref="msgListRef">
      <div v-if="loading" class="dm-loading">加载中...</div>
      <div v-for="msg in messages" :key="msg._key" :class="['dm-msg', msg._mine ? 'mine' : 'theirs']">
        <div class="dm-bubble" :class="{ ai: msg._isAi }">{{ msg.text }}</div>
      </div>
      <div v-if="streamingText" class="dm-msg theirs">
        <div class="dm-bubble ai">{{ streamingText }}<span class="cursor" /></div>
      </div>
    </div>

    <div class="dm-input-area">
      <div class="dm-input-row">
        <textarea v-model="inputText" placeholder="输入消息，@ds 提问..." @keydown="onKeydown" rows="1" :disabled="sending" />
        <button class="dm-send" @click="sendMessage" :disabled="!inputText.trim() || sending">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M4 6l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { dm, friends, getSavedUser } from '../api/index.js'
import { on as wsOn, send as wsSend } from '../api/ws.js'

const route = useRoute()
const friendId = route.params.userId
const friendName = ref('')
const friendStatus = ref('offline')
const myId = (getSavedUser() || {}).id || ''
const messages = ref([])
const inputText = ref('')
const loading = ref(true)
const sending = ref(false)
const streamingText = ref('')
const msgListRef = ref(null)
const seenIds = new Set()
let _kid = 0
let unsubs = []

function mk() { return 'k_' + (++_kid) }

async function loadData() {
  try {
    const data = await friends.list()
    const f = data.list.find(x => x.id === friendId)
    if (f) { friendName.value = f.name; friendStatus.value = f.status } else friendName.value = friendId
    const msgs = await dm.history(friendId)
    messages.value = []; seenIds.clear()
    for (const m of msgs) { const k = 'h_' + m.id; seenIds.add(k); messages.value.push({ ...m, _mine: m.sender_id === myId, _isAi: !!m.ai_reply && m.sender_id !== myId, _key: k }) }
  } catch { friendName.value = friendId }
  finally { loading.value = false; scrollB() }
}

function scrollB() { nextTick(() => { const el = msgListRef.value; if (el) el.scrollTop = el.scrollHeight }) }

function upsertMessage(m, mine) {
  const dedup = (m.sender_id || 'ai') + '|' + (m.text || '').slice(0, 40) + '|' + (m.created_at || '').slice(0, 16)
  if (seenIds.has(dedup)) return; seenIds.add(dedup)
  const key = mk()
  const ti = messages.value.findIndex(ex => ex._key?.startsWith('t_') && ex.text === m.text && ex.sender_id === m.sender_id)
  if (ti !== -1) messages.value[ti] = { ...m, _mine: mine, _isAi: false, _key: key }
  else messages.value.push({ ...m, _mine: mine, _isAi: false, _key: key })
  scrollB()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value) return
  const dsMatch = text.match(/@ds\s+(.+)/i)
  inputText.value = ''
  wsSend({ type: 'dm', to: friendId, text, aiReply: null })
  if (dsMatch) {
    sending.value = true; streamingText.value = ''
    try {
      const recent = messages.value.slice(-10).map(m => ({ role: m._mine ? 'user' : 'assistant', content: `[${m._mine ? '我' : friendName.value}]: ${m.text}` }))
      const { ai: aiApi } = await import('../api/index.js')
      await aiApi.chatStream(
        [{ role: 'system', content: '你在一个私聊对话中。根据上下文回答，简洁有用。' }, ...recent, { role: 'user', content: dsMatch[1] }],
        'deepseek-v4-flash',
        (full) => { streamingText.value = full; scrollB() },
        (full) => {
          streamingText.value = ''
          const ak = mk(); messages.value.push({ _key: ak, _mine: false, _isAi: true, sender_id: null, receiver_id: friendId, text: '[DS] ' + full, ai_reply: null, created_at: new Date().toISOString() })
          wsSend({ type: 'dm', to: friendId, text: '[DS] ' + full, aiReply: null }); scrollB(); sending.value = false
        },
        (err) => {
          streamingText.value = ''
          messages.value.push({ _key: mk(), _mine: false, _isAi: true, sender_id: null, receiver_id: friendId, text: '[DS] 请求失败: ' + err.message, ai_reply: null, created_at: new Date().toISOString() })
          wsSend({ type: 'dm', to: friendId, text: '[DS] 出了点问题: ' + err.message, aiReply: null }); scrollB(); sending.value = false
        }
      )
    } catch { streamingText.value = '[DS 请求失败]'; sending.value = false }
  }
}

function onKeydown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

function setupWS() {
  unsubs.push(wsOn('dm', (msg) => { const m = msg.message; if (m.sender_id === friendId && m.sender_id !== myId) upsertMessage(m, false) }))
  unsubs.push(wsOn('dm_sent', (msg) => { const m = msg.message; if (m.sender_id === myId) upsertMessage(m, true) }))
  unsubs.push(wsOn('friend_status', (msg) => { if (msg.userId === friendId) friendStatus.value = msg.status }))
}

onMounted(() => { loadData(); setupWS() })
onUnmounted(() => unsubs.forEach(fn => fn()))
</script>

<style scoped>
.dm-page { display: flex; flex-direction: column; height: 100%; background: var(--bg); }
.dm-header { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; height: 52px; }
.back-btn { width: 32px; height: 32px; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.back-btn:hover { background: var(--bg3); color: var(--text); }
.dm-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--bg3); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; color: var(--text2); }
.dm-avatar.online { border-color: var(--accent); color: var(--accent); background: var(--accent-muted); }
.dm-info { display: flex; flex-direction: column; }
.dm-name { font-size: 13px; font-weight: 500; color: var(--text); }
.dm-status { font-size: 11px; color: var(--text3); font-weight: 300; }
.dm-messages { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.dm-loading { text-align: center; color: var(--text3); font-size: 12px; padding: 20px; font-weight: 300; }
.dm-msg { display: flex; max-width: 70%; }
.dm-msg.mine { align-self: flex-end; }
.dm-msg.theirs { align-self: flex-start; }
.dm-bubble { padding: 8px 12px; font-size: 13px; line-height: 1.55; font-weight: 300; border-radius: var(--radius-lg); word-break: break-word; }
.dm-msg.mine .dm-bubble { background: var(--bg3); border: 1px solid var(--border); border-bottom-right-radius: 4px; color: var(--text); }
.dm-msg.theirs .dm-bubble { color: var(--text); border-bottom-left-radius: 4px; }
.dm-bubble.ai { color: var(--accent); }
.cursor { display: inline-block; width: 5px; height: 13px; background: var(--accent); animation: blink .8s infinite; vertical-align: text-bottom; margin-left: 1px; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
.dm-input-area { padding: 8px 12px 10px; border-top: 1px solid var(--border); flex-shrink: 0; }
.dm-input-row { display: flex; align-items: flex-end; gap: 6px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 6px 8px 6px 14px; }
.dm-input-row textarea { flex: 1; resize: none; border: none; outline: none; background: transparent; color: var(--text); font-size: 14px; font-family: inherit; font-weight: 300; line-height: 1.5; padding: 4px 0; min-height: 22px; max-height: 120px; }
.dm-input-row textarea::placeholder { color: var(--text3); }
.dm-send { width: 30px; height: 30px; border-radius: var(--radius-sm); border: none; background: var(--accent); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .12s; flex-shrink: 0; }
.dm-send:hover:not(:disabled) { background: var(--accent-hover); }
.dm-send:disabled { background: var(--bg4); color: var(--text3); cursor: not-allowed; }
</style>
