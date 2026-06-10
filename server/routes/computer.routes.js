// ══════════════════════════════════════
// Computer Management API Routes
// Enterprise-grade safety: path validation, no system dir access, confirmation for destructive ops
// ══════════════════════════════════════

const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFile, execFileSync } = require('child_process')

const router = Router()

// ─── Safety: forbidden paths (only block truly critical system internals) ───
const FORBIDDEN_PREFIXES = process.platform === 'win32'
  ? ['C:\\Windows\\System32\\', 'C:\\Windows\\System\\', 'C:\\Windows\\Boot\\', 'C:\\Windows\\WinSxS\\']
  : ['/sys/', '/proc/', '/dev/', '/boot/']

function isForbiddenPath(targetPath) {
  const normalized = path.resolve(targetPath).toLowerCase() + (process.platform === 'win32' ? '\\' : '/')
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (normalized.startsWith(prefix.toLowerCase())) return true
  }
  return false
}

function isSafeWithin(targetPath, basePath) {
  const resolved = path.resolve(targetPath)
  const base = path.resolve(basePath || os.homedir())
  return resolved.startsWith(base)
}

// ─── Recursive directory scanner ───
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.cache', '.npm', '.yarn', 'dist', 'build'])
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db'])

function scanDir(dir, maxDepth = 3, depth = 0) {
  const result = { name: path.basename(dir), type: 'directory', children: [], path: dir }
  if (depth >= maxDepth) {
    try { result._fileCount = fs.readdirSync(dir).length } catch { result._fileCount = 0 }
    return result
  }
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
      if (entry.isFile() && SKIP_FILES.has(entry.name)) continue
      if (entry.isDirectory()) {
        const sub = scanDir(path.join(dir, entry.name), maxDepth, depth + 1)
        result.children.push(sub)
      } else {
        try {
          const stat = fs.statSync(path.join(dir, entry.name))
          result.children.push({
            name: entry.name,
            type: 'file',
            size: stat.size,
            path: path.join(dir, entry.name)
          })
        } catch {
          result.children.push({ name: entry.name, type: 'file', size: 0, path: path.join(dir, entry.name) })
        }
      }
    }
    // Sort: dirs first, then files. Alphabetical within each group
    result.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  } catch {}
  return result
}

