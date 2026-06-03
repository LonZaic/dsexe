<template>
    <div class="chat-area">

            <AgentPanel ref="agentPanelRef" :visible="agentPanelVisible" :events="agentEvents" @close="agentPanelVisible = false" />

            <VirtualList ref="virtualListRef" :items="store.visibleMessages" :estimated-height="60" key-field="id">
                <template #item="{ item }">
                    <MessageBubble
                        :role="item.role"
                        :text="item.text"
                        :reasoning="item.reasoning || ''"
                        :files="item.files || []"
                        :designs="item.designs || []"
                        :design-progress="item.designProgress || 0"
                        :raw-text="item._rawText || ''"
                        :streaming="item.id === store.streamingId"
                        :agent-events="item._agentEvents || []"
                        :sibling-count="item.role === 'ai' ? store.siblingInfo(item.parent_id, item.id).count : 1"
                        :sibling-index="item.role === 'ai' ? store.siblingInfo(item.parent_id, item.id).index : 1"
                        :device-picker="item._devicePicker || false"
                        :design-summary="item._designSummary || ''"
                        @regenerate="regenerate"
                        @edit="onEditMessage(item)"
                        @delete="onDeleteMessage(item)"
                        @prev-branch="store.switchBranch(item.parent_id, 'prev')"
                        @next-branch="store.switchBranch(item.parent_id, 'next')"
                        @pick-device="onPickDevice(item, $event)"
                    />
                </template>
            </VirtualList>

            <!-- Professional Input Bar -->
            <InputBar
                ref="inputBarRef"
                v-model="inputText"
                :is-running="!!agentRunningMap[store.currentId] || store.isLoadingFor(store.currentId)"
                :files="pendingFiles"
                :web-search="webSearchEnabled"
                :thinking-depth="thinkingDepth"
                :model="agentMode ? 'deepseek-v4-pro' : store.model"
                :placeholder="t('askPlaceholder')"
                @send="onInputSend"
                @stop="stopGeneration"
                @toggle-web-search="webSearchEnabled = !webSearchEnabled"
                @update:thinking-depth="thinkingDepth = $event"
                @add-file="onFilesAdded"
                @remove-file="removeFile"
                @paste="onPaste"
                @toggle-model-menu="showModelMenu = !showModelMenu"
            />

            <!-- Image preview overlay -->
            <div v-if="previewSrc" class="preview-overlay" @click.self="previewSrc = null">
                <button class="preview-close" @click="previewSrc = null">
                    <AppIcon name="x" :size="16" />
                </button>
                <img :src="previewSrc" class="preview-img" />
            </div>

            <!-- Code Panel (Claude Artifacts style) -->
            <CodePanel
                :visible="codePanelVisible"
                :tabs="codePanelTabs"
                @close="codePanelVisible = false"
            />
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../store/chatStore.js'
import { useDebounce } from '../composables/useDebounce.js'
import { saveFile, loadFile } from '../utils/fileDB.js'
import { extractFileContent } from '../utils/extractFile.js'
import { fileChipStyle, fileLabel } from '../utils/fileStyles.js'
import { getEmailTools, getDesignTool, classifyIntent } from '../utils/functionCalling.js'
import { buildDesignPrompt, parseDesignBlocks, cleanDesignMarkers, cleanDesignMarkersStreaming, hasOpenDesignBlock, guessDeviceType, extractFirstHtmlBlock, extractRawHtml } from '../utils/designPreview.js'
import { initEmailScheduler } from '../utils/email.js'
import VirtualList from '../components/VirtualList.vue'
import MessageBubble from '../components/MessageBubble.vue'
import AgentPanel from '../components/AgentPanel.vue'
import InputBar from '../components/layout/InputBar.vue'
import CodePanel from '../components/chat/CodePanel.vue'
import AppIcon from '../components/common/AppIcon.vue'

import { useI18n } from '../composables/useI18n.js'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useChatStore()
const inputText = ref('')
const { debounced } = useDebounce(inputText, 400)
const virtualListRef = ref(null)
const textareaRef = ref(null)
const fileInput = ref(null)
const previewSrc = ref(null)
const agentPanelVisible = ref(false)
const agentEvents = ref([])
const agentPanelRef = ref(null)
const inputBarRef = ref(null)
const codePanelVisible = ref(false)
const codePanelTabs = ref([])
const showModelMenu = ref(false)

// ═══ Per-tab state — isolated via component :key on tab switch ═══
const pendingFiles = ref([])
const webSearchEnabled = ref(false)
const thinkingDepth = ref('medium')
const agentMode = ref(false)
const showDeviceBar = ref(false)
const selectedDevice = ref(null)
const pendingDesignText = ref('')

