<template>
  <div class="group-page">
    <div class="group-header">
      <button class="back-btn" @click="$router.push('/social')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="group-info">
        <span class="group-name">{{ groupName }}</span>
        <span class="group-meta">{{ memberCount }}人 · {{ inviteCode }}</span>
      </div>
      <button class="leave-btn" @click="leaveGroup" title="退出群聊">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 1.5H3a.5.5 0 00-.5.5v10a.5.5 0 00.5.5h2M8.5 4l2.5 2.5-2.5 2.5M11 6.5H4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>

    <!-- Agent panel -->
    <div v-if="agentActive" class="agent-panel" :class="{ fold: agentFold }">
      <div class="agent-top" @click="agentFold = !agentFold">
        <span class="a-dot" :class="{ run: agentRun, ok: agentDone, err: agentErr }" />
        <span class="a-title">{{ agentRun ? (agentAct || '处理中...') : (agentErr ? '出错了' : '完成') }}</span>
        <span class="a-round" v-if="agentRun && agentRound">{{ agentRound }}/50</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="a-arr"><path :d="agentFold ? 'M3 2l4 3-4 3' : 'M2 3l3 4 3-4'" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div v-if="!agentFold" class="agent-body" ref="abodyRef">
        <div v-for="(e, i) in agentLog" :key="i" class="a-line" :class="e.type">
          <template v-if="e.type === 'thinking'"><span class="a-txt dim">{{ e.text?.slice(0, 150) }}</span></template>
          <template v-else-if="e.type === 'tool_start'"><span class="a-dots" /><span class="a-act">{{ actMap(e.tool) }}</span><span class="a-det">{{ det(e) }}</span></template>
          <template v-else-if="e.type === 'tool_result' && ok(e.result)"><span class="a-txt dim">{{ e.result?.slice(0, 80) }}</span></template>
          <template v-else-if="e.type === 'error'"><span class="a-txt err">{{ e.text }}</span></template>
          <template v-else-if="e.type === 'done' || e.type === 'final'"><span class="a-txt ok">{{ e.text || '完成' }}</span></template>
        </div>
        <div v-if="agentRun" class="a-scan" />
      </div>
    </div>

    <!-- Messages -->
    <div class="group-msgs" ref="msgRef">
      <div v-if="loading" class="g-loading">加载中...</div>
      <div v-for="m in messages" :key="m._key" :class="['g-msg', m._isAi ? 'ai' : (m._mine ? 'me' : 'them')]">
        <div class="g-sender">{{ m._isAi ? 'DS' : (m._mine ? '我' : (m.sender_name || '?')) }}</div>
        <div class="g-bubble" :class="{ 'ai-b': m._isAi }">{{ m.text }}</div>
      </div>
      <div v-if="dsThinking" class="g-msg ai"><div class="g-sender">DS</div><div class="g-bubble ai-b thinking">{{ dsThinking }}</div></div>
      <div v-if="streamText" class="g-msg ai"><div class="g-sender">DS</div><div class="g-bubble ai-b">{{ streamText }}<span class="cursor" /></div></div>
    </div>

    <!-- Input -->
    <div class="group-input">
      <div class="g-input-row">
        <textarea v-model="input" placeholder="@ds 提问或布置任务..." @keydown="onKey" :disabled="sending" rows="1" />
        <button class="g-send" @click="send" :disabled="!input.trim() || sending">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M4 6l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { groups, getSavedUser } from '../api/index.js'
import { on as wsOn, send as wsSend } from '../api/ws.js'

const route = useRoute(), router = useRouter()
const roomId = route.params.id
const groupName = ref(''), inviteCode = ref(''), memberCount = ref(0)
const myId = (getSavedUser() || {}).id || ''
const messages = ref([]), input = ref(''), loading = ref(true), sending = ref(false)
const streamText = ref(''), dsThinking = ref(''), msgRef = ref(null), abodyRef = ref(null)
const seenIds = new Set(), unsubs = []
let _k = 0
function mk() { return 'k_' + (++_k) }

