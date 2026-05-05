import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const HOME_TAB_URL = new URL('../../src/dashboard/HomeTab.jsx', import.meta.url)
const MAKKERE_TAB_URL = new URL('../../src/dashboard/MakkereTab.jsx', import.meta.url)
const RESPONSIVE_CSS_URL = new URL('../../src/responsive.css', import.meta.url)
const DASHBOARD_PAGE_URL = new URL('../../src/dashboard/DashboardPage.jsx', import.meta.url)

test('home tab uses a player-card ELO hero without the long technical scale', async () => {
  const homeTab = await readFile(HOME_TAB_URL, 'utf8')

  assert.match(homeTab, /className="pm-home-premium-hero"/)
  assert.match(homeTab, /className="pm-home-premium-stats"/)
  assert.match(homeTab, /className="pm-home-player-card-head"/)
  assert.match(homeTab, /className="pm-home-next-goal-card"/)
  assert.match(homeTab, /className="pm-home-form-row"/)
  assert.match(homeTab, /recentForm/)
  assert.match(homeTab, /nextEloMilestone/)
  assert.match(homeTab, /Næste mål/)
  assert.match(homeTab, /ELO til/)
  assert.match(homeTab, /Seneste form/)
  assert.match(homeTab, /className="pm-home-seeking-cta"/)
  assert.match(homeTab, />Detaljer<\/button>/)
  assert.doesNotMatch(homeTab, /className="pm-home-elo-scale"/)
  assert.doesNotMatch(homeTab, /className="pm-home-elo-scale-track"/)
  assert.doesNotMatch(homeTab, /eloScalePct/)
  assert.doesNotMatch(homeTab, /<span>Begynder<\/span>/)
  assert.doesNotMatch(homeTab, /<span>Pro<\/span>/)
  assert.doesNotMatch(homeTab, /progressPct/)
  assert.doesNotMatch(homeTab, /pm-home-elo-goal-track/)
  assert.doesNotMatch(homeTab, /weeklyEloChange/)
  assert.doesNotMatch(homeTab, /latestEloChange/)
  assert.doesNotMatch(homeTab, /Seneste:/)
  assert.doesNotMatch(homeTab, /denne uge/)
  assert.doesNotMatch(homeTab, /const levelBadge/)
  assert.doesNotMatch(homeTab, /\{levelBadge\}/)
  assert.doesNotMatch(homeTab, /className="pm-home-premium-latest"/)
  assert.doesNotMatch(homeTab, /className="pm-home-sparkline"/)
  assert.doesNotMatch(homeTab, /profileFresh\?\.avatar \|\| user\.avatar \|\| userInitials/)
  assert.doesNotMatch(homeTab, /className="pm-stat-grid"/)
})

test('premium home player card has dedicated responsive styling', async () => {
  const css = await readFile(RESPONSIVE_CSS_URL, 'utf8')

  assert.match(css, /\.pm-home-premium-hero\s*\{/)
  assert.match(css, /\.pm-home-premium-stats\s*\{/)
  assert.match(css, /\.pm-home-player-card-head\s*\{/)
  assert.match(css, /\.pm-home-next-goal-card\s*\{/)
  assert.match(css, /\.pm-home-form-row\s*\{/)
  assert.doesNotMatch(css, /\.pm-home-elo-scale\s*\{/)
  assert.doesNotMatch(css, /\.pm-home-elo-scale-marker\s*\{/)
  assert.doesNotMatch(css, /\.pm-home-elo-goal\s*\{/)
  assert.match(css, /\.pm-home-seeking-cta\s*\{/)
  assert.doesNotMatch(css, /\.pm-home-elo-goal-track/)
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

test('mobile player-card ELO hero is compact instead of a tall stacked block', async () => {
  const css = await readFile(RESPONSIVE_CSS_URL, 'utf8')

  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pm-home-premium-hero\s*\{[\s\S]*padding:\s*16px 14px 16px;/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pm-home-player-card-head\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.9fr\)\s*minmax\(132px,\s*1fr\);/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pm-home-premium-stats\s*\{[\s\S]*grid-column:\s*1 \/ -1;/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pm-home-form-row\s*\{[\s\S]*padding:\s*8px 10px;/)
})

test('home seeking CTA opens Makkere with the active seeking filter', async () => {
  const homeTab = await readFile(HOME_TAB_URL, 'utf8')
  const makkereTab = await readFile(MAKKERE_TAB_URL, 'utf8')

  assert.match(homeTab, /setTab\(seekingCount > 0 \? 'makkere\?seeking=1' : 'makkere'\)/)
  assert.match(makkereTab, /useLocation/)
  assert.match(makkereTab, /useRef/)
  assert.match(makkereTab, /new URLSearchParams\(location\.search\)/)
  assert.match(makkereTab, /setFilterSeeking\(true\)/)
  assert.match(makkereTab, /seekingResultsRef/)
  assert.match(makkereTab, /scrollIntoView\(\{\s*behavior:\s*'smooth',\s*block:\s*'start'/)
  assert.match(makkereTab, /ref=\{seekingResultsRef\}/)
})
