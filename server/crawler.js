// ═══════════════════════════════════════════
// Content Crawler — deep page extraction
// Fetches search result pages, extracts clean content
// Zero dependencies, Node.js built-ins only
// ═══════════════════════════════════════════

const https = require('https')
const http = require('http')
const { URL } = require('url')

const TIMEOUT = 10000
const MAX_REDIRECTS = 3
const MAX_CONTENT_LEN = 2000
const CONCURRENT = 3

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

function fetchPage(urlStr, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) return reject(new Error('Too many redirects'))
    const parsed = new URL(urlStr)
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.get(urlStr, { timeout: TIMEOUT, headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location
        if (loc) return fetchPage(loc.startsWith('http') ? loc : `${parsed.protocol}//${parsed.host}${loc}`, redirects + 1).then(resolve).catch(reject)
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

// Junk page indicators — pages dominated by these are not worth crawling
const JUNK_TITLE_PATTERNS = /字的意思|的拼音|的笔顺|怎么读|康熙字典|说文解字|汉语词典|汉语字典|成语词典|汉典|百度百科|百度知道|360百科|搜狗百科|求闻百科/i
const JUNK_BODY_PATTERNS = /康熙字典|说文解字|反切|四角号码|仓颉|统一码|部外笔画|五笔86|郑码|电码|区位码|UNICODE/i

// Extract clean text from HTML — strips boilerplate, keeps content
// Returns null if the page is a known junk/dictionary/baike page
function extractText(html) {
  // Quick pre-check: skip obvious junk pages before expensive processing
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const pageTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : ''
  if (JUNK_TITLE_PATTERNS.test(pageTitle)) return null

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')

  text = text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&ensp;/g, ' ').replace(/&emsp;/g, ' ').replace(/&middot;/g, '\u00b7')
    .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
    .replace(/&#(\d+)/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

  // Reject dictionary/encyclopedia pages based on body content
  if (JUNK_BODY_PATTERNS.test(text.slice(0, 2000))) return null

  // Reject pages that are mostly JavaScript/JSON noise
  const jsonNoise = (text.match(/[{}\[\]:"]/g) || []).length
  if (jsonNoise > text.length * 0.15) return null

  // Filter lines: keep only meaningful content
  const lines = text.split('\n').filter(line => {
    const t = line.trim()
    if (t.length < 20) return false
    // Skip nav/footer/copyright/boilerplate lines
    if (/^(cookie|隐私|关于|联系|登录|注册|搜索|菜单|首页|返回顶部|Copyright|All Rights|版权所有|ICP备|公网安备|扫码|分享到|上一篇|下一篇|相关阅读|为你推荐|热门推荐|猜你喜欢|大家都在看|广告|推广|赞助)\b/i.test(t)) return false
    // Skip lines that are mostly links/nav items
    if (t.length < 50 && (t.match(/[|·•●◆▸›»>\/\\]/g) || []).length > 4) return false
    // Skip pure symbol/separator lines
    if (/^[\s\-_=≡*#~^·•●◆▸›»>|┃│║━─]+$/.test(t)) return false
    // Skip JSON/JS snippet lines leaked into text
    if (/^\s*[{}\[\]]\s*$/.test(t) || /^\s*"[\w]+"\s*:\s*/.test(t)) return false
    return true
  })

  let result = lines.join('\n')
  // If after filtering we got almost nothing, the page is junk
  if (result.length < 60) return null
  if (result.length > MAX_CONTENT_LEN) result = result.slice(0, MAX_CONTENT_LEN) + '\u2026'
  return result
}

async function crawlPage(url) {
  try {
    const html = await fetchPage(url)
    const content = extractText(html)
    return content.length > 30 ? { url, content } : null
  } catch { return null }
}

async function crawlPages(urls) {
  const results = []
  for (let i = 0; i < urls.length; i += CONCURRENT) {
    const batch = await Promise.all(urls.slice(i, i + CONCURRENT).map(crawlPage))
    batch.filter(Boolean).forEach(r => results.push(r))
  }
  return results
}

module.exports = { crawlPages, crawlPage, fetchPage, extractText }
