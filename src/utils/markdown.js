import { marked } from 'marked'
import hljs from 'highlight.js'

// Track pending mermaid elements for deferred rendering
let _mermaidPending = false
let _mermaidTimer = null

// Wire marked to highlight.js + Mermaid + SVG support
marked.use({
    renderer: {
        code({ text, lang }) {
            // Mermaid diagrams
            if (lang === 'mermaid') {
                const id = 'mermaid_' + Math.random().toString(36).slice(2, 8)
                return `<div class="mermaid-wrap"><pre class="mermaid" id="${id}">${text}</pre></div>\n`
            }
            // SVG code blocks — render as raw SVG (for charts/diagrams)
            if (lang === 'svg' || lang === 'svg-chart') {
                return `<div class="mermaid-wrap svg-chart-wrap">${text}</div>\n`
            }
            const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
            const highlighted = hljs.highlight(text, { language }).value
            return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`
        },
        link({ href, title, tokens }) {
            const text = marked.parseInline(tokens)
            const titleAttr = title ? ` title="${title}"` : ''
            return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
        },
    },
})

// Also ensure raw HTML (including SVG) passes through marked unscathed
// marked v18 allows raw HTML by default, but we make it explicit
marked.setOptions({
    breaks: true,
    gfm: true,
})

function initMermaid(retries = 0) {
  if (typeof window === 'undefined') return
  if (!window.mermaid) {
    if (retries < 30) setTimeout(() => initMermaid(retries + 1), 200)
    return
  }
  try {
    const els = document.querySelectorAll('.mermaid:not([data-processed])')
    if (els.length > 0) {
      window.mermaid.run({ nodes: Array.from(els) }).catch(() => {})
      els.forEach(el => el.setAttribute('data-processed', 'true'))
    }
  } catch {}
}

export function reinitMermaid() {
  initMermaid(20)
  // Also try again shortly after (for streaming content that may still be loading)
  setTimeout(() => initMermaid(20), 300)
  setTimeout(() => initMermaid(20), 800)
}

export function renderMarkdown(text) {
    if (!text) return ''
    try {
        const html = marked.parse(text)
        // Schedule mermaid rendering — DOM + library may not be ready yet
        // Use staggered retries to catch streaming content as it appears
        if (!_mermaidPending) {
            _mermaidPending = true
            clearTimeout(_mermaidTimer)
            _mermaidTimer = setTimeout(() => { _mermaidPending = false }, 2000)
            setTimeout(() => initMermaid(), 100)
            setTimeout(() => initMermaid(), 400)
            setTimeout(() => initMermaid(), 1200)
        } else {
            // If already pending, just fire once
            setTimeout(() => initMermaid(), 50)
        }
        return html
    } catch {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
    }
}
