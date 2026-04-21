import { expect, test } from '@playwright/test'

test.describe('Public smoke flows', () => {
  test('landing page renders hero and primary CTA', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /Find makker/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Kom i gang|Opret gratis profil/i }).first()).toBeVisible()
  })

  test('login page and forgot-password mode render', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: /Velkommen tilbage/i })).toBeVisible()
    await page.getByRole('button', { name: /Glemt adgangskode/i }).click()
    await expect(page.getByRole('heading', { name: /Glemt adgangskode/i })).toBeVisible()
  })

  test('onboarding page shows step-one fields', async ({ page }) => {
    await page.goto('/opret')

    await expect(page.getByRole('heading', { name: /Velkommen/i })).toBeVisible()
    await expect(page.getByLabel(/Fornavn/i)).toBeVisible()
    await expect(page.getByLabel(/Efternavn/i)).toBeVisible()
    await expect(page.getByLabel(/Email/i)).toBeVisible()
  })

  test('events page is reachable', async ({ page }) => {
    await page.goto('/events')

    await expect(page.getByRole('heading', { name: /Americano/i })).toBeVisible()
  })

  test('unauthenticated dashboard request lands on public app', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: /Find makker/i })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })
})
