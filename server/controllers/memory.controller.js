// ══════════════════════════════════════
// Memory Controller
// ══════════════════════════════════════

const { scanMemoryFiles, saveMemory, deleteMemory, MEMORY_DIR } = require('../engine/memory')
const { sendSuccess, sendError } = require('../middleware/errorHandler')

function list(req, res) {
  try {
    const files = scanMemoryFiles(MEMORY_DIR)
    sendSuccess(res, files)
  } catch (e) {
    sendError(res, e.message, 'MEMORY_ERROR', 500)
  }
}

function create(req, res) {
  const { name, description, type, content } = req.body
  if (!name || !type || !content) {
    return sendError(res, 'name, type, content are required')
  }
  try {
    const result = saveMemory(MEMORY_DIR, name, description || '', type, content)
    sendSuccess(res, result)
  } catch (e) {
    sendError(res, e.message, 'MEMORY_SAVE_ERROR', 400)
  }
}

function remove(req, res) {
  try {
    const result = deleteMemory(MEMORY_DIR, req.params.filename)
    sendSuccess(res, result)
  } catch (e) {
    sendError(res, e.message, 'MEMORY_DELETE_ERROR', 404)
  }
}

function getPermissions(req, res) {
  const rulesPath = require('path').join(__dirname, '..', 'permissions-config.json')
  const { getAllRules, MODES } = require('../engine/permissions')
  const rules = getAllRules(rulesPath)
  sendSuccess(res, { modes: MODES, rules })
}

function getHooks(req, res) {
  const hooksPath = require('path').join(__dirname, '..', 'hooks-config.json')
  const { loadHooks } = require('../engine/hooks')
  const hooksConfig = loadHooks(hooksPath)
  sendSuccess(res, hooksConfig)
}

module.exports = { list, create, remove, getPermissions, getHooks }
