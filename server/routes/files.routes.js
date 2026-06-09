// File generation & download routes
const { Router } = require('express')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const router = Router()

const DOWNLOADS_DIR = path.join(__dirname, '..', 'workspace', 'downloads')
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })

// Clean up files older than 1 hour on startup
function cleanupOldFiles(dir = DOWNLOADS_DIR) {
  try {
    const now = Date.now()
    const files = fs.readdirSync(dir)
    for (const f of files) {
      const fp = path.join(dir, f)
      const stat = fs.statSync(fp)
      if (now - stat.mtimeMs > 3600000) fs.unlinkSync(fp)
    }
  } catch {}
}
cleanupOldFiles()
const TEMPLATES_DIR = path.join(__dirname, '..', 'workspace', 'templates')
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true })
cleanupOldFiles(TEMPLATES_DIR)

// Sanitize filename — prevent path traversal, allow only safe chars
function safeFilename(name) {
  return name
    .replace(/\.\./g, '')
    .replace(/[\\\/:*?"<>|]/g, '_')
    .replace(/[\x00-\x1f]/g, '')
    .slice(0, 200) || 'file.txt'
}

// Save text content as a downloadable file
router.post('/files/save', async (req, res) => {
  try {
    const { content, filename } = req.body
    if (!content && content !== '') {
      return res.status(400).json({ error: 'Missing content' })
    }
    const safeName = safeFilename(filename || 'file.txt')
    const id = crypto.randomBytes(8).toString('hex')
    const storedName = `${id}_${safeName}`
    const filePath = path.join(DOWNLOADS_DIR, storedName)

    fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf-8')

    const url = `/api/files/download/${encodeURIComponent(storedName)}`
    res.json({ url, filename: safeName, size: fs.statSync(filePath).size })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Save base64-encoded binary data as a downloadable file (for client-side conversions)
router.post('/files/save-base64', async (req, res) => {
  try {
    const { data, filename } = req.body
    if (!data) return res.status(400).json({ error: 'Missing data' })
    const safeName = safeFilename(filename || 'file.bin')
    const id = crypto.randomBytes(8).toString('hex')
    const storedName = `${id}_${safeName}`
    const filePath = path.join(DOWNLOADS_DIR, storedName)

    // Handle both "data:image/png;base64,xxx" and raw base64
    const base64 = data.replace(/^data:[^;]+;base64,/, '')
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))

    const url = `/api/files/download/${encodeURIComponent(storedName)}`
    res.json({ url, filename: safeName, size: fs.statSync(filePath).size })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Convert SVG to PNG (requires sharp — falls back gracefully if not installed)
router.post('/files/svg2png', async (req, res) => {
  try {
    const { svg, filename, width, height } = req.body
    if (!svg) return res.status(400).json({ error: 'Missing svg content' })
    const safeName = safeFilename(filename || 'image.png')
    const id = crypto.randomBytes(8).toString('hex')
    const storedName = `${id}_${safeName}`

    let sharp
    try { sharp = require('sharp') } catch {
      // sharp not installed — save as SVG instead
      const svgName = storedName.replace(/\.png$/i, '.svg')
      const svgPath = path.join(DOWNLOADS_DIR, svgName)
      fs.writeFileSync(svgPath, svg, 'utf-8')
      return res.json({
        url: `/api/files/download/${encodeURIComponent(svgName)}`,
        filename: svgName.replace(/^\w+_/, ''),
        size: fs.statSync(svgPath).size,
        note: 'sharp未安装，已保存为SVG格式。npm install sharp 即可支持PNG转换。'
      })
    }

    const w = Math.min(parseInt(width) || 800, 4000)
    const h = Math.min(parseInt(height) || 600, 4000)
    const pngPath = path.join(DOWNLOADS_DIR, storedName)

    await sharp(Buffer.from(svg)).resize(w, h, { fit: 'inside', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toFile(pngPath)

    res.json({
      url: `/api/files/download/${encodeURIComponent(storedName)}`,
      filename: safeName,
      size: fs.statSync(pngPath).size
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Create ZIP from multiple file contents (uses JSZip — already in package.json)
router.post('/files/zip', async (req, res) => {
  try {
    const { files } = req.body  // [{ filename, content?, url? }]
    if (!files || !files.length) return res.status(400).json({ error: 'Missing files array' })

    const JSZip = require('jszip')
    const zip = new JSZip()

    for (const f of files) {
      const name = safeFilename(f.filename || 'file.txt')
      let content

      if (f.url) {
        // Fetch file content from download URL (e.g. /api/files/download/abc_file.svg)
        const urlPath = f.url.split('?')[0] // strip query params
        const urlName = decodeURIComponent(urlPath.split('/').pop() || '')
        const localPath = path.join(DOWNLOADS_DIR, safeFilename(urlName))
        if (fs.existsSync(localPath)) {
          content = fs.readFileSync(localPath)
        } else {
          content = Buffer.from(f.content || `[无法读取: ${f.url}]`, 'utf-8')
        }
      } else {
        content = typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2)
      }
      zip.file(name, content)
    }

    const safeName = safeFilename('files.zip')
    const id = crypto.randomBytes(8).toString('hex')
    const storedName = `${id}_${safeName}`
    const zipPath = path.join(DOWNLOADS_DIR, storedName)

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
    fs.writeFileSync(zipPath, zipBuffer)

    res.json({
      url: `/api/files/download/${encodeURIComponent(storedName)}`,
      filename: safeName,
      size: fs.statSync(zipPath).size
    })
  } catch (e) {
    console.error('[zip]', e)
    res.status(500).json({ error: e.message })
  }
})

// ═══ Document & Audio Generation ═══
// Generates binary formats: .docx .xlsx .pptx .pdf .wav
// AI provides structured JSON → server builds the file
router.post('/files/generate', async (req, res) => {
  try {
    const { content, filename } = req.body
    if (!content && content !== '') return res.status(400).json({ error: 'Missing content' })
    const safeName = safeFilename(filename || 'document.docx')
    const id = crypto.randomBytes(8).toString('hex')
    const storedName = `${id}_${safeName}`
    const filePath = path.join(DOWNLOADS_DIR, storedName)
    const ext = path.extname(safeName).toLowerCase()

    // Parse content — AI provides either JSON string or already-structured object
    let data
    try {
      data = typeof content === 'string' ? JSON.parse(content) : content
    } catch {
      data = { text: String(content) }
    }

    if (ext === '.docx') {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx')
      const elements = data.elements || []
      const children = []
      for (const el of elements) {
        if (el.type === 'h1') {
          children.push(new Paragraph({ text: el.text || '', heading: HeadingLevel.HEADING_1, spacing: { after: 240 } }))
        } else if (el.type === 'h2') {
          children.push(new Paragraph({ text: el.text || '', heading: HeadingLevel.HEADING_2, spacing: { after: 180 } }))
        } else if (el.type === 'h3') {
          children.push(new Paragraph({ text: el.text || '', heading: HeadingLevel.HEADING_3, spacing: { after: 140 } }))
        } else if (el.type === 'p') {
          children.push(new Paragraph({ children: [new TextRun({ text: el.text || '', size: 22 })], spacing: { after: 120 } }))
        } else if (el.type === 'code') {
          children.push(new Paragraph({ children: [new TextRun({ text: el.text || '', font: 'Courier New', size: 18 })], spacing: { after: 100, indent: { left: 360 } } }))
        } else if (el.type === 'list' && el.items) {
          for (const item of el.items) {
            children.push(new Paragraph({ children: [new TextRun({ text: `  •  ${item}`, size: 22 })], spacing: { after: 60 } }))
          }
        } else if (el.type === 'table' && el.rows) {
          const headers = el.headers || []
          const allRows = headers.length ? [headers, ...(el.rows || [])] : (el.rows || [])
          const colCount = Math.max(...allRows.map(r => Array.isArray(r) ? r.length : 0), 1)
          const tableRows = allRows.map((row, ri) => {
            const cells = Array.isArray(row) ? row : [row]
            return new TableRow({
              children: Array.from({ length: colCount }, (_, ci) => {
                const text = String(cells[ci] != null ? cells[ci] : '')
                return new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text, size: ri === 0 && headers.length ? 22 : 20, bold: ri === 0 && headers.length > 0 })], alignment: AlignmentType.LEFT })],
                  width: { size: Math.floor(9000 / colCount), type: WidthType.DXA },
                  shading: ri === 0 && headers.length ? { fill: 'E8E8E8' } : undefined
                })
              })
            })
          })
          children.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }))
          children.push(new Paragraph({ spacing: { after: 200 }, children: [] }))
        }
      }
      if (!children.length) {
        children.push(new Paragraph({ children: [new TextRun({ text: data.text || String(content) || '', size: 22 })] }))
      }
      const doc = new Document({ sections: [{ children }] })
      const buf = await Packer.toBuffer(doc)
      fs.writeFileSync(filePath, buf)
    } else if (ext === '.xlsx') {
      const ExcelJS = require('exceljs')
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet(data.sheetName || 'Sheet1')
      if (data.headers && data.headers.length) {
        const headerRow = ws.addRow(data.headers)
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
        headerRow.alignment = { horizontal: 'center' }
      }
      const rows = data.rows || []
      const allRows = Array.isArray(rows[0]) ? rows : rows.map(r => [r])
      for (const row of allRows) {
        ws.addRow(Array.isArray(row) ? row : [row])
      }
      ws.columns.forEach(col => { col.width = Math.min(Math.max(col.width || 10, 10), 50) })
      await wb.xlsx.writeFile(filePath)
    } else if (ext === '.pptx') {
      const PptxGenJS = require('pptxgenjs')
      const pptx = new PptxGenJS()
      pptx.defineLayout({ name: 'CUSTOM', width: '100%', height: '100%' })
      pptx.layout = 'LAYOUT_WIDE'
      const slides = data.slides || []
      if (!slides.length && data.title) {
        slides.push({ title: data.title, content: data.elements ? data.elements.filter(e => e.type === 'p' || e.type === 'list').flatMap(e => e.type === 'list' ? (e.items || []) : [e.text]) : [] })
      }
      for (const s of slides) {
        const slide = pptx.addSlide()
        if (s.title) {
          slide.addText(s.title, { x: 0.6, y: 0.4, w: '85%', h: 0.8, fontSize: 28, bold: true, color: '2C3E50' })
        }
        const items = Array.isArray(s.content) ? s.content : (s.content ? [s.content] : [])
        items.forEach((item, i) => {
          const text = typeof item === 'string' ? item : (item.text || String(item))
          slide.addText(text, { x: 0.8, y: 1.4 + i * 0.7, w: '80%', fontSize: 16, bullet: true, color: '555555' })
        })
      }
      await pptx.writeFile({ fileName: filePath })
    } else if (ext === '.pdf') {
      const PDFDocument = require('pdfkit')
      const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true })
      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)

      // Register a basic CJK-capable font fallback — pdfkit ships with Helvetica by default
      doc.font('Helvetica')

      if (data.title) {
        doc.fontSize(20).text(data.title, { align: 'center' })
        doc.moveDown(0.8)
      }

      const elements = data.elements || []
      for (const el of elements) {
        if (el.type === 'h1') { doc.moveDown(0.3); doc.fontSize(16).text(el.text || ''); doc.moveDown(0.2) }
        else if (el.type === 'h2') { doc.moveDown(0.2); doc.fontSize(13).text(el.text || ''); doc.moveDown(0.15) }
        else if (el.type === 'h3') { doc.moveDown(0.15); doc.fontSize(11).text(el.text || '', { underline: false }); doc.moveDown(0.1) }
        else if (el.type === 'p') { doc.fontSize(10).text(el.text || '', { lineGap: 4 }); doc.moveDown(0.15) }
        else if (el.type === 'code') { doc.font('Courier').fontSize(9).text(el.text || '', { indent: 10 }); doc.font('Helvetica'); doc.moveDown(0.15) }
        else if (el.type === 'list' && el.items) { for (const item of el.items) { doc.fontSize(10).text('  •  ' + item); } doc.moveDown(0.15) }
        else if (el.type === 'table' && el.rows) {
          const headers = el.headers || []
          const colW = (doc.page.width - 100) / (headers.length || 2)
          const startY = doc.y
          doc.fontSize(9)
          if (headers.length) {
            headers.forEach((h, i) => { doc.text(String(h), 50 + i * colW, startY, { width: colW, bold: true }) })
          }
          let y = startY + (headers.length ? 18 : 0)
          for (const row of (el.rows || [])) {
            const cells = Array.isArray(row) ? row : [row]
            cells.forEach((cell, i) => { doc.text(String(cell != null ? cell : ''), 50 + i * colW, y, { width: colW }) })
            y += 16
          }
          doc.y = y + 8
        }
      }
      if (!elements.length && data.text) {
        doc.fontSize(10).text(String(data.text), { lineGap: 4 })
      }
      doc.end()
      await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject) })
    } else if (ext === '.wav') {
      const sampleRate = data.sampleRate || 44100
      const freq = data.frequency || 440
      const duration = Math.min(data.duration || 2, 30)
      const waveform = data.waveform || 'sine'
      const numSamples = Math.floor(sampleRate * duration)
      const amplitude = 0.6

      const samples = new Int16Array(numSamples)
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        let val = 0
        if (waveform === 'sine') val = Math.sin(2 * Math.PI * freq * t)
        else if (waveform === 'square') val = Math.sin(2 * Math.PI * freq * t) >= 0 ? 1 : -1
        else if (waveform === 'sawtooth') val = 2 * ((freq * t) % 1) - 1
        else if (waveform === 'triangle') val = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1
        // Apply envelope — fade in/out
        const attack = Math.min(t / 0.02, 1)
        const release = Math.min((duration - t) / 0.05, 1)
        samples[i] = Math.floor(val * 32767 * amplitude * attack * release)
      }

      const numChannels = 1, bitsPerSample = 16
      const blockAlign = numChannels * bitsPerSample / 8
      const dataSize = numSamples * blockAlign
      const buf = Buffer.alloc(44 + dataSize)

      buf.write('RIFF', 0)
      buf.writeUInt32LE(36 + dataSize, 4)
      buf.write('WAVE', 8)
      buf.write('fmt ', 12)
      buf.writeUInt32LE(16, 16)
      buf.writeUInt16LE(1, 20)
      buf.writeUInt16LE(numChannels, 22)
      buf.writeUInt32LE(sampleRate, 24)
      buf.writeUInt32LE(sampleRate * blockAlign, 28)
      buf.writeUInt16LE(blockAlign, 32)
      buf.writeUInt16LE(bitsPerSample, 34)
      buf.write('data', 36)
      buf.writeUInt32LE(dataSize, 40)
      Buffer.from(samples.buffer).copy(buf, 44)

      fs.writeFileSync(filePath, buf)
    } else if (ext === '.pdf' && data.type === 'pdf-direct') {
      // Direct HTML/Text → PDF using pdfkit
      const PDFDocument = require('pdfkit')
      const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 }, bufferPages: true })
      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)

      const pdfContent = data.html || data.text || ''
      // Simple HTML→text rendering (no full HTML engine — use structured approach)
      doc.font('Helvetica').fontSize(10)
      const lines = pdfContent.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?p[^>]*>/gi, '\n').replace(/<[^>]+>/g, '').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) { doc.moveDown(0.3); continue }
        if (trimmed.startsWith('# ')) { doc.fontSize(18).text(trimmed.slice(2), { align: 'left' }); doc.fontSize(10); doc.moveDown(0.3) }
        else if (trimmed.startsWith('## ')) { doc.fontSize(14).text(trimmed.slice(3), { align: 'left' }); doc.fontSize(10); doc.moveDown(0.2) }
        else if (trimmed.startsWith('### ')) { doc.fontSize(12).text(trimmed.slice(4), { align: 'left' }); doc.fontSize(10); doc.moveDown(0.15) }
        else { doc.text(trimmed, { lineGap: 3 }); doc.moveDown(0.1) }
      }
      doc.end()
      await new Promise((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject) })
    } else {
      return res.status(400).json({ error: `Unsupported format: ${ext}. Supported: .docx .xlsx .pptx .pdf .wav` })
    }

    const url = `/api/files/download/${encodeURIComponent(storedName)}`
    res.json({ url, filename: safeName, size: fs.statSync(filePath).size })
  } catch (e) {
    console.error('[generate]', e)
    res.status(500).json({ error: e.message })
  }
})

