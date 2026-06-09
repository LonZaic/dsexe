<template>
  <Transition name="settings-slide">
    <div v-if="visible" class="sp-overlay">
      <div class="sp-backdrop" @click="$emit('close')"></div>
      <div class="sp-panel">
        <!-- Header -->
        <div class="sp-hdr">
          <h2 class="sp-title">设置</h2>
          <button class="sp-close" @click="$emit('close')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="sp-tabs">
          <button :class="['sp-tab', { active: tab === 'api' }]" @click="tab = 'api'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
            </svg>
            API 密钥
          </button>
          <button :class="['sp-tab', { active: tab === 'email' }]" @click="tab = 'email'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="1.3"/>
              <path d="M2 6l10 8 10-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            邮箱
          </button>
          <button :class="['sp-tab', { active: tab === 'lang' }]" @click="tab = 'lang'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.3"/>
              <ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" stroke-width="1.3"/>
              <path d="M3 12h18M12 3v18" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
            </svg>
            语言
          </button>
          <button :class="['sp-tab', { active: tab === 'data' }]" @click="tab = 'data'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.3"/>
              <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            数据
          </button>
        </div>

        <!-- Content -->
        <div class="sp-body">
          <!-- ═══ API Keys Tab ═══ -->
          <template v-if="tab === 'api'">
            <div class="sp-section">
              <p class="sp-sub">配置各服务的 API Key 或 Token。留空则不启用对应功能。</p>
            </div>

            <!-- DeepSeek -->
            <div class="sp-key-group sp-key-group-accent">
              <div class="sp-key-hdr">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="sp-icon-accent">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                <span class="sp-hdr-accent">DeepSeek API Key</span>
                <span class="sp-key-required">必需</span>
              </div>

              <!-- Built-in -->
              <label :class="['sp-radio', { active: dsKeyMode === 'builtin' }]" @click="dsKeyMode = 'builtin'">
                <div class="sp-radio-dot"><span v-if="dsKeyMode === 'builtin'" class="sp-radio-fill"></span></div>
                <div class="sp-radio-body">
                  <span class="sp-radio-title">使用内置 Key（推荐）</span>
                  <span class="sp-radio-desc">无需配置，服务端已预置</span>
                </div>
                <svg v-if="dsKeyMode === 'builtin'" width="14" height="14" viewBox="0 0 14 14" fill="none" class="sp-radio-check">
                  <path d="M3 7.5l2.5 2.5L11 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </label>

              <!-- Own key -->
              <label :class="['sp-radio', { active: dsKeyMode === 'own' }]" @click="dsKeyMode = 'own'">
                <div class="sp-radio-dot"><span v-if="dsKeyMode === 'own'" class="sp-radio-fill"></span></div>
                <div class="sp-radio-body">
                  <span class="sp-radio-title">使用自己的 Key</span>
                  <span class="sp-radio-desc">填入你自己的 DeepSeek API Key</span>
                </div>
                <svg v-if="dsKeyMode === 'own'" width="14" height="14" viewBox="0 0 14 14" fill="none" class="sp-radio-check">
                  <path d="M3 7.5l2.5 2.5L11 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </label>

              <template v-if="dsKeyMode === 'own'">
                <div class="sp-key-input" style="margin-top:8px">
                  <input v-model="apiKeyVal" :type="showApiKey ? 'text' : 'password'" class="sp-input" placeholder="sk-..." />
                  <button class="sp-eye" @click="showApiKey = !showApiKey">
                    <svg v-if="showApiKey" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/>
                    </svg>
                    <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </template>
              <button class="sp-save-btn" style="margin-top:8px" @click="saveApiKey">{{ apiKeySaving ? '保存中...' : '保存' }}</button>
              <span v-if="apiKeyMsg" :class="['sp-msg', apiKeyMsgOk ? 'ok' : 'fail']">{{ apiKeyMsg }}</span>
            </div>

            <!-- GitHub -->
            <div class="sp-key-group">
              <div class="sp-key-hdr">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>GitHub Token</span>
                <span v-if="gitHubSet" class="sp-key-status ok">已配置</span>
                <span v-else class="sp-key-status no">未配置</span>
              </div>
              <div class="sp-key-input">
                <input v-model="gitHubVal" :type="showGitHub ? 'text' : 'password'" class="sp-input" placeholder="ghp_..." />
                <button class="sp-eye" @click="showGitHub = !showGitHub">
                  <svg v-if="showGitHub" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/>
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <button class="sp-save-btn" @click="saveGitHub">{{ gitHubSaving ? '保存中...' : '保存' }}</button>
              <span v-if="gitHubMsg" :class="['sp-msg', gitHubMsgOk ? 'ok' : 'fail']">{{ gitHubMsg }}</span>
            </div>

            <!-- Notion -->
            <div class="sp-key-group">
              <div class="sp-key-hdr">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M3 9h18" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M9 9v12" stroke="currentColor" stroke-width="1.3"/>
                </svg>
                <span>Notion API Key</span>
                <span v-if="notionSet" class="sp-key-status ok">已配置</span>
                <span v-else class="sp-key-status no">未配置</span>
              </div>
              <div class="sp-key-input">
                <input v-model="notionVal" :type="showNotion ? 'text' : 'password'" class="sp-input" placeholder="secret_..." />
                <button class="sp-eye" @click="showNotion = !showNotion">
                  <svg v-if="showNotion" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/>
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <button class="sp-save-btn" @click="saveNotion">{{ notionSaving ? '保存中...' : '保存' }}</button>
              <span v-if="notionMsg" :class="['sp-msg', notionMsgOk ? 'ok' : 'fail']">{{ notionMsg }}</span>
            </div>

            <!-- AMAP -->
            <div class="sp-key-group">
              <div class="sp-key-hdr">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8 2 4 5.5 4 10c0 5 8 12 8 12s8-7 8-12c0-4.5-4-8-8-8z" stroke="currentColor" stroke-width="1.3"/>
                  <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.3"/>
                </svg>
                <span>高德地图 Key</span>
                <span v-if="amapSet" class="sp-key-status ok">已配置</span>
                <span v-else class="sp-key-status no">未配置</span>
              </div>
              <div class="sp-key-input">
                <input v-model="amapVal" :type="showAmap ? 'text' : 'password'" class="sp-input" placeholder="高德 Web 服务 Key" />
                <button class="sp-eye" @click="showAmap = !showAmap">
                  <svg v-if="showAmap" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/>
                  </svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M1 1l22 22" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <button class="sp-save-btn" @click="saveAmap">{{ amapSaving ? '保存中...' : '保存' }}</button>
              <span v-if="amapMsg" :class="['sp-msg', amapMsgOk ? 'ok' : 'fail']">{{ amapMsg }}</span>
            </div>
          </template>

          <!-- ═══ Email Tab ═══ -->
          <template v-if="tab === 'email'">
            <p class="sp-sub">配置 SMTP 邮箱服务，AI 可以通过邮件发送内容。</p>

            <div class="sp-key-group">
              <div class="sp-key-hdr">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M2 6l10 8 10-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>SMTP 配置</span>
                <span v-if="smtpSet" class="sp-key-status ok">已配置</span>
                <span v-else class="sp-key-status no">未配置</span>
              </div>

              <div class="sp-field">
                <label class="sp-label">服务商</label>
                <select v-model="smtpProvider" @change="onSmtpProvider" class="sp-input">
                  <option value="">自定义</option>
                  <option value="qq">QQ Mail</option>
                  <option value="163">163 Mail</option>
                  <option value="gmail">Gmail</option>
                  <option value="outlook">Outlook</option>
                </select>
              </div>
              <div class="sp-row">
                <div class="sp-field" style="flex:2">
                  <label class="sp-label">服务器</label>
                  <input v-model="smtpHost" class="sp-input" placeholder="smtp.example.com" />
                </div>
                <div class="sp-field" style="flex:1">
                  <label class="sp-label">端口</label>
                  <input v-model="smtpPort" class="sp-input" placeholder="465" />
                </div>
              </div>
              <div class="sp-field">
                <label class="sp-label">邮箱地址</label>
                <input v-model="smtpUser" class="sp-input" placeholder="you@example.com" />
              </div>
              <div class="sp-field">
                <label class="sp-label">授权码</label>
                <input v-model="smtpPass" type="password" class="sp-input" placeholder="SMTP 授权码或密码" />
              </div>
              <button class="sp-save-btn" @click="saveSmtp">{{ smtpSaving ? '保存中...' : '保存' }}</button>
              <span v-if="smtpMsg" :class="['sp-msg', smtpMsgOk ? 'ok' : 'fail']">{{ smtpMsg }}</span>
            </div>
          </template>

          <!-- ═══ Language Tab ═══ -->
          <template v-if="tab === 'lang'">
            <p class="sp-sub">选择界面语言。</p>
            <div class="sp-lang-list">
              <button
                v-for="m in LANG_META"
                :key="m.code"
                :class="['sp-lang-opt', { active: currentLang === m.code }]"
                @click="selectLang(m.code)"
              >
                <span class="sp-lang-name">{{ isZh ? m.native : m.en }}</span>
                <span class="sp-lang-en">{{ isZh ? m.en : m.native }}</span>
                <svg v-if="currentLang === m.code" width="16" height="16" viewBox="0 0 24 24" fill="none" class="sp-lang-check">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </template>

          <!-- ═══ Data Tab ═══ -->
          <template v-if="tab === 'data'">
            <p class="sp-sub">导出或导入对话数据。</p>

            <div class="sp-data-actions">
              <button class="sp-data-btn" @click="doExport" :disabled="exporting">
                <svg v-if="!exporting" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v10M8 11l4 4 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                <span>{{ exporting ? '导出中...' : '导出对话数据' }}</span>
              </button>
              <label class="sp-data-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 19V9M8 13l4 4 4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                <span>导入对话数据</span>
                <input type="file" accept=".json" hidden @change="doImport" />
              </label>
            </div>
            <span v-if="dataMsg" :class="['sp-msg', dataMsgOk ? 'ok' : 'fail']">{{ dataMsg }}</span>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useChatStore } from '../../store/chatStore.js'
