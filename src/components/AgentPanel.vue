<template>
  <div v-if="visible" class="agent-panel" :class="{ collapsed }">
    <div class="agent-header" @click="collapsed = !collapsed">
      <span class="dot" :class="{ run: running, ok: done, err: error }"></span>
      <span class="title">{{ running ? (action || '处理中...') : (error ? 'Error' : (done ? 'Complete' : 'Agent')) }}</span>
      <span class="timer" v-if="running && elapsed > 0">{{ formatTime(elapsed) }}</span>
      <span class="timer done" v-else-if="done && elapsed > 0">{{ formatTime(elapsed) }}</span>
      <span class="stats" v-if="running && rounds">{{ rounds }}/{{ maxR }}</span>
      <button class="close-btn" @click.stop="$emit('close')">&times;</button>
    </div>
    <div v-if="!collapsed" class="body" ref="bodyRef">
      <div v-for="(e, i) in entries" :key="i" :class="['line', e.type]">
        <template v-if="e.type === 'thinking'">
          <span class="txt dim">{{ e.text?.slice(0, 180) }}</span>
        </template>
        <template v-else-if="e.type === 'tool_start'">
          <span class="dot-sm"></span>
          <span class="act">{{ actLabel(e.tool) }}</span>
          <span class="det">{{ detail(e) }}</span>
        </template>
        <template v-else-if="e.type === 'tool_result' && showResult(e.result)">
          <span class="txt dim">{{ e.result?.slice(0, 100) }}</span>
        </template>
        <template v-else-if="e.type === 'permission_denied'">
          <span class="txt err">Error:  {{ e.text }}</span>
        </template>
        <template v-else-if="e.type === 'hook_blocked'">
          <span class="txt warn">Blocked: {{ e.text }}</span>
        </template>
        <template v-else-if="e.type === 'compact_start'">
          <span class="txt dim">Compacting...</span>
        </template>
        <template v-else-if="e.type === 'compact_done'">
          <span class="txt dim">Compaction done</span>
        </template>
        <template v-else-if="e.type === 'budget_warning'">
          <span class="txt warn">Budget: {{ e.text }}</span>
        </template>
        <template v-else-if="e.type === 'memory_found'">
          <span class="txt dim">Think: {{ e.text }}</span>
        </template>
        <template v-else-if="e.type === 'memory_extracted'">
          <span class="txt ok">Memory: {{ e.text }}</span>
        </template>
        <template v-else-if="e.type === 'loop_warning'">
          <span class="txt warn">Loop:  {{ e.text?.slice(0, 100) }}</span>
        </template>
        <template v-else-if="e.type === 'stats'">
          <span class="txt dim">Rounds: {{ e.rounds }} | Hooks: {{ e.hooksFired }} | Memories: {{ e.memoriesFound }}</span>
        </template>
        <template v-else-if="e.type === 'error'">
          <span class="txt err">{{ e.text }}</span>
        </template>
        <template v-else-if="e.type === 'done' || e.type === 'final'">
          <span class="txt ok">{{ e.text || 'Done.' }}</span>
        </template>
      </div>
      <div v-if="running" class="scan-line"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
const props = defineProps({ visible: Boolean, events: Array })
defineEmits(['close'])

const collapsed = ref(true)
const bodyRef = ref(null)
const entries = ref([])
const rounds = ref(0)
const maxR = ref(50)
const running = ref(false)
const done = ref(false)
const error = ref(false)
const action = ref('')
const seen = new Set()

watch(() => props.events, (evts) => {
  if (!evts?.length) return
  for (const e of evts) {
    const k = e.type + '|' + (e.tool||'') + '|' + (e.round||'')
    if (seen.has(k)) continue; seen.add(k)
    entries.value.push(e)
    if (e.type === 'round') { rounds.value = e.round; maxR.value = e.max || 50 }
    if (e.type === 'tool_start') action.value = actLabel(e.tool)
    if (e.type === 'done' || e.type === 'final') { running.value = false; done.value = true; stopTimer() }
    if (e.type === 'error') { running.value = false; error.value = true; stopTimer() }
    if (e.type === 'aborted') { running.value = false; done.value = true; stopTimer() }
  }
  nextTick(() => { if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight })
}, { deep: true })

