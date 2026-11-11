import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5180, host: true,
    // Dev only: forward API calls to the overseas backend running locally.
    proxy: { '/api': 'http://localhost:3100' }
  },
  preview: { port: 5180, host: true }
})
