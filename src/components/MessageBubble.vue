<template>
    <div :class="['msg', role, { streaming }]">
        <div class="body">
            <!-- thinking / reasoning -->
            <div v-if="role === 'ai' && reasoning" class="thinking-box">
                <div class="thinking-head" @click="toggleThinking">
                    <svg :class="['thinking-arrow-svg', { open: thinkingOpen }]" width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
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
                        <svg :class="['raw-output-arrow-svg', { open: showRaw }]" width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
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
                        <svg :class="['raw-output-arrow-svg', { open: showRaw }]" width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="raw-output-label">{{ t('viewGenProcess') }}</span>
                    </div>
                    <div v-if="showRaw" class="raw-output-body">{{ rawText }}</div>
                </div>
            </template>

            <!-- ═══ AI: Agent mode — inline progress + narration ═══ -->
            <template v-else-if="role === 'ai' && isAgent">
                <AgentProgress
                    :events="agentEvents"
                    :running="!agentDone"
                    :startTime="agentStartTime"
                />
                <!-- AI's narration text (streaming summary) -->
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
                    <button class="device-pick-undo" @click="$emit('notDesign')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                            <path d="M3 5v5h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        不是设计
                    </button>
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

            <!-- ═══ Download bar (AI generated files) ═══ -->
            <div v-if="role === 'ai' && !streaming && allDownloads.length" class="download-bar">
              <div
                v-for="(f, i) in allDownloads"
                :key="i"
                class="download-chip"
                :style="chipBorderStyle(f.name)"
                :title="f.name + ' (' + formatDownloadSize(f.size) + ')'"
              >
                <AppIcon :name="getDownloadIcon(f.name)" :size="13" class="download-chip-icon" />
                <span class="download-chip-name" @click="downloadOne(f)">{{ f.name }}</span>
                <span class="download-chip-size">{{ formatDownloadSize(f.size) }}</span>
                <button class="download-chip-btn" title="预览" @click.stop="$emit('previewFile', f)">
                  <AppIcon name="eye" :size="14" />
                </button>
                <button class="download-chip-btn" title="下载" @click.stop="downloadOne(f)">
                  <AppIcon name="download" :size="14" />
                </button>
              </div>
            </div>

            <!-- branch version navigator -->
            <div v-if="role === 'ai' && !streaming && siblingCount > 1" class="branch-nav">
                <button class="branch-btn" :title="t('prevVersion')" @click="$emit('prevBranch')">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M7 2L3 5l4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <span class="branch-num">{{ siblingIndex }}/{{ siblingCount }}</span>
                <button class="branch-btn" :title="t('nextVersion')" @click="$emit('nextBranch')">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
            </div>
            <div class="msg-bottom-row" v-if="(role === 'ai' && yammyActive) || (!streaming && text)">
                <div class="msg-actions" v-if="!streaming && text">
                    <button v-if="role === 'ai'" :title="t('regenerate')" @click="$emit('regenerate')">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M1.5 3.5V7.5H5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M11.5 9.5V5.5H7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M10.18 3.73a5 5 0 0 0-7.2-.48L1.5 4.5M11.5 8.5l-1.48 1.25a5 5 0 0 1-7.2-.48" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                    <button :title="t('copy')" @click="copyText">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                        <path d="M2.5 9V2.5A1 1 0 0 1 3.5 1.5H9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                      </svg>
                    </button>
                    <button v-if="role === 'user'" :title="t('editMsg')" @click="$emit('edit', text)">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M9.5 1.5a1 1 0 0 1 1.41 0l.59.59a1 1 0 0 1 0 1.41L5 10l-2.5.5L3 8l6.5-6.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                    <button :title="t('delete')" class="del" @click="$emit('delete')">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2.5 3.5h8M4.5 3.5V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M2 3.5h9v.5a.5.5 0 0 1-.5.5h-.5l-.4 6a.5.5 0 0 1-.5.5H3.9a.5.5 0 0 1-.5-.5l-.4-6H2.5a.5.5 0 0 1-.5-.5V3.5z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                </div>
                <div v-if="role === 'ai' && yammyActive" class="yammy-wrap" :class="{ 'yammy-shaking': yammyShaking }" @click.stop="$emit('yammyClick')">
                    <img ref="yammyImg" src="/yammy.gif" class="yammy-gif" alt="yammy" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { renderMarkdown } from '../utils/markdown.js'
import { loadFile } from '../utils/fileDB.js'
import { fileChipStyle, fileLabel } from '../utils/fileStyles.js'
import { guessDeviceType, DEVICES } from '../utils/designPreview.js'
import { useI18n } from '../composables/useI18n.js'
import AgentProgress from './chat/AgentProgress.vue'
import AppIcon from './common/AppIcon.vue'
import { getFileCategory, getFileIcon, formatSize } from '../utils/filePreview.js'

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
    yammyActive: { type: Boolean, default: false },
    yammyPlaying: { type: Boolean, default: false },
    yammyShaking: { type: Boolean, default: false },
    downloadFiles: { type: Array, default: () => [] },
})

