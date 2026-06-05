<template>
  <div class="cv-root" ref="rootRef">
    <!-- ═══ Code Area (center) ═══ -->
    <div class="cv-main">
      <div v-if="!store.projectPath" class="cv-empty">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="4" width="32" height="28" rx="4" stroke="var(--accent)" stroke-width="1.5"/>
          <path d="M14 18l4 4 8-8" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="cv-empty-title">{{ t('codeEmptyTitle') }}</span>
        <span class="cv-empty-desc">{{ t('codeEmptyDesc') }}</span>
        <div class="cv-empty-actions">
          <button class="cv-act-btn" @click="showOpenProject = true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h3.8L7 4.5H12V11H2V3z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
            {{ t('codeOpenProject') }}
          </button>
          <button class="cv-act-btn" @click="showNewProject = true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            {{ t('codeNewProject') }}
          </button>
        </div>
      </div>

      <template v-else>
        <div class="cv-tabs" v-if="store.openFiles.length">
          <div v-for="f in store.openFiles" :key="f.path"
            :class="['cv-tab', { active: f.path === store.activeFilePath, deleted: f._deleted }]"
            @click="store.activeFilePath = f.path">
            <span class="cv-tab-name">{{ f.name }}</span>
            <button class="cv-tab-close" @click.prevent.stop="store.closeFile(f.path)">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <div class="cv-code" v-if="activeFile">
          <div class="cv-code-inner" ref="codeRef">
            <div v-for="(line, i) in displayLines" :key="i" class="cv-line"
              :class="{ 'cv-line-del': line._deleted, 'cv-line-add': line._added }">
              <span class="cv-line-num">{{ line._num }}</span>
              <span class="cv-line-code" v-html="line._html || escHtml(line.text || '')"></span>
              <!-- Per-diff accept/reject inline -->
              <div v-if="line._diffActions" class="cv-diff-inline-actions">
                <button class="cv-diff-btn accept" @click="acceptDiffIdx(line._diffIdx)" :title="t('codeAcceptAll')">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4 7.5 9 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button class="cv-diff-btn reject" @click="rejectDiffIdx(line._diffIdx)" :title="t('codeRejectAll')">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 3l5 5M8 3l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="cv-code-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" opacity=".3">
            <path d="M5 3h9l5 5v13H5V3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M14 3v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
          <span>{{ t('codeSelectFile') }}</span>
        </div>
      </template>
    </div>

    <!-- ═══ Resize handle ═══ -->
    <div class="cv-resize-handle" @mousedown="startResize('chat', $event)" v-if="store.projectPath"></div>

    <!-- ═══ AI Chat (right) ═══ -->
    <div class="cv-chat" v-if="store.projectPath" :style="{ width: chatWidth + 'px' }">
      <div class="cv-chat-top">
        <div class="cv-chat-tabs" v-if="store.openTabs.length">
          <div v-for="tab in store.openTabList" :key="tab.id"
            :class="['cv-ctab', { active: tab.id === store.currentId }]"
            @click="store.switchTab(tab.id)">
            <span class="cv-ctab-title">{{ tab.title }}</span>
            <button class="cv-ctab-close" @click.prevent.stop="store.closeTab(tab.id)">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 2l5 5M7 2l-5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="cv-chat-acts">
          <button class="cv-chat-act" @click="newCodeConv" title="新对话">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="cv-chat-act" @click="showSwitch = true" title="切换项目">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h5.5L8.5 5H11v5.5H2V3.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>

      <!-- ═══ Messages — Agent-style step cards ═══ -->
      <div class="cv-chat-msgs" ref="chatRef">
        <template v-for="m in codeMessages" :key="m._id">
          <!-- User message -->
          <div v-if="m.role === 'user'" class="cv-msg cv-msg-user">
            <div class="cv-bubble cv-bubble-user">{{ m.text }}</div>
          </div>
          <!-- AI message: step card -->
          <div v-else class="cv-card" :class="{ running: m._running, done: m._done }">
            <!-- Collapsed header -->
            <button class="cv-card-hdr" @click="m._expanded = !m._expanded">
              <span class="cv-card-hdr-l">
                <svg v-if="m._running" class="cv-card-spin" width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="var(--text3)" stroke-width="1" opacity=".25"/>
                  <path d="M11.5 6.5a5 5 0 00-4-4.8" stroke="var(--accent)" stroke-width="1.1" stroke-linecap="round"/>
                </svg>
                <svg v-else-if="m._error" width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--red)" stroke-width="1"/>
                  <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="var(--red)" stroke-width="1.1" stroke-linecap="round"/>
                </svg>
                <svg v-else width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--green)" stroke-width="1"/>
                  <path d="M4 6.5l1.8 1.8 3.2-3.5" stroke="var(--green)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="cv-card-label">SuperDS</span>
                <span class="cv-card-dash">&#8212;</span>
                <span class="cv-card-sum">{{ m._summary }}</span>
              </span>
              <span class="cv-card-hdr-r">
                <span class="cv-card-timer">{{ m._timer }}</span>
                <svg class="cv-card-chev" :class="{ open: m._expanded }" width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M3 4l2.5 2.5L8 4" stroke="var(--text3)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </button>

            <!-- Expanded body: sequential think → act → report (like chat mode) -->
            <div v-if="m._expanded" class="cv-card-body">
              <!-- Thinking process — ALWAYS visible while running, exact chat-mode design -->
              <div v-if="m._running" class="cv-think-live">
                <div class="cv-think-live-hdr" @click="m._thinkOpen = !m._thinkOpen">
                  <svg class="cv-think-dot" width="7" height="7" viewBox="0 0 7 7" fill="none"><circle cx="3.5" cy="3.5" r="2.5" fill="var(--accent)" opacity=".7"/></svg>
                  <span class="cv-think-live-label">思考中</span>
                  <svg :class="['cv-think-chev', { open: m._thinkOpen !== false }]" width="10" height="10" viewBox="0 0 10 10" fill="none" style="margin-left:auto">
                    <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div v-if="m._thinkOpen !== false" class="cv-think-body markdown-body"
                  v-html="renderMd(m._streaming || '思考中...')"
                  @scroll="onThinkScroll($event)"></div>
              </div>

              <!-- Flat sequential steps: think → tool → report → think → tool → report -->
              <template v-for="(s, si) in m._flatSteps" :key="'s' + si">
                <!-- Plan / Error banner -->
                <div v-if="s._type === 'plan' || s._type === 'error'" class="cv-step-banner"
                  :class="{ 'cv-step-err': s._type === 'error' }">{{ s._text }}</div>

                <!-- Thinking block — collapsible, same design as chat mode -->
                <div v-if="s._type === 'think'" class="cv-think-block"
                  :class="{ 'cv-think-live': s._live }">
                  <div class="cv-think-block-hdr" @click="s._open = !s._open">
                    <svg :class="['cv-think-chev', { open: s._open !== false }]" width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="cv-think-block-label">思考</span>
                  </div>
                  <div v-if="s._open !== false" class="cv-think-block-body markdown-body" v-html="renderMd(s._text)"></div>
                </div>

                <!-- Tool row -->
                <div v-if="s._type === 'tool'" class="cv-step" @click="s._open = !s._open">
                  <div class="cv-step-row">
                    <svg v-if="s._live" class="cv-step-spin" width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="6.5" cy="6.5" r="5" stroke="var(--text3)" stroke-width="1" opacity=".25"/>
                      <path d="M11.5 6.5a5 5 0 00-4-4.8" stroke="var(--accent)" stroke-width="1.1" stroke-linecap="round"/>
                    </svg>
                    <svg v-else width="13" height="13" viewBox="0 0 13 13" fill="none" class="cv-step-ok">
                      <circle cx="6.5" cy="6.5" r="5.5" stroke="var(--green)" stroke-width=".8" opacity=".5"/>
                      <path d="M4 6.5l1.8 1.8 3.2-3.5" stroke="var(--green)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="cv-step-phrase" :class="{ sweep: s._live }">{{ s._phrase }}</span>
                    <span v-if="s._file" class="cv-step-file">{{ s._file }}</span>
                    <span class="cv-step-tool">{{ s._tool }}</span>
                    <svg v-if="s._detail" class="cv-step-chev" :class="{ open: s._open }" width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <path d="M2.5 3L4.5 5l2-2" stroke="var(--text3)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div v-if="s._open && s._detail" class="cv-step-detail"><code class="cv-step-code">{{ s._detail }}</code></div>
                </div>

                <!-- Report text — markdown rendered -->
                <div v-if="s._type === 'report'" class="cv-report markdown-body" v-html="renderMd(s._text)"></div>
              </template>

              <!-- Streaming final report -->
              <div v-if="m._reportStream && m._running" class="cv-think-live cv-report-live">
                <div class="cv-think-live-hdr">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--green)" stroke-width="1"/><path d="M4 6l1.5 1.5L9 5" stroke="var(--green)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <span class="cv-think-live-label" style="color:var(--green)">最终汇报</span>
                </div>
                <div class="cv-think-live-body markdown-body" v-html="renderMd(m._reportStream)"></div>
              </div>

              <div v-if="m._running" class="cv-scan"></div>

              <!-- Handoff — offer to continue in new session -->
              <div v-if="m._handoffReady" class="cv-handoff">
                <div class="cv-handoff-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4 6l4 4 4-4" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round"/></svg>
                </div>
                <div class="cv-handoff-text">
                  <span class="cv-handoff-title">上下文已用 {{ m._handoffPct || '80' }}%</span>
                  <span class="cv-handoff-desc">接力文档已生成（Follow.md + Task.md + Keep.md），新对话可直接继续</span>
                </div>
                <button class="cv-handoff-btn" @click="startHandoffSession(m)" :disabled="loading">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M2 6h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  新对话继续
                </button>
              </div>

              <!-- Task plan — collapsible, auto-collapse when all done -->
              <div v-if="m._todos && m._todos.length" class="cv-todos">
                <div class="cv-todos-hdr" @click="toggleTodosOpen(m)" style="cursor:pointer">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5l2 2 5-5" stroke="var(--green)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <span>任务计划 ({{ m._todos.filter(t => t.status === 'completed').length }}/{{ m._todos.length }})</span>
                  <svg :class="['cv-think-chev', { open: m._todosOpen !== false }]" width="10" height="10" viewBox="0 0 10 10" fill="none" style="margin-left:auto">
                    <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div v-if="m._todosOpen !== false">
                <div v-for="t in m._todos" :key="t.id" class="cv-todo-item" :class="{ done: t.status === 'completed', active: t.status === 'in_progress' }">
                  <svg v-if="t.status === 'completed'" width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="var(--green)" stroke-width=".8"/><path d="M3.5 5.5l1.3 1.3 2.7-2.7" stroke="var(--green)" stroke-width=".8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <svg v-else-if="t.status === 'in_progress'" width="11" height="11" viewBox="0 0 11 11" fill="none" class="cv-todo-spin"><circle cx="5.5" cy="5.5" r="4" stroke="var(--accent)" stroke-width=".8" opacity=".3"/><path d="M9.5 5.5a4 4 0 00-3.2-3.9" stroke="var(--accent)" stroke-width=".9" stroke-linecap="round"/></svg>
                  <svg v-else width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="var(--text3)" stroke-width=".8"/></svg>
                  <span class="cv-todo-text">{{ t.text }}</span>
                </div>
                </div> <!-- end v-if todosOpen -->
              </div>

            </div>
          </div>
        </template>
        <div v-if="!codeMessages.length && store.currentId" class="cv-chat-hint">
          {{ t('codeChatHint') }}
        </div>
      </div>

      <div class="cv-chat-bar">
        <div class="cv-chat-row">
          <textarea ref="inputRef" v-model="task" :placeholder="t('codePlaceholder')" :rows="1"
            @keydown="onKey" @input="autoResize" class="cv-input" />
          <div class="cv-model-wrap">
            <button class="cv-model-btn" @click="showModelMenu = !showModelMenu">
              <span class="cv-model-dot" :class="{ pro: (codeModel || '').includes('pro') }"></span>
            </button>
            <Transition name="hist-pop">
              <div v-if="showModelMenu" class="cv-model-menu">
                <button :class="['cv-model-opt', { active: codeModel === 'deepseek-v4-pro' }]" @click="pickModel('deepseek-v4-pro')">
                  <span class="cv-model-dot pro"></span>V4-Pro
                </button>
                <button :class="['cv-model-opt', { active: codeModel === 'deepseek-v4-flash' }]" @click="pickModel('deepseek-v4-flash')">
                  <span class="cv-model-dot"></span>V4-Flash
                </button>
              </div>
            </Transition>
          </div>
          <button v-if="loading" class="cv-pause" @click="togglePause" :title="paused ? '恢复' : '暂停'">
            <svg v-if="!paused" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="2" width="3" height="8" rx="1" fill="currentColor"/>
              <rect x="7" y="2" width="3" height="8" rx="1" fill="currentColor"/>
            </svg>
            <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 2l8 4-8 4V2z" fill="currentColor"/>
            </svg>
          </button>
          <button class="cv-send" :class="{ off: !task.trim() }" :disabled="!task.trim()" @click="send">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 1.5l11 5.5-11 5.5 3-5.5-3-5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Modals unchanged -->
    <div v-if="showOpenProject" class="cv-modal-overlay" @click.self="showOpenProject = false">
      <div class="cv-modal">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4h4L8.3 5.5H13V12H3V4z" stroke="var(--accent)" stroke-width="1.2" stroke-linejoin="round"/></svg>
          <span>{{ t('codeOpenProject') }}</span>
          <button class="cv-modal-close" @click="showOpenProject = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="cv-modal-body">
          <div class="cv-field">
            <label class="cv-label">{{ t('codeProjectPath') || '项目路径' }}</label>
            <input v-model="openProjectPath" class="cv-field-input" placeholder="E:\MyProject" @keydown.enter="confirmOpenProject" />
          </div>
          <div class="cv-field-hint">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--text3)" stroke-width="1"/><path d="M6 3.5v2.5M6 8.5v.01" stroke="var(--text3)" stroke-width="1.2" stroke-linecap="round"/></svg>
            {{ t('codeInputPath') }}
          </div>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showOpenProject = false">{{ t('codeCancel') }}</button>
          <button class="cv-modal-btn ok" :disabled="!openProjectPath.trim()" @click="confirmOpenProject">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4 6.5l1.5 1.5L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            确认
          </button>
        </div>
      </div>
    </div>

    <div v-if="showConfirmTakeover" class="cv-modal-overlay">
      <div class="cv-modal" style="width:380px">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="var(--accent)" stroke-width="1.2"/><path d="M8 5v3.5M8 11v.01" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round"/></svg>
          <span>SuperDS</span>
        </div>
        <div class="cv-modal-body">
          <p class="cv-confirm-text">{{ t('codeTakeover') }}</p>
          <p class="cv-confirm-sub">{{ t('codeTakeoverSub') }}</p>
          <p class="cv-confirm-path">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h3L6 4h4v5.5H2V3z" stroke="var(--text3)" stroke-width="1" stroke-linejoin="round"/></svg>
            {{ takeoverPath }}
          </p>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showConfirmTakeover = false">{{ t('codeReject') }}</button>
          <button class="cv-modal-btn ok" @click="confirmTakeover">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5L5 9l5.5-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            同意
          </button>
        </div>
      </div>
    </div>

    <div v-if="showNewProject" class="cv-modal-overlay" @click.self="showNewProject = false">
      <div class="cv-modal">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7 1v14M1 7h14" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>{{ t('codeNewProject') }}</span>
          <button class="cv-modal-close" @click="showNewProject = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="cv-modal-body">
          <div class="cv-field">
            <label class="cv-label">{{ t('codeProjectName') }}</label>
            <input v-model="newProjectName" class="cv-field-input" :placeholder="t('codeProjectNameHint') || '输入项目名称...'" @keydown.enter="confirmNewProject" />
          </div>
          <div class="cv-field">
            <label class="cv-label">{{ t('codeParentDir') }}</label>
            <input v-model="newProjectParent" class="cv-field-input" :placeholder="t('codeParentDirHint') || '如 E:\\'" />
          </div>
          <div class="cv-field-hint">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v6M6 10v.01" stroke="var(--text3)" stroke-width="1.2" stroke-linecap="round"/></svg>
            将在 {{ previewPath }} 创建项目文件夹
          </div>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showNewProject = false">{{ t('codeCancel') }}</button>
          <button class="cv-modal-btn ok" :disabled="!newProjectName.trim()" @click="confirmNewProject">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5L5 9l5.5-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            创建
          </button>
        </div>
      </div>
    </div>

    <div v-if="showSwitch" class="cv-modal-overlay" @click.self="showSwitch = false">
      <div class="cv-modal" style="width:360px">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="var(--accent)" stroke-width="1.2"/><path d="M8 5v3.5M8 11v.01" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round"/></svg>
          <span>{{ t('codeSwitchProj') }}</span>
        </div>
        <div class="cv-modal-body" style="text-align:center">
          <p class="cv-confirm-text">{{ t('codeOneProject') }}</p>
          <p class="cv-confirm-sub" style="margin-bottom:0">{{ t('codeSwitchSub') }}</p>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showSwitch = false">{{ t('codeCancel') }}</button>
          <button class="cv-modal-btn ok" @click="doSwitchProject">{{ t('codeConfirmSwitch') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUpdated, nextTick, watch } from 'vue'
import { useCodeStore } from '../stores/codeStore.js'
import { renderMarkdown, reinitMermaid } from '../utils/markdown.js'
import { scanFileTree, readFileContent, newProject, runCodeAgent } from '../api/code.api.js'
import { BASE_URL } from '../api/client.js'
import { getApiHeaders } from '../utils/apiHeaders.js'
import { useI18n } from '../composables/useI18n.js'
import { getAgentPhrase } from '../utils/agentPhrases.js'
import hljs from 'highlight.js'
window.hljs = hljs

const { t } = useI18n()
const store = useCodeStore()
const renderMd = (text) => renderMarkdown(text || '')
const task = ref('')
const inputRef = ref(null)
const codeRef = ref(null)
const chatRef = ref(null)
const rootRef = ref(null)
const showOpenProject = ref(false)
const openProjectPath = ref('')
const showConfirmTakeover = ref(false)
const takeoverPath = ref('')
const showNewProject = ref(false)
const newProjectName = ref('')
const newProjectParent = ref('E:\\')
const loading = ref(false)
const paused = ref(false)
const codeModel = ref(localStorage.getItem('code_model') || 'deepseek-v4-pro')
const showModelMenu = ref(false)
let _isCreatingProject = false

function pickModel(m) {
  codeModel.value = m
  showModelMenu.value = false
  try { localStorage.setItem('code_model', m) } catch {}
}

async function togglePause() {
  paused.value = !paused.value
  const endpoint = paused.value ? '/api/code/pause' : '/api/code/resume'
  try {
    await fetch(`${BASE_URL}${endpoint}`, { method: 'POST', headers: getApiHeaders({}) })
  } catch {}
}

const previewPath = computed(() => {
  const base = newProjectParent.value.replace(/\\$/, '')
  const name = newProjectName.value.trim() || 'NewProject'
  return base + '\\' + name
})

// ─── Chat panel width ───
const chatWidth = ref(360)
let _resizeStartX = 0
let _resizeStartW = 0

function startResize(target, e) {
  _resizeStartX = e.clientX
  _resizeStartW = chatWidth.value
  document.addEventListener("mousemove", onResize)
  document.addEventListener("mouseup", stopResize)
  document.body.style.cursor = "col-resize"
  document.body.style.userSelect = "none"
}

function onResize(e) {
  chatWidth.value = Math.max(280, Math.min(600, _resizeStartW + (_resizeStartX - e.clientX)))
}

function stopResize() {
  document.removeEventListener("mousemove", onResize)
  document.removeEventListener("mouseup", stopResize)
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
  localStorage.setItem("code_chat_width", chatWidth.value)
}

try {
  const saved = localStorage.getItem("code_chat_width")
  if (saved) chatWidth.value = parseInt(saved) || 360
} catch {}

// ─── Enhanced message list with step cards ───
const codeMessages = computed(() => {
  const raw = store.messages
  return raw.filter(m => !m._isRoundMarker).map(m => {
    if (m.role !== 'ai') return m
    // Only build step cards for new agent-style messages; old ones stay as plain bubbles
    const hasEvents = m._events && m._events.length > 0
    if (!hasEvents) {
      // Old message from DB — show clean completed card
      return {
        ...m,
        _steps: [],
        _summary: '任务完成',
        _running: false,
        _done: true,
        _error: false,
        _expanded: true,
        _thinkOpen: false,
        _timer: '',
        _reportStream: '',
        thinking: m.thinking || '',
      }
    }
    const events = m._events || []
    const flatSteps = buildFlatSteps(events)

    // Dynamic summary based on current state
    let summary
    if (m._error) {
      summary = '出错了'
    } else if (m._done) {
      const lastReport = [...flatSteps].reverse().find(s => s._type === 'report')
      summary = lastReport?._text?.slice(0, 50) || '任务完成'
    } else if (m._reportStream) {
      summary = '写汇报中...'
    } else if (m._streaming) {
      summary = '思考中...'
    } else {
      const lastLive = [...flatSteps].reverse().find(s => s._live)
      summary = lastLive ? lastLive._phrase : '分析中...'
    }

    return {
      ...m,
      _flatSteps: flatSteps,
      _groups: flatSteps,  // keep for backward compat
      _streaming: m._streaming || '',
      _reportStream: m._reportStream || '',
      _summary: summary,
      _running: m._done === false && !m._error,
      _done: m._done !== false,
      _error: !!m._error,
      _expanded: m._expanded !== false,
      _thinkOpen: m._thinkOpen !== false,
      _todosOpen: m._todosOpen !== false,  // collapsed by default when all done
    }
  })
})

// ─── Build flat sequential steps (like chat mode / Cursor) ═══
function buildFlatSteps(events) {
  if (!events || !events.length) return []
  const steps = []
  let curThink = ''
  let lastThinkIdx = -1

  function flushThink() {
    if (curThink.trim()) {
      // New thinking always opens expanded so user sees it
      // Previous thinking auto-collapses
      if (lastThinkIdx >= 0 && steps[lastThinkIdx]) {
        steps[lastThinkIdx]._open = false
      }
      steps.push({ _type: 'think', _text: curThink.trim(), _live: false, _open: true })
      lastThinkIdx = steps.length - 1
    }
    curThink = ''
  }

  for (const e of events) {
    if (e.type === 'step_thinking' && e.text) {
      curThink += e.text
    }
    if (e.type === 'step_thinking_done') {
      flushThink()
    }
    if (e.type === 'tool_start') {
      flushThink()
      const a = e.args || {}
      const detail = a.path || a.pattern || a.query || a.command || a.dir || ''
      const toolName = (e.tool || '')
      const fileName = a.path ? a.path.split('\\').pop().split('/').pop() : ''
      steps.push({
        _type: 'tool', _tool: toolName.replace(/_/g, ' '), _file: fileName,
        _detail: detail || (Object.keys(a).length ? JSON.stringify(a).slice(0, 200) : ''),
        _phrase: getAgentPhrase(toolName, 'active', toolName),
        _live: true, _open: false,
      })
      // Collapse previous thinking when tools start
      if (lastThinkIdx >= 0 && steps[lastThinkIdx]) {
        steps[lastThinkIdx]._open = false
      }
    }
    if (e.type === 'tool_result') {
      for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i]._type === 'tool' && steps[i]._live) {
          steps[i]._live = false
          const tn = steps[i]._tool.replace(/ /g, '_')
          steps[i]._phrase = getAgentPhrase(tn, 'done', tn)
          if (!steps[i]._detail && e.result) steps[i]._detail = String(e.result).slice(0, 250)
          break
        }
      }
    }
    if (e.type === 'step_report' && e.text) {
      flushThink()
      steps.push({ _type: 'report', _text: e.text })
    }
    if (e.type === 'planning') {
      steps.push({ _type: 'plan', _text: e.text || '正在规划任务...' })
    }
    if (e.type === 'plan_done') {
      flushThink()
      steps.push({ _type: 'plan', _text: e.quickMode ? '分析模式' : '规划完成，开始执行' })
    }
    if (e.type === 'plan_reused') {
      flushThink()
      steps.push({ _type: 'plan', _text: `沿用已有计划（剩余 ${e.pendingCount || 0} 步）` })
    }
    if (e.type === 'error') {
      steps.push({ _type: 'error', _text: e.text || '未知错误' })
    }
  }
  flushThink()
  return steps
}