const agentActive = ref(false), agentRun = ref(false), agentDone = ref(false), agentErr = ref(false)
const agentFold = ref(false), agentRound = ref(0), agentAct = ref('')
const agentLog = ref([])
let _aseen = new Set()

async function load() {
  try {
    const g = await groups.detail(roomId)
    groupName.value = g.name; inviteCode.value = g.invite_code; memberCount.value = g.members?.length || 0
    const ms = await groups.messages(roomId); messages.value = []; seenIds.clear()
    for (const m of ms) { const k = 'h_' + m.id; seenIds.add(k); messages.value.push({ ...m, _mine: m.sender_id === myId, _isAi: !!m.is_ai, _key: k }) }
  } catch { groupName.value = roomId }
  finally { loading.value = false; scrollB() }
}

function scrollB() { nextTick(() => { const e = msgRef.value; if (e) e.scrollTop = e.scrollHeight }) }
function scrollA() { nextTick(() => { const e = abodyRef.value; if (e) e.scrollTop = e.scrollHeight }) }

function upsert(m) {
  const d = (m.sender_id || 'ai') + '|' + (m.text || '').slice(0, 40) + '|' + (m.created_at || '').slice(0, 16)
  if (seenIds.has(d)) return; seenIds.add(d)
  messages.value.push({ ...m, _mine: m.sender_id === myId, _isAi: !!m.is_ai, _key: mk() }); scrollB()
}

function onAgentEvent(evt) {
  if (!agentActive.value) { agentActive.value = true; agentRun.value = true; agentDone.value = false; agentErr.value = false; agentFold.value = false; agentLog.value = []; agentRound.value = 0; _aseen = new Set() }
  const dk = evt.type + '|' + (evt.tool || '') + '|' + (evt.round || '')
  if (_aseen.has(dk)) return; _aseen.add(dk)
  agentLog.value.push(evt)
  if (evt.type === 'round') agentRound.value = evt.round
  if (evt.type === 'tool_start') agentAct.value = actMap(evt.tool)
  if (evt.type === 'done' || evt.type === 'final') { agentRun.value = false; agentDone.value = true }
  if (evt.type === 'error') { agentRun.value = false; agentErr.value = true }
  if (evt.type === 'aborted') { agentRun.value = false; agentDone.value = true }
  scrollA()
}

function onAgentDone(r) {
  agentRun.value = false; agentDone.value = true
  messages.value.push({ _key: mk(), _mine: false, _isAi: true, room_id: roomId, sender_id: null, sender_name: 'DS', text: '[DS-Agent] ' + (r.text || '完成'), is_ai: 1, created_at: new Date().toISOString() })
  scrollB()
}

