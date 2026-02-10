import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/geoserver': {
        target: 'http://192.168.1.2:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
