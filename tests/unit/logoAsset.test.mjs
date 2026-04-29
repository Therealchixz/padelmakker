import assert from 'node:assert/strict'
import { stat } from 'node:fs/promises'
import test from 'node:test'
import { URL, fileURLToPath } from 'node:url'
import sharp from 'sharp'

const LOGO_PATH = fileURLToPath(new URL('../../public/logo-brand.png', import.meta.url))

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
