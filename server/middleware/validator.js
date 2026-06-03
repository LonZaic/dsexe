// ══════════════════════════════════════
// Request Validator Middleware
// Simple schema-based validation — no heavy dependencies
// ══════════════════════════════════════

const { sendError } = require('./errorHandler')

/**
 * Validate request body against a simple schema.
 * Schema: { field: { required?: boolean, type?: string, minLength?: number, maxLength?: number } }
 */
function validate(schema) {
  return (req, res, next) => {
    const body = req.body || {}

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field]

      // Required check
      if (rules.required && (value === undefined || value === null || value === '')) {
        return sendError(res, `${field} 不能为空`, 'VALIDATION_ERROR', 400)
      }

      // Skip further checks if value is not provided and not required
      if (value === undefined || value === null) continue

      // Type check
      if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value
        if (actualType !== rules.type) {
          return sendError(res, `${field} 类型应为 ${rules.type}`, 'VALIDATION_ERROR', 400)
        }
      }

      // String length checks
      if (typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          return sendError(res, `${field} 至少需要 ${rules.minLength} 个字符`, 'VALIDATION_ERROR', 400)
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          return sendError(res, `${field} 不能超过 ${rules.maxLength} 个字符`, 'VALIDATION_ERROR', 400)
        }
      }
    }

    next()
  }
}

module.exports = { validate }
