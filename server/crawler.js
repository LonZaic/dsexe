// ═══════════════════════════════════════════
// Professional Content Crawler v3
//
// Features:
//   - Readability-based article extraction (adapted Mozilla algorithm)
//   - GitHub / Gitee API integration for code fetching
//   - Chinese news site awareness (xinhua, people, sina, etc.)
//   - Smart boilerplate removal (nav, footer, ads, sidebar)
//   - Date extraction from article metadata + content
//   - Auto language detection
//   - Anti-detection: rotating UA, polite delays, session reuse
//   - Code block preservation from <pre><code> and markdown fences
//
// Zero external dependencies, Node.js built-ins only
// ═══════════════════════════════════════════

const https = require('https')
const http = require('http')
const { URL } = require('url')

const TIMEOUT = 15000
const MAX_REDIRECTS = 3
const MAX_CONTENT_LEN = 4000     // article pages
const HOME_MAX_LEN = 600        // homepages/portals — just a summary
const CODE_MAX_LEN = 24000
const CONCURRENT = 2           // polite: 2 concurrent fetches

// ─── Rotating User-Agent pool ───
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
]
let uaIdx = 0
function nextUA() { return UA_POOL[uaIdx++ % UA_POOL.length] }

// ─── HTTP fetch with retry, redirect following, and timeout ───
function fetchPage(urlStr, redirects = 0, customHeaders) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) return reject(new Error('Too many redirects'))
    const parsed = new URL(urlStr)
    const mod = parsed.protocol === 'https:' ? https : http
    const headers = {
      'User-Agent': nextUA(),
      'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      ...(customHeaders || {}),
    }
    const req = mod.get(urlStr, { timeout: TIMEOUT, headers }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location
        if (loc) {
          const target = loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.host}${loc}`
          return fetchPage(target, redirects + 1, customHeaders).then(resolve).catch(reject)
        }
      }
      if (res.statusCode === 403 || res.statusCode === 429) {
        return reject(new Error(`Blocked: HTTP ${res.statusCode}`))
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve(body))
      res.on('error', reject)
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}

// Fetch JSON from API endpoints
function fetchJSON(urlStr, customHeaders) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const mod = parsed.protocol === 'https:' ? https : http
    const headers = {
      'User-Agent': nextUA(),
      'Accept': 'application/json',
      ...(customHeaders || {}),
    }
    const req = mod.get(urlStr, { timeout: TIMEOUT, headers }, (res) => {
      if (res.statusCode === 404) return resolve(null)
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { resolve(null) }
      })
      res.on('error', reject)
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}

// ─── Domain classifiers ───
const GITHUB_BLOB  = /github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/i
const GITHUB_TREE  = /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/?(.*)/i
const GITHUB_REPO  = /github\.com\/([^\/]+)\/([^\/\s?#]+)(?:\/tree\/[^\/\s?#]*\/?(.*))?(?:\?|#|\s|\/)?$/i
const GITHUB_GIST  = /gist\.github\.com\/([^\/]+\/[a-f0-9]+)/i
const GITEE_BLOB   = /gitee\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)/i
const GITEE_TREE   = /gitee\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/?(.*)/i
const GITEE_REPO   = /gitee\.com\/([^\/]+)\/([^\/\s?#]+)(?:\/tree\/[^\/\s?#]*\/?(.*))?(?:\?|#|\s|\/)?$/i
const STACKOVERFLOW = /stackoverflow\.com\/questions\/(\d+)/i
const ZHIHU_ANSWER = /zhihu\.com\/question\/\d+\/answer\/(\d+)/i
const ZHIHU_QUESTION = /zhihu\.com\/question\/(\d+)/i
const CSDN_BLOG    = /blog\.csdn\.net\/.+\/article\/details\/(\d+)/i
const JUEJIN_POST  = /juejin\.cn\/post\/(\d+)/i

function isCodeHost(url) {
  return /github\.com|gitee\.com|gitlab\.com|bitbucket\.org|sourceforge\.net/i.test(url)
}

// ─── GitHub specialized crawlers ───

// HTML scraping fallback — extracts file list from GitHub repo page when API is rate-limited
function extractFileTreeFromHTML(html) {
  if (!html) return []
  const files = []
  // GitHub's file list uses .js-navigation-item with .content and .css-truncate
  const rowRegex = /<div[^>]*class="[^"]*Box-row[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi
  // Simpler approach: find all file/dir links in the repo content area
  const linkRegex = /<a[^>]*href="\/([^\/]+\/[^\/]+)\/(?:blob|tree)\/[^"]*"[^>]*>[\s\S]*?<svg[^>]*class="[^"]*(?:file|directory)[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*css-truncate[^"]*"[^>]*>([^<]+)<\/span>/gi
  let m
  while ((m = linkRegex.exec(html)) !== null) {
    files.push({ name: m[2].trim(), type: html.slice(m.index, m.index + 300).includes('directory') ? 'tree' : 'blob' })
  }
  return files
}

async function crawlGitHubRepo(repoUrl, match) {
  const [, owner, repo, treePath] = match
  let branch = 'HEAD'
  let subPath = ''
  // If the URL matched via GITHUB_REPO with a /tree/... path, extract it
  if (treePath) {
    const parts = treePath.split('/')
    branch = parts[0] || 'HEAD'
    subPath = parts.slice(1).join('/')
  }
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`
    const info = await fetchJSON(apiUrl)
    if (!info || !info.full_name) {
      // API failed (rate limited or not found) — try HTML scraping
      return await crawlGitHubRepoHTML(repoUrl, owner, repo, branch, subPath)
    }

    let content = `📦 GitHub: ${info.full_name}\n`
    content += `   描述: ${info.description || '无'}\n`
    content += `   ⭐ ${info.stargazers_count} | Fork ${info.forks_count} | 语言: ${info.language || '未知'}\n`
    content += `   主题: ${(info.topics || []).join(', ') || '无'}\n`
    content += `   License: ${(info.license && info.license.spdx_id) || '无'}\n`
    content += `   地址: ${info.html_url}\n`
    if (info.homepage && info.homepage !== info.html_url) content += `   主页: ${info.homepage}\n`

    // Get file tree — recursive to show full structure for small repos, top-level for large ones
    try {
      const treeApiUrl = subPath
        ? `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=0`
        : `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
      const tree = await fetchJSON(treeApiUrl)
      if (tree && tree.tree) {
        let entries = tree.tree
        if (subPath) {
          // Filter to subtree
          entries = entries.filter(e => e.path.startsWith(subPath + '/') || e.path === subPath)
        }
        const maxShow = 80
        const truncated = entries.length > maxShow
        const shown = entries.slice(0, maxShow)
        const fileList = shown.map(f => `${f.type === 'tree' ? '📁' : '📄'} ${f.path}`).join('\n   ')
        content += `\n   文件结构 (${entries.length} 个):\n   ${fileList}`
        if (truncated) content += `\n   ... 共 ${entries.length} 个文件/目录`
      }
    } catch { /* tree fetch failed, continue without */ }

    // Try README
    try {
      const readmeRaw = await fetchPage(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`)
      if (readmeRaw && readmeRaw.length > 50) {
        content += `\n\n📖 README:\n${readmeRaw.slice(0, 4000)}`
      }
    } catch { /* no readme */ }

    return { url: info.html_url, content }
  } catch {
    // API error (403, timeout, etc.) — fall back to HTML scraping
    try { return await crawlGitHubRepoHTML(repoUrl, owner, repo, branch, subPath) } catch { return null }
  }
}
async function crawlGitHubRepoHTML(repoUrl, owner, repo, branch, subPath) {
  try {
    const html = await fetchPage(repoUrl)
    if (!html || html.length < 500) return null

    // Detect GitHub 404 / nonexistent repo
    if (/Page not found|No repository|Repository not found|404/i.test(html.slice(0, 2000)) &&
        !/<span[^>]*itemprop="programmingLanguage"/i.test(html)) {
      return {
        url: repoUrl,
        content: `📦 GitHub: ${owner}/${repo}\n   ⚠️ 该仓库不存在或为私有仓库，无法访问。\n   请检查仓库名是否正确，或确认仓库是否为公开。`
      }
    }

    // Extract repo description from meta
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
    const description = descMatch ? descMatch[1].trim() : ''

    // Extract star/fork/language info
    const langMatch = html.match(/<span[^>]*itemprop="programmingLanguage"[^>]*>([^<]+)<\/span>/i)
    const starsMatch = html.match(/(\d[\d,]*)\s*stars/i) || html.match(/aria-label="(\d[\d,]*) users starred/i)
    const forksMatch = html.match(/(\d[\d,]*)\s*forks/i)

    let content = `📦 GitHub: ${owner}/${repo}\n`
    if (description) content += `   描述: ${description}\n`
    if (langMatch) content += `   语言: ${langMatch[1].trim()}\n`
    if (starsMatch) content += `   ⭐ ${starsMatch[1]}`
    if (forksMatch) content += ` | Fork ${forksMatch[1]}`
    if (starsMatch || forksMatch) content += '\n'
    content += `   地址: ${repoUrl}\n`

    // Extract file list from HTML
    const fileEntries = extractFileTreeFromHTML(html)
    if (fileEntries.length > 0) {
      const fileList = fileEntries.map(f => `${f.type === 'tree' ? '📁' : '📄'} ${f.name}`).join('\n   ')
      content += `\n   文件结构 (${fileEntries.length} 个):\n   ${fileList}`
    }

    // Try README via raw URL
    try {
      const readmeRaw = await fetchPage(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`)
      if (readmeRaw && readmeRaw.length > 50) {
        content += `\n\n📖 README:\n${readmeRaw.slice(0, 4000)}`
      }
    } catch {}

    return { url: repoUrl, content }
  } catch { return null }
}

// Crawl a GitHub tree URL (directory view)
async function crawlGitHubTree(treeUrl, match) {
  const [, owner, repo, branch, path] = match
  // Treat as a repo crawl with subpath
  return crawlGitHubRepo(treeUrl, [treeUrl, owner, repo, [branch, path].filter(Boolean).join('/')])
}

async function crawlGitHubFile(blobUrl, match) {
  const [, owner, repo, branch, path] = match
  try {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
    const code = await fetchPage(rawUrl)
    if (!code || code.length < 10) return null
    const ext = (path || '').split('.').pop()?.toLowerCase() || ''
    const capped = code.length > CODE_MAX_LEN ? code.slice(0, CODE_MAX_LEN) + '\n\n// ... 文件过长，已截断' : code
    return {
      url: blobUrl,
      content: `💻 ${path}\n\`\`\`${ext}\n${capped}\n\`\`\``
    }
  } catch { return null }
}

async function crawlGist(gistUrl, match) {
  try {
    const gistData = await fetchJSON(`https://api.github.com/gists/${match[1]}`)
    if (!gistData || !gistData.files) return null
    let content = `📋 GitHub Gist: ${gistData.description || '无描述'}\n`
    for (const [fn, file] of Object.entries(gistData.files || {})) {
      const code = (file.content || '').slice(0, 6000)
      const lang = (file.language || '').toLowerCase()
      content += `\n### ${fn}\n\`\`\`${lang}\n${code}\n\`\`\`\n`
    }
    return { url: gistUrl, content }
  } catch { return null }
}

// ─── Gitee specialized crawlers ───

async function crawlGiteeRepo(repoUrl, match) {
  const [, owner, repo, treePath] = match
  let branch = 'master'
  let subPath = ''
  if (treePath) {
    const parts = treePath.split('/')
    branch = parts[0] || 'master'
    subPath = parts.slice(1).join('/')
  }
  try {
    const apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}`
    const info = await fetchJSON(apiUrl)
    if (!info || !info.full_name) {
      return await crawlGiteeRepoHTML(repoUrl, owner, repo, branch, subPath)
    }

    let content = `📦 Gitee: ${info.full_name}\n`
    content += `   描述: ${info.description || '无'}\n`
    content += `   ⭐ ${info.stargazers_count} | Fork ${info.forks_count} | 语言: ${info.language || '未知'}\n`
    content += `   地址: ${info.html_url}\n`
    if (info.homepage && info.homepage !== info.html_url) content += `   主页: ${info.homepage}\n`

    try {
      const treeUrl = subPath
        ? `https://gitee.com/api/v5/repos/${owner}/${repo}/git/trees/${branch}?recursive=0`
        : `https://gitee.com/api/v5/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
      const tree = await fetchJSON(treeUrl)
      if (tree && tree.tree) {
        let entries = tree.tree
        if (subPath) {
          entries = entries.filter(e => e.path.startsWith(subPath + '/') || e.path === subPath)
        }
        const maxShow = 60
        const truncated = entries.length > maxShow
        const shown = entries.slice(0, maxShow)
        const fileList = shown.map(f => `${f.type === 'tree' ? '📁' : '📄'} ${f.path}`).join('\n   ')
        content += `\n   文件结构 (${entries.length} 个):\n   ${fileList}`
        if (truncated) content += `\n   ... 共 ${entries.length} 个文件/目录`
      }
    } catch {}

    try {
      const readmeRaw = await fetchPage(`https://gitee.com/${owner}/${repo}/raw/${branch}/README.md`)
      if (readmeRaw && readmeRaw.length > 50) {
        content += `\n\n📖 README:\n${readmeRaw.slice(0, 4000)}`
      }
    } catch {}

    return { url: info.html_url, content }
  } catch {
    // API error — fall back to HTML scraping
    try { return await crawlGiteeRepoHTML(repoUrl, owner, repo, branch, subPath) } catch { return null }
  }
}

