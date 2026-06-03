// ══════════════════════════════════════
// Simple In-Memory Rate Limiter
// ══════════════════════════════════════

const config = require('../config')

const requestCounts = new Map()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of requestCounts) {
    if (now - entry.resetTime > 60000) {
      requestCounts.delete(key)
    }
  }
}, 300000).unref()

function rateLimiter(req, res, next) {
  const maxRequests = config.rateLimitMax
  const windowMs = 60000 // 1 minute

  const key = req.ip || req.connection?.remoteAddress || 'unknown'
  const now = Date.now()

  let entry = requestCounts.get(key)
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs }
    requestCounts.set(key, entry)
  }

  entry.count++

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', maxRequests)
  res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count))
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000))

  if (entry.count > maxRequests) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: '请求过于频繁，请稍后再试',
      },
    })
  }

  next()
}

module.exports = rateLimiter
