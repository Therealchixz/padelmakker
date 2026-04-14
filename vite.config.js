import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          icons: ['lucide-react'],
          luxon: ['luxon'],
        },
      },
    },
  },
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
      '/api/halbooking-slots': {
        target: 'https://www.padelmakker.dk',
        changeOrigin: true,
        secure: true,
      },
      '/api/bookli-slots': {
        target: 'https://www.padelmakker.dk',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
