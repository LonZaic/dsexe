<template>
  <div class="tk-bar">
    <!-- Token usage: used / context window -->
    <div class="tk-item" :title="tokenTooltip">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1" y="1" width="9" height="9" rx="2" stroke="currentColor" stroke-width=".9"/><line x1="3.5" y1="3.5" x2="7.5" y2="3.5" stroke="currentColor" stroke-width=".7"/><line x1="3.5" y1="5.5" x2="6.5" y2="5.5" stroke="currentColor" stroke-width=".7"/><line x1="3.5" y1="7.5" x2="5.5" y2="7.5" stroke="currentColor" stroke-width=".7"/></svg>
      <span class="tk-val">{{ fmtNum(totalTokens) }}</span>
      <span class="tk-unit"> / {{ fmtNum(contextLimit) }}</span>
    </div>

    <!-- Progress bar — relative to model context window -->
    <div class="tk-bar-wrap">
      <div class="tk-bar-fill" :style="{ width: pct + '%' }" :class="{ warn: pct > 50, danger: pct > 80 }"></div>
    </div>

    <!-- Cost this session -->
    <div class="tk-item" :title="costTooltip">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" stroke-width=".9"/><text x="5.5" y="8" text-anchor="middle" font-size="7" fill="currentColor" font-family="sans-serif">&#165;</text></svg>
      <span class="tk-val">{{ costStr }}</span>
    </div>

    <!-- Account balance (live from DeepSeek API) -->
    <div class="tk-item" :title="balanceTooltip" v-if="balance != null">
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1.5" y="2.5" width="8" height="7" rx="1.5" stroke="currentColor" stroke-width=".9"/><line x1="5.5" y1="1" x2="5.5" y2="4" stroke="currentColor" stroke-width=".8"/><circle cx="5.5" cy="6" r="1.2" fill="var(--green)" opacity=".7"/></svg>
      <span class="tk-val tk-balance">{{ balanceStr }}</span>
    </div>

    <!-- Model badge -->
    <div class="tk-item tk-model">
      <span class="tk-model-dot" :class="modelClass"></span>
      <span class="tk-model-name">{{ modelLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  promptTokens: { type: Number, default: 0 },
  completionTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  /** @deprecated 使用模型真实上下文窗口，此 prop 仅在特殊覆盖时使用 */
  maxTokens: { type: Number, default: 0 },
  model: { type: String, default: 'deepseek-v4-pro' },
  balance: { type: Number, default: null },
})

const emit = defineEmits(['refresh-balance'])

// ═══════════════════════════════════════════════════════════
// DeepSeek 官方定价 (2026-05 永久价格, RMB / 1M tokens)
// Source: https://api-docs.deepseek.com/quick_start/pricing
// ═══════════════════════════════════════════════════════════
const PRICING = {
  'deepseek-v4-pro': {
    input: 3,          // 缓存未命中 ¥3/1M
    inputCached: 0.025, // 缓存命中 ¥0.025/1M (≈$0.003625)
    output: 6,          // ¥6/1M
  },
  'deepseek-v4-flash': {
    input: 1,          // 缓存未命中 ¥1/1M
    inputCached: 0.02,  // 缓存命中 ¥0.02/1M (≈$0.0028)
    output: 2,          // ¥2/1M
  },
}

// ═══════════════════════════════════════════════════════════
// 模型上下文窗口 (来自 DeepSeek API 文档)
// DeepSeek V4 Pro:   1,000,000 tokens (1M), 最大输出 384K
// DeepSeek V4 Flash: 1,000,000 tokens (1M), 最大输出 384K
// ═══════════════════════════════════════════════════════════
const MODEL_MAX = {
  'deepseek-v4-pro':   1_000_000,
  'deepseek-v4-flash': 1_000_000,
}

// 模型最大输出 tokens（用于参考）
const MODEL_MAX_OUTPUT = {
  'deepseek-v4-pro':   384_000,
  'deepseek-v4-flash': 384_000,
}

// ─── 派生数据 ───
const pricing = computed(() => PRICING[props.model] || PRICING['deepseek-v4-pro'])
const priceInput = computed(() => pricing.value.input)
const priceInputCached = computed(() => pricing.value.inputCached)
const priceOutput = computed(() => pricing.value.output)
const modelContext = computed(() => MODEL_MAX[props.model] ?? 1_000_000)
const maxOutput = computed(() => MODEL_MAX_OUTPUT[props.model] ?? 384_000)

// 上下文窗口：优先使用传入的 maxTokens，否则用模型真实窗口
const contextLimit = computed(() => props.maxTokens > 0 ? props.maxTokens : modelContext.value)

// ─── 精确成本计算 ───
// cost = prompt_tokens/1M × input_price + completion_tokens/1M × output_price
const cost = computed(() => {
  const p = pricing.value
  const inputCost = (props.promptTokens / 1_000_000) * p.input
  const outputCost = (props.completionTokens / 1_000_000) * p.output
  return inputCost + outputCost
})

