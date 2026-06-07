<template>
  <div class="input-bar-container">
    <!-- File chips — Chat mode: per-type colored pills -->
    <div v-if="mode === 'chat' && files.length" class="file-chips">
      <div
        v-for="(f, i) in files"
        :key="i"
        class="file-chip"
        :style="chipStyle(f.name, f.type)"
        :title="f.name"
      >
        <AppIcon :name="chipIcon(f.name)" :size="13" class="chip-icon" />
        <span class="chip-type-badge" :style="badgeStyle(f.name, f.type)">{{ fileLabel(f.name, f.type) }}</span>
        <span class="file-chip-name">{{ f.name }}</span>
        <button class="file-chip-remove" @click="$emit('remove-file', i)">
          <AppIcon name="x" :size="11" />
        </button>
      </div>
    </div>

    <!-- File chips — Code mode: gray image count -->
    <div v-if="mode === 'code' && files.length" class="file-chips code-chips">
      <div class="file-chip code-chip">
        <AppIcon name="image" :size="13" class="chip-icon" />
        <span class="code-chip-text">图片 数量: {{ files.length }}</span>
        <button class="file-chip-remove" @click="$emit('remove-file', 0)">
          <AppIcon name="x" :size="11" />
        </button>
      </div>
    </div>

    <!-- Main input row -->
    <div :class="['input-row', { focused: isFocused }]">
      <textarea
        ref="textareaRef"
        v-model="text"
        :placeholder="placeholder"
        :disabled="disabled"
        :rows="1"
        class="input-textarea"
        @keydown="onKeydown"
        @input="autoResize"
        @focus="isFocused = true"
        @blur="isFocused = false"
        @paste="$emit('paste', $event)"
      />

      <div class="input-actions">
        <!-- Stop button (when running) -->
        <button
          v-if="isRunning"
          class="btn-stop"
          :title="t('stopGen')"
          @click="$emit('stop')"
        >
          <AppIcon name="stop" :size="14" />
        </button>

        <!-- Send button -->
        <button
          v-else
          :class="['btn-send', { disabled: !canSend }]"
          :disabled="!canSend"
          :title="t('sendMsg')"
          @click="send"
        >
          <AppIcon name="send" :size="16" />
        </button>
      </div>
    </div>

    <!-- Bottom toolbar -->
    <div class="input-toolbar">
      <div class="toolbar-left">
        <!-- + Menu -->
        <div class="toolbar-group">
          <button
            ref="plusBtnRef"
            class="toolbar-btn"
            :title="t('addContext')"
            @click="showPlusMenu = !showPlusMenu"
          >
            <AppIcon name="plus" :size="18" />
          </button>

          <Transition name="scale">
            <div v-if="showPlusMenu" class="plus-menu" @click.stop>
              <button class="plus-menu-item" @click="handleAction('file')">
                <AppIcon name="file" :size="16" />
                <span>{{ t('uploadFile') }}</span>
              </button>
              <button class="plus-menu-item" @click="handleAction('image')">
                <AppIcon name="image" :size="16" />
                <span>{{ t('screenshot') }}</span>
              </button>
              <button class="plus-menu-item" @click="handleAction('github')">
                <AppIcon name="github" :size="16" />
                <span>{{ t('connectGithub') }}</span>
              </button>
            </div>
          </Transition>
        </div>

      </div>

      <div class="toolbar-right">
        <!-- Thinking depth -->
        <div class="toolbar-group">
          <button
            :class="['toolbar-btn bordered', { off: thinkingDepth === 'off' }]"
            :title="thinkingDepth === 'off' ? t('thinkOffHint') : t('thinkOnHint')"
            @click="cycleThinking"
          >
            <AppIcon name="lightbulb" :size="16" />
            <span class="toggle-label">{{ thinkingLabel }}</span>
          </button>
        </div>

        <!-- Computer Management -->
        <button
          :class="['toolbar-btn bordered', { active: computerMode }]"
          :title="computerMode ? '关闭电脑管理模式' : '管理电脑'"
          @click="$emit('toggle-computer-mode')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="toggle-label">管理电脑</span>
          <span v-if="computerMode" class="pc-dot"></span>
        </button>

        <!-- Model selector -->
        <button
          class="toolbar-btn model-btn"
          :title="t('changeModel')"
          @click="$emit('toggle-model-menu')"
        >
          <span :class="['model-indicator', model.includes('flash') ? 'flash' : 'pro']" />
          <span class="toggle-label">{{ modelLabel }}</span>
          <AppIcon name="chevron-down" :size="12" />
        </button>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      multiple
      :accept="accept || undefined"
      class="hidden-input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { useI18n } from '../../composables/useI18n.js'
