<template>
  <div class="ms-root">
    <!-- ── Header ── -->
    <div class="ms-header">
      <div class="ms-header-top">
        <div>
          <h2 class="ms-title">MCP & Skills</h2>
          <p class="ms-sub">管理 AI 扩展能力：浏览市场发现新能力，管理已安装的服务器和指令集</p>
        </div>
        <div class="ms-header-actions">
          <button class="ms-btn" @click="skillFileInput?.click()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            上传 Skill
          </button>
          <input ref="skillFileInput" type="file" accept=".md" class="hidden-input" @change="onSkillFilePicked" />
          <button class="ms-btn" @click="mcpFileInput?.click()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            上传 MCP 配置
          </button>
          <input ref="mcpFileInput" type="file" accept=".json" class="hidden-input" @change="onMcpFilePicked" />
          <button class="ms-btn primary" @click="showMcpForm = true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            添加 MCP 服务器
          </button>
          <button v-if="view === 'installed'" class="ms-btn market-btn" @click="view = 'market'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
              <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            进入市场
          </button>
          <button v-else class="ms-btn market-btn" @click="view = 'installed'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M20 12H4M4 12l6-6M4 12l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            已安装
          </button>
        </div>
      </div>
    </div>

    <!-- ── Top nav ── -->
    <div class="ms-nav">
      <button :class="['ms-nav-item', { active: view === 'installed' }]" @click="view = 'installed'">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="1.5"/>
          <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        已安装
        <span class="ms-nav-count">{{ installedCount }}</span>
      </button>
      <button :class="['ms-nav-item', { active: view === 'market' }]" @click="view = 'market'">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        市场
        <span class="ms-nav-count">{{ marketCount }}</span>
      </button>
    </div>

    <!-- ── Toasts ── -->
    <div v-if="skillUploadMsg" :class="['ms-toast', skillUploadOk ? 'ok' : 'fail']">{{ skillUploadMsg }}</div>
    <div v-if="mcpUploadMsg" :class="['ms-toast', mcpUploadOk ? 'ok' : 'fail']">{{ mcpUploadMsg }}</div>

    <!-- ═══════════════ INSTALLED VIEW ═══════════════ -->
    <div v-if="view === 'installed'" class="ms-content">
      <!-- Search -->
      <div class="ms-search-bar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" class="ms-search-icon">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          v-model="installedSearch"
          class="ms-search-input"
          :placeholder="installedSubTab === 'skill' ? '搜索已安装的技能...' : '搜索已安装的 MCP 服务器...'"
        />
        <button v-if="installedSearch" class="ms-search-clear" @click="installedSearch = ''">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Sub-tabs -->
      <div class="ms-sub-nav">
        <button :class="['ms-sub-tab', { active: installedSubTab === 'skill' }]" @click="installedSubTab = 'skill'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7l9 5 9-5-9-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M3 17l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
          Skill
          <span class="ms-sub-count">{{ skillStore.skills.value.length }}</span>
        </button>
        <button :class="['ms-sub-tab', { active: installedSubTab === 'mcp' }]" @click="installedSubTab = 'mcp'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <rect x="14" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <rect x="2" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <rect x="14" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
          </svg>
          MCP
          <span class="ms-sub-count">{{ mcpStore.servers.value.length }}</span>
        </button>
      </div>

      <!-- Skill cards -->
      <template v-if="installedSubTab === 'skill'">
        <div v-if="!filteredInstalledSkills.length" class="ms-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" class="ms-empty-icon">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="12" x2="12" y2="17" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="9.5" y1="14.5" x2="14.5" y2="14.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <span>{{ installedSearch ? '没有匹配的技能' : '暂无技能，上传或从市场安装' }}</span>
        </div>
        <div v-else class="ms-list">
          <div
            v-for="s in filteredInstalledSkills" :key="'sk-' + s.slug"
            class="ms-card"
            @click="viewSkill(s)"
          >
            <div class="ms-card-icon-wrap skill-type">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7l9 5 9-5-9-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M3 17l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="ms-card-info">
              <div class="ms-card-top">
                <span class="ms-card-name">/{{ s.slug }}</span>
              </div>
              <div class="ms-card-desc">{{ s.description || '无描述' }}</div>
              <div class="ms-card-meta">
                <span class="ms-card-meta-item">{{ s.source === 'user' ? '用户' : s.source === 'project' ? '项目' : s.source || '未知' }}</span>
                <span v-if="s.model" class="ms-card-meta-item">模型: {{ s.model }}</span>
              </div>
            </div>
            <div class="ms-card-actions" @click.stop>
              <button class="ms-card-btn" title="查看详情" @click="viewSkill(s)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </button>
              <button class="ms-card-btn danger" title="删除" @click="removeSkill(s.slug)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- MCP cards -->
      <template v-if="installedSubTab === 'mcp'">
        <div v-if="!filteredInstalledMcp.length" class="ms-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" class="ms-empty-icon">
            <rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <rect x="14" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <rect x="2" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <rect x="14" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
          </svg>
          <span>{{ installedSearch ? '没有匹配的服务器' : '暂无 MCP 服务器，从市场安装或手动添加' }}</span>
        </div>
        <div v-else class="ms-list">
          <div
            v-for="s in filteredInstalledMcp" :key="'mcp-' + s.name"
            class="ms-card" :class="{ 'ms-card-off': s.status !== 'connected' }"
          >
            <div class="ms-card-icon-wrap mcp-type" :class="s.status">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
                <rect x="14" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
                <rect x="2" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
                <rect x="14" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
              </svg>
            </div>
            <div class="ms-card-info">
              <div class="ms-card-top">
                <span class="ms-card-name">{{ s.name }}</span>
              </div>
              <div class="ms-card-desc">{{ s.config?.description || s.config?.command || '无描述' }}</div>
              <div class="ms-card-meta">
                <span :class="['ms-status-dot', s.status]"></span>
                <span :class="['ms-status-text', s.status]">
                  {{ s.status === 'connected' ? '已连接' : s.status === 'connecting' ? '连接中...' : '未连接' }}
                </span>
                <span v-if="s.toolCount" class="ms-card-meta-item">{{ s.toolCount }} 工具</span>
                <span v-if="s.error" class="ms-card-err">{{ s.error }}</span>
              </div>
            </div>
            <div class="ms-card-actions" @click.stop>
              <button v-if="s.status !== 'connected'" class="ms-card-btn reconnect" title="重连" @click="reconnectMcp(s.name)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="ms-card-btn" title="编辑" @click="editMcpItem(s.name)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="ms-card-btn danger" title="删除" @click="removeMcp(s.name)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ═══════════════ MARKET VIEW ═══════════════ -->
    <div v-if="view === 'market'" class="ms-content">
      <!-- Search -->
      <div class="ms-search-bar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" class="ms-search-icon">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          v-model="marketSearch"
          class="ms-search-input"
          :placeholder="marketSubTab === 'skill' ? '搜索市场中的技能...' : '搜索市场中的 MCP 服务器...'"
        />
        <button v-if="marketSearch" class="ms-search-clear" @click="marketSearch = ''">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Sub-tabs -->
      <div class="ms-sub-nav">
        <button :class="['ms-sub-tab', { active: marketSubTab === 'skill' }]" @click="marketSubTab = 'skill'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7l9 5 9-5-9-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M3 17l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
          Skill
          <span class="ms-sub-count">{{ skillStore.marketplaceSkills.value.length }}</span>
        </button>
        <button :class="['ms-sub-tab', { active: marketSubTab === 'mcp' }]" @click="marketSubTab = 'mcp'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <rect x="14" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <rect x="2" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
            <rect x="14" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
          </svg>
          MCP
          <span class="ms-sub-count">{{ mcpStore.marketplaceServers.value.length }}</span>
        </button>
      </div>

      <!-- Skill market -->
      <template v-if="marketSubTab === 'skill'">
        <div v-if="!filteredMarketSkills.length" class="ms-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" class="ms-empty-icon">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.3"/>
            <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <span>{{ marketSearch ? '没有匹配的技能' : (skillMarketLoading ? '加载中...' : '市场暂无可用技能') }}</span>
        </div>
        <div v-else class="ms-grid">
          <div v-for="s in filteredMarketSkills" :key="'ms-' + s.id" class="ms-card market-card">
            <div class="ms-card-icon-wrap skill-type">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7l9 5 9-5-9-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M3 17l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="ms-card-info">
              <div class="ms-card-top">
                <span class="ms-card-name">/{{ s.name }}</span>
              </div>
              <div class="ms-card-desc">{{ s.displayName || s.description }}</div>
              <div class="ms-card-desc-sub">{{ s.description }}</div>
              <div class="ms-card-meta">
                <span class="ms-card-meta-item">{{ formatInstalls(s.installs) }} 安装</span>
                <span class="ms-card-meta-item">{{ s.author }}</span>
                <span v-for="t in (s.tags || []).slice(0, 3)" :key="t" class="ms-card-tag">{{ t }}</span>
              </div>
            </div>
            <button
              class="ms-install-btn"
              :class="{ done: installedSkillSlugs.has(s.name) }"
              :disabled="installingSkillId === s.id || installedSkillSlugs.has(s.name)"
              @click.stop="installMarketSkill(s)"
            >
              <template v-if="installingSkillId === s.id">
                <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity=".25"/>
                  <path d="M22 12a10 10 0 00-9-9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                安装中
              </template>
              <template v-else-if="installedSkillSlugs.has(s.name)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                已安装
              </template>
              <template v-else>安装</template>
            </button>
          </div>
        </div>
      </template>

      <!-- MCP market -->
      <template v-if="marketSubTab === 'mcp'">
        <div v-if="!filteredMarketMcp.length" class="ms-empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" class="ms-empty-icon">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.3"/>
            <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <span>{{ marketSearch ? '没有匹配的服务器' : (mcpMarketLoading ? '加载中...' : '市场暂无可用 MCP 服务器') }}</span>
        </div>
        <div v-else class="ms-grid">
          <div v-for="s in filteredMarketMcp" :key="'mm-' + s.id" class="ms-card market-card">
            <div class="ms-card-icon-wrap mcp-type" :class="s.category">
              <svg v-if="s.icon === 'github'" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else-if="s.icon === 'database'" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" stroke-width="1.3"/>
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="currentColor" stroke-width="1.3"/>
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor" stroke-width="1.3"/>
              </svg>
              <svg v-else-if="s.icon === 'search'" width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.3"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
                <rect x="14" y="2" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
                <rect x="2" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
                <rect x="14" y="14" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.3"/>
              </svg>
            </div>
            <div class="ms-card-info">
              <div class="ms-card-top">
                <span class="ms-card-name">{{ s.name }}</span>
              </div>
              <div class="ms-card-desc">{{ s.description }}</div>
              <div class="ms-card-meta">
                <span class="ms-card-meta-item">{{ formatInstalls(s.installs) }} 安装</span>
                <span v-if="s.official" class="ms-card-official">官方</span>
                <span v-for="t in (s.tags || []).slice(0, 3)" :key="t" class="ms-card-tag">{{ t }}</span>
              </div>
            </div>
            <button
              class="ms-install-btn"
              :class="{ done: installedMcpIds.has(s.id) }"
              :disabled="installingMcpId === s.id || installedMcpIds.has(s.id)"
              @click.stop="installMarketMcp(s)"
            >
              <template v-if="installingMcpId === s.id">
                <svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity=".25"/>
                  <path d="M22 12a10 10 0 00-9-9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                安装中
              </template>
              <template v-else-if="installedMcpIds.has(s.id)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                已安装
              </template>
              <template v-else>安装</template>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- ═══════════════ MCP Form Modal ═══════════════ -->
    <McpServerForm
      v-if="showMcpForm"
      :editing="editingMcp"
      :initial-name="editingMcpName"
      :initial-config="editingMcpConfig"
      @close="closeMcpForm"
      @saved="onMcpSaved"
    />

    <!-- ═══════════════ Skill Detail Modal ═══════════════ -->
    <Teleport to="body">
      <div v-if="viewingSkill" class="ms-overlay" @click.self="viewingSkill = null">
        <div class="ms-modal">
          <div class="ms-modal-hdr">
            <div class="ms-modal-hdr-left">
              <div class="ms-modal-icon skill-type">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L3 7l9 5 9-5-9-5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                  <path d="M3 17l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                  <path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                </svg>
              </div>
              <h3>/{{ viewingSkill.slug }}</h3>
            </div>
            <button class="ms-modal-close" @click="viewingSkill = null">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="ms-modal-body">
            <div class="ms-skill-meta">
              <span class="ms-card-meta-item">{{ viewingSkill.source === 'user' ? '用户' : viewingSkill.source === 'project' ? '项目' : viewingSkill.source || '未知' }}</span>
              <span v-if="viewingSkill.version" class="ms-card-meta-item">v{{ viewingSkill.version }}</span>
            </div>
            <p class="ms-skill-desc">{{ viewingSkill.description }}</p>
            <pre class="ms-skill-body">{{ viewingSkill.body || viewingSkill.raw_content || '(空)' }}</pre>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useMcpStore } from '../stores/mcpStore.js'