function hintForCode(tool, args) {
  const map = {
    list_files: '巡视项目结构',
    read_file: '仔细阅读文件内容',
    write_file: '正在创建新文件',
    write_to_file: '正在创建新文件',
    edit_file: '精确修改代码',
    grep: '搜索代码中',
    glob: '查找文件',
    run_command: '执行命令',
    bash: '执行命令',
  }
  return map[tool] || ''
}

const activeFile = computed(() =>
  store.openFiles.find(f => f.path === store.activeFilePath)
)

// ─── Syntax-highlighted display lines with correct diff coloring ───
const displayLines = computed(() => {
  const f = activeFile.value
  if (!f) return []
  const content = f.content || ''
  // If file is deleted, show all lines as deleted
  if (f._deleted) {
    return content.split('\n').map((text, i) => ({
      text, _num: i + 1, _deleted: true, _added: false, _html: escHtml(text)
    }))
  }

  const filePath = f.path
  const fileDiffs = store.pendingDiffs.filter(d => d.filePath === filePath)
  const lines = content.split('\n')

  // Build a map: line index → diff info
  // For each diff, mark old range as deleted, new range as added
  const diffMarkers = new Map() // lineIndex → { deleted, added, diffIdx }

  for (let di = 0; di < fileDiffs.length; di++) {
    const diff = fileDiffs[di]
    const oldLines = (diff.oldCode || '').split('\n')
    const newLines = (diff.newCode || '').split('\n')
    const start = Math.max(0, (diff.lineStart || 1) - 1)

    // Mark old lines as deleted where they match the file content
    for (let j = 0; j < oldLines.length; j++) {
      const idx = start + j
      if (idx < lines.length && oldLines[j] === lines[idx]) {
        diffMarkers.set(idx, { deleted: true, added: false, diffIdx: di })
      }
    }
    // New lines are already in content (AI wrote them) — mark as added
    for (let j = 0; j < newLines.length; j++) {
      const idx = start + j
      if (idx < lines.length) {
        // Only mark as added if not already deleted (new code replaces old)
        if (j < oldLines.length && oldLines[j] === newLines[j]) continue // unchanged line
        diffMarkers.set(idx, { deleted: false, added: true, diffIdx: di })
      }
    }
  }

  let result = lines.map((text, i) => {
    const marker = diffMarkers.get(i)
    return {
      text,
      _num: i + 1,
      _deleted: marker ? marker.deleted : false,
      _added: marker ? marker.added : false,
      _diffIdx: marker ? marker.diffIdx : undefined,
      _diffActions: marker ? (i === findLastDiffLine(diffMarkers, marker.diffIdx, i)) : false,
      _html: '',
    }
  })

  // Syntax highlighting
  try {
    const lang = extToLang(f.name || '')
    const raw = result.map(l => l.text).join('\n')
    const hl = tryHighlight(raw, lang)
    if (hl) {
      const hlLines = hl.split('\n')
      result.forEach((l, i) => {
        if (i < hlLines.length) l._html = hlLines[i]
      })
    }
  } catch {}

  return result
})

