import { expect, test } from '@playwright/test'
import { dismissCookieNotice, getPlaywrightAuthEnv, seedPlaywrightAuth } from './helpers/supabaseAuth'

const authEnv = getPlaywrightAuthEnv()

test.describe('Logged-in dashboard flows', () => {
  test.skip(
    !authEnv,
    'Kræver VITE_SUPABASE_* og PLAYWRIGHT_TEST_SERVICE_ROLE_KEY + EMAIL, REFRESH_TOKEN eller EMAIL/PASSWORD',
  )

  test.beforeEach(async ({ page }) => {
    if (!authEnv) return
    await dismissCookieNotice(page)
    // Undertryk førstegangs-onboarding-modaler (Velkommen + Aktiv søgning), så de
    // ikke lægger et backdrop hen over knapperne og opsnapper klik i testene.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('pm-active-seeking-onboarding-v1', '1')
        const realGet = localStorage.getItem.bind(localStorage)
        localStorage.getItem = (key: string) =>
          typeof key === 'string' &&
          (key.startsWith('pm_dash_welcome_v1_') || key.startsWith('pm_dash_tour'))
            ? '1'
            : realGet(key)
      } catch {
        /* ignore */
      }
    })
    await seedPlaywrightAuth(page, authEnv)
  })

  test('dashboard viser hjem med hurtig-handlinger', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: 'Hjem' }).first()).toBeVisible()
    await expect(page.getByText('Book Bane').first()).toBeVisible({ timeout: 20_000 })
  })

  test('kan skifte til Kampe og se 2v2-overblik', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Kampe' }).first().click()
    await expect(page.getByPlaceholder(/Søg spiller, bane/i).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Opret kamp/i }).first()).toBeVisible()
  })

  test('marketing-forside viser Gå til dashboard (ikke Opret/Log ind)', async ({ page }) => {
    await page.goto('/?forside=1')
    await expect(page.getByRole('button', { name: /Gå til dashboard/i }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: /Opret gratis profil/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Log ind$/i })).toHaveCount(0)
  })

  test('kan åbne profil via konto-menu (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard')
    // Konto-menuen er en toggle med en outside-click-lukker; i headless CI kan
    // det første klik race med at portal-dropdown'en monteres. Gør åbningen
    // robust: klik indtil dropdown'en faktisk står åben.
    await expect(async () => {
      await page.locator('[data-tour="account-menu-btn"]').click()
      await expect(page.locator('[data-tour="account-menu-dropdown"]')).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    await page.locator('[data-tour="account-menu-profile-btn"]').click()
    await expect(page.getByText('Overblik').first()).toBeVisible({ timeout: 20_000 })
  })
})
