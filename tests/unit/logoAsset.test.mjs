import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import test from 'node:test'
import { URL, fileURLToPath } from 'node:url'
import sharp from 'sharp'

const LOGO_PATH = fileURLToPath(new URL('../../public/logo-brand.png', import.meta.url))
const LOGO_MARK_PATH = fileURLToPath(new URL('../../public/logo-mark.png', import.meta.url))

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

test('brand mark is a transparent icon-only asset for sharp HTML wordmarks', async () => {
  const metadata = await sharp(LOGO_MARK_PATH).metadata()
  const file = await stat(LOGO_MARK_PATH)

  assert.equal(metadata.format, 'png')
  assert.equal(metadata.hasAlpha, true)
  assert.equal(metadata.width, metadata.height)
  assert.ok(metadata.width >= 512, `expected high-resolution square mark, got ${metadata.width}x${metadata.height}`)
  assert.ok(file.size < 90_000, `expected optimized mark below 90 KB, got ${file.size} bytes`)

  const edgePixel = await sharp(LOGO_MARK_PATH)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer()

  assert.equal(edgePixel[3], 0)
})

test('navigation uses icon image plus real text wordmark instead of rasterized logo text', async () => {
  const component = await readFile(new URL('../../src/components/BrandLogo.jsx', import.meta.url), 'utf8')
  const landing = await readFile(new URL('../../src/pages/LandingPage.jsx', import.meta.url), 'utf8')
  const dashboard = await readFile(new URL('../../src/dashboard/DashboardPage.jsx', import.meta.url), 'utf8')

  assert.match(component, /logo-mark\.png/)
  assert.match(component, /PADEL/)
  assert.match(component, /MAKKER/)
  assert.match(component, /FIND DIN PERFEKTE MAKKER/)
  assert.match(landing, /<BrandLogo size="landing"/)
  assert.match(dashboard, /<BrandLogo size="dashboard"/)
})
