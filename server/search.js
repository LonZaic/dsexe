// ═══════════════════════════════════════════════════════════
// Search Engine v2 — Maximum Accuracy Pipeline
//
// Pipeline: Query Enhancement → Multi-Engine Search →
//           Source Credibility Scoring → Cross-Validation →
//           Freshness Ranking → Deep Crawl → Final Output
//
// Engines: Bing Web + Bing News (cn + intl) + Sogou (cn backup)
// Zero external dependencies, Node.js built-ins only
// ═══════════════════════════════════════════════════════════

const https = require('https')

const BING_URL = 'https://cn.bing.com/search'
const BING_INTL_URL = 'https://www.bing.com/search'
const BING_NEWS_URL = 'https://cn.bing.com/news/search'
const BING_NEWS_INTL_URL = 'https://www.bing.com/news/search'
const SOGOU_URL = 'https://www.sogou.com/web'
const SOGOU_NEWS_URL = 'https://news.sogou.com/news'
// ─── Official Chinese news/political source domains ───
// For political/quasi-news queries, we directly search these authoritative sites
const OFFICIAL_SOURCES = [
  'xinhuanet.com',      // 新华网
  'people.com.cn',       // 人民网
  'cctv.com',            // 央视网
  'chinadaily.com.cn',   // 中国日报
  'fmprc.gov.cn',        // 外交部
  'gov.cn',              // 中国政府网
  'thepaper.cn',         // 澎湃新闻
]

const TIMEOUT = 10000
const MAX_RETRIES = 2

// ─── Source credibility database ───
// Tier 1 (score: 1.0): Official government, major news agencies
// Tier 2 (score: 0.9): Established news media
// Tier 3 (score: 0.7): Tech publications, reputable blogs
// Tier 4 (score: 0.5): General websites, forums
// Tier 5 (score: 0.2): Low credibility, spam-prone
// Tier 0 (score: 0.0): Blocked outright

const CREDIBILITY_TIER1 = /xinhuanet\.com|gov\.cn|people\.com\.cn|cctv\.com|chinadaily\.com\.cn|fmprc\.gov\.cn|mfa\.gov\.cn|mod\.gov\.cn|ndrc\.gov\.cn|reuters\.com|apnews\.com|bbc\.com|bbc\.co\.uk/i
const CREDIBILITY_TIER2 = /sina\.com\.cn|qq\.com|sohu\.com|163\.com|ifeng\.com|thepaper\.cn|guancha\.cn|caixin\.com|yicai\.com|ce\.cn|china\.org\.cn|cnn\.com|nytimes\.com|wsj\.com|washingtonpost\.com|bloomberg\.com|ft\.com|aljazeera\.com|dw\.com|france24\.com/i
const CREDIBILITY_TIER3 = /zhihu\.com|jianshu\.com|csdn\.net|juejin\.cn|segmentfault\.com|cnblogs\.com|36kr\.com|geekpark\.net|pingwest\.com|techcrunch\.com|theverge\.com|arstechnica\.com|wired\.com|medium\.com|github\.com|stackoverflow\.com|reddit\.com|wikipedia\.org/i
// NOTE: Removed 菜鸟 (runoob.com is a legitimate tutorial site), 个人博客 (blocks too many tech blogs)
const CREDIBILITY_TIER5 = /haijiao|吃瓜|cashow|pouler|wudafu|hjsq|91sweat|91jav|sehuatang|1024|caoliu|sis001|teletype|blogspot|wordpress\.com.*\/\d{4}/i

// Junk/Dictionary patterns — blocked entirely
// NOTE: Removed overly broad terms (baike, 百科, 详解, 组词, 答案) that were blocking legitimate sources like Baidu Baike, Wikipedia
const JUNK_PATTERNS = /简历.*模板|字典|词典|汉典|汉语查|汉语国学|汉辞|zdic|hanyu|字的意思|的拼音|的部首|的笔顺|怎么读|康熙字典|说文解字|cidian|zidian|qiuwenbaike|笔顺|部首|国学大师|汉程|阿凡题|作业帮|刷刷题|试题答案/i

// Spam/Porn patterns — immediate block
const SPAM_DOMAIN_PATTERNS = /海角|吃瓜|haijiao|cashow|pouler|wudafu|hjsq|91sweat|91jav|sehuatang|1024|caoliu|sis001/i

function scoreSourceCredibility(url, title, snippet) {
  const combined = url + ' ' + title + ' ' + (snippet || '')

  // Tier 0: Blocked outright
  if (SPAM_DOMAIN_PATTERNS.test(combined)) return 0
  if (JUNK_PATTERNS.test(combined)) return 0

  // Tier 1: Official sources
  if (CREDIBILITY_TIER1.test(combined)) return 1.0

  // Tier 2: Established media
  if (CREDIBILITY_TIER2.test(combined)) return 0.9

  // Tier 3: Tech/community
  if (CREDIBILITY_TIER3.test(combined)) return 0.7

  // Tier 5: Low credibility (check before default)
  if (CREDIBILITY_TIER5.test(combined)) return 0.2

  // Tier 4: Default
  return 0.5
}

// ─── Entity categories for query type detection ───
// When ANY of these entities appear in a query → treat as time-sensitive news query

// Chinese leadership & political figures
const CN_LEADERS = /习近平|李克强|李强|王毅|蔡奇|丁薛祥|赵乐际|王沪宁|李希|韩正|刘国中|张国清|何立峰|秦刚|杨洁篪|王岐山|胡春华|刘鹤|孙春兰|黄坤明/i

// World leaders (Chinese + English names) — G20 + regional powers
const WORLD_LEADERS_CN = /特朗普|拜登|普京|泽连斯基|金正恩|李在明|尹锡悦|岸田文雄|石破茂|莫迪|朔尔茨|马克龙|斯塔默|特鲁多|马科斯|佐科|普拉博沃|武文赏|苏林|通伦|洪马内|他信|佩通坦|梅洛尼|桑切斯|米莱|卢拉|埃尔多安|莱希|哈梅内伊|内塔尼亚胡|阿巴斯|穆罕默德王储|萨勒曼/i
const WORLD_LEADERS_EN = /\bTrump\b|\bBiden\b|\bPutin\b|\bZelenskyy?\b|\bKim Jong[-\s]?Un\b|\bLee Jae[-\s]?myung\b|\bYoon\b|\bKishida\b|\bIshiba\b|\bModi\b|\bScholz\b|\bMacron\b|\bStarmer\b|\bTrudeau\b|\bMarcos\b|\bWidodo\b|\bPrabowo\b|\bThongloun\b|\bHun Manet\b|\bMeloni\b|\bSanchez\b|\bMilei\b|\bLula\b|\bErdogan\b|\bNetanyahu\b|\bXi Jinping\b|\bWang Yi\b|\bLi Qiang\b/i