async function send() {
  const t = input.value.trim(); if (!t || sending.value) return
  input.value = ''
  wsSend({ type: 'group_msg', roomId, text: t, isAi: false })
  const m = t.match(/@ds\s+(.+)/i)
  if (!m) return
  const task = m[1]; sending.value = true
  const apiKey = localStorage.getItem('apikey') || ''
  if (!apiKey) { wsSend({ type: 'group_msg', roomId, text: '[DS] 请先在首页设置 API Key', isAi: true }); sending.value = false; scrollB(); return }
  const complex = task.length > 30 && /写|创建|生成|做|改|项目|代码|帮我|build|create|make|fix|重构|开发|搭建|实现|部署|配置/i.test(task)
  if (complex) {
    dsThinking.value = ''; scrollB()
    try {
      const abortCtrl = new AbortController()
      const r = await fetch('/api/agent/group-run', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('bbot_token'), 'x-api-key': apiKey }, body: JSON.stringify({ task, roomId, model: 'deepseek-v4-pro' }), signal: abortCtrl.signal })
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', firstAck = false
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const l of lines) {
          if (!l.startsWith('data:')) continue
          let evt; try { evt = JSON.parse(l.slice(5).trim()) } catch { continue }
          onAgentEvent(evt)
          if (!firstAck && evt.type === 'thinking' && evt.text) {
            firstAck = true; const ack = evt.text.trim().split(/[。！？\n]/)[0].slice(0, 80)
            if (ack.length > 2) wsSend({ type: 'group_msg', roomId, text: '[DS] ' + ack + '… (查看面板)', isAi: true })
          }
          if (evt.type === 'done' || evt.type === 'final') wsSend({ type: 'group_msg', roomId, text: '[DS] ' + (evt.text ? evt.text.slice(0, 200) : '任务完成'), isAi: true })
        }
      }
    } catch (e) { if (e.name !== 'AbortError') wsSend({ type: 'group_msg', roomId, text: '[DS] Agent 出错: ' + e.message, isAi: true }) }
    finally { sending.value = false; scrollB() }
  } else {
    dsThinking.value = '思考中...'; streamText.value = ''; scrollB()
    try {
      const rMsgs = messages.value.slice(-15).map(x => ({ role: x._isAi ? 'assistant' : 'user', content: '[' + (x._isAi ? 'DS' : (x.sender_name || '?')) + ']: ' + x.text }))
      const { ai } = await import('../api/index.js')
      await ai.chatStream(
        [{ role: 'system', content: '你在开发者群聊中。简洁专业地回答问题，用中文。' }, ...rMsgs, { role: 'user', content: task }],
        'deepseek-v4-flash',
        (full) => { streamText.value = full; scrollB() },
        (full) => { streamText.value = ''; dsThinking.value = ''; wsSend({ type: 'group_msg', roomId, text: '[DS] ' + full, isAi: true }); scrollB(); sending.value = false },
        (err) => { streamText.value = ''; dsThinking.value = ''; wsSend({ type: 'group_msg', roomId, text: '[DS] 出错了: ' + err.message, isAi: true }); scrollB(); sending.value = false }
      )
    } catch (e) { streamText.value = ''; dsThinking.value = ''; wsSend({ type: 'group_msg', roomId, text: '[DS] 请求失败: ' + e.message, isAi: true }); scrollB(); sending.value = false }
  }
  if (sending.value) sending.value = false
}

function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
async function leaveGroup() { if (!confirm('退出群聊？')) return; try { await groups.leave(roomId); router.push('/social') } catch (e) { alert(e.message) } }
function actMap(t) { return ({ list_files: '列举中...', read_file: '读取中...', write_file: '写入中...', edit_file: '编辑中...', glob: '搜索中...', grep: '查找中...', run_command: '执行中...', web_search: '搜索网络...' })[t] || t }
function det(e) { const a = e.args || {}; return a.path || a.pattern || a.query || a.command?.slice(0, 50) || a.dir || '' }
function ok(r) { return r && (r.startsWith('[ERROR]') || r.startsWith('[OK]') || r.startsWith('Error') || r.startsWith('[FILE]') || r.length < 200) }

function setupWS() {
  unsubs.push(wsOn('group_msg', (m) => { if (m.message.room_id === roomId) upsert(m.message) }))
  unsubs.push(wsOn('agent_progress', (m) => { if (m.roomId === roomId && m.event) onAgentEvent(m.event) }))
  unsubs.push(wsOn('agent_done', (m) => { if (m.roomId === roomId && m.result) onAgentDone(m.result) }))
}

onMounted(() => { load(); setupWS() })
onUnmounted(() => unsubs.forEach(f => f()))
</script>

