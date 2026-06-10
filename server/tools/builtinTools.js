// ═══════════════════════════════════════════
// Built-in Tools — no npm, no MCP, no external deps
// Each tool is a simple function the AI can call.
// Shared by engine/agent.js (Chat) and codeAgent.js (Code)
// ═══════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ─── Tool Definitions (for DeepSeek tools array) ───
const BUILTIN_DEFS = [
  // ── Fetch URL ──
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: '抓取任意 URL 的内容并返回 Markdown/text。用于阅读网页、API 文档、获取在线信息。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要抓取的完整 URL，包含协议，如 https://example.com' },
          format: { type: 'string', enum: ['auto', 'text', 'json'], description: '输出格式，auto 自动检测，text 纯文本，json 原始 JSON' }
        },
        required: ['url']
      }
    }
  },

  // ── Weather ──
  {
    type: 'function',
    function: {
      name: 'weather',
      description: '查询全球任意地点的实时天气和未来预报。不需要 API Key。',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: '城市名或坐标，如 "北京"、"London"、"39.9,116.4"' },
          days: { type: 'number', description: '预报天数，1-7，默认 1' }
        },
        required: ['location']
      }
    }
  },

  // ── Time / Date ──
  {
    type: 'function',
    function: {
      name: 'time',
      description: '时区转换、时间计算、获取任意时区的当前时间。支持 IANA 时区名（Asia/Shanghai, America/New_York）。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['now', 'convert', 'diff'], description: 'now=获取时间, convert=转换时区, diff=计算时差' },
          timezone: { type: 'string', description: '目标时区，如 Asia/Shanghai、America/New_York' },
          from_timezone: { type: 'string', description: 'convert 模式：源时区' },
          time_str: { type: 'string', description: 'convert 模式：要转换的时间，如 "2024-01-01 12:00"' }
        },
        required: ['action', 'timezone']
      }
    }
  },

  // ── GitHub ──
  {
    type: 'function',
    function: {
      name: 'github',
      description: 'GitHub API 操作：创建 Issue、搜索仓库、查看 PR、列出文件。需要设置 GITHUB_TOKEN 环境变量。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['search_repos', 'get_repo', 'list_issues', 'create_issue', 'list_prs', 'get_pr', 'list_files'], description: '操作类型' },
          repo: { type: 'string', description: '仓库名，格式 owner/repo。search_repos 时填搜索关键词。' },
          title: { type: 'string', description: 'create_issue 时的标题' },
          body: { type: 'string', description: 'create_issue 时的内容' },
          state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Issue/PR 状态过滤' }
        },
        required: ['action']
      }
    }
  },

  // ── Notion ──
  {
    type: 'function',
    function: {
      name: 'notion',
      description: 'Notion API 操作：搜索页面、创建页面、读取页面。需要设置 NOTION_API_KEY 环境变量。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['search', 'get_page', 'create_page'], description: '操作类型' },
          query: { type: 'string', description: 'search 时的搜索关键词' },
          page_id: { type: 'string', description: 'get_page 时的页面 ID' },
          parent_id: { type: 'string', description: 'create_page 时的父页面 ID' },
          title: { type: 'string', description: 'create_page 时的页面标题' },
          content: { type: 'string', description: 'create_page 时的页面内容（Markdown）' }
        },
        required: ['action']
      }
    }
  },

  // ── SQLite ──
  {
    type: 'function',
    function: {
      name: 'sqlite',
      description: '查询 SQLite 数据库文件。执行 SELECT 查询、列出表结构。',
      parameters: {
        type: 'object',
        properties: {
          db_path: { type: 'string', description: '数据库文件的完整路径' },
          query: { type: 'string', description: 'SQL 查询语句（只允许 SELECT 和 PRAGMA）' }
        },
        required: ['db_path', 'query']
      }
    }
  },

  // ── Docker ──
  {
    type: 'function',
    function: {
      name: 'docker',
      description: 'Docker 容器和镜像管理：列出容器、查看日志、启动/停止容器、列出镜像。需要本地安装 Docker。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['ps', 'logs', 'images', 'start', 'stop', 'inspect', 'stats'], description: '操作类型' },
          container: { type: 'string', description: '容器名称或 ID（ps/logs/start/stop/inspect 时需要）' },
          tail: { type: 'number', description: 'logs 时显示最后 N 行，默认 50' }
        },
        required: ['action']
      }
    }
  },
  // ── Amap (高德地图) ──
  {
    type: 'function',
    function: {
      name: 'amap',
      description: '高德地图 API：地址转坐标、坐标转地址、POI 搜索、路径规划、距离测量。需要设置 AMAP_KEY 环境变量（免费申请: https://lbs.amap.com/）。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['geocode', 'regeo', 'poi', 'route', 'distance'], description: '操作类型: geocode=地址→坐标, regeo=坐标→地址, poi=兴趣点搜索, route=路径规划, distance=距离测量' },
          address: { type: 'string', description: 'geocode/poi 时的地址或关键词' },
          location: { type: 'string', description: 'regeo/distance/poi 时的经纬度，格式 "116.397428,39.90923"' },
          city: { type: 'string', description: 'poi/geocode 时的城市，如 "北京"' },
          origin: { type: 'string', description: 'route/distance 时的起点坐标 "lng,lat"' },
          destination: { type: 'string', description: 'route/distance 时的终点坐标 "lng,lat"' },
          type: { type: 'string', enum: ['driving', 'walking', 'transit'], description: 'route 时的出行方式，默认 driving' },
          keywords: { type: 'string', description: 'poi 时搜索的关键词' },
          radius: { type: 'number', description: 'poi 时搜索半径（米），默认 1000' }
        },
        required: ['action']
      }
    }
  },
]

