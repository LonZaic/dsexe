// ═══════════════════════════════════════════
// Skill Loader — CC-style SKILL.md loading
// Scans .claude/skills/ for markdown-defined skills
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const os = require('os')

// Scan paths (in priority order)
function getSkillDirs(projectPath) {
  const dirs = []
  // User skills
  dirs.push(path.join(os.homedir(), '.claude', 'skills'))
  // Project skills
  if (projectPath) {
    dirs.push(path.join(projectPath, '.claude', 'skills'))
  }
  return dirs.filter(d => fs.existsSync(d))
}

/**
 * Parse YAML-like frontmatter from SKILL.md
 * Format: markdown with --- delimited frontmatter
 */
function parseSkillFrontmatter(content) {
  const lines = content.split('\n')
  if (!lines[0] || !lines[0].trim().startsWith('---')) return { frontmatter: {}, body: content }

  let endIdx = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIdx = i; break }
  }
  if (endIdx === -1) return { frontmatter: {}, body: content }

  const fm = {}
  const fmLines = lines.slice(1, endIdx)
  let currentKey = ''
  for (const line of fmLines) {
    const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
    if (m) {
      currentKey = m[1]
      fm[currentKey] = m[2].trim()
      // Parse arrays (indented - items)
      if (fm[currentKey] === '') fm[currentKey] = []
    } else if (currentKey && Array.isArray(fm[currentKey])) {
      const item = line.trim().replace(/^-\s*/, '')
      if (item) fm[currentKey].push(item)
    }
  }

  const body = lines.slice(endIdx + 1).join('\n').trim()
  return { frontmatter: fm, body }
}

/**
 * Load all skills from scan directories
 */
function loadSkills(projectPath) {
  const skills = []
  const seen = new Set()

  for (const dir of getSkillDirs(projectPath)) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const skillDir = path.join(dir, entry.name)
        const skillFile = path.join(skillDir, 'SKILL.md')
        if (!fs.existsSync(skillFile)) continue

        // Deduplicate by name
        const name = entry.name.toLowerCase()
        if (seen.has(name)) continue
        seen.add(name)

        try {
          const content = fs.readFileSync(skillFile, 'utf-8')
          const { frontmatter, body } = parseSkillFrontmatter(content)

          skills.push({
            name: frontmatter.name || entry.name,
            slug: entry.name,
            description: frontmatter.description || '',
            when_to_use: frontmatter.when_to_use || frontmatter['when-to-use'] || '',
            user_invocable: frontmatter['user-invocable'] !== 'false',
            model: frontmatter.model || null,
            allowed_tools: frontmatter['allowed-tools'] || null,
            agent: frontmatter.agent || null,
            paths: frontmatter.paths || [],
            dir: skillDir,
            body,
            raw_content: content,
          })
        } catch (e) {
          console.error('[Skills] Error loading', skillFile, e.message)
        }
      }
    } catch {}
  }

  return skills
}

/**
 * Get skill prompt for injection into system message
 * Shows available skills that the AI can invoke
 */
function getSkillsPrompt(projectPath, currentFile) {
  const skills = loadSkills(projectPath)
  if (!skills.length) return ''

  const userSkills = skills.filter(s => s.user_invocable)
  const autoSkills = skills.filter(s => !s.user_invocable)

  let prompt = ''
  if (userSkills.length) {
    prompt += '\n## 用户可用技能\n'
    for (const s of userSkills) {
      prompt += `- **/${s.slug}** — ${s.description}\n`
    }
  }
  if (autoSkills.length && currentFile) {
    // Check path-based activation
    const active = autoSkills.filter(s => {
      if (!s.paths || !s.paths.length) return true
      return s.paths.some(p => {
        const re = new RegExp('^' + p.replace(/\*\*/g, '<<D>>').replace(/\*/g, '[^/\\\\]*').replace(/<<D>>/g, '.*') + '$', 'i')
        return re.test(currentFile)
      })
    })
    if (active.length) {
      prompt += '\n## 自动激活技能\n'
      for (const s of active) {
        prompt += `- **${s.name}** — ${s.description}\n`
      }
    }
  }

  return prompt
}

/**
 * Get the full body of a specific skill for execution
 */
function getSkillBody(projectPath, skillSlug) {
  const skills = loadSkills(projectPath)
  const skill = skills.find(s => s.slug === skillSlug || s.name === skillSlug)
  if (!skill) return null
  return skill.body
}

/**
 * Find skills matching current context (path-based activation)
 */
function getActiveSkills(projectPath, currentFile) {
  const skills = loadSkills(projectPath)
  if (!currentFile) return []
  return skills.filter(s => {
    if (!s.paths || !s.paths.length) return false
    return s.paths.some(p => {
      const re = new RegExp('^' + p.replace(/\*\*/g, '<<D>>').replace(/\*/g, '[^/\\\\]*').replace(/<<D>>/g, '.*') + '$', 'i')
      return re.test(currentFile)
    })
  })
}

module.exports = {
  loadSkills,
  getSkillsPrompt,
  getSkillBody,
  getActiveSkills,
  parseSkillFrontmatter,
}