import { loadSMTPConfig, saveSMTPConfig } from '../../utils/email.js'
import { conversations as convApi } from '../../api/index.js'
import { useI18n } from '../../composables/useI18n.js'

const props = defineProps({ visible: Boolean })
const emit = defineEmits(['close'])

const store = useChatStore()
const { t, lang, setLang, langDisplay, LANG_META, isZh } = useI18n()

const tab = ref('api')
const currentLang = computed(() => lang.value)

// ── DeepSeek API Key ──
const dsKeyMode = ref('builtin')
const apiKeyVal = ref('')
const showApiKey = ref(false)
const apiKeySaving = ref(false)
const apiKeyMsg = ref('')
const apiKeyMsgOk = ref(false)
const apiKeySet = ref(false)

// ── GitHub ──
const gitHubVal = ref('')
const showGitHub = ref(false)
const gitHubSaving = ref(false)
const gitHubMsg = ref('')
const gitHubMsgOk = ref(false)
const gitHubSet = ref(false)

// ── Notion ──
const notionVal = ref('')
const showNotion = ref(false)
const notionSaving = ref(false)
const notionMsg = ref('')
const notionMsgOk = ref(false)
const notionSet = ref(false)

// ── AMAP ──
const amapVal = ref('')
const showAmap = ref(false)
const amapSaving = ref(false)
const amapMsg = ref('')
const amapMsgOk = ref(false)
const amapSet = ref(false)