// ─── Executor ───
async function executeBuiltinTool(name, args) {
  switch (name) {
    case 'fetch_url': return await fetchUrl(args)
    case 'weather':   return await getWeather(args)
    case 'time':      return await timeTool(args)
    case 'github':    return await githubTool(args)
    case 'notion':    return await notionTool(args)
    case 'sqlite':    return await sqliteTool(args)
    case 'docker':    return await dockerTool(args)
    case 'amap':      return await amapTool(args)
    default:          return `未知内置工具: ${name}`
  }
}

// ═══════════════════════════════════════════
// Tool Implementations
// ═══════════════════════════════════════════

// ── Fetch URL ──
async function fetchUrl(args) {
  try {
    const url = args.url
    if (!url || !url.startsWith('http')) return '请提供有效的 URL（以 http:// 或 https:// 开头）'

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(url, {
      headers: { 'User-Agent': 'SuperDS/1.0' },
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!res.ok) return `HTTP ${res.status}: ${res.statusText}`

    const contentType = res.headers.get('content-type') || ''
    const format = args.format || 'auto'

    if (format === 'json' || contentType.includes('json')) {
      const text = await res.text()
      try { return JSON.stringify(JSON.parse(text), null, 2).slice(0, 50000) } catch { return text.slice(0, 50000) }
    }

    const text = await res.text()
    return text.slice(0, 50000)
  } catch (e) {
    if (e.name === 'AbortError') return '请求超时（15s），请检查 URL 或网络'
    return `抓取失败: ${e.message}`
  }
}

// ── Weather ──
async function getWeather(args) {
  try {
    const location = args.location?.trim()
    if (!location) return '请提供城市名或坐标'

    // If it looks like coordinates (lat,lon)
    const isCoords = /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(location)
    const params = isCoords
      ? `latitude=${location.split(',')[0]}&longitude=${location.split(',')[1]}`
      : `city=${encodeURIComponent(location)}`

    const days = Math.min(Math.max(args.days || 1, 1), 7)

    // Use geocoding to get coords if city name
    let lat, lon
    if (isCoords) {
      lat = location.split(',')[0]
      lon = location.split(',')[1]
    } else {
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`)
      if (!geoRes.ok) return `找不到城市: ${location}`
      const geoData = await geoRes.json()
      if (!geoData.results?.length) return `找不到城市: ${location}`
      lat = geoData.results[0].latitude
      lon = geoData.results[0].longitude
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=${days}`
    )
    if (!weatherRes.ok) return `天气 API 错误: ${weatherRes.status}`

    const data = await weatherRes.json()

    // Weather codes mapping
    const wmoCodes = {
      0: '晴天', 1: '大部晴朗', 2: '局部多云', 3: '多云',
      45: '雾', 48: '霜雾', 51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
      61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 75: '大雪',
      80: '小阵雨', 81: '中阵雨', 82: '大阵雨', 95: '雷暴', 96: '雷暴+冰雹'
    }

    const current = data.current
    const currentWeather = wmoCodes[current.weather_code] || `码 ${current.weather_code}`

    let result = `📍 ${data.timezone}\n`
    result += `🌡️ 当前 ${current.temperature_2m}°C (体感 ${current.apparent_temperature}°C)\n`
    result += `💧 湿度 ${current.relative_humidity_2m}% | 💨 风速 ${current.wind_speed_10m}km/h\n`
    result += `🌤️ ${currentWeather}\n\n`

    if (data.daily) {
      result += '📅 预报:\n'
      for (let i = 0; i < data.daily.time.length; i++) {
        const w = wmoCodes[data.daily.weather_code[i]] || `码 ${data.daily.weather_code[i]}`
        result += `  ${data.daily.time[i]}: ${data.daily.temperature_2m_min[i]}~${data.daily.temperature_2m_max[i]}°C ${w} 💧${data.daily.precipitation_sum[i] || 0}mm\n`
      }
    }

    return result
  } catch (e) {
    return `天气查询失败: ${e.message}`
  }
}

// ── Time ──
async function timeTool(args) {
  try {
    const tz = args.timezone || 'UTC'

    if (args.action === 'now') {
      try {
        const now = new Date()
        const opt = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
        const formatter = new Intl.DateTimeFormat('zh-CN', opt)
        const parts = formatter.formatToParts(now)
        const map = {}
        parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value })
        const offset = -now.getTimezoneOffset() / 60
        return `${tz}: ${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} (UTC${offset >= 0 ? '+' : ''}${offset})`
      } catch { return `不支持的时区: ${tz}` }
    }

    if (args.action === 'convert') {
      try {
        const fromTz = args.from_timezone || 'UTC'
        const timeStr = args.time_str || new Date().toISOString().slice(0, 16)

        // Parse input time as fromTz
        const d = new Date(timeStr)
        if (isNaN(d.getTime())) return `无法解析时间: ${timeStr}`

        const opt = { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
        const formatter = new Intl.DateTimeFormat('zh-CN', opt)
        const parts = formatter.formatToParts(d)
        const map = {}
        parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value })
        return `${timeStr} (${fromTz}) → ${tz}: ${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`
      } catch { return `转换失败，请检查时区名和时间格式` }
    }

    if (args.action === 'diff') {
      try {
        const tz1 = args.from_timezone || 'UTC'
        const d1 = new Date()
        const d2 = new Date()
        const off1 = -d1.getTimezoneOffset() / 60
        const opt1 = { timeZone: tz1, hour: 'numeric', minute: 'numeric' }
        const opt2 = { timeZone: tz, hour: 'numeric', minute: 'numeric' }
        const h1 = parseInt(new Intl.DateTimeFormat('en', { ...opt1, hour: 'numeric' }).format(d1))
        const h2 = parseInt(new Intl.DateTimeFormat('en', { ...opt2, hour: 'numeric' }).format(d2))
        const diff = h2 - h1
        return `${tz1} 与 ${tz} 的时差: ${diff >= 0 ? '+' : ''}${diff} 小时`
      } catch { return `时差计算失败` }
    }

    return '未知操作，支持: now, convert, diff'
  } catch (e) {
    return `时间工具错误: ${e.message}`
  }
}

