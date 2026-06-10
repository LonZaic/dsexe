// ══════════════════════════════════════
// SuperDS Electron Main Process
// Starts Express server in-process, opens app window
// ══════════════════════════════════════

const { app, BrowserWindow } = require('electron')
const path = require('path')
const http = require('http')

const PORT = 3001

// ─── Start Express server in same process ───
function startServer() {
  return new Promise((resolve, reject) => {
    // Set env before requiring server
    process.env.PORT = String(PORT)
    process.env.NODE_ENV = 'production'

    // Start the Express server
    require('../server/index.js')

    // Poll until server responds
    const maxAttempts = 30
    let attempts = 0
    const check = () => {
      attempts++
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        // Any response means server is running
        resolve()
      })
      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(check, 500)
        } else {
          reject(new Error('Server not reachable'))
        }
      })
      req.end()
    }
    setTimeout(check, 1000)
  })
}

// ─── Create main window ───
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'SuperDS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadURL(`http://127.0.0.1:${PORT}`)
}

// ─── App lifecycle ───
app.whenReady().then(async () => {
  try {
    await startServer()
    createWindow()
  } catch (err) {
    console.error('Startup failed:', err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
