<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <button class="modal-close" @click="$emit('close')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- API Key -->
      <template v-if="currentTab === 'api'">
        <h2>{{ t('apiModalTitle') }}</h2>
        <p class="sub">{{ t('apiModalSub') }}</p>

        <!-- Option 1: Built-in key -->
        <label :class="['radio-card', { active: keyMode === 'builtin' }]" @click="keyMode = 'builtin'">
          <div class="radio-dot"><span v-if="keyMode === 'builtin'" class="radio-fill"></span></div>
          <div class="radio-body">
            <span class="radio-title">{{ t('cloudKey') }}</span>
            <span class="radio-desc">{{ t('cloudKeyDesc') }}</span>
          </div>
          <svg v-if="keyMode === 'builtin'" class="radio-check-svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7.5l2.5 2.5L11 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </label>

        <!-- Option 2: Own key -->
        <label :class="['radio-card', { active: keyMode === 'own' }]" @click="keyMode = 'own'">
          <div class="radio-dot"><span v-if="keyMode === 'own'" class="radio-fill"></span></div>
          <div class="radio-body">
            <span class="radio-title">{{ t('ownKey') }}</span>
            <span class="radio-desc">{{ t('ownKeyDesc') }}</span>
          </div>
          <svg v-if="keyMode === 'own'" class="radio-check-svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7.5l2.5 2.5L11 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </label>

        <!-- Own key input -->
        <div v-if="keyMode === 'own'" class="form-group" style="margin-top:12px">
          <div class="api-key-display">
            <input
              v-model="apiKeyVal"
              :type="showKey ? 'text' : 'password'"
              class="form-input-inline"
              placeholder="sk-..."
            />
            <button class="copy-btn" @click="showKey = !showKey">{{ showKey ? t('hideKey') : t('showKey') }}</button>
          </div>
        </div>

        <!-- Red warning when own key selected but empty on save -->
        <div v-if="showWarn" class="warn-msg">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M7 4v3.5M7 10v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          {{ t('fillApiKey') }}
        </div>

        <button class="form-btn" @click="saveApiKey">{{ t('saveApiKey') }}</button>
        <p class="ok-msg" v-if="apiSaved">{{ t('apiKeySaved') }}</p>
      </template>

      <!-- Email -->
      <template v-else-if="currentTab === 'email'">
        <h2>{{ t('emailModalTitle') }}</h2>
        <p class="sub">{{ t('emailModalSub') }}</p>
        <div class="form-group">
          <label class="form-label">{{ t('smtpProvider') }}</label>
          <select v-model="smtpProvider" @change="onProvider" class="form-input">
            <option value="">{{ t('custom') }}</option>
            <option value="qq">QQ Mail</option>
            <option value="163">163 Mail</option>
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">{{ t('smtpServer') }}</label>
            <input v-model="smtpHost" class="form-input" placeholder="smtp.example.com" />
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">{{ t('smtpPort') }}</label>
            <input v-model="smtpPort" class="form-input" placeholder="465" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('smtpEmail') }}</label>
          <input v-model="smtpUser" class="form-input" placeholder="you@example.com" />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('smtpAuth') }}</label>
          <input v-model="smtpPass" type="password" class="form-input" :placeholder="t('smtpAuthHint')" />
        </div>
        <button class="form-btn" @click="saveSMTP">{{ t('saveSMTP') }}</button>
        <p class="ok-msg" v-if="smtpSaved">{{ t('smtpSaved') }}</p>
      </template>

      <!-- Data Export/Import -->
      <template v-else-if="currentTab === 'data'">
        <h2>{{ t('dataTabTitle') }}</h2>
        <p class="sub">{{ t('dataTabSub') }}</p>

        <div class="data-actions">
          <button class="data-btn" @click="doExport" :disabled="exporting">
            <svg v-if="!exporting" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v9M4 7l4 4 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 13h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <svg v-else class="spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3" opacity="0.3"/>
              <path d="M8 2a6 6 0 0 1 5.2 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <span>{{ exporting ? t('exporting') : t('exportData') }}</span>
          </button>

          <label class="data-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 12V3M4 7l4-4 4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 13h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <span>{{ t('importData') }}</span>
            <input type="file" accept=".json" hidden @change="doImport" />
          </label>
        </div>

        <p v-if="importMsg" :class="['data-msg', importOk ? 'ok-msg' : 'warn-msg']">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <template v-if="importOk">
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/>
              <path d="M4 7.5l2.5 2.5L10 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/>
              <path d="M7 4v3.5M7 10v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </template>
          </svg>
          {{ importMsg }}
        </p>
      </template>

      <!-- Default -->
      <template v-else>
        <h2>{{ t('settingsTitle') }}</h2>
        <p class="sub">{{ t('settingsSub') }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useChatStore } from '../../store/chatStore.js'
