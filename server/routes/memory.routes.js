// ══════════════════════════════════════
// Memory Routes — /api/agent/memory/* + /api/agent/permissions + /api/agent/hooks
// ══════════════════════════════════════

const { Router } = require('express')
const ctrl = require('../controllers/memory.controller')

const router = Router()

router.get('/memory', ctrl.list)
router.post('/memory', ctrl.create)
router.delete('/memory/:filename', ctrl.remove)
router.get('/permissions', ctrl.getPermissions)
router.get('/hooks', ctrl.getHooks)

module.exports = router
