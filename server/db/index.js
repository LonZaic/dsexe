const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, 'bbot.db')
const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Schema ───
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    status      TEXT DEFAULT 'offline',
    token       TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS friends (
    user_id     TEXT NOT NULL,
    friend_id   TEXT NOT NULL,
    status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dm_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id   TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    text        TEXT NOT NULL,
    ai_reply     TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    owner_id    TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS room_members (
    room_id     TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    joined_at   TEXT DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS room_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id     TEXT NOT NULL,
    sender_id   TEXT,
    text        TEXT NOT NULL,
    is_ai       INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    task            TEXT NOT NULL,
    result          TEXT,
    rounds          INTEGER DEFAULT 0,
    hooks_fired     INTEGER DEFAULT 0,
    memories_used   INTEGER DEFAULT 0,
    permission_mode TEXT DEFAULT 'default',
    created_at      TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT DEFAULT '新对话',
    model       TEXT DEFAULT 'deepseek-v4-flash',
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    conv_id     TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('user','ai')),
    text        TEXT NOT NULL,
    parent_id   INTEGER,
    files       TEXT DEFAULT '[]',
    designs     TEXT DEFAULT '[]',
    reasoning   TEXT DEFAULT '',
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (conv_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv_id ON messages(conv_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
`)

// ─── User queries ───
const user = {
  create(id, name, password) {
    const stmt = db.prepare('INSERT INTO users (id, name, password) VALUES (?, ?, ?)')
    return stmt.run(id, name, password)
  },
  findByName(name) {
    return db.prepare('SELECT * FROM users WHERE name = ?').get(name)
  },
  findById(id) {
    return db.prepare('SELECT id, name, status, created_at FROM users WHERE id = ?').get(id)
  },
  findByToken(token) {
    return db.prepare('SELECT * FROM users WHERE token = ?').get(token)
  },
  setToken(id, token) {
    db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, id)
  },
  setStatus(id, status) {
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id)
  },
  setAllOffline() {
    db.prepare("UPDATE users SET status = 'offline', token = NULL").run()
  },
  searchByName(name, excludeId) {
    return db.prepare('SELECT id, name, status FROM users WHERE name LIKE ? AND id != ? LIMIT 20').all('%' + name + '%', excludeId)
  },
  listAll() {
    return db.prepare('SELECT id, name, status, created_at FROM users ORDER BY status DESC, name ASC').all()
  }
}

// ─── Friend queries ───
const friend = {
  add(userId, friendId) {
    db.prepare('INSERT OR IGNORE INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)').run(userId, friendId, 'pending')
  },
  accept(userId, friendId) {
    db.prepare("UPDATE friends SET status = 'accepted' WHERE user_id = ? AND friend_id = ?").run(friendId, userId)
    // Also create reverse friendship
    db.prepare("INSERT OR REPLACE INTO friends (user_id, friend_id, status) VALUES (?, ?, 'accepted')").run(userId, friendId)
  },
  reject(userId, friendId) {
    db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_id = ?').run(friendId, userId)
  },
  remove(userId, friendId) {
    db.prepare('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(userId, friendId, friendId, userId)
  },
  getList(userId) {
    return db.prepare(`
      SELECT u.id, u.name, u.status, f.status as friend_status, f.created_at as friend_since
      FROM friends f
      JOIN users u ON (f.friend_id = u.id)
      WHERE f.user_id = ? AND f.status = 'accepted'
      UNION
      SELECT u.id, u.name, u.status, f.status as friend_status, f.created_at as friend_since
      FROM friends f
      JOIN users u ON (f.user_id = u.id)
      WHERE f.friend_id = ? AND f.status = 'accepted'
      ORDER BY u.status DESC, u.name ASC
    `).all(userId, userId)
  },
  getPending(userId) {
    return db.prepare(`
      SELECT u.id, u.name, f.created_at
      FROM friends f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `).all(userId)
  },
  areFriends(a, b) {
    const row = db.prepare(`
      SELECT 1 FROM friends
      WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
      AND status = 'accepted'
    `).get(a, b, b, a)
    return !!row
  },
  hasPending(a, b) {
    const row = db.prepare(`
      SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? AND status = 'pending'
    `).get(a, b)
    return !!row
  }
}

// ─── DM message queries ───
const dm = {
  send(senderId, receiverId, text, aiReply) {
    const stmt = db.prepare('INSERT INTO dm_messages (sender_id, receiver_id, text, ai_reply) VALUES (?, ?, ?, ?)')
    return stmt.run(senderId, receiverId, text, aiReply || null)
  },
  getHistory(a, b, limit = 50, before) {
    let sql = `
      SELECT * FROM dm_messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    `
    const params = [a, b, b, a]
    if (before) {
      sql += ' AND id < ?'
      params.push(before)
    }
    sql += ' ORDER BY id DESC LIMIT ?'
    params.push(limit)
    return db.prepare(sql).all(...params).reverse()
  }
}

// ─── Room queries ───
const room = {
  create(id, name, ownerId, inviteCode) {
    db.prepare('INSERT INTO rooms (id, name, owner_id, invite_code) VALUES (?, ?, ?, ?)').run(id, name, ownerId, inviteCode)
    // Owner auto-joins
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(id, ownerId)
  },
  findByInvite(code) {
    return db.prepare('SELECT * FROM rooms WHERE invite_code = ?').get(code)
  },
  findById(id) {
    return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id)
  },
  getMembers(roomId) {
    return db.prepare(`
      SELECT u.id, u.name, u.status FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = ?
      ORDER BY u.name ASC
    `).all(roomId)
  },
  isMember(roomId, userId) {
    const row = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?').get(roomId, userId)
    return !!row
  },
  join(roomId, userId) {
    db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(roomId, userId)
  },
  leave(roomId, userId) {
    db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(roomId, userId)
  },
  listForUser(userId) {
    return db.prepare(`
      SELECT r.*, (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
      FROM rooms r
      JOIN room_members rm ON r.id = rm.room_id
      WHERE rm.user_id = ?
      ORDER BY r.created_at DESC
    `).all(userId)
  },
  listAll() {
    return db.prepare(`
      SELECT r.*, (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
      FROM rooms r
      ORDER BY r.created_at DESC
      LIMIT 50
    `).all()
  },
  sendMessage(roomId, senderId, text, isAi) {
    const stmt = db.prepare('INSERT INTO room_messages (room_id, sender_id, text, is_ai) VALUES (?, ?, ?, ?)')
    return stmt.run(roomId, senderId, text, isAi ? 1 : 0)
  },
  getMessages(roomId, limit = 50, before) {
    let sql = 'SELECT rm.*, u.name as sender_name FROM room_messages rm LEFT JOIN users u ON rm.sender_id = u.id WHERE rm.room_id = ?'
    const params = [roomId]
    if (before) {
      sql += ' AND rm.id < ?'
      params.push(before)
    }
    sql += ' ORDER BY rm.id DESC LIMIT ?'
    params.push(limit)
    return db.prepare(sql).all(...params).reverse()
  }
}

// ─── Agent run history ───
const agentRuns = {
  record(conversationId, task, result, rounds, hooksFired, memoriesUsed, permissionMode) {
    const stmt = db.prepare(`INSERT INTO agent_runs (conversation_id, task, result, rounds, hooks_fired, memories_used, permission_mode) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    return stmt.run(conversationId || null, task, result || '', rounds || 0, hooksFired || 0, memoriesUsed || 0, permissionMode || 'default')
  },
  getHistory(limit = 20) {
    return db.prepare('SELECT * FROM agent_runs ORDER BY id DESC LIMIT ?').all(limit)
  },
  getByConversation(conversationId, limit = 10) {
    return db.prepare('SELECT * FROM agent_runs WHERE conversation_id = ? ORDER BY id DESC LIMIT ?').all(conversationId, limit)
  },
  delete(id) {
    return db.prepare('DELETE FROM agent_runs WHERE id = ?').run(id)
  }
}

// ─── AI Chat Conversations & Messages ───
const conv = {
  create(id, userId, model) {
    db.prepare('INSERT INTO conversations (id, user_id, model) VALUES (?, ?, ?)').run(id, userId, model || 'deepseek-v4-flash')
  },
  findById(id, userId) {
    return db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(id, userId)
  },
  listForUser(userId) {
    return db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC').all(userId)
  },
  updateTitle(id, userId, title) {
    db.prepare('UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?').run(title, id, userId)
  },
  delete(id, userId) {
    const del = db.prepare('DELETE FROM messages WHERE conv_id = ? AND user_id = ?')
    const delConv = db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
    const tx = db.transaction(() => {
      del.run(id, userId)
      delConv.run(id, userId)
    })
    tx()
  },
  getMessages(convId, userId) {
    return db.prepare('SELECT * FROM messages WHERE conv_id = ? AND user_id = ? ORDER BY id ASC').all(convId, userId)
  },
  addMessage(convId, userId, role, text, parentId, files, designs, reasoning, downloadFiles = '[]') {
    try { db.exec('ALTER TABLE messages ADD COLUMN download_files TEXT DEFAULT \'[]\'') } catch {}
    const stmt = db.prepare('INSERT INTO messages (conv_id, user_id, role, text, parent_id, files, designs, reasoning, download_files) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const result = stmt.run(convId, userId, role, text, parentId || null, files || '[]', designs || '[]', reasoning || '', downloadFiles)
    return result.lastInsertRowid
  },
  updateMessage(id, userId, text) {
    db.prepare('UPDATE messages SET text = ? WHERE id = ? AND user_id = ?').run(text, id, userId)
  },
  deleteMessage(id, userId) {
    db.prepare('DELETE FROM messages WHERE id = ? AND user_id = ?').run(id, userId)
  },
  deleteMessagesSince(convId, userId, sinceId) {
    db.prepare('DELETE FROM messages WHERE conv_id = ? AND user_id = ? AND id > ?').run(convId, userId, sinceId)
  },
  exportAll(userId) {
    const conversations = db.prepare('SELECT id, title, model, created_at FROM conversations WHERE user_id = ? ORDER BY created_at DESC').all(userId)
    const msgs = db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY id ASC').all(userId)
    // Group messages by conv_id
    const messages = {}
    for (const m of msgs) {
      if (!messages[m.conv_id]) messages[m.conv_id] = []
      messages[m.conv_id].push(m)
    }
    return { conversations, messages }
  },
  bulkImport(userId, conversations, messages) {
    const insConv = db.prepare('INSERT OR REPLACE INTO conversations (id, user_id, title, model, created_at) VALUES (?, ?, ?, ?, ?)')
    const insMsg = db.prepare('INSERT OR IGNORE INTO messages (id, conv_id, user_id, role, text, parent_id, files, designs, reasoning, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const tx = db.transaction(() => {
      for (const c of conversations) {
        insConv.run(c.id, userId, c.title || '新对话', c.model || 'deepseek-v4-flash', c.created_at || null)
      }
      for (const [convId, msgs] of Object.entries(messages || {})) {
        for (const m of msgs) {
          insMsg.run(m.id, convId, userId, m.role, m.text, m.parent_id || null, m.files || '[]', m.designs || '[]', m.reasoning || '', m.created_at || null)
        }
      }
    })
    tx()
    return conversations.length
  },
}

module.exports = { db, user, friend, dm, room, agentRuns, conv }