import { useSkillStore } from '../stores/skillStore.js'
import McpServerForm from '../components/mcp/McpServerForm.vue'

const mcpStore = useMcpStore()
const skillStore = useSkillStore()

// ── View state ──
const view = ref('installed')
const installedSubTab = ref('skill')
const marketSubTab = ref('skill')

// ── Search ──
const installedSearch = ref('')
const marketSearch = ref('')

// ── Skill upload ──
const skillFileInput = ref(null)
const skillUploadMsg = ref('')
const skillUploadOk = ref(false)

// ── MCP upload ──
const mcpFileInput = ref(null)
const mcpUploadMsg = ref('')
const mcpUploadOk = ref(false)

// ── MCP form modal ──
const showMcpForm = ref(false)
const editingMcp = ref(false)
const editingMcpName = ref('')
const editingMcpConfig = ref({})

// ── Skill detail modal ──
const viewingSkill = ref(null)

// ── Market loading state ──
const skillMarketLoading = ref(false)
const mcpMarketLoading = ref(false)

// ── Install state ──
const installingSkillId = ref(null)
const installingMcpId = ref(null)
const installedSkillSlugs = ref(new Set())
const installedMcpIds = ref(new Set())

// ═══════════ Computed ═══════════

const installedCount = computed(() =>
  skillStore.skills.value.length + mcpStore.servers.value.length
)

