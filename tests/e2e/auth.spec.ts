import { expect, test } from '@playwright/test'

test.describe('Auth flows', () => {
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
    await expect(page.getByText(/Indtast din email/i).nth(1)).toBeVisible()

    await page.getByRole('button', { name: /Tilbage til login/i }).click()
    await expect(page.getByRole('heading', { name: /Velkommen tilbage/i })).toBeVisible()
  })

  test('onboarding shows inline validation for invalid email and password mismatch', async ({ page }) => {
    await page.goto('/opret')

    await page.getByLabel(/Email/i).fill('invalid-email')
    await expect(page.getByText(/Brug en gyldig e-mail/i)).toBeVisible()

    await page.getByLabel(/^Adgangskode$/i).fill('12345678')
    await page.getByLabel(/Bekr.*adgangskode/i).fill('12345679')
    await expect(page.getByText(/Adgangskoderne matcher ikke/i)).toBeVisible()
  })
})
