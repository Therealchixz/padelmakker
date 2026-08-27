import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

import {
  shouldRequireEmailVerification,
  shouldRequirePhoneVerification,
} from '../../src/lib/phoneVerification.js';

test('shouldRequireEmailVerification blocks dashboard until email is confirmed', () => {
  assert.equal(shouldRequireEmailVerification(null), false);
  assert.equal(shouldRequireEmailVerification(undefined), false);
  assert.equal(
    shouldRequireEmailVerification({ email: 'a@b.dk', email_confirmed_at: '2026-01-01T00:00:00Z' }),
    false,
  );
  assert.equal(
    shouldRequireEmailVerification({ email: 'a@b.dk', email_confirmed_at: null }),
    true,
  );
  assert.equal(shouldRequireEmailVerification({ email: '', email_confirmed_at: null }), false);
  assert.equal(shouldRequireEmailVerification({ email: '', email_confirmed_at: null }, { pendingEmail: 'a@b.dk' }), true);
});

test('email gate runs before phone gate in routing', async () => {
  const platform = await readFile(new URL('../../src/padelmakker-platform.jsx', import.meta.url), 'utf8');

  assert.match(platform, /shouldRequireEmailVerification/);
  assert.match(platform, /requiresEmailVerification[\s\S]*requiresPhoneVerification/);
  assert.match(platform, /\/opret\/bekraeft-email[\s\S]*requiresEmailVerification[\s\S]*SignupEmailSentPageLazy/);
  assert.doesNotMatch(platform, /allMatchIds\.slice\(0,\s*100\)/);
});

test('phone verification still required after email is confirmed', () => {
  const user = { email: 'a@b.dk', email_confirmed_at: '2026-01-01T00:00:00Z', phone_confirmed_at: null };
  const profile = { phone_verification_exempt: false };

  assert.equal(shouldRequireEmailVerification(user), false);
  assert.equal(shouldRequirePhoneVerification(user, profile), true);
});

test('KampeTab loads join requests for created matches and own requests', async () => {
  const kampeTab = await readFile(new URL('../../src/dashboard/KampeTab.jsx', import.meta.url), 'utf8');

  assert.match(kampeTab, /fetchRowsInChunks\(supabase,\s*"match_join_requests"/);
  assert.match(kampeTab, /\.eq\("user_id",\s*uid\)/);
  assert.doesNotMatch(kampeTab, /match_join_requests[\s\S]*\.slice\(0,\s*100\)/);
});

test('KampeTab list load skips global completed dump and duplicate elo reload', async () => {
  const kampeTab = await readFile(new URL('../../src/dashboard/KampeTab.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(kampeTab, /\.eq\("status",\s*"completed"\)[\s\S]{0,180}\.limit\(300\)/);
  assert.match(kampeTab, /\}, \[user\.id, showToast\]\);/);
  assert.match(kampeTab, /completedMatchIds/);
  assert.match(kampeTab, /ELO-historik hentes på detail/);
  const loadDataStart = kampeTab.indexOf('const loadData = useCallback');
  const loadDataEnd = kampeTab.indexOf('}, [user.id, showToast]);');
  assert.ok(loadDataStart >= 0 && loadDataEnd > loadDataStart);
  assert.equal(kampeTab.slice(loadDataStart, loadDataEnd).includes('fetchEloByUserIdFromHistory'), false);
});

test('Americano list hydrates current tab roster before paint', async () => {
  const americano = await readFile(new URL('../../src/features/americano/AmericanoTab.tsx', import.meta.url), 'utf8');

  assert.match(americano, /hydrateAmericanoViewRoster/);
  assert.match(americano, /americanoViewRef/);
  assert.match(americano, /rosterLoading/);
  assert.match(americano, /fetchRowsInChunks/);
  assert.match(americano, /\.eq\('status', 'registration'\)/);
  assert.match(americano, /\.eq\('status', 'playing'\)/);
  assert.match(americano, /\.eq\('status', 'completed'\)/);
  assert.doesNotMatch(americano, /\.limit\(200\)/);
  assert.match(americano, /setParticipantSnippets\(\(prev\) => \(\{ \.\.\.prev, \.\.\.roster\.snippets \}\)\)/);
});

test('Liga list hydrates current view teams and matches before paint', async () => {
  const liga = await readFile(new URL('../../src/dashboard/LigaTab.jsx', import.meta.url), 'utf8');

  assert.match(liga, /leagueIdsForListPaint/);
  assert.match(liga, /rosterLoading/);
  assert.match(liga, /fetchRowsInChunks\(supabase, 'league_teams'/);
  assert.match(liga, /fetchRowsInChunks\(supabase, 'league_matches'/);
  assert.doesNotMatch(liga, /\.in\('league_id', ids\)/);
  assert.match(liga, /loading \|\| rosterLoading/);
});

test('Americano and Liga hydrate detail routes without waiting for the full list', async () => {
  const americano = await readFile(new URL('../../src/features/americano/AmericanoTab.tsx', import.meta.url), 'utf8');
  const liga = await readFile(new URL('../../src/dashboard/LigaTab.jsx', import.meta.url), 'utf8');

  assert.match(americano, /if \(!embedDetailId && loading\)/);
  assert.match(americano, /\.eq\('id', embedDetailId\)/);
  assert.match(americano, /Turneringen blev ikke fundet/);
  assert.match(liga, /embedDetailLeagueId && !selectedLeague/);
  assert.match(liga, /\.eq\('id', embedDetailLeagueId\)/);
  assert.match(liga, /Ligaen blev ikke fundet/);
});

test('Admin user editor fetches fresh profile instead of list snapshot', async () => {
  const adminTab = await readFile(new URL('../../src/dashboard/AdminTab.jsx', import.meta.url), 'utf8');

  assert.match(adminTab, /openUserEditor/);
  assert.match(adminTab, /fetchEloStatsBatchByUserIds/);
  assert.match(adminTab, /normalizeProfileRow/);
  assert.match(adminTab, /AdminUserEditModal/);
  assert.doesNotMatch(adminTab, /onClick=\{\(\) => setEditingUser\(\{ \.\.\.u \}\)\}/);
});

test('Admin tab avoids stale list and match editor data', async () => {
  const adminTab = await readFile(new URL('../../src/dashboard/AdminTab.jsx', import.meta.url), 'utf8');

  assert.match(adminTab, /usersLoadSeqRef/);
  assert.match(adminTab, /fetchUsers[\s\S]*fetchEloStatsBatchByUserIds/);
  assert.match(adminTab, /openMatchResultEditor/);
  assert.match(adminTab, /\.eq\('id', matchId\)/);
  assert.match(adminTab, /refreshActiveAdminTab/);
  assert.match(adminTab, /visibilitychange/);
  assert.match(adminTab, /openMatchResultEditor\(m\.id\)/);
});

test('AuthContext signs out immediately when a user is banned', async () => {
  const authContext = await readFile(new URL('../../src/lib/AuthContext.jsx', import.meta.url), 'utf8');

  assert.match(authContext, /enforceBanLogout/);
  assert.match(authContext, /is_banned[\s\S]*enforceBanLogout/);
  assert.match(authContext, /signOut\(\)/);
  assert.doesNotMatch(authContext, /onAcknowledge=\{async \(\) => \{[\s\S]*await signOut\(\)/);
});
