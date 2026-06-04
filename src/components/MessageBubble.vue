<template>
    <div :class="['msg', role, { streaming }]">
        <div class="body">
            <!-- thinking / reasoning -->
            <div v-if="role === 'ai' && reasoning" class="thinking-box">
                <div class="thinking-head" @click="toggleThinking">
                    <span class="thinking-arrow">{{ thinkingOpen ? 'v' : '>' }}</span>
                    <span class="thinking-label">{{ t('thinkingProcess') }}</span>
                </div>
                <div v-if="thinkingOpen" class="thinking-body">{{ reasoning }}</div>
            </div>
            <!-- file chips (user messages) -->
            <div v-if="role === 'user' && files && files.length" class="file-bar">
                <div
                    v-for="(f, i) in files"
                    :key="i"
                    class="file-chip"
                    :style="fileChipStyle(f.name, f.type)"
                    :title="f.name"
                >
                    <span class="file-chip-name" @click="previewFile(f)">{{ fileLabel(f.name, f.type) }}</span>
                </div>
            </div>

            <!-- ═══ AI with completed designs ═══ -->
            <template v-if="role === 'ai' && designs && designs.length > 0">
                <div v-if="isRealContent" class="bubble markdown-body" v-html="renderedText"></div>
                <div class="design-previews">
                    <div v-for="(d, i) in designs" :key="i" class="design-frame-wrap">
                        <div class="design-device-frame">
                            <div class="design-frame-box" :style="designBoxStyle(d)">
                                <iframe
                                    :srcdoc="d.html"
                                    sandbox="allow-scripts"
                                    scrolling="no"
                                    class="design-iframe"
                                    :style="designIframeStyle(d)"
                                />
                            </div>
                            <button class="design-export-btn" @click="exportDesign(d, i)" :title="t('export')">{{ t('export') }}</button>
                        </div>
                        <div class="design-device-label">{{ deviceLabel(d) }}</div>
                    </div>
                </div>
                <!-- collapsible raw output -->
                <div v-if="rawText" class="raw-output">
                    <div class="raw-output-head" @click="showRaw = !showRaw">
                        <span class="raw-output-arrow">{{ showRaw ? '▼' : '▶' }}</span>
                        <span class="raw-output-label">{{ t('viewGenProcess') }}</span>
                    </div>
                    <div v-if="showRaw" class="raw-output-body">{{ rawText }}</div>
                </div>
            </template>

            <!-- ═══ AI streaming: drawing phase ═══ -->
            <template v-else-if="role === 'ai' && isDrawing">
                <div class="design-drawing">
                    <svg class="design-drawing-icon" viewBox="0 0 24 24" width="14" height="14">
                        <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
                        <line x1="3" y1="8" x2="21" y2="8" stroke="currentColor" stroke-width="1.5"/>
                        <circle cx="8" cy="5.5" r="0.8" fill="currentColor"/>
                    </svg>
                    <span class="design-drawing-label">{{ phaseLabel }}</span>
                </div>
                <!-- collapsible raw output during drawing -->
                <div v-if="rawText" class="raw-output">
                    <div class="raw-output-head" @click="showRaw = !showRaw">
                        <span class="raw-output-arrow">{{ showRaw ? '▼' : '▶' }}</span>
                        <span class="raw-output-label">{{ t('viewGenProcess') }}</span>
                    </div>
                    <div v-if="showRaw" class="raw-output-body">{{ rawText }}</div>
                </div>
            </template>

            <!-- ═══ AI: Agent mode — clean, like drawing mode ═══ -->
            <template v-else-if="role === 'ai' && isAgent">
                <!-- Agent status bar: SVG icon + phase text with light sweep + timer -->
                <div class="agent-status" :class="{ 'agent-done': agentDone }" @click="showAgentLog = !showAgentLog">
                    <svg class="agent-svg" viewBox="0 0 24 24" width="16" height="16" v-if="!agentDone">
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="62" stroke-dashoffset="20">
                            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="3s" repeatCount="indefinite"/>
                        </circle>
                        <circle cx="12" cy="7" r="2" fill="currentColor" opacity="0.6">
                            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                    <svg class="agent-svg" viewBox="0 0 24 24" width="16" height="16" v-else>
                        <circle cx="12" cy="12" r="10" fill="none" stroke="var(--green)" stroke-width="1.5"/>
                        <polyline points="7,12 11,16 17,8" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="agent-phase-text" :class="{ 'agent-shimmer': !agentDone }">{{ agentPhase }}</span>
                    <span class="agent-timer" v-if="!agentDone && agentDuration > 0">{{ formatDuration(agentDuration) }}</span>
                    <span class="agent-timer done" v-else-if="agentDone && agentDuration > 0">{{ formatDuration(agentDuration) }}</span>
                </div>
                <!-- Collapsible tool details (hidden by default, click to see) -->
                <div v-if="showAgentLog && agentToolCalls.length" class="agent-details">
                    <div v-for="(step, i) in agentToolCalls" :key="i" class="agent-step">
                        <span class="agent-step-dot" :class="{ done: step.done }"></span>
                        <span class="agent-step-act">{{ step.label }}</span>
                        <span class="agent-step-det">{{ step.detail }}</span>
                    </div>
                </div>
                <!-- AI's narration text (streaming) -->
                <div v-if="text" class="bubble markdown-body" v-html="renderedText"></div>
                <span v-if="streaming && !text" class="stream-cursor"></span>
            </template>

            <!-- ═══ AI: Device picker (AI requests device selection) ═══ -->
            <template v-else-if="role === 'ai' && devicePicker">
                <div class="device-pick-msg">
                    <div class="device-pick-label">{{ designSummary || t('selectDevice') }}</div>
                    <div class="device-pick-cards">
                        <button
                            v-for="d in DEVICES"
                            :key="d.id"
                            class="device-pick-card"
                            @click="$emit('pickDevice', d)"
                        >
                            <div class="device-pick-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <template v-if="d.id === 'phone'">
                                        <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" stroke-width="1.5"/>
                                        <line x1="9" y1="18" x2="15" y2="18" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                                    </template>
                                    <template v-else-if="d.id === 'tablet'">
                                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
                                        <line x1="9" y1="16" x2="15" y2="16" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                                    </template>
                                    <template v-else-if="d.id === 'desktop'">
                                        <rect x="2" y="2" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
                                        <line x1="12" y1="16" x2="12" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                        <line x1="8" y1="20" x2="16" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                                    </template>
                                    <template v-else>
                                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 2"/>
                                        <line x1="12" y1="8" x2="12" y2="16" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                                        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                                    </template>
                                </svg>
                            </div>
                            <span class="device-pick-name">{{ d.name }}</span>
                            <span class="device-pick-size" v-if="d.w">{{ d.w }}×{{ d.h }}</span>
                        </button>
                    </div>
                    <p class="device-pick-hint">{{ t('selectDevice') }}</p>
                </div>
            </template>

            <!-- ═══ AI normal message (with or without streaming) ═══ -->
            <template v-else-if="role === 'ai'">
                <div class="bubble markdown-body" v-html="renderedText"></div>
                <span v-if="streaming && !text" class="stream-cursor"></span>
            </template>

            <!-- ═══ User message ═══ -->
            <template v-else>
                <div class="bubble">{{ text }}</div>
            </template>

            <!-- branch version navigator -->
            <div v-if="role === 'ai' && !streaming && siblingCount > 1" class="branch-nav">
                <button class="branch-btn" :title="t('prevVersion')" @click="$emit('prevBranch')">&lt;</button>
                <span class="branch-num">{{ siblingIndex }}/{{ siblingCount }}</span>
                <button class="branch-btn" :title="t('nextVersion')" @click="$emit('nextBranch')">&gt;</button>
            </div>
            <div class="msg-actions" v-if="!streaming && text">
                <button v-if="role === 'ai'" :title="t('regenerate')" @click="$emit('regenerate')">⟳</button>
                <button :title="t('copy')" @click="copyText">⎘</button>
                <button v-if="role === 'user'" :title="t('editMsg')" @click="$emit('edit', text)">✎</button>
                <button :title="t('delete')" class="del" @click="$emit('delete')">✕</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { renderMarkdown } from '../utils/markdown.js'