// Serve downloaded files
router.get('/files/download/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const filePath = path.join(DOWNLOADS_DIR, safeFilename(name))

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found or expired' })
    }

    const ext = path.extname(name).toLowerCase()
    const mimeMap = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf', '.zip': 'application/zip',
      '.json': 'application/json', '.xml': 'application/xml',
      '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
      '.md': 'text/markdown', '.csv': 'text/csv',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
      '.ts': 'text/typescript', '.py': 'text/x-python-script', '.java': 'text/x-java-source',
      '.cpp': 'text/x-c++src', '.c': 'text/x-csrc',
      '.drawio': 'application/xml', '.xml': 'application/xml',
    }
    const mime = mimeMap[ext] || 'application/octet-stream'
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name.replace(/^\w+_/, ''))}`)
    fs.createReadStream(filePath).pipe(res)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ═══ Word Template Fill ═══

// Upload a .docx template to server
router.post('/files/upload-template', async (req, res) => {
  try {
    const { data, filename } = req.body
    if (!data) return res.status(400).json({ error: 'Missing template data' })
    const safeName = safeFilename(filename || 'template.docx')
    const id = crypto.randomBytes(8).toString('hex')
    const storedName = `${id}_${safeName}`
    const filePath = path.join(TEMPLATES_DIR, storedName)
    const base64 = data.replace(/^data:[^;]+;base64,/, '')
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
    res.json({ templateId: storedName, filename: safeName })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Parse a template to extract placeholders
router.post('/files/parse-template', async (req, res) => {
  try {
    const { templateId } = req.body
    if (!templateId) return res.status(400).json({ error: 'Missing templateId' })
    const filePath = path.join(TEMPLATES_DIR, safeFilename(templateId))
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Template not found or expired. Please re-upload.' })
    }
    const PizZip = require('pizzip')
    const content = fs.readFileSync(filePath)
    const zip = new PizZip(content)
    const fullText = zip.file('word/document.xml')?.asText() || ''
    // Extract {xxx} text placeholders
    const textTags = (fullText.match(/\{[a-zA-Z_一-鿿][a-zA-Z0-9_一-鿿]*\}/g) || [])
      .filter(t => !t.startsWith('{%'))  // exclude docxtemplater image tags
      .map(t => t.slice(1, -1))
    // Extract {%xxx} image placeholders
    const imageTags = (fullText.match(/\{%[a-zA-Z_一-鿿][a-zA-Z0-9_一-鿿]*\}/g) || [])
      .map(t => t.slice(2, -1))
    res.json({ textPlaceholders: [...new Set(textTags)], imagePlaceholders: [...new Set(imageTags)], templateId })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Fill a template with content and images
router.post('/files/fill-template', async (req, res) => {
  try {
    const { templateId, content, images } = req.body
    if (!templateId) return res.status(400).json({ error: 'Missing templateId' })
    const filePath = path.join(TEMPLATES_DIR, safeFilename(templateId))
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Template not found or expired. Please re-upload.' })
    }
    const PizZip = require('pizzip')
    const Docxtemplater = require('docxtemplater')
    const ImageModule = require('docxtemplater-image-module-free')

    const templateBytes = fs.readFileSync(filePath)
    const zip = new PizZip(templateBytes)

    // Pre-process: convert {image:xxx} placeholders in XML to {%xxx} for docxtemplater
    let docXml = zip.file('word/document.xml')?.asText() || ''
    const inlineImgRegex = /\{image:([a-zA-Z_一-鿿][a-zA-Z0-9_一-鿿]*)\}/g
    let hasInlineImages = false
    docXml = docXml.replace(inlineImgRegex, (match, name) => {
      hasInlineImages = true
      return `{%${name}}`
    })
    if (hasInlineImages) {
      zip.file('word/document.xml', docXml)
    }

    const imageList = images || []
    const imageOpts = {
      centered: false,
      getImage(tagValue) {
        const img = imageList.find(i => i.name === tagValue)
        if (!img || !img.data) {
          return Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
        }
        return Buffer.from(img.data.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      },
      getSize() { return [400, 300] }
    }

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [new ImageModule(imageOpts)]
    })

    doc.setData(content || {})
    try {
      doc.render()
    } catch (renderErr) {
      return res.status(400).json({
        status: 'error',
        error: 'Template fill failed',
        detail: renderErr.message,
        hint: '请检查占位符名称是否与模板完全一致，或是否有缺失的字段。'
      })
    }

    const outputBuf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    const outputName = (content?.filename || 'filled-document').replace(/\.docx$/i, '') + '.docx'
    const safeName = safeFilename(outputName)
    const id = crypto.randomBytes(8).toString('hex')
    const storedName = `${id}_${safeName}`
    const outputPath = path.join(DOWNLOADS_DIR, storedName)
    fs.writeFileSync(outputPath, outputBuf)
    const url = `/api/files/download/${encodeURIComponent(storedName)}`
    res.json({ url, filename: safeName, size: fs.statSync(outputPath).size })
  } catch (e) {
    console.error('[fill-template]', e)
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