// 如果全部命中缓存的最低成本
const costMin = computed(() => {
  const p = pricing.value
  return (props.promptTokens / 1_000_000) * (p.inputCached || 0) + (props.completionTokens / 1_000_000) * p.output
})

const costStr = computed(() => {
  const c = cost.value
  if (c <= 0) return '¥0'
  if (c < 0.001) return '<¥0.001'
  if (c < 0.01) return '¥' + c.toFixed(4)
  if (c < 1) return '¥' + c.toFixed(3)
  return '¥' + c.toFixed(2)
})

const costTooltip = computed(() => {
  const min = costMin.value
  const lines = [
    'DeepSeek 官方定价 (2026-05 永久生效)',
    '',
    '▸ 输入: ¥' + priceInput.value + '/1M tokens × ' + fmtNum(props.promptTokens),
    '  缓存命中时: ¥' + priceInputCached.value + '/1M tokens',
    '▸ 输出: ¥' + priceOutput.value + '/1M tokens × ' + fmtNum(props.completionTokens),
    '',
    '本次会话费用: ' + costStr.value,
  ]
  if (min > 0 && min < cost.value) {
    lines.push('(若全部缓存命中: ¥' + min.toFixed(4) + ')')
  }
  lines.push('',
    '模型上下文: ' + fmtNum(modelContext.value),
    '最大输出: ' + fmtNum(maxOutput.value))
  return lines.join('\n')
})

// ─── 进度条 (相对于上下文窗口) ───
const pct = computed(() => {
  const limit = contextLimit.value
  if (limit <= 0) return 0
  return Math.min(100, Math.round((props.totalTokens / limit) * 1000) / 10)
})

// ─── Token 详情 tooltip ───
const tokenTooltip = computed(() => {
  return [
    '已用 token: ' + fmtNum(props.totalTokens),
    '  输入: ' + fmtNum(props.promptTokens),
    '  输出: ' + fmtNum(props.completionTokens),
    '上下文窗口: ' + fmtNum(contextLimit.value),
    '使用率: ' + pct.value.toFixed(1) + '%',
    pct.value > 80 ? '[!] 上下文接近上限，建议新开会话' : ''
  ].filter(Boolean).join('\n')
})

// ─── 余额 ───
const balanceStr = computed(() => {
  if (props.balance == null) return ''
  return '¥' + Number(props.balance).toFixed(2)
})

const balanceTooltip = computed(() => {
  if (props.balance == null) return ''
  const c = cost.value
  if (c <= 0) return '账户余额: ' + balanceStr.value
  const remainingSessions = Math.floor(props.balance / c)
  return [
    '账户余额: ' + balanceStr.value,
    '本次费用: ' + costStr.value,
    '≈ 还可进行 ' + remainingSessions + ' 次类似会话'
  ].join('\n')
})

// ─── Model badge ───
const modelLabel = computed(() => {
  if (props.model === 'deepseek-v4-pro') return 'V4-Pro'
  if (props.model === 'deepseek-v4-flash') return 'V4-Flash'
  return props.model
})
const modelClass = computed(() => props.model.includes('flash') ? 'flash' : 'pro')

// ─── 余额定时刷新 (每 60s) ───
let refreshTimer = null
onMounted(() => {
  refreshTimer = setInterval(() => {
    emit('refresh-balance')
  }, 60_000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

// ─── 数字格式化 ───
function fmtNum(n) {
  if (n == null || isNaN(n)) return '0'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(Math.round(n))
}
</script>

<style scoped>
.tk-bar { display: flex; align-items: center; gap: 8px; padding: 3px 10px; font-size: 10px; color: var(--text3); font-weight: 300; border-top: 1px solid var(--border); background: var(--bg2); user-select: none; flex-shrink: 0; }
.tk-item { display: flex; align-items: center; gap: 3px; flex-shrink: 0; white-space: nowrap; }
.tk-item svg { opacity: .45; flex-shrink: 0; }
.tk-val { color: var(--text2); font-variant-numeric: tabular-nums; font-weight: 400; }
.tk-unit { opacity: .5; }
.tk-bar-wrap { flex: 1; height: 2px; background: var(--bg4); border-radius: 2px; overflow: hidden; min-width: 20px; }
.tk-bar-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width .3s ease; }
.tk-bar-fill.warn { background: var(--yellow); }
.tk-bar-fill.danger { background: var(--red); }
.tk-model { margin-left: auto; }
.tk-model-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.tk-model-dot.pro { background: var(--accent); }
.tk-model-dot.flash { background: var(--yellow); }
.tk-model-name { opacity: .6; font-size: 9px; }
.tk-balance { color: var(--green); }
</style>
