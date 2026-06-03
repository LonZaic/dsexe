// ─── Function Calling: Native DeepSeek tools API ───
import { hasSMTP, sendEmail, scheduleEmail, parseSendTime } from './email.js'

// email tools definition for DeepSeek native function calling
function getEmailTools() {
    if (!hasSMTP()) return { tools: [], executors: {} }
    return {
        tools: [
            {
                type: 'function',
                function: {
                    name: 'send_email',
                    description: '发送邮件。用户说"发邮件""帮我发""发送到邮箱"时调用此工具。',
                    parameters: {
                        type: 'object',
                        properties: {
                            to: { type: 'string', description: '收件人邮箱地址' },
                            subject: { type: 'string', description: '邮件主题' },
                            text: { type: 'string', description: '邮件正文' },
                        },
                        required: ['to', 'subject', 'text'],
                    },
                },
            },
            {
                type: 'function',
                function: {
                    name: 'schedule_email',
                    description: '定时发送邮件。用户说"明天发""5分钟后发""下午3点发"时调用。',
                    parameters: {
                        type: 'object',
                        properties: {
                            time: { type: 'string', description: '自然语言时间，如"明天上午8点""5分钟后""下周三下午3点"' },
                            to: { type: 'string', description: '收件人邮箱地址' },
                            subject: { type: 'string', description: '邮件主题' },
                            text: { type: 'string', description: '邮件正文' },
                        },
                        required: ['time', 'to', 'subject', 'text'],
                    },
                },
            },
        ],
        executors: {
            send_email: async (args) => {
                const result = await sendEmail(args.to, args.subject, args.text)
                return JSON.stringify({ success: true, messageId: result?.messageId || 'sent' })
            },
            schedule_email: async (args) => {
                const parsed = parseSendTime(args.time)
                if (parsed.type === 'immediate' || parsed.delay <= 1000) {
                    await sendEmail(args.to, args.subject, args.text)
                    return JSON.stringify({ success: true, msg: '邮件已立即发送' })
                }
                const r = await scheduleEmail(args.to, args.subject, args.text, args.time)
                return JSON.stringify({ success: true, msg: `邮件已定时于 ${parsed.time.toLocaleString('zh-CN')} 发送` })
            },
        },
    }
}

export { getEmailTools }
