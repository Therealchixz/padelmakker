import { expect, test } from '@playwright/test'

test.describe('Public smoke flows', () => {
  test('landing page renders hero and primary CTA', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /Find makker/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Opret gratis profil/i }).first()).toBeVisible()
  })

  test('landing page communicates value proposition and SEO metadata', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/Find padelmakker på dit niveau/i)
    await expect(page.getByText(/Find padelspillere på dit niveau/i)).toBeVisible()
    await expect(page.getByText(/Opret profil, find makker, book bane og følg din ELO/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Opret gratis profil/i }).first()).toBeVisible()

    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /Find padelspillere på dit niveau/
    )
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Find padelmakker på dit niveau/
    )
  })

  test('mobile landing keeps stats below the first screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const firstStat = page.getByText('200+').first()
    await expect(firstStat).toBeVisible()

    const box = await firstStat.boundingBox()
    expect(box?.y).toBeGreaterThan(844)
  })

  test('landing page exposes critical resource hints', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('link[rel="preconnect"][href="https://fonts.googleapis.com"]')).toHaveCount(1)
    await expect(page.locator('link[rel="preconnect"][href="https://fonts.gstatic.com"]')).toHaveAttribute(
      'crossorigin',
      ''
    )
    await expect(page.locator('link[rel="preload"][href="/hero-bg.avif"]')).toHaveAttribute('as', 'image')
    await expect(page.locator('link[data-critical-font="inter"][href*="fonts.googleapis.com"]')).toHaveAttribute(
      'as',
      'style'
    )
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