// ── SMTP ──
const smtpHost = ref('')
const smtpPort = ref('465')
const smtpUser = ref('')
const smtpPass = ref('')
const smtpProvider = ref('')
const smtpSaving = ref(false)
const smtpMsg = ref('')
const smtpMsgOk = ref(false)
const smtpSet = ref(false)

// ── Data ──
const exporting = ref(false)
const dataMsg = ref('')
const dataMsgOk = ref(false)

const providers = {
  qq: { host: 'smtp.qq.com', port: '465', domain: '@qq.com' },
  '163': { host: 'smtp.163.com', port: '465', domain: '@163.com' },
  gmail: { host: 'smtp.gmail.com', port: '465', domain: '@gmail.com' },
  outlook: { host: 'smtp-mail.outlook.com', port: '587', domain: '@outlook.com' },
}

function onSmtpProvider() {
  const p = providers[smtpProvider.value]
  if (!p) return
  const oldDomain = '@' + (smtpHost.value?.replace(/^smtp\./, '').replace(/^smtp-/, '').replace(/\.com.*$/, '.com') || '')
  smtpHost.value = p.host
  smtpPort.value = p.port
  // Sync email domain: strip old @domain, append new one
  const local = smtpUser.value.split('@')[0]
  if (local) smtpUser.value = local + p.domain
}

