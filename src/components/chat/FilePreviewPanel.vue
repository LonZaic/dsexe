<template>
  <Transition name="panel">
    <div v-if="visible" :class="['file-preview-panel', { expanded: isExpanded }]">
      <!-- Loading overlay -->
      <div v-if="loading" class="fp-loading">
        <div class="fp-spinner"></div>
        <span class="fp-loading-text">{{ t('loading') }}</span>
      </div>

      <!-- Header -->
      <div class="panel-header">
        <div class="panel-file-info">
          <AppIcon :name="fileIcon" :size="16" class="fp-file-icon" />
          <span class="fp-filename">{{ file?.name || '' }}</span>
          <span v-if="fileCategory" :class="['fp-category-badge', 'fp-cat-' + fileCategory]">
            {{ categoryLabel }}
          </span>
        </div>
        <div class="panel-actions">
          <button v-if="content && (fileCategory === 'code' || fileCategory === 'svg' || fileCategory === 'html')"
            class="panel-action-btn" :title="t('copy')" @click="copyContent">
            <AppIcon :name="copied ? 'check' : 'copy'" :size="16" />
          </button>
          <button class="panel-action-btn" :title="t('downloadFile')" @click="downloadFile">
            <AppIcon name="download" :size="16" />
          </button>
          <button class="panel-action-btn" :title="isExpanded ? t('collapse') : t('expand')" @click="isExpanded = !isExpanded">
            <AppIcon :name="isExpanded ? 'panel-close' : 'panel-right'" :size="16" />
          </button>
          <button class="panel-action-btn panel-close-btn" :title="t('close')" @click="$emit('close')">
            <AppIcon name="x" :size="16" />
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="panel-body">
        <!-- Image preview -->
        <div v-if="fileCategory === 'image'" class="fp-image-wrap">
          <img :src="previewUrl" :alt="file?.name" class="fp-image" />
        </div>

        <!-- GIF specific - also image but could be animated -->
        <div v-else-if="fileCategory === 'gif'" class="fp-image-wrap">
          <img :src="previewUrl" :alt="file?.name" class="fp-image" />
        </div>

        <!-- SVG preview -->
        <div v-else-if="fileCategory === 'svg'" class="fp-svg-wrap">
          <img :src="previewUrl" :alt="file?.name" class="fp-svg-img" />
        </div>

        <!-- HTML preview -->
        <div v-else-if="fileCategory === 'html'" class="fp-html-wrap">
          <iframe
            :srcdoc="content"
            class="fp-html-frame"
            sandbox="allow-scripts allow-same-origin"
            title="HTML Preview"
          />
        </div>

        <!-- PDF preview -->
        <div v-else-if="fileCategory === 'pdf'" class="fp-pdf-wrap">
          <div class="fp-pdf-info">
            <AppIcon name="file-text" :size="48" />
            <span class="fp-pdf-name">{{ file?.name }}</span>
            <span class="fp-pdf-size">{{ formatSize(file?.size) }}</span>
            <span class="fp-pdf-hint">{{ t('pdfPreviewHint') }}</span>
            <button class="fp-action-btn" @click="openInNewTab">
              <AppIcon name="external-link" :size="15" />
              <span>{{ t('openInBrowser') }}</span>
            </button>
            <button class="fp-action-btn" @click="downloadFile">
              <AppIcon name="download" :size="15" />
              <span>{{ t('downloadFile') }}</span>
            </button>
          </div>
        </div>

        <!-- Code preview -->
        <div v-else-if="fileCategory === 'code'" class="fp-code-view">
          <pre><code
            :class="highlightLang ? 'hljs language-' + highlightLang : ''"
            v-html="highlightedContent"
          /></pre>
        </div>

        <!-- Audio preview -->
        <div v-else-if="fileCategory === 'audio'" class="fp-audio-wrap">
          <div class="fp-media-info">
            <AppIcon name="play" :size="48" />
            <span class="fp-media-name">{{ file?.name }}</span>
            <span class="fp-media-size">{{ formatSize(file?.size) }}</span>
            <audio controls :src="previewUrl" class="fp-audio-player">
              {{ t('audioNotSupported') }}
            </audio>
          </div>
        </div>

        <!-- Video preview -->
        <div v-else-if="fileCategory === 'video'" class="fp-video-wrap">
          <video controls :src="previewUrl" class="fp-video-player">
            {{ t('videoNotSupported') }}
          </video>
        </div>

        <!-- Font preview -->
        <div v-else-if="fileCategory === 'font'" class="fp-font-wrap">
          <div class="fp-font-info">
            <AppIcon name="file-text" :size="48" />
            <span class="fp-font-name">{{ file?.name }}</span>
            <span class="fp-font-size">{{ formatSize(file?.size) }}</span>
            <div class="fp-font-sample" v-if="fontSampleLoaded">
              <p :style="{ fontFamily: fontFamily }">{{ fontSampleText }}</p>
            </div>
            <button class="fp-action-btn" @click="downloadFile">
              <AppIcon name="download" :size="15" />
              <span>{{ t('downloadFile') }}</span>
            </button>
          </div>
        </div>

        <!-- Binary / unknown -->
        <div v-else class="fp-binary-wrap">
          <div class="fp-binary-info">
            <AppIcon :name="fileIcon" :size="48" class="fp-binary-icon" />
            <span class="fp-binary-name">{{ file?.name }}</span>
            <span class="fp-binary-size">{{ formatSize(file?.size) }}</span>
            <span class="fp-binary-hint">{{ binaryHint }}</span>
            <button class="fp-action-btn" @click="downloadFile">
              <AppIcon name="download" :size="15" />
              <span>{{ t('downloadFile') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="panel-footer">
        <span class="footer-info">{{ categoryLabel }} &middot; {{ formatSize(file?.size) || '--' }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { getFileCategory, getHighlightLanguage, getFileIcon, formatSize, escapeHtml } from '../../utils/filePreview.js'
import { FILE_STYLES, fileLabel } from '../../utils/fileStyles.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  file: { type: Object, default: null },  // { name, url, size }
})

const emit = defineEmits(['close'])

const loading = ref(false)
const error = ref('')
const content = ref('')
const contentType = ref('')
const previewUrl = ref('')
const isExpanded = ref(false)
const copied = ref(false)
const highlightLang = ref('')
const highlightedContent = ref('')
const fontFamily = ref('')
const fontSampleLoaded = ref(false)

const fontSampleText = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789 !@#$%^&*()\nThe quick brown fox jumps over the lazy dog.'

let _objectUrl = null
let _fontFaceAdded = false

// ═══ Computed ═══

const fileCategory = computed(() => {
  if (!props.file?.name) return ''
  return getFileCategory(props.file.name)
})

const fileIcon = computed(() => {
  return getFileIcon(props.file?.name || '')
})

const categoryLabel = computed(() => {
  if (!props.file?.name) return ''
  const cat = fileCategory.value
  const labelMap = {
    image: 'Image',
    svg: 'SVG',
    html: 'HTML',
    code: fileLabel(props.file.name),
    pdf: 'PDF',
    audio: 'Audio',
    video: 'Video',
    font: 'Font',
    binary: fileLabel(props.file.name) || 'Binary',
  }
  return labelMap[cat] || fileLabel(props.file.name) || 'File'
})

const binaryHint = computed(() => {
  const ext = (props.file?.name || '').split('.').pop()?.toLowerCase()
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'Archive file — download to extract'
  if (['doc', 'docx'].includes(ext)) return 'Word document — download to open'
  if (['xls', 'xlsx'].includes(ext)) return 'Excel spreadsheet — download to open'
  if (['ppt', 'pptx'].includes(ext)) return 'PowerPoint — download to open'
  if (['exe', 'msi', 'app'].includes(ext)) return 'Executable — download to run'
  return 'Preview not available for this file type'
})

// ═══ Watchers ═══

watch(() => props.visible, async (v) => {
  if (v && (props.file?.url || props.file?.code)) {
    await loadFile()
  } else {
    resetState()
  }
})

watch(() => props.file?.url, async (newUrl) => {
  if (props.visible && (newUrl || props.file?.code)) {
    await loadFile()
  }
})

// ═══ Methods ═══

async function loadFile() {
  loading.value = true
  error.value = ''
  content.value = ''
  previewUrl.value = ''
  highlightedContent.value = ''
  fontSampleLoaded.value = false

  try {
    const cat = fileCategory.value
    const url = props.file.url

    // Inline code preview (no URL, code provided directly)
    if (!url && props.file.code) {
      content.value = props.file.code
      highlightLang.value = getHighlightLanguage(props.file.name || '')
      if (window.hljs && highlightLang.value && window.hljs.getLanguage(highlightLang.value)) {
        try {
          highlightedContent.value = window.hljs.highlight(props.file.code, { language: highlightLang.value }).value
        } catch {
          highlightedContent.value = escapeHtml(props.file.code)
        }
      } else {
        highlightedContent.value = escapeHtml(props.file.code)
      }
      loading.value = false
      return
    }

    if (!url) {
      loading.value = false
      error.value = 'No content available'
      return
    }

    if (cat === 'image' || cat === 'svg') {
      // For images/SVG, fetch as blob for object URL (also works for remote)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      _cleanObjectUrl()
      _objectUrl = URL.createObjectURL(blob)
      previewUrl.value = _objectUrl
      if (cat === 'svg') {
        // Also load text content for potential copy
        content.value = await blob.text()
      }
    } else if (cat === 'audio' || cat === 'video') {
      // For audio/video, use the URL directly
      previewUrl.value = url
    } else if (cat === 'font') {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      _cleanObjectUrl()
      _objectUrl = URL.createObjectURL(blob)
      previewUrl.value = _objectUrl

      // Try to load font for preview
      const ext = (props.file.name || '').split('.').pop()?.toLowerCase()
      const familyName = 'fp-font-' + Date.now()
      try {
        const fontFace = new FontFace(familyName, await blob.arrayBuffer())
        await fontFace.load()
        document.fonts.add(fontFace)
        fontFamily.value = familyName
        _fontFaceAdded = familyName
        fontSampleLoaded.value = true
      } catch {
        fontSampleLoaded.value = false
      }
    } else {
      // Text-based: code, HTML, PDF info, etc.
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      content.value = text

      if (cat === 'code') {
        highlightLang.value = getHighlightLanguage(props.file.name)
        if (window.hljs && highlightLang.value && window.hljs.getLanguage(highlightLang.value)) {
          try {
            highlightedContent.value = window.hljs.highlight(text, { language: highlightLang.value }).value
          } catch {
            highlightedContent.value = escapeHtml(text)
          }
        } else {
          highlightedContent.value = escapeHtml(text)
        }
      }
    }

    loading.value = false
  } catch (e) {
    error.value = e.message
    loading.value = false
  }
}

function resetState() {
  loading.value = false
  error.value = ''
  content.value = ''
  contentType.value = ''
  _cleanObjectUrl()
  if (_fontFaceAdded && document.fonts) {
    try { document.fonts.delete(fontFamily.value) } catch {}
    _fontFaceAdded = false
  }
  previewUrl.value = ''
  isExpanded.value = false
  copied.value = false
  fontSampleLoaded.value = false
  fontFamily.value = ''
}

function _cleanObjectUrl() {
  if (_objectUrl) {
    URL.revokeObjectURL(_objectUrl)
    _objectUrl = null
  }
}

async function copyContent() {
  if (!content.value) return
  try {
    await navigator.clipboard.writeText(content.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

function downloadFile() {
  if (!props.file?.url) return
  const a = document.createElement('a')
  a.href = props.file.url
  a.download = props.file.name || 'file'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function openInNewTab() {
  if (!props.file?.url) return
  window.open(props.file.url, '_blank')
}

onUnmounted(() => {
  _cleanObjectUrl()
  if (_fontFaceAdded && document.fonts) {
    try { document.fonts.delete(fontFamily.value) } catch {}
  }
})

// ═══ I18n ═══
const L = {
  loading: { zh: '加载中...', en: 'Loading...' },
  copy: { zh: '复制', en: 'Copy' },
  downloadFile: { zh: '下载', en: 'Download' },
  expand: { zh: '展开', en: 'Expand' },
  collapse: { zh: '收起', en: 'Collapse' },
  close: { zh: '关闭', en: 'Close' },
  openInBrowser: { zh: '浏览器打开', en: 'Open in browser' },
  pdfPreviewHint: { zh: 'PDF 无法直接预览，请下载后用本地应用打开', en: 'PDF preview not available — download to view' },
  audioNotSupported: { zh: '您的浏览器不支持此音频格式', en: 'Audio format not supported' },
  videoNotSupported: { zh: '您的浏览器不支持此视频格式', en: 'Video format not supported' },
}
const lang = computed(() => document.documentElement.lang || 'zh')
function t(key) {
  const entry = L[key]
  if (!entry) return key
  return entry[lang.value] || entry.zh || key
}
</script>

<style scoped>
/* ═══ Panel ═══ */
.file-preview-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: var(--panel-width, 420px);
  height: 100vh;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: var(--z-sticky, 100);
  box-shadow: var(--shadow-lg);
}

.file-preview-panel.expanded {
  width: 65vw;
}

/* ═══ Loading ═══ */
.fp-loading {
  position: absolute;
  inset: 0;
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 10;
}
.fp-spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: fpSpin 0.7s linear infinite;
}
@keyframes fpSpin {
  to { transform: rotate(360deg); }
}
.fp-loading-text {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

/* ═══ Header ═══ */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
  min-height: 44px;
  flex-shrink: 0;
}
.panel-file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.fp-file-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.fp-filename {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fp-category-badge {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.fp-cat-image { background: rgba(148,163,184,0.15); color: #94a3b8; }
.fp-cat-svg { background: rgba(148,163,184,0.15); color: #94a3b8; }
.fp-cat-html { background: rgba(251,146,60,0.15); color: #fb923c; }
.fp-cat-code { background: var(--accent-muted); color: var(--accent); }
.fp-cat-pdf { background: rgba(255,69,58,0.12); color: var(--red); }
.fp-cat-audio { background: rgba(52,211,153,0.15); color: #34d399; }
.fp-cat-video { background: rgba(167,139,250,0.15); color: #a78bfa; }
.fp-cat-font { background: rgba(96,165,250,0.15); color: #60a5fa; }
.fp-cat-binary { background: rgba(148,163,184,0.1); color: var(--text-muted); }

/* Actions */
.panel-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: var(--space-2);
}
.panel-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.panel-action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.panel-close-btn:hover {
  background: var(--red-muted);
  color: var(--red);
}

/* ═══ Body ═══ */
.panel-body {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
}

/* ─── Image ─── */
.fp-image-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background:
    repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 50% / 20px 20px;
}
.fp-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

/* ─── SVG ─── */
.fp-svg-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background:
    repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 50% / 20px 20px;
}
.fp-svg-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* ─── HTML ─── */
.fp-html-wrap {
  height: 100%;
}
.fp-html-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

/* ─── PDF ─── */
.fp-pdf-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fp-pdf-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  text-align: center;
  padding: var(--space-6);
}
.fp-pdf-name {
  font-size: var(--font-size-base);
  color: var(--text-primary);
  font-weight: 500;
  word-break: break-all;
}
.fp-pdf-size {
  font-size: var(--font-size-sm);
}
.fp-pdf-hint {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  max-width: 280px;
}

/* ─── Code ─── */
.fp-code-view {
  height: 100%;
}
.fp-code-view pre {
  margin: 0;
  padding: var(--space-4);
  height: 100%;
  overflow: auto;
}
.fp-code-view code {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
  color: var(--text-primary);
}

/* ─── Audio / Video ─── */
.fp-audio-wrap, .fp-video-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}
.fp-media-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  text-align: center;
  max-width: 320px;
  width: 100%;
}
.fp-media-name {
  font-size: var(--font-size-base);
  color: var(--text-primary);
  font-weight: 500;
  word-break: break-all;
}
.fp-media-size {
  font-size: var(--font-size-sm);
}
.fp-audio-player {
  width: 100%;
  margin-top: 8px;
  border-radius: var(--radius);
}
.fp-video-player {
  max-width: 100%;
  max-height: 80vh;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

/* ─── Font ─── */
.fp-font-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}
.fp-font-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  text-align: center;
  max-width: 400px;
  width: 100%;
}
.fp-font-name {
  font-size: var(--font-size-base);
  color: var(--text-primary);
  font-weight: 500;
  word-break: break-all;
}
.fp-font-size {
  font-size: var(--font-size-sm);
}
.fp-font-sample {
  margin-top: 8px;
  padding: var(--space-4);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 100%;
}
.fp-font-sample p {
  margin: 0;
  font-size: 16px;
  line-height: 1.8;
  white-space: pre-wrap;
  color: var(--text-primary);
}

/* ─── Binary ─── */
.fp-binary-wrap {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}
.fp-binary-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  text-align: center;
  max-width: 320px;
}
.fp-binary-icon {
  opacity: 0.4;
}
.fp-binary-name {
  font-size: var(--font-size-base);
  color: var(--text-primary);
  font-weight: 500;
  word-break: break-all;
}
.fp-binary-size {
  font-size: var(--font-size-sm);
}
.fp-binary-hint {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  max-width: 260px;
}

/* Action button (for PDF, binary state) */
.fp-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-top: 4px;
}
.fp-action-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border2);
  color: var(--accent);
}

/* ═══ Footer ═══ */
.panel-footer {
  padding: var(--space-1) var(--space-4);
  border-top: 1px solid var(--border);
  min-height: 28px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.footer-info {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

/* ═══ Panel transition ═══ */
.panel-enter-active {
  animation: panelSlideIn var(--transition-panel) both;
}
.panel-leave-active {
  animation: panelSlideOut var(--transition-panel) both;
}
@keyframes panelSlideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes panelSlideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}
</style>