function getAgentMode() { return agentMode.value }
function getPendingDesignText() { return pendingDesignText.value }
function setPendingDesignText(val) { pendingDesignText.value = val }
function setShowDeviceBar(val) { showDeviceBar.value = val }

// Persistent across tab switches (agent runs in background)
const agentAbortMap = {}
const agentRunningMap = {}
const agentTimerMap = {}
const agentTimerNow = ref(0)
let agentTimerInterval = null

// ─── tab colors: rainbow cycle ───
const TAB_COLORS = ['#e03131', '#e8590c', '#f08c00', '#2f9e44', '#1971c2', '#7048e8', '#c2255c']
function tabColor(index) {
    return TAB_COLORS[index % TAB_COLORS.length]
}

function newTab() {
    if (!store.apikey) {
        alert('请先输入 API Key')
        return
    }
    const id = 'conv_' + Date.now()
    store.createConversation(id)
    router.push('/chat/' + id)
}

function switchToTab(id) {
    if (id !== store.currentId) {
        store.switchTab(id)
        router.push('/chat/' + id)
    }
}

function closeTab(id) {
    const idx = store.openTabs.indexOf(id)
    store.closeTab(id)
    // navigate to adjacent tab or home
    if (store.currentId === id) {
        const tabs = store.openTabs
        if (tabs.length > 0) {
            const next = tabs[Math.min(idx, tabs.length - 1)]
            switchToTab(next)
        } else {
            router.push('/')
        }
    }
}

onMounted(() => {
    store.loadApiKey()
    store.loadConversations()
    if (route.params.id) {
        store.switchTab(route.params.id)
    }
    initEmailScheduler()
})

watch(() => route.params.id, (newId) => {
    if (newId && newId !== store.currentId) {
        store.switchTab(newId)
    }
})

watch(
    () => store.visibleMessages.length,
    async () => {
        const atBottom = virtualListRef.value?.isAtBottom() ?? true
        await nextTick()
        if (atBottom && virtualListRef.value) {
            virtualListRef.value.scrollToBottom()
        }
    }
)

watch(
    () => {
        const msgs = store.visibleMessages
        if (msgs.length === 0) return ''
        return msgs[msgs.length - 1].text
    },
    async () => {
        if (!store.isLoadingFor(store.currentId)) return
        const atBottom = virtualListRef.value?.isAtBottom() ?? true
        if (!atBottom) return
        await nextTick()
        if (virtualListRef.value) {
            virtualListRef.value.scrollToBottom()
        }
    }
)

watch(debounced, (val) => {
    if (val.trim()) {
        console.log('用户停下来了，输入的是:', val)
    }
})

function onKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        send()
    }
}

function autoResize() {
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function onPaste(e) {
    const items = e.clipboardData?.items
    if (!items) return
    const files = []
    for (const item of items) {
        if (item.kind === 'file') {
            files.push(item.getAsFile())
        }
    }
    if (files.length) {
        e.preventDefault()
        onFiles({ target: { files, value: '' } })
    }
}

// ─── file helpers ───
function pickFile() { fileInput.value?.click() }

async function onFiles(e) {
    const raw = e.target.files
    if (!raw?.length) return
    for (const f of raw) {
        const key = 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
        const cat = detectCat(f)
        let content = ''
        if (cat === 'image') {
            content = await readAsDataURL(f)
        } else if (isTextLike(f.name)) {
            content = await readAsText(f)
        } else {
            content = await extractFileContent(f) || ''
        }
        const blob = new Blob([await readAsBuffer(f)], { type: f.type || 'application/octet-stream' })
        const dataUrl = cat === 'image' ? content : URL.createObjectURL(blob)
        await saveFile(key, blob)
        const files = pendingFiles.value
        files.push({
            name: f.name, type: f.type || guessType(f.name),
            size: f.size, key, data: dataUrl, content,
        })
        pendingFiles.value = (files)
    }
    fileInput.value.value = ''
}

function detectCat(f) {
    if (f.type?.startsWith('image/')) return 'image'
    return guessType(f.name)
}

function isTextLike(name) {
    const ext = name.split('.').pop()?.toLowerCase()
    return ['txt','js','ts','py','html','css','json','xml','md','yml','yaml','sh','bat','c','cpp','h','java','go','rs','rb','php','sql','csv','log','ini','cfg','toml'].includes(ext)
}

function readAsText(file) {
    return new Promise((resolve) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.onerror = () => resolve('')
        r.readAsText(file)
    })
}

function readAsDataURL(file) {
    return new Promise((resolve) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.onerror = () => resolve('')
        r.readAsDataURL(file)
    })
}

function readAsBuffer(file) {
    return new Promise((resolve) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.onerror = () => resolve(new ArrayBuffer(0))
        r.readAsArrayBuffer(file)
    })
}

