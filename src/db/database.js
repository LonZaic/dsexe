import initSqlJs from 'sql.js'

const DB_KEY = '__sqlite_db__'
let db = window[DB_KEY] || null
const DB_NAME = 'ds_sqlite_db'
const DB_STORE = 'db_data'

if (import.meta.hot) { import.meta.hot.accept(() => {}) }

// Simple IndexedDB wrapper — unlimited storage, no quota issues
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(DB_STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  const idb = await idbOpen()
  return new Promise((resolve) => {
    const tx = idb.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

async function idbSet(key, value) {
  const idb = await idbOpen()
  return new Promise((resolve) => {
    const tx = idb.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => { console.warn('[DB] IndexedDB write failed, storage may be full'); resolve() }
  })
}

export async function initDB() {
    const SQL = await initSqlJs({ locateFile: file => '/sql-wasm.wasm' })

    // Try IndexedDB first, then localStorage backup, then legacy key
    let saved = await idbGet('db')
    if (!saved || !saved.length) {
        // Try new localStorage backup (base64)
        const backup = localStorage.getItem('sqlite_db_backup')
        if (backup) {
            try {
                const binary = atob(backup)
                const bytes = new Uint8Array(binary.length)
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
                saved = Array.from(bytes)
                console.log('[DB] Restored from localStorage backup')
            } catch { /* fall through */ }
        }
    }
    if (!saved || !saved.length) {
        // Try legacy key
        const ls = localStorage.getItem('sqlite_db')
        if (ls) {
            try { saved = JSON.parse(ls); localStorage.removeItem('sqlite_db') } catch {}
        }
    }

    if (saved && saved.length > 0) {
        try {
            db = new SQL.Database(new Uint8Array(saved))
            db.exec('SELECT 1 FROM conversations LIMIT 1')
            console.log('[DB] Loaded', saved.length, 'bytes')
        } catch {
            console.warn('[DB] Corrupted, starting fresh')
            db = new SQL.Database()
        }
    } else {
        console.log('[DB] Fresh database')
        db = new SQL.Database()
    }

    window[DB_KEY] = db

    // Safe migration: add download_files to existing messages table
    try { db.run('ALTER TABLE messages ADD COLUMN download_files TEXT DEFAULT \'[]\'') } catch {}
    try { db.run('ALTER TABLE agent_messages ADD COLUMN download_files TEXT DEFAULT \'[]\'') } catch {}

    db.run(`
        CREATE TABLE IF NOT EXISTS
        conversations (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT '新对话',
            model TEXT DEFAULT 'deepseek-chat',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS
        messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            conv_id     TEXT NOT NULL,
            role        TEXT NOT NULL CHECK(role IN ('user','ai')),
            text        TEXT NOT NULL,
            parent_id   INTEGER,
            files       TEXT DEFAULT '[]',
            designs     TEXT DEFAULT '[]',
            reasoning      TEXT DEFAULT '',
            download_files TEXT DEFAULT '[]',
            created_at     TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (conv_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS
        agent_conversations (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'Agent 对话',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS
        agent_messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            conv_id     TEXT NOT NULL,
            role        TEXT NOT NULL,
            text        TEXT DEFAULT '',
            events      TEXT DEFAULT '[]',
            created_at  TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (conv_id) REFERENCES agent_conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS
        code_conversations (
            id TEXT PRIMARY KEY,
            title TEXT DEFAULT 'Code 对话',
            project_path TEXT DEFAULT '',
            project_name TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS
        code_messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            conv_id     TEXT NOT NULL,
            role        TEXT NOT NULL,
            text        TEXT DEFAULT '',
            html        TEXT DEFAULT '',
            thinking    TEXT DEFAULT '',
            tasks_json  TEXT DEFAULT '[]',
            created_at  TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (conv_id) REFERENCES code_conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS
        collections (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now','localtime'))
        );

        CREATE TABLE IF NOT EXISTS
        saved_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id TEXT,
            msg_json    TEXT NOT NULL,
            preview     TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL
        );
    `)

    // migration: add columns if they don't exist on older DBs
    const cols = db.exec("PRAGMA table_info('messages')")
    const colNames = cols.length ? cols[0].values.map(r => r[1]) : []
    const addCol = (name, def) => {
        if (!colNames.includes(name)) {
            try { db.run(`ALTER TABLE messages ADD COLUMN ${name} ${def}`) } catch(e) { console.warn('[DB] add column failed:', name, e.message) }
        }
    }
    addCol('parent_id', 'INTEGER')
    addCol('files', "TEXT DEFAULT '[]'")
    addCol('designs', "TEXT DEFAULT '[]'")
    addCol('reasoning', "TEXT DEFAULT ''")

    // migration: code_messages new columns
    const cmCols = db.exec("PRAGMA table_info('code_messages')")
    const cmColNames = cmCols.length ? cmCols[0].values.map(r => r[1]) : []
    const addCmCol = (name, def) => {
        if (!cmColNames.includes(name)) {
            try { db.run(`ALTER TABLE code_messages ADD COLUMN ${name} ${def}`) } catch(e) { console.warn('[DB] add cm column failed:', name, e.message) }
        }
    }
    addCmCol('events_json', "TEXT DEFAULT '[]'")
    addCmCol('done', "INTEGER DEFAULT 0")
    addCmCol('error', "INTEGER DEFAULT 0")
    addCmCol('timer', "TEXT DEFAULT ''")

    saveDB()
}

let _saveTimer = null
let _saveResolve = null

function saveDB() {
    if (!db) return
    // Debounce: collapse rapid writes into one save every 300ms
    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(async () => {
        _saveTimer = null
        try {
            await _doSave()
            if (_saveResolve) { _saveResolve(); _saveResolve = null }
        } catch(e) {
            if (_saveResolve) { _saveResolve(); _saveResolve = null }
        }
    }, 300)
}

async function _doSave() {
    if (!db) return
    try {
        const data = Array.from(db.export())
        // Dual persistence: IndexedDB + localStorage backup
        await idbSet('db', data).catch(() => {})
        try {
            // Save as base64 to localStorage as fallback
            const bytes = new Uint8Array(data)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i])
            }
            localStorage.setItem('sqlite_db_backup', btoa(binary))
        } catch (lsErr) {
            // localStorage full or not available — IndexedDB only
        }
    } catch(e) {
        console.error('[DB] export failed:', e.message)
    }
}