// Find the last line of a given diff to show actions only once
function findLastDiffLine(markers, diffIdx, currentIdx) {
  let last = currentIdx
  for (const [idx, m] of markers) {
    if (m.diffIdx === diffIdx && idx > last) last = idx
  }
  return last === currentIdx // only true at the last line of the diff
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function extToLang(name) {
  const ext = (name || '').split('.').pop().toLowerCase()
  const map = { js:'javascript', ts:'typescript', vue:'html', jsx:'javascript', tsx:'typescript', py:'python', rb:'ruby', go:'go', rs:'rust', java:'java', css:'css', scss:'scss', html:'xml', json:'json', md:'markdown', yml:'yaml', yaml:'yaml', xml:'xml', sql:'sql', sh:'bash', bat:'bash', ps1:'powershell', c:'c', cpp:'cpp', h:'c', hpp:'cpp', php:'php', swift:'swift', kt:'kotlin', dart:'dart', lua:'lua', r:'r', txt:'' }
  return map[ext] || ''
}

function tryHighlight(code, lang) {
  if (!lang || !code) return null
  try {
    if (window.hljs && window.hljs.getLanguage(lang)) {
      return window.hljs.highlight(code, { language: lang }).value
    }
  } catch {}
  return null
}

onMounted(() => {
  store.restoreSession()
  if (store.projectPath) loadProject(store.projectPath)
  // Scroll to bottom after restoring messages
  nextTick(() => { scrollDown() })
})

// Scroll to bottom when switching conversations
watch(() => store.currentId, () => {
  nextTick(() => { scrollDown() })
})

watch(() => store.activeFilePath, async (fp) => {
  if (!fp) return
  const existing = store.openFiles.find(f => f.path === fp)
  if (existing && existing.content && existing.content.length > 10) return
  try {
    const { content, name } = await readFileContent(fp, store.projectPath)
    store.updateFileContent(fp, content)
    if (!existing) store.openFile(fp, name, content)
  } catch {
    // File deleted or not found — mark it
    if (existing) {
      existing._deleted = true
      store.updateFileContent(fp, existing.content || '')
    }
  }
})

async function loadProject(projectPath) {
  store.setProject(projectPath, projectPath.split('\\').pop() || projectPath)
  try {
    const { tree } = await scanFileTree(projectPath)
    store.setFileTree(tree || [])
  } catch (e) {
    console.error('[Code] loadProject failed:', e)
    store.setFileTree([])
  }
}

function confirmOpenProject() {
  const p = openProjectPath.value.trim()
  if (!p) return
  takeoverPath.value = p
  _isCreatingProject = false
  showConfirmTakeover.value = true
}

async function doOpenProject() {
  const p = takeoverPath.value
  showConfirmTakeover.value = false
  showOpenProject.value = false
  openProjectPath.value = ''
  store.setProject(p, p.split('\\').pop() || p)
  store.createConversation('Code 对话')
  await loadProject(p)
}

function confirmNewProject() {
  const name = newProjectName.value.trim()
  if (!name) return
  const base = newProjectParent.value.replace(/\\$/, '')
  const fullPath = base + '\\' + name
  takeoverPath.value = fullPath
  _isCreatingProject = true
  showConfirmTakeover.value = true
}

async function doCreateProject() {
  const name = takeoverPath.value.split('\\').pop()
  const fullPath = takeoverPath.value
  showConfirmTakeover.value = false
  showNewProject.value = false
  newProjectName.value = ''
  try {
    const { tree } = await newProject(fullPath, name)
    store.setFileTree(tree || [])
    store.setProject(fullPath, name)
    store.createConversation(name)
  } catch (e) { alert('创建失败: ' + e.message) }
}

function confirmTakeover() {
  if (_isCreatingProject) doCreateProject()
  else doOpenProject()
}

async function onFileSelect(item) {
  try {
    const { content, name } = await readFileContent(item.path)
    store.openFile(item.path, name, content)
  } catch (e) { alert('读取失败: ' + e.message) }
}

async function acceptDiffIdx(di) {
  if (di == null || di >= store.pendingDiffs.length) return
  await store.acceptDiff(di)
  refreshFileTree()
}

async function rejectDiffIdx(di) {
  if (di == null || di >= store.pendingDiffs.length) return
  await store.rejectDiff(di)
  refreshFileTree()
}

// Debounced file tree refresh
let _treeRefreshTimer = null
function refreshFileTree() {
  clearTimeout(_treeRefreshTimer)
  _treeRefreshTimer = setTimeout(async () => {
    if (!store.projectPath) return
    try {
      const { tree } = await scanFileTree(store.projectPath)
      store.setFileTree(tree || [])
    } catch {}
  }, 500)
}
function startHandoffSession(msg) {
  // Create a new conversation that will pick up Follow.md + Task.md + Keep.md
  const title = (task.value || '继续任务').slice(0, 30)
  store.createConversation(title)
  // The next agent run will detect isHandoff=true and inject all three docs
  // Clear handoff flag for the new card
  msg._handoffReady = false
  scrollDown()
}

function toggleTodosOpen(msg) {
  // Toggle on the original reactive message so Vue tracks it
  const id = msg._id
  const msgs = store.messages
  const orig = msgs.find(m => m._id === id)
  if (orig) {
    orig._todosOpen = orig._todosOpen === false ? true : false
  }
}

function onThinkScroll(e) {
  const el = e.target
  // If user scrolled away from bottom (>30px), mark as user-scrolled
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  if (distFromBottom > 30) {
    el._userScrolled = true
  } else {
    el._userScrolled = false
  }
}

function scrollDown() {
  nextTick(() => {
    if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight
    // Auto-scroll think body to bottom (unless user manually scrolled up)
    const thinkBodies = document.querySelectorAll('.cv-think-body')
    thinkBodies.forEach(el => {
      if (el._userScrolled) return
      el.scrollTop = el.scrollHeight
    })
    reinitMermaid()
  })
}

const showSwitch = ref(false)
function newCodeConv() { store.createConversation('Code 对话') }
function doSwitchProject() {
  showSwitch.value = false
  store.openFiles = []
  store.activeFilePath = ''
  store.currentId = null
  store.openTabs = []
  store.messagesMap = {}
  store.tasks = []          // 清空旧项目计划
  store.pendingDiffs = []   // 清空旧项目 diff
  store.handoffCount = 0    // 重置接力计数
  store.setProject('', '')
  store.setFileTree([])
  store.saveSession()
}

function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}