import { fileChipStyle, fileLabel } from '../../utils/fileStyles.js'
import { getFileCategory, getFileIcon } from '../../utils/filePreview.js'

// ═══ File chip helpers ═══
function chipStyle(name, type) {
  return { ...fileChipStyle(name, type), borderRadius: '12px', padding: '2px 8px' }
}
function badgeStyle(name, type) {
  const s = fileChipStyle(name, type)
  return { background: s.borderColor, color: s.color, fontSize: '9px', padding: '1px 5px', borderRadius: '4px', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }
}
function chipIcon(name) { return getFileIcon(name) }

const { t } = useI18n()

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  isRunning: { type: Boolean, default: false },
  files: { type: Array, default: () => [] },
  thinkingDepth: { type: String, default: 'medium' },
  model: { type: String, default: 'deepseek-v4-flash' },
  mode: { type: String, default: 'chat' },  // 'chat' | 'code'
  accept: { type: String, default: '' },     // file input accept filter
  computerMode: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:modelValue',
  'send',
  'stop',
  'toggle-model-menu',
  'update:thinkingDepth',
  'add-file',
  'remove-file',
  'paste',
  'toggle-computer-mode',
])

const text = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const canSend = computed(() => text.value.trim() || props.files.length)

const isFocused = ref(false)
const showPlusMenu = ref(false)
const textareaRef = ref(null)
const fileInput = ref(null)
const plusBtnRef = ref(null)

const thinkingLabel = computed(() => {
  return props.thinkingDepth === 'off' ? t('thinkOff') : t('thinkOn')
})