// Force an immediate synchronous save — called on beforeunload
function flushSaveSync() {
    if (_saveTimer) {
        clearTimeout(_saveTimer)
        _saveTimer = null
    }
    if (!db) return
    try {
        const data = Array.from(db.export())
        const bytes = new Uint8Array(data)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        localStorage.setItem('sqlite_db_backup', btoa(binary))
    } catch(e) {
        console.error('[DB] flushSaveSync failed:', e.message)
    }
}

// Register beforeunload to force-save DB and session before page close/refresh
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        flushSaveSync()
    })
}

export function createConversation(id, model = 'deepseek-chat'){
    db.run('INSERT INTO conversations (id, model) VALUES (?, ?)', [id, model])
    db.run(`INSERT INTO messages (conv_id, role, text) VALUES (?, 'ai', ?)`, [id, '你好'])
    saveDB()
}

export function getMessages(convId){
    const stmt = db.prepare(`SELECT * FROM messages WHERE conv_id = ? ORDER BY id ASC`)
    stmt.bind(convId)
    const rows = []
    while(stmt.step()){
        rows.push(stmt.getAsObject())
    }
    stmt.free()
    return rows
}

export function addMessage(convId, role, text, parentId = null, files = '[]', designs = '[]', reasoning = '', downloadFiles = '[]'){
    // Ensure download_files column exists (migration for older DBs)
    try { db.run(`ALTER TABLE messages ADD COLUMN download_files TEXT DEFAULT '[]'`) } catch {}
    if (parentId != null) {
        db.run(`INSERT INTO messages (conv_id, role, text, parent_id, files, designs, reasoning, download_files) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [convId, role, text, parentId, files, designs, reasoning, downloadFiles])
    } else {
        db.run(`INSERT INTO messages (conv_id, role, text, files, designs, reasoning, download_files) VALUES (?, ?, ?, ?, ?, ?, ?)`, [convId, role, text, files, designs, reasoning, downloadFiles])
    }
    saveDB()
    const result = db.exec("SELECT last_insert_rowid()")
    return Number(result[0].values[0][0])
}

export function getConversations(){
    const stmt = db.prepare(`SELECT * FROM conversations ORDER BY created_at DESC`)
    stmt.bind()
    const rows = []
    while(stmt.step()){
        rows.push(stmt.getAsObject())
    }
    stmt.free()
    return rows
}

export function deleteConversation(id){
    db.run(`DELETE FROM messages WHERE conv_id = ?`, [id])
    db.run(`DELETE FROM conversations WHERE id = ?`, [id])
    saveDB()
}

export function exportDB(){
    const data = db.export()
    const blob = new Blob([data], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = DB_NAME
    a.click()
    URL.revokeObjectURL(url)
}

export function updateConversationTitle(id, title) {
    db.run('UPDATE conversations SET title = ? WHERE id = ?', [title, id])
    saveDB()
}

export function updateMessage(id, text) {
    db.run('UPDATE messages SET text = ? WHERE id = ?', [text, id])
    saveDB()
}

export function deleteMessage(id) {
    db.run('DELETE FROM messages WHERE id = ?', [id])
    saveDB()
}

export function deleteMessagesSince(convId, sinceId) {
    db.run('DELETE FROM messages WHERE conv_id = ? AND id > ?', [convId, sinceId])
    saveDB()
}

// ══════════════════════════════════════
// Agent Conversations
// ══════════════════════════════════════

export function createAgentConversation(id, title) {
  db.run('INSERT INTO agent_conversations (id, title) VALUES (?, ?)', [id, title || 'Agent 对话'])
  saveDB()
}

export function getAgentConversations() {
  const stmt = db.prepare('SELECT * FROM agent_conversations ORDER BY created_at DESC')
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function getAgentMessages(convId) {
  const stmt = db.prepare('SELECT * FROM agent_messages WHERE conv_id = ? ORDER BY id ASC')
  stmt.bind([convId])
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function addAgentMessage(convId, role, text, events) {
  db.run('INSERT INTO agent_messages (conv_id, role, text, events) VALUES (?, ?, ?, ?)',
    [convId, role, text || '', events || '[]'])
  saveDB()
}

export function updateAgentMessage(id, text, events) {
  db.run('UPDATE agent_messages SET text = ?, events = ? WHERE id = ?',
    [text || '', events || '[]', id])
  saveDB()
}

export function updateAgentConversationTitle(id, title) {
  db.run('UPDATE agent_conversations SET title = ? WHERE id = ?', [title, id])
  saveDB()
}

export function deleteAgentConversation(id) {
  db.run('DELETE FROM agent_messages WHERE conv_id = ?', [id])
  db.run('DELETE FROM agent_conversations WHERE id = ?', [id])
  saveDB()
}

// ══════════════════════════════════════
// Code Conversations
// ══════════════════════════════════════

export function createCodeConversation(id, title, projectPath, projectName) {
  db.run('INSERT INTO code_conversations (id, title, project_path, project_name) VALUES (?, ?, ?, ?)',
    [id, title || 'Code 对话', projectPath || '', projectName || ''])
  saveDB()
}

export function getCodeConversations() {
  const stmt = db.prepare('SELECT * FROM code_conversations ORDER BY created_at DESC')
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function getCodeMessages(convId) {
  const stmt = db.prepare('SELECT * FROM code_messages WHERE conv_id = ? ORDER BY id ASC')
  stmt.bind([convId])
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function addCodeMessage(convId, role, text, html, thinking, tasksJson, eventsJson, done, error, timer) {
  db.run('INSERT INTO code_messages (conv_id, role, text, html, thinking, tasks_json, events_json, done, error, timer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [convId, role, text || '', html || '', thinking || '', tasksJson || '[]', eventsJson || '[]', done ? 1 : 0, error ? 1 : 0, timer || ''])
  saveDB()
  const r = db.exec("SELECT last_insert_rowid()")
  return Number(r[0].values[0][0])
}

export function updateCodeMessage(id, text, html, thinking, tasksJson, eventsJson, done, error, timer) {
  db.run('UPDATE code_messages SET text = ?, html = ?, thinking = ?, tasks_json = ?, events_json = ?, done = ?, error = ?, timer = ? WHERE id = ?',
    [text || '', html || '', thinking || '', tasksJson || '[]', eventsJson || '[]', done ? 1 : 0, error ? 1 : 0, timer || '', id])
  saveDB()
}

export function updateCodeConversationTitle(id, title) {
  db.run('UPDATE code_conversations SET title = ? WHERE id = ?', [title, id])
  saveDB()
}

export function updateCodeConversationProject(id, projectPath, projectName) {
  db.run('UPDATE code_conversations SET project_path = ?, project_name = ? WHERE id = ?',
    [projectPath || '', projectName || '', id])
  saveDB()
}

export function deleteCodeConversation(id) {
  db.run('DELETE FROM code_messages WHERE conv_id = ?', [id])
  db.run('DELETE FROM code_conversations WHERE id = ?', [id])
  saveDB()
}

// ═══ Collections (Favorites) ═══

export function getCollections() {
  const stmt = db.prepare('SELECT * FROM collections ORDER BY created_at ASC')
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function createCollection(name) {
  const id = 'col_' + Date.now()
  db.run('INSERT INTO collections (id, name) VALUES (?, ?)', [id, name])
  saveDB()
  return id
}

export function deleteCollection(id) {
  db.run('UPDATE saved_items SET collection_id = NULL WHERE collection_id = ?', [id])
  db.run('DELETE FROM collections WHERE id = ?', [id])
  saveDB()
}

export function renameCollection(id, name) {
  db.run('UPDATE collections SET name = ? WHERE id = ?', [name, id])
  saveDB()
}

export function getSavedItems(collectionId) {
  const sql = collectionId
    ? 'SELECT * FROM saved_items WHERE collection_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM saved_items WHERE collection_id IS NULL ORDER BY created_at DESC'
  const stmt = db.prepare(sql)
  if (collectionId) stmt.bind([collectionId])
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function getAllSavedItems() {
  const stmt = db.prepare('SELECT * FROM saved_items ORDER BY created_at DESC')
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function searchSavedItems(query) {
  const stmt = db.prepare("SELECT * FROM saved_items WHERE preview LIKE ? OR msg_json LIKE ? ORDER BY created_at DESC")
  const like = `%${query}%`
  stmt.bind([like, like])
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function saveItem(collectionId, msgJson, preview) {
  db.run('INSERT INTO saved_items (collection_id, msg_json, preview) VALUES (?, ?, ?)',
    [collectionId || null, msgJson, preview || ''])
  saveDB()
  const r = db.exec("SELECT last_insert_rowid()")
  return r[0]?.values[0]?.[0] ?? null
}

export function deleteSavedItem(id) {
  db.run('DELETE FROM saved_items WHERE id = ?', [id])
  saveDB()
}

export function isItemDuplicate(collectionId, msgJson) {
  const sql = collectionId
    ? 'SELECT COUNT(*) as cnt FROM saved_items WHERE collection_id = ? AND msg_json = ?'
    : 'SELECT COUNT(*) as cnt FROM saved_items WHERE collection_id IS NULL AND msg_json = ?'
  const stmt = db.prepare(sql)
  if (collectionId) stmt.bind([collectionId, msgJson])
  else stmt.bind([msgJson])
  let count = 0
  if (stmt.step()) count = stmt.getAsObject().cnt
  stmt.free()
  return count > 0
}

export function moveSavedItem(itemId, newCollectionId) {
  db.run('UPDATE saved_items SET collection_id = ? WHERE id = ?',
    [newCollectionId || null, itemId])
  saveDB()
}

export function findCollectionByName(name) {
  const stmt = db.prepare('SELECT * FROM collections WHERE LOWER(name) = LOWER(?)')
  stmt.bind([name.trim()])
  let result = null
  if (stmt.step()) result = stmt.getAsObject()
  stmt.free()
  return result || null
}

export function updateSavedItemContent(id, msgJson, preview) {
  db.run('UPDATE saved_items SET msg_json = ?, preview = ? WHERE id = ?',
    [msgJson, preview || '', id])
  saveDB()
}

export function getSavedItemById(id) {
  const stmt = db.prepare('SELECT * FROM saved_items WHERE id = ?')
  stmt.bind([id])
  let result = null
  if (stmt.step()) result = stmt.getAsObject()
  stmt.free()
  return result || null
}