onMounted(() => {
  loadAll()
})

watch(() => props.visible, (v) => {
  if (v) loadAll()
})

function loadAll() {
  // DeepSeek
  store.loadApiKey()
  dsKeyMode.value = localStorage.getItem('key_mode') || (store.apikey ? 'own' : 'builtin')
  apiKeyVal.value = dsKeyMode.value === 'own' ? store.apikey : ''
  apiKeySet.value = dsKeyMode.value === 'own' && !!store.apikey

  // GitHub
  gitHubVal.value = localStorage.getItem('env_GITHUB_TOKEN') || ''
  gitHubSet.value = !!gitHubVal.value

  // Notion
  notionVal.value = localStorage.getItem('env_NOTION_API_KEY') || ''
  notionSet.value = !!notionVal.value

  // AMAP
  amapVal.value = localStorage.getItem('env_AMAP_KEY') || ''
  amapSet.value = !!amapVal.value

  // SMTP
  const c = loadSMTPConfig()
  if (c) {
    smtpHost.value = c.host || ''
    smtpPort.value = c.port || '465'
    smtpUser.value = c.user || ''
    smtpPass.value = c.pass || ''
    smtpSet.value = !!(c.host && c.user && c.pass)
  }
}

// ── Save helpers ──
function saveToEnv(key, val) {
  localStorage.setItem('env_' + key, val)
  // Also set as actual env for current session
  if (typeof process !== 'undefined' && process.env) {
    process.env[key] = val
  }
  // Dispatch event so any running agent picks it up
  window.dispatchEvent(new CustomEvent('env:update', { detail: { key, value: val } }))
}

function saveApiKey() {
  apiKeySaving.value = true
  apiKeyMsg.value = ''
  setTimeout(() => {
    if (dsKeyMode.value === 'own' && apiKeyVal.value.trim()) {
      store.setApiKey(apiKeyVal.value.trim())
      localStorage.setItem('key_mode', 'own')
      apiKeySet.value = true
      apiKeyMsg.value = '已保存'
    } else {
      localStorage.setItem('key_mode', 'builtin')
      apiKeySet.value = false
      apiKeyMsg.value = '已切换为内置 Key'
    }
    apiKeyMsgOk.value = true
    apiKeySaving.value = false
    setTimeout(() => { apiKeyMsg.value = '' }, 2000)
  }, 200)
}

function saveGitHub() {
  gitHubSaving.value = true
  setTimeout(() => {
    saveToEnv('GITHUB_TOKEN', gitHubVal.value)
    gitHubSet.value = !!gitHubVal.value
    gitHubSaving.value = false
    gitHubMsg.value = gitHubSet.value ? '已保存' : '已清除'
    gitHubMsgOk.value = true
    setTimeout(() => { gitHubMsg.value = '' }, 2000)
  }, 200)
}

function saveNotion() {
  notionSaving.value = true
  setTimeout(() => {
    saveToEnv('NOTION_API_KEY', notionVal.value)
    notionSet.value = !!notionVal.value
    notionSaving.value = false
    notionMsg.value = notionSet.value ? '已保存' : '已清除'
    notionMsgOk.value = true
    setTimeout(() => { notionMsg.value = '' }, 2000)
  }, 200)
}

function saveAmap() {
  amapSaving.value = true
  setTimeout(() => {
    saveToEnv('AMAP_KEY', amapVal.value)
    amapSet.value = !!amapVal.value
    amapSaving.value = false
    amapMsg.value = amapSet.value ? '已保存' : '已清除'
    amapMsgOk.value = true
    setTimeout(() => { amapMsg.value = '' }, 2000)
  }, 200)
}

