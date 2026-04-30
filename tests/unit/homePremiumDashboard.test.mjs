import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const HOME_TAB_URL = new URL('../../src/dashboard/HomeTab.jsx', import.meta.url)
const RESPONSIVE_CSS_URL = new URL('../../src/responsive.css', import.meta.url)

test('home tab uses the premium sparkline hero layout from the redesign', async () => {
  const homeTab = await readFile(HOME_TAB_URL, 'utf8')

  assert.match(homeTab, /className="pm-home-premium-hero"/)
  assert.match(homeTab, /className="pm-home-premium-stats"/)
  assert.match(homeTab, /className="pm-home-sparkline"/)
  assert.match(homeTab, /Seneste 10 kampe/)
  assert.match(homeTab, /Seneste:/)
  assert.match(homeTab, /className="pm-home-seeking-cta"/)
  assert.match(homeTab, />Detaljer<\/button>/)
  assert.doesNotMatch(homeTab, /className="pm-stat-grid"/)
})

test('premium home dashboard has dedicated responsive styling', async () => {
  const css = await readFile(RESPONSIVE_CSS_URL, 'utf8')

  assert.match(css, /\.pm-home-premium-hero\s*\{/)
  assert.match(css, /\.pm-home-premium-stats\s*\{/)
  assert.match(css, /\.pm-home-sparkline\s*\{/)
  assert.match(css, /\.pm-home-seeking-cta\s*\{/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pm-home-premium-hero/)
})
