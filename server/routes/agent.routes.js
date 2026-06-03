// ══════════════════════════════════════
// Agent Routes — /api/agent/*
// ══════════════════════════════════════

const { Router } = require('express')
const { authRequired } = require('../auth')
const ctrl = require('../controllers/agent.controller')

const router = Router()

router.post('/run', ctrl.run)
router.post('/group-run', ctrl.groupRun)
router.post('/judge', ctrl.judge)
router.post('/clean', authRequired, ctrl.clean)
router.get('/debug', ctrl.debug)

module.exports = router
