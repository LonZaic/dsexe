// ═══════════════════════════════════════════
// Advanced Web Crawler — Dual-mode: search + deep crawl
// Content extraction based on Mozilla Readability algorithm:
//   - Scores DOM blocks by text-to-markup ratio
//   - Strips boilerplate (nav, footer, ads, cookie banners)
//   - Link-density based classification
//   - Sentence-level quality filtering
//   - Cross-page dedup
// Zero dependencies beyond Node.js built-ins
// ═══════════════════════════════════════════

const https = require('https')
const http = require('http')
const { URL } = require('url')

const TIMEOUT = 12000
const MAX_REDIRECTS = 3
const MAX_RESULTS = 5
const MAX_CONTENT_LEN = 2500
const CONCURRENT_REQUESTS = 4

// ─── User-Agent rotation ───
const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]
function randomUA() { return UA_LIST[Math.floor(Math.random() * UA_LIST.length)] }

// ═══════════════════════════════════════════
// Readability-style content scoring
// ═══════════════════════════════════════════

// Boilerplate class/id patterns (case-insensitive)
const BOILERPLATE_PATTERNS = [
  /(^|\s|-|_)(nav|menu|sidebar|footer|header|aside|widget|comment|ad|ads|advert|banner|cookie|popup|modal|overlay|social|share|related|recommend|trending|hot|popular|ranking|slide|carousel|pagination|breadcrumb|toolbar|toolbox|drawer|offcanvas)/i,
  /(^|\s|-|_)hidden/,
  /(^|\s|-|_)sr-only/,
  /(^|\s|-|_)visually-hidden/,
  /(^|\s|-|_)skip(-|_)to/,
]

// Useless content patterns — lines matching these are filtered
const NOISE_LINE_PATTERNS = [
  /^(cookie|隐私|关于我们|联系我们|登录|注册|搜索|菜单|首页|返回顶部|回到顶部|TOP|分享到|分享至|点赞|收藏|举报|反馈|投诉|建议|客服|帮助中心|用户协议|服务条款|隐私政策|版权声明|免责声明|网站地图|友情链接|合作伙伴|广告|赞助|推广|商务合作|加入我们|招聘|职位|应聘|投递|简历)$/i,
  /^(All Rights Reserved|Copyright|©|®|™|保留所有权利|版权所有|ICP备|公网安备|公安机关备案|网站标识码|政府网站标识码)/i,
  /^(上一篇|下一篇|上一篇：|下一篇：|上一条|下一条|相关阅读|相关文章|相关推荐|为你推荐|猜你喜欢|热门推荐|编辑推荐|最新评论|热门评论|全部评论|发表评论|写评论|条评论)/i,
  /^(阅读|阅读量|浏览|浏览量|点赞|在看|分享|转发|收藏|下载)：?\s*\d+/i,
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\s+\d{1,2}:\d{2}(:\d{2})?$/,
  /^(来源|作者|编辑|责任编辑|记者|摄影|通讯员|发布时间|发布日期|更新时间)：/i,
  /^(扫码|扫一扫|二维码|长按|识别|关注|加微信|加群|QQ群|微信群)/i,
  /^(【.*?】|\[.*?\]|「.*?」)$/,
  /^[|\s·•●◎○◆◇■□▲△▼▽★☆♥♡]+$/,
  /^(分享到|分享至)(微信|微博|QQ|朋友圈|豆瓣|人人|贴吧|知乎|抖音|快手|小红书)/i,
  /^(点击|Click|Tap)\s+(这里|此处|下方|上方|链接|按钮|here|below)/i,
  /^(展开|收起|全文|阅读全文|查看更多|加载更多|继续阅读|剩余|余下)/i,
  /^(数据来源|数据来源：|数据来源:)/i,
  /^\d{3,4}-\d{7,8}$/,  // Phone numbers
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,  // UUIDs
]

// HTML entity decoding map (expanded)
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&nbsp;': ' ', '&ensp;': ' ', '&emsp;': ' ', '&thinsp;': ' ',
  '&middot;': '\u00b7', '&mdash;': '\u2014', '&ndash;': '\u2013',
  '&lsquo;': '\u2018', '&rsquo;': '\u2019',
  '&ldquo;': '\u201c', '&rdquo;': '\u201d', '&hellip;': '\u2026',
  '&laquo;': '\u00ab', '&raquo;': '\u00bb',
  '&times;': '×', '&divide;': '÷', '&plusmn;': '±', '&le;': '≤', '&ge;': '≥',
  '&copy;': '©', '&reg;': '®', '&trade;': '™', '&deg;': '°',
  '&yen;': '¥', '&euro;': '€', '&pound;': '£',
}

