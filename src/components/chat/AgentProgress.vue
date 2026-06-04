<template>
  <div class="ap-root" :class="{ running }">
    <!-- ═══ Collapsed Header ═══ -->
    <button class="ap-hdr" @click="expanded = !expanded">
      <span class="ap-hdr-l">
        <svg v-if="running" class="ap-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="var(--text3)" stroke-width="1.1" opacity="0.3"/>
          <path d="M12.5 7a5.5 5.5 0 0 0-4.4-5.35" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        <svg v-else-if="allDone" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="var(--green)" stroke-width="1.1"/>
          <path d="M4.5 7.5l1.8 1.8 3.5-4" stroke="var(--green)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="3" fill="var(--accent)" opacity="0.5"/>
          <circle cx="7" cy="7" r="6" stroke="var(--accent)" stroke-width="1" opacity="0.2"/>
        </svg>
        <span class="ap-hdr-label">Agent</span>
        <span class="ap-hdr-dash">&#8212;</span>
        <span class="ap-hdr-sum">{{ summaryText }}</span>
      </span>
      <span class="ap-hdr-r">
        <span class="ap-hdr-timer">{{ timerText }}</span>
        <svg class="ap-hdr-chev" :class="{ open: expanded }" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 5l3 3 3-3" stroke="var(--text3)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </button>

    <!-- ═══ Expanded Body ═══ -->
    <div v-if="expanded" class="ap-body">
      <TransitionGroup name="step-fade">
        <div v-for="s in steps" :key="s._k" class="ap-step" :class="{ nar: s._nar }">

          <!-- ═══ Tool call row ═══ -->
          <template v-if="!s._nar">
            <div class="ap-row" @click="s._open = !s._open">
              <svg v-if="s._live" class="ap-row-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="var(--text3)" stroke-width="0.9" opacity="0.25"/>
                <path d="M10.5 6a4.5 4.5 0 0 0-3.5-4.3" stroke="var(--accent)" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
              <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none" class="ap-row-ok">
                <circle cx="6" cy="6" r="4.8" stroke="var(--green)" stroke-width="0.9" opacity="0.5"/>
                <path d="M3.8 6.2l1.5 1.5 3-3.2" stroke="var(--green)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <!-- Phase phrase: white with sweep when active, gray when done -->
              <span class="ap-phrase" :class="{ sweep: s._live }">{{ s._phrase }}</span>
              <!-- Tool name tag -->
              <span class="ap-tag">{{ s._tool }}</span>
              <svg v-if="s._detail" class="ap-row-chev" :class="{ open: s._open }" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2.5 3.5L5 6l2.5-2.5" stroke="var(--text3)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <!-- Hint line: gray italic, single line -->
            <div v-if="s._hint" class="ap-hint">{{ s._hint }}</div>
            <!-- Expanded detail -->
            <div v-if="s._open && s._detail" class="ap-detail">
              <code class="ap-code">{{ s._detail }}</code>
            </div>
          </template>

          <!-- ═══ AI narration: gray italic ═══ -->
          <template v-else>
            <div class="ap-nar-text">{{ s._text }}</div>
          </template>
        </div>
      </TransitionGroup>
      <div v-if="running" class="ap-scan"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { getAgentPhrase } from '../../utils/agentPhrases.js'

const props = defineProps({
  events: { type: Array, default: () => [] },
  running: { type: Boolean, default: false },
  startTime: { type: Number, default: 0 },
})

const expanded = ref(false)
const tNow = ref(Date.now())
let _ti = null
let _ct = null

watch(() => props.running, v => {
  if (v) {
    expanded.value = true
    tNow.value = Date.now()
    clearTimeout(_ct); _ct = null
    _ti = setInterval(() => { tNow.value = Date.now() }, 1000)
  } else {
    clearInterval(_ti); _ti = null
    _ct = setTimeout(() => { expanded.value = false }, 4000)
  }
}, { immediate: true })

onUnmounted(() => { clearInterval(_ti); clearTimeout(_ct) })

const timerText = computed(() => {
  const s = props.startTime
  if (!s && !props.running) return ''
  const e = Math.floor((tNow.value - (s || tNow.value)) / 1000)
  if (e <= 0) return '0s'
  if (e < 60) return e + 's'
  return Math.floor(e / 60) + 'm ' + (e % 60) + 's'
})

const allDone = computed(() => !props.running && props.events.length > 1)

// ═══ Summary ═══
const summaryText = computed(() => {
  const ev = props.events || []
  if (!props.running && ev.length > 1) {
    const d = ev.find(e => e.type === 'done' || e.type === 'final')
    if (d?.text) return d.text.split(/[.\n]/)[0].slice(0, 50) || '任务完成'
    return '任务完成'
  }
  for (let i = ev.length - 1; i >= 0; i--) {
    if (ev[i].type === 'tool_start') return getAgentPhrase(ev[i].tool, 'active')
  }
  return '分析任务中'
})