function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 100) + 'px'
}

let _abortCtrl = null
let _timerInterval = null
async function send() {
  const txt = task.value.trim()
  if (!txt || loading.value || !store.projectPath) return
  task.value = ''
  loading.value = true
  paused.value = false

  if (!store.currentId) store.createConversation(txt.slice(0, 30))
  store.tasks = []  // clear old plan, fresh start for new message
  store.pushMessage({ _id: 'u_' + Date.now(), role: 'user', text: txt })
  store.addUserMessage(txt)

  const startTime = Date.now()
  const dbId = store.addAiMessage('', '', '', '[]', '[]', false, false, '0s')
  const aiMsg = reactive({
    _id: 'a_' + Date.now(), role: 'ai', text: '', html: '', thinking: '',
    _events: [], _done: false, _error: false, _expanded: true, _thinkOpen: true, _timer: '0s',
    _streaming: ''  // live streaming thinking text
  })
  store.pushMessage(aiMsg)
  scrollDown()

  // Timer & periodic DB save
  _timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - startTime) / 1000)
    aiMsg._timer = s < 60 ? s + 's' : Math.floor(s/60) + 'm ' + (s%60) + 's'
  }, 1000)

  _abortCtrl = new AbortController()
  let _saveDirty = false
  const _saveToDb = () => {
    if (!_saveDirty || dbId < 0) return
    _saveDirty = false
    store.updateMessageText(dbId, aiMsg.text, aiMsg.html, aiMsg.thinking,
      JSON.stringify(aiMsg._events), aiMsg._done ? 1 : 0, aiMsg._error ? 1 : 0, aiMsg._timer)
  }
  // Save to DB every 5 seconds
  const _dbInterval = setInterval(_saveToDb, 5000)

  try {
    // Only reuse plan if there are PENDING tasks. All-done → fresh plan.
    const pendingCount = (store.tasks || []).filter(t => !t.done).length
    const existingPlan = pendingCount > 0
      ? store.tasks.map(t => ({ id: t.id, text: t.text, done: !!t.done }))
      : null
    await runCodeAgent(txt, store.projectPath, codeModel.value, async (event) => {
      const e = event
      aiMsg._events.push(e)
      _saveDirty = true

      if (e.type === 'start') {
        aiMsg._streaming = (aiMsg._streaming || '') + '正在分析任务...\n\n'
        aiMsg._thinkOpen = true
      }
      if (e.type === 'planning' && e.text) {
        aiMsg._streaming = (aiMsg._streaming || '') + e.text + '\n'
        aiMsg._thinkOpen = true
      }
      if (e.type === 'streaming' && e.text) {
        // Replace with latest full content (server sends accumulated text)
        aiMsg._streaming = e.text
        aiMsg._thinkOpen = true
      }
      if (e.type === 'step_thinking_done') {
        // Keep streaming visible — just mark phase boundary, don't clear
        // Content stays in the think box until task is done
      }
      if (e.type === 'thinking' && e.text) {
        aiMsg.thinking = (aiMsg.thinking || '') + e.text
        aiMsg._thinkOpen = true
      }
      if (e.type === 'report_stream' && e.text) {
        // Final report streaming — show in real-time, clear thinking stream
        aiMsg._reportStream = e.text
        aiMsg._streaming = ''
        aiMsg._thinkOpen = false
      }
      if (e.type === 'code_diff') {
        store.addDiff({
          filePath: e.filePath,
          oldCode: e.oldCode || '',
          newCode: e.newCode || '',
          lineStart: e.lineStart || 1,
          isNewFile: e.isNewFile || false,
        })
        const fname = e.fileName || e.filePath.split('\\').pop()
        store.openFile(e.filePath, fname, '// 加载中...')
        try {
          const { content } = await readFileContent(e.filePath, store.projectPath)
          store.updateFileContent(e.filePath, content)
        } catch {}
        refreshFileTree()  // update file tree in real-time
      }
      if (e.type === 'plan_done' && e.tasks) {
        store.setTasks(e.tasks)
        // Only show task plan for multi-step plans (>1 task). Single-task = analysis mode, no plan UI.
        if (e.tasks.length > 1) {
          aiMsg._todos = e.tasks.map(t => ({ id: t.id, text: t.text, status: t.done ? 'completed' : 'pending' }))
        }
      }
      if (e.type === 'plan_reused' && e.tasks) {
        store.setTasks(e.tasks)
        // Only show plan UI for multi-step plans
        if (e.tasks.length > 1) {
          aiMsg._todos = e.tasks.map(t => ({ id: t.id, text: t.text, status: t.done ? 'completed' : 'pending' }))
        }
      }
      if (e.type === 'task_done' && e.taskId) {
        store.markTaskDone(e.taskId)
        // Check off in todo list
        if (aiMsg._todos) {
          const td = aiMsg._todos.find(t => t.id === e.taskId)
          if (td) td.status = 'completed'
        }
      }
      if (e.type === 'task_start' && e.taskId) {
        // Mark current task as in_progress in todo list
        if (aiMsg._todos) {
          const td = aiMsg._todos.find(t => t.id === e.taskId)
          if (td) td.status = 'in_progress'
        }
      }

      if (e.type === 'done') {
        aiMsg._done = true
        aiMsg._todosOpen = false  // auto-collapse task plan
        aiMsg._thinkOpen = false  // auto-collapse last thinking
        // Clear all streaming state
        aiMsg._streaming = ''
        aiMsg._reportStream = ''
        if (e.text) {
          aiMsg.text = e.text
          aiMsg.html = renderMarkdown(e.text)
          // If we had a streaming report, use it as final and clear stream
          if (!aiMsg._reportStream) aiMsg._reportStream = e.text
        }
        aiMsg._thinkOpen = false
        // Persist todos
        if (e.todos && e.todos.length) {
          aiMsg._todos = e.todos
        }
      }
      if (e.type === 'subagent_start') {
        aiMsg.thinking = (aiMsg.thinking || '') + '\n[子Agent启动: ' + (e.text || '').slice(0, 30) + ']'
        aiMsg._thinkOpen = true
      }
      if (e.type === 'subagent_done') {
        aiMsg.thinking = (aiMsg.thinking || '') + '\n[子Agent完成]'
      }
      if (e.type === 'handoff_ready') {
        aiMsg._handoffReady = true
        aiMsg._handoffTokens = e.tokens
        aiMsg._handoffPct = e.pct
        aiMsg._thinkOpen = true
      }
      if (e.type === 'context_usage' && e.pct >= 80) {
        aiMsg.thinking = (aiMsg.thinking || '') + '\n[上下文 ' + e.pct + '%]'
        if (e.handoffReady) aiMsg._handoffReady = true
        aiMsg._thinkOpen = true
      }
      if (e.type === 'error') {
        aiMsg._error = true
        aiMsg.html = renderMarkdown('**出错**: ' + (e.text || '未知'))
      }
      await nextTick(); scrollDown()
    }, _abortCtrl.signal, existingPlan)
  } catch (e) {
    if (e.name !== 'AbortError') {
      aiMsg._error = true
      aiMsg.html = renderMarkdown('**出错**: ' + (e.message || '未知'))
    }
  }

  clearInterval(_timerInterval)
  clearInterval(_dbInterval)
  aiMsg._done = true
  loading.value = false
  _abortCtrl = null
  _saveToDb()
  if (store.projectPath) loadProject(store.projectPath)
  scrollDown()
}
</script>

