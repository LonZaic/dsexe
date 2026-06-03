// ══════════════════════════════════════════════════════
// Memory System — CC-style file-based memory (memdir)
// Ported from CC's src/memdir/* and src/services/extractMemories/*
//
// Structure:
//   server/memory/MEMORY.md          — index file
//   server/memory/user_*.md          — about the user
//   server/memory/feedback_*.md      — user feedback on how to work
//   server/memory/project_*.md       — project-specific facts
//   server/memory/reference_*.md     — external resources / URLs
//
// Each memory file has frontmatter:
//   ---
//   name: <kebab-case-name>
//   description: <one-line>
//   metadata:
//     type: user|feedback|project|reference
//   ---
// ══════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')

const MEMORY_DIR = path.join(__dirname, 'memory')

// ─── Ensure memory directory exists ───
function ensureMemDir(dir = MEMORY_DIR) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  const indexPath = path.join(dir, 'MEMORY.md')
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, '# Memory Index\n\nThis file indexes all memories for this project.\n\n', 'utf-8')
  }
}

// ─── Frontmatter parser (no dependencies needed) ───
function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (!match) return { data: {}, body: content }
  const frontmatterStr = match[1]
  const body = content.slice(match[0].length)
  const data = {}
  let currentKey = ''
  for (const line of frontmatterStr.split('\n')) {
    const keyMatch = line.match(/^(\w+):\s*(.*)/)
    if (keyMatch) {
      currentKey = keyMatch[1]
      data[currentKey] = keyMatch[2].trim()
    } else if (currentKey && line.trim()) {
      // Continuation of previous value
      data[currentKey] += '\n' + line
    }
  }
  // Parse nested metadata if present
  if (data.metadata) {
    // Simple inline metadata parsing: "type: user | key2: val2"
    try {
      // Try JSON parse first
      const metaObj = JSON.parse(data.metadata)
      data.metadata = metaObj
    } catch {
      // Parse as YAML-like key:value pairs
      const meta = {}
      for (const part of data.metadata.split('|')) {
        const [k, v] = part.split(':').map(s => s.trim())
        if (k && v) meta[k] = v
      }
      data.metadata = meta
    }
  }
  if (!data.metadata) data.metadata = {}
  return { data, body: body.trim() }
}

function buildFrontmatter(data) {
  const lines = ['---']
  for (const [key, value] of Object.entries(data)) {
    if (key === 'metadata' && typeof value === 'object') {
      const metaParts = Object.entries(value).map(([k, v]) => `${k}: ${v}`)
      lines.push(`metadata:`)
      lines.push(`  ${metaParts.join('\n  ')}`)
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  lines.push('---')
  return lines.join('\n') + '\n'
}

// ─── Scan memory directory ───
function scanMemoryFiles(dir = MEMORY_DIR) {
  ensureMemDir(dir)
  const files = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'MEMORY.md') continue
      const filePath = path.join(dir, entry.name)
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const { data, body } = parseFrontmatter(content)
        files.push({
          filename: entry.name,
          path: filePath,
          name: data.name || entry.name.replace('.md', ''),
          description: data.description || '',
          type: (data.metadata && data.metadata.type) || data.type || 'reference',
          content: body,
          frontmatter: data,
          size: content.length
        })
      } catch { /* skip unreadable */ }
    }
  } catch { /* skip */ }
  return files
}

// ─── Build memory prompt for system message ───
function getMemoryPrompt(dir = MEMORY_DIR) {
  const files = scanMemoryFiles(dir)
  if (files.length === 0) return ''

  let prompt = `You have access to a persistent memory system. Memories are stored as files and can help you remember context across sessions.

## Memory Types:
- **user** — Facts about the user (preferences, expertise, role)
- **feedback** — How you should work (corrections, approved approaches)
- **project** — Project-specific facts, decisions, and constraints
- **reference** — External resources, URLs, documentation

## Current Memories:
`
  const typeLabels = { user: '👤 User', feedback: '📝 Feedback', project: '📁 Project', reference: '🔗 Reference' }
  for (const f of files) {
    const label = typeLabels[f.type] || '📄 Other'
    prompt += `- ${label}: **${f.name}** — ${f.description}\n`
  }

  prompt += `\nWhen relevant, you can reference these memories in your responses. After completing tasks, important facts may be saved as new memories.`

  return prompt
}

// ─── Find relevant memories using a side query (CC pattern) ───
async function findRelevantMemories(task, dir, apiKey, signal) {
  const files = scanMemoryFiles(dir)
  if (files.length === 0) return []

  // Build a summary of available memories for the selector
  const summary = files.map((f, i) => `[${i}] ${f.type}: ${f.name} — ${f.description}`).join('\n')

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: `You are a memory relevance selector. Given a task and a list of available memories, select the indices of memories that are RELEVANT to the task. Be selective — only pick memories that would genuinely help complete the task.

Return a JSON object:
{ "selected": [0, 2, 5], "reason": "brief explanation" }

Only return JSON, nothing else.`
          },
          {
            role: 'user',
            content: `Task: ${task}\n\nAvailable memories:\n${summary}`
          }
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
      signal
    })

    if (!res.ok) return files.slice(0, 3)  // fallback: return first 3

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || ''
    try {
      const { selected } = JSON.parse(reply.replace(/```json|```/g, '').trim())
      if (Array.isArray(selected)) {
        return selected.map(i => files[i]).filter(Boolean)
      }
    } catch { /* fallback */ }
  } catch { /* fallback */ }

  // Fallback: return memories that mention keywords from the task
  const taskLower = task.toLowerCase()
  return files.filter(f =>
    taskLower.includes(f.name.toLowerCase()) ||
    f.description.toLowerCase().split(' ').some(w => w.length > 3 && taskLower.includes(w))
  ).slice(0, 5)
}

