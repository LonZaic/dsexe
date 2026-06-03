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
        if (ext === 'docx') return await extractDocx(buffer)
        if (ext === 'pptx') return await extractPptx(buffer)
        if (ext === 'xlsx') return await extractXlsx(buffer)
        if (ext === 'pdf')  return await extractPdf(buffer)
    } catch { return '' }
    return null
}