import { loadFile } from '../utils/fileDB.js'
import { fileChipStyle, fileLabel } from '../utils/fileStyles.js'
import { guessDeviceType, DEVICES } from '../utils/designPreview.js'
import { useI18n } from '../composables/useI18n.js'

const { t } = useI18n()

const props = defineProps({
    role: { type: String, required: true },
    text: { type: String, required: true },
    reasoning: { type: String, default: '' },
    files: { type: Array, default: () => [] },
    designs: { type: Array, default: () => [] },
    designProgress: { type: Number, default: 0 },
    rawText: { type: String, default: '' },
    streaming: { type: Boolean, default: false },
    siblingCount: { type: Number, default: 1 },
    siblingIndex: { type: Number, default: 1 },
    agentEvents: { type: Array, default: () => [] },
    devicePicker: { type: Boolean, default: false },
    designSummary: { type: String, default: '' },
})

defineEmits(['regenerate', 'edit', 'delete', 'prevBranch', 'nextBranch', 'pickDevice'])

async function previewFile(f) {
    if (f.type?.startsWith('image/')) {
        let src = f.data
        if (!src && f.key) {
            const blob = await loadFile(f.key)
            if (blob) src = URL.createObjectURL(blob)
        }
        if (src) {
            const w = window.open('', '_blank')
            if (w) w.document.write(`<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:rgba(0,0,0,.9)"><img src="${src}" style="max-width:90vw;max-height:90vh;object-fit:contain"></body></html>`)
        }
    }
}