function decodeEntities(text) {
  return text.replace(/&[#a-z0-9]+;/gi, m => ENTITIES[m] || m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

// ─── Fetch a URL ───
function fetchPage(urlStr, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) return reject(new Error('Too many redirects'))
    const parsed = new URL(urlStr)
    const mod = parsed.protocol === 'https:' ? https : http

    const req = mod.get(urlStr, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location
        if (loc) {
          const target = loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.host}${loc}`
          return fetchPage(target, redirects + 1).then(resolve).catch(reject)
        }
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve({ body, url: urlStr, contentType: res.headers['content-type'] || '' }))
      res.on('error', reject)
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}

// ═══════════════════════════════════════════
// Content Extraction Pipeline (Readability-style)
// ═══════════════════════════════════════════

// Step 1: Remove boilerplate HTML blocks by tag and class
function stripBoilerplateHTML(html) {
  let result = html
  // Remove entire elements that are never content
  result = result.replace(/<script[\s\S]*?<\/script>/gi, '')
  result = result.replace(/<style[\s\S]*?<\/style>/gi, '')
  result = result.replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
  result = result.replace(/<svg[\s\S]*?<\/svg>/gi, '')
  result = result.replace(/<form[\s\S]*?<\/form>/gi, '')
  result = result.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  result = result.replace(/<!--[\s\S]*?-->/g, '')
  result = result.replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
  result = result.replace(/<figure[\s\S]*?<\/figure>/gi, '')

  // Remove elements with boilerplate class/id — match opening to closing tag
  for (const pattern of BOILERPLATE_PATTERNS) {
    // Tag-level removal: <tag class="...nav...">...</tag>
    result = result.replace(new RegExp(`<([a-z]+)[^>]*(${pattern.source})[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi'), '')
    // Also handle self-closing
    result = result.replace(new RegExp(`<[a-z]+[^>]*(${pattern.source})[^>]*\\/>`, 'gi'), '')
  }

  // Remove known boilerplate tags
  result = result.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  result = result.replace(/<footer[\s\S]*?<\/footer>/gi, '')
  result = result.replace(/<header[\s\S]*?<\/header>/gi, '')
  result = result.replace(/<aside[\s\S]*?<\/aside>/gi, '')

  return result
}

// Step 2: Split HTML into block-level chunks and score each
function scoreBlocks(html) {
  // Split on block-level element boundaries
  const blocks = html.split(/(<[^>]+>)/g)
  const scored = []
  let currentText = ''
  let currentTags = 0

  for (const piece of blocks) {
    if (piece.startsWith('<')) {
      if (currentText.trim()) {
        scored.push({ text: currentText, tags: currentTags, score: 0 })
      }
      currentText = ''
      currentTags++
      continue
    }
    currentText += piece
  }
  if (currentText.trim()) {
    scored.push({ text: currentText, tags: currentTags, score: 0 })
  }

  // Score each block using Readability heuristic
  for (const block of scored) {
    const text = decodeEntities(block.text).replace(/<[^>]*>/g, '')
    const textLen = text.replace(/\s+/g, ' ').trim().length
    if (textLen < 20) {
      block.score = -1 // Too short — discard
      continue
    }

    // Count links in this block
    const linkCount = (block.text.match(/<a\s/gi) || []).length
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length
    const linkDensity = wordCount > 0 ? linkCount / wordCount : 0

    // Readability scoring formula:
    //   base = text_length (longer text = more likely content)
    //   penalty = link_density * weight (high link density = nav)
    //   bonus = heading proximity
    const baseScore = Math.min(textLen, 300) // Cap at 300
    const linkPenalty = linkCount > 0 ? linkDensity * 50 : 0 // High link density = bad
    const commaCount = (text.match(/[，,。.！!？?；;：:]/g) || []).length
    const sentenceBonus = Math.min(commaCount * 5, 40) // More punctuation = more sentences = content

    block.score = baseScore - linkPenalty + sentenceBonus
    block.linkDensity = linkDensity
    block.textLen = textLen
  }

  return scored.filter(b => b.score > 0).sort((a, b) => b.score - a.score)
}

// Step 3: Extract paragraphs from scored blocks and filter noise lines
function extractParagraphs(scoredBlocks, maxLen) {
  const paragraphs = []
  const seen = new Set()
  let totalLen = 0

  for (const block of scoredBlocks) {
    if (totalLen >= maxLen) break

    const text = decodeEntities(block.text).replace(/<[^>]*>/g, '')
    // Split into lines
    const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 10)

    for (const line of lines) {
      if (totalLen >= maxLen) break

      // Skip noise lines
      if (isNoiseLine(line)) continue

      // Dedup: skip near-duplicate content
      const dedupKey = line.slice(0, 40).replace(/\s+/g, '')
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)

      paragraphs.push(line)
      totalLen += line.length
    }
  }

  return paragraphs
}

function isNoiseLine(line) {
  // Too short
  if (line.length < 12) return true
  // Only numbers and punctuation
  if (/^[\d\s.,;:!?()（）【】\[\]\/\-+|]+$/.test(line)) return true
  // Match noise patterns
  for (const p of NOISE_LINE_PATTERNS) {
    if (p.test(line)) return true
  }
  // Link density: if >50% of words look like URLs
  const words = line.split(/\s+/)
  const urlWords = words.filter(w => /^https?:|^www\.|\.(com|cn|org|net|gov|html|htm)/i.test(w)).length
  if (urlWords > words.length * 0.5) return true
  // Just navigation items (short, many separators)
  if (line.length < 40 && (line.match(/[|·•●◆▸›»>\/]/g) || []).length > 3) return true
  return false
}

// ─── Main content extraction ───
function extractContent(html, url) {
  try {
    const clean = stripBoilerplateHTML(html)
    const blocks = scoreBlocks(clean)
    const paragraphs = extractParagraphs(blocks, MAX_CONTENT_LEN)

    let result = paragraphs.join('\n')

    // Cleanup whitespace
    result = result
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return result || '(页面内容无法提取)'
  } catch (e) {
    return '(提取失败: ' + e.message + ')'
  }
}

// ─── Extract title ───
function extractTitle(html, fallback) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (match) return decodeEntities(match[1].replace(/<[^>]*>/g, '').trim()) || fallback
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1) return decodeEntities(h1[1].replace(/<[^>]*>/g, '').trim()) || fallback
  return fallback
}

