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

test('Admin user editor fetches fresh profile instead of list snapshot', async () => {
  const adminTab = await readFile(new URL('../../src/dashboard/AdminTab.jsx', import.meta.url), 'utf8');

  assert.match(adminTab, /openUserEditor/);
  assert.match(adminTab, /fetchEloStatsBatchByUserIds/);
  assert.match(adminTab, /normalizeProfileRow/);
  assert.match(adminTab, /AdminUserProfileOverview/);
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
