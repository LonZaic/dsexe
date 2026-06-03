const BASE = '/api'

function getToken() {
  return localStorage.getItem('bbot_token')
}

function getApiKey() {
  return localStorage.getItem('apikey') || ''
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...options.headers,
  }
  const res = await fetch(BASE + path, { ...options, headers })
  const body = await res.json()
  // Handle new unified response format {success, data/error}
  const data = body && typeof body === 'object' && 'success' in body ? body.data : body
  const errorMsg = body?.error?.message || body?.error
  if (res.status === 401) {
    localStorage.removeItem('bbot_token')
    localStorage.removeItem('bbot_user')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error(errorMsg || '登录已过期')
  }
  if (!res.ok) throw new Error(errorMsg || '请求失败')
  return data
}

// Auth
export const auth = {
  register(name, password) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, password })
    })
  },
  login(name, password) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name, password })
    })
  },
  me() {
    return request('/auth/me')
  }
}

// Users
export const users = {
  search(q) {
    return request('/users/search?q=' + encodeURIComponent(q))
  },
  online() {
    return request('/users/online')
  }
}

// Friends
export const friends = {
  list() {
    return request('/friends')
  },
  add(friendName) {
    return request('/friends/add', {
      method: 'POST',
      body: JSON.stringify({ friendName })
    })
  },
  accept(friendId) {
    return request('/friends/accept', {
      method: 'POST',
      body: JSON.stringify({ friendId })
    })
  },
  reject(friendId) {
    return request('/friends/reject', {
      method: 'POST',
      body: JSON.stringify({ friendId })
    })
  },
  remove(friendId) {
    return request('/friends/' + friendId, { method: 'DELETE' })
  }
}

// DM
export const dm = {
  history(friendId, before) {
    let url = '/dm/' + friendId
    if (before) url += '?before=' + before
    return request(url)
  },
  send(friendId, text, aiReply) {
    return request('/dm/' + friendId, {
      method: 'POST',
      body: JSON.stringify({ text, aiReply: aiReply || null })
    })
  }
}

// Groups
export const groups = {
  myList() {
    return request('/groups')
  },
  all() {
    return request('/groups/all')
  },
  create(name) {
    return request('/groups', {
      method: 'POST',
      body: JSON.stringify({ name })
    })
  },
  join(code) {
    return request('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ code })
    })
  },
  detail(id) {
    return request('/groups/' + id)
  },
  messages(id, before) {
    let url = '/groups/' + id + '/messages'
    if (before) url += '?before=' + before
    return request(url)
  },
  leave(id) {
    return request('/groups/' + id + '/leave', { method: 'POST' })
  }
}

// AI
export const ai = {
  async chat(messages, model) {
    const res = await fetch(BASE + '/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken(),
        'x-api-key': getApiKey(),
      },
      body: JSON.stringify({ messages, model: model || 'deepseek-v4-flash' })
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body?.error?.message || body?.error || 'AI 请求失败')
    // Unwrap new unified format {success, data: {reply}}
    const data = body && typeof body === 'object' && 'success' in body ? body.data : body
    return data.reply
  },
  async chatStream(messages, model, onChunk, onDone, onError) {
    try {
      const res = await fetch(BASE + '/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken(),
          'x-api-key': getApiKey(),
        },
        body: JSON.stringify({ messages, model: model || 'deepseek-v4-flash' })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'AI 请求失败')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) { onError && onError(new Error(parsed.error)); return }
            const delta = parsed.choices?.[0]?.delta
            // DeepSeek uses reasoning_content for actual text, content may be null
            const text = delta?.content || delta?.reasoning_content || ''
            if (text) {
              fullText += text
              onChunk && onChunk(fullText, text)
            }
          } catch {}
        }
      }
      onDone && onDone(fullText)
      return fullText
    } catch (e) {
      onError && onError(e)
    }
  }
}

export function isLoggedIn() {
  return !!getToken()
}

export function logout() {
  localStorage.removeItem('bbot_token')
  localStorage.removeItem('bbot_user')
}

export function saveAuth(token, user) {
  localStorage.setItem('bbot_token', token)
  localStorage.setItem('bbot_user', JSON.stringify(user))
}

export function getSavedUser() {
  try {
    const raw = localStorage.getItem('bbot_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
