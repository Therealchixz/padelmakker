import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * Layout smoke: dato-boks må ikke stikke ud over kortet (mobil-bredde).
 * Bruger samme pm-date-field-* markup som DateInputField + responsive.css.
 */
test.describe('Date input layout', () => {
  test('date field box stays inside card on mobile viewport', async ({ page }) => {
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
              width: min(100%, 350px);
              margin: 16px auto;
              padding: 20px;
              box-sizing: border-box;
              overflow: hidden;
              max-width: 100%;
              background: var(--pm-surface);
              border: 1px solid var(--pm-border);
              border-radius: 12px;
            }
          </style>
          <style>${responsiveCss.replace(/<\/style/gi, '<\\/style')}</style>
        </head>
        <body>
          <div id="card" class="pm-ui-card pm-create-form-anchor">
            <label>Startdato</label>
            <div class="pm-date-field">
              <div class="pm-date-field__clip pm-date-field__box" style="width:100%;box-sizing:border-box;border:1px solid var(--pm-border);border-radius:var(--pm-radius-md);background:var(--pm-surface);padding:10px calc(var(--pm-space-2) + 2px);">
                <input type="date" class="pm-date-field__input pm-date-field__input--empty" value="" />
                <span class="pm-date-field__hint" aria-hidden="true">dd-mm-åååå</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `)

    const card = page.locator('#card')
    const box = page.locator('.pm-date-field__box')

    await expect(box).toBeVisible()

    const cardBox = await card.boundingBox()
    const fieldBox = await box.boundingBox()

    expect(cardBox).not.toBeNull()
    expect(fieldBox).not.toBeNull()

    const cardRight = cardBox!.x + cardBox!.width
    const fieldRight = fieldBox!.x + fieldBox!.width
    const slack = 1

    expect(fieldBox!.x).toBeGreaterThanOrEqual(cardBox!.x - slack)
    expect(fieldRight).toBeLessThanOrEqual(cardRight + slack)
  })
})