import { loadSMTPConfig, saveSMTPConfig } from '../../utils/email.js'
import { useI18n } from '../../composables/useI18n.js'
import { conversations as convApi } from '../../api/index.js'

const { t } = useI18n()

const props = defineProps({ tab: String })
defineEmits(['close'])

const store = useChatStore()
const currentTab = computed(() => props.tab || 'api')

// API key
const keyMode = ref('builtin')  // 'builtin' | 'own'
const apiKeyVal = ref('')
const showKey = ref(false)
const apiSaved = ref(false)

// SMTP
const smtpHost = ref('')
const smtpPort = ref('465')
const smtpUser = ref('')
const smtpPass = ref('')
const smtpProvider = ref('')
const smtpSaved = ref(false)

const providers = {
  qq: { host: 'smtp.qq.com', port: '465', domain: '@qq.com' },
  '163': { host: 'smtp.163.com', port: '465', domain: '@163.com' },
  gmail: { host: 'smtp.gmail.com', port: '465', domain: '@gmail.com' },
  outlook: { host: 'smtp-mail.outlook.com', port: '587', domain: '@outlook.com' },
}

function onProvider() {
  const p = providers[smtpProvider.value]
  if (p) {
    smtpHost.value = p.host
    smtpPort.value = p.port
  }
}

const showWarn = ref(false)

// Data export/import
const exporting = ref(false)
const importMsg = ref('')
const importOk = ref(false)

async function doExport() {
  exporting.value = true
  try {
    const data = await convApi.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'deepseek-chat-data.json'
    a.click()
    URL.revokeObjectURL(url)
    importMsg.value = t('exportSuccess')
    importOk.value = true
    setTimeout(() => { importMsg.value = '' }, 3000)
  } catch (e) {
    importMsg.value = t('exportError') + ': ' + e.message
    importOk.value = false
  } finally {
    exporting.value = false
  }
}

async function doImport(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!data.conversations || !Array.isArray(data.conversations)) {
      importMsg.value = t('importInvalid')
      importOk.value = false
      return
    }
    const result = await convApi.importAll(data)
    importMsg.value = t('importSuccess').replace('{n}', result.imported)
    importOk.value = true
    // Reload conversations list in the store
    const store = useChatStore()
    await store.loadConversations()
    setTimeout(() => { importMsg.value = '' }, 5000)
  } catch (e) {
    importMsg.value = t('importError') + ': ' + e.message
    importOk.value = false
  }
  // Reset file input
  e.target.value = ''
}

function saveApiKey() {
  if (keyMode.value === 'own' && !apiKeyVal.value.trim()) {
    showWarn.value = true
    apiSaved.value = false
    setTimeout(() => showWarn.value = false, 3000)
    return
  }
  showWarn.value = false
  if (keyMode.value === 'own') {
    store.setApiKey(apiKeyVal.value)
    localStorage.setItem('key_mode', 'own')
  } else {
    store.setApiKey('')
    localStorage.setItem('key_mode', 'builtin')
  }
  apiSaved.value = true
  setTimeout(() => apiSaved.value = false, 2000)
}

function saveSMTP() {
  saveSMTPConfig({ host: smtpHost.value, port: smtpPort.value, user: smtpUser.value, pass: smtpPass.value })
  smtpSaved.value = true
  setTimeout(() => smtpSaved.value = false, 2000)
}

