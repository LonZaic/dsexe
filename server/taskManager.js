// ═══════════════════════════════════════════
// Task.md Manager — plan + tracking
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const TASK_TEMPLATE = `# Task.md

> 子 AI 规划的任务列表。主 AI 逐条执行，完成即划掉。

---

## 当前任务

（暂无）

---

## 已完成

（暂无）
`

function initTask(projectPath) {
  ensureDir(projectPath)
  const p = path.join(projectPath, 'Task.md')
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, TASK_TEMPLATE, 'utf-8')
    return { path: p, created: true }
  }
  return { path: p, created: false }
}

function readTask(projectPath) {
  const p = path.join(projectPath, 'Task.md')
  if (!fs.existsSync(p)) return ''
  return fs.readFileSync(p, 'utf-8')
}

// Write task list: [{ id, text, done }]
function writeTasks(projectPath, tasks) {
  ensureDir(projectPath)
  const p = path.join(projectPath, 'Task.md')
  const pending = tasks.filter(t => !t.done)
  const done = tasks.filter(t => t.done)
  let content = '# Task.md\n\n> 子 AI 规划。主 AI 逐条执行，完成即划掉。\n\n---\n\n## 当前任务\n\n'
  if (pending.length) {
    for (const t of pending) content += `- [ ] ${t.text}\n`
  } else {
    content += '（全部完成）\n'
  }
  content += '\n---\n\n## 已完成\n\n'
  if (done.length) {
    for (const t of done) content += `- [x] ~~${t.text}~~\n`
  } else {
    content += '（暂无）\n'
  }
  fs.writeFileSync(p, content, 'utf-8')
}

function markTaskDone(projectPath, taskId, allTasks) {
  const t = allTasks.find(x => x.id === taskId)
  if (t) t.done = true
  writeTasks(projectPath, allTasks)
}

module.exports = { initTask, readTask, writeTasks, markTaskDone, TASK_TEMPLATE }