const modelLabel = computed(() => {
  if (props.model.includes('flash')) return t('v4flash')
  if (props.model.includes('pro')) return t('v4pro')
  return 'V4'
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

function send() {
  if (!canSend.value || props.isRunning) return
  emit('send', text.value)
  text.value = ''
  // Reset height
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

function cycleThinking() {
  emit('update:thinkingDepth', props.thinkingDepth === 'off' ? 'on' : 'off')
}

function handleAction(type) {
  showPlusMenu.value = false
  if (type === 'file' || type === 'image') {
    fileInput.value?.click()
  } else if (type === 'github') {
    emit('toggle-web-search') // placeholder
  }
}

function onFileChange(e) {
  const selectedFiles = Array.from(e.target.files || [])
  emit('add-file', selectedFiles)
  if (fileInput.value) fileInput.value.value = ''
}

// Close plus menu on outside click
function onOutsideClick(e) {
  if (showPlusMenu.value && plusBtnRef.value && !plusBtnRef.value.contains(e.target)) {
    showPlusMenu.value = false
  }
}

onMounted(() => document.addEventListener('click', onOutsideClick))
onUnmounted(() => document.removeEventListener('click', onOutsideClick))

// Expose textarea for parent
defineExpose({ textareaRef, fileInput })
</script>

<style scoped>
.input-bar-container {
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding: 8px 12px 10px;
}

/* File chips */
.file-chips {
  display: flex; flex-wrap: wrap; gap: 5px;
  margin-bottom: 6px;
}
.file-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 8px;
  background: var(--bg);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  font-size: 11px; color: var(--text2); max-width: 220px;
  transition: border-color var(--transition-fast);
}
.file-chip:hover { border-color: rgba(255,255,255,0.2); }
.chip-icon { flex-shrink: 0; color: var(--text-muted); }
.chip-type-badge { flex-shrink: 0; }
.file-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.file-chip-remove {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%; border: none; background: transparent;
  color: var(--text3); flex-shrink: 0; cursor: pointer; transition: all .12s;
}
.file-chip-remove:hover { background: rgba(248,81,73,0.12); color: var(--red); }

/* Code mode chips */
.code-chips .code-chip {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 3px 10px;
  gap: 6px;
}
.code-chip-text {
  font-size: 11px;
  color: var(--text2);
  white-space: nowrap;
}

/* Input row */
.input-row {
  display: flex; align-items: flex-end; gap: 6px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 6px 8px 6px 14px;
  transition: border-color .15s, box-shadow .15s;
}
.input-row.focused { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-muted); }

.input-textarea {
  flex: 1; resize: none; background: transparent;
  color: var(--text); font-size: 14px; font-family: inherit; font-weight: 300;
  line-height: 1.5; padding: 4px 0; min-height: 22px; max-height: 160px;
  border: none; outline: none;
}
.input-textarea::placeholder { color: var(--text3); }

/* Send/Stop */
.input-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.btn-send, .btn-stop {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  transition: all .12s;
}
.btn-send { background: var(--accent); color: #fff; }
.btn-send:hover:not(.disabled) { background: var(--accent-hover); }
.btn-send.disabled { background: var(--bg4); color: var(--text3); cursor: not-allowed; }
.btn-stop { background: var(--red); color: #fff; }
.btn-stop:hover { opacity: .85; }

/* Bottom toolbar */
.input-toolbar { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 2px; }
.toolbar-group { position: relative; }

.toolbar-btn {
  display: flex; align-items: center; gap: 3px;
  padding: 3px 8px; border-radius: var(--radius-sm);
  color: var(--text3); font-size: 11px; font-family: inherit; font-weight: 300;
  transition: all .12s; white-space: nowrap;
  border: none; background: transparent; cursor: pointer;
}
.toolbar-btn:hover { background: var(--bg3); color: var(--text2); }
.toolbar-btn.toggle-btn.active { background: var(--accent-muted); color: var(--accent); }

/* Bordered toolbar buttons — thinking depth + computer mode */
.toolbar-btn.bordered {
  border: 1px solid var(--border); border-radius: var(--radius-full);
  padding: 3px 10px; gap: 5px;
}
.toolbar-btn.bordered:hover { border-color: var(--border2); }
.toolbar-btn.bordered.active { border-color: var(--accent); color: var(--accent); background: var(--accent-muted); }
.toolbar-btn.bordered.off { color: var(--text3); border-color: var(--border); }
.toolbar-btn.bordered.off:hover { color: var(--yellow); border-color: var(--yellow); }

.pc-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--green); animation: pcPulse 1.5s ease-in-out infinite;
}
@keyframes pcPulse { 0%,100%{opacity:1} 50%{opacity:.4} }

.thinking-btn.off { color: var(--text3); }
.thinking-btn.off:hover { color: var(--yellow); }

.toggle-label { font-size: 11px; font-weight: 400; }
.model-indicator { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.model-indicator.flash { background: var(--yellow); }
.model-indicator.pro { background: var(--accent); }
.model-btn { gap: 5px; }

/* Plus menu */
.plus-menu {
  position: absolute; bottom: 100%; left: 0;
  margin-bottom: 6px;
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); box-shadow: var(--shadow-md);
  padding: 4px; min-width: 170px; z-index: var(--z-dropdown);
}
.plus-menu-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 6px 8px; border-radius: var(--radius-sm);
  color: var(--text2); font-size: 12px; font-family: inherit; font-weight: 300;
  transition: all .12s; border: none; background: transparent; cursor: pointer;
}
.plus-menu-item:hover { background: var(--bg3); color: var(--text); }

.scale-enter-active { animation: scaleIn .15s ease both; transform-origin: bottom left; }
.scale-leave-active { animation: scaleOut .1s ease both; transform-origin: bottom left; }
@keyframes scaleIn { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
@keyframes scaleOut { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(.95); } }

.hidden-input { display: none; }
</style>
