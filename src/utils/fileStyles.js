// vibrant color palette for every file type
export const FILE_STYLES = {
    // images — gray
    jpg:  { label:'JPG',  bg:'#f0f0f0', bd:'#bbb', fg:'#555', darkBg:'#222', darkBd:'#555', darkFg:'#999' },
    jpeg: { label:'JPEG', bg:'#f0f0f0', bd:'#bbb', fg:'#555', darkBg:'#222', darkBd:'#555', darkFg:'#999' },
    png:  { label:'PNG',  bg:'#f0f0f0', bd:'#bbb', fg:'#555', darkBg:'#222', darkBd:'#555', darkFg:'#999' },
    gif:  { label:'GIF',  bg:'#f0f0f0', bd:'#bbb', fg:'#555', darkBg:'#222', darkBd:'#555', darkFg:'#999' },
    webp: { label:'WEBP', bg:'#f0f0f0', bd:'#bbb', fg:'#555', darkBg:'#222', darkBd:'#555', darkFg:'#999' },
    svg:  { label:'SVG',  bg:'#f0f0f0', bd:'#bbb', fg:'#555', darkBg:'#222', darkBd:'#555', darkFg:'#999' },
    bmp:  { label:'BMP',  bg:'#f0f0f0', bd:'#bbb', fg:'#555', darkBg:'#222', darkBd:'#555', darkFg:'#999' },
    // documents
    pdf:  { label:'PDF',  bg:'#fff7ed', bd:'#ea580c', fg:'#c2410c', darkBg:'#2a1a10', darkBd:'#c2410c', darkFg:'#fb923c' },
    doc:  { label:'DOC',  bg:'#eff6ff', bd:'#2563eb', fg:'#1d4ed8', darkBg:'#1a2540', darkBd:'#3b82f6', darkFg:'#93c5fd' },
    docx: { label:'DOCX', bg:'#eff6ff', bd:'#2563eb', fg:'#1d4ed8', darkBg:'#1a2540', darkBd:'#3b82f6', darkFg:'#93c5fd' },
    ppt:  { label:'PPT',  bg:'#fef2f2', bd:'#dc2626', fg:'#b91c1c', darkBg:'#2a1515', darkBd:'#ef4444', darkFg:'#fca5a5' },
    pptx: { label:'PPTX', bg:'#fef2f2', bd:'#dc2626', fg:'#b91c1c', darkBg:'#2a1515', darkBd:'#ef4444', darkFg:'#fca5a5' },
    xls:  { label:'XLS',  bg:'#f0fdf4', bd:'#16a34a', fg:'#15803d', darkBg:'#152a18', darkBd:'#22c55e', darkFg:'#86efac' },
    xlsx: { label:'XLSX', bg:'#f0fdf4', bd:'#16a34a', fg:'#15803d', darkBg:'#152a18', darkBd:'#22c55e', darkFg:'#86efac' },
    // code
    js:   { label:'JS',   bg:'#f5f3ff', bd:'#7c3aed', fg:'#6d28d9', darkBg:'#1a1530', darkBd:'#8b5cf6', darkFg:'#c4b5fd' },
    ts:   { label:'TS',   bg:'#f5f3ff', bd:'#7c3aed', fg:'#6d28d9', darkBg:'#1a1530', darkBd:'#8b5cf6', darkFg:'#c4b5fd' },
    jsx:  { label:'JSX',  bg:'#f5f3ff', bd:'#7c3aed', fg:'#6d28d9', darkBg:'#1a1530', darkBd:'#8b5cf6', darkFg:'#c4b5fd' },
    tsx:  { label:'TSX',  bg:'#f5f3ff', bd:'#7c3aed', fg:'#6d28d9', darkBg:'#1a1530', darkBd:'#8b5cf6', darkFg:'#c4b5fd' },
    py:   { label:'PY',   bg:'#ecfeff', bd:'#0891b2', fg:'#0e7490', darkBg:'#0f2a30', darkBd:'#06b6d4', darkFg:'#67e8f9' },
    html: { label:'HTML', bg:'#fff7ed', bd:'#ea580c', fg:'#c2410c', darkBg:'#2a1a10', darkBd:'#f97316', darkFg:'#fdba74' },
    css:  { label:'CSS',  bg:'#ecfeff', bd:'#0891b2', fg:'#0e7490', darkBg:'#0f2a30', darkBd:'#06b6d4', darkFg:'#67e8f9' },
    json: { label:'JSON', bg:'#fffbeb', bd:'#d97706', fg:'#b45309', darkBg:'#2a2010', darkBd:'#f59e0b', darkFg:'#fcd34d' },
    xml:  { label:'XML',  bg:'#fffbeb', bd:'#d97706', fg:'#b45309', darkBg:'#2a2010', darkBd:'#f59e0b', darkFg:'#fcd34d' },
    md:   { label:'MD',   bg:'#f5f3ff', bd:'#7c3aed', fg:'#6d28d9', darkBg:'#1a1530', darkBd:'#8b5cf6', darkFg:'#c4b5fd' },
    yml:  { label:'YML',  bg:'#f5f3ff', bd:'#7c3aed', fg:'#6d28d9', darkBg:'#1a1530', darkBd:'#8b5cf6', darkFg:'#c4b5fd' },
    yaml: { label:'YAML', bg:'#f5f3ff', bd:'#7c3aed', fg:'#6d28d9', darkBg:'#1a1530', darkBd:'#8b5cf6', darkFg:'#c4b5fd' },
    sh:   { label:'SH',   bg:'#f8f8f8', bd:'#555',   fg:'#333',   darkBg:'#1a1a1a', darkBd:'#777', darkFg:'#ccc' },
    bat:  { label:'BAT',  bg:'#f8f8f8', bd:'#555',   fg:'#333',   darkBg:'#1a1a1a', darkBd:'#777', darkFg:'#ccc' },
    java: { label:'JAVA', bg:'#fff7ed', bd:'#ea580c', fg:'#c2410c', darkBg:'#2a1a10', darkBd:'#f97316', darkFg:'#fdba74' },
    go:   { label:'GO',   bg:'#ecfeff', bd:'#0891b2', fg:'#0e7490', darkBg:'#0f2a30', darkBd:'#06b6d4', darkFg:'#67e8f9' },
    rs:   { label:'RS',   bg:'#fff7ed', bd:'#ea580c', fg:'#c2410c', darkBg:'#2a1a10', darkBd:'#f97316', darkFg:'#fdba74' },
    rb:   { label:'RB',   bg:'#fef2f2', bd:'#dc2626', fg:'#b91c1c', darkBg:'#2a1515', darkBd:'#ef4444', darkFg:'#fca5a5' },
    c:    { label:'C',    bg:'#eff6ff', bd:'#2563eb', fg:'#1d4ed8', darkBg:'#1a2540', darkBd:'#3b82f6', darkFg:'#93c5fd' },
    cpp:  { label:'CPP',  bg:'#eff6ff', bd:'#2563eb', fg:'#1d4ed8', darkBg:'#1a2540', darkBd:'#3b82f6', darkFg:'#93c5fd' },
    h:    { label:'H',    bg:'#eff6ff', bd:'#2563eb', fg:'#1d4ed8', darkBg:'#1a2540', darkBd:'#3b82f6', darkFg:'#93c5fd' },
    php:  { label:'PHP',  bg:'#eff6ff', bd:'#2563eb', fg:'#1d4ed8', darkBg:'#1a2540', darkBd:'#3b82f6', darkFg:'#93c5fd' },
    sql:  { label:'SQL',  bg:'#ecfeff', bd:'#0891b2', fg:'#0e7490', darkBg:'#0f2a30', darkBd:'#06b6d4', darkFg:'#67e8f9' },
    csv:  { label:'CSV',  bg:'#f0fdf4', bd:'#16a34a', fg:'#15803d', darkBg:'#152a18', darkBd:'#22c55e', darkFg:'#86efac' },
    txt:  { label:'TXT',  bg:'#f8f8f8', bd:'#888',   fg:'#555',   darkBg:'#1a1a1a', darkBd:'#777', darkFg:'#ccc' },
    log:  { label:'LOG',  bg:'#f8f8f8', bd:'#888',   fg:'#555',   darkBg:'#1a1a1a', darkBd:'#777', darkFg:'#ccc' },
    zip:  { label:'ZIP',  bg:'#fdf2f8', bd:'#db2777', fg:'#be185d', darkBg:'#2a1520', darkBd:'#ec4899', darkFg:'#f9a8d4' },
    rar:  { label:'RAR',  bg:'#fdf2f8', bd:'#db2777', fg:'#be185d', darkBg:'#2a1520', darkBd:'#ec4899', darkFg:'#f9a8d4' },
    '7z': { label:'7Z',   bg:'#fdf2f8', bd:'#db2777', fg:'#be185d', darkBg:'#2a1520', darkBd:'#ec4899', darkFg:'#f9a8d4' },
}

export function fileChipStyle(name, type) {
    const ext = getExt(name, type)
    const s = FILE_STYLES[ext] || FILE_STYLES.txt
    const dark = document.documentElement.classList.contains('dark')
    return {
        background:  dark ? (s.darkBg || s.bg) : s.bg,
        borderColor: dark ? (s.darkBd || s.bd) : s.bd,
        color:       dark ? (s.darkFg || s.fg) : s.fg,
    }
}

export function fileLabel(name, type) {
    const ext = getExt(name, type)
    return FILE_STYLES[ext]?.label || ext?.toUpperCase() || 'FILE'
}

function getExt(name, type) {
    if (type?.startsWith('image/')) {
        const m = type.split('/')[1]
        if (FILE_STYLES[m]) return m
        return 'png'
    }
    return (name || '').split('.').pop()?.toLowerCase() || ''
}
