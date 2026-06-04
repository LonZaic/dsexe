<template>
  <div class="agent-page">
    <!-- ═══ Header ═══ -->
    <div class="agent-top">
      <div class="agent-title-row">
        <h2 class="agent-title">{{ t('agentMode') }}</h2>
        <span v-if="isRunning" class="badge running">{{ t('agentProcessing') }}</span>
        <span v-else-if="isDone" class="badge done">{{ t('agentComplete') }}</span>
        <span v-else class="badge idle">{{ t('agent') }}</span>
      </div>
      <p class="agent-sub">{{ t('agentDesc') }}</p>
    </div>

    <!-- ═══ Steps Timeline ═══ -->
    <div class="steps-area" ref="stepsRef">
      <div v-if="steps.length === 0 && !isRunning" class="steps-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="var(--text3)" stroke-width="1.3" stroke-dasharray="3 2"/>
          <path d="M9 12h6M12 9v6" stroke="var(--text3)" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <span>{{ t('agentDesc') }}</span>
      </div>

      <TransitionGroup name="step" tag="div" class="steps-list">
        <div
          v-for="(step, i) in steps"
          :key="step.id"
          :class="['step', { done: step.done, running: step.running, error: step.error }]"
        >
          <!-- Step header -->
          <div class="step-head" @click="toggleStep(i)">
            <!-- Status icon -->
            <span class="step-dot" :class="{ run: step.running, ok: step.done, err: step.error }">
              <svg v-if="step.done" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2.5L8 3" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else-if="step.error" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="var(--red)" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </span>

            <!-- Step label with sweep animation -->
            <span :class="['step-label', { shimmer: step.running }]">{{ step.label }}</span>

            <!-- Tool count badge -->
            <span v-if="step.tools.length" class="step-badge" @click.stop="toggleStep(i)">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 1h4M3 3h4M3 5h2M1 1v8l4-2.5L9 9V1H1z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ step.tools.length }}
            </span>

            <!-- Expand arrow -->
            <svg
              v-if="step.tools.length"
              :class="['step-chevron', { open: step.expanded }]"
              width="10" height="10" viewBox="0 0 10 10" fill="none"
            >
              <path d="M3 3.5l2 3 2-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <!-- Tool details (collapsed by default) -->
          <div v-if="step.expanded && step.tools.length" class="step-details">
            <div v-for="(tool, ti) in step.tools" :key="ti" class="tool-line">
              <span class="tool-dot" :class="{ ok: tool.done }"></span>
              <span class="tool-act">{{ tool.label }}</span>
              <span class="tool-det">{{ tool.detail }}</span>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- Scanning line when running -->
      <div v-if="isRunning" class="scan-bar"></div>
    </div>

    <!-- ═══ Final output ═══ -->
    <div v-if="finalOutput" class="final-area">
      <div class="final-label">{{ t('agentComplete') }}</div>
      <div class="final-body markdown-body" v-html="renderedFinal"></div>
    </div>

    <!-- ═══ Input ═══ -->
    <div class="agent-input-bar">
      <div :class="['input-row', { focused: inputFocused }]">
        <textarea
          ref="inputRef"
          v-model="taskText"
          :placeholder="t('askPlaceholder')"
          :disabled="isRunning"
          :rows="1"
          class="input-textarea"
          @keydown="onKeydown"
          @input="autoResize"
          @focus="inputFocused = true"
          @blur="inputFocused = false"
        />
        <div class="input-actions">
          <button v-if="isRunning" class="btn-stop" :title="t('stopGen')" @click="stopAgent">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor"/>
            </svg>
          </button>
          <button
            v-else
            :class="['btn-send', { off: !taskText.trim() }]"
            :disabled="!taskText.trim()"
            @click="runAgent"
            :title="t('sendMsg')"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 6-12 6 3-6-3-6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="input-foot">
        <span class="foot-hint">{{ t('agentMode') }} · deepseek-v4-pro</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
import { useChatStore } from '../store/chatStore.js'
import { useI18n } from '../composables/useI18n.js'
import { renderMarkdown } from '../utils/markdown.js'
import { getApiHeaders } from '../utils/apiHeaders.js'

const { t } = useI18n()
const store = useChatStore()

// ─── state ───
const taskText = ref('')
const inputFocused = ref(false)
const inputRef = ref(null)
const stepsRef = ref(null)
const isRunning = ref(false)
const isDone = ref(false)
const hasError = ref(false)
const steps = ref([])
const finalOutput = ref('')
const abortCtrl = ref(null)
let stepIdx = 0

// ─── computed ───
const renderedFinal = computed(() => renderMarkdown(finalOutput.value))

