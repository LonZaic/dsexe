// ─── Email engine: SMTP send (smtpjs.com relay) + schedule + time parser ───

const STORAGE_KEY = 'smtp_config'
const SCHEDULE_KEY = 'email_schedule'

// ─── config ───
export function loadSMTPConfig() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null } catch { return null }
}
export function saveSMTPConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}
export function hasSMTP() {
    const cfg = loadSMTPConfig()
    return !!(cfg && cfg.host && cfg.user && cfg.pass)
}

// ─── send ───
// Uses Vite dev server's /api/send-email proxy (nodemailer, zero external dependency)

export async function sendEmail(to, subject, body) {
    const cfg = loadSMTPConfig()
    if (!cfg) throw new Error('SMTP 未配置')
    if (!to || !subject) throw new Error('收件人或主题为空')

    console.log('[Email] sending via local proxy...', { host: cfg.host, user: cfg.user, to, subject })
    const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            host: cfg.host, port: cfg.port || '465',
            user: cfg.user, pass: cfg.pass,
            to, subject, text: body,
        }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '发送失败')
    console.log('[Email] sent:', data.messageId)
    return data
}

// ─── time parser ───
const TIME_UNITS = [
    [/[半些]个小?时|半小时/, 1800],
    [/[一1]个小时?/, 3600],
    [/(\d+)\s*个小时?/, (_, n) => +n * 3600],
    [/[一1]分[钟钟]/, 60],
    [/(\d+)\s*分[钟钟]/, (_, n) => +n * 60],
    [/(\d+)\s*秒[钟钟]?/, (_, n) => +n * 1],
    [/[一1]天/, 86400],
    [/(\d+)\s*天/, (_, n) => +n * 86400],
    [/明天/, 86400],
    [/后天/, 172800],
    [/[一1]周|一个星期/, 604800],
    [/(\d+)\s*周/, (_, n) => +n * 604800],
]

function parseRelativeTime(text) {
    for (const [pat, val] of TIME_UNITS) {
        const m = text.match(pat)
        if (m) return typeof val === 'function' ? val(...m) : val
    }
    return null
}

function parseAbsoluteTime(text) {
    const now = new Date()
    const target = new Date(now)
    if (/明天/.test(text)) target.setDate(target.getDate() + 1)
    else if (/后天/.test(text)) target.setDate(target.getDate() + 2)
    else if (/大后天/.test(text)) target.setDate(target.getDate() + 3)
    const dowMap = { '周一':1,'周二':2,'周三':3,'周四':4,'周五':5,'周六':6,'周日':7,'星期天':7 }
    for (const [name, dow] of Object.entries(dowMap)) {
        if (text.includes(name)) {
            const diff = dow - now.getDay()
            target.setDate(target.getDate() + (diff <= 0 ? diff + 7 : diff))
        }
    }
    const tm = text.match(/(\d{1,2})[点:：](\d{0,2})/)
    if (tm) {
        let h = parseInt(tm[1]), m = tm[2] ? parseInt(tm[2]) : 0
        if (/下午|晚上|傍晚/.test(text) && h < 12) h += 12
        if (/中午/.test(text) && h < 12) h = 12
        if (/凌晨/.test(text) && h === 12) h = 0
        target.setHours(h, m, 0, 0)
        return target
    }
    if (/明天|后天|大后天|周[一二三四五六日]|星期[一二三四五六日天]/.test(text)) {
        target.setHours(9, 0, 0, 0)
        return target
    }
    return null
}

export function parseSendTime(text) {
    const abs = parseAbsoluteTime(text)
    if (abs && abs > new Date()) return { type: 'absolute', time: abs, delay: abs.getTime() - Date.now() }
    const rel = parseRelativeTime(text)
    if (rel) return { type: 'relative', delay: rel * 1000, time: new Date(Date.now() + rel * 1000) }
    return { type: 'immediate', delay: 0, time: new Date() }
}

// ─── schedule ───
export function saveScheduledEmail(task) {
    const list = loadScheduledEmails(); list.push(task)
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(list))
}
export function loadScheduledEmails() {
    try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY)) || [] } catch { return [] }
}
export function removeScheduledEmail(id) {
    const list = loadScheduledEmails().filter(t => t.id !== id)
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(list))
}
export function restoreSchedules(onFire) {
    for (const task of loadScheduledEmails()) {
        const delay = task.fireAt - Date.now()
        const fn = () => onFire(task).then(() => removeScheduledEmail(task.id))
        if (delay <= 0) fn(); else setTimeout(fn, delay)
    }
}
export function scheduleEmail(to, subject, body, scheduleText) {
    const parsed = parseSendTime(scheduleText || '立即')
    if (parsed.type === 'immediate' || parsed.delay <= 100) {
        return sendEmail(to, subject, body)
    }
    const id = 'sch_' + Date.now()
    saveScheduledEmail({ id, to, subject, body, fireAt: Date.now() + parsed.delay, scheduleText })
    setTimeout(() => {
        sendEmail(to, subject, body).then(() => removeScheduledEmail(id)).catch(() => {})
    }, parsed.delay)
    return Promise.resolve({ scheduled: true, time: parsed.time, id })
}
export function initEmailScheduler() {
    restoreSchedules(async (task) => {
        try { await sendEmail(task.to, task.subject, task.body) } catch (e) {
            console.warn('[Email] schedule fail:', e.message)
        }
    })
}
