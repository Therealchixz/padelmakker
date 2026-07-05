import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const HOME_TAB_URL = new URL('../../src/dashboard/HomeTab.jsx', import.meta.url)
const MAKKERE_TAB_URL = new URL('../../src/dashboard/MakkereTab.jsx', import.meta.url)
const RESPONSIVE_CSS_URL = new URL('../../src/responsive.css', import.meta.url)
const DASHBOARD_PAGE_URL = new URL('../../src/dashboard/DashboardPage.jsx', import.meta.url)

test('home tab uses compact greeting header and quick actions', async () => {
  const homeTab = await readFile(HOME_TAB_URL, 'utf8')

  assert.match(homeTab, /greetingText/)
  assert.match(homeTab, /displayName/)
  assert.match(homeTab, /data-tour=\{`quick-action-\$\{t\}`\}/)
  assert.match(homeTab, /Niveau og ELO er ikke det samme/)
  assert.match(homeTab, /className="pm-home-seeking-cta"/)
  assert.match(homeTab, /data-tour="home-latest-activity"/)
})

test('home seeking CTA for match filter opens Kampe', async () => {
  const homeTab = await readFile(HOME_TAB_URL, 'utf8')

  assert.match(homeTab, /filterMatchCount/)
  assert.match(homeTab, /kampe matcher dit filter/)
  assert.match(homeTab, /onClick=\{\(\) => setTab\('kampe'\)\}/)
})

test('makkere tab supports seeking deep link from URL', async () => {
  const makkereTab = await readFile(MAKKERE_TAB_URL, 'utf8')

  assert.match(makkereTab, /useLocation/)
  assert.match(makkereTab, /useRef/)
  assert.match(makkereTab, /new URLSearchParams\(location\.search\)/)
  assert.match(makkereTab, /setFilterSeeking\(true\)/)
  assert.match(makkereTab, /seekingResultsRef/)
  assert.match(makkereTab, /scrollIntoView\(\{\s*behavior:\s*'smooth',\s*block:\s*'start'/)
  assert.match(makkereTab, /ref=\{seekingResultsRef\}/)
})

test('home dashboard keeps mobile layout hooks and seeking CTA styling', async () => {
  const dashboardPage = await readFile(DASHBOARD_PAGE_URL, 'utf8')
  const css = await readFile(RESPONSIVE_CSS_URL, 'utf8')

  assert.match(dashboardPage, /pm-dash-main--home/)
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.pm-dash-main--home\s*\{[\s\S]*padding-top:\s*0/)
  assert.match(css, /\.pm-home-seeking-cta\s*\{/)
})
