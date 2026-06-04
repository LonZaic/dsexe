<template>
  <div class="ag-page">
    <!-- ═══ Tab bar ═══ -->
    <div class="ag-topbar" v-if="store.openTabs.length">
      <div class="ag-tabs">
        <div
          v-for="tab in store.openTabList"
          :key="tab.id"
          :class="['ag-tab', { active: tab.id === store.currentId }]"
          @click="store.switchTab(tab.id)"
        >
          <span class="ag-tab-title">{{ tab.title || 'Agent 对话' }}</span>
          <button class="ag-tab-close" @click.prevent.stop="closeTab(tab.id)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" pointer-events="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ Chat area ═══ -->
    <div class="ag-chat" ref="chatRef">
      <div v-if="!store.currentId" class="ag-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" class="ag-empty-icon">
          <rect x="4" y="4" width="16" height="13" rx="3" stroke="var(--accent)" stroke-width="1.3"/>
          <circle cx="9" cy="10.5" r="1.8" fill="var(--accent)"/>
          <circle cx="15" cy="10.5" r="1.8" fill="var(--accent)"/>
          <circle cx="8" cy="21" r="1.5" fill="var(--accent)"/>
          <circle cx="16" cy="21" r="1.5" fill="var(--accent)"/>
        </svg>
        <span class="ag-empty-t">{{ t('agentMode') }}</span>
        <span class="ag-empty-s">{{ t('agentDesc') }}</span>
      </div>

      <div v-else class="ag-msgs">
        <template v-for="(m, i) in store.messages" :key="m._id">
          <div v-if="m.role === 'user'" class="ag-msg ag-msg-user">
            <div class="ag-bubble ag-bubble-user">{{ m.text }}</div>
          </div>
          <div v-else-if="m.role === 'agent-progress'" class="ag-msg ag-msg-ai">
            <button v-if="!m.running && m.collapsed" class="ag-summary-btn" @click="m.collapsed = false">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="ag-summary-ok">
                <circle cx="6" cy="6" r="5" stroke="var(--green)" stroke-width="1"/>
                <path d="M3.5 6.2l1.5 1.5 3.5-3.5" stroke="var(--green)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="ag-summary-txt">{{ m.summary }}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="ag-summary-chev">
                <path d="M3 2l4 3-4 3" stroke="var(--text3)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <AgentProgress v-else :events="m.events" :running="m.running" :start-time="m.startTime" />
          </div>
          <div v-else-if="m.role === 'ai'" class="ag-msg ag-msg-ai">
            <div v-if="m.thinking" class="ag-thinking-box">
              <div class="ag-thinking-head" @click="m.thinkingOpen = !m.thinkingOpen">
                <svg :class="['ag-thinking-chev', { open: m.thinkingOpen }]" width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="ag-thinking-label">思考过程</span>
              </div>
              <div v-if="m.thinkingOpen" class="ag-thinking-body">{{ m.thinking }}</div>
            </div>
            <div class="ag-bubble ag-bubble-ai markdown-body" v-html="m.html"></div>
            <div v-if="m.canContinue && i === store.messages.length - 1" class="ag-continue">
              <button class="ag-ctn-btn" @click="continueAgent">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 5-10 5 2.5-5-2.5-5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
                继续
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- ═══ Input ═══ -->
    <div class="ag-bar">
      <div :class="['ag-bar-row', { focus: inputFocused }]">
        <textarea ref="inputRef" v-model="task" :placeholder="agentRunning ? 'Agent 工作中...' : t('askPlaceholder')"
          :disabled="agentRunning" :rows="1" class="ag-input"
          @keydown="onKey" @input="autoResize" @focus="inputFocused = true" @blur="inputFocused = false" />
        <button v-if="agentRunning" class="ag-btn ag-btn-stop" @click="stopAgent">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="2.5" width="9" height="9" rx="1.5" fill="currentColor"/></svg>
        </button>
        <button v-else :class="['ag-btn ag-btn-go', { off: !task.trim() }]" :disabled="!task.trim()" @click="send">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 1.5l11 5.5-11 5.5 3-5.5-3-5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="ag-bar-foot">{{ t('agentMode') }} &middot; deepseek-v4-pro</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '../composables/useI18n.js'
import { renderMarkdown } from '../utils/markdown.js'
import { runAgent, aiChatStream } from '../api/agent.api.js'
import { useAgentConversationStore } from '../stores/agentConversationStore.js'
import AgentProgress from '../components/chat/AgentProgress.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useAgentConversationStore()

const task = ref('')
const inputFocused = ref(false)
const inputRef = ref(null)
const chatRef = ref(null)
const agentRunning = ref(false)

let _abortCtrl = null
let _progDbId = -1
let _aiDbId = -1

