// ══════════════════════════════════════
// SuperDS Preload Script
// Minimal — app uses HTTP/WS to backend
// ══════════════════════════════════════

const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('superds', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
})
