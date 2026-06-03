<template>
  <div class="app-layout">
    <Sidebar />
    <div class="main-area">
      <div class="chat-header">
        <button class="btn-back" @click="$router.push('/friends')">&lt; 返回</button>
        <span class="status-light" :class="friendStatus"></span>
        <span class="chat-title">{{ friendName }}</span>
        <span class="chat-subtitle">{{ friendStatus === 'online' ? '在线' : '离线' }}</span>
      </div>

      <div class="msg-list" ref="msgListRef">
        <div v-if="loading" class="loading">加载中...</div>
        <div
          v-for="msg in messages"
          :key="msg._key"
          :class="['msg', msg._mine ? 'me' : 'them']"
        >
          <div class="msg-sender">{{ msg._mine ? '我' : friendName }}</div>
          <div class="msg-bubble" :class="{ 'ai-bubble': msg._isAi }">{{ msg.text }}</div>
        </div>
        <div v-if="streamingText" class="msg them">
          <div class="msg-sender">DS</div>
          <div class="msg-bubble ai-bubble">{{ streamingText }}<span class="cursor"></span></div>
        </div>
      </div>

      <div class="input-area">
        <textarea
          v-model="inputText"
          placeholder="输入消息，@ds 提问..."
          @keydown="onKeydown"
          rows="1"
          :disabled="sending"
        ></textarea>
        <button class="btn-send" @click="sendMessage" :disabled="!inputText.trim() || sending">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { dm, friends, getSavedUser } from '../api/index.js'
import { on as wsOn, send as wsSend } from '../api/ws.js'
import Sidebar from '../components/Sidebar.vue'

const route = useRoute()
const friendId = route.params.userId
const friendName = ref('')
const friendStatus = ref('offline')

// Get my ID synchronously from localStorage — never async
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

function makeKey(prefix) { return prefix + '_' + (++_kid) }

async function loadData() {
  try {
    const data = await friends.list()
    const f = data.list.find(x => x.id === friendId)
    if (f) {
      friendName.value = f.name
      friendStatus.value = f.status
    } else {
      friendName.value = friendId
    }
    const msgs = await dm.history(friendId)
    messages.value = []
    seenIds.clear()
    for (const m of msgs) {
      const key = 'h_' + m.id
      seenIds.add(key)
      messages.value.push({
        ...m,
        _mine: m.sender_id === myId,
        _isAi: !!m.ai_reply && m.sender_id !== myId,
        _key: key
      })
    }
  } catch (e) {
    friendName.value = friendId
  } finally {
    loading.value = false
    scrollToBottom()
  }
}

