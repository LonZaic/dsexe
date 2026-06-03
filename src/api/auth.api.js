// ══════════════════════════════════════
// Auth API
// ══════════════════════════════════════

import client from './client.js'

export const authApi = {
  register(name, password) {
    return client.post('/api/auth/register', { name, password })
  },

  login(name, password) {
    return client.post('/api/auth/login', { name, password })
  },

  me() {
    return client.get('/api/auth/me')
  },
}
