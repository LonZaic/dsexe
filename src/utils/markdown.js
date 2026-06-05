import { marked } from 'marked'
import hljs from 'highlight.js'
import { renderAll } from './mediaRenderer.js'

// ═══ Marked config — SVG & Mermaid code blocks get dedicated wrappers ═══
marked.use({
    renderer: {
        code({ text, lang }) {
            // Mermaid diagram
            if (lang === 'mermaid') {
                const id = 'm_' + Math.random().toString(36).slice(2, 8)
                return `<div class="mermaid-wrap"><pre class="mermaid" id="${id}">${escapeHtml(text)}</pre></div>\n`
            }
            // SVG chart — render inline directly
            if (lang === 'svg' || lang === 'svg-chart') {
                // Extract <svg>...</svg> and render immediately
                let svg = text.trim()
                const m = svg.match(/<svg[\s\S]*?<\/svg>/i)
                if (m) svg = m[0]
                if (svg.startsWith('<svg')) {
                    return `<div class="svg-render-wrap svg-chart-wrap" data-svg="${escapeAttr(svg)}" data-rendered="true">${svg}</div>\n`
                }
                // Not valid SVG — show as code
                return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>\n`
            }
            // Regular code block
            const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
            const highlighted = hljs.highlight(text, { language }).value
            return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`
        },
        // Raw inline HTML containing SVG (AI writes <svg> directly in markdown)
        html({ text }) {
            if (/^\s*<svg\b/i.test(text) && /<\/svg>\s*$/i.test(text)) {
                return `<div class="svg-render-wrap" data-svg="${escapeAttr(text)}" data-rendered="true">${text}</div>`
            }
            return text
        },
        link({ href, title, tokens }) {
            const text = marked.parseInline(tokens)
            const titleAttr = title ? ` title="${title}"` : ''
            return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
        },
    },
})

marked.setOptions({ breaks: true, gfm: true })

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Public API ───
export function renderMarkdown(text) {
    if (!text) return ''
    try {
        const html = marked.parse(text)
        // Trigger render for anything the MutationObserver hasn't caught yet
        setTimeout(() => renderAll(), 0)
        return html
    } catch {
        return escapeHtml(text).replace(/\n/g, '<br>')
    }
}

export function reinitMermaid() {
    setTimeout(() => renderAll(), 50)
    setTimeout(() => renderAll(), 300)
}