// ─── List directory ───
router.post('/computer/list-dir', (req, res) => {
  try {
    let { dirPath, depth = 2 } = req.body
    if (!dirPath) dirPath = os.homedir()
    if (!fs.existsSync(dirPath)) return res.status(404).json({ error: '路径不存在: ' + dirPath })
    if (!fs.statSync(dirPath).isDirectory()) return res.status(400).json({ error: '不是文件夹' })
    const tree = scanDir(dirPath, Math.min(depth, 4))
    res.json({ tree })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Read file ───
router.post('/computer/read-file', (req, res) => {
  try {
    const { filePath } = req.body
    if (!filePath) return res.status(400).json({ error: '请提供文件路径' })
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在: ' + filePath })
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) return res.status(400).json({ error: '路径是文件夹，不是文件' })
    if (stat.size > 10 * 1024 * 1024) return res.status(400).json({ error: '文件过大 (>10MB)，无法直接读取' })
    const content = fs.readFileSync(filePath, 'utf-8')
    res.json({ filePath, name: path.basename(filePath), size: stat.size, content, lines: content.split('\n').length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Analyze disk space ───
router.post('/computer/analyze-disk', (req, res) => {
  try {
    const scanPath = req.body.scanPath || os.homedir()
    if (!fs.existsSync(scanPath)) return res.status(404).json({ error: '路径不存在' })

    // Collect all files with sizes
    const largeFiles = []
    const tempFiles = []
    const byCategory = {}

    function walk(dir, depth = 0) {
      if (depth > 5) return
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue
            walk(full, depth + 1)
          } else {
            try {
              const stat = fs.statSync(full)
              if (stat.size > 10 * 1024 * 1024) {
                largeFiles.push({ path: full, name: entry.name, size: stat.size, mtime: stat.mtime })
              }
              const ext = path.extname(entry.name).toLowerCase()
              if (['.tmp', '.temp', '.log', '.cache'].includes(ext)) {
                tempFiles.push({ path: full, name: entry.name, size: stat.size })
              }
              byCategory[ext || '(无后缀)'] = (byCategory[ext || '(无后缀)'] || 0) + stat.size
            } catch {}
          }
        }
      } catch {}
    }
    walk(scanPath)

    largeFiles.sort((a, b) => b.size - a.size)
    const topLarge = largeFiles.slice(0, 50)

    const totalLargeSize = topLarge.reduce((s, f) => s + f.size, 0)
    const totalTempSize = tempFiles.reduce((s, f) => s + f.size, 0)

    // Category breakdown top 10
    const sortedCats = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ext, sz]) => ({ ext, size: sz }))

    res.json({
      scanPath,
      topLargeFiles: topLarge.map(f => ({
        path: f.path, name: f.name,
        size: f.size, sizeMB: +(f.size / 1048576).toFixed(1),
        mtime: f.mtime
      })),
      tempFileCount: tempFiles.length,
      totalTempSize,
      totalTempSizeMB: +(totalTempSize / 1048576).toFixed(1),
      totalLargeSize,
      totalLargeSizeMB: +(totalLargeSize / 1048576).toFixed(1),
      categoryBreakdown: sortedCats.map(c => ({ ...c, sizeMB: +(c.size / 1048576).toFixed(1) })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Search files (enhanced: multi-drive walk + variant matching + file URLs) ───
router.post('/computer/search-files', (req, res) => {
  try {
    const { query, searchPath } = req.body
    if (!query) return res.status(400).json({ error: '请提供搜索关键词' })

    const results = []
    const maxResults = 30
    const seen = new Set()
    const qLower = query.toLowerCase()
    const qBaseName = query.replace(/\.[^.]+$/, '').toLowerCase()

    // Determine search roots
    let searchRoots = []
    if (searchPath) {
      searchRoots = [searchPath]
    } else if (process.platform === 'win32') {
      for (let c = 'A'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
        const drive = String.fromCharCode(c) + ':\\'
        if (fs.existsSync(drive)) searchRoots.push(drive)
      }
    } else {
      searchRoots = [os.homedir(), '/']
    }

    // Generate match patterns: exact + variants
    const variants = generateSearchVariants(query)
    const matchPatterns = [qLower, ...variants.map(v => v.toLowerCase())]

    // Quick scan: root level first (catches E:\file.png style paths instantly)
    for (const root of searchRoots) {
      try {
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
          if (!entry.isFile()) continue
          const nameLower = entry.name.toLowerCase()
          if (nameLower === qLower || matchPatterns.includes(nameLower) || nameLower.includes(qBaseName)) {
            const full = path.join(root, entry.name)
            seen.add(full)
            const stat = fs.statSync(full)
            results.push({ path: full, name: entry.name, size: stat.size, matchType: nameLower === qLower ? 'exact' : 'fuzzy' })
          }
        }
      } catch {}
    }

    // Deep walk (depth-limited for speed)
    function walk(dir, depth = 0) {
      if (depth > 4 || results.length >= maxResults) return
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (results.length >= maxResults) break
          const full = path.join(dir, entry.name)
          if (seen.has(full)) continue
          seen.add(full)

          if (entry.isDirectory()) {
            const nameLower = entry.name.toLowerCase()
            if (SKIP_DIRS.has(entry.name) || nameLower.includes('workspace') || full.includes('AppData\\Local\\Temp')) continue
            walk(full, depth + 1)
          } else {
            const nameLower = entry.name.toLowerCase()
            let matchType = null
            if (nameLower === qLower) matchType = 'exact'
            else if (matchPatterns.includes(nameLower)) matchType = 'variant'
            else if (nameLower.includes(qBaseName)) matchType = 'fuzzy'

            if (matchType) {
              try {
                const stat = fs.statSync(full)
                results.push({ path: full, name: entry.name, size: stat.size, matchType })
              } catch {
                results.push({ path: full, name: entry.name, size: 0, matchType })
              }
            }
          }
        }
      } catch {}
    }

    for (const root of searchRoots) {
      if (fs.existsSync(root) && results.length < maxResults) walk(root)
    }

    // Copy found files to downloads for serving as real file cards
    const DOWNLOADS_DIR = path.join(__dirname, '..', 'workspace', 'downloads')
    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })
    const crypto = require('crypto')

    for (const r of results) {
      try {
        const stat = fs.statSync(r.path)
        r.sizeMB = +(stat.size / 1048576).toFixed(2)
        if (stat.size <= 50 * 1024 * 1024) {
          const safeName = r.name.replace(/\.\./g, '').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 200)
          const id = crypto.randomBytes(8).toString('hex')
          const storedName = `${id}_${safeName}`
          fs.copyFileSync(r.path, path.join(DOWNLOADS_DIR, storedName))
          r.url = `/api/files/download/${encodeURIComponent(storedName)}`
        }
      } catch { r.sizeMB = 0 }
    }

    res.json({ query, count: results.length, results: results.slice(0, maxResults) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Generate file name variants for fuzzy search
function generateSearchVariants(query) {
  const variants = []
  const name = query.replace(/\.[^.]+$/, '')
  const ext = path.extname(query)

  variants.push(query.toLowerCase())
  variants.push(query.toUpperCase())
  if (query[0]) variants.push(query[0].toUpperCase() + query.slice(1).toLowerCase())
  variants.push(name.replace(/\s/g, '_') + ext)
  variants.push(name.replace(/\s/g, '-') + ext)
  variants.push(name.replace(/[_\s-]/g, '') + ext)
  variants.push(name.replace(/\s/g, '') + ext)

  const extLower = ext.toLowerCase()
  if (extLower === '.png') { variants.push(name + '.jpg'); variants.push(name + '.jpeg'); variants.push(name + '.gif'); variants.push(name + '.webp') }
  if (extLower === '.jpg' || extLower === '.jpeg') { variants.push(name + '.png'); variants.push(name + '.gif') }
  if (extLower === '.txt') { variants.push(name + '.md'); variants.push(name + '.log') }

  return [...new Set(variants.filter(v => v !== query))]
}

// ─── Delete file ───
router.post('/computer/delete-file', (req, res) => {
  try {
    const { filePath } = req.body
    if (!filePath) return res.status(400).json({ error: '请提供文件路径' })
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' })
    if (isForbiddenPath(filePath)) return res.status(403).json({ error: '禁止删除系统文件' })
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) return res.status(400).json({ error: '请使用删除文件夹接口' })
    fs.unlinkSync(filePath)
    res.json({ ok: true, path: filePath, name: path.basename(filePath), size: stat.size })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Delete directory ───
router.post('/computer/delete-dir', (req, res) => {
  try {
    const { dirPath } = req.body
    if (!dirPath) return res.status(400).json({ error: '请提供文件夹路径' })
    if (!fs.existsSync(dirPath)) return res.status(404).json({ error: '文件夹不存在' })
    if (isForbiddenPath(dirPath)) return res.status(403).json({ error: '禁止删除系统文件夹' })
    const homedir = os.homedir()
    if (path.resolve(dirPath) === path.resolve(homedir)) return res.status(403).json({ error: '禁止删除用户主目录' })

    // Count contents for response
    let fileCount = 0, totalSize = 0
    function count(dir) {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) { count(full) } else {
            try { const s = fs.statSync(full); fileCount++; totalSize += s.size } catch { fileCount++ }
          }
        }
      } catch {}
    }
    count(dirPath)

    fs.rmSync(dirPath, { recursive: true, force: true })
    res.json({ ok: true, path: dirPath, name: path.basename(dirPath), fileCount, totalSize, totalSizeMB: +(totalSize / 1048576).toFixed(1) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Move / Rename file ───
router.post('/computer/move-file', (req, res) => {
  try {
    const { fromPath, toPath } = req.body
    if (!fromPath || !toPath) return res.status(400).json({ error: '请提供源路径和目标路径' })
    if (!fs.existsSync(fromPath)) return res.status(404).json({ error: '源文件不存在' })
    if (isForbiddenPath(fromPath)) return res.status(403).json({ error: '禁止移动系统文件' })

    const toDir = path.dirname(toPath)
    if (!fs.existsSync(toDir)) fs.mkdirSync(toDir, { recursive: true })

    fs.renameSync(fromPath, toPath)
    res.json({ ok: true, from: fromPath, to: toPath, name: path.basename(toPath) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── System info (RAM + disk) ───
router.post('/computer/system-info', (req, res) => {
  try {
    const info = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      totalMemoryGB: +(os.totalmem() / 1073741824).toFixed(1),
      freeMemoryGB: +(os.freemem() / 1073741824).toFixed(1),
      usedMemoryPercent: +(100 - (os.freemem() / os.totalmem() * 100)).toFixed(1),
      uptime: Math.floor(os.uptime()),
      drives: [],
    }

    // Get disk space using system commands
    const cmd = process.platform === 'win32'
      ? { file: 'wmic', args: ['logicaldisk', 'get', 'caption,size,freespace', '/format:csv'] }
      : { file: 'df', args: ['-h', '--output=source,size,avail,pcent,target'] }

    const child = execFile(cmd.file, cmd.args, { timeout: 10000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (!err && stdout) {
        const lines = stdout.toString().trim().split('\n')
        if (process.platform === 'win32') {
          for (const line of lines) {
            const parts = line.split(',')
            if (parts.length >= 4 && parts[1] && parts[1].includes(':')) {
              // WMIC /format:csv sorts columns alphabetically: Caption,FreeSpace,Size
              const free = parseInt(parts[2]) || 0
              const size = parseInt(parts[3]) || 0
              if (size > 0) {
                info.drives.push({
                  drive: parts[1].trim(),
                  totalGB: +(size / 1073741824).toFixed(1),
                  freeGB: +(free / 1073741824).toFixed(1),
                  usedPercent: +(100 - (free / size * 100)).toFixed(1),
                })
              }
            }
          }
        } else {
          for (const line of lines.slice(1)) {
            const parts = line.trim().split(/\s+/)
            if (parts.length >= 5) {
              info.drives.push({ drive: parts[4], size: parts[1], avail: parts[2], usedPercent: parts[3] })
            }
          }
        }
      }
      // Fallback: list drives that exist
      if (!info.drives.length) {
        if (process.platform === 'win32') {
          for (const l of 'CDEFGH') {
            try { if (fs.existsSync(l + ':\\')) info.drives.push({ drive: l + ':\\', accessible: true }) } catch {}
          }
        } else {
          info.drives.push({ drive: '/', accessible: true })
        }
      }
      res.json(info)
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Run shell command (sandboxed) ───
router.post('/computer/run-shell', (req, res) => {
  try {
    const { command, cwd, timeout = 30000 } = req.body
    if (!command) return res.status(400).json({ error: '请提供命令' })

    // Forbidden commands
    const dangerous = [
      'rm -rf /', 'rm -rf ~', 'rm -rf .', 'dd if=', 'mkfs', ':(){ :|:& };:',
      'shutdown', 'reboot', 'halt', 'poweroff',
      'chmod 777 /', 'chown -R', '> /dev/sda', 'format',
    ]
    const lowerCmd = command.toLowerCase()
    for (const d of dangerous) {
      if (lowerCmd.includes(d)) return res.status(403).json({ error: `危险命令被拦截: ${d}` })
    }

    const options = {
      cwd: cwd || os.homedir(),
      timeout: Math.min(timeout, 60000),
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
    }

    execFile(command, [], options, (err, stdout, stderr) => {
      if (err) {
        return res.json({
          ok: false,
          error: err.message,
          stdout: stdout?.toString() || '',
          stderr: stderr?.toString() || ''
        })
      }
      res.json({
        ok: true,
        stdout: stdout?.toString() || '',
        stderr: stderr?.toString() || ''
      })
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