// ─── Fetch + parse single page ───
async function crawlPage(url) {
  try {
    const { body, url: finalUrl } = await fetchPage(url)
    const title = extractTitle(body, url)
    const content = extractContent(body, finalUrl)
    return { url: finalUrl, title, content }
  } catch (e) {
    return null
  }
}

// ─── Parallel crawl ───
async function crawlPages(urls) {
  const results = []
  const chunks = []
  for (let i = 0; i < urls.length; i += CONCURRENT_REQUESTS) {
    chunks.push(urls.slice(i, i + CONCURRENT_REQUESTS))
  }
  for (const chunk of chunks) {
    const batch = await Promise.all(chunk.map(url => crawlPage(url)))
    for (const r of batch) {
      if (r && r.content && r.content.length > 20) {
        results.push(r)
      }
    }
  }
  // Dedup across pages
  return dedupResults(results)
}

function dedupResults(results) {
  const seen = new Set()
  return results.filter(r => {
    const key = r.title.replace(/\s+/g, '').slice(0, 30)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ═══════════════════════════════════════════
// Bing Search
// ═══════════════════════════════════════════
const BING_URL = 'https://cn.bing.com/search'

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location
        if (loc) {
          const target = loc.startsWith('http') ? loc : `https://cn.bing.com${loc}`
          return fetchHTML(target).then(resolve).catch(reject)
        }
      }
      if (res.statusCode !== 200) return reject(new Error(`Bing HTTP ${res.statusCode}`))
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

function parseBingResults(html, limit) {
  const results = []
  const cleanHtml = html.replace(/<li class="b_ad"[\s\S]*?<\/li>/gi, '')
  const blocks = cleanHtml.split(/<li class="b_algo"/i)
  if (blocks.length < 2) return results

  for (let i = 1; i < blocks.length && results.length < limit; i++) {
    const block = blocks[i]
    if (/class="b_ad"/i.test(block)) continue

    const titleMatch = block.match(/<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/i)
    if (!titleMatch) continue
    const title = decodeEntities(titleMatch[1].replace(/<[^>]*>/g, ''))
    if (!title || title.length < 3) continue

    const urlMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/i)
    const url = urlMatch ? urlMatch[1] : ''

    let snippet = ''
    const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    if (pMatch) snippet = decodeEntities(pMatch[1].replace(/<[^>]*>/g, '')).slice(0, 300)

    if (title) results.push({ title, url, snippet })
  }
  return results
}

async function searchBing(query, maxResults = MAX_RESULTS) {
  const q = encodeURIComponent(query.trim())
  const url = `${BING_URL}?q=${q}&setlang=zh-cn`
  try {
    const html = await fetchHTML(url)
    return parseBingResults(html, Math.min(maxResults, 10))
  } catch (e) {
    return []
  }
}

// ═══════════════════════════════════════════
// Combined search + crawl
// ═══════════════════════════════════════════
async function searchAndCrawl(query, maxResults = MAX_RESULTS) {
  const bingResults = await searchBing(query, maxResults)
  const urls = bingResults.map(r => r.url).filter(Boolean)

  let crawledResults = []
  if (urls.length > 0) {
    crawledResults = await crawlPages(urls)
  }

  return { bing: bingResults, crawled: crawledResults }
}

// ─── Format for AI consumption ───
function formatCombinedResults(query, { bing, crawled }) {
  let output = ''
  const hasCrawled = crawled && crawled.length > 0

  output += `${'─'.repeat(40)}\n`
  output += `Search: "${query}"\n`
  if (bing.length === 0) output += '  (没有搜索到结果)\n'
  else bing.forEach((r, i) => {
    output += `  ${i + 1}. ${r.title}\n     URL: ${r.url}\n     ${r.snippet || '(无摘要)'}\n`
  })

  if (hasCrawled) {
    output += `\n深度爬取 (${crawled.length} pages):\n${'─'.repeat(40)}\n`
    crawled.forEach((r, i) => {
      output += `\n[${i + 1}] ${r.title}\n    URL: ${r.url}\n${r.content}\n`
    })
  }

  output += `${'─'.repeat(40)}\n`
  return output
}

module.exports = { searchAndCrawl, searchBing, crawlPages, crawlPage, formatCombinedResults }