<style scoped>
.cv-root { display: flex; height: 100%; overflow: hidden; }
.cv-resize-handle { width: 4px; cursor: col-resize; flex-shrink: 0; background: transparent; transition: background .2s; z-index: 10; }
.cv-resize-handle:hover { background: var(--accent); opacity: .4; }
.cv-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; background: var(--bg); }
.cv-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; }
.cv-empty-title { font-size: 18px; font-weight: 400; color: var(--text); }
.cv-empty-desc { font-size: 13px; color: var(--text3); font-weight: 300; }
.cv-empty-actions { display: flex; gap: 10px; margin-top: 12px; }
.cv-act-btn { display: flex; align-items: center; gap: 7px; padding: 8px 16px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg2); color: var(--text2); cursor: pointer; font-size: 13px; font-family: inherit; font-weight: 300; transition: all .12s; }
.cv-act-btn:hover { background: var(--bg3); border-color: var(--accent); color: var(--text); }

/* ─── Tabs ─── */
.cv-tabs { display: flex; gap: 2px; padding: 4px 8px 0; background: var(--bg2); border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0; }
.cv-tabs::-webkit-scrollbar { height: 2px; }
.cv-tab { display: flex; align-items: center; gap: 5px; padding: 6px 10px 5px; border-radius: 6px 6px 0 0; cursor: pointer; font-size: 12px; font-weight: 300; color: var(--text3); border: 1px solid transparent; border-bottom: none; white-space: nowrap; transition: all .12s; }
.cv-tab:hover { background: var(--bg3); color: var(--text2); }
.cv-tab.active { background: var(--bg); color: var(--text); border-color: var(--border); }
.cv-tab.deleted .cv-tab-name { text-decoration: line-through; color: var(--red); opacity: .7; }
.cv-tab-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.cv-tab-close { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 3px; border: none; background: transparent; color: var(--text3); cursor: pointer; }
.cv-tab-close:hover { background: var(--bg4); color: var(--red); }

