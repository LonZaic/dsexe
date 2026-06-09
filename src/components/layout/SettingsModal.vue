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

      <!-- MCP Servers -->
      <template v-else-if="currentTab === 'mcp'">
        <h2>MCP 服务器</h2>
        <p class="sub">管理 Model Context Protocol 服务器，扩展 AI 能力</p>

        <!-- MCP Servers list -->
        <div v-if="mcpStore.loading.value" class="list-loading">加载服务器列表...</div>
        <div v-else-if="mcpServers.length" class="mcp-list">
          <McpServerCard
            v-for="s in mcpServers"
            :key="s.name"
            :server="s"
            @reconnect="reconnectMcp"
            @edit="editMcpServer"
            @remove="removeMcpServer"
          />
        </div>
        <div v-else class="list-empty">暂无 MCP 服务器。添加一个来扩展 AI 能力。</div>

        <div class="tab-actions">
          <button class="tab-btn primary" @click="showMcpForm = true">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            添加服务器
          </button>
          <button class="tab-btn" @click="showMcpMarket = !showMcpMarket">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            浏览市场
          </button>
          <button class="tab-btn" @click="mcpFileInput?.click()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            上传 .json
          </button>
          <input ref="mcpFileInput" type="file" accept=".json" class="hidden-input" @change="onMcpFilePicked" />
        </div>
        <div v-if="mcpUploadMsg" :class="['upload-msg', mcpUploadOk ? 'ok' : 'fail']">{{ mcpUploadMsg }}</div>

        <!-- MCP Form modal -->
        <McpServerForm
          v-if="showMcpForm"
          :editing="editingMcp"
          :initial-name="editingMcpName"
          :initial-config="editingMcpConfig"
          @close="closeMcpForm"
          @save="saveMcpServer"
        />

        <!-- MCP Marketplace -->
        <div v-if="showMcpMarket" class="market-section">
          <div class="market-divider"></div>
          <McpMarketplace @installed="onMcpInstalled" />
        </div>
      </template>

      <!-- Skills -->
      <template v-else-if="currentTab === 'skills'">
        <h2>技能</h2>
        <p class="sub">管理 Skills — AI 可自动调用的专业指令集</p>

        <div v-if="skillStore.loading.value" class="list-loading">加载技能列表...</div>
        <div v-else-if="installedSkills.length" class="skills-list">
          <SkillCard
            v-for="s in installedSkills"
            :key="s.slug"
            :skill="s"
            @view="viewSkill"
            @delete="removeSkill"
          />
        </div>
        <div v-else class="list-empty">暂无技能。浏览市场或上传 SKILL.md 文件来添加。</div>

        <div class="tab-actions">
          <button class="tab-btn" @click="showSkillMarket = !showSkillMarket">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            浏览市场
          </button>
          <button class="tab-btn" @click="skillFileInput?.click()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            上传 SKILL.md
          </button>
          <input ref="skillFileInput" type="file" accept=".md" class="hidden-input" @change="onSkillFilePicked" />
        </div>
        <div v-if="skillUploadMsg" :class="['upload-msg', skillUploadOk ? 'ok' : 'fail']">{{ skillUploadMsg }}</div>

        <!-- Skill Marketplace -->
        <div v-if="showSkillMarket" class="market-section">
          <div class="market-divider"></div>
          <SkillMarketplace @installed="onSkillInstalled" />
        </div>

        <!-- Skill view modal -->
        <div v-if="viewingSkill" class="mcp-form-overlay" @click.self="viewingSkill = null">
          <div class="mcp-form-modal" style="width:520px">
            <div class="mfp-header">
              <h3>/{{ viewingSkill.slug }}</h3>
              <button class="mfp-close" @click="viewingSkill = null">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </button>
            </div>
            <div class="mfp-body">
              <div class="skill-detail-meta">
                <span class="skill-detail-desc">{{ viewingSkill.description }}</span>
                <span v-if="viewingSkill.source" class="sc-source">{{ viewingSkill.source }}</span>
                <span v-if="viewingSkill.agent" class="sc-source">agent: {{ viewingSkill.agent }}</span>
              </div>
              <pre class="skill-detail-body">{{ viewingSkill.body || '(No body content)' }}</pre>
            </div>
          </div>
        </div>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useChatStore } from '../../store/chatStore.js'
import { loadSMTPConfig, saveSMTPConfig } from '../../utils/email.js'
import { useI18n } from '../../composables/useI18n.js'
import { conversations as convApi } from '../../api/index.js'
import { useMcpStore } from '../../stores/mcpStore.js'
import { useSkillStore } from '../../stores/skillStore.js'
import McpServerCard from '../mcp/McpServerCard.vue'
import McpServerForm from '../mcp/McpServerForm.vue'
import McpMarketplace from '../mcp/McpMarketplace.vue'
import SkillCard from '../skills/SkillCard.vue'
import SkillMarketplace from '../skills/SkillMarketplace.vue'

const { t } = useI18n()
const mcpStore = useMcpStore()
const skillStore = useSkillStore()

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

// MCP state
const showMcpForm = ref(false)
const showMcpMarket = ref(false)
const editingMcp = ref(false)
const editingMcpName = ref('')
const editingMcpConfig = ref({})
const mcpServers = computed(() => mcpStore.servers.value)

// Skills state
const showSkillMarket = ref(false)
const viewingSkill = ref(null)
const installedSkills = computed(() => skillStore.skills.value)

async function loadMcpData() {
  await mcpStore.loadServers(null)
}