// ── GitHub ──
async function githubTool(args) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (!token) return '需要设置 GITHUB_TOKEN 环境变量才能在 GitHub 上操作。\n创建 Token: https://github.com/settings/tokens'

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'SuperDS/1.0'
  }

  const api = 'https://api.github.com'

  try {
    switch (args.action) {
      case 'search_repos': {
        const q = args.repo || ''
        if (!q) return '请输入搜索关键词'
        const res = await fetch(`${api}/search/repositories?q=${encodeURIComponent(q)}&per_page=10&sort=stars`, { headers })
        if (!res.ok) return `GitHub API 错误: ${res.status}`
        const data = await res.json()
        if (!data.items?.length) return `未找到匹配仓库: ${q}`
        return data.items.map(r =>
          `• ${r.full_name} ⭐${r.stargazers_count} ${r.description || ''}`
        ).join('\n')
      }

      case 'get_repo': {
        if (!args.repo) return '请输入仓库名 owner/repo'
        const res = await fetch(`${api}/repos/${args.repo}`, { headers })
        if (!res.ok) return `仓库不存在或无权访问: ${args.repo}`
        const r = await res.json()
        return `📦 ${r.full_name}\n⭐ ${r.stargazers_count} | 🍴 ${r.forks_count} | 🐛 ${r.open_issues_count}\n📝 ${r.description || '无描述'}\n🔗 ${r.html_url}\n📅 创建: ${r.created_at?.slice(0, 10)} 更新: ${r.updated_at?.slice(0, 10)}`
      }

      case 'list_issues': {
        if (!args.repo) return '请输入仓库名 owner/repo'
        const state = args.state || 'open'
        const res = await fetch(`${api}/repos/${args.repo}/issues?state=${state}&per_page=20`, { headers })
        if (!res.ok) return `GitHub API 错误: ${res.status}`
        const issues = await res.json()
        if (!issues.length) return `${args.repo} 没有 ${state} 的 Issue`
        return issues.map(i => `#${i.number} [${i.state}] ${i.title} — @${i.user?.login}`).join('\n')
      }

      case 'create_issue': {
        if (!args.repo || !args.title) return '需要 repo (owner/repo) 和 title'
        const res = await fetch(`${api}/repos/${args.repo}/issues`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: args.title, body: args.body || '' })
        })
        if (!res.ok) return `创建失败: ${res.status}`
        const issue = await res.json()
        return `✅ Issue #${issue.number} 已创建: ${issue.html_url}`
      }

      case 'list_prs': {
        if (!args.repo) return '请输入仓库名 owner/repo'
        const state = args.state || 'open'
        const res = await fetch(`${api}/repos/${args.repo}/pulls?state=${state}&per_page=20`, { headers })
        if (!res.ok) return `GitHub API 错误: ${res.status}`
        const prs = await res.json()
        if (!prs.length) return `${args.repo} 没有 ${state} 的 PR`
        return prs.map(p => `#${p.number} [${p.state}] ${p.title} — @${p.user?.login}`).join('\n')
      }

      case 'get_pr': {
        if (!args.repo) return '请输入仓库名 owner/repo'
        const number = parseInt(args.title) || 1
        const res = await fetch(`${api}/repos/${args.repo}/pulls/${number}`, { headers })
        if (!res.ok) return `PR 不存在: ${number}`
        const pr = await res.json()
        return `📦 PR #${pr.number}: ${pr.title}\n状态: ${pr.state}\n作者: @${pr.user?.login}\n分支: ${pr.head.ref} → ${pr.base.ref}\n🔗 ${pr.html_url}`
      }

      case 'list_files': {
        if (!args.repo) return '请输入仓库名 owner/repo'
        const res = await fetch(`${api}/repos/${args.repo}/contents`, { headers })
        if (!res.ok) return `无法获取文件列表: ${res.status}`
        const files = await res.json()
        if (!Array.isArray(files)) return '路径不是目录'
        return files.map(f => `${f.type === 'dir' ? '📁' : '📄'} ${f.name}`).join('\n')
      }

      default: return `未知操作: ${args.action}，支持: search_repos, get_repo, list_issues, create_issue, list_prs, get_pr, list_files`
    }
  } catch (e) {
    return `GitHub 工具错误: ${e.message}`
  }
}