/* ─── Code area ─── */
.cv-code { flex: 1; overflow: auto; padding: 8px 0; position: relative; }
.cv-code::-webkit-scrollbar { width: 4px; }
.cv-code::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }
.cv-code-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text3); font-size: 13px; font-weight: 300; }
.cv-code-inner { font-family: var(--font-mono); font-size: 13px; line-height: 1.65; }
.cv-line { display: flex; gap: 0; padding: 0 12px; transition: background .15s; }
.cv-line:hover { background: var(--bg3); }
.cv-line-num { width: 42px; text-align: right; padding-right: 14px; color: var(--text3); font-size: 11px; user-select: none; flex-shrink: 0; }
.cv-line-code { white-space: pre; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; }
.cv-line-del { background: rgba(248,81,73,.08); }
.cv-line-del .cv-line-code { text-decoration: line-through; color: var(--red); opacity: .7; }
.cv-line-add { background: rgba(63,185,80,.08); }
.cv-line-add .cv-line-code { color: var(--green); }
/* Per-diff inline actions */
.cv-diff-inline-actions { display: flex; gap: 2px; margin-left: auto; flex-shrink: 0; }
.cv-diff-inline-actions .cv-diff-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; border: 1px solid var(--border); background: var(--bg2); cursor: pointer; transition: all .12s; padding: 0; }
.cv-diff-inline-actions .cv-diff-btn.accept { color: var(--green); border-color: rgba(63,185,80,.3); }
.cv-diff-inline-actions .cv-diff-btn.accept:hover { background: rgba(63,185,80,.15); }
.cv-diff-inline-actions .cv-diff-btn.reject { color: var(--red); border-color: rgba(248,81,73,.25); }
.cv-diff-inline-actions .cv-diff-btn.reject:hover { background: rgba(248,81,73,.15); }