async function loadSkillsData() {
  await skillStore.loadSkills(null)
}

async function reconnectMcp(name) {
  await mcpStore.reconnectServer(name, null)
}

function editMcpServer(name) {
  const server = mcpServers.value.find(s => s.name === name)
  if (!server) return
  editingMcp.value = true
  editingMcpName.value = name
  editingMcpConfig.value = server.config || {}
  showMcpForm.value = true
}

async function removeMcpServer(name) {
  if (!confirm(`Remove MCP server "${name}"?`)) return
  await mcpStore.deleteServer(name, null)
}

function closeMcpForm() {
  showMcpForm.value = false
  editingMcp.value = false
  editingMcpName.value = ''
  editingMcpConfig.value = {}
}

async function saveMcpServer({ name, config }) {
  if (editingMcp.value) {
    await mcpStore.updateServer(name, config, null)
  } else {
    await mcpStore.addServer(name, config, null)
  }
  closeMcpForm()
}

function onMcpInstalled() {
  loadMcpData()
}

function viewSkill(slug) {
  const skill = installedSkills.value.find(s => s.slug === slug)
  if (skill) {
    // Fetch full skill body
    import('../../api/skills.api.js').then(({ skillsApi }) => {
      skillsApi.getSkill(slug).then(data => {
        viewingSkill.value = data?.skill || skill
      }).catch(() => {
        viewingSkill.value = skill
      })
    })
  }
}

async function removeSkill(slug) {
  if (!confirm(`Delete skill "/${slug}"?`)) return
  await skillStore.deleteSkill(slug, null)
}

function onSkillInstalled() {
  loadSkillsData()
}

// MCP file upload state
const mcpFileInput = ref(null)
const mcpUploadMsg = ref('')
const mcpUploadOk = ref(false)

async function onMcpFilePicked(e) {
  const file = e.target.files?.[0]
  if (!file) return
  mcpUploadMsg.value = ''
  try {
    const text = await file.text()
    const { mcpApi } = await import('../../api/mcp.api.js')
    const result = await mcpApi.uploadConfig(file.name, text, null)
    mcpUploadMsg.value = `Imported ${result.added} server(s): ${(result.servers || []).join(', ')}`
    mcpUploadOk.value = true
    await loadMcpData()
  } catch (e) {
    mcpUploadMsg.value = e.message || 'Upload failed'
    mcpUploadOk.value = false
  } finally {
    if (mcpFileInput.value) mcpFileInput.value.value = ''
  }
}

// Skills file upload state
const skillFileInput = ref(null)
const skillUploadMsg = ref('')
const skillUploadOk = ref(false)

async function onSkillFilePicked(e) {
  const file = e.target.files?.[0]
  if (!file) return
  skillUploadMsg.value = ''
  try {
    const text = await file.text()
    const { skillsApi } = await import('../../api/skills.api.js')
    const result = await skillsApi.uploadSkillFile(file.name, text, null)
    skillUploadMsg.value = `Installed: /${result.slug}`
    skillUploadOk.value = true
    await loadSkillsData()
  } catch (e) {
    skillUploadMsg.value = e.message || 'Upload failed'
    skillUploadOk.value = false
  } finally {
    if (skillFileInput.value) skillFileInput.value.value = ''
  }
}

// Load MCP and Skills data when these tabs open
watch(() => props.tab, (newTab) => {
  if (newTab === 'mcp') loadMcpData()
  if (newTab === 'skills') loadSkillsData()
})

onMounted(() => {
  // Original: API key + SMTP
  store.loadApiKey()
  keyMode.value = localStorage.getItem('key_mode') || (store.apikey ? 'own' : 'builtin')
  apiKeyVal.value = keyMode.value === 'own' ? store.apikey : ''
  const c = loadSMTPConfig()
  if (c) {
    smtpHost.value = c.host || ''
    smtpPort.value = c.port || '465'
    smtpUser.value = c.user || ''
    smtpPass.value = c.pass || ''
  }
  // MCP + Skills
  if (props.tab === 'mcp') loadMcpData()
  if (props.tab === 'skills') loadSkillsData()
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

/* MCP & Skills tabs */
.list-loading { text-align: center; color: var(--text3); font-size: 13px; font-weight: 300; padding: 20px; }
.list-empty { text-align: center; color: var(--text3); font-size: 12px; font-weight: 300; padding: 16px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.tab-actions { display: flex; gap: 8px; margin-top: 12px; }
.tab-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg3);
  color: var(--text2); font-size: 12px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .12s;
}
.tab-btn:hover { background: var(--bg4); color: var(--text); border-color: var(--border2); }
.tab-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.tab-btn.primary:hover { background: var(--accent-hover); }
.market-section { margin-top: 0; }
.market-divider { height: 1px; background: var(--border); margin: 16px 0; }

/* Skill detail in modal */
.skill-detail-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; align-items: center; }
.skill-detail-desc { font-size: 12px; color: var(--text2); font-weight: 300; flex: 1; }
.sc-source { font-size: 10px; padding: 2px 7px; border-radius: var(--radius-full); background: var(--bg4); color: var(--text2); }
.skill-detail-body {
  font-size: 12px; font-family: var(--font-mono); color: var(--text2);
  background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 12px; max-height: 300px; overflow-y: auto; white-space: pre-wrap;
  line-height: 1.5; margin: 0;
}

.upload-msg { font-size: 11px; font-weight: 300; margin-top: 8px; }
.upload-msg.ok { color: var(--green); }
.upload-msg.fail { color: var(--red); }
.hidden-input { display: none; }
</style>