function saveSmtp() {
  smtpSaving.value = true
  setTimeout(() => {
    saveSMTPConfig({
      host: smtpHost.value,
      port: smtpPort.value,
      user: smtpUser.value,
      pass: smtpPass.value,
    })
    smtpSet.value = !!(smtpHost.value && smtpUser.value && smtpPass.value)
    smtpSaving.value = false
    smtpMsg.value = '已保存'
    smtpMsgOk.value = true
    setTimeout(() => { smtpMsg.value = '' }, 2000)
  }, 200)
}

function selectLang(code) {
  setLang(code)
}

// ── Data ──
async function doExport() {
  exporting.value = true
  try {
    const data = await convApi.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'deepseek-chat-data.json'; a.click()
    URL.revokeObjectURL(url)
    dataMsg.value = '导出成功'
    dataMsgOk.value = true
    setTimeout(() => { dataMsg.value = '' }, 3000)
  } catch (e) {
    dataMsg.value = '导出失败: ' + e.message
    dataMsgOk.value = false
  } finally { exporting.value = false }
}

async function doImport(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!data.conversations || !Array.isArray(data.conversations)) {
      dataMsg.value = '文件格式无效'
      dataMsgOk.value = false; return
    }
    const result = await convApi.importAll(data)
    dataMsg.value = `已导入 ${result.imported} 条对话`
    dataMsgOk.value = true
    await store.loadConversations()
    setTimeout(() => { dataMsg.value = '' }, 5000)
  } catch (e) {
    dataMsg.value = '导入失败: ' + e.message
    dataMsgOk.value = false
  }
  e.target.value = ''
}
</script>

<style scoped>
.sp-overlay { position: fixed; inset: 0; z-index: var(--z-modal); display: flex; justify-content: flex-end; }
.sp-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.45); }
.sp-panel {
  position: relative; width: 420px; max-width: 92vw; height: 100vh; height: 100dvh;
  background: var(--bg2); border-left: 1px solid var(--border2);
  display: flex; flex-direction: column;
  box-shadow: -8px 0 32px rgba(0,0,0,.3);
}

/* Header */
.sp-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.sp-title { font-size: 17px; font-weight: 500; color: var(--text); margin: 0; }
.sp-close {
  width: 30px; height: 30px; border-radius: 8px;
  border: none; background: transparent; color: var(--text3);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .12s;
}
.sp-close:hover { background: var(--bg3); color: var(--text2); }

/* Tabs */
.sp-tabs {
  display: flex; gap: 0; padding: 0 20px;
  border-bottom: 1px solid var(--border); flex-shrink: 0;
}
.sp-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; border: none; background: transparent;
  color: var(--text3); font-size: 12px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .12s;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.sp-tab:hover { color: var(--text2); background: var(--bg3); }
.sp-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* Body */
.sp-body { flex: 1; overflow-y: auto; padding: 16px 20px 32px; }
.sp-body::-webkit-scrollbar { width: 4px; }
.sp-body::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }
.sp-sub { font-size: 12px; color: var(--text3); font-weight: 300; line-height: 1.5; margin: 0 0 16px; }

/* Key group */
.sp-key-group {
  background: var(--bg3); border: 1px solid var(--border); border-radius: 12px;
  padding: 14px; margin-bottom: 10px;
}
.sp-key-group-accent {
  border-color: rgba(79,125,255,0.3);
  background: rgba(79,125,255,0.07);
}
.sp-key-group-accent .sp-key-input {
  border-color: rgba(79,125,255,0.25);
  background: rgba(0,0,0,0.15);
}
.sp-key-group-accent .sp-key-input:focus-within {
  border-color: var(--accent);
}
.sp-key-required {
  font-size: 9px; padding: 2px 7px; border-radius: var(--radius-full);
  background: rgba(79,125,255,0.12); color: var(--accent);
  font-weight: 500; letter-spacing: .03em; margin-left: auto;
}
.sp-icon-accent { color: var(--accent) !important; }
.sp-hdr-accent { color: var(--accent) !important; font-weight: 500; }
.sp-key-hdr {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 10px; font-size: 13px; color: var(--text); font-weight: 400;
}
.sp-key-hdr svg { color: var(--text2); flex-shrink: 0; }
.sp-key-status {
  margin-left: auto; font-size: 10px; padding: 2px 8px;
  border-radius: var(--radius-full); font-weight: 400;
}
.sp-key-status.ok { color: var(--green); background: rgba(63,185,80,0.10); }
.sp-key-status.no { color: var(--text3); background: var(--bg4); }

