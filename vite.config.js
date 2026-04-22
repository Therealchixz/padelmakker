/* global process */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ mode }) => {
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
  const sentryOrg = process.env.SENTRY_ORG
  const sentryProject = process.env.SENTRY_PROJECT
  const sentryEnabled = Boolean(
    mode === 'production' && sentryAuthToken && sentryOrg && sentryProject
  )

  const plugins = [react()]

  if (sentryEnabled) {
    plugins.push(
      sentryVitePlugin({
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProject,
        telemetry: false,
        sourcemaps: {
          filesToDeleteAfterUpload: ['dist/**/*.map'],
        },
      })
    )
  }

  return {
    plugins,
    build: {
      sourcemap: sentryEnabled ? 'hidden' : false,
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
        // Local dev uses the same API as production (requires network).
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
  }
})
