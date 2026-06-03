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
          title="Stop generation"
          @click="$emit('stop')"
        >
          <AppIcon name="stop" :size="14" />
        </button>

        <!-- Send button -->
        <button
          v-else
          :class="['btn-send', { disabled: !canSend }]"
          :disabled="!canSend"
          title="Send message"
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
            title="Add context"
            @click="showPlusMenu = !showPlusMenu"
          >
            <AppIcon name="plus" :size="18" />
          </button>

          <Transition name="scale">
            <div v-if="showPlusMenu" class="plus-menu" @click.stop>
              <button class="plus-menu-item" @click="handleAction('file')">
                <AppIcon name="file" :size="16" />
                <span>Upload file</span>
              </button>
              <button class="plus-menu-item" @click="handleAction('image')">
                <AppIcon name="image" :size="16" />
                <span>Screenshot</span>
              </button>
              <button class="plus-menu-item" @click="handleAction('github')">
                <AppIcon name="github" :size="16" />
                <span>Connect GitHub</span>
              </button>
            </div>
          </Transition>
        </div>

        <!-- Web Search toggle -->
        <button
          :class="['toolbar-btn', 'toggle-btn', { active: webSearch }]"
          title="Web search"
          @click="$emit('toggle-web-search')"
        >
          <AppIcon name="globe" :size="16" />
          <span class="toggle-label">Search</span>
        </button>
      </div>

      <div class="toolbar-right">
        <!-- Thinking depth -->
        <div class="toolbar-group">
          <button
            class="toolbar-btn thinking-btn"
            title="Thinking depth"
            @click="cycleThinking"
          >
            <AppIcon name="lightbulb" :size="16" />
            <span class="toggle-label">{{ thinkingLabel }}</span>
          </button>
        </div>

        <!-- Model selector -->
        <button
          class="toolbar-btn model-btn"
          title="Change model"
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

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Ask anything, or use / for commands...' },
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
  const map = { low: 'Quick', medium: 'Think', high: 'Deep' }
  return map[props.thinkingDepth] || 'Think'
})

const modelLabel = computed(() => {
  if (props.model.includes('flash')) return 'V4-Flash'
  if (props.model.includes('pro')) return 'V4-Pro'
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
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  padding: var(--space-3) var(--space-4);
}

/* File chips */
.file-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.file-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  max-width: 200px;
}

.file-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-chip-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  color: var(--text-muted);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}
.file-chip-remove:hover {
  background: var(--red-muted);
  color: var(--red);
}

/* Input row */
.input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input-row.focused {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 2px var(--accent-muted);
}

.input-textarea {
  flex: 1;
  resize: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  padding: var(--space-2) 0;
  min-height: 24px;
  max-height: 200px;
  border: none;
  outline: none;
}

.input-textarea::placeholder {
  color: var(--text-muted);
}

/* Send/Stop button */
.input-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.btn-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  background: var(--accent);
  color: #fff;
  transition: all var(--transition-fast);
}
.btn-send:hover:not(.disabled) {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
}
.btn-send.disabled {
  background: var(--border);
  color: var(--text-muted);
}

.btn-stop {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  background: var(--red);
  color: #fff;
  transition: all var(--transition-fast);
}
.btn-stop:hover {
  opacity: 0.9;
}

/* Bottom toolbar */
.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-2);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.toolbar-group {
  position: relative;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toolbar-btn.toggle-btn {
  border: 1px solid transparent;
}
.toolbar-btn.toggle-btn.active {
  background: var(--accent-muted);
  color: var(--accent);
  border-color: var(--accent);
}

.toggle-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.model-indicator {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--accent);
}

.model-btn {
  gap: 6px;
}

/* Plus menu dropdown */
.plus-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  padding: var(--space-1);
  min-width: 180px;
  z-index: var(--z-dropdown);
}

.plus-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}
.plus-menu-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Transitions */
.scale-enter-active {
  animation: scaleIn 150ms ease both;
  transform-origin: bottom left;
}
.scale-leave-active {
  animation: scaleOut 100ms ease both;
  transform-origin: bottom left;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes scaleOut {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(0.95); }
}

.hidden-input {
  display: none;
}
</style>
