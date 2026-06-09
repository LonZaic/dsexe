<template>
  <div class="mcp-form-overlay" @click.self="handleClose">
    <div class="mcp-form-modal">
      <div class="mfp-header">
        <h3>{{ editing ? '编辑 MCP 服务器' : '添加 MCP 服务器' }}</h3>
        <button class="mfp-close" @click="handleClose">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="mfp-body">
        <div class="form-group">
          <label class="form-label">服务器名称 <span class="form-required">*</span></label>
          <input v-model="form.name" class="form-input" placeholder="例如 github, filesystem, postgres" :disabled="editing" />
          <span v-if="nameError" class="form-err">{{ nameError }}</span>
        </div>

        <div class="form-group">
          <label class="form-label">传输类型</label>
          <select v-model="form.config.type" class="form-input">
            <option value="stdio">stdio (命令行启动)</option>
            <option value="http">HTTP (流式传输)</option>
            <option value="sse">SSE (服务端推送)</option>
          </select>
        </div>

        <template v-if="form.config.type === 'stdio' || !form.config.type">
          <div class="form-group">
            <label class="form-label">命令</label>
            <input v-model="form.config.command" class="form-input mono" placeholder="npx 或 uvx" />
          </div>
          <div class="form-group">
            <label class="form-label">参数</label>
            <input v-model="argsText" class="form-input mono" placeholder="-y @org/mcp-server-name" />
            <span class="form-hint">空格分隔的参数列表</span>
          </div>
        </template>

        <template v-if="form.config.type === 'http' || form.config.type === 'sse'">
          <div class="form-group">
            <label class="form-label">URL 地址</label>
            <input v-model="form.config.url" class="form-input mono" placeholder="https://mcp.example.com/mcp" />
          </div>
          <div class="form-group">
            <label class="form-label">请求头 (JSON)</label>
            <input v-model="headersText" class="form-input mono" placeholder='{"Authorization": "Bearer ..."}' />
          </div>
        </template>

        <div class="form-group">
          <label class="form-label">环境变量</label>
          <textarea v-model="envText" class="form-input env-area" placeholder="KEY1=value1&#10;KEY2=value2" rows="3"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">描述</label>
          <input v-model="form.config.description" class="form-input" placeholder="此服务器提供什么能力" />
        </div>

        <div v-if="testResult" :class="['test-result', testResult.success ? 'ok' : 'fail']">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <template v-if="testResult.success">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </template>
          </svg>
          <span>{{ testResult.success ? '连接成功！发现 ' + (testResult.toolCount || 0) + ' 个工具' : (testResult.error || '连接失败') }}</span>
        </div>

        <div v-if="saveResult" :class="['test-result', saveResult.success ? 'ok' : 'fail']">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <template v-if="saveResult.success">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </template>
          </svg>
          <span>{{ saveResult.message }}</span>
        </div>
      </div>

      <div class="mfp-actions">
        <button class="mfp-btn test" :disabled="testing" @click="testConn">
          <svg v-if="testing" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity=".25"/>
            <path d="M22 12a10 10 0 00-9-9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>{{ testing ? '测试中...' : '测试连接' }}</span>
        </button>
        <div class="mfp-right-actions">
          <button class="mfp-btn cancel" :disabled="saving" @click="handleClose">取消</button>
          <button class="mfp-btn save" :disabled="saving" @click="save">
            <svg v-if="saving" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity=".25"/>
              <path d="M22 12a10 10 0 00-9-9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>{{ saving ? '保存中...' : (editing ? '更新' : '添加服务器') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'

const props = defineProps({
  editing: { type: Boolean, default: false },
  initialName: { type: String, default: '' },
  initialConfig: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'saved'])

const form = reactive({
  name: props.initialName || '',
  config: reactive({
    type: props.initialConfig.type || 'stdio',
    command: props.initialConfig.command || '',
    args: props.initialConfig.args || [],
    url: props.initialConfig.url || '',
    headers: props.initialConfig.headers || {},
    env: props.initialConfig.env || {},
    description: props.initialConfig.description || '',
  }),
})

const argsText = ref((props.initialConfig.args || []).join(' '))
const headersText = ref('')
const envText = ref('')
const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)
const saveResult = ref(null)
const nameError = ref('')

onMounted(() => {
  if (props.initialConfig.headers && Object.keys(props.initialConfig.headers).length) {
    try { headersText.value = JSON.stringify(props.initialConfig.headers, null, 2) } catch {}
  }
  if (props.initialConfig.env && Object.keys(props.initialConfig.env).length) {
    envText.value = Object.entries(props.initialConfig.env).map(([k, v]) => `${k}=${v}`).join('\n')
  }
})

