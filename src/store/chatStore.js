import { defineStore } from 'pinia'
import {
    createConversation as dbCreateConv,
    getMessages, addMessage, getConversations,
    deleteConversation, updateConversationTitle,
    updateMessage, deleteMessage, deleteMessagesSince
} from '../db/database.js'

let _abortController = null

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
        isLoading: false,
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
        // ─── conversation ───
        createConversation(id) {
            if (!this.apikey) this.loadApiKey()
            dbCreateConv(id, this.model)
            this.currentId = id
            this.messagesMap[id] = getMessages(id).map(m => this._hydrateMsg(m))
            this.branchStateMap[id] = this._initBranch(this.messagesMap[id])
            this.conversations = getConversations()
            // add to open tabs if not already there
            if (!this.openTabs.includes(id)) {
                this.openTabs.push(id)
            }
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

        loadMessages(id) {
            this.messagesMap[id] = getMessages(id).map(m => this._hydrateMsg(m))
            this.branchStateMap[id] = this._initBranch(this.messagesMap[id])
            this.currentId = id
            // ensure tab is open
            if (!this.openTabs.includes(id)) {
                this.openTabs.push(id)
            }
        },

        loadConversations() {
            this.conversations = getConversations()
        },

        deleteConv(id) {
            deleteConversation(id)
            delete this.messagesMap[id]
            delete this.branchStateMap[id]
            this.openTabs = this.openTabs.filter(t => t !== id)
            this.conversations = getConversations()
        },

        updateConvTitle(id, title) {
            updateConversationTitle(id, title)
            // 1. Directly mutate the conversation object for maximum reactivity
            const conv = this.conversations.find(c => c.id === id)
            if (conv) {
                conv.title = title
            }
            // 2. Also replace the array to force Pinia getters (openTabList) to re-evaluate
            this.conversations = [...this.conversations]
            // 3. Update browser tab title if this is the active conversation
            if (id === this.currentId) {
                document.title = title + ' - Agent Chat'
            }
        },

        // ─── tabs ───
        switchTab(id) {
            if (id === this.currentId) return
            // auto-load if not in cache
            if (!this.messagesMap[id]) {
                this.messagesMap[id] = getMessages(id).map(m => this._hydrateMsg(m))
                this.branchStateMap[id] = this._initBranch(this.messagesMap[id])
            }
            this.currentId = id
            if (!this.openTabs.includes(id)) {
                this.openTabs.push(id)
            }
            // Update browser tab title
            const conv = this.conversations.find(c => c.id === id)
            document.title = (conv?.title || '新对话') + ' - Agent Chat'
        },

        closeTab(id) {
            this.openTabs = this.openTabs.filter(t => t !== id)
            // If closing active tab, switch to the next one
            if (this.currentId === id) {
                const idx = this.openTabs.indexOf(this.currentId)
                // actually it's already filtered out, so find where it was
                const next = this.openTabs.length > 0 ? this.openTabs[Math.min(this.openTabs.length - 1, 0)] : null
                if (next) {
                    this.switchTab(next)
                }
            }
            // Don't delete from messagesMap — keep cache for when user reopens
        },

        // ─── messages ───
        addUserMessage(text, files = []) {
            if (!this.currentId) return null
            const filesJson = JSON.stringify(files)
            const newId = addMessage(this.currentId, 'user', text, null, filesJson)
            const msg = { role: 'user', text, id: newId, files }
            const msgs = this.messagesMap[this.currentId] || []
            msgs.push(msg)
            this.messagesMap[this.currentId] = msgs
            return msg
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
            // Search all conversation caches for the streaming message
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

        finishStreamReply(tempId) {
            const r = this._findStreamMsg(tempId)
            if (!r) {
                this.streamingId = null
                this.streamingConvId = null
                return null
            }
            const { msg, msgs, convId } = r
            const designsJson = JSON.stringify(msg.designs || [])
            const reasoning = msg.reasoning || ''
            const realId = addMessage(convId, 'ai', msg.text, msg.parent_id, '[]', designsJson, reasoning)
            const idx = msgs.findIndex(m => m.id === tempId)
            if (idx !== -1) {
                msgs[idx] = {
                    role: 'ai', text: msg.text, reasoning,
                    id: realId, parent_id: msg.parent_id,
                    designs: msg.designs || [],
                }
            }
            this.messagesMap[convId] = [...msgs]
            if (msg.parent_id != null) {
                const bs = this.branchStateMap[convId] || {}
                bs[msg.parent_id] = realId
                this.branchStateMap[convId] = { ...bs }
            }
            this.streamingId = null
            this.streamingConvId = null
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
            updateMessage(id, text)
            const msgs = this.messagesMap[this.currentId] || []
            const msg = msgs.find(m => m.id === id)
            if (msg) msg.text = text
        },

        removeMessage(id) {
            deleteMessage(id)
            const msgs = this.messagesMap[this.currentId] || []
            this.messagesMap[this.currentId] = msgs.filter(m => m.id !== id)
            const bs = { ...(this.branchStateMap[this.currentId] || {}) }
            let changed = false
            for (const [pid, mid] of Object.entries(bs)) {
                if (mid === id) { delete bs[pid]; changed = true }
            }
            if (changed) this.branchStateMap[this.currentId] = bs
        },

        truncateAfter(messageId) {
            if (!this.currentId) return
            deleteMessagesSince(this.currentId, messageId)
            const msgs = this.messagesMap[this.currentId] || []
            const idx = msgs.findIndex(m => m.id === messageId)
            if (idx !== -1) {
                this.messagesMap[this.currentId] = msgs.slice(0, idx + 1)
            }
        },

        // ─── loading ───
        setLoading(val) {
            this.isLoading = val
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

        // ─── abort controller ───
        setAbortController(ctrl) {
            _abortController = ctrl
        },

        abort() {
            if (_abortController) {
                _abortController.abort()
                _abortController = null
            }
        },
    }
})
