// Weather API Routes — Open-Meteo (free, no key)
const { Router } = require('express')
const https = require('https')

const router = Router()

const WMO_CODES = {
  0: '晴天', 1: '大部晴朗', 2: '多云', 3: '阴天',
  45: '雾', 48: '霜雾',
  51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪',
  80: '阵雨', 81: '中阵雨', 82: '大阵雨',
  85: '小阵雪', 86: '大阵雪',
  95: '雷暴', 96: '雷暴+冰雹', 99: '强雷暴+冰雹',
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(new Error('JSON parse failed')) }
      })
      res.on('error', reject)
    }).on('timeout', function () { this.destroy(); reject(new Error('timeout')) })
    .on('error', reject)
  })
}

router.get('/weather', async (req, res) => {
  try {
    const { city, lat, lon, days } = req.query
    const forecastDays = Math.min(parseInt(days) || 7, 16)

    let latitude, longitude, cityName

    if (lat && lon) {
      latitude = parseFloat(lat)
      longitude = parseFloat(lon)
      cityName = city || `${lat},${lon}`
    } else if (city) {
      // ─── Clean input ───
      let q = city.trim()
        .replace(/[度°]/, '')                          // "30°" → "30"
        .replace(/[天气预报气温温度湿度]$/, '')          // "佛山天气" → "佛山"
        .replace(/[今明后昨大][天日]/, '')               // "佛山明天" → "佛山"
        .replace(/[的早晚上下周]/, '')                   // "佛山今晚" → "佛山"
        .replace(/^[省市]$/g, '')                        // remove bare "省""市"
        .trim()
      if (!q) q = city.trim()

      async function geocode(query) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=zh`
        const d = await fetchJSON(url)
        return d.results?.[0] || null
      }

      let result = await geocode(q)

      // ─── Fallback chain ───
      if (!result) {
        const candidates = []

        // "广东佛山" → try last 2 chars "佛山"
        if (q.length > 3) candidates.push(q.slice(-2))
        // "广州市天河区" → strip 市/区 → "广州天河" → try each
        const stripped = q.replace(/[市 ]/g, '').replace(/[区]$/, '')
        if (stripped !== q) candidates.push(stripped)
        // "佛山南海" → try first 2 chars "佛山"
        if (q.length > 2 && q.length <= 5) candidates.push(q.slice(0, 2))
        // "南海" or 3+ chars that are still failing → try prepending "广州" or search as-is with count=5
        if (q.length <= 3) candidates.push(q)

        for (const c of [...new Set(candidates)]) {
          result = await geocode(c)
          if (result) break
        }
      }

      if (!result) {
        return res.status(404).json({ error: `未找到该城市: ${city}` })
      }

      latitude = result.latitude
      longitude = result.longitude
      cityName = result.name + (result.admin1 ? `, ${result.admin1}` : '') + (result.country ? `, ${result.country}` : '')
    } else {
      return res.status(400).json({ error: '请提供 city 或 lat/lon 参数' })
    }

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max&timezone=Asia/Shanghai&forecast_days=${forecastDays}`
    const data = await fetchJSON(weatherUrl)

    const days_data = data.daily.time.map((date, i) => ({
      date,
      temp_max: data.daily.temperature_2m_max[i],
      temp_min: data.daily.temperature_2m_min[i],
      weather: WMO_CODES[data.daily.weather_code[i]] || '未知',
      precip_prob: data.daily.precipitation_probability_max[i],
      wind_max: data.daily.wind_speed_10m_max[i],
    }))

    res.json({ city: cityName, latitude, longitude, days: days_data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
