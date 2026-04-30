import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import test from 'node:test'
import { URL, fileURLToPath } from 'node:url'
import sharp from 'sharp'

const LOGO_PATH = fileURLToPath(new URL('../../public/logo-brand.png', import.meta.url))
const DARK_LOGO_PATH = fileURLToPath(new URL('../../public/logo-brand-dark.png', import.meta.url))

test('brand logo is a compact transparent navigation asset', async () => {
  const metadata = await sharp(LOGO_PATH).metadata()
  const file = await stat(LOGO_PATH)

  assert.equal(metadata.format, 'png')
  assert.equal(metadata.hasAlpha, true)
  assert.equal(metadata.width, 680)
  assert.ok(metadata.height <= 260, `expected compact nav logo, got ${metadata.width}x${metadata.height}`)
  assert.ok(file.size < 180_000, `expected optimized logo below 180 KB, got ${file.size} bytes`)

  const edgePixel = await sharp(LOGO_PATH)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer()

  assert.equal(edgePixel[3], 0)
})

test('dark brand logo is transparent and readable on dark navigation', async () => {
  const metadata = await sharp(DARK_LOGO_PATH).metadata()
  const file = await stat(DARK_LOGO_PATH)

  assert.equal(metadata.format, 'png')
  assert.equal(metadata.hasAlpha, true)
  assert.equal(metadata.width, 680)
  assert.ok(metadata.height <= 260, `expected compact nav logo, got ${metadata.width}x${metadata.height}`)
  assert.ok(file.size < 180_000, `expected optimized logo below 180 KB, got ${file.size} bytes`)

  const edgePixel = await sharp(DARK_LOGO_PATH)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer()

  assert.equal(edgePixel[3], 0)

  const { data, info } = await sharp(DARK_LOGO_PATH).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let brightPixels = 0
  let sampledPixels = 0

  for (let y = 0; y < info.height; y += 1) {
    for (let x = Math.floor(info.width * 0.42); x < info.width; x += 1) {
      const i = (y * info.width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      const isBlue = b > 120 && b > r + 35 && b > g + 10
      if (a > 64 && !isBlue) {
        sampledPixels += 1
        if ((r + g + b) / 3 > 220) brightPixels += 1
      }
    }
  }

  assert.ok(sampledPixels > 5000, `expected visible white text pixels, got ${sampledPixels}`)
  assert.ok(brightPixels / sampledPixels > 0.86, 'expected dark-mode text to be mostly white')
})

test('landing and dashboard swap to dark logo in dark mode without changing Google logo metadata', async () => {
  const landingPage = await readFile(new URL('../../src/pages/LandingPage.jsx', import.meta.url), 'utf8')
  const dashboardPage = await readFile(new URL('../../src/dashboard/DashboardPage.jsx', import.meta.url), 'utf8')
  const documentHead = await readFile(new URL('../../src/components/DocumentHead.jsx', import.meta.url), 'utf8')

  assert.match(landingPage, /src=\{dark \? "\/logo-brand-dark\.png" : "\/logo-brand\.png"\}/)
  assert.match(dashboardPage, /src=\{dark \? "\/logo-brand-dark\.png" : "\/logo-brand\.png"\}/)
  assert.match(documentHead, /ORGANIZATION_LOGO_PATH = '\/logo-brand\.png'/)
  assert.doesNotMatch(documentHead, /logo-brand-dark\.png/)
})
