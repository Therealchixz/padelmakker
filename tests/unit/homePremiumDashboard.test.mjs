import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const HOME_TAB_URL = new URL('../../src/dashboard/HomeTab.jsx', import.meta.url)
const RESPONSIVE_CSS_URL = new URL('../../src/responsive.css', import.meta.url)

// Den blå ELO-hero ("player-card") blev bevidst fjernet fra Hjem for at matche
// mockup'en. Denne vagt sikrer at den ikke sniger sig tilbage – hverken som JSX
// eller som CSS – så Hjem beholder den kompakte hilsen-topbar.
test('home does not render the blue premium ELO hero (removed per mockups)', async () => {
  const homeTab = await readFile(HOME_TAB_URL, 'utf8')

  assert.doesNotMatch(homeTab, /pm-home-premium-hero/)
  assert.doesNotMatch(homeTab, /pm-home-player-card-head/)
  assert.doesNotMatch(homeTab, /pm-home-premium-stats/)
  assert.doesNotMatch(homeTab, /pm-home-next-goal-card/)
  assert.doesNotMatch(homeTab, /pm-home-form-row/)
  // Bemærk: .pm-home-seeking-cta er IKKE hero — den genbruges af "X kampe
  // matcher dit filter"-genvejen og skal blive.
})

test('the blue premium hero styles are not reintroduced', async () => {
  const css = await readFile(RESPONSIVE_CSS_URL, 'utf8')

  assert.doesNotMatch(css, /\.pm-home-premium-hero\s*\{/)
  assert.doesNotMatch(css, /\.pm-home-player-card-head\s*\{/)
  assert.doesNotMatch(css, /\.pm-home-next-goal-card\s*\{/)
})
