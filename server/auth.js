const { user } = require('./db')

// Simple token auth middleware
function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: '请先登录' })
  }
  const u = user.findByToken(token)
  if (!u) {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
  req.user = { id: u.id, name: u.name }
  req.token = token
  next()
}

// Optional auth - attaches user if token present, but doesn't block
function authOptional(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    const u = user.findByToken(token)
    if (u) {
      req.user = { id: u.id, name: u.name }
      req.token = token
    }
  }
  next()
}

module.exports = { authRequired, authOptional }
