import { expect, test } from '@playwright/test'
import { dismissCookieNotice, getPlaywrightAuthEnv, seedPlaywrightAuth } from './helpers/supabaseAuth'

const authEnv = getPlaywrightAuthEnv()

test.describe('Logged-in dashboard flows', () => {
  test.skip(
    !authEnv,
    'Kræver VITE_SUPABASE_* og PLAYWRIGHT_TEST_REFRESH_TOKEN eller EMAIL/PASSWORD',
  )

  test.beforeEach(async ({ page }) => {
    if (!authEnv) return
    await dismissCookieNotice(page)
    await seedPlaywrightAuth(page, authEnv)
  })

  test('dashboard viser hjem med ELO-overblik', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: 'Hjem' }).first()).toBeVisible()
    await expect(page.getByLabel('Din ELO status')).toBeVisible({ timeout: 20_000 })
  })

  test('kan skifte til Kampe og se 2v2-overblik', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Kampe' }).first().click()
    await expect(page.getByText('Mine kampe').first()).toBeVisible({ timeout: 20_000 })
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
    await page.locator('[data-tour="account-menu-btn"]').click()
    await page.locator('[data-tour="account-menu-profile-btn"]').click()
    await expect(page.getByLabel('Din ELO status')).toBeVisible({ timeout: 20_000 })
  })
})
