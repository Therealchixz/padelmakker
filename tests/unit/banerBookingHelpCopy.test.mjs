import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const BANER_TAB_URL = new URL('../../src/dashboard/BanerTab.jsx', import.meta.url)

test('baner booking help explains the booking flow in user-friendly language', async () => {
  const banerTab = await readFile(BANER_TAB_URL, 'utf8')

  assert.match(banerTab, /Vælg først din region/)
  assert.match(banerTab, /expandedRegions/)
  assert.match(banerTab, /Grøn tid/)
  assert.match(banerTab, /Gul tid/)
  assert.match(banerTab, /selve bookingen foregår altid hos centret/)
  assert.match(banerTab, /Rapportér fejl/)
  assert.doesNotMatch(banerTab, /konto-menuen/)
  assert.doesNotMatch(banerTab, /Åbn ét sted ad gangen/)
  assert.doesNotMatch(banerTab, /mødelokaler vises ikke/)
  assert.doesNotMatch(banerTab, /WannaSport|Padellife/)
})