// ── Notion ──
async function notionTool(args) {
  const token = process.env.NOTION_API_KEY || process.env.NOTION_TOKEN
  if (!token) return '需要设置 NOTION_API_KEY 环境变量。\n创建 Integration: https://www.notion.so/my-integrations'

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28'
  }

  try {
    switch (args.action) {
      case 'search': {
        const q = args.query || ''
        const body = q ? { query: q } : {}
        const res = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
        if (!res.ok) return `Notion API 错误: ${res.status}`
        const data = await res.json()
        if (!data.results?.length) return '未找到匹配页面'
        return data.results.map(p =>
          `• ${p.object}: ${p.properties?.title?.title?.[0]?.plain_text || '(无标题)'} (ID: ${p.id})`
        ).join('\n')
      }

      case 'get_page': {
        if (!args.page_id) return '请输入 page_id'
        const res = await fetch(`https://api.notion.com/v1/pages/${args.page_id}`, { headers })
        if (!res.ok) return `页面不存在: ${res.status}`
        const page = await res.json()
        const title = page.properties?.title?.title?.[0]?.plain_text || page.properties?.Name?.title?.[0]?.plain_text || '(无标题)'
        return `📄 ${title}\nID: ${page.id}\nURL: https://notion.so/${page.id.replace(/-/g, '')}`
      }

      case 'create_page': {
        if (!args.parent_id || !args.title) return '需要 parent_id 和 title'
        const body = {
          parent: { page_id: args.parent_id },
          properties: {
            title: { title: [{ text: { content: args.title } }] }
          }
        }
        if (args.content) {
          body.children = [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', text: { content: args.content.slice(0, 2000) } }] }
            }
          ]
        }
        const res = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        })
        if (!res.ok) return `创建失败: ${res.status}`
        const page = await res.json()
        return `✅ 页面已创建: ${page.url || `ID: ${page.id}`}`
      }

      default: return `未知操作: ${args.action}，支持: search, get_page, create_page`
    }
  } catch (e) {
    return `Notion 工具错误: ${e.message}`
  }
}

