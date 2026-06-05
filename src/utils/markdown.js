import { marked } from 'marked'
import hljs from 'highlight.js'

// Wire marked to highlight.js + Mermaid support
marked.use({
    renderer: {
        code({ text, lang }) {
            // Mermaid diagrams
            if (lang === 'mermaid') {
                const id = 'mermaid_' + Math.random().toString(36).slice(2, 8)
                return `<div class="mermaid-wrap"><pre class="mermaid" id="${id}">${text}</pre></div>\n`
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

let _mermaidLoaded = false
function initMermaid() {
  if (_mermaidLoaded) return
  if (typeof window !== 'undefined' && window.mermaid) {
    try {
      window.mermaid.run({ querySelector: '.mermaid' })
      _mermaidLoaded = true
    } catch {}
  }
}

export function renderMarkdown(text) {
    if (!text) return ''
    try {
        const html = marked.parse(text)
        // Init Mermaid after render
        setTimeout(initMermaid, 100)
        return html
    } catch {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
    }
}
