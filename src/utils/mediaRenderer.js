// ══════════════════════════════════════
// Media renderer — SVG + Mermaid inline rendering
// Works across chat & code modes
// Mermaid: loading placeholder -> rendered with toolbar (download / expand)
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
    el.setAttribute('data-processed', 'waiting')
    return
  }
  const code = el.textContent || ''
  if (!code.trim()) {
    el.setAttribute('data-processed', 'empty')
    return
  }

  // Find the wrapper
  const wrap = el.closest('.mermaid-wrap')
  if (!wrap) return

  try {
    const id = 'm_' + Math.random().toString(36).slice(2, 8)
    const { svg } = await window.mermaid.render(id + '_svg', code)

    // Replace body content with rendered SVG
    const body = wrap.querySelector('.mermaid-body')
    if (body) {
      body.innerHTML = svg
    }

    // Update status text
    const status = wrap.querySelector('.mermaid-status')
    if (status) status.textContent = 'Mermaid'

    // Switch state from loading to rendered
    wrap.classList.remove('mermaid-loading')
    wrap.setAttribute('data-mermaid-state', 'rendered')
    el.setAttribute('data-processed', 'true')
  } catch (e) {
    wrap.classList.remove('mermaid-loading')
    wrap.setAttribute('data-mermaid-state', 'error')
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

// ─── Event delegation for mermaid toolbar buttons ───
// (Vue v-html strips inline onclick, so we use document-level delegation)
let _mermaidDelegationInstalled = false
function installMermaidDelegation() {
  if (_mermaidDelegationInstalled || typeof document === 'undefined') return
  _mermaidDelegationInstalled = true

  document.addEventListener('click', function(e) {
    // Download button
    const dlBtn = e.target.closest('.mermaid-dl')
    if (dlBtn) {
      e.stopPropagation()
      const wrap = dlBtn.closest('.mermaid-wrap')
      if (!wrap) return
      const svg = wrap.querySelector('.mermaid-body svg')
      if (!svg) return
      const clone = svg.cloneNode(true)
      const data = new XMLSerializer().serializeToString(clone)
      const blob = new Blob([data], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'diagram.svg'
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    // Expand button
    const fullBtn = e.target.closest('.mermaid-full')
    if (fullBtn) {
      e.stopPropagation()
      const wrap = fullBtn.closest('.mermaid-wrap')
      if (!wrap) return
      const svg = wrap.querySelector('.mermaid-body svg')
      if (!svg) return

      const existing = document.querySelector('.mermaid-overlay')
      if (existing) existing.remove()

      const clone = svg.cloneNode(true)
      const overlay = document.createElement('div')
      overlay.className = 'mermaid-overlay'
      overlay.innerHTML = '<div class="mermaid-overlay-close" title="关闭"></div>'
      const inner = document.createElement('div')
      inner.className = 'mermaid-overlay-inner'
      inner.appendChild(clone)
      overlay.appendChild(inner)

      overlay.addEventListener('click', function(ev) {
        if (ev.target === overlay || ev.target.classList.contains('mermaid-overlay-close')) {
          overlay.remove()
        }
      })
      const onKey = function(ev) {
        if (ev.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey) }
      }
      document.addEventListener('keydown', onKey)

      document.body.appendChild(overlay)
    }
  })
}

// ─── MutationObserver — catch streaming content ───
export function startMediaObserver() {
  if (typeof window === 'undefined' || _observer) return

  ensureMermaid()
  installMermaidDelegation()

  _observer = new MutationObserver(() => {
    requestAnimationFrame(() => renderAll())
  })

  // Start after DOM ready
  const start = () => {
    if (!document.body) { setTimeout(start, 50); return }
    _observer.observe(document.body, { childList: true, subtree: true })
    renderAll()
  }
  start()
}

// Auto-start
if (typeof window !== 'undefined') {
  installMermaidDelegation()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startMediaObserver())
  } else {
    startMediaObserver()
  }
}
