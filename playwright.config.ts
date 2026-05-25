import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173'

const hasAuthE2E = Boolean(
  process.env.VITE_SUPABASE_URL?.trim() &&
    process.env.VITE_SUPABASE_ANON_KEY?.trim() &&
    process.env.PLAYWRIGHT_TEST_EMAIL?.trim() &&
    process.env.PLAYWRIGHT_TEST_PASSWORD,
)

export default defineConfig({
  testDir: './tests/e2e',
  // Playwright wizard-filer (auth.setup / example.spec) bruges ikke i PadelMakker CI.
  testIgnore: ['**/auth.setup.ts', '**/example.spec.ts'],
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
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
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
