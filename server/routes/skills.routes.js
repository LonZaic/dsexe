// ═══════════════════════════════════════════
// Skills Routes — API for managing Skills
// ═══════════════════════════════════════════

const { Router } = require('express')
const skillsController = require('../controllers/skills.controller')

const router = Router()

// List all installed skills
router.get('/', skillsController.listSkills)

// Install a new skill (from marketplace or custom)
router.post('/', skillsController.installSkill)

// Get a specific skill's content
router.get('/:slug', skillsController.getSkill)

// Update a skill
router.put('/:slug', skillsController.updateSkill)

// Delete a skill
router.delete('/:slug', skillsController.deleteSkill)

// Get marketplace skills
router.get('/marketplace/all', skillsController.getMarketplace)

// Install a skill from marketplace
router.post('/marketplace/install', skillsController.installFromMarketplace)

// Upload SKILL.md file
router.post('/upload', skillsController.uploadSkillFile)

module.exports = router
