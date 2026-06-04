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
            reasoning   TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (conv_id) REFERENCES conversations(id) ON DELETE CASCADE
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

export function addMessage(convId, role, text, parentId = null, files = '[]', designs = '[]', reasoning = ''){
    if (parentId != null) {
        db.run(`INSERT INTO messages (conv_id, role, text, parent_id, files, designs, reasoning) VALUES (?, ?, ?, ?, ?, ?, ?)`, [convId, role, text, parentId, files, designs, reasoning])
    } else {
        db.run(`INSERT INTO messages (conv_id, role, text, files, designs, reasoning) VALUES (?, ?, ?, ?, ?, ?)`, [convId, role, text, files, designs, reasoning])
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
