// ═══════════════════════════════════════════
// Keep.md Manager — context handoff system
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const KEEP_TEMPLATE = `# Keep.md

> 上下文接力提示词。上一个 AI 实例在上下文满时生成，新实例读取后继续工作。

---

## 接力提示词

（等待 AI 在上下文满时生成）
`

function initKeep(projectPath) {
  ensureDir(projectPath)
  const p = path.join(projectPath, 'Keep.md')
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, KEEP_TEMPLATE, 'utf-8')
    return { path: p, created: true }
  }
  return { path: p, created: false }
}

function readKeep(projectPath) {
  const p = path.join(projectPath, 'Keep.md')
  if (!fs.existsSync(p)) return ''
  return fs.readFileSync(p, 'utf-8')
}

function writeKeep(projectPath, handoffPrompt) {
  ensureDir(projectPath)
  const p = path.join(projectPath, 'Keep.md')
  const content = `# Keep.md

> 上下文接力提示词。上一个 AI 实例在上下文满时生成，新实例读取后继续工作。

---

## 接力提示词

${handoffPrompt}

---

## 生成时间

${new Date().toISOString()}
`
  fs.writeFileSync(p, content, 'utf-8')
}

// Generate handoff prompt using AI summary
async function generateHandoff(projectPath, task, messages, completedTasks, pendingTasks, apiKey, signal) {
  const conversation = messages.slice(-20).map(m => {
    const r = m.role?.toUpperCase() || ''
    const c = typeof m.content === 'string' ? m.content.slice(0, 300) : ''
    return `[${r}] ${c}`
  }).join('\n')

  const prompt = `你是一个 AI 接力助手。上一个 AI 实例上下文已满，你需要为新 AI 实例生成接力提示词。

## 用户任务
${task}

## 已完成步骤
${completedTasks.map(t => `- [x] ${t.text}`).join('\n') || '（无）'}

## 未完成步骤
${pendingTasks.map(t => `- [ ] ${t.text}`).join('\n') || '（无）'}

## 最近对话
${conversation.slice(0, 2000)}

## 要求
为新 AI 实例写一段 200-500 字的接力提示词，包含：
1. 任务的当前进度
2. 已完成的关键改动（文件路径、改动内容）
3. 接下来要做什么
4. 需要注意的陷阱或约定

输出纯文本，不要 markdown 格式。`

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.3 }),
    signal
  })
  const data = await res.json()
  const handoff = data.choices?.[0]?.message?.content || ''
  writeKeep(projectPath, handoff)
  return handoff
}

// Build complete injection prompt for new AI from 3 docs
function buildNewSessionPrompt(projectPath) {
  const follow = readFollowSafe(projectPath)
  const task = readTaskSafe(projectPath)
  const keep = readKeep(projectPath)

  return `## 项目文档指引

你已继承上一个 AI 实例的三个文档。请仔细阅读并继续工作：

### 1. Follow.md（项目记忆 — 使用 hybrid search 检索）
${follow.slice(0, 2000)}

### 2. Task.md（任务追踪）
${task.slice(0, 1500)}

### 3. Keep.md（接力提示词）
${keep.slice(0, 1000)}

---

**重要指令**：
- 你需要完全了解以上内容后才能开始工作
- 使用 Follow.md 了解项目约定和风格
- 按照 Task.md 的未完成步骤继续执行
- 按照 Keep.md 的接力提示词继续工作
- 先通读项目代码结构，确保 100% 理解后再动手
- 完成后必须测试，发现问题必须修复，不可以偷懒
- Follow.md 需要用的时候通过 hybrid search 检索（BM25 + 向量）`
}

function readFollowSafe(p) {
  try { const fp = path.join(p, 'Follow.md'); return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf-8') : '' } catch { return '' }
}
function readTaskSafe(p) {
  try { const tp = path.join(p, 'Task.md'); return fs.existsSync(tp) ? fs.readFileSync(tp, 'utf-8') : '' } catch { return '' }
}

module.exports = { initKeep, readKeep, writeKeep, generateHandoff, buildNewSessionPrompt, KEEP_TEMPLATE }
