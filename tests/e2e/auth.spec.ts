import { expect, test } from '@playwright/test'

test.describe('Auth flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try { window.localStorage.setItem('pm_cookie_notice_v1', '1') } catch { /* ignore */ }
    })
  })

  test('login blocks submit with empty credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('button', { name: /^Log ind$/i }).click()
    await expect(page.getByText(/Indtast email og adgangskode/i)).toBeVisible()
  })

  test('forgot-password mode validates missing email', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('button', { name: /Glemt adgangskode/i }).click()
    await expect(page.getByRole('heading', { name: /Glemt adgangskode/i })).toBeVisible()

    await page.getByRole('button', { name: /Send nulstillingslink/i }).click()
    await expect(page.getByText(/^Indtast din email først$/i)).toBeVisible()

    await page.getByRole('button', { name: /Tilbage til login/i }).click()
    await expect(page.getByRole('heading', { name: /Velkommen tilbage/i })).toBeVisible()
  })

  test('onboarding shows inline validation for invalid email and password mismatch', async ({ page }) => {
    await page.goto('/opret')

    // Felterne deler label "Navn"/"E-mail" — mål dem via placeholder.
    const email = page.getByPlaceholder('din@email.dk')
    await email.fill('invalid-email')
    await email.blur()
    await expect(page.getByText(/Brug en gyldig e-mail/i)).toBeVisible()

    await page.getByPlaceholder('Adgangskode', { exact: true }).fill('12345678')
    const passwordConfirm = page.getByPlaceholder('Gentag', { exact: true })
    await passwordConfirm.fill('12345679')
    await passwordConfirm.blur()
    await expect(page.getByText(/Adgangskoderne matcher ikke/i)).toBeVisible()
  })
})