// Countries & regions — major geopolitical actors
const MAJOR_COUNTRIES = /中国|美国|俄罗斯|乌克兰|日本|韩国|朝鲜|英国|法国|德国|印度|加拿大|澳大利亚|巴西|土耳其|伊朗|以色列|巴勒斯坦|沙特|阿联酋|卡塔尔|埃及|南非|尼日利亚|埃塞俄比亚|墨西哥|阿根廷|智利|哥伦比亚|秘鲁|印尼|越南|泰国|缅甸|柬埔寨|老挝|菲律宾|马来西亚|新加坡|巴基斯坦|孟加拉|斯里兰卡|哈萨克斯坦|乌兹别克斯坦|蒙古/i
const MAJOR_COUNTRIES_EN = /\bChina\b|\bUS\b|\bUSA?\b|\bUnited States\b|\bRussia\b|\bUkraine\b|\bJapan\b|\bKorea\b|\bDPRK\b|\bNorth Korea\b|\bSouth Korea\b|\bUK\b|\bBritain\b|\bFrance\b|\bGermany\b|\bIndia\b|\bCanada\b|\bAustralia\b|\bBrazil\b|\bTurkey\b|\bIran\b|\bIsrael\b|\bPalestine\b|\bSaudi\b|\bUAE\b|\bQatar\b|\bEgypt\b|\bSouth Africa\b|\bMexico\b|\bArgentina\b|\bIndonesia\b|\bVietnam\b|\bThailand\b|\bMyanmar\b|\bPhilippines\b|\bSingapore\b|\bPakistan\b/i

// International organizations
const INT_ORGS = /联合国|安理会|世卫|WTO|IMF|世界银行|欧盟|北约|东盟|非盟|G20|G7|上合组织|金砖|OPEC|国际原子能|国际刑警|UNESCO|UNICEF/i
const INT_ORGS_EN = /\bUN\b|\bWHO\b|\bWTO\b|\bIMF\b|\bWorld Bank\b|\bEU\b|\bEuropean Union\b|\bNATO\b|\bASEAN\b|\bAfrican Union\b|\bG20\b|\bG7\b|\bBRICS\b|\bOPEC\b|\bIAEA\b|\bINTERPOL\b|\bUNESCO\b/i

// Geopolitical hotspots — territory, conflicts, disputes
const GEO_HOTSPOTS = /台湾|南海|东海|钓鱼岛|藏南|阿克赛钦|克什米尔|加沙|约旦河西岸|戈兰高地|克里米亚|顿巴斯|库尔斯克|台海|两岸|统一|独立|主权|领土|冲突|战争|停火|制裁|军演|航母|导弹|核武器|核试验/i
const GEO_HOTSPOTS_EN = /\bTaiwan\b|\bSouth China Sea\b|\bEast China Sea\b|\bKashmir\b|\bGaza\b|\bWest Bank\b|\bCrimea\b|\bDonbas\b|\bKursk\b|\bsovereignty\b|\bterritory\b|\bconflict\b|\bwar\b|\bceasefire\b|\bsanctions?\b|\bmilitary drill\b|\baircraft carrier\b|\bnuclear\b|\bmissile\b/i

// Economic/financial sensitive terms
const ECON_SENSITIVE = /关税|贸易战|制裁|脱钩|去风险|芯片|半导体|稀土|能源|石油|天然气|粮食|供应链|汇率|人民币|美元|加息|降息|通胀|衰退|金融危机|债务|违约|股市|A股|美股|港股/i

// Major events & disasters
const MAJOR_EVENTS = /地震|台风|洪水|海啸|火山|空难|坠机|爆炸|火灾|疫情|病毒|疫苗|核泄漏|辐射|暗杀|恐袭|政变|暴乱|戒严|紧急状态/i

// Combined: ALL entities that make a query time-sensitive
const ALL_TEMPORAL_ENTITIES = new RegExp(
  [CN_LEADERS, WORLD_LEADERS_CN, WORLD_LEADERS_EN,
   MAJOR_COUNTRIES, MAJOR_COUNTRIES_EN,
   INT_ORGS, INT_ORGS_EN,
   GEO_HOTSPOTS, GEO_HOTSPOTS_EN,
   ECON_SENSITIVE, MAJOR_EVENTS]
    .map(r => r.source).join('|'),
  'i'
)

// ─── Domain-specific classification ───
const MOVIE_INDICATORS = /电影|影片|上映|票房|导演|主演|演员|片名|档期|院线|预告片|剧情|片尾|彩蛋|电影院|猫眼|豆瓣|IMDB|评分|影评|纪录片|动画片|故事片|短片|微电影|潮汕|粤语|闽南|客家|方言.*电影|电影.*方言/i
const CODE_INDICATORS = /github|gitee|gitlab|仓库|开源|代码|repo|npm|pip|install|import|require|插件|组件|库|框架|sdk|api文档|源码/i
const PERSON_INDICATORS = /是谁|什么人|简介|生平|个人资料|简历|经历|背景|出生|毕业于|学历|籍贯|配偶|子女|父母|多大了|几岁|年龄|身高|体重/i

// ─── Query type detection ───
const NEWS_INDICATORS = /最新|今天|刚刚|昨天|本周|本月|今年|最近|近期|现在|当前|目前|今日|昨|今|刚|突发|快讯|新闻|宣布|公布|发布|声明|表示|称|报道|消息|进展|动态|情况|现状|局势|today|yesterday|just now|breaking|latest|recent|news|update|announced|reported|confirmed|statement|will visit|to visit|state visit|official visit/i
const FACTUAL_PATTERNS = /多少|多大|几岁|哪年|什么时候|什么时间|是否|有没有|会不会|能不能|可以吗|对吗|是吗|真的|假的|是谁|是什么|在哪里|怎么|如何|为什么/i

function detectQueryType(query) {
  const hasNewsIndicator = NEWS_INDICATORS.test(query)
  const hasTemporalEntity = ALL_TEMPORAL_ENTITIES.test(query)
  const isMovie = MOVIE_INDICATORS.test(query)
  const isCode = CODE_INDICATORS.test(query)
  const isPerson = PERSON_INDICATORS.test(query)
  const isFactual = FACTUAL_PATTERNS.test(query)
  const hasChinese = /[\u4e00-\u9fff]/.test(query)

  if (isMovie) return 'movie'
  if (isCode) return 'code'
  if (hasNewsIndicator && hasTemporalEntity) return 'breaking_news'
  if (hasNewsIndicator || hasTemporalEntity) return 'news'
  if (isPerson) return 'person'
  if (isFactual) return 'factual'
  if (hasChinese) return 'chinese_general'
  return 'general'
}