const marketCount = computed(() =>
  skillStore.marketplaceSkills.value.length + mcpStore.marketplaceServers.value.length
)

// ── Filter installed ──
const filteredInstalledSkills = computed(() => {
  const q = installedSearch.value.toLowerCase().trim()
  if (!q) return skillStore.skills.value
  return skillStore.skills.value.filter(s =>
    s.slug.toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q)
  )
})

const filteredInstalledMcp = computed(() => {
  const q = installedSearch.value.toLowerCase().trim()
  if (!q) return mcpStore.servers.value
  return mcpStore.servers.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.config?.description || '').toLowerCase().includes(q) ||
    (s.config?.command || '').toLowerCase().includes(q)
  )
})

// ── Filter market ──
const filteredMarketSkills = computed(() => {
  const q = marketSearch.value.toLowerCase().trim()
  if (!q) return skillStore.marketplaceSkills.value
  return skillStore.marketplaceSkills.value.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.displayName || '').toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q) ||
    (s.tags || []).some(t => t.toLowerCase().includes(q))
  )
})

const filteredMarketMcp = computed(() => {
  const q = marketSearch.value.toLowerCase().trim()
  if (!q) return mcpStore.marketplaceServers.value
  return mcpStore.marketplaceServers.value.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q) ||
    (s.tags || []).some(t => t.toLowerCase().includes(q))
  )
})

