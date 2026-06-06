import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import nodemailer from 'nodemailer'

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'wasm-mime',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm')
          }
          next()
        })
      }
    },
    {
      name: 'smtp-proxy',
      configureServer(server) {
        server.middlewares.use('/api/send-email', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }
          let bodyStr = ''
          req.on('data', chunk => bodyStr += chunk)
          req.on('end', async () => {
            let payload
            try { payload = JSON.parse(bodyStr) } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }))
              return
            }
            const { host, port, user, pass, to, subject, text } = payload
            if (!host || !user || !pass || !to) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: '缺少必要参数' }))
              return
            }
            try {
              const transporter = nodemailer.createTransport({
                host,
                port: parseInt(port) || 465,
                secure: true,
                auth: { user, pass },
              })
              const info = await transporter.sendMail({ from: user, to, subject, text })
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: true, messageId: info.messageId }))
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: e.message }))
            }
          })
        })
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: true,
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      }
    }
  }
})