// ─── run ───
async function runAgent() {
  const task = taskText.value.trim()
  if (!task || isRunning.value) return

  taskText.value = ''
  isRunning.value = true
  isDone.value = false
  hasError.value = false
  steps.value = []
  finalOutput.value = ''
  stepIdx = 0

  const ctrl = new AbortController()
  abortCtrl.value = ctrl

  const collectedTools = []

  try {
    const res = await fetch('/api/agent/run', {
      method: 'POST',
      headers: getApiHeaders({
        'Authorization': 'Bearer ' + (localStorage.getItem('bbot_token') || ''),
        'x-permission-mode': store.permissionMode || 'default',
      }),
      body: JSON.stringify({ task, model: 'deepseek-v4-pro' }),
      signal: ctrl.signal,
    })

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalText = ''

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

        switch (evt.type) {
          case 'thinking': {
            // Each thinking event → new step with AI's own words
            const label = extractLabel(evt.text || '')
            if (label) {
              // Mark previous running step as done
              markPrevDone()
              // Add new running step
              stepIdx++
              steps.value.push({
                id: stepIdx,
                label,
                running: true,
                done: false,
                error: false,
                expanded: false,
                tools: [...collectedTools],
              })
              collectedTools.length = 0
            }
            break
          }
          case 'tool_start': {
            const name = evt.tool || ''
            const detail = (evt.args?.path || evt.args?.pattern || evt.args?.query || evt.args?.command || evt.args?.dir || '').slice(0, 60)
            collectedTools.push({ label: toolLabel(name), detail, done: false })
            break
          }
          case 'tool_result': {
            // Mark the latest pending tool as done
            if (collectedTools.length) {
              const pending = [...collectedTools].reverse().find(t => !t.done)
              if (pending) pending.done = true
            }
            break
          }
          case 'final_chunk': {
            finalText += evt.text || ''
            finalOutput.value = finalText
            break
          }
          case 'done':
          case 'final': {
            if (evt.text && evt.text.length > 5) {
              finalOutput.value = evt.text
            }
            markAllDone()
            isRunning.value = false
            isDone.value = true
            break
          }
          case 'error': {
            markAllDone()
            steps.value.push({
              id: ++stepIdx,
              label: evt.text || t('agentError'),
              running: false,
              done: true,
              error: true,
              expanded: true,
              tools: [],
            })
            isRunning.value = false
            hasError.value = true
            break
          }
          case 'aborted': {
            markAllDone()
            isRunning.value = false
            isDone.value = true
            break
          }
        }
      }
      await nextTick()
      scrollSteps()
    }

    // If final text was streamed, use it
    if (finalText && finalText.length > 5) {
      finalOutput.value = finalText
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      steps.value.push({
        id: ++stepIdx,
        label: e.message,
        running: false, done: true, error: true, expanded: true, tools: [],
      })
      hasError.value = true
    }
    isRunning.value = false
  }
}

function stopAgent() {
  if (abortCtrl.value) {
    abortCtrl.value.abort()
    abortCtrl.value = null
  }
}

function markPrevDone() {
  const running = steps.value.filter(s => s.running)
  for (const s of running) {
    s.running = false
    s.done = true
  }
}

function markAllDone() {
  for (const s of steps.value) {
    s.running = false
    s.done = true
  }
}

function toggleStep(i) {
  const s = steps.value[i]
  if (s && s.tools.length) {
    s.expanded = !s.expanded
    steps.value = [...steps.value] // trigger reactivity
  }
}

function scrollSteps() {
  if (stepsRef.value) {
    stepsRef.value.scrollTop = stepsRef.value.scrollHeight
  }
}

// ─── helpers ───
function extractLabel(text) {
  // Take first sentence (up to 50 chars), clean it
  const t = text.trim()
  if (!t) return ''
  const first = t.split(/[。！？\n.!?]/)[0].trim()
  if (first.length < 2) return t.slice(0, 50)
  return first.slice(0, 50)
}

function toolLabel(name) {
  const map = {
    list_files: '浏览文件',
    read_file: '读取',
    write_file: '创建',
    edit_file: '编辑',
    glob: '搜索',
    grep: '查找',
    run_command: '执行',
    web_search: '联网',
    search_code: '搜代码',
  }
  return map[name] || name
}

// ─── keyboard ───
function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    runAgent()
  }
}

function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

onUnmounted(() => {
  if (abortCtrl.value) abortCtrl.value.abort()
})
</script>

<style scoped>
.agent-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 24px;
  overflow: hidden;
}

/* ─── Top ─── */
.agent-top {
  padding: 28px 0 16px;
  flex-shrink: 0;
}
.agent-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.agent-title {
  font-size: 22px;
  font-weight: 500;
  color: var(--text);
  margin: 0;
  letter-spacing: -0.3px;
}
.agent-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text3);
  font-weight: 300;
}
.badge {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  letter-spacing: 0.3px;
}
.badge.running { background: var(--accent-muted); color: var(--accent); }
.badge.done { background: rgba(63,185,80,0.1); color: var(--green); }
.badge.idle { background: var(--bg3); color: var(--text3); }