// ─── Query Relaxation — industry-standard approach for poor results ───
// Instead of guessing which character is "wrong", progressively relax the query
// by removing specific terms while keeping core keywords + context hints
function generateRelaxedQueries(query, queryType) {
  const alts = []
  const cleaned = query.replace(/\s+/g, ' ').trim()

  // Split into segments: named entities vs descriptive terms
  // Named entity patterns: 2-4 char proper names, quoted strings
  // Descriptive terms: genre words, time words, locations
  const DESCRIPTORS = /电影|影片|上映|最近|今天|昨天|今年|202[0-9]|导演|主演|演员|评分|票房|代码|仓库|开源|github|gitee|网站|官网|官方|新闻|最新|报道|消息|访问|出访|国事|会见|会谈/i

  // Strategy 1: Drop the most specific term (likely the name), keep descriptors
  const words = cleaned.split(/\s+/).filter(w => w.length >= 2)
  const descriptors = words.filter(w => DESCRIPTORS.test(w))
  const specifics = words.filter(w => !DESCRIPTORS.test(w))

  // Try: only descriptors (e.g. "电影 潮汕")
  if (descriptors.length > 0 && specifics.length > 0) {
    alts.push(descriptors.join(' '))
  }
  // Try: specifics + broader context word (e.g. for movie: "情书 电影")
  if (specifics.length > 0) {
    if (queryType === 'movie') alts.push(specifics.join(' ') + ' 电影')
    if (queryType === 'code') alts.push(specifics.join(' ') + ' github')
    if (queryType === 'person') alts.push(specifics.join(' ') + ' 简介')
    if (queryType === 'news' || queryType === 'breaking_news') alts.push(specifics.join(' ') + ' 最新')
  }
  // Try: only the first specific term (shortest unique identifier)
  if (specifics.length >= 2) {
    alts.push(specifics[0])
  }
  // Try: add current year for temporal queries
  if (queryType === 'news' || queryType === 'breaking_news') {
    alts.push(cleaned + ' ' + new Date().getFullYear())
  }
  // Fallback: the cleaned query as-is (search engines may have their own correction)
  alts.push(cleaned)

  return [...new Set(alts.filter(a => a.length > 1 && a !== cleaned))]
}

// ─── Time context injection ───
// NOTE: Date suffixes hurt search quality — Bing matches old bio/archive pages.
// Freshness is handled by scoreFreshness() + crossValidateResults() post-processing.
function getTimeContext(queryType, query) {
  const year = new Date().getFullYear()
  switch (queryType) {
    case 'breaking_news':
      return { prefix: '', suffix: '', newsMode: true }
    case 'news':
      return { prefix: '', suffix: '', newsMode: true }
    case 'factual':
      return { prefix: '', suffix: ` ${year}`, newsMode: false }
    default:
      return { prefix: '', suffix: '', newsMode: false }
  }
}

// ─── Entity translation table (Chinese → English for query alternative generation) ───
const ENTITY_MAP = {
  // Leaders
  '习近平': 'Xi Jinping', '李克强': 'Li Qiang', '李强': 'Li Qiang', '王毅': 'Wang Yi',
  '特朗普': 'Trump', '拜登': 'Biden', '普京': 'Putin', '泽连斯基': 'Zelensky',
  '金正恩': 'Kim Jong Un', '李在明': 'Lee Jae-myung', '尹锡悦': 'Yoon Suk Yeol',
  '岸田文雄': 'Kishida', '石破茂': 'Ishiba', '莫迪': 'Modi',
  '朔尔茨': 'Scholz', '马克龙': 'Macron', '斯塔默': 'Starmer',
  '特鲁多': 'Trudeau', '马科斯': 'Marcos', '通伦': 'Thongloun',
  '梅洛尼': 'Meloni', '内塔尼亚胡': 'Netanyahu',
  // Countries
  '中国': 'China', '美国': 'US', '俄罗斯': 'Russia', '乌克兰': 'Ukraine',
  '日本': 'Japan', '韩国': 'South Korea', '朝鲜': 'North Korea',
  '英国': 'UK', '法国': 'France', '德国': 'Germany', '印度': 'India',
  '加拿大': 'Canada', '澳大利亚': 'Australia', '巴西': 'Brazil',
  '土耳其': 'Turkey', '伊朗': 'Iran', '以色列': 'Israel',
  '越南': 'Vietnam', '泰国': 'Thailand', '缅甸': 'Myanmar',
  '菲律宾': 'Philippines', '马来西亚': 'Malaysia', '新加坡': 'Singapore',
  '印尼': 'Indonesia', '巴基斯坦': 'Pakistan',
  '老挝': 'Laos', '柬埔寨': 'Cambodia',
  // Actions / Events
  '访问': 'visit', '出访': 'visit', '国事访问': 'state visit',
  '会谈': 'meeting', '峰会': 'summit', '会晤': 'meeting',
  '制裁': 'sanctions', '关税': 'tariffs', '贸易战': 'trade war',
  '军演': 'military drill', '演习': 'exercise',
  '发射': 'launch', '导弹': 'missile',
  // Geopolitical
  '台湾': 'Taiwan', '台海': 'Taiwan Strait', '两岸': 'cross-strait',
  '南海': 'South China Sea', '东海': 'East China Sea',
  '加沙': 'Gaza', '停火': 'ceasefire',
  // Orgs
  '联合国': 'UN', '欧盟': 'EU', '北约': 'NATO', '东盟': 'ASEAN',
}

