import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/stream': {
        target: 'https://content.tvkur.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/stream/, ''),
        headers: {
          'Referer': 'https://player.tvkur.com/',
          'Origin': 'https://player.tvkur.com',
        },
      },
    },
  },
})
