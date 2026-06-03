// ══════════════════════════════════════
// Chat Controller — Users, Friends, DMs, Groups
// ══════════════════════════════════════

const { v4: uuid } = require('uuid')
const { user, friend, dm, room } = require('../db')
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

module.exports = {
  searchUsers, onlineUsers,
  getFriends, addFriend, acceptFriend, rejectFriend, removeFriend,
  getDmMessages, sendDmMessage,
  getUserGroups, getAllGroups, createGroup, joinGroup, getGroupDetail, getGroupMessages, leaveGroup,
}
