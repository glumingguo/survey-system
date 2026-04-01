import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 如果设置了 VITE_API_BASE，使用它；否则使用本地后端
        target: (process.env.VITE_API_BASE || 'http://localhost:3002').replace(/\/api\/.*$/, ''),
        changeOrigin: true
      },
      '/uploads': {
        target: process.env.VITE_API_BASE || 'http://localhost:3002',
        changeOrigin: true
      },
      '/s/': {
        target: process.env.VITE_API_BASE || 'http://localhost:3002',
        changeOrigin: true
      }
    }
  }
})