function guessType(name) {
    const ext = name.split('.').pop()?.toLowerCase()
    return ext || 'other'
}

function removeFile(i) {
    const files = pendingFiles.value
    const f = files[i]
    if (f?.data) URL.revokeObjectURL(f.data)
    files.splice(i, 1)
    pendingFiles.value = (files)
}

function previewFile(f) {
    if (f.type?.startsWith('image/')) {
        previewSrc.value = f.data
    } else {
        const w = window.open('', '_blank')
        if (w) {
            w.document.write(`<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#111;color:#fff;font-family:monospace;font-size:14px"><p>${f.name}<br>${formatSize(f.size)}</p></body></html>`)
        }
    }
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
}

function pickDevice(d) {
    if (d.id === 'custom') {
        const val = prompt('输入设备尺寸，格式: 宽x高，例如 1024x768')
        if (!val) return
        const parts = val.split(/[x×X,，\s]+/)
        const w = parseInt(parts[0]) || 800
        const h = parseInt(parts[1]) || 600
        selectedDevice.value = ({ name: `自定义 (${w}x${h})`, w, h })
    } else {
        selectedDevice.value = (d)
    }
    setShowDeviceBar(false)
    if (getPendingDesignText()) {
        const text = getPendingDesignText()
        setPendingDesignText('')
        inputText.value = ''
        _doSend(text)
    }
}

async function send() {
    const text = inputText.value.trim()
    const hasFiles = pendingFiles.value.length > 0
    if (!text && !hasFiles) return
    // Only block if THIS conversation's agent is running
    if (agentRunningMap[store.currentId]) return
    // Reset textarea height
    if (textareaRef.value) textareaRef.value.style.height = 'auto'

    // Agent mode ON → always use agent
    if (getAgentMode()) {
        await sendToAgent(text)
        return
    }

    // Auto-detect: "continue" after agent → re-engage agent
    const isContinuation = /^(继续|接着|继续做|接着做|go on|continue|next|下一步|还没|没有完成|没完成|还没做完|继续完成|还有|接着干|继续干)/i.test(text)
    // Check last 3 messages for agent activity (not just last one)
    const recentMsgs = store.visibleMessages.slice(-3)
    const wasAgentRecently = recentMsgs.some(m => (m._agentEvents && m._agentEvents.length > 0) || (m.text && m.text.includes('[Agent]')))
    // Also check if last user message was an agent task
    const lastUserMsgs = store.visibleMessages.filter(m => m.role === 'user')
    const lastUserWasAgent = lastUserMsgs.length > 0 && lastUserMsgs[lastUserMsgs.length-1].text?.startsWith('[Agent]')
    if (isContinuation && (wasAgentRecently || lastUserWasAgent)) {
        await sendToAgent(text)
        return
    }

    // Classify intent via function calling before deciding flow
    try {
        const result = await classifyIntent(text, store.apikey)
        if (result.intent === 'design') {
            inputText.value = ''
            const files = pendingFiles.value.map(f => ({
                name: f.name, type: f.type, size: f.size, key: f.key, content: f.content || '',
            }))
            pendingFiles.value = ([])
            showDesignPicker(text, result.summary, files)
            return
        }
    } catch (e) {
        console.warn('[classify] failed, fallback to normal chat:', e.message)
    }

    _doSend(text)
}

// Show device picker after AI confirms design intent
function showDesignPicker(userText, summary, files = []) {
    const convId = store.currentId
    store.addUserMessage(userText, files)

    // Directly push a device picker AI message (no DB, in-memory only)
    const msgs = store.messagesMap[convId] || []
    const userMsgs = msgs.filter(m => m.role === 'user')
    const parentId = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].id : null
    const pickerId = '_picker_' + Date.now()

    const pickerMsg = {
        role: 'ai',
        text: summary || userText.slice(0, 30),
        reasoning: '',
        id: pickerId,
        parent_id: parentId,
        designs: [],
        _devicePicker: true,
        _designSummary: summary || userText.slice(0, 30),
    }

    msgs.push(pickerMsg)
    store.messagesMap[convId] = [...msgs]

    // Update branch state so visibleMessages includes the picker
    if (parentId != null) {
        const bs = store.branchStateMap[convId] || {}
        bs[parentId] = pickerId
        store.branchStateMap[convId] = { ...bs }
    }

    store.setLoading(false, convId)
}

// ─── InputBar integration handlers ───
function onInputSend(text) {
  inputText.value = text
  send()
}

function onFilesAdded(newFiles) {
  onFiles({ target: { files: newFiles, value: '' } })
}