defineEmits(['regenerate', 'edit', 'delete', 'prevBranch', 'nextBranch', 'pickDevice', 'notDesign', 'yammyClick', 'previewFile'])

// ═══ Download bar helpers ═══
const allDownloads = computed(() => {
  return (props.downloadFiles || []).filter(f => f && f.name)
})

function formatDownloadSize(bytes) { return formatSize(bytes) }

function getDownloadIcon(name) { return getFileIcon(name) }

function chipBorderStyle(name) {
  const cat = getFileCategory(name)
  const colors = {
    image: 'rgba(148,163,184,0.3)',
    svg: 'rgba(148,163,184,0.3)',
    html: 'rgba(251,146,60,0.35)',
    code: 'rgba(79,125,255,0.3)',
    pdf: 'rgba(248,81,73,0.3)',
    audio: 'rgba(52,211,153,0.35)',
    video: 'rgba(167,139,250,0.35)',
    binary: 'rgba(148,163,184,0.2)',
    font: 'rgba(96,165,250,0.35)',
  }
  return { borderColor: colors[cat] || 'rgba(255,255,255,0.1)' }
}

function downloadOne(f) {
  if (!f?.url) return
  const a = document.createElement('a')
  a.href = f.url
  a.download = f.name || 'file'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

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

const isAgent = computed(() => {
  return props.agentEvents && props.agentEvents.length > 0
})

const agentDone = computed(() => {
  const evts = props.agentEvents || []
  return evts.some(e => e.type === 'done' || e.type === 'final' || e.type === 'error' || e.type === 'aborted')
})

// Extract start time from events (set by ChatView as first event)
const agentStartTime = computed(() => {
  const evts = props.agentEvents || []
  for (const e of evts) {
    if (e._startTime) return e._startTime
  }
  return 0
})

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

// ─── Yammy GIF pause/play via canvas ───
const yammyImg = ref(null)
const yammyPausedSrc = ref('')

function pauseYammyGif() {
    const img = yammyImg.value
    if (!img || !img.complete) return
    try {
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        yammyPausedSrc.value = c.toDataURL()
        img.src = yammyPausedSrc.value
    } catch {}
}

function playYammyGif() {
    const img = yammyImg.value
    if (!img) return
    img.src = '/yammy.gif?t=' + Date.now()
    yammyPausedSrc.value = ''
}

watch(() => props.yammyPlaying, (playing) => {
    nextTick(() => {
        if (playing) {
            playYammyGif()
        } else {
            pauseYammyGif()
        }
    })
})

watch(() => props.yammyActive, (active) => {
    if (active) {
        nextTick(() => {
            const img = yammyImg.value
            if (img) {
                img.src = '/yammy.gif?t=' + Date.now()
                if (props.yammyPlaying) {
                    // playing — let it animate
                } else {
                    const onLoad = () => { img.removeEventListener('load', onLoad); nextTick(() => pauseYammyGif()) }
                    if (img.complete) pauseYammyGif()
                    else img.addEventListener('load', onLoad)
                }
            }
        })
    }
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
.thinking-arrow-svg { flex-shrink: 0; color: var(--text3); transition: transform 0.15s ease; }
.thinking-arrow-svg.open { transform: rotate(90deg); }
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

/* ─── message actions ─── */
.msg-actions { display: flex; gap: 3px; opacity: 0; transition: opacity 0.12s; }
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
   Download bar (AI generated files)
   ═══════════════════════════════ */
.download-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.download-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255,255,255,0.12);
  background: var(--bg);
  transition: border-color var(--transition-fast), background var(--transition-fast);
  max-width: 100%;
}
.download-chip:hover {
  background: var(--bg3);
  border-color: rgba(255,255,255,0.22);
}
.download-chip-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.download-chip-name {
  font-size: var(--font-size-sm, 12px);
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}
.download-chip-name:hover {
  color: var(--accent);
  text-decoration: underline;
}
.download-chip-size {
  font-size: var(--font-size-xs, 10px);
  color: var(--text-muted);
  flex-shrink: 0;
}
.download-chip-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}
.download-chip-btn:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

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

.raw-output { margin-top: 6px; }
.raw-output-head {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    user-select: none;
    padding: 2px 0;
}
.raw-output-head:hover { color: var(--text2); }
.raw-output-arrow-svg {
    flex-shrink: 0; color: var(--text3); transition: transform 0.15s ease;
}
.raw-output-arrow-svg.open { transform: rotate(90deg); }
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
.device-pick-undo {
    display: inline-flex; align-items: center; gap: 5px;
    margin-top: 10px; padding: 4px 10px;
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    background: transparent; color: var(--text3);
    font-size: 12px; font-family: inherit; cursor: pointer;
    transition: all .15s;
}
.device-pick-undo:hover { border-color: var(--red); color: var(--red); }
</style>
