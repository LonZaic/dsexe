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
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`
      const geo = await fetchJSON(geoUrl)
      if (!geo.results?.length) {
        return res.status(404).json({ error: '未找到该城市' })
      }
      const r = geo.results[0]
      latitude = r.latitude
      longitude = r.longitude
      cityName = r.name + (r.admin1 ? `, ${r.admin1}` : '') + (r.country ? `, ${r.country}` : '')
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
