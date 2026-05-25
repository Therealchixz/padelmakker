import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'

const ADMIN_TAB_URL = new URL('../../src/dashboard/AdminTab.jsx', import.meta.url)

test('admin console copy is consistently Danish in UI labels', async () => {
  const adminTab = await readFile(ADMIN_TAB_URL, 'utf8')

  assert.match(adminTab, /Admin-konsol/)
  assert.match(adminTab, /Åbne flags/)
  assert.match(adminTab, /Høje flags/)
  assert.match(adminTab, /ELO-\/Americano-flags/)
  assert.match(adminTab, /venter på bekræftelse/)
  assert.match(adminTab, /Søg i årsag, data, kamp-id/)
  assert.match(adminTab, /Gennemgået/)
  assert.match(adminTab, /Lukket/)
  assert.match(adminTab, /Alle alvorlighedsgrader/)
  assert.match(adminTab, /Ukendt årsag/)
  assert.match(adminTab, /Gennemgået af:/)
  assert.match(adminTab, /Gennemgået tid:/)
  assert.match(adminTab, /Datafelt/)
  assert.match(adminTab, /Ingen flags med nuværende filter\./)
  assert.match(adminTab, /Genåbn/)

  assert.doesNotMatch(adminTab, /Admin Console/)
  assert.doesNotMatch(adminTab, /Reviewed/)
  assert.doesNotMatch(adminTab, /Closed/)
  assert.doesNotMatch(adminTab, /Alle severity/)
  assert.doesNotMatch(adminTab, /Ukendt reason/)
  assert.doesNotMatch(adminTab, /Match:/)
  assert.doesNotMatch(adminTab, /Tournament:/)
  assert.doesNotMatch(adminTab, /Reviewed af:/)
  assert.doesNotMatch(adminTab, /Reviewed tid:/)
  assert.doesNotMatch(adminTab, /Payload/)
})

test('admin console keeps stable enum values for filtering and DB status updates', async () => {
  const adminTab = await readFile(ADMIN_TAB_URL, 'utf8')

  // UI text is Danish, but values must remain stable for backend compatibility.
  assert.match(adminTab, /value="open"/)
  assert.match(adminTab, /value="reviewed"/)
  assert.match(adminTab, /value="closed"/)

  assert.match(adminTab, /value="high"/)
  assert.match(adminTab, /value="medium"/)
  assert.match(adminTab, /value="low"/)
})

test('admin console uses shared filter/stats helpers and flag update builder', async () => {
  const adminTab = await readFile(ADMIN_TAB_URL, 'utf8')

  assert.match(adminTab, /adminConsoleUtils/)
  assert.match(adminTab, /filterRatingAdminFlags/)
  assert.match(adminTab, /computeAdminConsoleStats/)
  assert.match(adminTab, /buildRatingFlagStatusUpdate/)
  assert.match(adminTab, /fetchAdminConsole/)
  assert.match(adminTab, /admin_audit_log_recent|fetchAdminAuditLogRecent/)
})