// ─── HTTP fetch helper ───
function fetchHTML(url, customHeaders) {
  return new Promise((resolve, reject) => {
    const headers = customHeaders || {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
    const req = https.get(url, { timeout: TIMEOUT, headers }, (res) => {
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

// ─── Bing Web Search ───
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

// ─── Bing News Search (best-effort: falls back to web search if parsing fails) ───
async function bingNewsSearch(query, maxResults = 5, source = 'cn') {
  if (!query || !query.trim()) return []

  const q = encodeURIComponent(query.trim())
  // Bing News URL: try multiple formats
  const urls = source === 'intl'
    ? [`https://www.bing.com/news/search?q=${q}&qft=interval%3d%227%22&form=YFNR`]
    : [`https://cn.bing.com/news/search?q=${q}&qft=interval%3d%227%22&form=YFNR`,
       `https://www.bing.com/news/search?q=${q}&qft=interval%3d%227%22&setlang=zh-cn`]

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': source === 'intl' ? 'en-US,en;q=0.9' : 'zh-CN,zh;q=0.9,en;q=0.8',
  }

  for (const url of urls) {
    for (let attempt = 0; attempt <= 1; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 500))
      try {
        const html = await fetchHTML(url, headers)
        if (!html || html.length < 2000) continue
        // Try parsing as news, fall back to generic parsing
        const results = parseBingNews(html, maxResults) || parseBingResults(html, maxResults)
        if (results.length > 0) return results
      } catch (e) { /* continue to next url/attempt */ }
    }
  }

  // Final fallback: use web search with recency bias
  const recencyBias = /[\u4e00-\u9fff]/.test(query) ? ' 最新' : ''
  const webResults = await webSearch(query + recencyBias, maxResults, source)
  return webResults
}



// ─── Sogou Web Search (cn backup — good Chinese coverage, works in China) ───
async function sogouSearch(query, maxResults = 5) {
  if (!query || !query.trim()) return []
  const q = encodeURIComponent(query.trim())
  const url = `${SOGOU_URL}?query=${q}`
  const limit = Math.min(maxResults || 5, 10)

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 600 * attempt))
    try {
      const html = await fetchHTML(url, headers)
      if (!html || html.length < 1000) continue
      const results = parseSogouResults(html, limit)
      if (results.length > 0) return results
    } catch (e) { /* retry */ }
  }
  return []
}

function parseSogouResults(html, limit) {
  const results = []
  // Sogou result blocks: <div class="vrwrap"> or <div class="rb">
  const blocks = html.split(/<div[^>]*class="[^"]*(?:vrwrap|rb|result)[^"]*"[^>]*>/i)
  if (blocks.length < 2) {
    // Fallback: find all result-like divs
    const altBlocks = html.match(/<div[^>]*class="[^"]*vrwrap[^"]*"[^>]*>[\s\S]*?(?=<div[^>]*class="[^"]*vrwrap|$)/gi)
    if (altBlocks) {
      for (const block of altBlocks) {
        if (results.length >= limit) break
        const titleMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>(?:<[^>]*>)*([\s\S]*?)(?:<\/a>)/i)
        if (!titleMatch) continue
        const url = titleMatch[1]
        const title = cleanHTML(titleMatch[2])
        if (!title || title.length < 4 || url.includes('sogou.com')) continue
        let snippet = ''
        const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
        if (pMatch) snippet = cleanHTML(pMatch[1]).slice(0, 300)
        if (!results.find(r => r.url === url)) {
          results.push({ title, url, snippet, isNews: false, source: 'sogou' })
        }
      }
      return results
    }
    return results
  }

  for (let i = 1; i < blocks.length && results.length < limit; i++) {
    const block = blocks[i]
    const titleMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>(?:<[^>]*>)*([\s\S]*?)(?:<\/a>)/i)
    if (!titleMatch) continue
    const url = titleMatch[1]
    const title = cleanHTML(titleMatch[2])
    if (!title || title.length < 4 || url.includes('sogou.com')) continue
    let snippet = ''
    const pMatch = block.match(/<p[^>]*class="[^"]*(?:str_info|str-info|abstract|summary)[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    if (!pMatch) {
      const p2 = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
      if (p2) snippet = cleanHTML(p2[1]).slice(0, 300)
    } else {
      snippet = cleanHTML(pMatch[1]).slice(0, 300)
    }
    if (!results.find(r => r.url === url)) {
      results.push({ title, url, snippet, isNews: false, source: 'sogou' })
    }
  }
  return results
}
function parseBingNews(html, limit) {
  const results = []

  // Bing News result blocks: look for various possible class names
  // Current Bing uses: div.news-card, div.newsitem, article, or a.news-card-body
  const blockPatterns = [
    /<div[^>]*class="[^"]*news[^"]*card[^"]*body[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*news[^"]*card[^"]*body[^"]*"|$)/gi,
    /<a[^>]*class="[^"]*title[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
    /<div[^>]*class="[^"]*(?:news|article|result)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  ]

  // Strategy: first find all <a> tags that look like news titles (long text, href to external site)
  const linkMatches = [...html.matchAll(/<a[^>]*href="(https?:\/\/(?!(?:cn|www)\.bing\.com)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  for (const m of linkMatches) {
    if (results.length >= limit) break
    const url = m[1]
    const rawTitle = m[2]
    const title = cleanHTML(rawTitle)
    // Skip short/nav links
    if (!title || title.length < 8) continue
    if (/^(首页|下一页|上一页|返回|更多|登录|注册|搜索|设置|隐私|Cookie|条款)$/i.test(title)) continue
    // Skip bing internal links
    if (url.includes('bing.com') || url.includes('microsoft.com/bing')) continue

    // Find snippet near this link (text within 500 chars after the link)
    const linkPos = m.index + m[0].length
    const nearText = html.slice(linkPos, linkPos + 800)
    const snippetMatch = nearText.match(/>([^<]{30,300})</)
    const snippet = snippetMatch ? snippetMatch[1].replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim() : ''

    if (!results.find(r => r.url === url)) {
      results.push({ title, url, snippet, isNews: true })
    }
  }

  return results
}

// ─── Parse Bing Web results ───
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
    const title = cleanHTML(titleMatch[1])
    if (!title || title.length < 3) continue

    const urlMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>/i)
    const url = urlMatch ? urlMatch[1] : ''

    let snippet = ''
    const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    if (pMatch) snippet = cleanHTML(pMatch[1]).slice(0, 300)

    // Extract date hints from snippet
    const dateInfo = extractDateFromSnippet(snippet + ' ' + title)

    if (title) {
      results.push({ title, url, snippet, dateInfo, isNews: false })
    }
  }

  return results
}

