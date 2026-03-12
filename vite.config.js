import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/geoserver': {
        target: 'http://172.19.32.1:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
