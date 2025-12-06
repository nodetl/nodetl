import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8602,
    proxy: {
      '/api': {
        target: 'http://localhost:8603',
        changeOrigin: true,
      },
      '/webhook': {
        target: 'http://localhost:8603',
        changeOrigin: true,
      },
    },
  },
})
