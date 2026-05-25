import { defineConfig, devices } from '@playwright/test'

// Tom streng fra GitHub env skal ikke slå webServer fra (kun rigtig URL gør det).
const playwrightBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim()
const baseURL = playwrightBaseUrl || 'http://127.0.0.1:4173'
const useCiPreview = Boolean(process.env.CI) && !playwrightBaseUrl

const hasAuthE2E = Boolean(
  process.env.VITE_SUPABASE_URL?.trim() &&
    process.env.VITE_SUPABASE_ANON_KEY?.trim() &&
    process.env.PLAYWRIGHT_TEST_EMAIL?.trim() &&
    process.env.PLAYWRIGHT_TEST_PASSWORD,
)

export default defineConfig({
  testDir: './tests/e2e',
  // Playwright wizard-filer (auth.setup / example.spec) bruges ikke i PadelMakker CI.
  testIgnore: ['**/auth.setup.ts', '**/example.spec.ts', '**/main.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: playwrightBaseUrl
    ? undefined
    : {
        command: useCiPreview
          ? 'npx vite preview --host 127.0.0.1 --port 4173'
          : 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: useCiPreview
          ? {}
          : {
              VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
              VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
            },
      },
  projects: [
    {
      name: 'chromium',
      testIgnore: hasAuthE2E ? ['**/logged-in.spec.ts'] : undefined,
      use: { ...devices['Desktop Chrome'] },
    },
    ...(hasAuthE2E
      ? [
          {
            name: 'authenticated',
            testMatch: '**/logged-in.spec.ts',
            use: { ...devices['Desktop Chrome'] },
          },
        ]
      : []),
  ],
})
