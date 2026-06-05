// ══════════════════════════════════════
// Code Mode API helpers
// ══════════════════════════════════════

import { BASE_URL } from './client.js'
import { getApiHeaders } from '../utils/apiHeaders.js'

function authHeaders() { return getApiHeaders({}) }

export async function scanFileTree(projectPath) {
  const res = await fetch(`${BASE_URL}/api/code/filetree`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ projectPath })
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

export async function readFileContent(filePath, projectPath = '') {
  const res = await fetch(`${BASE_URL}/api/code/read-file`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ filePath, projectPath })
  })
  return res.json()
}

export async function newProject(projectPath, projectName) {
  const res = await fetch(`${BASE_URL}/api/code/new-project`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ projectPath, projectName })
  })
  return res.json()
}

export async function runCodeAgent(task, projectPath, model, onEvent, signal, existingTasks = null) {
  const res = await fetch(`${BASE_URL}/api/code/run`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ task, projectPath, model, existingTasks }),
    signal,
  })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (t.startsWith('data:')) {
        try { await onEvent(JSON.parse(t.slice(5).trim())) } catch {}
      }
    }
  }
}

export async function getFollow(projectPath) {
  const res = await fetch(`${BASE_URL}/api/code/follow`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ projectPath })
  })
  return res.json()
}

export async function searchFollow(projectPath, query) {
  const res = await fetch(`${BASE_URL}/api/code/follow-search`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ projectPath, query })
  })
  return res.json()
}

export async function getTask(projectPath) {
  const res = await fetch(`${BASE_URL}/api/code/task`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ projectPath })
  })
  return res.json()
}
