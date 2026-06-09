// ═══════════════════════════════════════════
// Skills Controller — CRUD + marketplace
// ═══════════════════════════════════════════

const { loadSkills, saveSkill, deleteSkill, getSkillBody } = require('../skills/skillLoader')
const { SKILLS } = require('../marketplace/registry')

// GET /api/skills
function listSkills(req, res) {
  try {
    const projectPath = req.query.project || process.cwd()
    const skills = loadSkills(projectPath)
    const result = skills.map(s => ({
      name: s.name,
      slug: s.slug,
      description: s.description,
      icon: s.name,
      userInvocable: s.user_invocable,
      model: s.model,
      version: s.version,
      source: s.source,
      allowedTools: s.allowed_tools,
      argumentHint: s.argument_hint,
      whenToUse: s.when_to_use,
      paths: s.paths,
      agent: s.agent,
      context: s.context,
    }))
    res.json({ skills: result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// GET /api/skills/:slug
function getSkill(req, res) {
  try {
    const projectPath = req.query.project || process.cwd()
    const skill = getSkillBody(projectPath, req.params.slug)
    if (!skill) return res.status(404).json({ error: 'Skill not found' })
    res.json({ skill })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// POST /api/skills
function installSkill(req, res) {
  try {
    const { slug, skill, projectPath } = req.body
    if (!slug || !skill) {
      return res.status(400).json({ error: 'slug and skill data are required' })
    }
    const result = saveSkill(projectPath || process.cwd(), slug, skill)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// PUT /api/skills/:slug
function updateSkill(req, res) {
  try {
    const { slug } = req.params
    const { skill, projectPath } = req.body
    const result = saveSkill(projectPath || process.cwd(), slug, skill)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// DELETE /api/skills/:slug
function deleteSkillRoute(req, res) {
  try {
    const { slug } = req.params
    const projectPath = req.body?.projectPath || process.cwd()
    const result = deleteSkill(projectPath, slug)
    if (!result.success) return res.status(404).json(result)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// GET /api/skills/marketplace/all
function getMarketplace(req, res) {
  res.json({ skills: SKILLS })
}

// POST /api/skills/marketplace/install
function installFromMarketplace(req, res) {
  try {
    const { skillId, projectPath } = req.body
    const skillMeta = SKILLS.find(s => s.id === skillId)
    if (!skillMeta) return res.status(404).json({ error: 'Skill not found in marketplace' })

    const skillData = {
      name: skillMeta.displayName || skillMeta.name,
      description: skillMeta.description,
      'user-invocable': skillMeta.userInvocable !== false,
      version: skillMeta.version,
    }

    if (skillMeta.model) skillData.model = skillMeta.model
    if (skillMeta.agent) skillData.agent = skillMeta.agent

    const result = saveSkill(projectPath || process.cwd(), skillMeta.name, {
      ...skillData,
      skillContent: skillMeta.skillContent || skillMeta.description,
      body: skillMeta.skillContent || '',
    })

    res.json({ success: true, slug: skillMeta.name, ...result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// POST /api/skills/upload — Upload SKILL.md file
function uploadSkillFile(req, res) {
  try {
    const { filename, content, projectPath } = req.body
    if (!content) return res.status(400).json({ error: 'File content is required' })
    if (!content.trim()) return res.status(400).json({ error: 'File is empty' })

    const { parseSkillFrontmatter } = require('../skills/skillLoader')
    const { frontmatter, body } = parseSkillFrontmatter(content)

    // Derive slug from filename or frontmatter name
    const rawName = filename
      ? filename.replace(/\.md$/i, '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
      : (frontmatter.name || 'uploaded-skill')
    const slug = frontmatter.name
      ? frontmatter.name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
      : rawName

    if (!slug || slug.length < 1) return res.status(400).json({ error: 'Could not determine skill name from filename or frontmatter' })

    const skillData = {
      name: frontmatter.name || rawName,
      description: frontmatter.description || 'Uploaded skill',
      'user-invocable': frontmatter['user-invocable'] !== 'false',
      body: body || content,
    }

    if (frontmatter.model) skillData.model = frontmatter.model
    if (frontmatter.agent) skillData.agent = frontmatter.agent
    if (frontmatter['allowed-tools']) {
      skillData['allowed-tools'] = frontmatter['allowed-tools']
    }
    if (frontmatter.version) skillData.version = frontmatter.version
    if (frontmatter['argument-hint']) skillData['argument-hint'] = frontmatter['argument-hint']
    if (frontmatter.context === 'fork') skillData.context = 'fork'
    if (frontmatter['when-to-use'] || frontmatter.when_to_use) {
      skillData['when-to-use'] = frontmatter.when_to_use || frontmatter['when-to-use']
    }

    const { saveSkill } = require('../skills/skillLoader')
    const result = saveSkill(projectPath || process.cwd(), slug, skillData)

    res.json({
      success: true,
      slug,
      skill: { ...skillData, slug },
      path: result.path,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

module.exports = {
  listSkills, getSkill, installSkill, updateSkill,
  deleteSkill: deleteSkillRoute,
  getMarketplace, installFromMarketplace,
  uploadSkillFile,
}
