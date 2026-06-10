// ═══════════════════════════════════════════
// Skill Loader — CC-style SKILL.md loading
// Scans .claude/skills/ + .deepseek-super/skills/
// Supports: user, project, managed, bundled, MCP skills
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const os = require('os')

const DS_SKILLS_DIR = '.deepseek-super/skills'
const CLAUDE_SKILLS_DIR = '.claude/skills'

function getSkillDirs(projectPath) {
  const dirs = []
  // Managed skills (highest priority from policy)
  // User skills — both .deepseek-super and .claude paths
  dirs.push(path.join(os.homedir(), DS_SKILLS_DIR))
  dirs.push(path.join(os.homedir(), CLAUDE_SKILLS_DIR))

  // Project skills
  if (projectPath) {
    dirs.push(path.join(projectPath, DS_SKILLS_DIR))
    dirs.push(path.join(projectPath, CLAUDE_SKILLS_DIR))
  }

  return dirs.filter(d => {
    try { return fs.existsSync(d) } catch { return false }
  })
}

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
      const value = m[2].trim()
      fm[currentKey] = value === '' ? [] : value
    } else if (currentKey && Array.isArray(fm[currentKey])) {
      const item = line.trim().replace(/^-\s*/, '')
      if (item) fm[currentKey].push(item)
    }
  }

  const body = lines.slice(endIdx + 1).join('\n').trim()
  return { frontmatter: fm, body }
}

function buildFrontmatter(skill) {
  const fields = []
  if (skill.name) fields.push(`name: ${skill.name}`)
  if (skill.description) fields.push(`description: ${skill.description}`)
  if (skill['user-invocable'] !== undefined) {
    fields.push(`user-invocable: ${skill['user-invocable']}`)
  }
  if (skill['when-to-use']) fields.push(`when_to_use: ${skill['when-to-use']}`)
  if (skill.model) fields.push(`model: ${skill.model}`)
  if (skill.agent) fields.push(`agent: ${skill.agent}`)
  if (skill.version) fields.push(`version: ${skill.version}`)
  if (skill['argument-hint']) fields.push(`argument-hint: ${skill['argument-hint']}`)
  if (skill['allowed-tools']) {
    if (Array.isArray(skill['allowed-tools'])) {
      fields.push('allowed-tools:')
      skill['allowed-tools'].forEach(t => fields.push(`  - ${t}`))
    } else {
      fields.push(`allowed-tools: ${skill['allowed-tools']}`)
    }
  }
  if (skill.paths && skill.paths.length) {
    fields.push('paths:')
    skill.paths.forEach(p => fields.push(`  - ${p}`))
  }
  if (skill['disable-model-invocation']) fields.push(`disable-model-invocation: ${skill['disable-model-invocation']}`)
  if (skill.context === 'fork') fields.push('context: fork')

  return fields.length ? `---\n${fields.join('\n')}\n---\n` : '---\n---\n'
}

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
            agent: frontmatter.agent || null,
            context: frontmatter.context || 'inline',
            allowed_tools: frontmatter['allowed-tools'] || null,
            paths: Array.isArray(frontmatter.paths) ? frontmatter.paths : (frontmatter.paths ? [frontmatter.paths] : []),
            argument_hint: frontmatter['argument-hint'] || null,
            version: frontmatter.version || null,
            disable_model_invocation: frontmatter['disable-model-invocation'] === 'true',
            dir: skillDir,
            body,
            raw_content: content,
            source: dir.includes(os.homedir()) ? 'user' : 'project',
          })
        } catch (e) {
          // skip broken skill files silently
        }
      }
    } catch {}
  }

  return skills
}

function getSkillsPrompt(projectPath, currentFile) {
  const skills = loadSkills(projectPath)
  if (!skills.length) return ''

  const userSkills = skills.filter(s => s.user_invocable)
  const autoSkills = skills.filter(s => !s.user_invocable)

  let prompt = ''
  if (userSkills.length) {
    prompt += '\n## Available Skills (user-invocable)\n'
    prompt += 'Users can invoke these skills with /skill-name. You, the AI, can invoke them using the Skill tool.\n\n'
    for (const s of userSkills) {
      const hint = s.argument_hint ? ` ${s.argument_hint}` : ''
      prompt += `- **/${s.slug}${hint}** — ${s.description}\n`
    }
  }

  if (autoSkills.length && currentFile) {
    const active = autoSkills.filter(s => {
      if (!s.paths || !s.paths.length) return true
      return s.paths.some(p => {
        const escaped = p.replace(/\./g, '\\.').replace(/\*\*/g, '<<D>>').replace(/\*/g, '[^/\\\\]*').replace(/<<D>>/g, '.*')
        try { return new RegExp('^' + escaped + '$', 'i').test(currentFile) } catch { return false }
      })
    })
    if (active.length) {
      prompt += '\n## Auto-Activated Skills (context-based)\n'
      for (const s of active) {
        prompt += `- **${s.name}** — ${s.description}\n`
      }
    }
  }

  return prompt
}

function getSkillBody(projectPath, skillSlug) {
  const skills = loadSkills(projectPath)
  const skill = skills.find(s => s.slug === skillSlug || s.name === skillSlug)
  if (!skill) return null
  return skill
}

function getActiveSkills(projectPath, currentFile) {
  const skills = loadSkills(projectPath)
  if (!currentFile) return []
  return skills.filter(s => {
    if (!s.paths || !s.paths.length) return false
    return s.paths.some(p => {
      const escaped = p.replace(/\./g, '\\.').replace(/\*\*/g, '<<D>>').replace(/\*/g, '[^/\\\\]*').replace(/<<D>>/g, '.*')
      try { return new RegExp('^' + escaped + '$', 'i').test(currentFile) } catch { return false }
    })
  })
}

function saveSkill(projectPath, skillSlug, skillData) {
  const skillsDir = projectPath
    ? path.join(projectPath, DS_SKILLS_DIR)
    : path.join(os.homedir(), DS_SKILLS_DIR)

  const skillDir = path.join(skillsDir, skillSlug)
  if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true })

  const skillPath = path.join(skillDir, 'SKILL.md')
  const frontmatter = buildFrontmatter(skillData)
  fs.writeFileSync(skillPath, frontmatter + '\n' + (skillData.body || skillData.skillContent || ''), 'utf-8')
  return { success: true, path: skillPath }
}

function deleteSkill(projectPath, skillSlug) {
  const skillsDirs = [
    path.join(os.homedir(), DS_SKILLS_DIR, skillSlug),
    path.join(os.homedir(), CLAUDE_SKILLS_DIR, skillSlug),
  ]
  if (projectPath) {
    skillsDirs.push(path.join(projectPath, DS_SKILLS_DIR, skillSlug))
    skillsDirs.push(path.join(projectPath, CLAUDE_SKILLS_DIR, skillSlug))
  }

  for (const dir of skillsDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      return { success: true }
    }
  }
  return { success: false, error: 'Skill not found on disk' }
}

// Bundled skills management
let _bundledSkills = []

function registerBundledSkills(skills) {
  _bundledSkills = skills || []
}

function getBundledSkills() {
  return _bundledSkills
}

module.exports = {
  loadSkills, getSkillsPrompt, getSkillBody,
  getActiveSkills, parseSkillFrontmatter,
  saveSkill, deleteSkill,
  registerBundledSkills, getBundledSkills,
}