/* ─── Steps area ─── */
.steps-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 8px 0;
  position: relative;
}
.steps-area::-webkit-scrollbar { width: 3px; }
.steps-area::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }

.steps-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 200px;
  color: var(--text3);
  font-size: 13px;
  font-weight: 300;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ─── Step item ─── */
.step {
  border-radius: var(--radius-sm);
  transition: background .15s;
}
.step:hover { background: var(--bg3); }

.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: default;
  user-select: none;
}

.step-dot {
  width: 18px; height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg4);
}
.step-dot.run {
  background: var(--accent-muted);
  animation: dotPulse 1.2s ease-in-out infinite;
}
.step-dot.ok { background: rgba(63,185,80,0.12); }
.step-dot.err { background: rgba(248,81,73,0.12); }

@keyframes dotPulse {
  0%, 100% { transform: scale(1); opacity: .6; }
  50% { transform: scale(1.15); opacity: 1; }
}

/* ─── Step label with sweep ─── */
.step-label {
  flex: 1;
  font-size: 13px;
  color: var(--text2);
  font-weight: 300;
  line-height: 1.4;
}
.step.running .step-label { color: var(--text); font-weight: 400; }
.step.done .step-label { color: var(--text2); }
.step.error .step-label { color: var(--red); }

.shimmer {
  position: relative;
  overflow: hidden;
}
.shimmer::after {
  content: '';
  position: absolute; top: 0; left: -60%;
  width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(79,125,255,0.12), transparent);
  animation: sweep 2s ease-in-out infinite;
}
@keyframes sweep {
  0% { left: -60%; }
  100% { left: 120%; }
}

/* ─── Step badge ─── */
.step-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--text3);
  padding: 1px 5px;
  border-radius: var(--radius-full);
  background: var(--bg4);
  cursor: pointer;
  transition: color .12s;
}
.step-badge:hover { color: var(--text2); }

.step-chevron {
  color: var(--text3);
  flex-shrink: 0;
  transition: transform .2s;
}
.step-chevron.open { transform: rotate(180deg); }

/* ─── Step details ─── */
.step-details {
  margin: 0 10px 4px 34px;
  padding: 4px 8px;
  border-left: 1px solid var(--border);
  max-height: 180px;
  overflow-y: auto;
}
.tool-line {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
  font-size: 10px;
  line-height: 1.5;
  padding: 2px 0;
  opacity: .65;
}
.tool-dot {
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--primary);
  flex-shrink: 0;
  margin-top: 4px;
}
.tool-dot.ok { background: var(--text3); }
.tool-act { color: var(--text2); flex-shrink: 0; }
.tool-det {
  color: var(--text3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── Scan bar ─── */
.scan-bar {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: scanSweep 2s ease-in-out infinite;
  margin-top: 6px;
  opacity: .6;
}
@keyframes scanSweep {
  0% { transform: translateX(-100%); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateX(100%); opacity: 0; }
}

/* ─── Final output ─── */
.final-area {
  flex-shrink: 0;
  max-height: 260px;
  overflow-y: auto;
  margin: 8px 0 12px;
  padding: 12px 14px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.final-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--green);
  letter-spacing: 0.4px;
  margin-bottom: 6px;
  text-transform: uppercase;
}
.final-body {
  font-size: 13px;
  line-height: 1.65;
  color: var(--text);
}

/* ─── Input ─── */
.agent-input-bar {
  flex-shrink: 0;
  padding: 10px 0 14px;
}
.input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 8px 10px 8px 16px;
  transition: border-color .15s, box-shadow .15s;
}
.input-row.focused { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-muted); }
.input-textarea {
  flex: 1;
  resize: none;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  font-weight: 300;
  line-height: 1.5;
  padding: 4px 0;
  min-height: 22px;
  max-height: 160px;
  border: none;
  outline: none;
}
.input-textarea::placeholder { color: var(--text3); }
.input-textarea:disabled { opacity: .5; }

.input-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.btn-send, .btn-stop {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--radius-sm);
  transition: all .12s; border: none; cursor: pointer;
}
.btn-send { background: var(--accent); color: #fff; }
.btn-send:hover:not(.off) { background: var(--accent-hover); }
.btn-send.off { background: var(--bg4); color: var(--text3); cursor: not-allowed; }
.btn-stop { background: var(--red); color: #fff; }
.btn-stop:hover { opacity: .85; }

.input-foot { margin-top: 6px; padding: 0 2px; }
.foot-hint { font-size: 10px; color: var(--text3); font-weight: 300; }

/* ─── Step transitions ─── */
.step-enter-active { transition: all .3s ease; }
.step-leave-active { transition: all .2s ease; }
.step-enter-from { opacity: 0; transform: translateY(-8px); }
.step-leave-to { opacity: 0; transform: translateY(4px); }
</style>