<style scoped>
.group-page { display: flex; flex-direction: column; height: 100%; background: var(--bg); }
.group-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; height: 52px; }
.back-btn { width: 32px; height: 32px; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.back-btn:hover { background: var(--bg3); color: var(--text); }
.group-info { flex: 1; display: flex; flex-direction: column; }
.group-name { font-size: 13px; font-weight: 500; color: var(--text); }
.group-meta { font-size: 11px; color: var(--text3); font-weight: 300; }
.leave-btn { width: 30px; height: 30px; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.leave-btn:hover { background: rgba(248,81,73,0.1); color: var(--red); }

/* Agent panel */
.agent-panel { border: 1px solid var(--border); border-radius: var(--radius); margin: 6px 12px; background: var(--bg2); font-family: var(--font-mono); font-size: 10px; flex-shrink: 0; }
.agent-panel.fold { margin-bottom: 2px; }
.agent-top { display: flex; align-items: center; gap: 6px; padding: 6px 10px; cursor: pointer; user-select: none; }
.agent-top:hover { background: var(--bg3); border-radius: var(--radius) var(--radius) 0 0; }
.a-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text3); flex-shrink: 0; }
.a-dot.run { background: var(--green); animation: pulse 1s infinite; }
.a-dot.ok { background: var(--green); }
.a-dot.err { background: var(--red); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.a-title { flex: 1; font-size: 11px; color: var(--text2); font-weight: 300; }
.a-round { font-size: 10px; color: var(--text3); }
.a-arr { color: var(--text3); flex-shrink: 0; }
.agent-body { max-height: 200px; overflow-y: auto; padding: 4px 8px; display: flex; flex-direction: column; gap: 1px; border-top: 1px solid var(--border); }
.a-line { display: flex; align-items: baseline; gap: 4px; line-height: 1.35; padding: 1px 0; }
.a-dots { width: 3px; height: 3px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 4px; }
.a-act { color: var(--text2); font-weight: 500; }
.a-det { color: var(--text3); font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
.a-txt.dim { color: var(--text3); font-size: 10px; }
.a-txt.err { color: var(--red); }
.a-txt.ok { color: var(--green); }
.a-scan { height: 1px; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: scan .5s ease-in-out infinite; margin-top: 3px; }
@keyframes scan { 0%{opacity:0;transform:translateX(-100%)} 50%{opacity:1} 100%{opacity:0;transform:translateX(100%)} }

/* Messages */
.group-msgs { flex: 1; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
.g-loading { text-align: center; color: var(--text3); font-size: 12px; padding: 20px; font-weight: 300; }
.g-msg { max-width: 72%; display: flex; flex-direction: column; gap: 2px; }
.g-msg.me { align-self: flex-end; }
.g-msg.them { align-self: flex-start; }
.g-msg.ai { align-self: flex-start; max-width: 82%; }
.g-sender { font-size: 10px; font-weight: 500; color: var(--text3); padding-left: 2px; }
.g-bubble { padding: 8px 12px; font-size: 13px; line-height: 1.55; color: var(--text); border-radius: var(--radius-lg); font-weight: 300; word-break: break-word; }
.g-msg.them .g-bubble { border-bottom-left-radius: 4px; }
.g-msg.me .g-bubble { background: var(--bg3); border: 1px solid var(--border); border-bottom-right-radius: 4px; }
.ai-b { border-left: 2px solid var(--accent); background: transparent; border-radius: var(--radius-lg) !important; }
.thinking { font-style: italic; color: var(--text3); }
.cursor { display: inline-block; width: 5px; height: 13px; background: var(--accent); animation: blink .8s infinite; vertical-align: middle; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }

/* Input */
.group-input { padding: 8px 12px 10px; border-top: 1px solid var(--border); flex-shrink: 0; }
.g-input-row { display: flex; align-items: flex-end; gap: 6px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 6px 8px 6px 14px; }
.g-input-row textarea { flex: 1; resize: none; border: none; outline: none; background: transparent; color: var(--text); font-size: 14px; font-family: inherit; font-weight: 300; line-height: 1.5; padding: 4px 0; min-height: 22px; max-height: 90px; }
.g-input-row textarea::placeholder { color: var(--text3); }
.g-send { width: 30px; height: 30px; border-radius: var(--radius-sm); border: none; background: var(--accent); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .12s; flex-shrink: 0; }
.g-send:hover:not(:disabled) { background: var(--accent-hover); }
.g-send:disabled { background: var(--bg4); color: var(--text3); cursor: not-allowed; }
</style>