// ─── Extract date information from text ───
function extractDateFromSnippet(text) {
  if (!text) return null
  // Chinese dates: 2026年6月5日, 6月5日, 今天, 昨天
  const cnDateMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (cnDateMatch) {
    return { year: parseInt(cnDateMatch[1]), month: parseInt(cnDateMatch[2]), day: parseInt(cnDateMatch[3]), raw: cnDateMatch[0] }
  }
  const cnMonthDay = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (cnMonthDay) {
    return { year: new Date().getFullYear(), month: parseInt(cnMonthDay[1]), day: parseInt(cnMonthDay[2]), raw: cnMonthDay[0] }
  }
  // ISO dates: 2026-06-05
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return { year: parseInt(isoMatch[1]), month: parseInt(isoMatch[2]), day: parseInt(isoMatch[3]), raw: isoMatch[0] }
  }
  // Relative: 今天, 昨天, 刚刚, X天前, X小时前, X分钟前
  if (/今天|刚刚|今日/.test(text)) return { relative: 'today' }
  if (/昨天|昨日/.test(text)) return { relative: 'yesterday' }
  const daysAgoCn = text.match(/(\d+)\s*天前/)
  if (daysAgoCn) return { relative: 'days', days: parseInt(daysAgoCn[1]) }
  const hoursAgoCn = text.match(/(\d+)\s*小时前/)
  if (hoursAgoCn) return { relative: 'hours', hours: parseInt(hoursAgoCn[1]) }
  const minsAgoCn = text.match(/(\d+)\s*分钟前/)
  if (minsAgoCn) return { relative: 'minutes', minutes: parseInt(minsAgoCn[1]) }
  return null
}

// ─── Freshness score (0-1, higher = more recent) ───
function scoreFreshness(result) {
  const today = new Date()
  const dateInfo = result.dateInfo || extractDateFromSnippet((result.snippet || '') + ' ' + result.title)

  if (!dateInfo) return 0.3 // no date → assume stale

  if (dateInfo.relative === 'today') return 1.0
  if (dateInfo.relative === 'yesterday') return 0.95
  if (dateInfo.relative === 'minutes') return 1.0
  if (dateInfo.relative === 'hours') return 0.98
  if (dateInfo.relative === 'days') {
    if (dateInfo.days <= 1) return 0.95
    if (dateInfo.days <= 3) return 0.85
    if (dateInfo.days <= 7) return 0.7
    if (dateInfo.days <= 14) return 0.55
    if (dateInfo.days <= 30) return 0.4
    return 0.2
  }

  if (dateInfo.year && dateInfo.month && dateInfo.day) {
    const resultDate = new Date(dateInfo.year, dateInfo.month - 1, dateInfo.day)
    const diffDays = (today - resultDate) / (1000 * 60 * 60 * 24)
    if (diffDays < 0) return 0.5  // future date → suspicious
    if (diffDays <= 1) return 0.95
    if (diffDays <= 3) return 0.85
    if (diffDays <= 7) return 0.7
    if (diffDays <= 30) return 0.5
    if (diffDays <= 90) return 0.3
    return 0.1 // older than 3 months
  }

  if (dateInfo.year) {
    const diffYears = today.getFullYear() - dateInfo.year
    if (diffYears === 0) return 0.6
    if (diffYears === 1) return 0.3
    return 0.1
  }

  return 0.3
}

// ─── Cross-validation: check if multiple sources agree ───
function crossValidateResults(results, query) {
  if (results.length < 2) return results

  const qWords = query.split(/\s+/).filter(w => w.length > 1).map(w => w.toLowerCase())
  if (qWords.length === 0) return results

  // Count how many query terms each result matches
  const scored = results.map(r => {
    const text = (r.title + ' ' + (r.snippet || '')).toLowerCase()
    const matchCount = qWords.filter(w => text.includes(w)).length
    const credibility = scoreSourceCredibility(r.url, r.title, r.snippet)
    const freshness = scoreFreshness(r)

    // Final confidence = credibility * 0.4 + freshness * 0.3 + keyword_match * 0.3
    const keywordScore = qWords.length > 0 ? matchCount / qWords.length : 0
    const confidence = credibility * 0.4 + freshness * 0.3 + keywordScore * 0.3

    return { ...r, credibility, freshness, keywordScore, confidence, matchCount }
  })

  // Sort by confidence score descending
  scored.sort((a, b) => b.confidence - a.confidence)

  // Filter out very low confidence results
  const filtered = scored.filter(r => r.confidence >= 0.15)
  if (filtered.length === 0) return scored.slice(0, 3)

  return filtered
}

// ─── isPoorResults — enhanced with freshness awareness and semantic coverage ───
function isPoorResults(results, query) {
  if (!results.length) return true

  // 0) Any spam/porn domain → immediate fail
  const spamCount = results.filter(r =>
    SPAM_DOMAIN_PATTERNS.test(r.url + r.title + (r.snippet || ''))
  ).length
  if (spamCount > 0) return true

  // 1) Too many junk/dictionary results (>50%)
  const junkCount = results.filter(r =>
    JUNK_PATTERNS.test(r.title + (r.snippet || ''))
  ).length
  if (junkCount > results.length * 0.5) return true

  // 2) Semantic relevance: at least 1 result must mention a core query term (relaxed from 50%)
  const qWords = query.split(/\s+/).filter(w => w.length > 1)
  if (qWords.length > 0) {
    const matchingResults = results.filter(r =>
      qWords.some(w => (r.title + (r.snippet || '')).includes(w))
    )
    if (matchingResults.length < 1) return true
  }

  // 3) All titles look like single-character definitions
  const singleCharTitles = results.filter(r =>
    /^[a-zûêôîâçëïüœùàéè]+\s*[（(]?汉语[)）]?/i.test(r.title) ||
    /^.\s*（汉语汉字）/.test(r.title) ||
    /^.\s*的意思/.test(r.title)
  ).length
  if (singleCharTitles === results.length && results.length > 0) return true

  // 4) Multi-entity queries: check semantic coverage of ALL query entities
  const KEY_ENTITIES = /特朗普|拜登|普京|泽连斯基|习近平|李克强|李强|王毅|金正恩|李在明|尹锡悦|岸田文雄|石破茂|莫迪|朔尔茨|马克龙|斯塔默|特鲁多|马科斯|通伦|佐科|梅洛尼|内塔尼亚胡|中国|美国|俄罗斯|乌克兰|日本|韩国|朝鲜|英国|法国|德国|印度|加拿大|澳大利亚|巴西|土耳其|伊朗|以色列|巴勒斯坦|沙特|阿联酋|卡塔尔|埃及|南非|墨西哥|阿根廷|印尼|越南|泰国|缅甸|柬埔寨|老挝|菲律宾|马来西亚|新加坡|巴基斯坦|台湾|南海|钓鱼岛|加沙|克里米亚|欧盟|北约|联合国|世卫|WTO|东盟|G20|G7|上合组织|金砖|OPEC/i
  const allEntities = query.match(KEY_ENTITIES) || []
  if (allEntities.length >= 2) {
    const uniqEntities = [...new Set(allEntities)]
    const allText = results.map(r => r.title + ' ' + (r.snippet || '')).join(' ')
    const missing = uniqEntities.filter(e => !allText.includes(e))
    // Stricter: reject if >25% entities missing (was 40%)
    if (missing.length > 0 && missing.length >= uniqEntities.length * 0.25) return true
  }

  // 5) Single-entity temporal query: reject if ALL results are >1 year old
  if (allEntities.length === 1) {
    const queryType = detectQueryType(query)
    if (queryType === 'breaking_news' || queryType === 'news') {
      const resultsWithDates = results.filter(r => r.dateInfo || extractDateFromSnippet((r.snippet || '') + ' ' + r.title))
      if (resultsWithDates.length >= 2) {
        const freshResults = resultsWithDates.filter(r => scoreFreshness(r) >= 0.4)
        if (freshResults.length === 0) return true
      }
    }
  }

  // 6) Breaking news: stricter check — require at least one recent result
  const queryType = detectQueryType(query)
  if (queryType === 'breaking_news') {
    const freshnessScores = results.map(r => scoreFreshness(r))
    const hasFresh = freshnessScores.some(s => s >= 0.7)
    // For breaking news: at least 1 result must be recent OR have high credibility
    const hasHighCred = results.some(r => scoreSourceCredibility(r.url, r.title, r.snippet) >= 0.9)
    if (!hasFresh && !hasHighCred && results.length <= 3) {
      // Not a hard fail, but a warning flag
      console.log('[search:verify] ⚠️ Breaking news query has no fresh/high-cred results')
    }
  }

  return false
}

