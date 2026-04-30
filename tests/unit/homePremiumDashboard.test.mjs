import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const HOME_TAB_URL = new URL('../../src/dashboard/HomeTab.jsx', import.meta.url)
const RESPONSIVE_CSS_URL = new URL('../../src/responsive.css', import.meta.url)
const DASHBOARD_PAGE_URL = new URL('../../src/dashboard/DashboardPage.jsx', import.meta.url)

test('home tab uses the premium scale marker hero layout from the redesign', async () => {
  const homeTab = await readFile(HOME_TAB_URL, 'utf8')

  assert.match(homeTab, /className="pm-home-premium-hero"/)
  assert.match(homeTab, /className="pm-home-premium-stats"/)
  assert.match(homeTab, /className="pm-home-elo-scale"/)
  assert.match(homeTab, /Begynder/)
  assert.match(homeTab, /Pro/)
  assert.match(homeTab, /Seneste:/)
  assert.match(homeTab, /className="pm-home-seeking-cta"/)
  assert.match(homeTab, />Detaljer<\/button>/)
  assert.doesNotMatch(homeTab, /className="pm-home-sparkline"/)
  assert.doesNotMatch(homeTab, /profileFresh\?\.avatar \|\| user\.avatar \|\| userInitials/)
  assert.doesNotMatch(homeTab, /className="pm-stat-grid"/)
})

test('premium home dashboard has dedicated responsive styling', async () => {
  const css = await readFile(RESPONSIVE_CSS_URL, 'utf8')

  assert.match(css, /\.pm-home-premium-hero\s*\{/)
  assert.match(css, /\.pm-home-premium-stats\s*\{/)
  assert.match(css, /\.pm-home-elo-scale\s*\{/)
  assert.match(css, /\.pm-home-elo-scale-marker\s*\{/)
  assert.match(css, /\.pm-home-seeking-cta\s*\{/)
  assert.doesNotMatch(css, /\.pm-home-premium-hero::before/)
  assert.doesNotMatch(css, /\.pm-home-sparkline/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pm-home-premium-hero/)
})

test('mobile home dashboard starts flush below the header without card rounding', async () => {
  const dashboardPage = await readFile(DASHBOARD_PAGE_URL, 'utf8')
  const css = await readFile(RESPONSIVE_CSS_URL, 'utf8')

  assert.match(dashboardPage, /pm-dash-main--home/)
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.pm-dash-main--home\s*\{[\s\S]*padding-top:\s*0/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pm-home-premium-hero\s*\{[\s\S]*border-radius:\s*0;/)
})