/* Input row */
.sp-key-input {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: 8px; padding: 0 10px; margin-bottom: 8px;
}
.sp-input {
  flex: 1; background: transparent; border: none; outline: none;
  padding: 9px 0; color: var(--text); font-size: 13px; font-family: var(--font-mono);
  font-weight: 300;
}
.sp-input::placeholder { color: var(--text3); font-family: inherit; }
.sp-eye {
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent; color: var(--text3);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all .12s;
}
.sp-eye:hover { background: var(--bg4); color: var(--text2); }
.sp-save-btn {
  width: 100%; padding: 8px; border-radius: 8px;
  border: none; background: var(--accent); color: #fff;
  font-size: 13px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: background .12s;
}
.sp-save-btn:hover { background: var(--accent-hover); }
.sp-msg { display: block; font-size: 11px; font-weight: 300; margin-top: 6px; }
.sp-msg.ok { color: var(--green); }
.sp-msg.fail { color: var(--red); }

/* SMTP fields */
.sp-field { margin-bottom: 10px; }
.sp-label { display: block; font-size: 11px; color: var(--text2); margin-bottom: 4px; }
.sp-row { display: flex; gap: 10px; }
select.sp-input { font-family: inherit; cursor: pointer; }

/* Language */
.sp-lang-list { display: flex; flex-direction: column; gap: 6px; }
.sp-lang-opt {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg3);
  cursor: pointer; transition: all .12s; text-align: left;
  font-family: inherit; font-size: 14px; color: var(--text2);
}
.sp-lang-opt:hover { border-color: var(--border2); background: var(--bg4); }
.sp-lang-opt.active { border-color: var(--accent); background: var(--accent-muted); color: var(--accent); }
.sp-lang-name { font-weight: 400; }
.sp-lang-en { font-size: 11px; color: var(--text3); font-weight: 300; }
.sp-lang-opt.active .sp-lang-en { color: var(--text2); }
.sp-lang-check { margin-left: auto; flex-shrink: 0; color: var(--accent); }

/* Data */
.sp-data-actions { display: flex; gap: 8px; }
.sp-data-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 14px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg3);
  color: var(--text2); font-size: 13px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .12s;
}
.sp-data-btn:hover { background: var(--bg4); border-color: var(--border2); color: var(--text); }
.sp-data-btn:disabled { opacity: .5; cursor: not-allowed; }
.sp-data-btn svg { color: var(--text3); flex-shrink: 0; }
.sp-data-btn:hover svg { color: var(--text2); }

/* Radio cards */
.sp-radio {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border: 1px solid var(--border);
  border-radius: 8px; margin-bottom: 6px;
  cursor: pointer; transition: border-color .15s, background .15s;
  user-select: none;
}
.sp-radio:hover { background: var(--bg4); }
.sp-radio.active { border-color: var(--accent); background: var(--accent-muted); }
.sp-radio-dot {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid var(--border2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: border-color .15s;
}
.sp-radio.active .sp-radio-dot { border-color: var(--accent); }
.sp-radio-fill { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.sp-radio-body { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.sp-radio-title { font-size: 13px; color: var(--text); font-weight: 400; }
.sp-radio-desc { font-size: 11px; color: var(--text3); font-weight: 300; }
.sp-radio.active .sp-radio-desc { color: var(--text2); }
.sp-radio-check { color: var(--accent); flex-shrink: 0; }

/* Slide transition */
.settings-slide-enter-active { transition: all .25s cubic-bezier(0.4, 0, 0.2, 1); }
.settings-slide-leave-active { transition: all .2s cubic-bezier(0.4, 0, 0.2, 1); }
.settings-slide-enter-from .sp-panel { transform: translateX(100%); }
.settings-slide-leave-to .sp-panel { transform: translateX(100%); }
.settings-slide-enter-from .sp-backdrop { opacity: 0; }
.settings-slide-leave-to .sp-backdrop { opacity: 0; }
</style>
