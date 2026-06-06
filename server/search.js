// Bing Search (cn.bing.com) — zero-dependency, works in China
// DuckDuckGo is blocked/times out in mainland China, Bing is accessible

const https = require('https')

const BING_URL = 'https://cn.bing.com/search'
const BING_INTL_URL = 'https://www.bing.com/search'
const TIMEOUT = 10000
const MAX_RETRIES = 2

/**
 * Search Bing and return structured results.
 * @param {string} query
 * @param {number} maxResults (default 5, max 10)
 * @param {'cn'|'intl'} source — 'cn' uses cn.bing.com (fast, good for Chinese), 'intl' uses www.bing.com (uncensored)
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
async function webSearch(query, maxResults = 5, source = 'cn') {
  if (!query || !query.trim()) return []

  const q = encodeURIComponent(query.trim())
  const baseUrl = source === 'intl' ? BING_INTL_URL : BING_URL
  const lang = source === 'intl' ? 'en' : 'zh-cn'
  const url = `${baseUrl}?q=${q}&setlang=${lang}`
  const limit = Math.min(maxResults || 5, 10)

  const headers = source === 'intl' ? {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  } : {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  }

  let lastError = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 500 * attempt))
    try {
      const html = await fetchHTML(url, headers)
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

function fetchHTML(url, customHeaders) {
  return new Promise((resolve, reject) => {
    const headers = customHeaders || {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
    const req = https.get(url, { timeout: TIMEOUT, headers }, (res) => {
      // Follow redirects (max 2)
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location
        if (loc) {
          const target = loc.startsWith('http') ? loc : `https://cn.bing.com${loc}`
          fetchHTML(target, customHeaders).then(resolve).catch(reject)
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

// ─── Query enhancement: detect poor results and retry ───
// ─── Junk site patterns ───
// These are sites that return dictionary/encyclopedia content but zero news/current-events value
const JUNK_PATTERNS = /baike|百科|简历|字典|词典|汉典|汉语查|汉语国学|汉辞|zdic|hanyu|字的意思|的拼音|的部首|的笔顺|怎么读|康熙字典|说文解字|cidian|zidian|qiuwenbaike|笔顺|部首|组词|详解|国学大师|汉程|阿凡题|作业帮|刷刷题|试题|答案|海角|吃瓜|haijiao|cashow|pouler|福利姬|写真|teletype|wudafu|hjsq/i

// Extended junk patterns for completely unrelated/spam results
const SPAM_DOMAIN_PATTERNS = /海角|吃瓜|haijiao|cashow|pouler|wudafu|hjsq|91sweat|91jav|sehuatang|1024|caoliu|sis001/i

function isPoorResults(results, query) {
  if (!results.length) return true

  // 0) Any spam/porn domain → immediate fail (100% contamination)
  const spamCount = results.filter(r =>
    SPAM_DOMAIN_PATTERNS.test(r.url + r.title + (r.snippet || ''))
  ).length
  if (spamCount > 0) return true

  // 1) Too many junk/dictionary results (>40% is already useless)
  const junkCount = results.filter(r =>
    JUNK_PATTERNS.test(r.title + (r.snippet || ''))
  ).length
  if (junkCount > results.length * 0.4) return true

  // 2) No result contains ANY word from the query — total mismatch
  const qWords = query.split(/\s+/).filter(w => w.length > 1)
  if (qWords.length > 0) {
    const matchingResults = results.filter(r =>
      qWords.some(w => (r.title + (r.snippet || '')).includes(w))
    )
    if (matchingResults.length === 0) return true
  }

  // 3) All titles look like single-character definitions (Bing tokenization failure)
  const singleCharTitles = results.filter(r =>
    /^[a-zûêôîâçëïüœùàéè]+\s*[（(]?汉语[)）]?/i.test(r.title) ||
    /^.\s*（汉语汉字）/.test(r.title) ||
    /^.\s*的意思/.test(r.title)
  ).length
  if (singleCharTitles === results.length) return true

  // 4) Query mentions 2+ key entities (proper nouns), but some are absent from ALL results
  //    This catches "semantic drift" — e.g. "特朗普...中国" → results about Trump but none mention China
  const KEY_ENTITIES = /特朗普|拜登|普京|泽连斯基|习近平|中国|美国|俄罗斯|乌克兰|日本|韩国|朝鲜|英国|法国|德国|印度|台湾|南海|欧盟|北约|联合国|世卫|WTO/i
  const allEntities = query.match(KEY_ENTITIES) || []
  if (allEntities.length >= 2) {
    const uniqEntities = [...new Set(allEntities)]
    const allText = results.map(r => r.title + ' ' + (r.snippet || '')).join(' ')
    const missing = uniqEntities.filter(e => !allText.includes(e))
    if (missing.length > 0 && missing.length >= uniqEntities.length * 0.4) return true
  }

  return false
}

// ─── Entity translation table for common international topics ───
const ENTITY_MAP = {
  '特朗普': 'Trump', '拜登': 'Biden', '普京': 'Putin',
  '习近平': 'Xi Jinping', '李克强': 'Li Keqiang', '王毅': 'Wang Yi',
  '中国': 'China', '美国': 'US', '俄罗斯': 'Russia', '乌克兰': 'Ukraine',
  '日本': 'Japan', '韩国': 'South Korea', '朝鲜': 'North Korea',
  '英国': 'UK', '法国': 'France', '德国': 'Germany', '印度': 'India',
  '访问': 'visit', '出访': 'visit', '到访': 'visit',
  '会谈': 'meeting', '峰会': 'summit', '制裁': 'sanctions',
  '台湾': 'Taiwan', '南海': 'South China Sea',
}

function generateAltQueries(query) {
  const alt = []
  const cleaned = query.replace(/\s+/g, ' ').trim()

  // ═══ Grammar patterns (ordered by specificity — first match wins) ═══

  // ─── Pattern 1: "X 来没来过/有没有去过/是否到过/来过没有 Y" ───
  const beenMatch = cleaned.match(/(.+?)\s*(来没来过|有没有去过|是否到过|有没有到过|最近有没有来|去没去过|来过没有|来过吗|来过么)\s*(.+)/)
  if (beenMatch) {
    const [, person, , place] = beenMatch
    alt.push(`${person} 访问 ${place}`)
    alt.push(`${person} 访${place.replace(/国$/, '')}`)
    alt.push(`${person} ${place} 访问`)
    alt.push(`${person} visit ${place}`)
    alt.push(`${person} ${place}`)
  }

  // ─── Pattern 2: "X 是否访问过/去过 Y" ───
  const visitQMatch = cleaned.match(/(.+?)\s*(是否访问过|是否去过)\s*(.+?)(\s*[吗么呢]?\s*$|\s*[?？]?\s*$)/)
  if (visitQMatch) {
    const [, person, , place] = visitQMatch
    alt.push(`${person} 访问 ${place}`)
    alt.push(`${person} ${place} visit`)
    alt.push(`${person} ${place}`)
  }

  // ─── Pattern 3: "X 访问/出访/到访 Y" ───
  const visitMatch = cleaned.match(/(.+?)\s*(访问|出访|到访)\s*(.+)/)
  if (visitMatch) {
    const [, person, , place] = visitMatch
    alt.push(`${person} 访${place}`)
    alt.push(`${person} ${place} 国事访问`)
    alt.push(`${person} ${place} visit`)
    alt.push(`${person} ${place} 最新`)
  }

  // ─── Pattern 4: "X 最近......" (general recent events about X) ───
  const recentMatch = cleaned.match(/(.+?)\s*(最近|近期|近来|最新).*/)
  if (recentMatch) {
    const entity = recentMatch[1].trim()
    if (entity.length >= 2 && entity.length <= 10) {
      alt.push(`${entity} 最新动态`)
      alt.push(`${entity} 2026年`)
    }
  }

  // ─── Pattern 5: Chinese query → try keyword extraction ───
  if (/[\u4e00-\u9fff]/.test(cleaned)) {
    alt.push(cleaned + ' 最新消息')

    // Remove common stop/question words to extract core keywords
    const stopWords = /[的地得了吗呢啊吧么哦最近有没有是不是可否是否来过什么怎样如何怎么哪里哪个啥时候什么时间]/g
    const keywords = cleaned.replace(stopWords, ' ').replace(/\s+/g, ' ').trim()
    if (keywords !== cleaned && keywords.length > 3) {
      alt.push(keywords)
    }

    // ─── English fallback: translate known entities ───
    let enQuery = cleaned
    let hasTranslation = false
    for (const [cn, en] of Object.entries(ENTITY_MAP)) {
      if (enQuery.includes(cn)) {
        enQuery = enQuery.replace(new RegExp(cn, 'g'), en)
        hasTranslation = true
      }
    }
    if (hasTranslation && enQuery !== cleaned) {
      // Clean up remaining Chinese chars that are stop words
      enQuery = enQuery.replace(/[\u4e00-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim()
      if (enQuery.length > 3) alt.push(enQuery)
    }

    alt.push(cleaned + ' 2026')
  }

  return [...new Set(alt.filter(a => a !== cleaned && a.length > 3))]
}

// ─── Smart multi-source search: cn.bing.com → intl bing.com → English translation ───
async function webSearchDual(query, maxResults = 5) {
  try {
    const { crawlPages } = require('./crawler')

    // Stage 1: cn.bing.com (fast, good for Chinese content)
    let bingResults = await webSearch(query, maxResults, 'cn')
    let usedSource = 'cn.bing.com'

    // Stage 2: If poor results, try international Bing with same query
    if (isPoorResults(bingResults, query)) {
      console.log('[search] cn.bing.com returned poor results, trying intl Bing with same query')
      const intlResults = await webSearch(query, maxResults, 'intl')
      if (!isPoorResults(intlResults, query)) {
        bingResults = intlResults
        usedSource = 'www.bing.com'
      } else {
        // Stage 3: Try alternative Chinese queries on international Bing
        const alts = generateAltQueries(query)
        for (const alt of alts) {
          console.log('[search] Trying alternative query on intl Bing:', alt)
          const altResults = await webSearch(alt, maxResults, 'intl')
          if (!isPoorResults(altResults, alt)) {
            bingResults = altResults
            usedSource = 'www.bing.com (alt query)'
            break
          }
          // Also try cn.bing.com with alt query as last resort
          const altCnResults = await webSearch(alt, maxResults, 'cn')
          if (!isPoorResults(altCnResults, alt)) {
            bingResults = altCnResults
            usedSource = 'cn.bing.com (alt query)'
            break
          }
        }
      }
    }

    const urls = bingResults.filter(r => !SPAM_DOMAIN_PATTERNS.test(r.url)).map(r => r.url).filter(Boolean)

    // Deep crawl in parallel (skip crawling if all results were junk)
    let crawledText = ''
    if (urls.length > 0) {
      const crawled = await crawlPages(urls)
      const validCrawled = crawled.filter(c => c && c.content && c.content.length > 30)
      if (validCrawled.length > 0) {
        crawledText = '\n\n深度内容:\n' + validCrawled.map(r =>
          `[来源: ${r.url}]\n${r.content}`
        ).join('\n\n')
      }
    }

    // Format results
    let text = `搜索 "${query}" (源: ${usedSource}):\n`
    if (bingResults.length === 0) text += '(无结果)\n'
    else bingResults.forEach((r, i) => {
      text += `${i + 1}. ${r.title}\n   ${r.snippet || ''}\n`
    })

    text += crawledText
    return text

  } catch (e) {
    console.warn('[search] Multi-source failed, fallback:', e.message)
    const results = await webSearch(query, maxResults, 'intl')
    return results.length ? formatSearchResults(results) : `No results for: ${query}`
  }
}

module.exports = { webSearch, webSearchDual, formatSearchResults }
