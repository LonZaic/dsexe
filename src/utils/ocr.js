// ══════════════════════════════════════
// OCR — Browser-based Image Text Recognition via Tesseract.js
// Industry-standard OCR engine, runs entirely in browser, works offline
// ══════════════════════════════════════

import Tesseract from 'tesseract.js'

// In-memory cache — avoid re-OCR-ing the same image
const _cache = new Map()
const MAX_CACHE = 100

// Track active workers to avoid overwhelming the browser
let _activeWorkers = 0
const MAX_WORKERS = 2

/**
 * Extract text from an image using Tesseract.js OCR
 * @param {string} base64DataUrl - data:image/...;base64,...
 * @param {string} filename - original filename (for context)
 * @returns {Promise<string>} extracted text, or empty string on failure
 */
export async function extractImageText(base64DataUrl, filename) {
  if (!base64DataUrl) return ''

  // Check cache
  const cacheKey = base64DataUrl.slice(0, 200)
  if (_cache.has(cacheKey)) {
    return _cache.get(cacheKey)
  }

  // Throttle if too many workers
  if (_activeWorkers >= MAX_WORKERS) {
    return ''  // skip — will try on next message if image is still pending
  }

  _activeWorkers++
  try {
    // Detect language hint from filename or default to chi_sim+eng
    const result = await Tesseract.recognize(base64DataUrl, 'chi_sim+eng', {
      logger: () => {}, // silent
    })

    const text = result.data.text?.trim() || ''

    // Cache result
    if (_cache.size >= MAX_CACHE) {
      const firstKey = _cache.keys().next().value
      _cache.delete(firstKey)
    }
    _cache.set(cacheKey, text)

    _activeWorkers--
    return text
  } catch (e) {
    _activeWorkers--
    console.warn('[OCR] Tesseract failed:', e.message)
    return ''
  }
}

/**
 * Extract text from an image and format it for AI context
 * @returns {Promise<string>} formatted string for model context
 */
export async function ocrForContext(base64DataUrl, filename) {
  const text = await extractImageText(base64DataUrl, filename)
  if (!text) return `[图片: ${filename}]`
  return `[图片 OCR 识别文字: ${filename}]\n${text}`
}
