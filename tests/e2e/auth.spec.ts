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
    await expect(page.getByText(/Indtast e-mail eller telefonnummer og adgangskode/i)).toBeVisible()
  })

  test('forgot-password mode validates missing email', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('button', { name: /Glemt adgangskode/i }).click()
    await expect(page.getByRole('heading', { name: /Glemt adgangskode/i })).toBeVisible()

    await page.getByRole('button', { name: /Send nulstillingslink/i }).click()
    await expect(page.getByText(/^Indtast din e-mail først\.$/i)).toBeVisible()

    await page.getByRole('button', { name: /Tilbage til login/i }).click()
    await expect(page.getByRole('heading', { name: /Velkommen tilbage/i })).toBeVisible()
  })

  test('onboarding shows inline validation after leaving a field, and can show the password', async ({ page }) => {
    await page.goto('/opret')

    // Felterne deler label "Navn"/"E-mail" — mål dem via placeholder.
    const email = page.getByPlaceholder('din@email.dk')
    await email.fill('invalid-email')
    await expect(page.getByText(/Brug en gyldig e-mail/i)).toHaveCount(0)
    await email.blur()
    await expect(page.getByText(/Brug en gyldig e-mail/i)).toBeVisible()

    const password = page.getByPlaceholder('Mindst 8 tegn', { exact: true })
    await password.fill('1234')
    await password.blur()
    await expect(page.getByText(/Adgangskoden skal være mindst 8 tegn/i)).toBeVisible()

    await expect(password).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Vis adgangskode' }).click()
    await expect(password).toHaveAttribute('type', 'text')
  })
})