const thinkingOpen = ref(false)
const userToggled = ref(false)
const showRaw = ref(false)
const showAgentLog = ref(false)

const isAgent = computed(() => {
  return props.agentEvents && props.agentEvents.length > 0
})

const agentDone = computed(() => {
  const evts = props.agentEvents || []
  return evts.some(e => e.type === 'done' || e.type === 'final')
})

const agentDuration = computed(() => {
  const evts = props.agentEvents || []
  const stats = evts.find(e => e.type === 'stats')
  return stats?.duration || 0
})

const agentPhase = computed(() => {
  if (!isAgent.value) return ''
  const evts = props.agentEvents || []

  if (evts.some(e => e.type === 'error')) return t('agentError')
  if (evts.some(e => e.type === 'aborted')) return t('agentAborted')
  if (agentDone.value) return t('agentComplete')

  // Use AI's own thinking text as the phase label (first sentence)
  const thinks = [...evts].reverse().filter(e => e.type === 'thinking')
  if (thinks.length > 0) {
    const t0 = thinks[thinks.length - 1].text?.trim() || ''
    const firstSentence = t0.split(/[。！？\n.!?]/)[0].trim()
    if (firstSentence.length > 2 && firstSentence.length < 80) return firstSentence
  }

  const last = evts[evts.length - 1]
  if (!last) return t('agentAnalyzing')
  if (last.type === 'context') return t('agentUnderstanding')
  if (last.type === 'tool_start') {
    const labels = {
      list_files: t('agentBrowsing'), read_file: t('agentReading'), write_file: t('agentWriting'),
      edit_file: t('agentEditing'), glob: t('agentSearching'), grep: t('agentSearchingCode'),
      run_command: t('agentRunning'), web_search: t('agentWebSearch'),
    }
    return labels[last.tool] || t('agentProcessing')
  }
  return t('agentAnalyzing')
})

