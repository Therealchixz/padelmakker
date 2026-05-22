import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * Layout smoke: dato-felt (tekst) matcher Navn og holder sig i kortet på mobil.
 */
test.describe('Date input layout', () => {
  test('date display field matches text input height and stays inside card', async ({ page }) => {
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
            #card.pm-ui-card.pm-create-form-anchor {
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
          <div id="card" class="pm-ui-card pm-create-form-anchor">
            <input id="text-ref" class="field" type="text" placeholder="Navn" />
            <div class="pm-date-field">
              <input class="pm-date-field__display field" type="text" readonly placeholder="dd-mm-åååå" />
              <input class="pm-date-field__native" type="date" tabindex="-1" aria-hidden="true" />
            </div>
          </div>
        </body>
      </html>
    `)

    const card = page.locator('#card')
    const dateDisplay = page.locator('.pm-date-field__display')
    const textRef = page.locator('#text-ref')

    await expect(dateDisplay).toBeVisible()

    const cardBox = await card.boundingBox()
    const dateBox = await dateDisplay.boundingBox()
    const textBox = await textRef.boundingBox()

    expect(cardBox).not.toBeNull()
    expect(dateBox).not.toBeNull()
    expect(textBox).not.toBeNull()

    const cardRight = cardBox!.x + cardBox!.width
    const dateRight = dateBox!.x + dateBox!.width
    const slack = 1

    expect(dateBox!.x).toBeGreaterThanOrEqual(cardBox!.x - slack)
    expect(dateRight).toBeLessThanOrEqual(cardRight + slack)
    expect(Math.abs(dateBox!.height - textBox!.height)).toBeLessThanOrEqual(2)
  })
})
