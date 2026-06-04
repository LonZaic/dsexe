// ══════════════════════════════════════
// API Headers helper — sends x-api-key only when user chose "own key"
// ══════════════════════════════════════

export function getApiHeaders(extra = {}) {
  const mode = localStorage.getItem('key_mode') || 'builtin'
  const key = localStorage.getItem('apikey') || ''
  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  }
  // Only send API key if user explicitly chose "own key" mode
  if (mode === 'own' && key) {
    headers['x-api-key'] = key
  }
  return headers
}