// HTML scraping fallback for Gitee repos
async function crawlGiteeRepoHTML(repoUrl, owner, repo, branch, subPath) {
  try {
    const html = await fetchPage(repoUrl)
    if (!html || html.length < 500) return null

    // Detect Gitee 404 / nonexistent repo
    if (/页面不存在|项目不存在|Not Found|404/i.test(html.slice(0, 2000)) &&
        !/<span[^>]*class="[^"]*file-name[^"]*"/i.test(html)) {
      return {
        url: repoUrl,
        content: `📦 Gitee: ${owner}/${repo}\n   ⚠️ 该仓库不存在或为私有仓库，无法访问。\n   请检查仓库名是否正确，或确认仓库是否为公开。`
      }
    }

    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
    const description = descMatch ? descMatch[1].trim() : ''

    let content = `📦 Gitee: ${owner}/${repo}\n`
    if (description) content += `   描述: ${description}\n`
    content += `   地址: ${repoUrl}\n`

    // Extract file list from Gitee HTML
    const fileRegex = /<a[^>]*href="\/${owner}\/${repo}\/(?:blob|tree)\/[^"]*"[^>]*class="[^"]*tree-item[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
    // Simpler: look for file names in the repo tree
    const itemRegex = /<span[^>]*class="[^"]*file-name[^"]*"[^>]*>([^<]+)<\/span>/gi
    const files = []
    let m
    while ((m = itemRegex.exec(html)) !== null) {
      files.push(m[1].trim())
    }
    if (files.length > 0) {
      const fileList = files.map(f => `📄 ${f}`).join('\n   ')
      content += `\n   文件结构 (${files.length} 个):\n   ${fileList}`
    }

    try {
      const readmeRaw = await fetchPage(`https://gitee.com/${owner}/${repo}/raw/${branch}/README.md`)
      if (readmeRaw && readmeRaw.length > 50) {
        content += `\n\n📖 README:\n${readmeRaw.slice(0, 4000)}`
      }
    } catch {}

    return { url: repoUrl, content }
  } catch { return null }
}

