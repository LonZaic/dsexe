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

// Design preview function — AI calls this when user wants visual design
function getDesignTool() {
    return {
        type: 'function',
        function: {
            name: 'request_design_preview',
            description: '当用户要求你设计或创建任何网页/UI界面时（无论简单还是复杂），必须立即调用此函数让用户选择目标设备。调用后请停止生成，等待用户选择设备。绝对不要直接输出HTML、CSS、JS代码。不要用"当然可以，我来帮你设计"这类话替代函数调用。',
            parameters: {
                type: 'object',
                properties: {
                    summary: { type: 'string', description: '一句话描述你要设计什么，不超过20字' },
                },
                required: ['summary'],
            },
        },
    }
}

// Classification tool — forces AI to classify every request as design or chat
function getClassifyTool() {
    return {
        type: 'function',
        function: {
            name: 'classify_intent',
            description: '判断用户意图：是要求设计/创建网页UI界面，还是普通对话。',
            parameters: {
                type: 'object',
                properties: {
                    intent: {
                        type: 'string',
                        enum: ['design', 'chat'],
                        description: 'design=用户要求设计网页/UI/界面/组件/布局/页面; chat=普通对话/问答/代码/闲聊'
                    },
                    summary: {
                        type: 'string',
                        description: '如果intent=design，简述设计内容(20字内)；否则留空'
                    },
                },
                required: ['intent'],
            },
        },
    }
}

// Call DeepSeek API to classify user intent (lightweight, non-streaming)
async function classifyIntent(userText, apikey, contextMsgs = []) {
    // Build messages: system + recent context (max 4) + current user msg
    const messages = [
        { role: 'system', content: '严格判断用户意图。只有用户明确要求"设计网页/UI界面/做页面/画组件/创建前端"才返回design。天气、搜索、问答、编程、聊天等一律返回chat。不确定就返回chat。' },
    ]
    const recent = contextMsgs.slice(-4)
    for (const m of recent) {
        messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: (m.text || '').slice(0, 100) })
    }
    messages.push({ role: 'user', content: userText })

    const body = {
        model: 'deepseek-chat',
        stream: false,
        max_tokens: 100,
        messages,
        tools: [getClassifyTool()],
        tool_choice: { type: 'function', function: { name: 'classify_intent' } },
    }

    const { getApiHeaders } = await import('./apiHeaders.js')
    const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error?.message || `HTTP ${res.status}`)
    }

    const wrapper = await res.json()
    const data = (wrapper && typeof wrapper === 'object' && 'success' in wrapper) ? (wrapper.data?.raw || wrapper.data || wrapper) : wrapper
    const tc = data.choices?.[0]?.message?.tool_calls?.[0]
    if (!tc || tc.function?.name !== 'classify_intent') {
        throw new Error('Classification failed: no tool call')
    }

    let args = {}
    try { args = JSON.parse(tc.function.arguments) } catch {}
    return {
        intent: args.intent || 'chat',
        summary: args.summary || '',
    }
}

export { getEmailTools, getDesignTool, classifyIntent }