onMounted(() => {
  store.restoreSession()
  const qId = route.query.agentConv
  if (qId) {
    store.openConversation(qId)
    router.replace({ query: {} })
  }
})

function scrollDown() {
  nextTick(() => { if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight })
}

function isAgentTask(text) {
  const t = text.trim()
  if (/^(hi|hello|hey|你好|嗨|哈喽|早|晚安|再见|bye|thanks|谢谢|ok|好的|嗯|哦|是的|对|no?pe?|行|可以|知道了)\b/i.test(t)) return false
  if (t.length < 8) return false
  return /(文件|代码|写|创建|新建|修改|编辑|删除|运行|执行|安装|搜索|查找|读取|读|打开|保存|下载|上传|构建|编译|测试|修复|检查|列出|帮忙|帮我|做一个|弄一个|list|read|write|edit|run|build|test|fix|create|delete|search|find|install|make|看|空间|盘|还剩|多少|查)/i.test(t)
}

function collapsePrevious() {
  for (const m of store.messages) {
    if (m.role === 'agent-progress' && !m.running) {
      m.collapsed = true
      if (!m.summary) {
        const d = m.events.find(e => e.type === 'done' || e.type === 'final')
        m.summary = d?.text ? d.text.split(/[.\n]/)[0].slice(0, 60) : '任务完成'
      }
    }
    // Remove continue button from previous results — task is done
    if (m.role === 'ai' && m.canContinue) {
      m.canContinue = false
    }
  }
}

function ensureConv(title) {
  if (!store.currentId) store.createConversation(title)
}

function closeTab(id) {
  store.closeTab(id)
  if (!store.currentId) router.push('/agent')
}

// ═══ Send ═══
async function send() {
  const txt = task.value.trim()
  if (!txt || agentRunning.value) return
  task.value = ''

  ensureConv(txt.slice(0, 30))
  if (store.messages.length === 0) store.renameConversation(store.currentId, txt.slice(0, 40))

  collapsePrevious()

  const userMsg = { _id: 'u_' + Date.now(), role: 'user', text: txt }
  store.pushMessage(userMsg)
  store.addUserMessage(txt)
  scrollDown()

  // ── Chat mode ──
  if (!isAgentTask(txt)) {
    const ai = reactive({ _id: 'a_' + Date.now(), role: 'ai', text: '', html: '', thinking: '', thinkingOpen: true, canContinue: false })
    store.pushMessage(ai)
    const dbId = store.addAiMessage('')
    try {
      await aiChatStream(
        [{ role: 'user', content: txt }], 'deepseek-v4-pro',
        ({ reply, reasoning }) => {
          ai.thinking = reasoning; ai.html = renderMarkdown(reply); scrollDown()
          store.updateMessageText(dbId, reply)
        },
        ({ reply, reasoning }) => {
          ai.thinking = reasoning; ai.html = renderMarkdown(reply || '（无响应）')
          ai.thinkingOpen = false  // auto-collapse when thinking done
          store.updateMessageText(dbId, reply || '（无响应）')
          scrollDown()
        }
      )
    } catch (e) {
      ai.html = renderMarkdown('**出错**: ' + (e.message || '未知'))
      store.updateMessageText(dbId, ai.html)
    }
    return
  }

  // ── Agent mode ──
  agentRunning.value = true
  const prog = reactive({ _id: 'ap_' + Date.now(), role: 'agent-progress', events: [], running: true, startTime: Date.now(), collapsed: false, summary: '' })
  store.pushMessage(prog)
  _progDbId = store.addProgressMessage([])
  scrollDown()

  const aiMsg = reactive({ _id: 'a_' + Date.now(), role: 'ai', text: '', html: '', canContinue: true })
  let aiMsgAdded = false; _aiDbId = -1
  _abortCtrl = new AbortController()
  let finalText = ''

  try {
    await runAgent(txt, 'deepseek-v4-pro', 'default', async (event) => {
      prog.events = [...prog.events, event]
      if (_progDbId > 0) store.updateMessageText(_progDbId, '', JSON.stringify(prog.events))

      if (event.type === 'final_chunk' && event.text) {
        if (!aiMsgAdded) { store.pushMessage(aiMsg); _aiDbId = store.addAiMessage(''); aiMsgAdded = true }
        finalText += event.text; aiMsg.html = renderMarkdown(finalText)
        if (_aiDbId > 0) store.updateMessageText(_aiDbId, finalText)
        await nextTick(); scrollDown()
      } else if ((event.type === 'done' || event.type === 'final') && event.text) {
        if (!aiMsgAdded) { store.pushMessage(aiMsg); _aiDbId = store.addAiMessage(''); aiMsgAdded = true }
        finalText = event.text; aiMsg.html = renderMarkdown(finalText)
        if (_aiDbId > 0) store.updateMessageText(_aiDbId, finalText)
        await nextTick(); scrollDown()
      } else if (event.type === 'error') {
        if (!aiMsgAdded) { store.pushMessage(aiMsg); _aiDbId = store.addAiMessage(''); aiMsgAdded = true }
        aiMsg.html = renderMarkdown('**出错**: ' + (event.text || '未知错误'))
        if (_aiDbId > 0) store.updateMessageText(_aiDbId, aiMsg.html)
      } else { scrollDown() }
    }, _abortCtrl.signal)
  } catch (e) {
    if (e.name !== 'AbortError') {
      if (!aiMsgAdded) { store.pushMessage(aiMsg); _aiDbId = store.addAiMessage(''); aiMsgAdded = true }
      aiMsg.html = renderMarkdown('**出错**: ' + (e.message || '未知'))
      if (_aiDbId > 0) store.updateMessageText(_aiDbId, aiMsg.html)
    }
  }

  prog.running = false
  if (_progDbId > 0) store.updateMessageText(_progDbId, '', JSON.stringify(prog.events))
  agentRunning.value = false; _abortCtrl = null
  scrollDown()
}

