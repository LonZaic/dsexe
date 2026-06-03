// ══════════════════════════════════════
// AI Routes — /api/ai/*
// ══════════════════════════════════════

const { Router } = require('express')
const ctrl = require('../controllers/ai.controller')

const router = Router()

router.post('/chat', ctrl.chat)
router.post('/chat/stream', ctrl.chatStream)

module.exports = router
