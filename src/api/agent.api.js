// ══════════════════════════════════════
// Agent API — SSE streaming helpers
// ══════════════════════════════════════

import client, { BASE_URL } from './client.js'
import { getApiHeaders } from '../utils/apiHeaders.js'

function authHeaders(extra = {}) {
  return getApiHeaders({ ...extra })
}

/**
 * Run a personal agent task via SSE stream.
 * Returns a Promise that resolves when the agent completes.
 * Caller can abort via the signal.
 */
export async function runAgent(task, model, permissionMode = 'default', onEvent, signal) {
  const response = await fetch(`${BASE_URL}/api/agent/run`, {
    method: 'POST',
    headers: authHeaders({ 'x-permission-mode': permissionMode }),
    body: JSON.stringify({ task, model }),
    signal,
  })

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
        try {
          const data = JSON.parse(trimmed.slice(5).trim())
          await onEvent(data)   // yield to let Vue flush DOM between events
        } catch { /* skip malformed */ }
      }
    }
  }
}

/**
 * Run a group agent task via SSE stream.
 */
export async function runGroupAgent(task, roomId, model, permissionMode = 'default', onEvent, signal) {
  const response = await fetch(`${BASE_URL}/api/agent/group-run`, {
    method: 'POST',
    headers: authHeaders({ 'x-permission-mode': permissionMode }),
    body: JSON.stringify({ task, roomId, model }),
    signal,
  })

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
        try {
          const data = JSON.parse(trimmed.slice(5).trim())
          await onEvent(data)   // yield to let Vue flush DOM between events
        } catch { /* skip malformed */ }
      }
    }
  }
}

/**
 * AI chat (streaming SSE).
 * Returns a Promise that resolves with { reply, reasoning }.
 */
export async function aiChatStream(messages, model, onChunk, onDone, signal) {
  const response = await fetch(`${BASE_URL}/api/ai/chat/stream`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ messages, model }),
    signal,
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let replyText = ''
  let reasoningText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data:')) {
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') {
          onDone?.({ reply: replyText, reasoning: reasoningText })
          return { reply: replyText, reasoning: reasoningText }
        }
        try {
          const data = JSON.parse(payload)
          const delta = data.choices?.[0]?.delta
          if (delta?.reasoning_content) reasoningText += delta.reasoning_content
          if (delta?.content) replyText += delta.content
          onChunk?.({ reply: replyText, reasoning: reasoningText })
        } catch { /* skip */ }
      }
    }
  }
  onDone?.({ reply: replyText, reasoning: reasoningText })
  return { reply: replyText, reasoning: reasoningText }
}

export async function judgeTask(task, context) {
  return client.post('/api/agent/judge', { task, context })
}

export const agentApi = {
  runAgent,
  runGroupAgent,
  aiChatStream,
  judgeTask,
  getMemory: () => client.get('/api/agent/memory'),
  saveMemory: (name, description, type, content) =>
    client.post('/api/agent/memory', { name, description, type, content }),
  deleteMemory: (filename) =>
    client.delete(`/api/agent/memory/${encodeURIComponent(filename)}`),
  getPermissions: () => client.get('/api/agent/permissions'),
  getHooks: () => client.get('/api/agent/hooks'),
  clean: () => client.post('/api/agent/clean'),
}