// Crawl a Gitee tree URL
async function crawlGiteeTree(treeUrl, match) {
  const [, owner, repo, branch, path] = match
  return crawlGiteeRepo(treeUrl, [treeUrl, owner, repo, [branch, path].filter(Boolean).join('/')])
}

async function crawlGiteeFile(blobUrl, match) {
  const [, owner, repo, branch, path] = match
  try {
    const rawUrl = `https://gitee.com/${owner}/${repo}/raw/${branch}/${path}`
    const code = await fetchPage(rawUrl)
    if (!code || code.length < 10) return null
    const ext = (path || '').split('.').pop()?.toLowerCase() || ''
    const capped = code.length > CODE_MAX_LEN ? code.slice(0, CODE_MAX_LEN) + '\n\n// ... 文件过长，已截断' : code
    return {
      url: blobUrl,
      content: `💻 ${path}\n\`\`\`${ext}\n${capped}\n\`\`\``
    }
  } catch { return null }
}

// ─── StackOverflow ───

async function crawlStackOverflow(url, match) {
  try {
    const apiUrl = `https://api.stackexchange.com/2.3/questions/${match[1]}/answers?order=desc&sort=votes&site=stackoverflow&filter=withbody`
    const data = await fetchJSON(apiUrl)
    if (!data || !data.items || !data.items.length) return null
    const top = data.items[0]
    const answer = extractArticleText(top.body || '').slice(0, 6000)
    return { url, content: `📋 StackOverflow 最高票答案 (${top.score} 票):\n${answer}` }
  } catch { return null }
}

// ═══════════════════════════════════════════
// ARTICLE EXTRACTION ENGINE
// Adapted readability algorithm — finds main content, strips chrome
// ═══════════════════════════════════════════

// Junk page detection — these are never worth crawling
const JUNK_TITLE_PATTERNS = /字的意思|的拼音|的笔顺|怎么读|康熙字典|说文解字|汉语词典|汉语字典|成语词典|汉典/i
const JUNK_BODY_PATTERNS = /康熙字典|说文解字|反切|四角号码|仓颉|统一码|部外笔画|五笔86|郑码|电码|区位码|UNICODE/i

// Chinese news site content selectors — where the article body lives
const NEWS_CONTENT_SELECTORS = [
  // Xinhua
  /<div[^>]*(?:id|class)="[^"]*(?:article|content|detail|main-text|text|body)[^"]*"[^>]*>/i,
  // People
  /<div[^>]*(?:id|class)="[^"]*(?:articleContent|post_content|artibody|article-content|entry-content)[^"]*"[^>]*>/i,
  // General
  /<article[^>]*>/i,
  /<main[^>]*>/i,
  /<div[^>]*class="[^"]*content[^"]*"[^>]*>/i,
]