// ─── Generate alternative queries ───
function generateAltQueries(query) {
  const alt = []
  const cleaned = query.replace(/\s+/g, ' ').trim()

  // Pattern: "X 来没来过/有没有去过 Y"
  const beenMatch = cleaned.match(/(.+?)\s*(来没来过|有没有去过|是否到过|有没有到过|最近有没有来|去没去过|来过没有|来过吗|来过么)\s*(.+)/)
  if (beenMatch) {
    const [, person, , place] = beenMatch
    alt.push(`${person} 访问 ${place}`)
    alt.push(`${person} ${place} visit`)
    alt.push(`${person} ${place}`)
  }

  // Pattern: "X 访问/出访/到访 Y"
  const visitMatch = cleaned.match(/(.+?)\s*(访问|出访|到访)\s*(.+)/)
  if (visitMatch) {
    const [, person, , place] = visitMatch
    alt.push(`${person} 访${place}`)
    alt.push(`${person} ${place} 国事访问`)
    alt.push(`${person} ${place} visit`)
    alt.push(`${person} ${place} 最新`)
  }

  // Pattern: "X 最近/最新..." → entity + 最新动态
  const recentMatch = cleaned.match(/(.+?)\s*(最近|近期|近来|最新).*/)
  if (recentMatch) {
    const entity = recentMatch[1].trim()
    if (entity.length >= 2 && entity.length <= 10) {
      alt.push(`${entity} 最新动态`)
      alt.push(`${entity} ${new Date().getFullYear()}年`)
    }
  }

  // Chinese query → keyword extraction
  if (/[\u4e00-\u9fff]/.test(cleaned)) {
    alt.push(cleaned + ' 最新消息')
    const stopWords = /[的地得了吗呢啊吧么哦最近有没有是不是可否是否来过什么怎样如何怎么哪里哪个啥时候什么时间]/g
    const keywords = cleaned.replace(stopWords, ' ').replace(/\s+/g, ' ').trim()
    if (keywords !== cleaned && keywords.length > 3) alt.push(keywords)

    // English fallback with entity translation
    let enQuery = cleaned
    let hasTranslation = false
    for (const [cn, en] of Object.entries(ENTITY_MAP)) {
      if (enQuery.includes(cn)) {
        enQuery = enQuery.replace(new RegExp(cn, 'g'), en)
        hasTranslation = true
      }
    }
    if (hasTranslation && enQuery !== cleaned) {
      enQuery = enQuery.replace(/[\u4e00-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim()
      if (enQuery.length > 3) alt.push(enQuery)
    }

    alt.push(cleaned + ` ${new Date().getFullYear()}`)
  }

  return [...new Set(alt.filter(a => a !== cleaned && a.length > 3))]
}

// ─── Clean HTML entities ───
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
    .replace(/&middot;/g, '\u00b7')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatSearchResults(results) {
  if (!results || !results.length) return ''
  return results.map((r, i) => {
    const parts = [`${i + 1}. **${r.title}**`, `   URL: ${r.url}`]
    if (r.snippet) parts.push(`   ${r.snippet}`)
    if (r.dateInfo) parts.push(`   时效: ${r.dateInfo.raw || r.dateInfo.relative || ''}`)
    return parts.join('\n')
  }).join('\n\n')
}

// ─── Official source search for political/news queries ───
// Uses Bing site: operator to search only authoritative Chinese domains
async function searchOfficialSources(query, maxResults = 3) {
  const allResults = []
  // Use top 3 official domains to keep latency reasonable
  const domains = OFFICIAL_SOURCES.slice(0, 4)
  const tasks = domains.map(domain =>
    webSearch(`${query} site:${domain}`, maxResults, 'cn')
      .catch(() => [])
  )
  const results = await Promise.all(tasks)
  for (let i = 0; i < results.length; i++) {
    for (const r of results[i]) {
      if (!allResults.find(e => e.url === r.url)) {
        r.officialSource = true
        r.sourceDomain = domains[i]
        allResults.push(r)
      }
    }
  }
  return allResults
}

// ─── GitHub entity search — direct API calls for user/repo queries ───
const GITHUB_REPO_QUERY = /([a-zA-Z0-9_-]{1,39})\s*\/\s*([a-zA-Z0-9_.-]{1,100})(?:\s|$)/

async function searchGitHubEntity(query) {
  const candidates = []

  // Pattern 1: user/repo (with slash)
  const slashMatch = query.match(GITHUB_REPO_QUERY)
  if (slashMatch) {
    candidates.push([slashMatch[1], slashMatch[2].replace(/[.\s].*$/, '')])
  }

  // Pattern 2: Full GitHub URL
  const urlMatch = query.match(/github\.com\/([a-zA-Z0-9_-]{1,39})\/([a-zA-Z0-9_.-]{1,100})/)
  if (urlMatch) {
    candidates.push([urlMatch[1], urlMatch[2].replace(/[\/.\s].*$/, '')])
  }

  // Pattern 3: "owner repo" (space-separated) when query mentions github/repo
  if (candidates.length === 0 && /github|repo|仓库|开源/i.test(query)) {
    const words = query.split(/[\s,，]+/).filter(w => /^[a-zA-Z0-9_-]{2,39}$/.test(w))
    for (let i = 0; i < words.length - 1; i++) {
      if (/^(github|repo|repository|code|the|this|and|for|what|how|is|in|of|to|a|an|or)$/i.test(words[i])) continue
      if (/^(github|repo|repository|code)$/i.test(words[i+1])) continue
      candidates.push([words[i], words[i+1]])
    }
  }

  for (const [owner, repo] of candidates) {
    if (!owner || !repo || owner.length < 1 || repo.length < 1 || repo.length > 100) continue

    console.log('[search:github] Trying:', owner + '/' + repo)
    try {
      const data = await fetchJSON('https://api.github.com/repos/' + owner + '/' + repo)
      if (!data || !data.full_name) continue

      // Fetch README + package.json for deeper understanding
      let extraContent = ''
      try {
        const readmeRes = await fetchHTML('https://raw.githubusercontent.com/' + owner + '/' + repo + '/HEAD/README.md')
        if (readmeRes && readmeRes.length > 50) {
          extraContent += '\n📖 README摘要:\n' + readmeRes.slice(0, 2000) + '\n'
        }
      } catch {}
      try {
        const pkgRes = await fetchHTML('https://raw.githubusercontent.com/' + owner + '/' + repo + '/HEAD/package.json')
        if (pkgRes && pkgRes.length > 10) {
          try {
            const pkg = JSON.parse(pkgRes)
            extraContent += '\n📦 项目配置:\n'
            extraContent += '   名称: ' + (pkg.name || 'N/A') + '\n'
            extraContent += '   描述: ' + (pkg.description || 'N/A') + '\n'
            if (pkg.dependencies) extraContent += '   依赖: ' + Object.keys(pkg.dependencies).slice(0, 10).join(', ') + '\n'
            if (pkg.scripts) extraContent += '   脚本: ' + Object.keys(pkg.scripts).join(', ') + '\n'
          } catch {}
        }
      } catch {}
      try {
        const treeRes = await fetchJSON('https://api.github.com/repos/' + owner + '/' + repo + '/git/trees/HEAD?recursive=0')
        if (treeRes && treeRes.tree) {
          const files = treeRes.tree.map(f => (f.type === 'tree' ? '📁' : '📄') + ' ' + f.path)
          extraContent += '\n📂 根目录文件:\n   ' + files.slice(0, 25).join('\n   ')
          if (files.length > 25) extraContent += '\n   ... 共' + files.length + '个'
        }
      } catch {}

      return [{
        title: data.full_name,
        url: data.html_url,
        snippet: (data.description || '') + ' | ⭐' + data.stargazers_count + ' | ' + (data.language || 'N/A'),
        isNews: false,
        source: 'github-api',
        credibility: 1.0,
        freshness: 0.9,
        confidence: 1.0,
        _ghData: data,
        _extraContent: extraContent,
      }]
    } catch (e) {
      console.log('[search:github] API call failed:', e.message)
      return []
    }
  }
  return []
}

// Extract fetchJSON from crawler for use in search
function fetchJSON(urlStr, customHeaders) {
  return new Promise((resolve, reject) => {
    const parsed = new (require('url').URL)(urlStr)
    const mod = parsed.protocol === 'https:' ? require('https') : require('http')
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      ...(customHeaders || {}),
    }
    const req = mod.get(urlStr, { timeout: 10000, headers }, (res) => {
      if (res.statusCode === 404) return resolve(null)
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => body += chunk)
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch { resolve(null) } })
      res.on('error', reject)
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}

// ─── Douban movie search ───
async function doubanSearch(query, maxResults = 5) {
  try {
    const q = encodeURIComponent(query.trim())
    const url = 'https://www.douban.com/search?cat=1002&q=' + q
    const html = await fetchHTML(url)
    if (!html || html.length < 500) return []
    const results = []
    // Douban search result items
    const itemRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*class="[^"]*subject-cast[^"]*"[^>]*>([\s\S]*?)<\/span>/gi
    let match
    while ((match = itemRegex.exec(html)) !== null && results.length < maxResults) {
      const url = match[1]
      const title = cleanHTML(match[2])
      const info = cleanHTML(match[3] || '')
      if (title && title.length > 2) {
        results.push({ title: '[豆瓣] ' + title, url, snippet: info, isNews: false, source: 'douban', credibility: 0.8, freshness: 0.7 })
      }
    }
    // Fallback: broader regex
    if (!results.length) {
      const altRegex = /<a[^>]*href="(https:\/\/movie\.douban\.com\/subject\/\d+\/)"[^>]*>([\s\S]*?)<\/a>/gi
      while ((match = altRegex.exec(html)) !== null && results.length < maxResults) {
        const title = cleanHTML(match[2])
        if (title && title.length > 2) {
          results.push({ title: '[豆瓣] ' + title, url: match[1], snippet: '', isNews: false, source: 'douban', credibility: 0.8, freshness: 0.7 })
        }
      }
    }
    return results
  } catch { return [] }
}

// ─── Baidu Baike search (via Bing site:baike.baidu.com) ───
async function baiduBaikeSearch(query, maxResults = 3) {
  try {
    return await webSearch(query + ' site:baike.baidu.com', maxResults, 'cn')
  } catch { return [] }
}

// ═══════════════════════════════════════════════════════════
// MAIN PIPELINE: webSearchVerified — the full accuracy pipeline
// ═══════════════════════════════════════════════════════════
async function webSearchVerified(query, maxResults = 5) {
  const queryType = detectQueryType(query)
  const timeCtx = getTimeContext(queryType, query)
  const enhancedQuery = query + timeCtx.suffix

  console.log(`[search:verified] query="${query}" type=${queryType} enhanced="${enhancedQuery}" newsMode=${timeCtx.newsMode}`)

  let allResults = []
  let usedSources = []

  // ─── Stage 1: Multi-engine parallel search ───
  // For breaking news / time-sensitive queries, include Bing News search
  // For all queries, search both cn and intl Bing with enhanced + original query
  // Always check GitHub API for user/repo style queries
  const githubEntityResults = await searchGitHubEntity(query)

  // ─── Route to specialized sources based on query type ───
  const shouldSearchNews = queryType === 'breaking_news' || queryType === 'news'

  // Start specialized searches in parallel with general searches
  let doubanTask = Promise.resolve([])
  let baikeTask = Promise.resolve([])
  if (queryType === 'movie') {
    doubanTask = doubanSearch(query, maxResults)
  }
  if (queryType === 'person' || queryType === 'factual') {
    baikeTask = baiduBaikeSearch(query, maxResults)
  }

  const searchTasks = [
    webSearch(enhancedQuery, maxResults, 'cn'),
    webSearch(enhancedQuery, maxResults, 'intl'),
    webSearch(query, maxResults, 'cn'),      // original query as backup
    sogouSearch(enhancedQuery, maxResults),  // Sogou for Chinese content
  ]
  if (shouldSearchNews) {
    searchTasks.push(bingNewsSearch(query, maxResults, 'cn'))
    searchTasks.push(bingNewsSearch(query, maxResults, 'intl'))
    searchTasks.push(searchOfficialSources(query, Math.min(maxResults, 3)))
  }
  const allSearchResults = await Promise.all(searchTasks)
  const [doubanResults, baikeResults] = await Promise.all([doubanTask, baikeTask])
  
  const webCn = allSearchResults[0]
  const webIntl = allSearchResults[1]
  const webCnOrig = allSearchResults[2]
  const sogou = allSearchResults[3]
  const newsCn = shouldSearchNews ? allSearchResults[4] : null
  const newsIntl = shouldSearchNews ? allSearchResults[5] : null
  const officialResults = shouldSearchNews ? (allSearchResults[6] || []) : []

  const candidates = []
  // Specialized sources first (highest priority)
  if (githubEntityResults.length) {
    candidates.push({ results: githubEntityResults, source: 'github-api' })
    if (!usedSources.includes('github-api')) usedSources.push('github-api')
  }
  if (doubanResults.length) {
    candidates.push({ results: doubanResults, source: 'douban.com' })
    if (!usedSources.includes('douban.com')) usedSources.push('douban.com')
  }
  if (baikeResults.length) {
    candidates.push({ results: baikeResults, source: 'baike.baidu.com' })
    if (!usedSources.includes('baike.baidu.com')) usedSources.push('baike.baidu.com')
  }
  const sourceEntries = [
    [webCn, 'cn.bing.com'],
    [webIntl, 'www.bing.com'],
    [webCnOrig, 'cn.bing.com'],
    [sogou, 'sogou.com'],
  ]
  if (shouldSearchNews) {
    if (newsCn) sourceEntries.push([newsCn, 'cn.bing.com/news'])
    if (newsIntl) sourceEntries.push([newsIntl, 'www.bing.com/news'])
    if (officialResults.length) sourceEntries.push([officialResults, 'Official (gov.cn/xinhua/people/cctv)'])
  }
  for (const [results, source] of sourceEntries) {
    const poor = results.length > 0 ? isPoorResults(results, query) : true
    console.log(`[search:verified] source=${source} count=${results.length} poor=${poor} titles=${results.slice(0,2).map(r=>r.title?.slice(0,40)).join(' | ')}`)
    if (results.length > 0 && !poor) {
      candidates.push({ results, source })
      if (!usedSources.includes(source)) usedSources.push(source)
    }
  }

  // Merge: enhanced query results first (prioritized), then original query
  for (const { results } of candidates) {
    for (const r of results) {
      if (!allResults.find(existing => existing.url === r.url)) {
        allResults.push(r)
      }
    }
  }

  // ─── Stage 2: If all primary results are poor, try alt + fuzzy queries ───
  if (allResults.length === 0 || isPoorResults(allResults, query)) {
    console.log('[search:verified] Primary results poor, trying alternative queries')
    // Try alt queries + relaxed queries (drop specific terms, keep context)
    const alts = [...new Set([...generateAltQueries(query), ...generateRelaxedQueries(query, queryType)])]
    for (const alt of alts.slice(0, 6)) {
      console.log('[search:verified] Alt/relaxed query:', alt)
      const altResults = await webSearch(alt, maxResults, 'intl')
      if (altResults.length > 0 && !isPoorResults(altResults, alt)) {
        allResults = altResults
        usedSources = ['www.bing.com (alt/fuzzy query)']
        break
      }
      const altCnResults = await webSearch(alt, maxResults, 'cn')
      if (altCnResults.length > 0 && !isPoorResults(altCnResults, alt)) {
        allResults = altCnResults
        usedSources = ['cn.bing.com (alt/fuzzy query)']
        break
      }
    }
  }

  // ─── Stage 3: Cross-validate and score ───
  const validated = crossValidateResults(allResults, query)

  // ─── Stage 4: Deep crawl — MANDATORY, crawl all credible URLs ───
  let crawledText = ''
  const urlsToCrawl = (validated.length > 0 ? validated : allResults)
    .slice(0, 5).map(r => r.url).filter(Boolean)
  if (urlsToCrawl.length > 0) {
    try {
      const { crawlPages } = require('./crawler')
      const crawled = await crawlPages(urlsToCrawl)
      const validCrawled = crawled.filter(c => c && c.content && c.content.length > 30)
      if (validCrawled.length > 0) {
        crawledText = '\n\n📄 深度抓取内容:\n' + validCrawled.map(r =>
          `[来源: ${r.url}]\n${r.content}`
        ).join('\n\n')
      }
    } catch (e) {
      console.warn('[search:verified] Crawl failed:', e.message)
    }
  }

  // ─── Stage 5: Format output ───
  const sourceLabel = [...new Set(usedSources)].join(' + ') || 'Bing'
  let text = `搜索 "${query}" (源: ${sourceLabel}${timeCtx.newsMode ? ', 优先时效性' : ''}):\n`

  if (validated.length === 0) {
    text += `(未找到相关信息。建议：换关键词重试，或检查拼写。)\n`
  } else {
    validated.slice(0, maxResults).forEach((r, i) => {
      const credLabel = r.credibility >= 0.9 ? ' [高可信]' : r.credibility >= 0.7 ? '' : ' [低可信]'
      const freshLabel = r.freshness >= 0.8 ? ' [最新]' : ''
      text += `${i + 1}. ${r.title}${credLabel}${freshLabel}\n   ${r.snippet || ''}\n`
    })
  }

  text += crawledText

  // ─── Stage 6: Anti-hallucination warning ───
  if (validated.length === 0) {
    text += '\n⚠️ 以上搜索未返回有效结果。请勿凭空编造信息。如不确定，请明确告知用户"未找到相关信息"。'
  }
  if (validated.length > 0 && validated.every(r => r.confidence < 0.5)) {
    text += '\n⚠️ 搜索结果置信度较低。回答时请标注不确定性，建议用户交叉验证。'
  }

  return text
}

// ─── Legacy webSearchDual — maintained for backward compatibility ───
async function webSearchDual(query, maxResults = 5) {
  return webSearchVerified(query, maxResults)
}

module.exports = { webSearch, webSearchDual, webSearchVerified, formatSearchResults, bingNewsSearch, sogouSearch, searchOfficialSources, doubanSearch, baiduBaikeSearch }
