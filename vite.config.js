import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Lokal dev: bruger samme API som production (kræver netværk). Sæt evt. VITE_SKANSEN_SLOTS_URL til preview-URL.
      '/api/halbooking-skansen-padel': {
        target: 'https://www.padelmakker.dk',
        changeOrigin: true,
        secure: true,
      },
      '/api/halbooking-open-padel': {
        target: 'https://www.padelmakker.dk',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
