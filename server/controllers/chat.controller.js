// ══════════════════════════════════════
// Chat Controller — Users, Friends, DMs, Groups
// ══════════════════════════════════════

const { v4: uuid } = require('uuid')
const { user, friend, dm, room, conv } = require('../db')
const { sendSuccess, sendError } = require('../middleware/errorHandler')

// ─── Users ───

function searchUsers(req, res) {
  const { q } = req.query
  if (!q) return sendSuccess(res, [])
  const results = user.searchByName(q, req.user.id)
  sendSuccess(res, results)
}

function onlineUsers(req, res) {
  const all = user.listAll()
  sendSuccess(res, all)
}

// ─── Friends ───

function getFriends(req, res) {
  const list = friend.getList(req.user.id)
  const pending = friend.getPending(req.user.id)
  sendSuccess(res, { list, pending })
}

function addFriend(req, res) {
  const { friendName } = req.body
  if (!friendName) return sendError(res, '请输入好友昵称')

  const target = user.findByName(friendName)
  if (!target) return sendError(res, '未找到该用户', 'NOT_FOUND', 404)
  if (target.id === req.user.id) return sendError(res, '不能添加自己为好友')

  if (friend.areFriends(req.user.id, target.id)) {
    return sendError(res, '已经是好友了', 'ALREADY_FRIENDS', 400)
  }
  if (friend.hasPending(req.user.id, target.id)) {
    return sendError(res, '已发送过好友申请，等待对方同意', 'ALREADY_PENDING', 400)
  }
  // Check if the target has already sent a request to us → auto-accept
  if (friend.hasPending(target.id, req.user.id)) {
    friend.accept(req.user.id, target.id)
    return sendSuccess(res, { ok: true, autoAccepted: true })
  }

  friend.add(req.user.id, target.id)
  sendSuccess(res, { ok: true, pending: true })
}

function acceptFriend(req, res) {
  const { friendId } = req.body
  friend.accept(req.user.id, friendId)
  sendSuccess(res, { ok: true })
}

function rejectFriend(req, res) {
  const { friendId } = req.body
  friend.reject(req.user.id, friendId)
  sendSuccess(res, { ok: true })
}

function removeFriend(req, res) {
  friend.remove(req.user.id, req.params.friendId)
  sendSuccess(res, { ok: true })
}

// ─── DMs ───

function getDmMessages(req, res) {
  if (!friend.areFriends(req.user.id, req.params.friendId)) {
    return sendError(res, '还不是好友，无法查看消息', 'NOT_FRIENDS', 403)
  }
  const { before } = req.query
  const msgs = dm.getHistory(req.user.id, req.params.friendId, 50, before ? parseInt(before) : null)
  sendSuccess(res, msgs)
}

function sendDmMessage(req, res) {
  if (!friend.areFriends(req.user.id, req.params.friendId)) {
    return sendError(res, '还不是好友，无法发送消息', 'NOT_FRIENDS', 403)
  }
  const { text, aiReply } = req.body
  const result = dm.send(req.user.id, req.params.friendId, text, aiReply || null)
  sendSuccess(res, { id: result.lastInsertRowid, ok: true })
}

// ─── Groups ───

function getUserGroups(req, res) {
  const list = room.listForUser(req.user.id)
  sendSuccess(res, list)
}

function getAllGroups(req, res) {
  const list = room.listAll()
  sendSuccess(res, list)
}

function createGroup(req, res) {
  const { name } = req.body
  if (!name || !name.trim()) return sendError(res, '群名不能为空')
  const id = 'room_' + uuid().slice(0, 8)
  const inviteCode = 'ROOM' + Math.random().toString(36).slice(2, 6).toUpperCase()
  room.create(id, name.trim(), req.user.id, inviteCode)
  sendSuccess(res, { id, name: name.trim(), invite_code: inviteCode })
}

function joinGroup(req, res) {
  const { code } = req.body
  if (!code) return sendError(res, '请输入邀请码')
  const r = room.findByInvite(code.toUpperCase())
  if (!r) return sendError(res, '邀请码无效', 'NOT_FOUND', 404)
  if (room.isMember(r.id, req.user.id)) return sendError(res, '你已经在群里了', 'ALREADY_MEMBER', 400)
  room.join(r.id, req.user.id)
  sendSuccess(res, { id: r.id, name: r.name })
}

function getGroupDetail(req, res) {
  const r = room.findById(req.params.id)
  if (!r) return sendError(res, '群不存在', 'NOT_FOUND', 404)
  if (!room.isMember(r.id, req.user.id)) return sendError(res, '你不在这个群里', 'FORBIDDEN', 403)
  const members = room.getMembers(r.id)
  sendSuccess(res, { ...r, members })
}

