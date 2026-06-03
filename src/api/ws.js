let ws = null
let reconnectTimer = null
let handlers = {}
let userId = null

export function connect(token) {
  if (ws && ws.readyState === WebSocket.OPEN) return

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = protocol + '//' + location.host + '/ws'

  ws = new WebSocket(url)

  ws.onopen = () => {
    // Authenticate
    ws.send(JSON.stringify({ type: 'auth', token }))
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'authed') {
        userId = msg.userId
      }
      if (msg.type === 'error' && msg.error === '认证失败') {
        localStorage.removeItem('bbot_token')
        localStorage.removeItem('bbot_user')
        window.location.href = '/login'
      }
      // Call registered handlers
      const cbs = handlers[msg.type]
      if (cbs) {
        cbs.forEach(fn => fn(msg))
      }
      // Also call wildcard handlers
      const all = handlers['*']
      if (all) {
        all.forEach(fn => fn(msg))
      }
    } catch {}
  }

  ws.onclose = () => {
    userId = null
    // Auto-reconnect after 3 seconds
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      const t = localStorage.getItem('bbot_token')
      if (t) connect(t)
    }, 3000)
  }

  ws.onerror = () => {
    // Will trigger onclose
  }
}

export function disconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  if (ws) {
    ws.close()
    ws = null
  }
  userId = null
}

export function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
  }
}

export function on(type, callback) {
  if (!handlers[type]) handlers[type] = []
  handlers[type].push(callback)
  return () => {
    handlers[type] = handlers[type].filter(f => f !== callback)
  }
}

export function off(type, callback) {
  if (handlers[type]) {
    handlers[type] = handlers[type].filter(f => f !== callback)
  }
}

export function getUserId() {
  return userId
}

export function isConnected() {
  return ws && ws.readyState === WebSocket.OPEN
}