// ── SQLite ──
async function sqliteTool(args) {
  try {
    const dbPath = path.resolve(args.db_path)
    if (!fs.existsSync(dbPath)) return `数据库文件不存在: ${dbPath}`

    const query = args.query?.trim()
    if (!query) return '请输入 SQL 查询'
    if (!/^\s*(SELECT|PRAGMA|EXPLAIN)\b/i.test(query)) return '只允许 SELECT 和 PRAGMA 查询'

    // Try better-sqlite3 first (faster), fallback to sql.js
    let rows
    try {
      const Database = require('better-sqlite3')
      const db = new Database(dbPath, { readonly: true })
      const stmt = db.prepare(query)
      rows = stmt.all()
      db.close()
    } catch (e1) {
      try {
        const initSqlJs = require('sql.js')
        const SQL = await initSqlJs()
        const buf = fs.readFileSync(dbPath)
        const db = new SQL.Database(buf)
        const stmt = db.exec(query)
        rows = stmt[0]?.values || []
        db.close()
      } catch (e2) {
        // Last resort: use sqlite3 CLI
        try {
          const out = execSync(`sqlite3 "${dbPath}" "${query.replace(/"/g, '\\"')}"`, {
            encoding: 'utf-8',
            timeout: 5000
          })
          return out.slice(0, 10000) || '(空结果)'
        } catch (e3) {
          return `无法查询数据库: 需要安装 better-sqlite3 或 sql.js，或系统有 sqlite3 命令行工具`
        }
      }
    }

    if (!rows || !rows.length) return '(空结果)'
    if (typeof rows[0] === 'object') {
      const cols = Object.keys(rows[0]).join(' | ')
      const vals = rows.slice(0, 50).map(r => Object.values(r).map(v => v ?? 'NULL').join(' | ')).join('\n')
      return `列: ${cols}\n${vals}`
    }
    return rows.slice(0, 50).map(r => r.join(' | ')).join('\n')
  } catch (e) {
    return `SQLite 错误: ${e.message}`
  }
}

