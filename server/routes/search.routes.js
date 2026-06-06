// Search API Routes
const { Router } = require('express')
const { webSearch, webSearchDual, webSearchVerified } = require('../search')
const { crawlPage, crawlUrlDeep } = require('../crawler')

const router = Router()

router.post('/search', async (req, res) => {
  try {
    const { query, maxResults } = req.body
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Missing query' })
    }
    const results = await webSearch(query.trim(), maxResults || 5)
    res.json({ query, results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Dual search (legacy) — now uses verified pipeline internally
router.post('/search/dual', async (req, res) => {
  try {
    const { query, maxResults } = req.body
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Missing query' })
    }
    const text = await webSearchDual(query.trim(), maxResults || 5)
    res.json({ query, text })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Verified search — full accuracy pipeline
router.post('/search/verified', async (req, res) => {
  try {
    const { query, maxResults } = req.body
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Missing query' })
    }
    const text = await webSearchVerified(query.trim(), maxResults || 5)
    res.json({ query, text })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Direct URL crawl — skips search engines, fetches page content directly
// Accepts any valid http/https URL (GitHub, Gitee, articles, code, etc.)
router.post('/search/direct-crawl', async (req, res) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'Missing url' })

    // Validate URL format
    let parsed
    try { parsed = new URL(url) } catch {
      return res.status(400).json({ error: 'Invalid URL format' })
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs are allowed' })
    }
    // SSRF protection: block private/localhost IPs
    const hostname = parsed.hostname.toLowerCase()
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]']
    if (blockedHosts.includes(hostname)) {
      return res.status(400).json({ error: 'Cannot crawl local addresses' })
    }
    // Block private IP ranges
    if (/^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/.test(hostname)) {
      return res.status(400).json({ error: 'Cannot crawl private network addresses' })
    }

    const result = await crawlPage(url)
    if (result && result.content) {
      res.json({ url, text: result.content })
    } else {
      res.json({ url, text: '无法抓取该页面内容' })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Deep URL crawl — for code host repos, fetches ALL files recursively
// For other URLs, does a normal single-page crawl
router.post('/search/deep-crawl', async (req, res) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'Missing url' })

    let parsed
    try { parsed = new URL(url) } catch {
      return res.status(400).json({ error: 'Invalid URL format' })
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs are allowed' })
    }
    const hostname = parsed.hostname.toLowerCase()
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]'].includes(hostname)) {
      return res.status(400).json({ error: 'Cannot crawl local addresses' })
    }
    if (/^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/.test(hostname)) {
      return res.status(400).json({ error: 'Cannot crawl private network addresses' })
    }

    const result = await crawlUrlDeep(url)
    if (result && result.content) {
      res.json({ url, text: result.content })
    } else {
      res.json({ url, text: '无法抓取该页面内容' })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
