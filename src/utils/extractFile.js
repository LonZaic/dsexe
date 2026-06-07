import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// ─── docx / pptx / xlsx / pdf text extraction ───

async function extractDocx(buffer) {
    const zip = await JSZip.loadAsync(buffer)
    const docXml = await zip.file('word/document.xml')?.async('string')
    if (!docXml) return ''
    return docXml.replace(/<w:p[ >]/g, '\n').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

async function extractPptx(buffer) {
    const zip = await JSZip.loadAsync(buffer)
    const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort()
    const texts = []
    for (let i = 0; i < slideFiles.length; i++) {
        const xml = await zip.file(slideFiles[i])?.async('string')
        if (!xml) continue
        const text = xml.replace(/<a:p[ >]/g, '\n').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim()
        if (text) texts.push(`--- 第${i + 1}页 ---\n${text}`)
    }
    return texts.join('\n\n')
}

async function extractXlsx(buffer) {
    const zip = await JSZip.loadAsync(buffer)
    const stringsXml = await zip.file('xl/sharedStrings.xml')?.async('string')
    if (!stringsXml) return ''
    const items = stringsXml.match(/<t[^>]*>([^<]+)<\/t>/g) || []
    return items.map(s => s.replace(/<[^>]+>/g, '')).join('\t')
}

async function extractPdf(buffer) {
    const data = new Uint8Array(buffer)
    const doc = await pdfjsLib.getDocument({ data }).promise
    const pages = []
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        const text = content.items.map(it => it.str).join(' ')
        if (text.trim()) pages.push(text.trim())
    }
    return pages.join('\n\n')
}

export async function extractFileContent(file) {
    const ext = (file.name || '').split('.').pop()?.toLowerCase()
    const buffer = await file.arrayBuffer()
    try {
        if (ext === 'docx' || ext === 'doc') return await extractDocx(buffer)
        if (ext === 'pptx' || ext === 'ppt') return await extractPptx(buffer)
        if (ext === 'xlsx' || ext === 'xls') return await extractXlsx(buffer)
        if (ext === 'pdf')  return await extractPdf(buffer)
    } catch { return '' }
    return null
}

/**
 * Check if a filename is a text-based file that can be read directly
 * Covers 80+ common text formats — code, config, markup, data
 */
export function isTextFile(filename) {
    const ext = (filename || '').split('.').pop()?.toLowerCase()
    if (!ext) return false
    const textExts = new Set([
        // Code
        'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'pyw',
        'css', 'scss', 'sass', 'less', 'styl',
        'html', 'htm', 'xhtml', 'svg', 'xml', 'xsl', 'xslt',
        'json', 'jsonc', 'json5', 'geojson',
        'md', 'mdx', 'markdown', 'rst', 'adoc',
        'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'env',
        'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1',
        'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hh', 'hxx',
        'java', 'kt', 'kts', 'scala', 'groovy',
        'go', 'rs', 'rb', 'php', 'pl', 'pm', 'tcl',
        'swift', 'r', 'jl', 'lua', 'dart', 'nim', 'zig',
        'sql', 'prisma', 'graphql', 'cypher',
        'vue', 'svelte', 'astro', 'solid',
        'txt', 'log', 'csv', 'tsv', 'psv',
        'diff', 'patch',
        'tex', 'latex', 'bib', 'sty',
        'proto', 'thrift', 'avsc',
        'dockerfile', 'makefile', 'cmake', 'gitignore', 'editorconfig',
        'nginx', 'haproxy',
        'properties', 'gradle', 'lock',
        'ino', 'pde', // Arduino
    ])
    if (textExts.has(ext)) return true
    // Handle dotfiles and special names
    const name = (filename || '').toLowerCase()
    if (name === 'dockerfile' || name === 'makefile' || name === 'cmakelists.txt' ||
        name === 'jenkinsfile' || name === 'vagrantfile' || name === '.gitignore' ||
        name === '.editorconfig' || name === '.env' || name === '.npmrc') return true
    return false
}

/**
 * Check if a filename is an image
 */
export function isImageFile(filename) {
    const ext = (filename || '').split('.').pop()?.toLowerCase()
    const imageExts = new Set([
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp',
        'svg', 'ico', 'tiff', 'tif', 'avif', 'apng', 'heic', 'heif'
    ])
    return imageExts.has(ext)
}