onMounted(() => {
  store.loadApiKey()
  keyMode.value = localStorage.getItem('key_mode') || (store.apikey ? 'own' : 'builtin')
  // Never pre-fill the key from store in builtin mode
  apiKeyVal.value = keyMode.value === 'own' ? store.apikey : ''
  const c = loadSMTPConfig()
  if (c) {
    smtpHost.value = c.host || ''
    smtpPort.value = c.port || '465'
    smtpUser.value = c.user || ''
    smtpPass.value = c.pass || ''
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.65);
  z-index: var(--z-modal);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn .2s ease;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

.modal {
  background: var(--bg2);
  border: 1px solid var(--border2);
  border-radius: var(--radius-lg);
  padding: 28px;
  width: 460px;
  max-width: 92vw;
  max-height: 85vh;
  overflow: visible;
  position: relative;
}
.modal h2 {
  font-size: 18px; font-weight: 500;
  color: var(--text);
  margin-bottom: 6px;
}
.modal p.sub {
  font-size: 13px; color: var(--text3);
  margin-bottom: 20px; line-height: 1.5; font-weight: 300;
}

.modal-close {
  position: absolute; top: 16px; right: 16px;
  width: 28px; height: 28px;
  border-radius: 6px;
  border: none; background: transparent;
  color: var(--text3);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .1s;
}
.modal-close:hover { background: var(--bg3); color: var(--text2); }

.form-group { margin-bottom: 14px; }
.form-label {
  display: block;
  font-size: 12px; color: var(--text2);
  margin-bottom: 6px; letter-spacing: .02em;
}
.form-input {
  width: 100%;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text);
  font-size: 14px;
  font-family: inherit;
  font-weight: 300;
  outline: none;
  transition: border-color .15s;
}
.form-input:focus { border-color: var(--border2); }

.form-input-inline {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 13px;
  font-family: monospace;
  font-weight: 300;
  outline: none;
  padding: 0;
}

.api-key-display {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}

.form-row { display: flex; gap: 12px; }

.form-btn {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  font-weight: 400;
  cursor: pointer;
  transition: background .15s;
}
.form-btn:hover { background: var(--accent-hover); }

.ok-msg { font-size: 12px; color: var(--green); margin-top: 8px; font-weight: 300; }

select.form-input { cursor: pointer; appearance: auto; padding-right: 28px; }

/* Radio cards */
.radio-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
  user-select: none;
}
.radio-card:hover { background: var(--bg3); }
.radio-card.active { border-color: var(--accent); background: var(--accent-muted); }
.radio-dot {
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: border-color .15s;
}
.radio-card.active .radio-dot { border-color: var(--accent); }
.radio-fill {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--accent);
}
.radio-body { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.radio-title { font-size: 14px; color: var(--text); font-weight: 400; }
.radio-desc { font-size: 11px; color: var(--text3); font-weight: 300; }
.radio-card.active .radio-desc { color: var(--text2); }
.radio-check-svg { color: var(--accent); flex-shrink: 0; }

/* Warning */
.warn-msg {
  display: flex; align-items: center; gap: 6px;
  color: var(--red); font-size: 12px; font-weight: 400;
  margin-bottom: 12px;
}

.copy-btn {
  padding: 3px 8px;
  border-radius: 5px;
  border: none;
  background: var(--bg4);
  color: var(--text2);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition: background .1s;
}
.copy-btn:hover { background: var(--border); color: var(--text); }

/* Data tab */
.data-actions {
  display: flex; gap: 10px; margin-bottom: 16px;
}
.data-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 20px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg3);
  color: var(--text2);
  font-size: 14px; font-weight: 400;
  font-family: inherit;
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
  flex: 1;
  justify-content: center;
}
.data-btn:hover { background: var(--bg4); border-color: var(--border2); color: var(--text); }
.data-btn:disabled { opacity: .5; cursor: not-allowed; }
.data-btn svg { flex-shrink: 0; color: var(--text3); }
.data-btn:hover svg { color: var(--text2); }

.data-msg {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 300; line-height: 1.5;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
</style>
