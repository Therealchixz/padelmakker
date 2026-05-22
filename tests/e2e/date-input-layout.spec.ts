import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

test.describe('Date input layout', () => {
  test('date overlay matches text field height and accepts clicks', async ({ page }) => {
    const cssPath = fileURLToPath(new URL('../../src/responsive.css', import.meta.url))
    const responsiveCss = await readFile(cssPath, 'utf8')

    await page.setViewportSize({ width: 390, height: 844 })
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="da">
        <head>
          <meta charset="utf-8" />
          <style>
            :root {
              --pm-border: #e2e4e8;
              --pm-surface: #ffffff;
              --pm-text: #1a1d21;
              --pm-text-light: #6b7280;
              --pm-font: system-ui, sans-serif;
              --pm-space-2: 12px;
              --pm-radius-md: 10px;
            }
            body { margin: 0; background: #f3f4f6; }
            #card.pm-create-form-anchor {
              width: 100%;
              max-width: 100%;
              min-width: 0;
              margin: 16px 0;
              padding: 20px;
              box-sizing: border-box;
              overflow-x: clip;
              background: var(--pm-surface);
              border: 1px solid var(--pm-border);
              border-radius: 12px;
            }
            .field {
              width: 100%;
              box-sizing: border-box;
              border: 1px solid var(--pm-border);
              border-radius: var(--pm-radius-md);
              background: var(--pm-surface);
              padding: 10px calc(var(--pm-space-2) + 2px);
              font-size: 14px;
              font-family: var(--pm-font);
              margin-bottom: 10px;
            }
          </style>
          <style>${responsiveCss.replace(/<\/style/gi, '<\\/style')}</style>
        </head>
        <body>
          <div id="card" class="pm-create-form-anchor">
            <input id="text-ref" class="field" type="text" placeholder="Navn" />
            <div class="pm-date-field">
              <div class="pm-date-field__facade field">
                <span class="pm-date-field__placeholder">dd-mm-åååå</span>
              </div>
              <input class="pm-date-field__overlay" type="date" aria-label="Startdato" />
            </div>
          </div>
        </body>
      </html>
    `)

    const card = page.locator('#card')
    const facade = page.locator('.pm-date-field__facade')
    const overlay = page.locator('.pm-date-field__overlay')
    const textRef = page.locator('#text-ref')

    await expect(overlay).toBeVisible()

    const cardBox = await card.boundingBox()
    const facadeBox = await facade.boundingBox()
    const textBox = await textRef.boundingBox()

    expect(cardBox).not.toBeNull()
    expect(facadeBox).not.toBeNull()
    expect(textBox).not.toBeNull()

    const cardRight = cardBox!.x + cardBox!.width
    const facadeRight = facadeBox!.x + facadeBox!.width

    expect(facadeBox!.x).toBeGreaterThanOrEqual(cardBox!.x - 1)
    expect(facadeRight).toBeLessThanOrEqual(cardRight + 1)
    expect(Math.abs(facadeBox!.height - textBox!.height)).toBeLessThanOrEqual(2)

    await overlay.click({ force: true })
    await expect(overlay).toBeFocused()
  })
})