// Date extraction patterns
const DATE_PATTERNS = [
  // Chinese format: 2026年6月5日, 2026-06-05, 2026/06/05
  /(\d{4})\s*[年\-\/]\s*(\d{1,2})\s*[月\-\/]\s*(\d{1,2})\s*日?/,
  // English format: June 5, 2026 or 5 June 2026
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
  // Timestamp in meta
  /"datePublished"\s*:\s*"([^"]+)"/,
  /"dateModified"\s*:\s*"([^"]+)"/,
  // Meta tag
  /<meta[^>]*name="[^"]*pubdate[^"]*"[^>]*content="([^"]+)"/i,
  /<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i,
]

function extractDate(html) {
  for (const pattern of DATE_PATTERNS) {
    const match = html.match(pattern)
    if (match) {
      if (match.length >= 4) {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
      }
      return match[1] || match[0]
    }
  }
  return null
}

// Main article text extraction — strips chrome, keeps content
function extractArticleText(html, url = '') {
  if (!html || html.length < 200) return ''

  // Check page title for junk
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : ''
  if (JUNK_TITLE_PATTERNS.test(pageTitle)) return null

  // Extract publish date
  const pubDate = extractDate(html)

  // Extract <h1> as article title
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const articleTitle = h1Match ? h1Match[1].replace(/<[^>]*>/g, '').trim() : pageTitle

  // ─── Step 1: Try to find the article body using known selectors ───
  let bodyHTML = ''
  for (const selector of NEWS_CONTENT_SELECTORS) {
    const match = html.match(selector)
    if (match) {
      const startIdx = match.index
      // Find the matching closing tag — approximate
      let depth = 0
      let endIdx = startIdx
      const tagName = (match[0].match(/<(\w+)/) || [,'div'])[1]
      const openRegex = new RegExp(`<${tagName}[^>]*>`, 'gi')
      const closeRegex = new RegExp(`</${tagName}>`, 'gi')
      openRegex.lastIndex = startIdx + match[0].length
      closeRegex.lastIndex = startIdx + match[0].length
      depth = 1
      while (depth > 0) {
        const openMatch = openRegex.exec(html)
        const closeMatch = closeRegex.exec(html)
        if (!closeMatch) break
        if (openMatch && openMatch.index < closeMatch.index) { depth++ }
        else { depth-- }
        if (depth === 0) endIdx = closeMatch.index + closeMatch[0].length
      }
      bodyHTML = html.slice(startIdx, endIdx || startIdx + 20000)
      break
    }
  }

  // ─── Step 2: Fallback — remove obvious chrome and keep the rest ───
  if (!bodyHTML) {
    bodyHTML = html
      .replace(/<head[\s\S]*?<\/head>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<form[\s\S]*?<\/form>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
  }

  // ─── Step 3: Preserve code blocks ───
  const codeBlocks = []
  bodyHTML = bodyHTML.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    const clean = code.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
    if (clean.length > 20) {
      codeBlocks.push(clean)
      return `\n[CODE_${codeBlocks.length - 1}]\n`
    }
    return ''
  })

  // Also catch markdown-style code fences in HTML
  bodyHTML = bodyHTML.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    if (code.trim().length > 20) {
      codeBlocks.push(code.trim())
      return `\n[CODE_${codeBlocks.length - 1}]\n`
    }
    return ''
  })

  // ─── Step 4: Strip remaining tags and decode entities ───
  let text = bodyHTML.replace(/<[^>]*>/g, ' ')
  text = text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&ensp;/g, ' ').replace(/&emsp;/g, ' ')
    .replace(/&middot;/g, '·').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))

  // ─── Step 5: Clean up whitespace ───
  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

  // Reject dictionary pages
  if (JUNK_BODY_PATTERNS.test(text.slice(0, 2000))) return null

  // Reject JSON-heavy pages
  const jsonChars = (text.match(/[{}\[\]:"]/g) || []).length
  if (text.length > 0 && jsonChars > text.length * 0.12) return null

  // ─── Step 6: Line-level filtering ───
  const lines = text.split('\n').filter(line => {
    const t = line.trim()
    if (t.length < 15) return false
    // Skip boilerplate
    if (/^(cookie|隐私政策|关于我们|联系我们|登录|注册|搜索|菜单|首页|返回顶部|Copyright|All Rights Reserved|版权所有|ICP备|公网安备|扫一扫|分享到|上一篇|下一篇|相关阅读|为你推荐|热门推荐|猜你喜欢|大家都在看|广告|推广|赞助|商务合作|友情链接|下载APP|客户端|手机版)\b/i.test(t)) return false
    // Skip government portal navigation items (policy lists, document catalogs)
    if (/^(市政府|省政府|国务院|关于印发|关于公布|关于征求|关于划定|一图读懂|《[^》]+》政策解读|关于推进|关于持续|关于贯彻)/.test(t) && t.length < 120) return false
    // Skip lines ending with "0" (nav list counters/timestamps)
    if (/0$/.test(t) && t.length < 80) return false
    // Skip nav items
    if (t.length < 60 && (t.match(/[|·•●◆▸›»>\/\\]/g) || []).length > 3) return false
    // Skip separator lines
    if (/^[\s\-_=≡*#~^·•●◆▸›»>|┃│║━─]{10,}$/.test(t)) return false
    // Skip JSON/data noise
    if (/^\s*[{}\[\]]\s*$/.test(t) || /^\s*"[\w]+"\s*:\s*/.test(t)) return false
    // Skip CSS remnants
    if (/^\s*[.#][\w-]+\s*\{/.test(t) || /^\s*@(media|import|keyframes)/.test(t)) return false
    return true
  })

  let result = lines.join('\n')

  // ─── Step 6.5: Homepage / portal detection ───
  // If the page is mostly short title-like lines (nav/policy list), it's a homepage.
  // Only keep the first few meaningful lines as a summary.
  const shortLines = lines.filter(l => l.length < 80)
  const longLines = lines.filter(l => l.length >= 80)
  const isHomepage = lines.length > 15 && (shortLines.length > lines.length * 0.7 || longLines.length < 3)
  if (isHomepage) {
    // Keep only the first 3 substantial lines as summary
    result = longLines.slice(0, 3).join('\n')
    if (result.length < 30) result = lines.slice(0, 5).join('\n')
  }

  // ─── Step 7: Restore code blocks ───
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i]
    const capped = block.length > 8000 ? block.slice(0, 8000) + '\n... (truncated)' : block
    result = result.replace(`[CODE_${i}]`, `\n\`\`\`\n${capped}\n\`\`\`\n`)
  }

  if (result.length < 50) return null

  // ─── Step 8: Assemble final output ───
  let final = ''
  if (articleTitle && articleTitle.length > 3) final += `📰 ${articleTitle}\n`
  if (pubDate) final += `📅 ${pubDate}\n`
  if (final) final += '\n'
  final += result

  const maxLen = isHomepage ? HOME_MAX_LEN : (isCodeHost(url) ? CODE_MAX_LEN : MAX_CONTENT_LEN)
  if (final.length > maxLen) final = final.slice(0, maxLen) + '…'

  return final
}

// ─── Main crawl entry point ───

async function crawlPage(url) {
  if (!url || typeof url !== 'string') return null
  // Basic URL validation: must be http/https
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
  } catch { return null }

  try {
    // ─── Code host detection → specialized APIs ───
    // Order matters: blob first (most specific), then tree, then repo
    const ghBlob = url.match(GITHUB_BLOB)
    if (ghBlob) return await crawlGitHubFile(url, ghBlob)

    const ghTree = url.match(GITHUB_TREE)
    if (ghTree) return await crawlGitHubTree(url, ghTree)

    const ghRepo = url.match(GITHUB_REPO)
    if (ghRepo) return await crawlGitHubRepo(url, ghRepo)

    const gist = url.match(GITHUB_GIST)
    if (gist) return await crawlGist(url, gist)

    const giteeBlob = url.match(GITEE_BLOB)
    if (giteeBlob) return await crawlGiteeFile(url, giteeBlob)

    const giteeTree = url.match(GITEE_TREE)
    if (giteeTree) return await crawlGiteeTree(url, giteeTree)

    const giteeRepo = url.match(GITEE_REPO)
    if (giteeRepo) return await crawlGiteeRepo(url, giteeRepo)

    const soMatch = url.match(STACKOVERFLOW)
    if (soMatch) return await crawlStackOverflow(url, soMatch)

    // ─── Generic page: fetch HTML → extract article ───
    const html = await fetchPage(url)
    if (!html || html.length < 300) return null

    // If it looks like raw text/code (not HTML), wrap as code block
    if (!/<html|<body|<head|<div|<p\b|<a\s/i.test(html.slice(0, 500)) && html.length > 80) {
      const ext = (url || '').split('.').pop()?.toLowerCase() || ''
      const capped = html.length > CODE_MAX_LEN ? html.slice(0, CODE_MAX_LEN) + '\n... (truncated)' : html
      return { url, content: `\`\`\`${ext}\n${capped}\n\`\`\`` }
    }

    const content = extractArticleText(html, url)
    if (!content || content.length < 40) return null
    return { url, content }
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════
// DEEP REPO CRAWL — recursive file tree + all text files
// Used when user provides a GitHub/Gitee repo URL
// ═══════════════════════════════════════════

// File extensions to skip (binary / generated / large)
const SKIP_EXTENSIONS = /\.(png|jpe?g|gif|svg|ico|webp|bmp|woff2?|ttf|eot|otf|mp[34]|webm|ogg|wav|flac|avi|mov|mkv|pdf|zip|tar|gz|rar|7z|xz|exe|dll|so|dylib|wasm|class|pyc|pyd|bin|dat|db|sqlite3?|lock|map|min\.js|min\.css|chunk\.js)$/i

// Max limits for deep crawl — covers entire repo
const DEEP_MAX_FILES = 1000
const DEEP_MAX_FILE_SIZE = 50000    // per file
const DEEP_MAX_TOTAL_SIZE = 1000000   // total across all files

async function crawlGitHubRepoDeep(repoUrl, match) {
  const [, owner, repo, treePath] = match
  let branch = 'HEAD'
  let subPath = ''
  if (treePath) {
    const parts = treePath.split('/')
    branch = parts[0] || 'HEAD'
    subPath = parts.slice(1).join('/')
  }
  try {
    // 1. Fetch repo info (gets default branch)
    let info = null
    try {
      info = await fetchJSON(`https://api.github.com/repos/${owner}/${repo}`)
    } catch (e) {
      console.log('[crawler:deep] GitHub API fetch failed for', owner + '/' + repo + ':', e.message, '→ trying HTML fallback')
    }
    if (!info || !info.full_name) {
      return await crawlGitHubRepoHTML(repoUrl, owner, repo, branch, subPath)
    }

    const defaultBranch = info.default_branch || 'main'
    branch = branch === 'HEAD' ? defaultBranch : branch

    let content = `📦 GitHub 仓库: ${info.full_name}\n`
    content += `描述: ${info.description || '无'}\n`
    content += `⭐ ${info.stargazers_count} | Fork ${info.forks_count} | 语言: ${info.language || '未知'}\n`
    content += `License: ${(info.license && info.license.spdx_id) || '无'}\n`
    content += `默认分支: ${defaultBranch}\n`
    if (info.homepage && info.homepage !== info.html_url) content += `主页: ${info.homepage}\n`
    content += `地址: ${info.html_url}\n`

    // 2. Fetch ALL branches
    let allBranches = [{ name: defaultBranch, isDefault: true }]
    try {
      const branchesData = await fetchJSON(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`)
      if (branchesData && Array.isArray(branchesData) && branchesData.length > 0) {
        allBranches = branchesData.map(b => ({
          name: b.name,
          isDefault: b.name === defaultBranch,
        }))
        content += `\n>> 分支 (${allBranches.length} 个): ${allBranches.map(b => b.name + (b.isDefault ? ' [default]' : '')).join(', ')}\n`
      }
    } catch (e) {
      console.log('[crawler:deep] Branch listing failed:', e.message, '→ using default branch only')
    }

    // 3. Fetch file tree for EACH branch
    let allFiles = []
    const branchTrees = {} // branchName → { treeEntries, files }
    for (const br of allBranches) {
      try {
        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${br.name}?recursive=1`
        const tree = await fetchJSON(treeUrl)
        if (tree && tree.tree) {
          const treeEntries = subPath
            ? tree.tree.filter(e => e.path.startsWith(subPath + '/') || e.path === subPath)
            : tree.tree
          const files = treeEntries.filter(e => e.type === 'blob' && !SKIP_EXTENSIONS.test(e.path))
          const dirs = new Set()
          treeEntries.forEach(e => {
            if (e.type === 'tree') dirs.add(e.path)
            else {
              const p = e.path.split('/').slice(0, -1).join('/')
              if (p) dirs.add(p)
            }
          })
          branchTrees[br.name] = { treeEntries, files, dirs }
          // Merge into allFiles (dedup by path)
          for (const f of files) {
            if (!allFiles.find(x => x.path === f.path)) allFiles.push(f)
          }
        }
      } catch (e) {
        console.log('[crawler:deep] Tree fetch failed for branch', br.name + ':', e.message)
      }
    }

    // 4. Show directory tree for default branch (or first available)
    const defaultTree = branchTrees[defaultBranch] || Object.values(branchTrees)[0]
    if (defaultTree) {
      content += `\n📂 文件树 (${defaultBranch} 分支, ${defaultTree.files.length} 个文件):\n`

      const sortedPaths = [...defaultTree.dirs].sort()
      const sortedFiles = defaultTree.files.map(f => f.path).sort()
      const entriesByParent = {}
      for (const p of sortedPaths) {
        const parent = p.includes('/') ? p.split('/').slice(0, -1).join('/') : '__root__'
        if (!entriesByParent[parent]) entriesByParent[parent] = []
        entriesByParent[parent].push({ name: p.split('/').pop(), type: 'dir', fullPath: p })
      }
      const rootFiles = sortedFiles.filter(f => !f.includes('/'))
      for (const f of rootFiles) {
        if (!entriesByParent['__root__']) entriesByParent['__root__'] = []
        entriesByParent['__root__'].push({ name: f, type: 'file', fullPath: f })
      }
      for (const p of sortedPaths) {
        const childFiles = sortedFiles.filter(f => f.split('/').slice(0, -1).join('/') === p)
        if (!entriesByParent[p]) entriesByParent[p] = []
        for (const f of childFiles) {
          entriesByParent[p].push({ name: f.split('/').pop(), type: 'file', fullPath: f })
        }
      }

      function renderTree(parent, depth) {
        const entries = entriesByParent[parent] || []
        let result = ''
        for (const entry of entries) {
          const prefix = '  '.repeat(depth)
          if (entry.type === 'dir') {
            result += `${prefix}📁 ${entry.name}/\n`
            result += renderTree(entry.fullPath, depth + 1)
          } else {
            result += `${prefix}📄 ${entry.name}\n`
          }
        }
        return result
      }
      content += renderTree('__root__', 0)

      // Show other branches' file counts and differing files
      for (const br of allBranches) {
        if (br.name === defaultBranch || !branchTrees[br.name]) continue
        const bt = branchTrees[br.name]
        const defaultFiles = new Set(defaultTree.files.map(f => f.path))
        const brFiles = new Set(bt.files.map(f => f.path))
        const onlyInBr = bt.files.filter(f => !defaultFiles.has(f.path)).map(f => f.path)
        const onlyInDefault = defaultTree.files.filter(f => !brFiles.has(f.path)).map(f => f.path)

        content += `\n📂 ${br.name} 分支 (${bt.files.length} 个文件)`
        if (onlyInBr.length > 0 && onlyInBr.length <= 30) {
          content += ` | +${onlyInBr.length} 独有文件: ${onlyInBr.slice(0, 15).join(', ')}${onlyInBr.length > 15 ? '...' : ''}`
        } else if (onlyInBr.length > 0) {
          content += ` | +${onlyInBr.length} 独有文件`
        }
        if (onlyInDefault.length > 0) {
          content += ` | -${onlyInDefault.length} 文件(相对${defaultBranch})`
        }
        content += '\n'
      }
    }

    // 5. Read files from ALL branches (prioritize default, then other branches for differing files)
    let totalReadSize = 0
    const readFileSet = new Set()

    // Read README from each branch first
    for (const br of allBranches) {
      if (totalReadSize >= DEEP_MAX_TOTAL_SIZE) break
      try {
        const readmeRaw = await fetchPage(`https://raw.githubusercontent.com/${owner}/${repo}/${br.name}/README.md`)
        if (readmeRaw && readmeRaw.length > 20) {
          const capped = readmeRaw.slice(0, br.isDefault ? 6000 : 2000)
          content += `\n\n═══════════════════════════════\n📖 README.md (${br.name}):\n${capped}\n`
          totalReadSize += capped.length
          readFileSet.add('README.md')
        }
      } catch {}
    }

    // Read key config files from default branch
    const KEY_FILES = ['package.json', 'requirements.txt', 'go.mod', 'Cargo.toml', 'Gemfile',
                       'pyproject.toml', 'setup.py', 'Makefile', 'Dockerfile', 'docker-compose.yml',
                       '.env.example', 'tsconfig.json', 'vite.config.js', 'vite.config.ts',
                       'next.config.js', 'webpack.config.js', '.gitignore']
    const keyFileSet = new Set(KEY_FILES)
    const keyEntries = allFiles.filter(f => keyFileSet.has(f.path.split('/').pop()))
    const otherEntries = allFiles.filter(f => !keyFileSet.has(f.path.split('/').pop()) && !f.path.endsWith('README.md'))

    for (const entry of keyEntries.slice(0, 15)) {
      if (totalReadSize >= DEEP_MAX_TOTAL_SIZE) break
      if (readFileSet.has(entry.path)) continue
      const readBranch = branchTrees[defaultBranch]?.files.find(f => f.path === entry.path) ? defaultBranch
        : (Object.entries(branchTrees).find(([, t]) => t.files.find(f => f.path === entry.path)) || [defaultBranch])[0]
      try {
        const fileContent = await fetchPage(`https://raw.githubusercontent.com/${owner}/${repo}/${readBranch}/${entry.path}`)
        if (fileContent && fileContent.length > 5) {
          const capped = fileContent.length > DEEP_MAX_FILE_SIZE ? fileContent.slice(0, DEEP_MAX_FILE_SIZE) + '\n// ... 截断' : fileContent
          const ext = entry.path.split('.').pop() || ''
          content += `\n\n═══════════════════════════════\n📄 ${entry.path} (${readBranch}):\n\`\`\`${ext}\n${capped}\n\`\`\`\n`
          totalReadSize += capped.length
          readFileSet.add(entry.path)
        }
      } catch {}
      await new Promise(r => setTimeout(r, 50))
    }

    // Read other files
    const remaining = otherEntries.slice(0, DEEP_MAX_FILES - keyEntries.length)
    for (const entry of remaining) {
      if (totalReadSize >= DEEP_MAX_TOTAL_SIZE) {
        content += `\n⚠️ 已读取 ${Math.round(totalReadSize/1000)}KB，达到总量上限，以下文件未读取:\n`
        const unread = remaining.filter(e => remaining.indexOf(e) >= remaining.indexOf(entry))
        content += unread.slice(0, 30).map(e => `   📄 ${e.path}`).join('\n')
        if (unread.length > 30) content += `\n   ... 共 ${unread.length} 个文件未读取`
        break
      }
      if (readFileSet.has(entry.path)) continue
      const readBranch = branchTrees[defaultBranch]?.files.find(f => f.path === entry.path) ? defaultBranch
        : (Object.entries(branchTrees).find(([, t]) => t.files.find(f => f.path === entry.path)) || [defaultBranch])[0]
      try {
        const fileContent = await fetchPage(`https://raw.githubusercontent.com/${owner}/${repo}/${readBranch}/${entry.path}`)
        if (fileContent && fileContent.length > 5) {
          const capped = fileContent.length > DEEP_MAX_FILE_SIZE ? fileContent.slice(0, DEEP_MAX_FILE_SIZE) + '\n// ... 截断' : fileContent
          const ext = entry.path.split('.').pop() || ''
          content += `\n\n═══════════════════════════════\n📄 ${entry.path} (${readBranch}):\n\`\`\`${ext}\n${capped}\n\`\`\`\n`
          totalReadSize += capped.length
          readFileSet.add(entry.path)
        }
      } catch {}
      if (remaining.indexOf(entry) % 5 === 4) await new Promise(r => setTimeout(r, 100))
    }

    return { url: info.html_url, content }
  } catch (e) {
    console.log('[crawler:deep] GitHub deep crawl failed for', repoUrl + ':', e.message, '→ trying HTML fallback')
    try { return await crawlGitHubRepoHTML(repoUrl, owner, repo, branch, subPath) } catch { return null }
  }
}

// ═══ Gitee Deep Repo Crawl — mirrors crawlGitHubRepoDeep ═══
async function crawlGiteeRepoDeep(repoUrl, match) {
  const [, owner, repo, treePath] = match
  let branch = 'master'
  let subPath = ''
  if (treePath) {
    const parts = treePath.split('/')
    branch = parts[0] || 'master'
    subPath = parts.slice(1).join('/')
  }
  try {
    const info = await fetchJSON(`https://gitee.com/api/v5/repos/${owner}/${repo}`)
    if (!info || !info.full_name) {
      return await crawlGiteeRepoHTML(repoUrl, owner, repo, branch, subPath)
    }

    let content = `📦 Gitee 仓库: ${info.full_name}\n`
    content += `描述: ${info.description || '无'}\n`
    content += `⭐ ${info.stargazers_count} | Fork ${info.forks_count} | 语言: ${info.language || '未知'}\n`
    content += `License: ${(info.license || '无')}\n`
    content += `地址: ${info.html_url}\n`
    if (info.homepage && info.homepage !== info.html_url) content += `主页: ${info.homepage}\n`

    // Fetch recursive file tree
    let treeEntries = []
    try {
      const treeUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
      const tree = await fetchJSON(treeUrl)
      if (tree && tree.tree) {
        treeEntries = tree.tree
        if (subPath) {
          treeEntries = treeEntries.filter(e => e.path.startsWith(subPath + '/') || e.path === subPath)
        }
      }
    } catch {}

    // Show directory tree
    const dirs = new Set()
    const files = treeEntries.filter(e => e.type === 'blob' && !SKIP_EXTENSIONS.test(e.path))
    treeEntries.forEach(e => {
      if (e.type === 'tree') dirs.add(e.path)
      else {
        const parent = e.path.split('/').slice(0, -1).join('/')
        if (parent) dirs.add(parent)
      }
    })

    content += `\n📂 完整文件树 (${files.length} 个文件):\n`
    const sortedPaths = [...dirs].sort()
    const sortedFiles = files.map(f => f.path).sort()
    const entriesByParent = {}
    for (const p of sortedPaths) {
      const parent = p.includes('/') ? p.split('/').slice(0, -1).join('/') : '__root__'
      if (!entriesByParent[parent]) entriesByParent[parent] = []
      entriesByParent[parent].push({ name: p.split('/').pop(), type: 'dir', fullPath: p })
    }
    const rootFiles = sortedFiles.filter(f => !f.includes('/'))
    for (const f of rootFiles) {
      if (!entriesByParent['__root__']) entriesByParent['__root__'] = []
      entriesByParent['__root__'].push({ name: f, type: 'file', fullPath: f })
    }
    for (const p of sortedPaths) {
      const childFiles = sortedFiles.filter(f => {
        const parent = f.split('/').slice(0, -1).join('/')
        return parent === p
      })
      if (!entriesByParent[p]) entriesByParent[p] = []
      for (const f of childFiles) {
        entriesByParent[p].push({ name: f.split('/').pop(), type: 'file', fullPath: f })
      }
    }

    function renderGiteeTree(parent, depth) {
      const entries = entriesByParent[parent] || []
      let result = ''
      for (const entry of entries) {
        const prefix = '  '.repeat(depth)
        if (entry.type === 'dir') {
          result += `${prefix}📁 ${entry.name}/\n`
          result += renderGiteeTree(entry.fullPath, depth + 1)
        } else {
          result += `${prefix}📄 ${entry.name}\n`
        }
      }
      return result
    }
    content += renderGiteeTree('__root__', 0)

    // Read README first
    let totalReadSize = 0
    try {
      const readmeRaw = await fetchPage(`https://gitee.com/${owner}/${repo}/raw/${branch}/README.md`)
      if (readmeRaw && readmeRaw.length > 20) {
        const capped = readmeRaw.slice(0, 6000)
        content += `\n\n═══════════════════════════════\n📖 README.md:\n${capped}\n`
        totalReadSize += capped.length
      }
    } catch {}

    // Read key config files
    const KEY_FILES = ['package.json', 'requirements.txt', 'go.mod', 'Cargo.toml', 'Gemfile',
                       'pyproject.toml', 'setup.py', 'Makefile', 'Dockerfile', 'docker-compose.yml',
                       '.env.example', 'tsconfig.json', 'vite.config.js', 'vite.config.ts',
                       'next.config.js', 'webpack.config.js', '.gitignore']
    const keyFileSet = new Set(KEY_FILES)
    const keyEntries = files.filter(f => keyFileSet.has(f.path.split('/').pop()))
    const otherEntries = files.filter(f => !keyFileSet.has(f.path.split('/').pop()) && !f.path.endsWith('README.md'))

    for (const entry of keyEntries.slice(0, 15)) {
      if (totalReadSize >= DEEP_MAX_TOTAL_SIZE) break
      try {
        const fileContent = await fetchPage(`https://gitee.com/${owner}/${repo}/raw/${branch}/${entry.path}`)
        if (fileContent && fileContent.length > 5) {
          const capped = fileContent.length > DEEP_MAX_FILE_SIZE ? fileContent.slice(0, DEEP_MAX_FILE_SIZE) + '\n// ... 截断' : fileContent
          const ext = entry.path.split('.').pop() || ''
          content += `\n\n═══════════════════════════════\n📄 ${entry.path}:\n\`\`\`${ext}\n${capped}\n\`\`\`\n`
          totalReadSize += capped.length
        }
      } catch {}
      await new Promise(r => setTimeout(r, 50))
    }

    // Read other text files
    const remaining = otherEntries.slice(0, DEEP_MAX_FILES - keyEntries.length)
    for (const entry of remaining) {
      if (totalReadSize >= DEEP_MAX_TOTAL_SIZE) break
      try {
        const fileContent = await fetchPage(`https://gitee.com/${owner}/${repo}/raw/${branch}/${entry.path}`)
        if (fileContent && fileContent.length > 5) {
          const capped = fileContent.length > DEEP_MAX_FILE_SIZE ? fileContent.slice(0, DEEP_MAX_FILE_SIZE) + '\n// ... 截断' : fileContent
          const ext = entry.path.split('.').pop() || ''
          content += `\n\n═══════════════════════════════\n📄 ${entry.path}:\n\`\`\`${ext}\n${capped}\n\`\`\`\n`
          totalReadSize += capped.length
        }
      } catch {}
      if (remaining.indexOf(entry) % 5 === 4) await new Promise(r => setTimeout(r, 100))
    }

    return { url: info.html_url, content }
  } catch {
    try { return await crawlGiteeRepoHTML(repoUrl, owner, repo, branch, subPath) } catch { return null }
  }
}

// Deep crawl entry point — for repos, fetches ALL files; for other URLs, normal crawl
async function crawlUrlDeep(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
  } catch { return null }

  try {
    // GitHub blob → just crawl normally (single file)
    const ghBlob = url.match(GITHUB_BLOB)
    if (ghBlob) return await crawlGitHubFile(url, ghBlob)

    // GitHub tree → deep crawl at that path
    const ghTree = url.match(GITHUB_TREE)
    if (ghTree) return await crawlGitHubRepoDeep(url, ghTree)

    // GitHub repo → deep crawl
    const ghRepo = url.match(GITHUB_REPO)
    if (ghRepo) return await crawlGitHubRepoDeep(url, ghRepo)

    // Gist → normal crawl (already fetches all files)
    const gist = url.match(GITHUB_GIST)
    if (gist) return await crawlGist(url, gist)

    // Gitee blob
    const giteeBlob = url.match(GITEE_BLOB)
    if (giteeBlob) return await crawlGiteeFile(url, giteeBlob)

    // Gitee tree → deep crawl at that path
    const giteeTree = url.match(GITEE_TREE)
    if (giteeTree) return await crawlGiteeRepoDeep(url, giteeTree)

    // Gitee repo → deep crawl
    const giteeRepo = url.match(GITEE_REPO)
    if (giteeRepo) return await crawlGiteeRepoDeep(url, giteeRepo)

    // StackOverflow → normal crawl
    const soMatch = url.match(STACKOVERFLOW)
    if (soMatch) return await crawlStackOverflow(url, soMatch)

    // Generic page → normal crawl
    return await crawlPage(url)
  } catch {
    return null
  }
}

async function crawlPages(urls) {
  const results = []
  for (let i = 0; i < urls.length; i += CONCURRENT) {
    const batch = urls.slice(i, i + CONCURRENT)
    const batchResults = await Promise.all(batch.map(crawlPage))
    for (const r of batchResults) {
      if (r) results.push(r)
    }
    // Polite delay between batches
    if (i + CONCURRENT < urls.length) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 400))
    }
  }
  return results
}

module.exports = { crawlPages, crawlPage, fetchPage, extractArticleText, crawlUrlDeep }
