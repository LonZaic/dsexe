// Bing Search (cn.bing.com) — zero-dependency, works in China
// DuckDuckGo is blocked/times out in mainland China, Bing is accessible

const https = require('https')

const BING_URL = 'https://cn.bing.com/search'
const TIMEOUT = 10000
const MAX_RETRIES = 2

/**
 * Search Bing (China) and return structured results.
 * @param {string} query
 * @param {number} maxResults (default 5, max 10)
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
async function webSearch(query, maxResults = 5) {
  if (!query || !query.trim()) return []

  const q = encodeURIComponent(query.trim())
  const url = `${BING_URL}?q=${q}&setlang=zh-cn`
  const limit = Math.min(maxResults || 5, 10)

  let lastError = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 500 * attempt))
    try {
      const html = await fetchHTML(url)
      if (!html) continue
      const results = parseBingResults(html, limit)
      if (results.length > 0) return results
    } catch (e) {
      lastError = e
    }
  }
  if (lastError) console.error('[search] Bing search failed:', lastError.message)
  return []
}

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
    }, (res) => {
      // Follow redirects (max 2)
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location
        if (loc) {
          const target = loc.startsWith('http') ? loc : `https://cn.bing.com${loc}`
          fetchHTML(target).then(resolve).catch(reject)
          return
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
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

/**
 * Parse Bing HTML search results.
 * Bing's organic results are <li class="b_algo"> blocks.
 * Sponsored ads have class "b_ad" — we filter those out.
 */
function parseBingResults(html, limit) {
  const results = []

  // Remove sponsored/ad blocks first
  const cleanHtml = html.replace(/<li class="b_ad"[\s\S]*?<\/li>/gi, '')

  // Split by b_algo result blocks
  const blocks = cleanHtml.split(/<li class="b_algo"/i)
  if (blocks.length < 2) return results

  for (let i = 1; i < blocks.length && results.length < limit; i++) {
    const block = blocks[i]

    // Skip blocks that look like ads (contain b_ad or "Ad" markers)
    if (/class="b_ad"/i.test(block)) continue

    // Title: <h2>...<a href="...">Title</a></h2>
    const titleMatch = block.match(/<h2[^>]*><a[^>]*>([\s\S]*?)<\/a><\/h2>/i)
    if (!titleMatch) continue
    const title = cleanHTML(titleMatch[1])

    // Skip empty or suspicious titles
    if (!title || title.length < 3) continue

    // URL: extract real URL (Bing wraps in redirect, extract from href)
    const urlMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/i)
    const url = urlMatch ? urlMatch[1] : ''

    // Snippet: <p> tag content
    let snippet = ''
    const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    if (pMatch) snippet = cleanHTML(pMatch[1]).slice(0, 300)

    if (title) {
      results.push({ title, url, snippet })
    }
  }

  return results
}

function cleanHTML(str) {
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ensp;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&middot;/g, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatSearchResults(results) {
  if (!results || !results.length) return ''

  return results.map((r, i) => {
    const parts = [`${i + 1}. **${r.title}**`, `   URL: ${r.url}`]
    if (r.snippet) parts.push(`   ${r.snippet}`)
    return parts.join('\n')
  }).join('\n\n')
}

// ─── Dual-source: Bing + deep crawl in parallel ───
async function webSearchDual(query, maxResults = 5) {
  try {
    const { searchAndCrawl, formatCombinedResults } = require('./crawler')
    const combined = await searchAndCrawl(query, maxResults)
    return formatCombinedResults(query, combined)
  } catch (e) {
    // Fallback to Bing-only
    console.warn('[search] Dual search failed, fallback to Bing:', e.message)
    const results = await webSearch(query, maxResults)
    return formatSearchResults(results)
  }
}

module.exports = { webSearch, webSearchDual, formatSearchResults }
