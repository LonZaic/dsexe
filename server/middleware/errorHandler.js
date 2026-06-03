// ══════════════════════════════════════
// Global Error Handler Middleware
// Catches all unhandled errors and returns unified response format
// ══════════════════════════════════════

const logger = require('../config/logger')

/**
 * Unified error response:
 * { success: false, error: { code: string, message: string, details?: any } }
 */
function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', {
    method: req.method,
    url: req.originalUrl || req.url,
    error: err.message,
    stack: err.stack?.slice(0, 500),
  })

  // Known HTTP errors (e.g. from http-errors package or custom)
  const statusCode = err.statusCode || err.status || 500
  const code = err.code || 'INTERNAL_ERROR'

  // Don't leak stack traces in production
  const response = {
    success: false,
    error: {
      code,
      message: statusCode === 500 ? '服务器内部错误' : err.message,
    },
  }

  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    response.error.details = err.message
  }

  res.status(statusCode).json(response)
}

/**
 * Unified success response helper
 * @param {object} res - Express response
 * @param {any} data - Response data
 * @param {number} statusCode - HTTP status (default 200)
 */
function sendSuccess(res, data, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    data,
  })
}

/**
 * Unified error response helper (for controller use, not middleware)
 * @param {object} res - Express response
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {number} statusCode - HTTP status
 * @param {any} details - Optional details
 */
function sendError(res, message, code = 'BAD_REQUEST', statusCode = 400, details = null) {
  const body = {
    success: false,
    error: { code, message },
  }
  if (details) {
    body.error.details = details
  }
  res.status(statusCode).json(body)
}

module.exports = { errorHandler, sendSuccess, sendError }