/* ─── Chat area ─── */
.cv-chat { width: 360px; display: flex; flex-direction: column; border-left: 1px solid var(--border); background: var(--bg2); flex-shrink: 0; overflow: hidden; }
.cv-chat-top { display: flex; align-items: center; padding: 4px 4px 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.cv-chat-tabs { display: flex; gap: 2px; overflow-x: auto; flex: 1; min-width: 0; }
.cv-chat-tabs::-webkit-scrollbar { height: 2px; }
.cv-chat-acts { display: flex; gap: 2px; flex-shrink: 0; padding-left: 4px; }
.cv-chat-act { width: 26px; height: 26px; border-radius: 5px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.cv-chat-act:hover { background: var(--bg3); color: var(--text); }
.cv-ctab { display: flex; align-items: center; gap: 4px; padding: 5px 8px; border-radius: 6px 6px 0 0; cursor: pointer; font-size: 11px; font-weight: 300; color: var(--text3); border: 1px solid transparent; border-bottom: none; white-space: nowrap; }
.cv-ctab:hover { color: var(--text2); }
.cv-ctab.active { background: var(--bg); color: var(--text); border-color: var(--border); }
.cv-ctab-title { max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
.cv-ctab-close { display: flex; align-items: center; width: 12px; height: 12px; border: none; background: transparent; color: var(--text3); cursor: pointer; }
.cv-chat-msgs { flex: 1; overflow-y: auto; padding: 10px; }
.cv-chat-msgs::-webkit-scrollbar { width: 3px; }
.cv-msg { margin-bottom: 10px; }
.cv-msg-user { display: flex; justify-content: flex-end; }
.cv-bubble { padding: 8px 12px; font-size: 13px; line-height: 1.55; font-weight: 300; word-break: break-word; }
.cv-bubble-user { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-lg); max-width: 85%; }
.cv-chat-hint { padding: 20px 0; text-align: center; font-size: 12px; color: var(--text3); font-weight: 300; }

/* ─── Agent-style step cards ─── */
.cv-card { border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); overflow: hidden; margin-bottom: 8px; transition: border-color .3s; }
.cv-card.running { border-color: rgba(79,125,255,.2); }
.cv-card.done { border-color: rgba(63,185,80,.12); }
.cv-card-hdr { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 7px 10px; gap: 8px; background: none; border: none; color: var(--text2); font: 300 12px var(--font-sans); cursor: pointer; text-align: left; transition: background .12s; }
.cv-card-hdr:hover { background: var(--bg3); }
.cv-card-hdr-l { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.cv-card-hdr-r { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.cv-card-label { font-weight: 500; color: var(--text); font-size: 13px; flex-shrink: 0; }
.cv-card-dash { color: var(--text3); flex-shrink: 0; font-size: 11px; }
.cv-card-sum { color: var(--text2); font-weight: 300; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-card-timer { font-size: 10px; color: var(--text3); font-variant-numeric: tabular-nums; }
.cv-card-chev { flex-shrink: 0; opacity: .4; transition: transform .15s; }
.cv-card-chev.open { transform: rotate(180deg); opacity: .7; }

@keyframes cvSpin { to { transform: rotate(360deg); } }
.cv-card-spin { animation: cvSpin 1.2s linear infinite; flex-shrink: 0; }

.cv-card-body { padding: 2px 2px 8px; position: relative; }

/* ─── Step banners (plan / error) ─── */
.cv-step-banner { padding: 5px 10px; font-size: 12px; font-weight: 400; color: var(--accent); background: rgba(79,125,255,.04); border-radius: 4px; margin-bottom: 4px; }
.cv-step-err { color: var(--red); background: rgba(248,81,73,.04); }

/* ─── Live thinking block (streaming) ─── */
.cv-think-live { margin: 4px 0; border: 1px solid rgba(79,125,255,.25); border-radius: var(--radius); background: rgba(79,125,255,.03); overflow: hidden; animation: cvPulseBorder 2s ease-in-out infinite; }
@keyframes cvPulseBorder { 0%,100%{border-color:rgba(79,125,255,.12)} 50%{border-color:rgba(79,125,255,.35)} }
.cv-think-live-hdr { display: flex; align-items: center; gap: 6px; padding: 5px 10px; border-bottom: 1px solid var(--border); }
.cv-think-dot { flex-shrink: 0; animation: cvPulse 1.2s ease-in-out infinite; }
@keyframes cvPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.cv-think-live-label { font-size: 11px; font-weight: 500; color: var(--accent); }
.cv-think-live-body { padding: 8px 10px; font-size: 13px; line-height: 1.6; color: var(--text); max-height: 400px; overflow-y: auto; }
.cv-think-body { padding: 8px 10px; font-size: 13px; line-height: 1.6; color: var(--text); max-height: 200px; overflow-y: auto; }
.cv-think-live-body :deep(p) { margin: 4px 0; }
.cv-think-live-body :deep(pre) { margin: 6px 0; padding: 8px 10px; background: var(--bg3); border-radius: 4px; font-size: 11px; overflow-x: auto; }
.cv-think-live-body :deep(code) { font-family: var(--font-mono); font-size: 11px; }
.cv-think-live-body :deep(.mermaid-wrap) { margin: 6px 0; }
.cv-think-live-body :deep(svg) { max-width: 100%; height: auto; }
.cv-report-live { border-color: rgba(63,185,80,.3) !important; background: rgba(63,185,80,.03) !important; animation: cvPulseBorderGreen 2s ease-in-out infinite; }
@keyframes cvPulseBorderGreen { 0%,100%{border-color:rgba(63,185,80,.1)} 50%{border-color:rgba(63,185,80,.3)} }

/* ─── Collapsed thinking block (like chat mode) ─── */
.cv-think-block { margin-bottom: 2px; }
.cv-think-block.cv-think-live { border: 1px solid rgba(79,125,255,.25); border-radius: var(--radius); background: rgba(79,125,255,.03); }
.cv-think-block-hdr { display: flex; align-items: center; gap: 5px; padding: 4px 8px; cursor: pointer; user-select: none; border-radius: 4px; }
.cv-think-block-hdr:hover { background: var(--bg3); }
.cv-think-chev { flex-shrink: 0; color: var(--text3); transition: transform .15s; }
.cv-think-chev.open { transform: rotate(90deg); }
.cv-think-block-label { font-size: 11px; font-weight: 500; color: var(--text3); }
.cv-think-block-body { padding: 4px 10px 8px 23px; font-size: 12px; line-height: 1.55; color: var(--text2); white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow-y: auto; }
.cv-think-block-body.markdown-body { white-space: normal; }
.cv-think-block-body :deep(pre) { margin: 4px 0; padding: 6px 8px; background: var(--bg3); border-radius: 4px; font-size: 10px; overflow-x: auto; }
.cv-think-block-body :deep(code) { font-family: var(--font-mono); font-size: 10px; }
.cv-think-block-body :deep(p) { margin: 2px 0; }

/* ─── Report — markdown ─── */
.cv-report { padding: 6px 10px 6px 12px; font-size: 13px; line-height: 1.6; color: var(--text); }
.cv-report :deep(pre) { margin: 8px 0; padding: 10px 12px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow-x: auto; font-size: 11px; }
.cv-report :deep(code) { font-family: var(--font-mono); font-size: 11px; }
.cv-report :deep(p) { margin: 4px 0; }
.cv-report :deep(ul), .cv-report :deep(ol) { padding-left: 20px; margin: 4px 0; }
/* Mermaid diagrams */
.mermaid-wrap { margin: 8px 0; padding: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); overflow-x: auto; }
.mermaid-wrap :deep(svg) { max-width: 100%; height: auto; }
.svg-chart-wrap { background: #fff; }
.svg-chart-wrap :deep(svg) { max-width: 100%; height: auto; display: block; }

/* ─── Step rows (new: inline hint, richer) ─── */
.cv-step { margin-bottom: 1px; border-radius: 5px; transition: background .15s; }
.cv-step:hover { background: var(--bg3); }
.cv-step-row { display: flex; align-items: center; gap: 6px; padding: 5px 10px; cursor: pointer; font-size: 12px; font-weight: 300; }
.cv-step-spin { animation: cvSpin 1.2s linear infinite; flex-shrink: 0; }
.cv-step-ok { flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.cv-step-phrase { color: var(--text); font-size: 12px; font-weight: 400; flex-shrink: 0; white-space: nowrap; }
.cv-step-phrase.sweep { background: linear-gradient(90deg, var(--text) 30%, var(--accent) 50%, var(--text) 70%); background-size: 200% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; animation: cvSweep 2.2s ease-in-out infinite; }
@keyframes cvSweep { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }
.cv-step-tool { color: var(--text3); font-size: 10px; font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; opacity: .6; }
.cv-step-hint-inline { color: var(--text3); font-size: 10px; font-weight: 300; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; max-width: 120px; }
.cv-step-file { color: var(--accent); font-size: 11px; font-family: var(--font-mono); font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; flex-shrink: 1; }
.cv-step-chev { flex-shrink: 0; opacity: .35; transition: transform .15s; }
.cv-step-chev.open { transform: rotate(180deg); opacity: .65; }
.cv-step-detail { margin: 2px 10px 4px 27px; padding: 6px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 5px; }
.cv-step-code { font-size: 10px; font-family: var(--font-mono); color: var(--text2); white-space: pre-wrap; word-break: break-all; line-height: 1.5; }

/* ─── Handoff banner ─── */
.cv-handoff { margin: 8px 4px; padding: 10px 12px; border: 1px solid rgba(79,125,255,.25); border-radius: var(--radius); background: rgba(79,125,255,.04); display: flex; align-items: center; gap: 10px; }
.cv-handoff-icon { flex-shrink: 0; color: var(--accent); }
.cv-handoff-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.cv-handoff-title { font-size: 12px; font-weight: 500; color: var(--accent); }
.cv-handoff-desc { font-size: 11px; color: var(--text3); font-weight: 300; }
.cv-handoff-btn { display: flex; align-items: center; gap: 5px; flex-shrink: 0; padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--accent); background: var(--accent); color: #fff; font-size: 12px; font-family: inherit; font-weight: 400; cursor: pointer; transition: all .12s; white-space: nowrap; }
.cv-handoff-btn:hover { background: var(--accent-hover); }
.cv-handoff-btn:disabled { opacity: .4; cursor: not-allowed; }

/* ─── Scan line ─── */
.cv-scan { height: 1px; margin-top: 4px; background: linear-gradient(90deg, transparent, var(--accent), transparent); animation: cvScan 2s ease-in-out infinite; opacity: .4; }
@keyframes cvScan { 0% { opacity: 0; transform: scaleX(0); transform-origin: left; } 50% { opacity: 1; transform: scaleX(1); transform-origin: left; } 100% { opacity: 0; transform: scaleX(0); transform-origin: right; } }

/* ─── Task plan at bottom ─── */
.cv-todos { margin: 8px 4px 4px; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--bg); }
.cv-todos-hdr { display: flex; align-items: center; gap: 6px; padding: 7px 10px; font-size: 12px; font-weight: 500; color: var(--green); border-bottom: 1px solid var(--border); }
.cv-todo-item { display: flex; align-items: center; gap: 7px; padding: 5px 10px; font-size: 12px; color: var(--text2); font-weight: 300; transition: all .2s; }
.cv-todo-item.done { color: var(--text3); }
.cv-todo-item.done .cv-todo-text { text-decoration: line-through; opacity: .5; }
.cv-todo-item.active { color: var(--accent); font-weight: 500; background: rgba(79,125,255,.04); }
.cv-todo-spin { animation: cvSpin 1.2s linear infinite; }
.cv-todo-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ─── Final output ─── */
.cv-final { padding: 8px 10px; font-size: 13px; line-height: 1.6; color: var(--text); border-top: 1px solid var(--border); max-height: 300px; overflow-y: auto; }
.cv-final-err { border-top-color: rgba(248,81,73,.2); }


/* ─── Chat bar ─── */
.cv-chat-bar { padding: 8px 10px 12px; border-top: 1px solid var(--border); flex-shrink: 0; }
.cv-chat-row { display: flex; align-items: center; gap: 6px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; }
.cv-input { flex: 1; resize: none; background: none; border: none; outline: none; color: var(--text); font: 300 13px/1.5 var(--font-sans); min-height: 22px; max-height: 100px; }
.cv-input::placeholder { color: var(--text3); }
.cv-send { width: 28px; height: 28px; border-radius: 6px; border: none; background: var(--accent); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity .12s; }
.cv-send.off { background: var(--bg4); color: var(--text3); cursor: not-allowed; }
.cv-pause { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text2); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .12s; }
.cv-pause:hover { background: var(--bg4); color: var(--text); border-color: var(--accent); }
.cv-model-btn { width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cv-model-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--yellow); transition: background .15s; }
.cv-model-dot.pro { background: var(--accent); }
.cv-model-wrap { position: relative; }
.cv-model-menu { position: absolute; bottom: 100%; right: 0; margin-bottom: 6px; background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,.35); padding: 4px; z-index: var(--z-dropdown); min-width: 130px; }
.cv-model-opt { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border-radius: 6px; border: none; background: transparent; color: var(--text2); font-size: 12px; font-family: inherit; font-weight: 300; cursor: pointer; transition: background .1s; }
.cv-model-opt:hover { background: var(--bg3); }
.cv-model-opt.active { background: var(--accent-muted); color: var(--accent); }

/* ─── Modals ─── */
.cv-modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; }
.cv-modal { background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius); width: 420px; box-shadow: 0 12px 40px rgba(0,0,0,.4); }
.cv-modal-hdr { display: flex; align-items: center; gap: 8px; padding: 16px 18px; border-bottom: 1px solid var(--border); font-size: 15px; font-weight: 500; color: var(--text); }
.cv-modal-hdr svg { color: var(--accent); flex-shrink: 0; }
.cv-modal-close { margin-left: auto; width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.cv-modal-close:hover { background: var(--bg3); color: var(--text); }
.cv-modal-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.cv-field { display: flex; flex-direction: column; gap: 5px; }
.cv-label { font-size: 12px; font-weight: 500; color: var(--text2); }
.cv-field-input { flex: 1; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--bg3); border: 1px solid var(--border); color: var(--text); font-size: 13px; font-family: inherit; font-weight: 300; outline: none; transition: border-color .15s; }
.cv-field-input:focus { border-color: var(--accent); }
.cv-field-input::placeholder { color: var(--text3); }
.cv-field-hint { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text3); font-weight: 300; }
.cv-modal-ft { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 18px 16px; }
.cv-modal-btn { display: flex; align-items: center; gap: 5px; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-family: inherit; font-weight: 400; border: 1px solid var(--border); cursor: pointer; transition: all .12s; }
.cv-modal-btn.cancel { background: var(--bg3); color: var(--text2); }
.cv-modal-btn.cancel:hover { background: var(--bg4); color: var(--text); }
.cv-modal-btn.ok { background: var(--accent); color: #fff; border-color: var(--accent); }
.cv-modal-btn.ok:hover { background: var(--accent-hover); }
.cv-modal-btn.ok:disabled { background: var(--bg4); color: var(--text3); border-color: var(--border); cursor: not-allowed; }
.cv-confirm-text { font-size: 15px; color: var(--text); font-weight: 400; margin: 0 0 4px; }
.cv-confirm-sub { font-size: 12px; color: var(--text3); font-weight: 300; margin: 0 0 12px; }
.cv-confirm-path { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text3); font-family: var(--font-mono); background: var(--bg3); padding: 6px 10px; border-radius: 4px; word-break: break-all; }
.cv-folder-input { display: none; }

