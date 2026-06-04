// ══════════════════════════════════════
// AI Controller — DeepSeek API proxy
// Uses DEEPSEEK_API_KEY from env as primary auth source
// ══════════════════════════════════════

const { sendSuccess, sendError } = require('../middleware/errorHandler')
const { DEEPSEEK_API_BASE } = require('../config/constants')
const config = require('../config')

function getApiKey(req) {
  return config.deepseekApiKey || req.headers['x-api-key'] || ''
}

async function chat(req, res) {
  const { messages, model, ...rest } = req.body
  const apiKey = getApiKey(req)

  if (!apiKey) return sendError(res, '缺少 API Key，请在 .env 中设置 DEEPSEEK_API_KEY')

  try {
    const response = await fetch(DEEPSEEK_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: model || 'deepseek-v4-flash',
        messages,
        ...(rest.max_tokens ? { max_tokens: rest.max_tokens } : {}),
        ...(rest.temperature != null ? { temperature: rest.temperature } : {}),
        stream: false,
        ...(rest.tools ? { tools: rest.tools } : {}),
        ...(rest.tool_choice ? { tool_choice: rest.tool_choice } : {}),
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      return sendError(res, 'AI API 错误', 'AI_API_ERROR', response.status, err)
    }
    const data = await response.json()
    sendSuccess(res, { reply: data.choices?.[0]?.message?.content || '(无响应)', raw: data })
  } catch (e) {
    sendError(res, e.message, 'AI_API_ERROR', 500)
  }
}

async function chatStream(req, res) {
  const { messages, model, ...rest } = req.body
  const apiKey = getApiKey(req)

  if (!apiKey) return sendError(res, '缺少 API Key，请在 .env 中设置 DEEPSEEK_API_KEY')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (res.socket) res.socket.setNoDelay(true)
  res.flushHeaders()

  try {
    const response = await fetch(DEEPSEEK_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: model || 'deepseek-v4-flash',
        messages,
        ...(rest.max_tokens ? { max_tokens: rest.max_tokens } : {}),
        ...(rest.temperature != null ? { temperature: rest.temperature } : {}),
        stream: true,
        ...(rest.tools ? { tools: rest.tools } : {}),
        ...(rest.tool_choice ? { tool_choice: rest.tool_choice } : {}),
      }),
    })

    if (!response.ok) {
      res.write(`data: ${JSON.stringify({ error: 'API error ' + response.status })}\n\n`)
      res.end()
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data:')) {
          res.write(trimmed + '\n\n')
        }
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    res.end()
  }
}

module.exports = { chat, chatStream }
