// ══════════════════════════════════════
// Route Aggregator — mount all route modules
// ══════════════════════════════════════

const { Router } = require('express')

const authRoutes = require('./auth.routes')
const chatRoutes = require('./chat.routes')
const aiRoutes = require('./ai.routes')
const agentRoutes = require('./agent.routes')
const memoryRoutes = require('./memory.routes')

const router = Router()

router.use('/api/auth', authRoutes)
router.use('/api', chatRoutes)
router.use('/api/ai', aiRoutes)
router.use('/api/agent', agentRoutes)
router.use('/api/agent', memoryRoutes)

module.exports = router