// ─── Save a new memory ───
function saveMemory(dir, name, description, type, content) {
  ensureMemDir(dir)

  // Validate type
  const validTypes = ['user', 'feedback', 'project', 'reference']
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid memory type: ${type}. Must be one of: ${validTypes.join(', ')}`)
  }

  // Sanitize filename
  const safeName = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  const prefix = type.slice(0, 4)  // user, feed, proj, refe
  const filename = `${prefix}_${safeName}.md`
  const filePath = path.join(dir, filename)

  // Build frontmatter
  const frontmatter = buildFrontmatter({
    name: safeName,
    description: description,
    metadata: { type }
  })
  const fileContent = frontmatter + '\n' + content + '\n'

  // Write memory file
  fs.writeFileSync(filePath, fileContent, 'utf-8')

  // Update MEMORY.md index
  updateIndex(dir, filename, safeName, description, type)

  return { filename, path: filePath, name: safeName }
}

// ─── Delete a memory ───
function deleteMemory(dir, filename) {
  const filePath = path.join(dir, filename)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Memory file not found: ${filename}`)
  }

  // Read the memory to get its name for index update
  let memoryName = filename.replace('.md', '')
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const { data } = parseFrontmatter(content)
    memoryName = data.name || memoryName
  } catch { /* use filename-based name */ }

  // Delete file
  fs.unlinkSync(filePath)

  // Remove from index
  removeFromIndex(dir, filename, memoryName)

  return { deleted: filename }
}

// ─── Index management ───
function updateIndex(dir, filename, name, description, type) {
  const indexPath = path.join(dir, 'MEMORY.md')
  let indexContent = ''
  try {
    indexContent = fs.readFileSync(indexPath, 'utf-8')
  } catch { indexContent = '# Memory Index\n\n' }

  // Check if already indexed
  const existingLine = `- [${name}](${filename})`
  if (indexContent.includes(existingLine)) return

  // Add to index
  const typeEmoji = { user: '👤', feedback: '📝', project: '📁', reference: '🔗' }
  const emoji = typeEmoji[type] || '📄'
  const newLine = `- ${emoji} [${name}](${filename}) — ${description}\n`

  indexContent += newLine
  fs.writeFileSync(indexPath, indexContent, 'utf-8')
}

function removeFromIndex(dir, filename, name) {
  const indexPath = path.join(dir, 'MEMORY.md')
  try {
    let indexContent = fs.readFileSync(indexPath, 'utf-8')
    const regex = new RegExp(`- .*\\[${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\(${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\).*\\n`, 'g')
    indexContent = indexContent.replace(regex, '')
    fs.writeFileSync(indexPath, indexContent, 'utf-8')
  } catch { /* skip */ }
}

// ─── Side query: extract memories from conversation (CC's extractMemories) ───
async function extractMemoriesFromConversation(messages, apiKey, signal) {
  if (messages.length < 4) return null  // too short to extract

  const conversation = messages.slice(-20).map(m => {
    const role = m.role.toUpperCase()
    let text = typeof m.content === 'string' ? m.content : ''
    if (m.tool_calls) text = `[Used tools: ${m.tool_calls.map(t => t.function?.name).join(', ')}]`
    return `${role}: ${text.slice(0, 300)}`
  }).join('\n')

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: `Analyze this conversation and extract any important facts worth remembering for future sessions. Focus on:
- User preferences or corrections (feedback)
- Project-specific decisions or constraints (project)
- Facts about the user (user)
- External references or resources (reference)

Return a JSON array of memories, each with: name (kebab-case), description (one line), type (user|feedback|project|reference), content (the fact).
Return empty array [] if nothing is worth remembering.

Only return JSON, nothing else.`
          },
          { role: 'user', content: conversation }
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal
    })

    if (!res.ok) return null
    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || ''
    try {
      const memories = JSON.parse(reply.replace(/```json|```/g, '').trim())
      if (Array.isArray(memories) && memories.length > 0) {
        return memories
      }
    } catch { /* no memories extracted */ }
  } catch { /* skip */ }
  return null
}

module.exports = {
  ensureMemDir,
  scanMemoryFiles,
  getMemoryPrompt,
  findRelevantMemories,
  saveMemory,
  deleteMemory,
  parseFrontmatter,
  buildFrontmatter,
  extractMemoriesFromConversation,
  MEMORY_DIR
}
