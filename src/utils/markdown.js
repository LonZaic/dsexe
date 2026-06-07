import { marked } from 'marked'
import hljs from 'highlight.js'
import { renderAll } from './mediaRenderer.js'

// ═══ Marked config — SVG & Mermaid code blocks get dedicated wrappers ═══
marked.use({
    renderer: {
        code({ text, lang }) {
            // Mermaid diagram — sanitize before rendering
            if (lang === 'mermaid') {
                const id = 'm_' + Math.random().toString(36).slice(2, 8)
                const cleaned = sanitizeMermaid(text)
                return `<div class="mermaid-wrap mermaid-loading" data-mermaid-state="loading">
  <div class="mermaid-toolbar">
    <span class="mermaid-status">绘制中...</span>
    <div class="mermaid-actions">
      <button class="mermaid-btn mermaid-dl" title="下载 SVG"></button>
      <button class="mermaid-btn mermaid-full" title="放大查看"></button>
    </div>
  </div>
  <div class="mermaid-body"><pre class="mermaid" id="${id}">${escapeHtml(cleaned)}</pre></div>
</div>\n`
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

// ─── Mermaid sanitizer — fix common AI syntax errors before rendering ───
function sanitizeMermaid(code) {
  let lines = code.split('\n')
  const result = []
  let bracketDepth = 0
  let parenDepth = 0

  const RESERVED = new Set(['end', 'graph', 'subgraph', 'direction', 'class', 'classDef',
    'click', 'callback', 'style', 'linkStyle', 'flowchart', 'sequenceDiagram',
    'classDiagram', 'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie', 'gitgraph'])

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line) { result.push(''); continue }

    // Skip mermaid config lines (init, theme, etc)
    if (/^\s*%%/.test(line)) { result.push(line); continue }

    // Fix: unclosed arrow at end of line → remove it
    line = line.replace(/\s*-->\s*$/, '')
    line = line.replace(/\s*-\.->\s*$/, '')

    // Fix: node labels with Chinese/special chars missing quotes
    // Pattern: A[中文内容] or A(中文内容) — wrap content in quotes if it has CJK
    line = line.replace(/(\w+)\[([^\]]*[一-鿿:：，,。.!！？?、/()[\]【】《》""''][^\]]*)\]/g, (m, id, label) => {
      // Only add quotes if label has special chars and isn't already quoted
      if (!label.startsWith('"') && !label.startsWith("'")) {
        // Escape existing double quotes inside label
        label = label.replace(/"/g, "'")
        return `${id}["${label}"]`
      }
      return m
    })
    line = line.replace(/(\w+)\(([^)]*[一-鿿:：，,。.!！？?、/()[\]【】《》""''][^)]*)\)/g, (m, id, label) => {
      if (!label.startsWith('"') && !label.startsWith("'")) {
        label = label.replace(/"/g, "'")
        return `${id}("${label}")`
      }
      return m
    })

    // Fix: single dash arrow (->) → double (-->)
    line = line.replace(/(?<![-\|])>(?![-\|>])/g, '-->')
    line = line.replace(/-->/g, (m) => {
      // Only fix lines that already have a partial arrow
      return m
    })
    // Actually fix: replace `->` with `-->` (but not inside labels)
    if (/^[^"]*->[^"]*$/.test(line) && !/-->/.test(line)) {
      line = line.replace(/->/g, '-->')
    }

    // Track brackets
    for (const ch of line) {
      if (ch === '[') bracketDepth++
      if (ch === ']') bracketDepth--
      if (ch === '(') parenDepth++
      if (ch === ')') parenDepth--
    }

    // Fix: reserved words as node IDs — append underscore
    const parts = line.match(/^(\w+)/)
    if (parts && RESERVED.has(parts[1].toLowerCase())) {
      line = parts[1] + '_' + line.slice(parts[1].length)
    }

    result.push(line)
  }

  // Auto-close unclosed brackets
  let code2 = result.join('\n')
  while (bracketDepth > 0) { code2 += ']'; bracketDepth-- }
  while (parenDepth > 0) { code2 += ')'; parenDepth-- }

  // Remove trailing incomplete lines (ends with arrow or bracket open)
  code2 = code2.replace(/\n\s*\w+\s*(-->|$)\s*$/g, '')

  return code2
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
