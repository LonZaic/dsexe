// ══════════════════════════════════════
// Route Aggregator — mount all route modules
// ══════════════════════════════════════

const { Router } = require('express')

const authRoutes = require('./auth.routes')
const chatRoutes = require('./chat.routes')
const aiRoutes = require('./ai.routes')
const agentRoutes = require('./agent.routes')
const memoryRoutes = require('./memory.routes')
const codeRoutes = require('./code.routes')
const searchRoutes = require('./search.routes')
const weatherRoutes = require('./weather.routes')
const filesRoutes = require('./files.routes')
const computerRoutes = require('./computer.routes')
const mcpRoutes = require('./mcp.routes')
const skillsRoutes = require('./skills.routes')

const router = Router()

router.use('/api/auth', authRoutes)
router.use('/api', chatRoutes)
router.use('/api/ai', aiRoutes)
router.use('/api/agent', agentRoutes)
router.use('/api/agent', memoryRoutes)
router.use('/api', codeRoutes)
router.use('/api', searchRoutes)
router.use('/api', weatherRoutes)
router.use('/api', filesRoutes)
router.use('/api', computerRoutes)
router.use('/api/mcp', mcpRoutes)
router.use('/api/skills', skillsRoutes)

module.exports = router