// ─── Parse code blocks from AI messages for CodePanel ───
function parseCodeBlocks(text) {
  if (!text) return []
  const blocks = []
  const regex = /```(\w+)?\s*\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const lang = match[1] || 'text'
    const code = match[2].trim()
    if (code) {
      blocks.push({
        language: lang,
        code,
        filename: lang === 'html' ? 'preview.html'
          : lang === 'css' ? 'style.css'
          : lang === 'js' || lang === 'javascript' ? 'script.js'
          : lang === 'py' || lang === 'python' ? 'script.py'
          : lang === 'ts' || lang === 'typescript' ? 'module.ts'
          : `code.${lang}`,
      })
    }
  }
  return blocks
}

// Watch visible messages for code blocks → open in panel
watch(
  () => store.visibleMessages.map(m => m.text).join(''),
  () => {
    const msgs = store.visibleMessages
    if (!msgs.length) return
    const lastAi = [...msgs].reverse().find(m => m.role === 'ai' && !m.streaming)
    if (!lastAi) return
    const blocks = parseCodeBlocks(lastAi.text)
    if (blocks.length && !codePanelVisible.value) {
      codePanelTabs.value = blocks
      // Auto-open only if not already viewing
    }
  },
  { deep: false }
)

async function sendToAgent(task) {
    if (!store.apikey) { alert('请先输入 API Key'); return }
    const convId = store.currentId

    // Simple chat? → route to normal AI, not agent
    const isSimple = !/写|创建|生成|做|改|项目|代码|帮我|文件|build|create|make|fix|重构|开发|搭建|实现|部署|配置|安装|搜索|查找|读|看|列出|运行|测试|检查|修复|改一下|改改|修改|增加|添加|删除|去掉|换|替换|改成|帮忙|弄|搞/i.test(task)
    if (isSimple && task.length < 50) {
        inputText.value = ''
        if (textareaRef.value) textareaRef.value.style.height = 'auto'
        store.addUserMessage(task, [])
        const tempId = store.startStreamReply(convId)
        store.setLoading(true, convId)
        try {
            const msgs = [{ role: 'system', content: '你是一个AI助手。简洁友好地回答用户问题。' }]
            const prev = store.visibleMessages.filter(m => m.id !== tempId).slice(-10)
            for (const m of prev) {
                msgs.push({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })
            }
            msgs.push({ role: 'user', content: task })
            const { ai } = await import('../api/index.js')
            await ai.chatStream(msgs, 'deepseek-v4-flash',
                (full) => store.appendStreamText(tempId, full),
                (full) => { store.updateStreamCleanText(tempId, full); store.finishStreamReply(tempId); store.setLoading(false, convId) },
                (err) => { store.updateStreamCleanText(tempId, 'Error: ' + err.message); store.finishStreamReply(tempId); store.setLoading(false, convId) }
            )
        } catch (e) {
            store.updateStreamCleanText(tempId, 'Error: ' + e.message)
            store.finishStreamReply(tempId)
            store.setLoading(false, convId)
        }
        return
    }

    // Mark this conversation as having an agent running
    agentRunningMap[convId] = true
    agentTimerMap[convId] = Date.now()
    startAgentTimer()

    store.addUserMessage('[Agent] ' + task, [])
    inputText.value = ''
    if (textareaRef.value) textareaRef.value.style.height = 'auto'
    store.setLoading(true, convId)

    const tempId = store.startStreamReply(convId)
    agentEvents.value = []
    agentPanelVisible.value = true
    if (agentPanelRef.value) agentPanelRef.value.start()

    // Create abort controller for THIS agent run
    const abortCtrl = new AbortController()
    agentAbortMap[convId] = abortCtrl

    let logText = ''
    let finalStreamedText = ''
    function push(t) { logText += t; store.updateStreamCleanText(tempId, logText) }
    const collected = []
    try {
        const res = await fetch('/api/agent/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('bbot_token'),
                'x-api-key': store.apikey,
                'x-permission-mode': store.permissionMode || 'default',
            },
            body: JSON.stringify({ task, model: 'deepseek-v4-pro' }),
            signal: abortCtrl.signal
        })
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed.startsWith('data:')) continue
                let evt
                try { evt = JSON.parse(trimmed.slice(5).trim()) } catch { continue }
                collected.push(evt)
                agentEvents.value = [...collected]
                store.updateStreamAgentEvents(tempId, collected)
                // AI's real-time narration
                if (evt.type === 'thinking' && evt.text) {
                    if (!logText) push(evt.text)
                    else push('\n\n' + evt.text)
                } else if (evt.type === 'final_chunk' && evt.text) {
                    // Stream the final result word by word
                    finalStreamedText += evt.text
                    store.updateStreamCleanText(tempId, finalStreamedText)
                } else if (evt.type === 'error') {
                    push('\n\n出错了: ' + evt.text)
                }
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            push('\n\nTask paused')
            collected.push({ type: 'aborted', text: '任务已被用户暂停' })
            store.updateStreamCleanText(tempId, (logText || '') + '\n\n_Task paused_')
        } else {
            push('\n\nerror: ' + e.message)
            collected.push({ type: 'error', text: e.message })
        }
        agentEvents.value = [...collected]
        store.updateStreamAgentEvents(tempId, collected)
    }

    store.setLoading(false, convId)

    // Use streamed final output if available, otherwise fall back to logText
    const finalEvt = collected.find(e => e.type === 'done' || e.type === 'final')
    if (finalStreamedText && finalStreamedText.length > 5) {
        store.updateStreamCleanText(tempId, finalStreamedText)
    } else if (finalEvt && finalEvt.text && finalEvt.text.length > 5) {
        store.updateStreamCleanText(tempId, finalEvt.text)
    } else if (logText) {
        store.updateStreamCleanText(tempId, logText)
    }
    store.finishStreamReply(tempId)

    // Clean up agent state for this conversation
    delete agentRunningMap[convId]
    delete agentAbortMap[convId]
    delete agentTimerMap[convId]
    if (Object.keys(agentRunningMap).length === 0) {
        stopAgentTimer()
    }
    agentPanelVisible.value = false
}

async function _doSend(text) {
    const isFirstExchange = (store.messagesMap[store.currentId] || []).filter(m => m.role === 'user').length === 0

    const files = pendingFiles.value.map(f => ({
        name: f.name, type: f.type, size: f.size, key: f.key, content: f.content || '',
    }))

    const deviceInfo = selectedDevice.value
    const isDesign = !!deviceInfo
    const finalText = isDesign ? buildDesignPrompt(text, deviceInfo) : text

    const displayText = isDesign
        ? `[设计] ${text}\n[设备] ${deviceInfo.name} (${deviceInfo.w}x${deviceInfo.h})`
        : text
    store.addUserMessage(displayText, files)
    const userMsgs = (store.messagesMap[store.currentId] || []).filter(m => m.role === 'user')
    const lastUserMsg = userMsgs[userMsgs.length - 1]
    if (lastUserMsg && isDesign) {
        lastUserMsg._apiText = finalText
        lastUserMsg._displayText = displayText
        lastUserMsg._device = deviceInfo
    }

    // Fire title generation immediately (don't wait for stream)
    if (isFirstExchange) {
        generateTitle(text || (files[0]?.name || '文件'), store.currentId)
    }

    inputText.value = ''
    pendingFiles.value = ([])
    if (textareaRef.value) textareaRef.value.style.height = 'auto'

    await callStreamAPI(files, isDesign, isDesign, deviceInfo)

    // Finalize design extraction
    const aiMsgs = (store.messagesMap[store.currentId] || []).filter(m => m.role === 'ai')
    const aiMsg = aiMsgs[aiMsgs.length - 1]
    if (aiMsg && isDesign) {
        if (!aiMsg.designs || !aiMsg.designs.length) {
            const rawText = aiMsg._rawText || ''
            let designs = parseDesignBlocks(rawText)
            if (!designs.length) {
                const mdBlock = extractFirstHtmlBlock(rawText)
                if (mdBlock) designs = [{ width: deviceInfo.w, height: deviceInfo.h, html: mdBlock }]
            }
            if (!designs.length) {
                const html = extractRawHtml(rawText)
                if (html) designs = [{ width: deviceInfo.w, height: deviceInfo.h, html }]
            }
            if (designs.length) aiMsg.designs = designs
        }
        aiMsg.text = ''
        aiMsg.designProgress = 0
    }

    selectedDevice.value = (null)
}

function buildMessages(tempId) {
    const prevMsgs = store.visibleMessages.filter(m => m.id !== tempId)
    const msgs = [{ role: 'system', content: '你是一个AI助手。当用户要求设计、创建或绘制网页/UI界面（页面、组件、登录页、仪表盘、导航栏、按钮、表单、布局等）时，你必须调用 request_design_preview 函数让用户选择设备，然后等用户选了再生成代码。禁止直接输出HTML/CSS。简单问答和代码逻辑正常回答即可。用户上传文件时，文件名和内容会附在消息中。支持 Markdown 格式。' }]
    for (const m of prevMsgs) {
        if (m.role === 'user') {
            let content = m._apiText || m.text || ''
            for (const f of (m.files || [])) {
                if (f.type?.startsWith('image/')) {
                    content += `\n[图片: ${f.name}]`
                } else if (f.content) {
                    content += `\n[文件: ${f.name}]\n${f.content}`
                } else {
                    content += `\n[文件: ${f.name}]`
                }
            }
            msgs.push({ role: 'user', content })
        } else {
            msgs.push({ role: 'assistant', content: m.text })
        }
    }
    return msgs
}

async function doStream(msgs, tempId, tools, isDesign = false, deviceW = 375, deviceH = 667, abortCtrl = null) {
    // Force V4 Pro for design tasks — better quality, reasoning support
    const model = isDesign ? 'deepseek-v4-pro' : store.model
    const body = { model, stream: true, messages: msgs }
    if (tools && tools.length) {
        body.tools = tools
        body.tool_choice = 'auto'
    }

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + store.apikey },
        body: JSON.stringify(body),
        signal: (abortCtrl || {}).signal,
    })

    if (!res.ok) {
        let errMsg = `HTTP ${res.status}`
        try { const d = await res.json(); errMsg = d.error?.message || d.error || errMsg } catch {}
        throw new Error(errMsg)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let fullText = '', fullReasoning = '', buffer = ''
    const toolCallMap = {}
    let contentStarted = false

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data:')) continue
            const payload = trimmed.slice(5).trim()
            if (payload === '[DONE]') continue
            try {
                const parsed = JSON.parse(payload)
                const delta = parsed.choices?.[0]?.delta
                if (delta?.reasoning_content) {
                    fullReasoning += delta.reasoning_content
                    store.appendStreamReasoning(tempId, fullReasoning)
                    if (isDesign) {
                        store.updateStreamCleanText(tempId, '思考中...')
                        store.appendStreamDesignProgress(tempId, 10)
                    }
                }
                if (delta?.content) {
                    fullText += delta.content

                    if (isDesign) {
                        const designs = parseDesignBlocks(fullText)
                        const hasOpenDesign = hasOpenDesignBlock(fullText)

                        if (designs.length > 0) {
                            store.updateStreamCleanText(tempId, '绘制完成')
                            store.updateStreamDesign(tempId, designs)
                            store.updateStreamRawText(tempId, fullText)
                            store.appendStreamDesignProgress(tempId, 100)
                        } else if (fullText.length > 500 && !hasOpenDesign) {
                            const fallbackHtml = extractFirstHtmlBlock(fullText) || extractRawHtml(fullText)
                            if (fallbackHtml) {
                                const d = { width: deviceW, height: deviceH, html: fallbackHtml }
                                store.updateStreamCleanText(tempId, '绘制完成')
                                store.updateStreamDesign(tempId, [d])
                                store.updateStreamRawText(tempId, fullText)
                                store.appendStreamDesignProgress(tempId, 100)
                            } else {
                                store.updateStreamCleanText(tempId, '绘制中...')
                                store.updateStreamRawText(tempId, fullText)
                                store.appendStreamDesignProgress(tempId, 50)
                            }
                        } else if (!hasOpenDesign && fullText.length < 300) {
                            contentStarted = true
                            store.updateStreamCleanText(tempId, '思考完成')
                            store.updateStreamRawText(tempId, fullText)
                            store.appendStreamDesignProgress(tempId, 20)
                        } else {
                            store.updateStreamCleanText(tempId, '绘制中...')
                            store.updateStreamRawText(tempId, fullText)
                            store.appendStreamDesignProgress(tempId, 50)
                        }
                    } else {
                        const hasDesign = fullText.includes('[DESIGN')
                        const designs = parseDesignBlocks(fullText)

                        if (designs.length > 0) {
                            const clean = cleanDesignMarkers(fullText)
                            store.updateStreamCleanText(tempId, clean || ' ')
                            store.updateStreamDesign(tempId, designs)
                            store.appendStreamDesignProgress(tempId, 100)
                        } else if (hasDesign && hasOpenDesignBlock(fullText)) {
                            const clean = cleanDesignMarkersStreaming(fullText)
                            store.updateStreamCleanText(tempId, clean || ' ')
                            store.appendStreamDesignProgress(tempId, 50)
                        } else {
                            store.appendStreamText(tempId, fullText)
                        }
                    }
                }
                if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        const idx = tc.index
                        if (!toolCallMap[idx]) toolCallMap[idx] = { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } }
                        if (tc.id) toolCallMap[idx].id = tc.id
                        if (tc.function?.name) toolCallMap[idx].function.name += tc.function.name
                        if (tc.function?.arguments) toolCallMap[idx].function.arguments += tc.function.arguments
                    }
                }
            } catch {}
        }
    }
    const toolCalls = Object.values(toolCallMap).filter(tc => tc.id && tc.function.name)
    return { text: fullText, reasoning: fullReasoning, toolCalls }
}

async function callStreamAPI(files = [], skipEmail = false, isDesign = false, device = null) {
    const convId = store.currentId
    store.setLoading(true, convId)
    const tempId = store.startStreamReply()
    const abortCtrl = new AbortController()
    store.setAbortController(abortCtrl, convId)

    if (isDesign) {
        store.updateStreamCleanText(tempId, '思考中...')
        store.appendStreamDesignProgress(tempId, 10)
    }

    try {
        const msgs = buildMessages(tempId)
        const { tools, executors } = skipEmail ? { tools: [], executors: {} } : getEmailTools()
        // Always include design detection function
        const designTool = getDesignTool()
        const allTools = [...tools, designTool]

        const dw = device?.w || 375
        const dh = device?.h || 667
        const first = await doStream(msgs, tempId, allTools, isDesign, dw, dh, abortCtrl)
        let finalText = first.text

        // Check if AI called the design function → show device picker
        const designCall = first.toolCalls.find(tc => tc.function?.name === 'request_design_preview')
        if (designCall) {
            let args = {}
            try { args = JSON.parse(designCall.function.arguments) } catch {}
            const summary = args.summary || ''
            // Replace stream message with device picker
            store.updateStreamCleanText(tempId, '')
            store.updateStreamDesign(tempId, [])
            store.updateStreamRawText(tempId, '')
            store.updateStreamAgentEvents(tempId, [])
            store.finishStreamReply(tempId)
            store.setLoading(false, convId)
            // Mark last AI message as device picker
            const realId = store._lastFinishedId
            if (realId) {
                const msgs = store.messagesMap[convId] || []
                const msg = msgs.find(m => m.id === realId)
                if (msg) {
                    msg._devicePicker = true
                    msg._designSummary = summary
                    msg.text = summary
                }
            }
            return
        }

        // Handle email tool calls
        if (first.toolCalls.length > 0 && tools.length > 0) {
            const tc = first.toolCalls.find(t => t.function?.name !== 'request_design_preview')
            if (tc) {
                let args = {}
                try { args = JSON.parse(tc.function.arguments) } catch {}

                const executor = executors[tc.function.name]
                if (executor) {
                    const result = await executor(args)
                    msgs.push({ role: 'assistant', content: first.text || null, tool_calls: [tc] })
                    msgs.push({ role: 'tool', tool_call_id: tc.id, name: tc.function.name, content: result })

                    store.appendStreamText(tempId, '')
                    store.appendStreamReasoning(tempId, first.reasoning)
                    const second = await doStream(msgs, tempId, [], isDesign, dw, dh, abortCtrl)
                    finalText = second.text
                }
            }
        }

        store.finishStreamReply(tempId)
    } catch (e) {
        if (e.name === 'AbortError') {
            store.finishStreamReply(tempId)
        } else {
            store.updateStreamCleanText(tempId, '请求失败: ' + e.message)
            store.finishStreamReply(tempId)
        }
    } finally {
        store.setLoading(false, convId)
        store.setAbortController(null, convId)
    }
}

function stopGeneration() {
    const convId = store.currentId
    // Abort agent if running
    if (agentAbortMap[convId]) {
        agentAbortMap[convId].abort()
        delete agentAbortMap[convId]
    }
    // Abort normal stream for THIS conversation
    store.abort(convId)
}

// ─── Agent timer ───
function startAgentTimer() {
    if (agentTimerInterval) return
    agentTimerInterval = setInterval(() => {
        agentTimerNow.value = Date.now()
    }, 1000)
}
function stopAgentTimer() {
    if (agentTimerInterval) {
        clearInterval(agentTimerInterval)
        agentTimerInterval = null
    }
}
function getAgentDuration(convId) {
    const start = agentTimerMap[convId]
    if (!start) return 0
    return Date.now() - start
}

// User clicked a device card in the chat → continue AI with device context
async function onPickDevice(pickerMsg, device) {
    const convId = store.currentId
    // Replace the picker message text with selected device info
    pickerMsg._devicePicker = false
    pickerMsg.text = `已选择设备：${device.name}（${device.w}×${device.h}）`
    pickerMsg._designSummary = ''
    store.messagesMap[convId] = [...(store.messagesMap[convId] || [])]

    // Get the user's original design request (last user message)
    const msgs = store.messagesMap[convId] || []
    const userMsgs = msgs.filter(m => m.role === 'user')
    const lastUser = userMsgs[userMsgs.length - 1]
    const designText = lastUser ? (lastUser._apiText || lastUser.text) : ''

    // Send design request with device context
    const dev = device.w ? device : { ...device, w: 375, h: 667 }
    const finalText = buildDesignPrompt(designText, dev)
    store.setLoading(true, convId)
    const tempId = store.startStreamReply()
    const abortCtrl = new AbortController()
    store.setAbortController(abortCtrl, convId)
    store.updateStreamCleanText(tempId, '思考中...')
    store.appendStreamDesignProgress(tempId, 10)

    try {
        const msgs2 = buildMessages(tempId)
        // Override last user message with the design prompt
        for (let i = msgs2.length - 1; i >= 0; i--) {
            if (msgs2[i].role === 'user') { msgs2[i].content = finalText; break }
        }
        const first = await doStream(msgs2, tempId, [], true, dev.w, dev.h, abortCtrl)
        let final = first.text
        store.finishStreamReply(tempId)

        // Extract designs
        const aiMsgs = store.messagesMap[convId] || []
        const aiMsg = aiMsgs[aiMsgs.length - 1]
        if (aiMsg) {
            const rawText = aiMsg._rawText || ''
            let designs = parseDesignBlocks(rawText)
            if (!designs.length) {
                const mdBlock = extractFirstHtmlBlock(rawText)
                if (mdBlock) designs = [{ width: dev.w, height: dev.h, html: mdBlock }]
            }
            if (!designs.length) {
                const html = extractRawHtml(rawText)
                if (html) designs = [{ width: dev.w, height: dev.h, html }]
            }
            if (designs.length) aiMsg.designs = designs
            aiMsg.text = ''
            aiMsg.designProgress = 0
        }
    } catch (e) {
        if (e.name !== 'AbortError') {
            store.updateStreamCleanText(tempId, '请求失败: ' + e.message)
            store.finishStreamReply(tempId)
        }
    } finally {
        store.setLoading(false, convId)
        store.setAbortController(null, convId)
    }
}

// Pick device for pre-send flow (legacy bar — kept for compatibility)
function pickDeviceLegacy(d) {
    if (d.id === 'custom') {
        const val = prompt('输入设备尺寸，格式: 宽x高，例如 1024x768')
        if (!val) return
        const parts = val.split(/[x×X,，\s]+/)
        const w = parseInt(parts[0]) || 800
        const h = parseInt(parts[1]) || 600
        selectedDevice.value = { name: `自定义 (${w}x${h})`, w, h }
    } else {
        selectedDevice.value = d
    }
    showDeviceBar.value = false
    if (pendingDesignText.value) {
        const text = pendingDesignText.value
        pendingDesignText.value = ''
        inputText.value = ''
        _doSend(text)
    }
}

async function regenerate() {
    if (agentRunningMap[store.currentId]) return
    const msgs = store.visibleMessages
    let device = null
    for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user' && msgs[i]._device) {
            device = msgs[i]._device
            break
        }
    }
    selectedDevice.value = (device)
    const isDesign = !!device
    await callStreamAPI([], isDesign, isDesign, device)
}

async function onEditMessage(item) {
    const newText = prompt('编辑消息:', item.text)
    if (newText === null || !newText.trim() || newText.trim() === item.text) return

    store.editMessage(item.id, newText.trim())
    store.truncateAfter(item.id)
    await callStreamAPI([])
}

function onDeleteMessage(item) {
    if (confirm('确定删除这条消息？')) {
        store.removeMessage(item.id)
    }
}

async function generateTitle(userMsg, convId) {
    // Fallback title from first N chars of user input
    const fallback = (userMsg || '新对话').replace(/[\n\r]/g, ' ').slice(0, 15).trim() || '新对话'
    console.log('[Title] generating for:', convId, 'input:', (userMsg || '').slice(0, 30))
    try {
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + store.apikey
            },
            body: JSON.stringify({
                model: store.model,
                messages: [
                    { role: 'system', content: '根据用户的第一条消息生成简短标题（15字以内）。只返回标题本身，不要引号、标点或多余文字。' },
                    { role: 'user', content: userMsg }
                ],
                max_tokens: 30,
                temperature: 0.3,
            })
        })
        if (!res.ok) {
            console.warn('[Title] API failed, using fallback')
            store.updateConvTitle(convId, fallback)
            return
        }
        const data = await res.json()
        const title = data.choices?.[0]?.message?.content?.trim().slice(0, 30)
        if (title) {
            console.log('[Title] got:', title)
            store.updateConvTitle(convId, title)
        } else {
            console.log('[Title] using fallback:', fallback)
            store.updateConvTitle(convId, fallback)
        }
    } catch (e) {
        console.warn('[Title] error, using fallback:', e.message)
        store.updateConvTitle(convId, fallback)
    }
}
</script>

<style scoped>
.chat-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding-top: 12px;
}

/* Preview overlay */
.preview-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.85); z-index: 9999;
  display: flex; align-items: center; justify-content: center;
}
.preview-close {
  position: absolute; top: 16px; right: 16px;
  width: 36px; height: 36px; border-radius: var(--radius);
  border: 1px solid var(--border2); background: var(--bg2); color: var(--text2);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  z-index: 1; transition: background .12s;
}
.preview-close:hover { background: var(--bg3); color: var(--text); }
.preview-img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: var(--radius); }

@media (max-width: 768px) {
  .device-bar { padding: 4px 10px; }
  .device-btn { font-size: 12px; padding: 5px 10px; }
}
</style>