// ── Docker ──
async function dockerTool(args) {
  try {
    const action = args.action

    switch (action) {
      case 'ps': {
        const all = args.all ? '-a' : ''
        const out = execSync(`docker ps ${all} --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"`, {
          encoding: 'utf-8', timeout: 5000
        })
        return out.trim() || '没有运行中的容器'
      }

      case 'images': {
        const out = execSync('docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"', {
          encoding: 'utf-8', timeout: 5000
        })
        return out.trim() || '没有镜像'
      }

      case 'logs': {
        if (!args.container) return '请指定容器名称或 ID'
        const tail = args.tail || 50
        const out = execSync(`docker logs --tail ${tail} "${args.container}" 2>&1`, {
          encoding: 'utf-8', timeout: 10000
        })
        return out.slice(0, 20000) || '(无日志)'
      }

      case 'start': {
        if (!args.container) return '请指定容器名称或 ID'
        execSync(`docker start "${args.container}"`, { encoding: 'utf-8', timeout: 10000 })
        return `容器 ${args.container} 已启动`
      }

      case 'stop': {
        if (!args.container) return '请指定容器名称或 ID'
        execSync(`docker stop "${args.container}"`, { encoding: 'utf-8', timeout: 15000 })
        return `容器 ${args.container} 已停止`
      }

      case 'inspect': {
        if (!args.container) return '请指定容器名称或 ID'
        const out = execSync(`docker inspect "${args.container}"`, { encoding: 'utf-8', timeout: 5000 })
        const data = JSON.parse(out)
        const c = data[0]
        return [
          `📦 ${c.Name?.replace(/^\//, '')}`,
          `状态: ${c.State?.Status}`,
          `镜像: ${c.Config?.Image}`,
          `创建: ${c.Created?.slice(0, 19)}`,
          `IP: ${c.NetworkSettings?.IPAddress || 'N/A'}`,
          `端口: ${Object.keys(c.NetworkSettings?.Ports || {}).join(', ') || 'N/A'}`,
        ].join('\n')
      }

      case 'stats': {
        const out = execSync('docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}\t{{.MemUsage}}"', {
          encoding: 'utf-8', timeout: 5000
        })
        return out.trim() || '没有运行中的容器'
      }

      default: return `未知操作: ${action}，支持: ps, images, logs, start, stop, inspect, stats`
    }
  } catch (e) {
    if (e.message?.includes('ENOENT') || e.status === 127) return 'Docker 未安装或不在 PATH 中'
    return `Docker 错误: ${e.message?.slice(0, 500) || e}`
  }
}

