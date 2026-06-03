<template>
  <div class="input-bar-container">
    <!-- File chips -->
    <div v-if="files.length" class="file-chips">
      <div
        v-for="(f, i) in files"
        :key="i"
        class="file-chip"
        :title="f.name"
      >
        <AppIcon :name="f.type?.startsWith('image') ? 'image' : 'file'" :size="14" />
        <span class="file-chip-name">{{ f.name }}</span>
        <button class="file-chip-remove" @click="$emit('remove-file', i)">
          <AppIcon name="x" :size="12" />
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

        <!-- Web Search toggle -->
        <button
          :class="['toolbar-btn', 'toggle-btn', { active: webSearch }]"
          :title="t('webSearch')"
          @click="$emit('toggle-web-search')"
        >
          <AppIcon name="globe" :size="16" />
          <span class="toggle-label">{{ t('webSearch') }}</span>
        </button>
      </div>

      <div class="toolbar-right">
        <!-- Thinking depth -->
        <div class="toolbar-group">
          <button
            class="toolbar-btn thinking-btn"
            :title="t('thinkingDepth')"
            @click="cycleThinking"
          >
            <AppIcon name="lightbulb" :size="16" />
            <span class="toggle-label">{{ thinkingLabel }}</span>
          </button>
        </div>

        <!-- Model selector -->
        <button
          class="toolbar-btn model-btn"
          :title="t('changeModel')"
          @click="$emit('toggle-model-menu')"
        >
          <span class="model-indicator" />
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
      class="hidden-input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import AppIcon from '../common/AppIcon.vue'
import { useI18n } from '../../composables/useI18n.js'

const { t } = useI18n()

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  isRunning: { type: Boolean, default: false },
  files: { type: Array, default: () => [] },
  webSearch: { type: Boolean, default: false },
  thinkingDepth: { type: String, default: 'medium' },
  model: { type: String, default: 'deepseek-v4-flash' },
})

const emit = defineEmits([
  'update:modelValue',
  'send',
  'stop',
  'toggle-web-search',
  'toggle-model-menu',
  'update:thinkingDepth',
  'add-file',
  'remove-file',
  'paste',
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
  const map = { low: t('quick'), medium: t('think'), high: t('deep') }
  return map[props.thinkingDepth] || t('think')
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
  if (!canSend.value) return
  emit('send', text.value)
  text.value = ''
  // Reset height
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }
}

function cycleThinking() {
  const order = ['low', 'medium', 'high']
  const idx = order.indexOf(props.thinkingDepth)
  const next = order[(idx + 1) % order.length]
  emit('update:thinkingDepth', next)
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
  display: flex; flex-wrap: wrap; gap: 4px;
  margin-bottom: 6px;
}
.file-chip {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 11px; color: var(--text2); max-width: 200px;
}
.file-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-chip-remove {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%;
  color: var(--text3); flex-shrink: 0; transition: all .12s;
}
.file-chip-remove:hover { background: rgba(248,81,73,0.12); color: var(--red); }

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

.toggle-label { font-size: 11px; font-weight: 400; }
.model-indicator { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
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