// ═══════════ Lifecycle ═══════════

onMounted(async () => {
  mcpStore.loadServers(null)
  skillStore.loadSkills(null)

  skillMarketLoading.value = true
  mcpMarketLoading.value = true
  try { await skillStore.loadMarketplace() } catch {}
  finally { skillMarketLoading.value = false }
  try { await mcpStore.loadMarketplace() } catch {}
  finally { mcpMarketLoading.value = false }

  refreshInstalledSets()
})

watch([() => skillStore.skills.value, () => mcpStore.servers.value], () => {
  refreshInstalledSets()
}, { deep: true })

function refreshInstalledSets() {
  const ss = new Set()
  skillStore.skills.value.forEach(s => ss.add(s.slug))
  installedSkillSlugs.value = ss

  const ms = new Set()
  mcpStore.servers.value.forEach(s => ms.add(s.name))
  installedMcpIds.value = ms
}

watch(view, async (v) => {
  if (v === 'market') {
    if (!skillMarketLoading.value && !skillStore.marketplaceSkills.value.length) {
      skillMarketLoading.value = true
      try { await skillStore.loadMarketplace() } catch {}
      finally { skillMarketLoading.value = false }
    }
    if (!mcpMarketLoading.value && !mcpStore.marketplaceServers.value.length) {
      mcpMarketLoading.value = true
      try { await mcpStore.loadMarketplace() } catch {}
      finally { mcpMarketLoading.value = false }
    }
    refreshInstalledSets()
  }
})