watch(argsText, (v) => {
  form.config.args = v.trim() ? v.trim().split(/\s+/) : []
})

// Clear name error when user types
watch(() => form.name, () => { nameError.value = '' })

function handleClose() {
  if (saving.value) return
  emit('close')
}

async function testConn() {
  testing.value = true
  testResult.value = null
  saveResult.value = null
  try {
    const { useMcpStore } = await import('../../stores/mcpStore.js')
    const store = useMcpStore()
    testResult.value = await store.testConnection(form.name || 'test', getConfig())
  } catch (e) {
    testResult.value = { success: false, error: e.message || '测试连接失败，请检查网络和配置' }
  } finally {
    testing.value = false
  }
}

function getConfig() {
  const config = { ...form.config }
  if (headersText.value.trim()) {
    try { config.headers = JSON.parse(headersText.value) } catch { config.headers = {} }
  }
  if (envText.value.trim()) {
    const env = {}
    envText.value.split('\n').forEach(line => {
      const idx = line.indexOf('=')
      if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    })
    config.env = env
  }
  config.description = form.config.description
  return config
}

async function save() {
  // Validate
  nameError.value = ''
  saveResult.value = null

  if (!form.name.trim()) {
    nameError.value = '请输入服务器名称'
    return
  }

  const cfg = getConfig()
  const isStdio = cfg.type === 'stdio' || !cfg.type

  if (isStdio && !cfg.command?.trim()) {
    saveResult.value = { success: false, message: '请填写命令（如 npx 或 uvx）' }
    return
  }

  saving.value = true
  try {
    const { useMcpStore } = await import('../../stores/mcpStore.js')
    const store = useMcpStore()

    if (props.editing) {
      await store.updateServer(form.name.trim(), cfg, null)
      saveResult.value = { success: true, message: '服务器 "' + form.name.trim() + '" 已更新' }
    } else {
      await store.addServer(form.name.trim(), cfg, null)
      saveResult.value = { success: true, message: '服务器 "' + form.name.trim() + '" 已添加' }
    }

    // Brief delay so user can see success, then close
    setTimeout(() => {
      emit('saved')
    }, 800)
  } catch (e) {
    saveResult.value = { success: false, message: e?.message || '保存失败，请检查网络连接' }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.mcp-form-overlay {
  position: fixed; inset: 0; z-index: var(--z-modal);
  background: rgba(0,0,0,.65);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn .2s ease;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

.mcp-form-modal {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius-lg); padding: 0;
  width: 500px; max-width: 92vw; max-height: 85vh;
  overflow: hidden; display: flex; flex-direction: column;
}
.mfp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
}
.mfp-header h3 { font-size: 15px; font-weight: 500; color: var(--text); }
.mfp-close {
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent; color: var(--text3);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .12s;
}
.mfp-close:hover { background: var(--bg3); color: var(--text2); }
.mfp-body { padding: 16px 20px; overflow-y: auto; flex: 1; }

.form-group { margin-bottom: 12px; }
.form-label { display: block; font-size: 11px; color: var(--text2); margin-bottom: 4px; font-family: inherit; }
.form-required { color: var(--red); }
.form-input {
  width: 100%; background: var(--bg3); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 10px; color: var(--text);
  font-size: 13px; font-family: inherit; font-weight: 300; outline: none;
  transition: border-color .15s; box-sizing: border-box;
}
.form-input:focus { border-color: var(--accent); }
.form-input.mono { font-family: var(--font-mono); font-size: 12px; }
.form-hint { font-size: 10px; color: var(--text3); margin-top: 4px; display: block; }
.form-err { font-size: 11px; color: var(--red); margin-top: 4px; display: block; }
.env-area { font-family: var(--font-mono); font-size: 11px; resize: vertical; }

.test-result {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 14px; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 300; margin-top: 8px; line-height: 1.5;
}
.test-result.ok { color: var(--green); background: rgba(63,185,80,0.08); }
.test-result.fail { color: var(--red); background: rgba(248,81,73,0.08); }
.test-result svg { flex-shrink: 0; margin-top: 1px; }

.mfp-actions {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; border-top: 1px solid var(--border); gap: 8px;
}
.mfp-right-actions { display: flex; gap: 8px; }

.mfp-btn {
  padding: 8px 16px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg3);
  color: var(--text2); font-size: 13px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .12s; display: flex; align-items: center; gap: 6px;
}
.mfp-btn:hover { background: var(--bg4); color: var(--text); }
.mfp-btn:disabled { opacity: .5; cursor: not-allowed; }
.mfp-btn.save { background: var(--accent); color: #fff; border-color: var(--accent); }
.mfp-btn.save:hover:not(:disabled) { background: var(--accent-hover); }
.mfp-btn.test { gap: 8px; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
</style>
