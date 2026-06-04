import { defineStore } from 'pinia'
import {
    createConversation as dbCreateConv,
    getMessages, addMessage, getConversations,
    deleteConversation, updateConversationTitle,
    updateMessage, deleteMessage, deleteMessagesSince
} from '../db/database.js'
import { conversations as convApi } from '../api/index.js'

const _abortMap = {}  // per-conversation abort controllers

export const useChatStore = defineStore('chat', {
    state: () => ({
        conversations: [],
        currentId: null,
        messagesMap: {},        // { [convId]: message[] } — keep all open convs in memory
        branchStateMap: {},     // { [convId]: { parentId: msgId } }
        openTabs: [],           // [convId, ...] ordered by open time
        apikey: '',
        model: 'deepseek-v4-flash',
        permissionMode: 'default',   // 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'
        loadingMap: {},         // { [convId]: boolean } — per-conversation loading state
        streamingId: null,
        streamingConvId: null,  // which conversation owns the active stream
    }),

    getters: {
        messages(state) {
            return state.messagesMap[state.currentId] || []
        },

        currentBranch(state) {
            return state.branchStateMap[state.currentId] || {}
        },

        visibleMessages(state) {
            const msgs = state.messagesMap[state.currentId] || []
            const bs = state.branchStateMap[state.currentId] || {}
            const result = []
            for (const msg of msgs) {
                if (msg.role === 'user') {
                    result.push(msg)
                } else if (msg.role === 'ai') {
                    const pid = msg.parent_id
                    if (pid != null) {
                        if (msg.streaming || bs[pid] === msg.id) {
                            result.push(msg)
                        }
                    } else {
                        result.push(msg)
                    }
                }
            }
            return result
        },

        openTabList(state) {
            return state.openTabs.map(id => {
                const conv = state.conversations.find(c => c.id === id)
                return { id, title: conv?.title || '新对话' }
            })
        },

        hasApikey: (state) => state.apikey.length > 0,
    },

    actions: {
        // ─── helpers ───
        _useServerApi() {
            return !!localStorage.getItem('bbot_token')
        },

        _hydrateMsg(m) {
            let files = []
            let designs = []
            if (m.files && m.files !== '[]') {
                try { files = JSON.parse(m.files) } catch {}
            }
            if (m.designs && m.designs !== '[]') {
                try { designs = JSON.parse(m.designs) } catch {}
            }
            return { ...m, files, designs, reasoning: m.reasoning || '' }
        },

        _initBranch(msgs) {
            const bs = {}
            for (const m of msgs) {
                if (m.role === 'ai' && m.parent_id != null) {
                    bs[m.parent_id] = m.id
                }
            }
            return bs
        },

        // ─── session persistence ───
        _saveSession() {
            try {
                const data = {
                    currentId: this.currentId,
                    openTabs: this.openTabs,
                    branchStateMap: this.branchStateMap,
                }
                localStorage.setItem('ds_session', JSON.stringify(data))
            } catch {}
        },

        async _restoreSession() {
            try {
                const raw = localStorage.getItem('ds_session')
                if (!raw) return
                const data = JSON.parse(raw)
                if (data.branchStateMap) this.branchStateMap = data.branchStateMap

                if (this._useServerApi()) {
                    // ── Server mode: load from API ──
                    this.conversations = await convApi.list()

                    if (data.openTabs && data.openTabs.length) {
                        const existing = this.conversations.map(c => c.id)
                        this.openTabs = data.openTabs.filter(id => existing.includes(id))
                    }
                    if (data.currentId) {
                        const exists = this.conversations.some(c => c.id === data.currentId)
                        if (exists) {
                            this.currentId = data.currentId
                            if (!this.messagesMap[data.currentId]) {
                                const result = await convApi.get(data.currentId)
                                this.messagesMap[data.currentId] = (result.messages || []).map(m => this._hydrateMsg(m))
                                if (!this.branchStateMap[data.currentId]) {
                                    this.branchStateMap[data.currentId] = this._initBranch(this.messagesMap[data.currentId])
                                }
                            }
                        }
                    }
                    for (const tid of this.openTabs) {
                        if (!this.messagesMap[tid]) {
                            try {
                                const result = await convApi.get(tid)
                                this.messagesMap[tid] = (result.messages || []).map(m => this._hydrateMsg(m))
                                if (!this.branchStateMap[tid]) {
                                    this.branchStateMap[tid] = this._initBranch(this.messagesMap[tid])
                                }
                            } catch { /* conv may not exist on server */ }
                        }
                    }
                } else {
                    // ── Local mode: load from sql.js ──
                    this.conversations = getConversations()

                    if (data.openTabs && data.openTabs.length) {
                        const existing = getConversations().map(c => c.id)
                        this.openTabs = data.openTabs.filter(id => existing.includes(id))
                    }
                    if (data.currentId) {
                        const existing = getConversations().map(c => c.id)
                        if (existing.includes(data.currentId)) {
                            this.currentId = data.currentId
                            if (!this.messagesMap[data.currentId]) {
                                this.messagesMap[data.currentId] = getMessages(data.currentId).map(m => this._hydrateMsg(m))
                                if (!this.branchStateMap[data.currentId]) {
                                    this.branchStateMap[data.currentId] = this._initBranch(this.messagesMap[data.currentId])
                                }
                            }
                        }
                    }
                    for (const tid of this.openTabs) {
                        if (!this.messagesMap[tid]) {
                            this.messagesMap[tid] = getMessages(tid).map(m => this._hydrateMsg(m))
                            if (!this.branchStateMap[tid]) {
                                this.branchStateMap[tid] = this._initBranch(this.messagesMap[tid])
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[Session] restore failed:', e.message)
            }
        },

        // ─── conversation ───
        async createConversation(id) {
            if (!this.apikey) this.loadApiKey()

            if (this._useServerApi()) {
                await convApi.create(id, this.model)
            } else {
                dbCreateConv(id, this.model)
            }

            this.currentId = id

            if (this._useServerApi()) {
                // Server mode: load the just-created conversation
                try {
                    const result = await convApi.get(id)
                    this.messagesMap[id] = (result.messages || []).map(m => this._hydrateMsg(m))
                    this.branchStateMap[id] = this._initBranch(this.messagesMap[id])
                } catch {
                    // Fallback: empty messages with welcome message
                    this.messagesMap[id] = []
                    this.branchStateMap[id] = {}
                }
                this.conversations = await convApi.list()
            } else {
                this.messagesMap[id] = getMessages(id).map(m => this._hydrateMsg(m))
                this.branchStateMap[id] = this._initBranch(this.messagesMap[id])
                this.conversations = getConversations()
            }

            if (!this.openTabs.includes(id)) {
                this.openTabs.push(id)
            }
            this._saveSession()
        },

        async loadMessages(id) {
            if (this._useServerApi()) {
                try {
                    const result = await convApi.get(id)
                    this.messagesMap[id] = (result.messages || []).map(m => this._hydrateMsg(m))
                    this.branchStateMap[id] = this._initBranch(this.messagesMap[id])
                } catch {
                    this.messagesMap[id] = []
                    this.branchStateMap[id] = {}
                }
            } else {
                this.messagesMap[id] = getMessages(id).map(m => this._hydrateMsg(m))
                this.branchStateMap[id] = this._initBranch(this.messagesMap[id])
            }
            this.currentId = id
            if (!this.openTabs.includes(id)) {
                this.openTabs.push(id)
            }
            this._saveSession()
        },

        async loadConversations() {
            if (this._useServerApi()) {
                this.conversations = await convApi.list()
            } else {
                this.conversations = getConversations()
            }
        },

        async deleteConv(id) {
            if (this._useServerApi()) {
                await convApi.delete(id).catch(() => {})
            } else {
                deleteConversation(id)
            }
            delete this.messagesMap[id]
            delete this.branchStateMap[id]
            this.openTabs = this.openTabs.filter(t => t !== id)
            // reload list
            if (this._useServerApi()) {
                this.conversations = await convApi.list()
            } else {
                this.conversations = getConversations()
            }
            this._saveSession()
        },

        updateConvTitle(id, title) {
            if (this._useServerApi()) {
                convApi.updateTitle(id, title).catch(() => {})
            } else {
                updateConversationTitle(id, title)
            }
            const conv = this.conversations.find(c => c.id === id)
            if (conv) {
                conv.title = title
            }
            this.conversations = [...this.conversations]
            if (id === this.currentId) {
                document.title = title + ' - Agent Chat'
            }
        },

        // ─── tabs ───
        switchTab(id) {
            if (id === this.currentId) return
            // auto-load if not in cache
            if (!this.messagesMap[id]) {
                // Load synchronously for local, mark for async load
                if (!this._useServerApi()) {
                    this.messagesMap[id] = getMessages(id).map(m => this._hydrateMsg(m))
                    this.branchStateMap[id] = this._initBranch(this.messagesMap[id])
                }
                // For server mode, the caller (HomeView/ChatView) should have already loaded via loadMessages
            }
            this.currentId = id
            if (!this.openTabs.includes(id)) {
                this.openTabs.push(id)
            }
            const conv = this.conversations.find(c => c.id === id)
            document.title = (conv?.title || '新对话') + ' - Agent Chat'
            this._saveSession()
        },

        closeTab(id) {
            this.openTabs = this.openTabs.filter(t => t !== id)
            if (this.currentId === id) {
                const next = this.openTabs.length > 0 ? this.openTabs[0] : null
                if (next) {
                    this.switchTab(next)
                } else {
                    this.currentId = null
                }
            }
            this._saveSession()
        },

        // ─── messages ───
        async addUserMessage(text, files = []) {
            if (!this.currentId) return null
            const filesJson = JSON.stringify(files)

            let newId
            if (this._useServerApi()) {
                // Optimistic: generate temp ID, persist async
                newId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
                const msg = { role: 'user', text, id: newId, files }
                const msgs = this.messagesMap[this.currentId] || []
                msgs.push(msg)
                this.messagesMap[this.currentId] = msgs

                // Persist to server
                try {
                    const result = await convApi.addMessage(this.currentId, {
                        role: 'user', text, files: filesJson
                    })
                    // Replace temp ID with real server ID
                    const realId = result.id
                    const msgs2 = this.messagesMap[this.currentId] || []
                    const found = msgs2.find(m => m.id === newId)
                    if (found) found.id = realId
                    this.messagesMap[this.currentId] = [...msgs2]
                    newId = realId
                } catch (e) {
                    console.warn('[chatStore] addUserMessage server failed:', e.message)
                }
            } else {
                newId = addMessage(this.currentId, 'user', text, null, filesJson)
                const msg = { role: 'user', text, id: newId, files }
                const msgs = this.messagesMap[this.currentId] || []
                msgs.push(msg)
                this.messagesMap[this.currentId] = msgs
            }
            this._saveSession()
            const msgs = this.messagesMap[this.currentId] || []
            return msgs.find(m => m.id === newId) || null
        },

        startStreamReply(convId) {
            const cid = convId || this.currentId
            const tempId = 'stream_' + Date.now()
            this.streamingConvId = cid
            let parentId = null
            const msgs = this.messagesMap[cid] || []
            for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === 'user') {
                    parentId = msgs[i].id
                    break
                }
            }
            msgs.push({
                role: 'ai', text: '', reasoning: '', id: tempId,
                streaming: true, parent_id: parentId,
            })
            this.messagesMap[cid] = msgs
            this.streamingId = tempId
            return tempId
        },

        _findStreamMsg(tempId) {
            for (const convId of Object.keys(this.messagesMap)) {
                const msgs = this.messagesMap[convId]
                const found = msgs.find(m => m.id === tempId)
                if (found) return { msg: found, msgs, convId }
            }
            return null
        },

        appendStreamText(tempId, fullText) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.text = fullText
        },

        appendStreamReasoning(tempId, text) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.reasoning = text
        },

        appendStreamDesignProgress(tempId, pct) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.designProgress = pct
        },

        updateStreamDesign(tempId, designs) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.designs = [...designs]
        },

        updateStreamRawText(tempId, raw) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg._rawText = raw
        },

        updateStreamCleanText(tempId, cleanText) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.text = cleanText
        },

        updateStreamAgentEvents(tempId, events) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg._agentEvents = [...events]
        },

        async finishStreamReply(tempId) {
            const r = this._findStreamMsg(tempId)
            if (!r) {
                this.streamingId = null
                this.streamingConvId = null
                return null
            }
            const { msg, msgs, convId } = r
            const designsJson = JSON.stringify(msg.designs || [])
            const reasoning = msg.reasoning || ''

            let realId
            if (this._useServerApi()) {
                try {
                    const result = await convApi.addMessage(convId, {
                        role: 'ai', text: msg.text, parent_id: msg.parent_id,
                        files: '[]', designs: designsJson, reasoning
                    })
                    realId = result.id
                } catch (e) {
                    console.warn('[chatStore] finishStreamReply server failed:', e.message)
                    realId = 'failed_' + Date.now()
                }
            } else {
                realId = addMessage(convId, 'ai', msg.text, msg.parent_id, '[]', designsJson, reasoning)
            }

            const idx = msgs.findIndex(m => m.id === tempId)
            const finalMsg = {
                role: 'ai', text: msg.text, reasoning,
                id: realId, parent_id: msg.parent_id,
                designs: msg.designs || [],
                _rawText: msg._rawText || '',
                _agentEvents: msg._agentEvents || [],
            }
            if (idx !== -1) {
                msgs[idx] = finalMsg
            }
            this.messagesMap[convId] = [...msgs]
            if (msg.parent_id != null) {
                const bs = this.branchStateMap[convId] || {}
                bs[msg.parent_id] = realId
                this.branchStateMap[convId] = { ...bs }
            }
            this.streamingId = null
            this.streamingConvId = null
            this._lastFinishedId = realId
            this._lastFinishedMsg = finalMsg
            this._saveSession()
            return realId
        },

        // ─── branch navigation ───
        siblingInfo(parentId, msgId) {
            if (parentId == null) return { count: 1, index: 1 }
            const msgs = this.messagesMap[this.currentId] || []
            const siblings = msgs
                .filter(m => m.role === 'ai' && m.parent_id === parentId && !m.streaming)
                .sort((a, b) => a.id - b.id)
            if (siblings.length <= 1) return { count: 1, index: 1 }
            const idx = siblings.findIndex(s => s.id === msgId)
            return { count: siblings.length, index: idx >= 0 ? idx + 1 : 1 }
        },

        switchBranch(parentId, direction) {
            if (parentId == null) return
            const msgs = this.messagesMap[this.currentId] || []
            const siblings = msgs
                .filter(m => m.role === 'ai' && m.parent_id === parentId)
                .sort((a, b) => a.id - b.id)
            if (siblings.length <= 1) return
            const bs = this.branchStateMap[this.currentId] || {}
            const current = bs[parentId]
            const idx = siblings.findIndex(s => s.id === current)
            const newIdx = direction === 'next'
                ? (idx + 1) % siblings.length
                : (idx - 1 + siblings.length) % siblings.length
            bs[parentId] = siblings[newIdx].id
            this.branchStateMap[this.currentId] = { ...bs }
            this._saveSession()
        },

        // ─── message operations ───
        appendToMessage(id, text) {
            const msgs = this.messagesMap[this.currentId] || []
            const msg = msgs.find(m => m.id === id)
            if (msg) msg.text += text
        },

        updateMessageText(id, text) {
            const msgs = this.messagesMap[this.currentId] || []
            const msg = msgs.find(m => m.id === id)
            if (msg) msg.text = text
        },

        editMessage(id, text) {
            if (this._useServerApi()) {
                convApi.updateMessage(this.currentId, id, text).catch(() => {})
            } else {
                updateMessage(id, text)
            }
            const msgs = this.messagesMap[this.currentId] || []
            const msg = msgs.find(m => m.id === id)
            if (msg) msg.text = text
        },

        removeMessage(id) {
            if (this._useServerApi()) {
                convApi.deleteMessage(this.currentId, id).catch(() => {})
            } else {
                deleteMessage(id)
            }
            const msgs = this.messagesMap[this.currentId] || []
            this.messagesMap[this.currentId] = msgs.filter(m => m.id !== id)
            const bs = { ...(this.branchStateMap[this.currentId] || {}) }
            let changed = false
            for (const [pid, mid] of Object.entries(bs)) {
                if (mid === id) { delete bs[pid]; changed = true }
            }
            if (changed) this.branchStateMap[this.currentId] = bs
            this._saveSession()
        },

        truncateAfter(messageId) {
            if (!this.currentId) return
            if (this._useServerApi()) {
                convApi.truncate(this.currentId, messageId).catch(() => {})
            } else {
                deleteMessagesSince(this.currentId, messageId)
            }
            const msgs = this.messagesMap[this.currentId] || []
            const idx = msgs.findIndex(m => m.id === messageId)
            if (idx !== -1) {
                this.messagesMap[this.currentId] = msgs.slice(0, idx + 1)
            }
        },

        // ─── loading (per-conversation) ───
        setLoading(val, convId) {
            const cid = convId || this.currentId
            this.loadingMap = { ...this.loadingMap, [cid]: val }
        },
        isLoadingFor(convId) {
            return !!this.loadingMap[convId || this.currentId]
        },

        // ─── API key & model ───
        setApiKey(key) {
            this.apikey = key
            localStorage.setItem('apikey', key)
        },

        loadApiKey() {
            const savedKey = localStorage.getItem('apikey')
            this.apikey = savedKey || ''
            const savedModel = localStorage.getItem('model')
            if (savedModel) this.model = savedModel
            const savedMode = localStorage.getItem('permissionMode')
            if (savedMode) this.permissionMode = savedMode
        },

        setModel(model) {
            this.model = model
            localStorage.setItem('model', model)
        },

        setPermissionMode(mode) {
            this.permissionMode = mode
            localStorage.setItem('permissionMode', mode)
        },

        // ─── abort controller (per-conversation) ───
        setAbortController(ctrl, convId) {
            const cid = convId || this.currentId
            _abortMap[cid] = ctrl
        },

        abort(convId) {
            const cid = convId || this.currentId
            const ctrl = _abortMap[cid]
            if (ctrl) {
                ctrl.abort()
                delete _abortMap[cid]
            }
        },
    }
})
