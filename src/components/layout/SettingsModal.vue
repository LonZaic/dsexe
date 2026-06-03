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
        <h2>API Key</h2>
        <p class="sub">Enter your DeepSeek API key to start using the agent and AI features.</p>
        <div class="form-group">
          <label class="form-label">API Key</label>
          <div class="api-key-display">
            <input
              v-model="apiKeyVal"
              :type="showKey ? 'text' : 'password'"
              class="form-input-inline"
              placeholder="sk-..."
            />
            <button class="copy-btn" @click="showKey = !showKey">{{ showKey ? 'Hide' : 'Show' }}</button>
          </div>
        </div>
        <button class="form-btn" @click="saveApiKey">Save API Key</button>
        <p class="ok-msg" v-if="apiSaved">API Key saved to local disk</p>
      </template>

      <!-- Email -->
      <template v-else-if="currentTab === 'email'">
        <h2>Email (SMTP)</h2>
        <p class="sub">Configure SMTP to receive notifications. Data stored on your local disk only.</p>
        <div class="form-group">
          <label class="form-label">Provider</label>
          <select v-model="smtpProvider" @change="onProvider" class="form-input">
            <option value="">Custom</option>
            <option value="qq">QQ Mail</option>
            <option value="163">163 Mail</option>
            <option value="gmail">Gmail</option>
            <option value="outlook">Outlook</option>
          </select>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:2">
            <label class="form-label">SMTP Server</label>
            <input v-model="smtpHost" class="form-input" placeholder="smtp.example.com" />
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Port</label>
            <input v-model="smtpPort" class="form-input" placeholder="465" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Email address</label>
          <input v-model="smtpUser" class="form-input" placeholder="you@example.com" />
        </div>
        <div class="form-group">
          <label class="form-label">Auth code</label>
          <input v-model="smtpPass" type="password" class="form-input" placeholder="Not your login password" />
        </div>
        <button class="form-btn" @click="saveSMTP">Save SMTP</button>
        <p class="ok-msg" v-if="smtpSaved">SMTP saved</p>
      </template>

      <!-- Default -->
      <template v-else>
        <h2>Settings</h2>
        <p class="sub">Select a category from the sidebar to configure.</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useChatStore } from '../../store/chatStore.js'
import { loadSMTPConfig, saveSMTPConfig } from '../../utils/email.js'

const props = defineProps({ tab: String })
defineEmits(['close'])

const store = useChatStore()
const currentTab = computed(() => props.tab || 'api')

// API key
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

function saveApiKey() {
  store.setApiKey(apiKeyVal.value)
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
  apiKeyVal.value = store.apikey
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
  overflow-y: auto;
  position: relative;
}
.modal::-webkit-scrollbar { width: 4px; }
.modal::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }

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

select.form-input { cursor: pointer; appearance: auto; }

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
</style>