// ═══ Step builder ═══
const steps = computed(() => {
  const out = []
  const ev = props.events || []
  for (const e of ev) {
    if (!e || !e.type) continue
    // AI narration
    if (e.type === 'thinking' && e.text) {
      const t = e.text.split(/[.\n]/)[0].slice(0, 70)
      if (t.length > 2) out.push({ _k: 'n' + out.length, _nar: true, _text: t })
    }
    // Tool start
    if (e.type === 'tool_start') {
      const a = e.args || {}
      const detail = a.path || a.pattern || a.query || a.command || a.dir || a.file_path || ''
      out.push({
        _k: 't' + out.length,
        _tool: (e.tool || '').replace(/_/g, ' '),
        _detail: detail || (Object.keys(a).length ? JSON.stringify(a).slice(0, 240) : ''),
        _phrase: getAgentPhrase(e.tool, 'active'),
        _hint: hintFor(e.tool, a),
        _live: true, _open: false,
      })
    }
    // Tool result
    if (e.type === 'tool_result') {
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i]._live && !out[i]._nar) {
          out[i]._live = false
          out[i]._phrase = getAgentPhrase(out[i]._tool.replace(/ /g, '_'), 'done')
          if (e.result && !out[i]._detail) {
            out[i]._detail = String(e.result).slice(0, 300)
          }
          break
        }
      }
    }
  }
  if (props.running && out.length === 0) {
    out.push({ _k: 'init', _nar: true, _text: '正在分析任务...' })
  }
  return out
})

function hintFor(tool, args) {
  const map = {
    list_files: '我需要先了解项目里有什么文件',
    read_file: (args.path || '').includes('package.json') ? 'package.json 里看到了项目名和依赖' : '正在仔细查看文件内容',
    write_file: '现在我对项目结构有了完整了解',
    write_to_file: '现在我对项目结构有了完整了解',
    grep: '搜索代码中的关键信息',
    glob: '查找特定类型的文件',
    run_command: '执行命令以完成任务',
    bash: '执行命令以完成任务',
    edit_file: '精确修改文件内容',
    web_search: '搜索网络上的相关信息',
    web_fetch: '获取网页内容',
  }
  return map[tool] || ''
}
</script>

<style scoped>
.ap-root {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg2);
  overflow: hidden;
  transition: border-color .3s;
  margin: 6px 0;
}
.ap-root.running { border-color: rgba(79,125,255,.16); }

/* header */
.ap-hdr {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 7px 12px; gap: 10px;
  background: none; border: none; color: var(--text2);
  font: 300 13px var(--font-sans); cursor: pointer; text-align: left;
  transition: background .12s;
}
.ap-hdr:hover { background: var(--bg3); }
.ap-hdr-l { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; }
.ap-hdr-r { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.ap-hdr-label { font-weight: 500; color: var(--text); flex-shrink: 0; }
.ap-hdr-dash { color: var(--text3); flex-shrink: 0; }
.ap-hdr-sum { color: var(--text2); font-weight: 300; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-hdr-timer { font-size: 11px; color: var(--text3); font-variant-numeric: tabular-nums; }
.ap-hdr-chev { flex-shrink: 0; opacity: .5; transition: transform .2s; }
.ap-hdr-chev.open { transform: rotate(180deg); opacity: .8; }

@keyframes aSpin { to { transform: rotate(360deg); } }
.ap-spin { animation: aSpin 1.2s linear infinite; flex-shrink: 0; }

/* body */
.ap-body { padding: 2px 4px 8px; position: relative; }

/* step */
.ap-row {
  display: flex; align-items: center; gap: 7px;
  padding: 5px 10px; cursor: pointer;
  border-radius: 5px; transition: background .12s;
  font-size: 13px; font-weight: 300;
}
.ap-row:hover { background: var(--bg3); }
.ap-row-spin { animation: aSpin 1.2s linear infinite; flex-shrink: 0; }
.ap-row-ok { flex-shrink: 0; }

/* phrase: white preset text */
.ap-phrase {
  color: var(--text); font-size: 13px; font-weight: 300;
  flex-shrink: 0; white-space: nowrap;
  transition: color .35s;
}
.ap-step.done .ap-phrase, .ap-row-ok ~ .ap-phrase { color: var(--text3); }
/* sweep glow on active */
.ap-phrase.sweep {
  background: linear-gradient(90deg, var(--text) 30%, var(--accent) 50%, var(--text) 70%);
  background-size: 200% 100%;
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: sweep 2.2s ease-in-out infinite;
}
@keyframes sweep {
  0% { background-position: 200% center; }
  100% { background-position: -200% center; }
}

/* tool tag */
.ap-tag {
  color: var(--text3); font-size: 10px; font-family: var(--font-mono);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1; min-width: 0; opacity: .7;
}
.ap-row-chev { flex-shrink: 0; opacity: .4; transition: transform .15s; }
.ap-row-chev.open { transform: rotate(180deg); opacity: .75; }

/* hint: gray italic */
.ap-hint {
  padding: 0 10px 0 29px; font-size: 12px; color: var(--text3);
  font-weight: 300; font-style: italic; line-height: 1.5;
}

/* detail panel */
.ap-detail {
  margin: 3px 10px 5px 29px; padding: 7px 10px;
  background: var(--bg3); border: 1px solid var(--border); border-radius: 6px;
}
.ap-code {
  font-size: 10px; font-family: var(--font-mono); color: var(--text2);
  white-space: pre-wrap; word-break: break-all; line-height: 1.55;
}

/* narration: gray italic */
.ap-nar-text {
  padding: 2px 10px 2px 26px;
  font-size: 12px; color: var(--text3); font-weight: 300;
  font-style: italic; line-height: 1.5;
}

/* scan line */
.ap-scan {
  height: 1px; margin-top: 6px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: sSweep 2s ease-in-out infinite; opacity: .5;
}
@keyframes sSweep {
  0% { opacity: 0; transform: scaleX(0); transform-origin: left; }
  50% { opacity: 1; transform: scaleX(1); transform-origin: left; }
  100% { opacity: 0; transform: scaleX(0); transform-origin: right; }
}

/* fade transition */
.step-fade-enter-active { animation: fadeSlide .25s ease both; }
@keyframes fadeSlide {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