// ═══════════ Actions ═══════════

function formatInstalls(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n || 0)
}

async function onSkillFilePicked(e) {
  const file = e.target.files?.[0]
  if (!file) return
  skillUploadMsg.value = ''
  try {
    const text = await file.text()
    const { skillsApi } = await import('../api/skills.api.js')
    const result = await skillsApi.uploadSkillFile(file.name, text, null)
    skillUploadMsg.value = '已安装: /' + result.slug
    skillUploadOk.value = true
    await skillStore.loadSkills(null)
  } catch (err) {
    skillUploadMsg.value = err.message || '上传失败'
    skillUploadOk.value = false
  } finally {
    if (skillFileInput.value) skillFileInput.value.value = ''
  }
}

function viewSkill(s) {
  import('../api/skills.api.js').then(({ skillsApi }) => {
    skillsApi.getSkill(s.slug).then(d => {
      viewingSkill.value = d?.skill || s
    }).catch(() => { viewingSkill.value = s })
  })
}

async function removeSkill(slug) {
  if (!confirm('确定删除 "/' + slug + '"？')) return
  await skillStore.deleteSkill(slug, null)
}

async function onMcpFilePicked(e) {
  const file = e.target.files?.[0]
  if (!file) return
  mcpUploadMsg.value = ''
  try {
    const text = await file.text()
    const { mcpApi } = await import('../api/mcp.api.js')
    const result = await mcpApi.uploadConfig(file.name, text, null)
    mcpUploadMsg.value = '已导入 ' + result.added + ' 个: ' + (result.servers || []).join(', ')
    mcpUploadOk.value = true
    await mcpStore.loadServers(null)
  } catch (err) {
    mcpUploadMsg.value = err.message || '上传失败'
    mcpUploadOk.value = false
  } finally {
    if (mcpFileInput.value) mcpFileInput.value.value = ''
  }
}

function closeMcpForm() {
  showMcpForm.value = false
  editingMcp.value = false
  editingMcpName.value = ''
  editingMcpConfig.value = {}
}

async function onMcpSaved() {
  await mcpStore.loadServers(null)
  closeMcpForm()
}

function editMcpItem(name) {
  const s = mcpStore.servers.value.find(s => s.name === name)
  if (!s) return
  editingMcp.value = true
  editingMcpName.value = name
  editingMcpConfig.value = s.config || {}
  showMcpForm.value = true
}

async function reconnectMcp(name) { await mcpStore.reconnectServer(name, null) }
async function removeMcp(name) {
  if (!confirm('确定删除 "' + name + '"？')) return
  await mcpStore.deleteServer(name, null)
}

async function installMarketSkill(skill) {
  installingSkillId.value = skill.id
  try {
    await skillStore.installFromMarketplace(skill.id, null)
    installedSkillSlugs.value.add(skill.name)
    await skillStore.loadSkills(null)
  } catch (err) {
    skillUploadMsg.value = '安装失败: ' + (err?.message || '未知错误')
    skillUploadOk.value = false
  } finally { installingSkillId.value = null }
}

async function installMarketMcp(server) {
  installingMcpId.value = server.id
  try {
    await mcpStore.installFromMarketplace(server.id, null)
    installedMcpIds.value.add(server.id)
    await mcpStore.loadServers(null)
  } catch (err) {
    mcpUploadMsg.value = '安装失败: ' + (err?.message || '未知错误')
    mcpUploadOk.value = false
  } finally { installingMcpId.value = null }
}
</script>

<style scoped>
/* ═══════════════ Root & Layout ═══════════════ */
.ms-root { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }

/* ── Header ── */
.ms-header { padding: 24px 32px 0; }
.ms-header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.ms-title { font-size: 20px; font-weight: 500; color: var(--text); margin: 0 0 4px; letter-spacing: -0.01em; }
.ms-sub { font-size: 12px; color: var(--text3); font-weight: 300; margin: 0; max-width: 480px; line-height: 1.5; }
.ms-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }

/* ── Buttons ── */
.ms-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg3);
  color: var(--text2); font-size: 12px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .15s; white-space: nowrap;
}
.ms-btn:hover { border-color: var(--border2); color: var(--text); background: var(--bg4); }
.ms-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.ms-btn.primary:hover { background: var(--accent-hover); }
.ms-btn.market-btn { border-color: var(--accent); color: var(--accent); background: var(--accent-muted); }
.ms-btn.market-btn:hover { background: var(--accent); color: #fff; }

/* ── Top nav ── */
.ms-nav { display: flex; gap: 0; padding: 16px 32px 0; border-bottom: 1px solid var(--border); }
.ms-nav-item {
  display: flex; align-items: center; gap: 7px;
  padding: 10px 18px; border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  border: none; background: transparent;
  color: var(--text3); font-size: 13px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .15s;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.ms-nav-item:hover { color: var(--text2); background: var(--bg2); }
.ms-nav-item.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--bg2); }
.ms-nav-count { font-size: 10px; padding: 1px 6px; border-radius: var(--radius-full); background: var(--bg4); color: var(--text3); min-width: 18px; text-align: center; }
.ms-nav-item.active .ms-nav-count { background: var(--accent-muted); color: var(--accent); }

/* ── Toast ── */
.ms-toast { margin: 10px 32px 0; font-size: 12px; font-weight: 300; padding: 8px 14px; border-radius: var(--radius-sm); }
.ms-toast.ok { color: var(--green); background: rgba(63,185,80,0.08); }
.ms-toast.fail { color: var(--red); background: rgba(248,81,73,0.08); }

/* ── Content ── */
.ms-content { flex: 1; overflow-y: auto; padding: 16px 32px 32px; }

/* ── Search ── */
.ms-search-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 14px;
  border: 1px solid var(--border); background: var(--bg2);
  margin-bottom: 14px; transition: border-color .15s;
}
.ms-search-bar:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-muted); }
.ms-search-icon { color: var(--text3); flex-shrink: 0; }
.ms-search-input { flex: 1; border: none; background: transparent; outline: none; color: var(--text); font-size: 13px; font-family: inherit; font-weight: 300; }
.ms-search-input::placeholder { color: var(--text3); }
.ms-search-clear {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%;
  border: none; background: transparent; color: var(--text3);
  cursor: pointer; transition: all .12s; flex-shrink: 0;
}
.ms-search-clear:hover { background: var(--bg4); color: var(--text2); }

/* ── Sub-tabs ── */
.ms-sub-nav { display: flex; gap: 6px; margin-bottom: 18px; }
.ms-sub-tab {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 16px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg2);
  color: var(--text3); font-size: 13px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .15s;
}
.ms-sub-tab:hover { border-color: var(--border2); color: var(--text2); background: var(--bg3); }
.ms-sub-tab.active {
  border-color: transparent;
  color: #fff; background: var(--accent);
}
.ms-sub-tab.active.skill { background: var(--accent); }
.ms-sub-count {
  font-size: 10px; padding: 1px 6px; border-radius: var(--radius-full);
  background: var(--bg4); color: var(--text3); min-width: 18px; text-align: center;
}
.ms-sub-tab.active .ms-sub-count { background: rgba(255,255,255,0.2); color: #fff; }

/* ── Empty state ── */
.ms-empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 32px 20px; text-align: center;
  color: var(--text3); font-size: 13px; font-weight: 300;
  border: 1px dashed var(--border); border-radius: 14px;
  background: var(--bg2); margin-bottom: 8px;
}
.ms-empty-icon { opacity: 0.35; }

/* ── Cards ── */
.ms-list { display: flex; flex-direction: column; gap: 8px; }
.ms-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 10px; }

.ms-card {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px; border-radius: 14px;
  border: 1px solid var(--border); background: var(--bg2);
  transition: border-color .15s, background .15s; cursor: pointer;
}
.ms-card:hover { border-color: var(--border2); background: var(--bg3); }
.ms-card.market-card { flex-direction: column; align-items: stretch; padding: 16px; cursor: default; }
.ms-card-off { opacity: .65; }

/* ── Card icon ── */
.ms-card-icon-wrap {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all .15s;
}
.ms-card-icon-wrap.skill-type { background: rgba(79,125,255,0.10); color: var(--accent); }
.ms-card-icon-wrap.mcp-type { background: rgba(63,185,80,0.10); color: var(--green); }
.ms-card-icon-wrap.mcp-type.connected { color: var(--green); background: rgba(63,185,80,0.12); }
.ms-card-icon-wrap.mcp-type.disconnected,
.ms-card-icon-wrap.mcp-type.connecting { color: var(--text3); background: var(--bg4); }
.ms-card-icon-wrap.mcp-type.development { color: var(--accent); background: var(--accent-muted); }
.ms-card-icon-wrap.mcp-type.database { color: var(--green); background: rgba(63,185,80,0.10); }
.ms-card-icon-wrap.mcp-type.search { color: var(--yellow); background: rgba(210,153,29,0.10); }

