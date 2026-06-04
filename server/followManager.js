// ═══════════════════════════════════════════
// Follow.md Manager — per-project memory doc
// Preset template, AI fills in after each round
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const { BM25 } = require('./bm25')

const FOLLOW_TEMPLATE = `# Follow.md

> AI 自动维护。每一轮对话后子 AI 总结关键信息填入对应章节。

## 用户警告
<!-- 用户明确禁止的行为、纠正过的错误、强调的偏好 -->
（暂无）

## 代码风格约定
<!-- 命名规范、缩进、注释风格、文件组织方式 -->
（暂无）

## 项目样式风格
<!-- UI/视觉风格偏好、CSS 约定、组件风格 -->
- 只使用 SVG 图标，禁止 emoji

## 用户提供的代码仓库
<!-- 参考仓库、示例代码、借鉴来源 -->
（暂无）

## 技术栈与依赖
<!-- 技术栈、关键依赖、版本要求 -->
（暂无）

## 架构决策
<!-- 架构选择、模块划分、数据流设计 -->
（暂无）

## 关键文件与路径
<!-- 重要文件、目录结构和用途 -->
（暂无）

## 未完成任务
<!-- 正在进行中但尚未完成的工作 -->
（暂无）

## 已知问题
<!-- 已发现但尚未修复的 bug、技术债务 -->
（暂无）

## 常用命令
<!-- 构建、测试、运行等常用命令 -->
（暂无）
`

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function initFollow(projectPath) {
  ensureDir(projectPath)
  const followPath = path.join(projectPath, 'Follow.md')
  if (!fs.existsSync(followPath)) {
    fs.writeFileSync(followPath, FOLLOW_TEMPLATE, 'utf-8')
    return { path: followPath, created: true }
  }
  // Ensure all sections exist
  let content = fs.readFileSync(followPath, 'utf-8')
  let updated = false
  const tmpl = extractSections(FOLLOW_TEMPLATE)
  const exist = extractSections(content)
  for (const name of Object.keys(tmpl)) {
    if (!exist[name]) {
      content += `\n## ${name}\n\n（暂无）\n`
      updated = true
    }
  }
  if (updated) fs.writeFileSync(followPath, content, 'utf-8')
  return { path: followPath, created: false, updated }
}

function updateFollowSection(projectPath, sectionName, newContent) {
  const followPath = path.join(projectPath, 'Follow.md')
  if (!fs.existsSync(followPath)) initFollow(projectPath)
  let content = fs.readFileSync(followPath, 'utf-8')
  const esc = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(## ${esc}\\s*\\n)\\n*([\\s\\S]*?)(?=\\n## |$)`, 'i')
  if (regex.test(content)) {
    content = content.replace(regex, `$1\n${newContent}\n`)
  } else {
    content += `\n## ${sectionName}\n\n${newContent}\n`
  }
  fs.writeFileSync(followPath, content, 'utf-8')
}

function extractSections(content) {
  const s = {}
  const re = /## (.+?)\s*\n([\s\S]*?)(?=\n## |$)/g
  let m
  while ((m = re.exec(content)) !== null) s[m[1].trim()] = m[2].trim()
  return s
}

function readFollow(projectPath) {
  const p = path.join(projectPath, 'Follow.md')
  if (!fs.existsSync(p)) return ''
  return fs.readFileSync(p, 'utf-8')
}

function searchFollowBM25(projectPath, query) {
  const content = readFollow(projectPath)
  if (!content) return []
  const sections = extractSections(content)
  const names = Object.keys(sections)
  const texts = names.map(n => sections[n])
  if (!texts.length) return []
  const bm25 = new BM25(texts)
  return bm25.search(query, 5).map(r => ({
    section: names[r.index], content: r.text, score: r.score
  }))
}

// Hybrid: 0.6 vector + 0.4 BM25
async function hybridSearch(projectPath, query, embeddingFn) {
  const content = readFollow(projectPath)
  if (!content) return []
  const sections = extractSections(content)
  const names = Object.keys(sections)
  const texts = names.map(n => sections[n])
  if (!texts.length) return []

  const bm25 = new BM25(texts)
  const bm25Res = bm25.search(query, 20)
  const bm25Scores = {}
  let bm25Max = 0
  for (const r of bm25Res) { bm25Scores[r.index] = r.score; if (r.score > bm25Max) bm25Max = r.score }

  let vecScores = {}, vecMax = 0
  if (embeddingFn) {
    try {
      const qv = await embeddingFn(query)
      const svs = await Promise.all(texts.map(t => embeddingFn(t)))
      for (let i = 0; i < svs.length; i++) {
        vecScores[i] = cosineSim(qv, svs[i])
        if (vecScores[i] > vecMax) vecMax = vecScores[i]
      }
    } catch { /* fallback to BM25 only */ }
  }

  const results = texts.map((text, i) => {
    const bn = bm25Max > 0 ? (bm25Scores[i] || 0) / bm25Max : 0
    const vn = vecMax > 0 ? (vecScores[i] || 0) / vecMax : 0
    return { index: i, section: names[i], content: text, score: 0.6 * vn + 0.4 * bn }
  })
  return results.filter(r => r.score > 0.05).sort((a, b) => b.score - a.score).slice(0, 5)
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  const den = Math.sqrt(na) * Math.sqrt(nb)
  return den === 0 ? 0 : d / den
}

module.exports = { initFollow, updateFollowSection, readFollow, searchFollowBM25, hybridSearch, extractSections, FOLLOW_TEMPLATE }
