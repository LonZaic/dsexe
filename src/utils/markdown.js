import { marked } from 'marked'
import hljs from 'highlight.js'

// Wire marked to highlight.js — no external extension needed
marked.use({
    renderer: {
        code({ text, lang }) {
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

export function renderMarkdown(text) {
    if (!text) return ''
    try {
        return marked.parse(text)
    } catch {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
    }
}
