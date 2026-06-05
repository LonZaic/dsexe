// ══════════════════════════════════════
// Media renderer — SVG + Mermaid inline rendering
// Works across chat & code modes
// Strategy: render immediately, observe for streaming additions
// ══════════════════════════════════════

let _observer = null
let _mermaidReady = false

// ─── Ensure mermaid global is initialized ───
function ensureMermaid() {
  if (typeof window === 'undefined') return false
  if (!window.mermaid) return false
  if (!_mermaidReady) {
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
      })
      _mermaidReady = true
    } catch (e) {
      console.warn('[mediaRenderer] mermaid init failed:', e.message)
      return false
    }
  }
  return true
}

// ─── Render a single SVG block ───
export function renderSvgBlock(wrap) {
  if (!wrap || wrap.hasAttribute('data-rendered')) return
  const raw = wrap.getAttribute('data-svg') || ''
  if (!raw.trim()) {
    wrap.setAttribute('data-rendered', 'empty')
    return
  }
  // Clean: extract <svg>...</svg> if wrapped in markdown artifacts
  let svg = raw.trim()
  const m = svg.match(/<svg[\s\S]*?<\/svg>/i)
  if (m) svg = m[0]
  if (!svg.startsWith('<svg')) {
    wrap.setAttribute('data-rendered', 'invalid')
    return
  }
  try {
    wrap.innerHTML = svg
    wrap.setAttribute('data-rendered', 'true')
  } catch (e) {
    wrap.setAttribute('data-rendered', 'error')
  }
}

// ─── Render a single Mermaid block ───
export async function renderMermaidBlock(el) {
  if (!el || el.hasAttribute('data-processed')) return
  if (!ensureMermaid()) {
    // Retry later when CDN loads
    el.setAttribute('data-processed', 'waiting')
    return
  }
  const code = el.textContent || ''
  if (!code.trim()) {
    el.setAttribute('data-processed', 'empty')
    return
  }
  try {
    const id = 'm_' + Math.random().toString(36).slice(2, 8)
    const { svg } = await window.mermaid.render(id + '_svg', code)
    el.innerHTML = svg
    el.setAttribute('data-processed', 'true')
  } catch (e) {
    // Show error as plain code so user can see what went wrong
    el.setAttribute('data-processed', 'error')
    el.classList.add('mermaid-error')
    el.innerHTML = '<code>' + escapeHtml(code.slice(0, 500)) + '</code>'
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Scan & render all unprocessed blocks ───
export function renderAll() {
  if (typeof document === 'undefined') return

  // SVG blocks
  const svgWraps = document.querySelectorAll('.svg-render-wrap:not([data-rendered])')
  svgWraps.forEach(renderSvgBlock)

  // Mermaid blocks (only if mermaid is loaded)
  if (window.mermaid && ensureMermaid()) {
    const mermaidEls = document.querySelectorAll('.mermaid:not([data-processed])')
    mermaidEls.forEach(el => renderMermaidBlock(el))
  }
}

// ─── MutationObserver — catch streaming content ───
export function startMediaObserver() {
  if (typeof window === 'undefined' || _observer) return

  ensureMermaid()

  _observer = new MutationObserver(() => {
    // Just scan everything — cheap enough with querySelector
    requestAnimationFrame(() => renderAll())
  })

  // Start after DOM ready
  const start = () => {
    if (!document.body) { setTimeout(start, 50); return }
    _observer.observe(document.body, { childList: true, subtree: true })
    renderAll() // initial scan
  }
  start()
}

// Auto-start
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startMediaObserver())
  } else {
    startMediaObserver()
  }
}