/* ─── highlight.js theme overrides ─── */
.cv-line-code :deep(.hljs-keyword) { color: #c678dd; }
.cv-line-code :deep(.hljs-string) { color: #98c379; }
.cv-line-code :deep(.hljs-number) { color: #d19a66; }
.cv-line-code :deep(.hljs-comment) { color: #5c6370; font-style: italic; }
.cv-line-code :deep(.hljs-function) { color: #61afef; }
.cv-line-code :deep(.hljs-title) { color: #61afef; }
.cv-line-code :deep(.hljs-built_in) { color: #e5c07b; }
.cv-line-code :deep(.hljs-literal) { color: #d19a66; }
.cv-line-code :deep(.hljs-type) { color: #e5c07b; }
.cv-line-code :deep(.hljs-attr) { color: #d19a66; }
.cv-line-code :deep(.hljs-params) { color: #abb2bf; }
.cv-line-code :deep(.hljs-meta) { color: #61afef; }
.cv-line-code :deep(.hljs-tag) { color: #e06c75; }
.cv-line-code :deep(.hljs-name) { color: #e06c75; }
.cv-line-code :deep(.hljs-attr) { color: #d19a66; }
.cv-line-code :deep(.hljs-selector-class) { color: #61afef; }
.cv-line-code :deep(.hljs-selector-id) { color: #61afef; }
</style>