// ═══ Continue ═══
async function continueAgent() {
  if (agentRunning.value) return; agentRunning.value = true
  const prog = reactive({ _id: 'ap_' + Date.now(), role: 'agent-progress', events: [], running: true, startTime: Date.now(), collapsed: false, summary: '' })
  store.pushMessage(prog); _progDbId = store.addProgressMessage([]); scrollDown()
  const aiMsg = reactive({ _id: 'a_' + Date.now(), role: 'ai', text: '', html: '', canContinue: true })
  let aiMsgAdded = false; _aiDbId = -1
  _abortCtrl = new AbortController(); let finalText = ''

  try {
    await runAgent('继续完成上述任务', 'deepseek-v4-pro', 'default', async (event) => {
      prog.events = [...prog.events, event]
      if (_progDbId > 0) store.updateMessageText(_progDbId, '', JSON.stringify(prog.events))
      if (event.type === 'final_chunk' && event.text) {
        if (!aiMsgAdded) { store.pushMessage(aiMsg); _aiDbId = store.addAiMessage(''); aiMsgAdded = true }
        finalText += event.text; aiMsg.html = renderMarkdown(finalText)
        if (_aiDbId > 0) store.updateMessageText(_aiDbId, finalText); await nextTick(); scrollDown()
      } else if ((event.type === 'done' || event.type === 'final') && event.text) {
        if (!aiMsgAdded) { store.pushMessage(aiMsg); _aiDbId = store.addAiMessage(''); aiMsgAdded = true }
        finalText = event.text; aiMsg.html = renderMarkdown(finalText)
        if (_aiDbId > 0) store.updateMessageText(_aiDbId, finalText); await nextTick(); scrollDown()
      } else if (event.type === 'error') {
        if (!aiMsgAdded) { store.pushMessage(aiMsg); _aiDbId = store.addAiMessage(''); aiMsgAdded = true }
        aiMsg.html = renderMarkdown('**出错**: ' + (event.text || '未知错误'))
        if (_aiDbId > 0) store.updateMessageText(_aiDbId, aiMsg.html)
      } else { scrollDown() }
    }, _abortCtrl.signal)
  } catch (e) {
    if (e.name !== 'AbortError') {
      if (!aiMsgAdded) { store.pushMessage(aiMsg); _aiDbId = store.addAiMessage(''); aiMsgAdded = true }
      aiMsg.html = renderMarkdown('**出错**: ' + (e.message || '未知'))
      if (_aiDbId > 0) store.updateMessageText(_aiDbId, aiMsg.html)
    }
  }
  prog.running = false
  if (_progDbId > 0) store.updateMessageText(_progDbId, '', JSON.stringify(prog.events))
  agentRunning.value = false; _abortCtrl = null; scrollDown()
}

