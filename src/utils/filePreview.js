// ══════════════════════════════════════
// File Preview Utilities
// ══════════════════════════════════════

/**
 * Get file category for preview rendering
 * @returns 'image' | 'html' | 'svg' | 'code' | 'pdf' | 'audio' | 'video' | 'font' | 'binary'
 */
export function getFileCategory(filename) {
  const ext = getExt(filename).toLowerCase()

  // Images — render as <img>
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif', 'apng', 'heic', 'heif'].includes(ext)) return 'image'

  // SVG — can render inline or as image
  if (ext === 'svg') return 'svg'

  // HTML — render in iframe
  if (['html', 'htm', 'xhtml'].includes(ext)) return 'html'

  // PDF — show info (browser can sometimes render)
  if (ext === 'pdf') return 'pdf'

  // Audio
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'wma'].includes(ext)) return 'audio'

  // Video
  if (['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v'].includes(ext)) return 'video'

  // Fonts
  if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) return 'font'

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return 'binary'

  // Documents
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'binary'

  // Executables / disk images
  if (['exe', 'msi', 'dmg', 'iso', 'apk', 'ipa', 'app', 'bin'].includes(ext)) return 'binary'

  // Code / text — show with highlight.js
  const codeExts = [
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'py', 'pyw', 'pyx',
    'css', 'scss', 'sass', 'less', 'styl',
    'json', 'jsonc', 'json5',
    'xml', 'html', 'svg', 'xhtml',
    'md', 'mdx', 'markdown',
    'yml', 'yaml',
    'toml', 'ini', 'cfg', 'conf', 'env', 'editorconfig',
    'sh', 'bash', 'zsh', 'fish', 'bat', 'cmd', 'ps1',
    'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'hh',
    'java', 'kt', 'kts', 'scala',
    'go', 'rs', 'rb', 'php', 'pl', 'pm',
    'swift', 'r', 'jl', 'lua', 'dart',
    'sql', 'prisma', 'graphql',
    'vue', 'svelte', 'astro',
    'txt', 'log', 'csv', 'tsv',
    'diff', 'patch',
    'dockerfile', 'makefile', 'gitignore',
    'nginx', 'apache',
    'tex', 'latex', 'bib',
    'rst', 'adoc',
    'proto', 'thrift',
  ]
  if (codeExts.includes(ext)) return 'code'

  return 'binary'
}

/**
 * Map file extension to highlight.js language identifier
 */
export function getHighlightLanguage(filename) {
  const ext = getExt(filename).toLowerCase()
  const map = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', pyw: 'python', pyx: 'python',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    json: 'json', jsonc: 'json', json5: 'json',
    xml: 'xml', xhtml: 'xml', svg: 'xml',
    md: 'markdown', mdx: 'markdown', markdown: 'markdown',
    yml: 'yaml', yaml: 'yaml',
    toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini', env: 'ini', editorconfig: 'ini',
    sh: 'bash', bash: 'bash', zsh: 'bash', fish: 'bash', bat: 'dos', cmd: 'dos', ps1: 'powershell',
    c: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', h: 'c', hpp: 'cpp', hh: 'cpp',
    java: 'java', kt: 'kotlin', kts: 'kotlin', scala: 'scala',
    go: 'go', rs: 'rust', rb: 'ruby', php: 'php', pl: 'perl', pm: 'perl',
    swift: 'swift', r: 'r', jl: 'julia', lua: 'lua', dart: 'dart',
    sql: 'sql', prisma: 'sql', graphql: 'graphql',
    vue: 'xml', svelte: 'xml', astro: 'xml',
    diff: 'diff', patch: 'diff',
    dockerfile: 'dockerfile', makefile: 'makefile',
    nginx: 'nginx',
    tex: 'latex', latex: 'latex',
    proto: 'protobuf', thrift: 'thrift',
  }
  return map[ext] || ''
}

/**
 * Get icon name for a file based on category
 */
export function getFileIcon(name) {
  const cat = getFileCategory(name)
  const map = {
    image: 'image',
    svg: 'image',
    html: 'code',
    code: 'file-text',
    pdf: 'file-text',
    audio: 'play',
    video: 'play',
    binary: 'file-zip',
    font: 'file-text',
  }
  return map[cat] || 'file'
}

/**
 * Format bytes to human-readable string
 */
export function formatSize(bytes) {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

/**
 * Escape HTML for safe rendering
 */
export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getExt(filename) {
  if (!filename) return ''
  const parts = filename.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}
