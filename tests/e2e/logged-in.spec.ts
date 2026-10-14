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
    await expect(page.getByRole('heading', { name: 'Min profil' })).toBeVisible({ timeout: 20_000 })
  })

  test('kan åbne Baner og se søgning/regioner', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard/baner')
    await expect(page.getByRole('button', { name: 'Baner' }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder(/Søg center/i).first()).toBeVisible({ timeout: 20_000 })
  })

  test('kan åbne Beskeder-fanen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard/beskeder')
    await expect(page.getByRole('button', { name: 'Beskeder' }).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Ingen samtaler endnu|Søg|Ny besked|Beskeder/i).first()).toBeVisible({
      timeout: 20_000,
    })
  })

  test('profil-redigering viser blokerede spillere-sektion', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/dashboard')
    await expect(async () => {
      await page.locator('[data-tour="account-menu-btn"]').click()
      await expect(page.locator('[data-tour="account-menu-dropdown"]')).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 20_000 })
    await page.locator('[data-tour="account-menu-profile-btn"]').click()
    await expect(page.getByRole('heading', { name: 'Min profil' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /^Rediger$/i }).first().click()
    await expect(page.locator('[data-tour="blocked-users-section"]')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Blokerede spillere', { exact: true })).toBeVisible()
  })
  // Kun kig: testbrugeren er en rigtig konto, så rundturen trykker ikke på noget,
  // der gemmer, sender, tilmelder eller sletter.
  test('rundtur: alle faner åbner uden fejl på mobil og computer', async ({ page }) => {
    test.setTimeout(240_000)
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(String(err?.message || err).slice(0, 200)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[rundtur] console-fejl på ${page.url()}: ${msg.text().slice(0, 200)}`)
    })
    page.on('response', (res) => {
      if (res.status() >= 400 && /supabase\.co/.test(res.url())) {
        console.log(`[rundtur] HTTP ${res.status()} på ${page.url()}: ${res.request().method()} ${res.url().split('?')[0].slice(0, 160)}`)
      }
    })

    const tabs = [
      '/dashboard/hjem',
      '/dashboard/makkere',
      '/dashboard/kampe',
      '/dashboard/kampe?format=americano',
      '/dashboard/kampe?format=liga',
      '/dashboard/baner',
      '/dashboard/ranking',
      '/dashboard/beskeder',
      '/dashboard/notifikationer',
      '/dashboard/profil',
      '/dashboard/kamp-filter',
      '/dashboard/makker-filter',
    ]
    const sizes = [
      { name: 'mobil', width: 390, height: 844 },
      { name: 'computer', width: 1280, height: 800 },
    ]

    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height })
      for (const path of tabs) {
        await test.step(`${size.name} ${path}`, async () => {
          const errorsBefore = pageErrors.length
          await page.goto(path)
          await expect(page.locator('.pm-dash-main').first()).toBeVisible({ timeout: 20_000 })
          await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
          await page.waitForTimeout(800)

          await expect.soft(page.getByText('Noget gik galt'), `${size.name} ${path}: fejlskærm`).toHaveCount(0)
          const textLength = await page.locator('.pm-dash-main').first().evaluate((el) => (el.textContent || '').trim().length)
          expect.soft(textLength, `${size.name} ${path}: tom side`).toBeGreaterThan(20)
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
          expect.soft(overflow, `${size.name} ${path}: siden kan scrolles sidelæns`).toBeLessThanOrEqual(1)
          expect.soft(pageErrors.slice(errorsBefore), `${size.name} ${path}: JavaScript-fejl`).toEqual([])
          console.log(`[rundtur] ok ${size.name} ${path} (tekst ${textLength}, sidelæns ${overflow}px)`)
        })
      }
    }
  })

  test('Kampe: adressen vælger format (genveje til Liga og Americano)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    // Fx "Mine ligaer" på profilen og gamle /dashboard/liga-links.
    await page.goto('/dashboard/kampe?format=liga')
    await expect(page.getByRole('tab', { name: /^Liga/ })).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
    await page.goto('/dashboard/kampe?format=americano')
    await expect(page.getByRole('tab', { name: /^Americano/ })).toHaveAttribute('aria-selected', 'true', { timeout: 20_000 })
  })

  test('Hjem → "Opret turnering" åbner Americano-formularen (gemmer intet)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    // Samme adresse som knappen "Opret turnering" på Hjem, når der ingen aktivitet er.
    await page.goto('/dashboard/kampe?format=americano&create=1')
    await expect(page.getByRole('heading', { name: 'Opret Americano/Mexicano' })).toBeVisible({ timeout: 20_000 })
    await page.goto('/dashboard/kampe?create=1')
    await expect(page.getByRole('heading', { name: 'Opret kamp' })).toBeVisible({ timeout: 20_000 })
  })
})
