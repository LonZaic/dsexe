<template>
  <Transition name="panel">
    <div v-if="visible" :class="['code-panel', { expanded: isExpanded }]">
      <!-- Header -->
      <div class="panel-header">
        <div class="panel-tabs">
          <button
            v-for="(tab, i) in tabs"
            :key="i"
            :class="['panel-tab', { active: activeTab === i }]"
            @click="activeTab = i"
          >
            <AppIcon :name="tabIcon(tab.language)" :size="14" />
            <span class="tab-name">{{ tab.filename || t('codeN') + ' ' + (i + 1) }}</span>
            <span class="tab-lang">{{ tab.language }}</span>
          </button>
        </div>

        <div class="panel-actions">
          <button class="panel-action-btn" :title="t('copyCode')" @click="copyCode">
            <AppIcon v-if="!copied" name="copy" :size="16" />
            <AppIcon v-else name="check" :size="16" />
          </button>
          <button class="panel-action-btn" :title="t('downloadFile')" @click="downloadCode">
            <AppIcon name="download" :size="16" />
          </button>
          <button
            v-if="hasPreview"
            class="panel-action-btn"
            :title="showPreview ? t('showCode') : t('previewCode')"
            @click="showPreview = !showPreview"
          >
            <AppIcon :name="showPreview ? 'code' : 'play'" :size="16" />
          </button>
          <button class="panel-action-btn" :title="t('expand')" @click="isExpanded = !isExpanded">
            <AppIcon :name="isExpanded ? 'panel-close' : 'panel-right'" :size="16" />
          </button>
          <button class="panel-action-btn panel-close-btn" :title="t('close')" @click="$emit('close')">
            <AppIcon name="x" :size="16" />
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="panel-body">
        <!-- Preview mode -->
        <div v-if="showPreview && hasPreview" class="preview-frame-wrapper">
          <iframe
            :srcdoc="previewContent"
            class="preview-frame"
            sandbox="allow-scripts allow-same-origin"
            title="Preview"
          />
        </div>

        <!-- Code mode -->
        <div v-else class="code-view">
          <pre><code
            v-for="(tab, i) in tabs"
            :key="i"
            v-show="activeTab === i"
            :class="`language-${tab.language}`"
            v-html="highlightedCode[i]"
          /></pre>
        </div>
      </div>

      <!-- Footer -->
      <div class="panel-footer">
        <span class="footer-info">{{ currentTab?.language }} &middot; {{ codeLines }} {{ t('linesUnit') }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { useI18n } from '../../composables/useI18n.js'

const { t } = useI18n()

const props = defineProps({
  visible: { type: Boolean, default: false },
  tabs: { type: Array, default: () => [] },
  // Each tab: { filename, language, code, raw }
})

const emit = defineEmits(['close'])

const activeTab = ref(0)
const isExpanded = ref(false)
const showPreview = ref(false)
const copied = ref(false)

const currentTab = computed(() => props.tabs[activeTab.value] || null)

const hasPreview = computed(() => {
  return props.tabs.some(t => t.language === 'html' || t.language === 'htm')
})

const previewContent = computed(() => {
  const htmlTab = props.tabs.find(t => t.language === 'html' || t.language === 'htm')
  return htmlTab?.code || ''
})

const codeLines = computed(() => {
  return currentTab.value?.code?.split('\n').length || 0
})

// Simple syntax highlighting (uses highlight.js if available, falls back to plain text)
const highlightedCode = computed(() => {
  return props.tabs.map(tab => {
    try {
      if (window.hljs) {
        const lang = window.hljs.getLanguage(tab.language)
        if (lang) {
          return window.hljs.highlight(tab.code, { language: tab.language }).value
        }
      }
    } catch {}
    return escapeHtml(tab.code)
  })
})

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tabIcon(lang) {
  const map = {
    html: 'code', htm: 'code', css: 'code', js: 'code', javascript: 'code',
    ts: 'code', typescript: 'code', jsx: 'code', tsx: 'code',
    vue: 'code', react: 'code',
    py: 'code', python: 'code',
    json: 'code', yaml: 'code', yml: 'code', toml: 'code',
    md: 'file', markdown: 'file',
    sql: 'database',
    sh: 'play', bash: 'play', zsh: 'play',
  }
  return map[lang] || 'code'
}

async function copyCode() {
  if (!currentTab.value) return
  try {
    await navigator.clipboard.writeText(currentTab.value.code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

function downloadCode() {
  if (!currentTab.value) return
  const blob = new Blob([currentTab.value.code], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = currentTab.value.filename || `code.${currentTab.value.language}`
  a.click()
  URL.revokeObjectURL(url)
}

// Reset state when tabs change
watch(() => props.tabs, () => {
  activeTab.value = 0
  showPreview.value = false
  copied.value = false
})
</script>

<style scoped>
.code-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: var(--panel-width);
  height: 100vh;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: var(--z-sticky);
  box-shadow: var(--shadow-lg);
}

.code-panel.expanded {
  width: 65vw;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
  min-height: 44px;
}

.panel-tabs {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  flex: 1;
}

.panel-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  white-space: nowrap;
  transition: all var(--transition-fast);
}
.panel-tab:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}
.panel-tab.active {
  color: var(--text-primary);
  background: var(--bg-active);
}

.tab-lang {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

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
  color: var(--text-secondary);
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

/* Body */
.panel-body {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
}

.code-view {
  height: 100%;
}

.code-view pre {
  margin: 0;
  padding: var(--space-4);
  height: 100%;
  overflow: auto;
}

.code-view code {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
}

/* Preview */
.preview-frame-wrapper {
  height: 100%;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

/* Footer */
.panel-footer {
  padding: var(--space-1) var(--space-4);
  border-top: 1px solid var(--border);
  min-height: 28px;
  display: flex;
  align-items: center;
}

.footer-info {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

/* Panel transition */
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