function getGroupMessages(req, res) {
  const r = room.findById(req.params.id)
  if (!r || !room.isMember(r.id, req.user.id)) return sendError(res, '无权访问', 'FORBIDDEN', 403)
  const { before } = req.query
  const msgs = room.getMessages(req.params.id, 50, before ? parseInt(before) : null)
  sendSuccess(res, msgs)
}

function leaveGroup(req, res) {
  room.leave(req.params.id, req.user.id)
  sendSuccess(res, { ok: true })
}

// ═══ AI Chat Conversations & Messages ═══

function listConversations(req, res) {
  const convs = conv.listForUser(req.user.id)
  sendSuccess(res, convs)
}

function getConversation(req, res) {
  const c = conv.findById(req.params.id, req.user.id)
  if (!c) return sendError(res, '对话不存在', 'NOT_FOUND', 404)
  const msgs = conv.getMessages(req.params.id, req.user.id)
  sendSuccess(res, { conversation: c, messages: msgs })
}

function createConversation(req, res) {
  const { id, model } = req.body
  if (!id) return sendError(res, '缺少对话 ID', 'BAD_REQUEST', 400)
  try {
    conv.create(id, req.user.id, model || 'deepseek-v4-flash')
    sendSuccess(res, { id }, 201)
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint')) {
      return sendError(res, '对话已存在', 'CONFLICT', 409)
    }
    throw e
  }
}

function updateConversation(req, res) {
  const c = conv.findById(req.params.id, req.user.id)
  if (!c) return sendError(res, '对话不存在', 'NOT_FOUND', 404)
  const { title } = req.body
  if (!title) return sendError(res, '缺少标题', 'BAD_REQUEST', 400)
  conv.updateTitle(req.params.id, req.user.id, title)
  sendSuccess(res, { ok: true })
}

function deleteConversation(req, res) {
  const c = conv.findById(req.params.id, req.user.id)
  if (!c) return sendError(res, '对话不存在', 'NOT_FOUND', 404)
  conv.delete(req.params.id, req.user.id)
  sendSuccess(res, { ok: true })
}

function listMessages(req, res) {
  const c = conv.findById(req.params.id, req.user.id)
  if (!c) return sendError(res, '对话不存在', 'NOT_FOUND', 404)
  const msgs = conv.getMessages(req.params.id, req.user.id)
  sendSuccess(res, msgs)
}

function addMessage(req, res) {
  const c = conv.findById(req.params.id, req.user.id)
  if (!c) return sendError(res, '对话不存在', 'NOT_FOUND', 404)
  const { role, text, parent_id, files, designs, reasoning, downloadFiles } = req.body
  if (!role || !text) return sendError(res, '缺少 role 或 text', 'BAD_REQUEST', 400)
  const msgId = conv.addMessage(req.params.id, req.user.id, role, text, parent_id || null, files || '[]', designs || '[]', reasoning || '', downloadFiles || '[]')
  sendSuccess(res, { id: msgId }, 201)
}

function updateMessage(req, res) {
  const { text } = req.body
  if (!text) return sendError(res, '缺少文本', 'BAD_REQUEST', 400)
  conv.updateMessage(req.params.msgId, req.user.id, text)
  sendSuccess(res, { ok: true })
}

function deleteMessage(req, res) {
  conv.deleteMessage(req.params.msgId, req.user.id)
  sendSuccess(res, { ok: true })
}

function truncateMessages(req, res) {
  const c = conv.findById(req.params.id, req.user.id)
  if (!c) return sendError(res, '对话不存在', 'NOT_FOUND', 404)
  const { sinceId } = req.body
  if (sinceId == null) return sendError(res, '缺少 sinceId', 'BAD_REQUEST', 400)
  conv.deleteMessagesSince(req.params.id, req.user.id, sinceId)
  sendSuccess(res, { ok: true })
}

function exportData(req, res) {
  const data = conv.exportAll(req.user.id)
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', 'attachment; filename="deepseek-chat-data.json"')
  res.json(data)
}

function importData(req, res) {
  const { conversations, messages } = req.body
  if (!conversations || !Array.isArray(conversations)) {
    return sendError(res, '无效的导入数据：缺少 conversations 数组', 'BAD_REQUEST', 400)
  }
  const count = conv.bulkImport(req.user.id, conversations, messages || {})
  sendSuccess(res, { imported: count })
}

module.exports = {
  searchUsers, onlineUsers,
  getFriends, addFriend, acceptFriend, rejectFriend, removeFriend,
  getDmMessages, sendDmMessage,
  getUserGroups, getAllGroups, createGroup, joinGroup, getGroupDetail, getGroupMessages, leaveGroup,
  listConversations, getConversation, createConversation, updateConversation, deleteConversation,
  listMessages, addMessage, updateMessage, deleteMessage, truncateMessages,
  exportData, importData,
}
