// ══════════════════════════════════════
// Auth Routes — /api/auth/*
// ══════════════════════════════════════

const { Router } = require('express')
const { authRequired } = require('../auth')
const ctrl = require('../controllers/auth.controller')

const router = Router()

router.post('/register', ctrl.register)
router.post('/login', ctrl.login)
router.get('/me', authRequired, ctrl.me)

module.exports = router