function scrollToBottom() {
  nextTick(() => {
    const el = msgListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/** Insert a message, skipping duplicates by composite key */
function upsertMessage(m, mine) {
  // Build a dedup key from sender + text + time (round to seconds)
  const timekey = (m.created_at || '').slice(0, 16)
  const dedup = (m.sender_id || 'ai') + '|' + (m.text || '').slice(0, 40) + '|' + timekey
  if (seenIds.has(dedup)) return
  seenIds.add(dedup)

  const key = makeKey('m')
  // Remove any temp message with same text and sender
  const tempIdx = messages.value.findIndex(ex =>
    ex._key && ex._key.startsWith('t_') && ex.text === m.text && ex.sender_id === m.sender_id
  )
  if (tempIdx !== -1) {
    messages.value[tempIdx] = { ...m, _mine: mine, _isAi: false, _key: key }
  } else {
    messages.value.push({ ...m, _mine: mine, _isAi: false, _key: key })
  }
  scrollToBottom()
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || sending.value) return

  const dsMatch = text.match(/@ds\s+(.+)/i)
  const hasDS = !!dsMatch

  inputText.value = ''

  // Send via WebSocket only — server echoes back to both sides
  wsSend({ type: 'dm', to: friendId, text, aiReply: null })

  // Handle @ds
  if (hasDS) {
    sending.value = true
    streamingText.value = ''

    try {
      const recentMsgs = messages.value.slice(-10).map(m => ({
        role: m._mine ? 'user' : 'assistant',
        content: `[${m._mine ? '我' : friendName.value}]: ${m.text}`
      }))
      const aiMessages = [
        { role: 'system', content: '你在一个私聊对话中。根据对话上下文回答问题。回答简洁有用。' },
        ...recentMsgs,
        { role: 'user', content: dsMatch[1] }
      ]

      const { ai: aiApi } = await import('../api/index.js')
      await aiApi.chatStream(
        aiMessages,
        'deepseek-v4-flash',
        (fullText) => { streamingText.value = fullText; scrollToBottom() },
        (fullText) => {
          streamingText.value = ''
          const aiKey = makeKey('ai')
          messages.value.push({
            _key: aiKey, _mine: false, _isAi: true,
            sender_id: null, receiver_id: friendId,
            text: '[DS] ' + fullText,
            ai_reply: null, created_at: new Date().toISOString()
          })
          // Broadcast DS reply via WS
          wsSend({ type: 'dm', to: friendId, text: '[DS] ' + fullText, aiReply: null })
          scrollToBottom()
          sending.value = false
        },
        (err) => {
          streamingText.value = ''
          messages.value.push({
            _key: makeKey('er'), _mine: false, _isAi: true,
            sender_id: null, receiver_id: friendId,
            text: '[DS] 请求失败: ' + err.message,
            ai_reply: null, created_at: new Date().toISOString()
          })
          wsSend({ type: 'dm', to: friendId, text: '[DS] 出了点问题: ' + err.message, aiReply: null })
          scrollToBottom()
          sending.value = false
        }
      )
    } catch (e) {
      streamingText.value = '[DS 请求失败]'
      sending.value = false
    }
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function setupWS() {
  // Incoming DM from the OTHER user
  unsubs.push(wsOn('dm', (msg) => {
    const m = msg.message
    if (m.sender_id !== friendId && m.receiver_id !== friendId) return
    // Don't process my own messages (they come via dm_sent)
    if (m.sender_id === myId) return
    upsertMessage(m, false)
  }))

  // Echo from server for MY messages
  unsubs.push(wsOn('dm_sent', (msg) => {
    const m = msg.message
    if (m.sender_id !== myId) return
    upsertMessage(m, true)
  }))

  unsubs.push(wsOn('friend_status', (msg) => {
    if (msg.userId === friendId) friendStatus.value = msg.status
  }))
}

onMounted(() => {
  loadData()
  setupWS()
})

onUnmounted(() => {
  unsubs.forEach(fn => fn())
})
</script>

<style scoped>
.app-layout { display: flex; height: 100vh; height: 100dvh; background: var(--bg); }
.main-area { flex: 1; min-width: 0; display: flex; flex-direction: column; height: 100vh; height: 100dvh; }
.chat-header { height: 48px; padding: 0 16px; display: flex; align-items: center; gap: 10px; border-bottom: 2px solid var(--border); flex-shrink: 0; background: var(--bg); }
.btn-back { border: 1px solid var(--border-light); background: transparent; color: var(--text-secondary); padding: 4px 10px; font-size: 12px; cursor: pointer; }
.btn-back:hover { background: var(--bg-hover); }
.status-light { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; background: var(--text-muted); }
.status-light.online { background: var(--green); }
.chat-title { font-size: 14px; font-weight: 600; color: var(--text); }
.chat-subtitle { font-size: 11px; color: var(--text-muted); }
.msg-list { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; }
.loading { text-align: center; font-size: 12px; color: var(--text-muted); padding: 20px; }
.msg { max-width: 75%; display: flex; flex-direction: column; gap: 2px; }
.msg.me { align-self: flex-end; }
.msg.them { align-self: flex-start; }
.msg-sender { font-size: 10px; font-weight: 600; color: var(--text-muted); letter-spacing: 0.3px; }
.msg-bubble { border: 1px solid var(--border-light); padding: 8px 12px; font-size: 13px; line-height: 1.5; color: var(--text); word-break: break-word; background: var(--bg); }
.msg.me .msg-bubble { background: var(--primary-bg); border-color: var(--primary); }
.ai-bubble { border-color: var(--green); border-left: 3px solid var(--green); }
.cursor { display: inline-block; width: 6px; height: 14px; background: var(--primary); animation: blink 0.8s infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
.input-area { border-top: 2px solid var(--border); padding: 12px 20px; display: flex; gap: 10px; flex-shrink: 0; }
.input-area textarea { flex: 1; border: 1px solid var(--border-light); padding: 8px 12px; font-size: 13px; font-family: inherit; outline: none; resize: none; min-height: 28px; max-height: 100px; background: var(--bg); color: var(--text); }
.input-area textarea:focus { border-color: var(--primary); }
.input-area textarea:disabled { opacity: 0.5; }
.btn-send { border: 1px solid var(--primary); background: var(--primary); color: #fff; padding: 6px 16px; font-size: 13px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
.btn-send:hover:not(:disabled) { background: var(--primary-hover); }
.btn-send:disabled { opacity: 0.4; cursor: not-allowed; }
@media (max-width: 768px) {
  .app-layout { position: fixed; top: 0; left: 0; right: 0; bottom: 0; }
  .chat-header { padding: 0 8px 0 32px; padding-top: env(safe-area-inset-top, 0px); min-height: 44px; gap: 6px; }
  .msg-list { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; gap: 8px; }
  .msg { max-width: 88% !important; }
  .input-area { padding: 8px 12px; padding-bottom: max(12px, env(safe-area-inset-bottom, 0px)); gap: 6px; background: var(--bg); }
  .input-area textarea { font-size: 16px; padding: 10px 12px; }
  .btn-send { min-height: 44px; padding: 10px 14px; font-size: 14px; }
  .btn-back { min-height: 44px; }
}
</style>
