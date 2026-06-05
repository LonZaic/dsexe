// Search API Routes
const { Router } = require('express')
const { webSearch } = require('../search')

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

module.exports = router