const agentToolCalls = computed(() => {
  if (!isAgent.value) return []
  const evts = props.agentEvents || []
  const steps = []
  let toolIdx = 0
  for (const e of evts) {
    if (e.type === 'tool_start') {
      const name = e.tool || ''
      const detail = e.args?.path || e.args?.pattern || e.args?.query || e.args?.command || e.args?.dir || ''
      const labels = { list_files: t('actBrowse'), read_file: t('actRead'), write_file: t('actWrite'), edit_file: t('actEdit'), glob: t('actSearch'), grep: t('actFind'), run_command: t('actRun'), web_search: t('actWeb') }
      steps.push({ label: labels[name]||name, detail, done: true })
      toolIdx++
    }
  }
  // Mark the last step as in-progress if not done
  if (steps.length > 0 && !agentDone.value) {
    steps[steps.length - 1].done = false
  }
  return steps
})

// Auto-open on new steps, close when done
watch(() => props.agentEvents?.length, (n, o) => { if (n > 0 && o === 0) showAgentLog.value = true })
watch(agentDone, (done) => { if (done) { setTimeout(() => { showAgentLog.value = false }, 2000) } })

function formatDuration(ms) {
  if (!ms || ms < 0) return ''
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m${sec}s`
}

watch(() => props.reasoning, (val) => {
    if (val && !props.text && !userToggled.value) {
        thinkingOpen.value = true
    }
})
watch(() => props.text, (val) => {
    if (val && !userToggled.value && !hasDesignText.value) {
        thinkingOpen.value = false
    }
})

function toggleThinking() {
    thinkingOpen.value = !thinkingOpen.value
    userToggled.value = true
}

const hasDesignText = computed(() => {
    return props.designs && props.designs.length > 0
})

const isDrawing = computed(() => {
    return props.streaming && props.designProgress > 0 && props.designProgress < 100
})

const PHASE_LABELS = ['思考中...', '绘制中...', '绘制完成']

const isRealContent = computed(() => {
    const t = (props.text || '').trim()
    return t && !PHASE_LABELS.includes(t)
})

const phaseLabel = computed(() => {
    if (props.designProgress >= 100) return t('drawComplete')
    if (props.designProgress >= 50) return t('drawing')
    if (props.designProgress >= 20) return t('thinkComplete')
    if (props.designProgress >= 10) return t('thinkingDots')
    return t('drawing')
})

const renderedText = computed(() => {
    if (props.role !== 'ai') return ''
    return renderMarkdown(props.text || '')
})

// ─── device helpers ───
function deviceLabel(d) {
    const map = { phone: t('phone'), tablet: t('tablet'), desktop: t('desktop') }
    return map[guessDeviceType(d)] || t('device')
}

const MAX_PREVIEW_W = 400

function designScale(d) {
    const s = Math.min(1, MAX_PREVIEW_W / d.width)
    return { s, w: Math.round(d.width * s), h: Math.round(d.height * s) }
}

function designBoxStyle(d) {
    const scale = designScale(d)
    return { width: scale.w + 'px', height: scale.h + 'px' }
}

function designIframeStyle(d) {
    const scale = designScale(d)
    return { width: d.width + 'px', height: d.height + 'px', transform: 'scale(' + scale.s + ')' }
}

function exportDesign(d, i) {
    const blob = new Blob([d.html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `design-${d.width}x${d.height}-${i + 1}.html`
    a.click()
    URL.revokeObjectURL(url)
}

async function copyText() {
    try {
        await navigator.clipboard.writeText(props.text)
    } catch {
        const ta = document.createElement('textarea')
        ta.value = props.text
        ta.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
    }
}
</script>

<style scoped>
.msg {
    display: flex;
    align-items: flex-start;
    max-width: 78%;
    padding: 6px 0;
}
.msg.user {
    margin-left: auto;
    max-width: 65%;
    justify-content: flex-end;
}
.body { position: relative; min-width: 0; }
.bubble {
    padding: 10px 14px; font-size: 14px; line-height: 1.6;
    color: var(--text); word-break: break-word;
    background: transparent; border-radius: var(--radius);
    font-weight: 300;
}
.msg.user .bubble {
    background: var(--bg3); border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    width: fit-content;
    max-width: 100%;
}
.msg.ai .body {
    border-left: 2px solid var(--accent);
    padding-left: 14px;
}
.msg.ai .bubble {
    border-radius: var(--radius);
}

/* ─── thinking / reasoning ─── */
.thinking-box { border-left: 2px solid var(--accent-muted); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; margin-bottom: 6px; padding-left: 8px; }
.thinking-head { display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; padding: 2px 0; }
.thinking-head:hover { color: var(--text2); }
.thinking-arrow { font-size: 10px; width: 10px; flex-shrink: 0; color: var(--text3); }
.thinking-label { font-size: 11px; font-weight: 600; color: var(--text3); letter-spacing: 0.3px; }
.thinking-body {
    font-size: 12px; line-height: 1.55; color: var(--text3);
    white-space: pre-wrap; word-break: break-word; padding: 4px 0 2px;
    max-height: 180px; overflow-y: auto;
}

/* ─── branch version ─── */
.branch-nav { display: flex; align-items: center; gap: 5px; margin-top: 3px; }
.branch-btn {
    height: 20px; border-radius: var(--radius-sm); font-family: inherit; padding: 0 5px; font-size: 10px;
    border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg2);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    color: var(--text3); transition: background 0.1s;
}
.branch-btn:hover { background: var(--bg3); color: var(--text); }
.branch-num { font-size: 10px; color: var(--text3); min-width: 24px; text-align: center; }

/* ─── file chips ─── */
.file-bar { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; justify-content: flex-end; }
.file-chip {
    display: flex; align-items: center; gap: 3px;
    padding: 3px 8px; font-size: 11px; border: 1px solid; height: 24px; border-radius: var(--radius-full);
}
.file-chip-name { cursor: pointer; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ─── stream cursor ─── */
.stream-cursor { display: inline-block; width: 6px; height: 14px; margin-left: 2px; background: var(--primary); animation: blink 0.8s infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }

/* ─── agent scan shine ─── */
/* Streaming bubble — subtle, no blue block */
.msg.ai.streaming .bubble {
  position: relative;
  overflow: hidden;
}
/* Only a very subtle shimmer on the text side */
.msg.ai.streaming .bubble::after {
  content: '';
  position: absolute;
  top: 0; left: -50%;
  width: 25%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
  animation: textSweep 2.5s ease-in-out infinite;
  pointer-events: none;
}

/* ─── message actions ─── */
.msg-actions { display: flex; gap: 3px; margin-top: 3px; opacity: 0; transition: opacity 0.12s; }
.msg.user .msg-actions { justify-content: flex-end; }
.body:hover .msg-actions { opacity: 1; }
.msg-actions button {
    height: 24px; border-radius: var(--radius-full); padding: 0 8px; font-size: 11px;
    border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg2);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    color: var(--text3); transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.msg-actions button:hover { background: var(--bg3); color: var(--text); }
.msg-actions button.del:hover { border-color: var(--red); color: var(--red); }

/* ═══════════════════════════════
   Design preview
   ═══════════════════════════════ */

.design-previews {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.design-frame-wrap {
    /* no animation — avoid replay on VirtualList re-render */
}

/* ─── device frame: simple 1px line, no notch/titlebar ─── */
.design-device-frame {
    position: relative;
    display: inline-block;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    overflow: hidden;
    transition: border-color 0.2s;
}
.design-frame-box { overflow: hidden; max-width: 100%; }
.design-iframe { border: none; display: block; transform-origin: 0 0; }

/* ─── export button: bottom-right inside frame, no fill ─── */
.design-export-btn {
    position: absolute;
    bottom: 4px; right: 4px;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    background: var(--bg);
    color: var(--text3);
    font-size: 10px; cursor: pointer;
    padding: 1px 6px;
    opacity: 0;
    transition: opacity 0.15s, color 0.15s, border-color 0.15s;
}
.design-device-frame:hover .design-export-btn { opacity: 1; }
.design-export-btn:hover { color: var(--text); border-color: var(--border); }

/* ─── device label ─── */
.design-device-label {
    display: block;
    font-size: 10px; font-weight: 600;
    color: var(--text2);
    margin-top: 3px; letter-spacing: 0.3px;
}

/* ═══════════════════════════════
   Drawing indicator — text only, no border box
   ═══════════════════════════════ */

.design-drawing {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
}
.design-drawing-icon {
    color: var(--text3);
    animation: drawingPulse 1.5s ease-in-out infinite;
}
@keyframes drawingPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
}
.design-drawing-label {
    font-size: 12px;
    color: var(--text2);
}

/* ─── Agent status bar — clean, like drawing mode ─── */
.agent-status {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px; margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer; user-select: none;
  transition: background 0.2s;
}
.agent-status:hover { background: var(--bg3); }
.agent-status.agent-done { cursor: default; }
.agent-svg { flex-shrink: 0; color: var(--primary); width: 16px; height: 16px; }
.agent-done .agent-svg { color: var(--green); }
.agent-phase-text {
  flex: 1; font-size: 12px; font-weight: 500; color: var(--text2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
/* Light sweep on text only — no blue block */
.agent-shimmer {
  position: relative;
}
.agent-shimmer::after {
  content: '';
  position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  animation: textSweep 2s ease-in-out infinite;
}
@keyframes textSweep {
  0% { left: -60%; }
  100% { left: 120%; }
}
.agent-timer {
  font-size: 10px; color: var(--text3); flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.agent-timer.done { color: var(--green); }

/* Collapsible tool details */
.agent-details {
  margin: 2px 0 6px 24px; padding: 4px 8px;
  border-left: 1px solid var(--border);
  max-height: 160px; overflow-y: auto;
}
.agent-step {
  display: flex; align-items: baseline; gap: 6px;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 10px; line-height: 1.5; padding: 2px 0;
  opacity: 0.6;
}
.agent-step-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--primary); flex-shrink: 0; margin-top: 4px;
}
.agent-step-dot.done { background: var(--text3); }
.agent-step-act { color: var(--text2); flex-shrink: 0; }
.agent-step-det { color: var(--text3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ═══════════════════════════════
   Collapsible raw output viewer
   ═══════════════════════════════ */

.raw-output {
    margin-top: 6px;
}
.raw-output-head {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    user-select: none;
    padding: 2px 0;
}
.raw-output-head:hover { color: var(--text2); }
.raw-output-arrow {
    font-size: 9px; width: 10px; flex-shrink: 0;
    color: var(--text3);
}
.raw-output-label {
    font-size: 11px; font-weight: 600;
    color: var(--text3); letter-spacing: 0.3px;
}
.raw-output-body {
    margin-top: 4px;
    max-height: 180px;
    overflow-y: auto;
    font-size: 11px; line-height: 1.5;
    white-space: pre-wrap; word-break: break-word;
    color: var(--text3);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: 8px;
    background: var(--bg2);
}

/* ═══ Device picker in chat ═══ */
.device-pick-msg {
    padding: 4px 0;
}
.device-pick-label {
    font-size: 13px; color: var(--text); font-weight: 400;
    margin-bottom: 10px;
}
.device-pick-cards {
    display: flex; gap: 8px; flex-wrap: wrap;
}
.device-pick-card {
    display: flex; flex-direction: column; align-items: center;
    gap: 5px; padding: 10px 14px;
    border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--bg2); color: var(--text2);
    font-size: 12px; font-family: inherit; font-weight: 300;
    cursor: pointer; transition: all .15s;
    min-width: 72px;
}
.device-pick-card:hover { background: var(--bg3); border-color: var(--accent); color: var(--text); }
.device-pick-icon { color: var(--text3); transition: color .15s; }
.device-pick-card:hover .device-pick-icon { color: var(--accent); }
.device-pick-name { font-weight: 400; }
.device-pick-size { font-size: 10px; color: var(--text3); }
.device-pick-hint { font-size: 11px; color: var(--text3); margin-top: 8px; margin-bottom: 0; }
</style>
