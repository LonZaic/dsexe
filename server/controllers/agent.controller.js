// ══════════════════════════════════════
// Agent Controller
// ══════════════════════════════════════

const config = require('../config')
const { runAgent, cleanWorkspace } = require('../engine/agent')
const { broadcastAgentEvent, broadcastAgentResult } = require('../ws')
const { sendSuccess, sendError } = require('../middleware/errorHandler')

function run(req, res) {
  const { task, model } = req.body
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']
  const permissionMode = req.headers['x-permission-mode'] || 'default'

  if (!apiKey) return sendError(res, '缺少 API Key，请在 .env 中设置 DEEPSEEK_API_KEY')
  if (!task) return sendError(res, '缺少任务描述')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (res.socket) res.socket.setNoDelay(true)
  res.flushHeaders()

  const abortController = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort()
    }
  })

  runAgent({
    task,
    apiKey,
    model: model || 'deepseek-v4-pro',
    permissionMode,
    signal: abortController.signal,
    onProgress(event) {
      if (!res.destroyed && res.writable) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    },
  }).then(finalResult => {
    if (!res.destroyed && res.writable) {
      res.write(`data: ${JSON.stringify({ type: 'final', text: finalResult })}\n\n`)
      res.end()
    }
  }).catch(err => {
    if (!res.destroyed && res.writable) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`)
      res.end()
    }
  })
}

function groupRun(req, res) {
  const { task, roomId, model } = req.body
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']
  const permissionMode = req.headers['x-permission-mode'] || 'default'

  if (!apiKey) return sendError(res, '缺少 API Key，请在 .env 中设置 DEEPSEEK_API_KEY')
  if (!task) return sendError(res, '缺少任务描述')
  if (!roomId) return sendError(res, '缺少房间 ID')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  broadcastAgentEvent(roomId, { type: 'agent_start', task, roomId, mode: permissionMode })

  const abortController = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort()
    }
  })

  runAgent({
    task,
    apiKey,
    model: model || 'deepseek-v4-pro',
    permissionMode,
    signal: abortController.signal,
    onProgress(event) {
      broadcastAgentEvent(roomId, event)
      if (!res.destroyed && res.writable) {
        res.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    },
  }).then(finalResult => {
    broadcastAgentResult(roomId, { text: finalResult, task, roomId })
    try {
      const { room } = require('../db')
      room.sendMessage(roomId, null, `[Agent] ${finalResult}`, true)
    } catch { /* best-effort */ }
    if (!res.destroyed && res.writable) {
      res.write(`data: ${JSON.stringify({ type: 'final', text: finalResult })}\n\n`)
      res.end()
    }
  }).catch(err => {
    broadcastAgentEvent(roomId, { type: 'agent_error', text: err.message })
    if (!res.destroyed && res.writable) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`)
      res.end()
    }
  })
}

async function judge(req, res) {
  const { task, context } = req.body
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']

  if (!apiKey || !task) return sendError(res, '缺少参数')

  // Fast path: if API key looks fake, skip the HTTP call
  if (apiKey === 'sk-test' || apiKey.length < 20) {
    const result = isComplexTask(task)
    return sendSuccess(res, { delegate: result, reason: result ? '任务较复杂' : '简单问答' })
  }

  try {
    const { DEEPSEEK_API_BASE } = require('../config/constants')
    const judgeRes = await fetch(DEEPSEEK_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: `你是一个任务复杂度评估器。判断用户的任务是否需要 Agent 来处理。

Agent 适合处理:
- 编程任务（写代码、改代码、创建文件）
- 需要多步骤的工作（先读文件再修改再验证）
- 项目级别的操作（创建项目、重构代码）
- 需要执行命令的任务（npm install、git 操作等）

不需要 Agent 的情况（直接回答即可）:
- 简单问答、知识性问题
- 群聊闲聊
- 解释概念

只回复一个 JSON:
{ "delegate": true/false, "reason": "简短理由(10字以内)" }`,
          },
          ...(context || []).slice(-5),
          { role: 'user', content: task },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    })

    let result = { delegate: false, reason: '' }
    if (judgeRes.ok) {
      const data = await judgeRes.json()
      const reply = data.choices?.[0]?.message?.content || ''
      try {
        result = JSON.parse(reply.replace(/```json|```/g, '').trim())
      } catch {
        result.delegate = isComplexTask(task)
        result.reason = result.delegate ? '任务较复杂' : '简单问答'
      }
    } else {
      result.delegate = isComplexTask(task)
      result.reason = result.delegate ? '本地判断:复杂任务' : '本地判断:简单问答'
    }
    sendSuccess(res, result)
  } catch (e) {
    sendSuccess(res, { delegate: isComplexTask(task), reason: '离线判断' })
  }
}

function clean(req, res) {
  cleanWorkspace()
  sendSuccess(res, { ok: true })
}

function debug(req, res) {
  const tests = [
    '在项目中创建一个React登录组件',
    '你好',
    '帮我写一个用户注册登录的后端API',
    '今天天气怎么样',
  ]
  const results = tests.map(t => ({ task: t, complex: isComplexTask(t) }))
  sendSuccess(res, { isComplexTaskExists: typeof isComplexTask === 'function', results })
}

// Heuristic: does the task look like it needs an Agent?
function isComplexTask(task) {
  const complexPatterns = [
    /写|创建|生成|做|改|重构|修复|开发|实现|搭建|构建/,
    /build|create|make|fix|refactor|develop|implement|generate/i,
    /项目|代码|程序|网站|应用|后端|前端|API|接口|数据库/,
    /帮我.*(?:写|做|创建|生成|开发|搭建)/,
    /npm\s|git\s|pip\s|docker|部署|安装|配置/,
    /文件|工程|架构|模块|组件|路由/,
  ]
  const score = complexPatterns.filter(p => p.test(task)).length
  return score >= 1
}

module.exports = { run, groupRun, judge, clean, debug }