/* ── Card info ── */
.ms-card-info { flex: 1; min-width: 0; }
.ms-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.ms-card-name { font-size: 14px; font-weight: 500; color: var(--text); font-family: var(--font-mono); }
.ms-card-desc { font-size: 12px; color: var(--text3); font-weight: 300; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; line-height: 1.4; }
.ms-card-desc-sub { font-size: 11px; color: var(--text3); font-weight: 300; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; margin-bottom: 6px; }
.ms-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ms-card-meta-item { font-size: 10px; padding: 2px 7px; border-radius: var(--radius-full); background: var(--bg4); color: var(--text3); }
.ms-card-tag { font-size: 10px; padding: 2px 7px; border-radius: var(--radius-full); background: var(--bg4); color: var(--text3); }
.ms-card-official { font-size: 10px; padding: 2px 7px; border-radius: var(--radius-full); background: var(--accent-muted); color: var(--accent); }
.ms-card-err { font-size: 10px; color: var(--red); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }

/* ── Status ── */
.ms-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ms-status-dot.connected { background: var(--green); }
.ms-status-dot.disconnected { background: var(--red); }
.ms-status-dot.connecting { background: var(--yellow); animation: pulse-dot 1s ease-in-out infinite; }
@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }
.ms-status-text { font-size: 11px; font-weight: 300; }
.ms-status-text.connected { color: var(--green); }
.ms-status-text.disconnected { color: var(--red); }
.ms-status-text.connecting { color: var(--yellow); }

/* ── Card actions ── */
.ms-card-actions { display: flex; gap: 2px; flex-shrink: 0; }
.ms-card-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: var(--text3); cursor: pointer; transition: all .12s; }
.ms-card-btn:hover { background: var(--bg4); color: var(--text2); }
.ms-card-btn.danger:hover { background: rgba(248,81,73,0.12); color: var(--red); }
.ms-card-btn.reconnect:hover { color: var(--accent); background: var(--accent-muted); }

/* ── Install button ── */
.ms-install-btn {
  padding: 7px 14px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--bg4);
  color: var(--text2); font-size: 12px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .15s;
  display: flex; align-items: center; gap: 5px; justify-content: center;
  align-self: flex-end; min-width: 90px;
}
.ms-install-btn:hover:not(:disabled) { background: var(--accent); color: #fff; border-color: var(--accent); }
.ms-install-btn.done { color: var(--green); border-color: rgba(63,185,80,.3); background: rgba(63,185,80,.08); cursor: default; }
.ms-install-btn:disabled { cursor: default; opacity: .6; }

/* ── Detail modal ── */
.ms-overlay { position: fixed; inset: 0; z-index: var(--z-modal); background: rgba(0,0,0,.65); display: flex; align-items: center; justify-content: center; }
.ms-modal { background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius-lg); padding: 0; width: 580px; max-width: 92vw; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; }
.ms-modal-hdr { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
.ms-modal-hdr-left { display: flex; align-items: center; gap: 10px; }
.ms-modal-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.ms-modal-icon.skill-type { background: rgba(79,125,255,0.10); color: var(--accent); }
.ms-modal-hdr h3 { font-size: 16px; font-weight: 500; color: var(--accent); font-family: var(--font-mono); }
.ms-modal-close { width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.ms-modal-close:hover { background: var(--bg3); color: var(--text2); }
.ms-modal-body { padding: 16px 20px; overflow-y: auto; flex: 1; }
.ms-skill-meta { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
.ms-skill-desc { font-size: 13px; color: var(--text2); font-weight: 300; margin-bottom: 12px; line-height: 1.6; }
.ms-skill-body { font-size: 12px; font-family: var(--font-mono); color: var(--text2); background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; padding: 14px; max-height: 400px; overflow-y: auto; white-space: pre-wrap; line-height: 1.6; margin: 0; }

/* ── Utilities ── */
.hidden-input { display: none; }
.spin-icon { animation: spin-icon 1s linear infinite; }
@keyframes spin-icon { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
</style>
