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
 * Returns an object with { abort, promise } to control the stream.
 */
export function runAgent(task, model, permissionMode = 'default', onEvent) {
  const controller = new AbortController()

  const promise = fetch(`${BASE_URL}/api/agent/run`, {
    method: 'POST',
    headers: authHeaders({ 'x-permission-mode': permissionMode }),
    body: JSON.stringify({ task, model }),
    signal: controller.signal,
  }).then(async response => {
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
            onEvent(data)
          } catch { /* skip malformed */ }
        }
      }
    }
  })

  return {
    abort: () => controller.abort(),
    promise,
  }
}

/**
 * Run a group agent task.
 */
export function runGroupAgent(task, roomId, model, permissionMode = 'default', onEvent) {
  const controller = new AbortController()

  const promise = fetch(`${BASE_URL}/api/agent/group-run`, {
    method: 'POST',
    headers: authHeaders({ 'x-permission-mode': permissionMode }),
    body: JSON.stringify({ task, roomId, model }),
    signal: controller.signal,
  }).then(async response => {
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
            onEvent(data)
          } catch { /* skip malformed */ }
        }
      }
    }
  })

  return {
    abort: () => controller.abort(),
    promise,
  }
}

/**
 * AI chat (streaming SSE).
 */
export function aiChatStream(messages, model, onChunk, onDone) {
  const controller = new AbortController()

  const promise = fetch(`${BASE_URL}/api/ai/chat/stream`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ messages, model }),
    signal: controller.signal,
  }).then(async response => {
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
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') {
            onDone?.()
            return
          }
          try {
            const data = JSON.parse(payload)
            onChunk(data)
          } catch { /* skip */ }
        }
      }
    }
    onDone?.()
  })

  return { abort: () => controller.abort(), promise }
}

export const agentApi = {
  runAgent,
  runGroupAgent,
  aiChatStream,
  judgeTask: (task, context) => client.post('/api/agent/judge', { task, context }),
  getMemory: () => client.get('/api/agent/memory'),
  saveMemory: (name, description, type, content) =>
    client.post('/api/agent/memory', { name, description, type, content }),
  deleteMemory: (filename) =>
    client.delete(`/api/agent/memory/${encodeURIComponent(filename)}`),
  getPermissions: () => client.get('/api/agent/permissions'),
  getHooks: () => client.get('/api/agent/hooks'),
  clean: () => client.post('/api/agent/clean'),
}