// ── Amap (高德地图) ──
async function amapTool(args) {
  const key = process.env.AMAP_KEY
  if (!key) return '需要设置 AMAP_KEY 环境变量。免费申请: https://lbs.amap.com/ (控制台 → 应用管理 → 创建新应用 → 获取 Key)'

  const base = 'https://restapi.amap.com/v3'

  try {
    switch (args.action) {
      case 'geocode': {
        if (!args.address) return '请输入地址'
        const res = await fetch(`${base}/geocode/geo?key=${key}&address=${encodeURIComponent(args.address)}${args.city ? '&city=' + encodeURIComponent(args.city) : ''}`)
        if (!res.ok) return `高德 API 错误: ${res.status}`
        const data = await res.json()
        if (data.status !== '1' || !data.geocodes?.length) return `地理编码失败: ${data.info || '无结果'}`
        const g = data.geocodes[0]
        return `📍 ${g.formatted_address || args.address}\n坐标: ${g.location}\n级别: ${g.level || '未知'}\n城市: ${g.city || ''} ${g.district || ''}`
      }

      case 'regeo': {
        if (!args.location) return '请输入经纬度，格式 "lng,lat"'
        if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(args.location)) return '经纬度格式不正确，应为 "lng,lat"，如 "116.397428,39.90923"'
        const res = await fetch(`${base}/geocode/regeo?key=${key}&location=${args.location}`)
        if (!res.ok) return `高德 API 错误: ${res.status}`
        const data = await res.json()
        if (data.status !== '1') return `逆地理编码失败: ${data.info}`
        const r = data.regeocode
        const addr = r.formatted_address || '无地址'
        const ad = r.addressComponent || {}
        return `📍 ${addr}\n坐标: ${args.location}\n省: ${ad.province || ''} 市: ${ad.city || ''} 区: ${ad.district || ''}\n街道: ${ad.streetNumber?.street || ''} ${ad.streetNumber?.number || ''}`
      }

      case 'poi': {
        const keywords = args.keywords || args.address
        if (!keywords) return '请输入搜索关键词'
        const location = args.location || ''
        const radius = args.radius || 1000
        let url = `${base}/place/text?key=${key}&keywords=${encodeURIComponent(keywords)}&offset=10`
        if (location) url += `&location=${location}&radius=${radius}`
        if (args.city) url += `&city=${encodeURIComponent(args.city)}`
        const res = await fetch(url)
        if (!res.ok) return `高德 API 错误: ${res.status}`
        const data = await res.json()
        if (data.status !== '1' || !data.pois?.length) return `POI 搜索无结果: ${keywords}`
        return data.pois.slice(0, 10).map((p, i) =>
          `${i + 1}. ${p.name}\n   地址: ${p.address || '无'}\n   坐标: ${p.location}\n   类型: ${p.type || '未知'}${p.tel ? '\n   电话: ' + p.tel : ''}`
        ).join('\n')
      }

      case 'route': {
        if (!args.origin || !args.destination) return '请输入起点 (origin) 和终点 (destination) 坐标，格式 "lng,lat"'
        if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(args.origin)) return '起点坐标格式不正确'
        if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(args.destination)) return '终点坐标格式不正确'
        const type = args.type || 'driving'
        const typeMap = { driving: '0', walking: '1', transit: '2' }
        const res = await fetch(`${base}/direction/${type}?key=${key}&origin=${args.origin}&destination=${args.destination}&strategy=0&extensions=base`)
        if (!res.ok) return `高德 API 错误: ${res.status}`
        const data = await res.json()
        if (data.status !== '1' || !data.route) return `路径规划失败: ${data.info || '无结果'}`

        if (type === 'transit') {
          const trans = data.route.transits?.[0]
          if (!trans) return '无公交方案'
          const cost = trans.cost || {}
          const duration = trans.duration || 0
          return `🚌 公交方案\n距离: ${(trans.distance / 1000).toFixed(1)}km\n时间: ${Math.round(duration / 60)} 分钟\n费用: ${cost.duration ? cost.duration + '元' : '未知'}\n步行: ${(trans.walking_distance / 1000).toFixed(2)}km`
        }

        const path = data.route.paths?.[0]
        if (!path) return '无驾车/步行方案'
        const distKm = (path.distance / 1000).toFixed(1)
        const mins = Math.round(path.duration / 60)
        const tolls = path.tolls || '0'
        return `${type === 'driving' ? '🚗' : '🚶'} ${type === 'driving' ? '驾车' : '步行'}方案\n距离: ${distKm}km\n预计时间: ${mins} 分钟${type === 'driving' ? '\n路费: ' + tolls + '元' : ''}`
      }

      case 'distance': {
        if (!args.origin || !args.destination) return '请输入起点 (origin) 和终点 (destination) 坐标，格式 "lng,lat"'
        if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(args.origin)) return '起点坐标格式不正确'
        if (!/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(args.destination)) return '终点坐标格式不正确'
        const res = await fetch(`${base}/distance?key=${key}&origins=${args.origin}&destination=${args.destination}&type=1`)
        if (!res.ok) return `高德 API 错误: ${res.status}`
        const data = await res.json()
        if (data.status !== '1' || !data.results?.length) return `距离测量失败: ${data.info || '无结果'}`
        const r = data.results[0]
        return `📏 直线距离: ${(r.distance / 1000).toFixed(2)}km\n驾车距离: ${(r.driving_distance / 1000).toFixed(2)}km`
      }

      default: return `未知操作: ${args.action}，支持: geocode, regeo, poi, route, distance`
    }
  } catch (e) {
    return `高德地图错误: ${e.message}`
  }
}

module.exports = { BUILTIN_DEFS, executeBuiltinTool }
