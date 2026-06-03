// ══════════════════════════════════════
// Auth Controller
// ══════════════════════════════════════

const { v4: uuid } = require('uuid')
const { user } = require('../db')
const { sendSuccess, sendError } = require('../middleware/errorHandler')

function register(req, res) {
  const { name, password } = req.body
  if (!name || !password) return sendError(res, '昵称和密码不能为空')
  if (name.length > 20) return sendError(res, '昵称最多20个字符')
  if (password.length < 3) return sendError(res, '密码最少3个字符')

  const existing = user.findByName(name)
  if (existing) return sendError(res, '该昵称已被使用', 'CONFLICT', 409)

  const id = 'u_' + uuid().slice(0, 8)
  user.create(id, name, password)
  const token = 'tk_' + uuid()
  user.setToken(id, token)

  sendSuccess(res, { id, name, token })
}

function login(req, res) {
  const { name, password } = req.body
  if (!name || !password) return sendError(res, '昵称和密码不能为空')

  const u = user.findByName(name)
  if (!u || u.password !== password) return sendError(res, '昵称或密码错误', 'UNAUTHORIZED', 401)

  const token = 'tk_' + uuid()
  user.setToken(u.id, token)

  sendSuccess(res, { id: u.id, name: u.name, token })
}

function me(req, res) {
  sendSuccess(res, { id: req.user.id, name: req.user.name })
}

module.exports = { register, login, me }
