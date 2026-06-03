// ─── Design preview: device sizes, design detection, HTML parsing ───

export const DEVICES = [
    { id: 'phone',   name: '手机',  w: 375, h: 667, icon: 'P' },
    { id: 'tablet',  name: '平板',  w: 768, h: 1024, icon: 'T' },
    { id: 'desktop', name: '电脑',  w: 1440, h: 900, icon: 'D' },
    { id: 'custom',  name: '自定义',w: 0,   h: 0,   icon: '?' },
]

const DESIGN_KEYWORDS = [
    '设计', '画', '做', '写', '生成', '创建', '实现', '开发',
    '页面', '界面', 'UI', '按钮', '表单', '登录', '注册',
    '导航', '卡片', '列表', '菜单', '弹窗', '首页', '官网',
    '布局', '样式', '前端', 'HTML', 'CSS', '组件',
    'design', 'layout', 'component',
]

const DEVICE_KEYWORDS = [
    '手机', '移动端', 'mobile', 'phone', 'iPhone', '安卓',
    '平板', 'iPad', 'tablet', 'pad',
    '电脑', '桌面', 'PC', 'desktop', 'laptop', '笔记本',
    '大屏', '宽屏', '显示器',
]

// check if message is a design request
export function isDesignRequest(text) {
    const t = text.toLowerCase()
    return DESIGN_KEYWORDS.some(k => t.includes(k.toLowerCase()))
}

// check if device type is specified
export function hasDeviceSpecified(text) {
    const t = text.toLowerCase()
    return DEVICE_KEYWORDS.some(k => t.includes(k.toLowerCase()))
}

// parse [DESIGN] blocks from AI response text
// robust parser: find [DESIGN]...[/DESIGN] blocks with indexOf
export function parseDesignBlocks(text) {
    const blocks = []
    const START = '[DESIGN'
    const END = '[/DESIGN]'
    let pos = 0
    while ((pos = text.indexOf(START, pos)) !== -1) {
        const tagEnd = text.indexOf(']', pos + START.length)
        if (tagEnd === -1) break
        const tag = text.slice(pos + START.length, tagEnd)
        const w = parseInt((tag.match(/width\s*=\s*(\d+)/i) || [])[1]) || 375
        const h = parseInt((tag.match(/height\s*=\s*(\d+)/i) || [])[1]) || 667
        const htmlStart = tagEnd + 1
        const htmlEnd = text.indexOf(END, htmlStart)
        if (htmlEnd === -1) break
        const html = text.slice(htmlStart, htmlEnd)
        blocks.push({ width: w, height: h, html, raw: text.slice(pos, htmlEnd + END.length) })
        pos = htmlEnd + END.length
    }
    return blocks
}

export function cleanDesignMarkers(text) {
    const START = '[DESIGN'
    const END = '[/DESIGN]'
    let result = text
    let pos = 0
    while ((pos = result.indexOf(START, pos)) !== -1) {
        const end = result.indexOf(END, pos)
        if (end === -1) break
        result = result.slice(0, pos) + result.slice(end + END.length)
    }
    return result.trim()
}

// streaming version: also strips incomplete (unclosed) [DESIGN blocks
export function cleanDesignMarkersStreaming(text) {
    const START = '[DESIGN'
    const END = '[/DESIGN]'
    let result = text
    let pos = 0
    while ((pos = result.indexOf(START, pos)) !== -1) {
        const end = result.indexOf(END, pos)
        if (end === -1) {
            // incomplete block — remove everything from START to end
            result = result.slice(0, pos)
            break
        }
        result = result.slice(0, pos) + result.slice(end + END.length)
    }
    return result.trim()
}

// Check if text has an unclosed [DESIGN block (drawing in progress)
export function hasOpenDesignBlock(text) {
    const startIdx = text.indexOf('[DESIGN')
    if (startIdx === -1) return false
    const endIdx = text.indexOf('[/DESIGN]', startIdx)
    return endIdx === -1
}

// build design prompt for AI
export function buildDesignPrompt(userText, device) {
    let prompt = `[设计任务]\n${userText}\n\n`
    prompt += `目标设备: ${device.name} (${device.w}x${device.h})\n\n`
    prompt += `【重要】你必须输出一个完整的HTML页面。格式要求:\n\n`
    prompt += `1. 在回答末尾用以下标记包裹完整HTML代码，不要用markdown代码块(\`\`\`)包裹:\n`
    prompt += `[DESIGN width=${device.w} height=${device.h}]\n`
    prompt += `<!DOCTYPE html>\n<html lang="zh-CN">\n...完整HTML代码...\n</html>\n`
    prompt += `[/DESIGN]\n\n`
    prompt += `2. 设计要求:\n`
    prompt += `- 完整可独立运行的HTML(内嵌CSS)，无外部依赖\n`
    prompt += `- 所有UI元素加渐入动画(animation-delay递增)\n`
    prompt += `- 极简线条风: 1px细线边框、无/微小圆角、大量留白、黑白灰为主\n`
    prompt += `- 尺寸精准适配 ${device.w}x${device.h}，body设置overflow:hidden\n\n`
    prompt += `3. 在[DESIGN]之前可以写一行简短说明(20字以内)，[DESIGN]必须是回答的最后内容\n`
    prompt += `4. 绝对不要把[DESIGN]...[/DESIGN]放在markdown代码块里`
    return prompt
}

// estimate design code size (chars) based on device dimensions
export function estimateDesignSize(w, h) {
    const pixels = w * h
    if (pixels <= 0) return 5000
    // roughly: each pixel of viewport ≈ 0.05 chars of HTML/CSS
    const base = Math.round(pixels * 0.05)
    return Math.min(Math.max(base, 2000), 8000)
}

// guess device type from design dimensions for frame styling
export function guessDeviceType(d) {
    if (d.width <= 430 && d.height <= 932) return 'phone'
    if (d.width <= 820 && d.height <= 1180) return 'tablet'
    if (d.width >= 1000) return 'desktop'
    return 'phone'
}

// Fallback: extract first HTML block from markdown code fences
export function extractFirstHtmlBlock(text) {
    const re = /```(?:html|htm)\s*\n([\s\S]*?)```/gi
    const matches = []
    let m
    while ((m = re.exec(text)) !== null) {
        matches.push(m[1])
    }
    if (!matches.length) return null
    // pick the one that looks most like a full HTML page
    const htmlLike = matches.filter(s => /<!DOCTYPE|<html/i.test(s))
    if (htmlLike.length) return htmlLike.sort((a, b) => b.length - a.length)[0]
    return matches.sort((a, b) => b.length - a.length)[0]
}

// Fallback: extract raw HTML from text if it starts with DOCTYPE/html
export function extractRawHtml(text) {
    const m = text.match(/(<!DOCTYPE\s+html[\s\S]*)/i)
    if (m) return m[1]
    const m2 = text.match(/(<html[\s\S]*<\/html>)/i)
    if (m2) return m2[1]
    return null
}