function stopAgent() {
  if (_abortCtrl) { _abortCtrl.abort(); _abortCtrl = null }
  agentRunning.value = false
  for (const m of store.messages) { if (m.role === 'agent-progress' && m.running) m.running = false }
}
function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
function autoResize() { const el = inputRef.value; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px' }
</script>

<style scoped>
.ag-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

/* tab bar */
.ag-topbar { flex-shrink: 0; padding: 0 18px; border-bottom: 1px solid var(--border); background: var(--bg2); }
.ag-tabs { display: flex; gap: 2px; overflow-x: auto; padding: 4px 0 0; }
.ag-tabs::-webkit-scrollbar { height: 2px; }
.ag-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px 5px; border-radius: 7px 7px 0 0;
  cursor: pointer; font-size: 12px; font-weight: 300; color: var(--text3);
  border: 1px solid transparent; border-bottom: none;
  white-space: nowrap; transition: all .12s;
}
.ag-tab:hover { background: var(--bg3); color: var(--text2); }
.ag-tab.active { background: var(--bg); color: var(--text); border-color: var(--border); }
.ag-tab-title { max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
.ag-tab-close {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 3px; border: none;
  background: transparent; color: var(--text3); cursor: pointer; flex-shrink: 0;
}
.ag-tab-close:hover { background: var(--bg4); color: var(--red); }

/* chat */
.ag-chat { flex: 1; overflow-y: auto; min-height: 0; padding: 18px 22px 8px; }
.ag-chat::-webkit-scrollbar { width: 3px; }
.ag-chat::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }
.ag-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 220px; }
.ag-empty-icon { opacity: .85; }
.ag-empty-t { font-size: 15px; color: var(--text2); font-weight: 400; }
.ag-empty-s { font-size: 12px; color: var(--text3); font-weight: 300; }
.ag-msgs { display: flex; flex-direction: column; gap: 6px; }
.ag-msg-user { display: flex; justify-content: flex-end; margin-top: 18px; }
.ag-msg-user:first-child { margin-top: 0; }
.ag-msg-ai { display: flex; flex-direction: column; }
.ag-bubble { padding: 9px 13px; font-size: 14px; line-height: 1.6; color: var(--text); word-break: break-word; font-weight: 300; max-width: 78%; }
.ag-bubble-user { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-lg); }
.ag-bubble-ai { border-left: 2px solid var(--accent); margin-left: 2px; padding-left: 12px; border-radius: 0 var(--radius) var(--radius) 0; }
.ag-thinking-box { margin-bottom: 6px; border-left: 2px solid var(--accent-muted); border-radius: 0 5px 5px 0; padding-left: 8px; }
.ag-thinking-head { display: flex; align-items: center; gap: 5px; cursor: pointer; user-select: none; padding: 2px 0; }
.ag-thinking-head:hover { color: var(--text2); }
.ag-thinking-chev { color: var(--text3); flex-shrink: 0; transition: transform .15s; }
.ag-thinking-chev.open { transform: rotate(90deg); }
.ag-thinking-label { font-size: 11px; font-weight: 500; color: var(--text3); letter-spacing: .3px; }
.ag-thinking-body { font-size: 12px; line-height: 1.55; color: var(--text3); white-space: pre-wrap; word-break: break-word; padding: 4px 0 2px; max-height: 160px; overflow-y: auto; }
.ag-summary-btn { display: flex; align-items: center; gap: 7px; padding: 7px 10px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg2); color: var(--text2); font: 300 12px var(--font-sans); cursor: pointer; transition: all .12s; width: 100%; text-align: left; }
.ag-summary-btn:hover { background: var(--bg3); border-color: var(--border2); }
.ag-summary-ok { flex-shrink: 0; }
.ag-summary-txt { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-style: italic; color: var(--text3); }
.ag-summary-chev { flex-shrink: 0; opacity: .5; transition: transform .15s; }
.ag-continue { margin-top: 6px; padding-left: 2px; }
.ag-ctn-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg2); color: var(--text2); font: 300 12px var(--font-sans); cursor: pointer; transition: all .12s; }
.ag-ctn-btn:hover { background: var(--bg3); color: var(--text); border-color: var(--border2); }
.ag-bar { flex-shrink: 0; padding: 8px 22px 14px; }
.ag-bar-row { display: flex; align-items: center; gap: 8px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 8px 10px 8px 14px; transition: border-color .15s; }
.ag-bar-row.focus { border-color: var(--accent); box-shadow: 0 0 0 1px rgba(79,125,255,.12); }
.ag-input { flex: 1; resize: none; background: none; color: var(--text); font: 300 14px/1.5 var(--font-sans); padding: 2px 0; min-height: 22px; max-height: 120px; border: none; outline: none; }
.ag-input::placeholder { color: var(--text3); }
.ag-input:disabled { opacity: .4; }
.ag-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-sm); border: none; cursor: pointer; flex-shrink: 0; transition: all .12s; }
.ag-btn-go { background: var(--accent); color: #fff; }
.ag-btn-go:hover:not(.off) { background: var(--accent-hover); }
.ag-btn-go.off { background: var(--bg4); color: var(--text3); cursor: not-allowed; }
.ag-btn-stop { background: var(--red); color: #fff; }
.ag-bar-foot { margin-top: 5px; padding: 0 2px; font: 300 10px var(--font-sans); color: var(--text3); }
</style>
