import { expect, test } from '@playwright/test'

test.describe('Public smoke flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pm_cookie_notice_v1', '1') } catch { /* ignore */ }
    })
  })

  test('landing page renders hero and primary CTA', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: /Find makker/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Opret gratis profil/i }).first()).toBeVisible()
  })

  test('landing navigation uses the updated uploaded brand logo', async ({ page }) => {
    await page.goto('/')

    const logo = page.getByRole('img', { name: 'PadelMakker logo' }).first()
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAttribute('src', '/logo-brand.png')
    const logoBox = await logo.boundingBox()
    expect(logoBox?.height).toBeLessThanOrEqual(50)
    await expect(page.getByRole('button', { name: 'PadelMakker forsiden' })).toBeVisible()

    await page.getByRole('button', { name: /M.rk/i }).click()
    await expect(logo).toHaveAttribute('src', '/logo-brand-dark.png')
  })

  test('landing page exposes Google-friendly organization logo structured data', async ({ page }) => {
    await page.goto('/')

    const structuredData = await page.locator('#pm-structured-data').textContent()
    const data = JSON.parse(structuredData ?? '{}')
    const graph = data['@graph'] ?? []
    const organization = graph.find((entry: { '@type'?: string }) => entry['@type'] === 'Organization')

    expect(data['@context']).toBe('https://schema.org')
    expect(organization).toMatchObject({
      '@type': 'Organization',
      name: 'PadelMakker',
      url: 'https://www.padelmakker.dk/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.padelmakker.dk/icon-512-v2.png',
        contentUrl: 'https://www.padelmakker.dk/icon-512-v2.png',
        encodingFormat: 'image/png',
        width: 512,
        height: 512,
      },
    })
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

  test('mobile landing keeps stats below hero', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    const hero = page.getByRole('heading', { name: /Find makker/i })
    const firstStat = page.getByText('Opret profil uden betaling').first()
    await expect(hero).toBeVisible()
    await expect(firstStat).toBeVisible()

    const heroBox = await hero.boundingBox()
    const statBox = await firstStat.boundingBox()
    expect(heroBox).toBeTruthy()
    expect(statBox).toBeTruthy()
    expect(statBox!.y).toBeGreaterThan(heroBox!.y + heroBox!.height - 8)
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
    await expect(page.locator('link[rel="preload"][href="/hero-bg-mobile.avif"]')).toHaveAttribute(
      'media',
      '(max-width: 540px)'
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

    await expect(page.getByRole('heading', { name: /Opret profil/i })).toBeVisible()
    await expect(page.getByPlaceholder('Fornavn')).toBeVisible()
    await expect(page.getByPlaceholder('Efternavn')).toBeVisible()
    await expect(page.getByPlaceholder('din@email.dk')).toBeVisible()
    await expect(page.getByPlaceholder('Gentag din e-mail')).toBeVisible()
  })

  test('events page is reachable', async ({ page }) => {
    await page.goto('/events')

    await expect(page.getByRole('heading', { name: /Turneringer & events/i })).toBeVisible()
  })

  test('unauthenticated dashboard request lands on public app', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: /Find makker/i })).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })
})