watch(() => props.visible, v => { if (!v) { entries.value=[]; rounds.value=0; running.value=false; done.value=false; error.value=false; action.value=''; seen.clear() } })

const startTime = ref(0)
const elapsed = ref(0)
let timerInterval = null

function start() { entries.value=[]; rounds.value=0; running.value=true; done.value=false; error.value=false; action.value=''; seen.clear(); startTime.value=Date.now(); elapsed.value=0
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => { if (running.value) elapsed.value = Date.now() - startTime.value }, 1000)
}
function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null } }
function formatTime(ms) { const s=Math.floor(ms/1000); if(s<60) return s+'s'; const m=Math.floor(s/60); return m+'m'+(s%60)+'s' }

function actLabel(t) { const m={list_files:'Listing...',read_file:'Reading...',write_file:'Writing...',edit_file:'Editing...',glob:'Finding...',grep:'Searching...',run_command:'Running...',web_search:'Searching web...',search_code:'Searching...'}; return m[t]||t }
function detail(e) { const a=e.args||{}; return a.path||a.pattern||a.query||a.command?.slice(0,50)||a.dir||'' }
function showResult(r) { return r && (r.startsWith('[ERROR]')||r.startsWith('[OK]')||r.startsWith('Error')||r.startsWith('[FILE]')||r.length<200) }
defineExpose({ start })
</script>

<style scoped>
.agent-panel { border: 1px solid var(--border); border-radius: var(--radius); margin: 0 16px; background: var(--bg2); font-family: 'Cascadia Code','Fira Code',Consolas,monospace; font-size: 11px; overflow: hidden; transition: border-color .2s; }
.agent-header { display:flex; align-items:center; gap:8px; padding:6px 10px; cursor:pointer; user-select:none; border-bottom:1px solid var(--border); }
.agent-header:hover { background: var(--bg-hover); }
.dot { width:7px; height:7px; border-radius:50%; background:var(--text-muted); flex-shrink:0; }
.dot.run { background:var(--green); animation: pulse 1s infinite; }
.dot.done { background:var(--green); }
.dot.err { background:var(--red); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.title { flex:1; font-size:11px; color:var(--text-secondary); }
.stats { font-size:9px; color:var(--text-muted); }
.timer { font-size:9px; color:var(--text-muted); font-variant-numeric:tabular-nums; }
.timer.done { color:var(--green); }
.close-btn { border:none; background:none; color:var(--text-muted); font-size:14px; cursor:pointer; }
.close-btn:hover { color:var(--red); }
.body { max-height:280px; overflow-y:auto; padding:6px 10px; display:flex; flex-direction:column; gap:1px; position:relative; }
.body::-webkit-scrollbar { width:3px; }
.body::-webkit-scrollbar-thumb { background:var(--border); }
.line { display:flex; align-items:baseline; gap:5px; line-height:1.4; padding:1px 0; }
.dot-sm { width:4px; height:4px; border-radius:50%; background:var(--primary); flex-shrink:0; margin-top:4px; }
.act { color:var(--text-secondary); font-weight:500; }
.det { color:var(--text-muted); font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px; }
.dim { color:var(--text-muted); font-size:10px; }
.err { color:var(--red); }
.warn { color:var(--yellow, #e6a817); }
.ok { color:var(--green); }
.scan-line { height:1px; background:linear-gradient(90deg,transparent,var(--primary),transparent); animation: scanSweep 1.5s ease-in-out infinite; margin-top:4px; }
@keyframes scanSweep { 0%{opacity:0;transform:translateX(-100%)} 50%{opacity:1} 100%{opacity:0;transform:translateX(100%)} }
@media(max-width:768px){ .agent-panel{margin:4px 8px} .body{max-height:200px} .det{max-width:80px} }
</style>
