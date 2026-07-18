import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(dir, rel), 'utf8');

test('Sprint C: toast supports typed modifiers', () => {
  const platform = read('../../src/padelmakker-platform.jsx');
  const css = read('../../src/responsive.css');
  assert.match(platform, /showToast = useCallback\(\(msg, type = 'info'\)/);
  assert.match(platform, /pm-toast--\$\{toast\.type\}/);
  assert.match(css, /\.pm-toast--success/);
  assert.match(css, /\.pm-toast--error/);
});

test('Sprint C: favorites use cloud helper', () => {
  const makkere = read('../../src/dashboard/MakkereTab.jsx');
  const fav = read('../../src/lib/userFavorites.js');
  assert.match(makkere, /loadFavoritesForUser/);
  assert.match(makkere, /toggleFavoriteForUser/);
  assert.match(fav, /user_favorites/);
});

test('Sprint C: notification dismiss is shared', () => {
  const storage = read('../../src/lib/notificationDismissStorage.js');
  const bell = read('../../src/components/NotificationBell.jsx');
  const page = read('../../src/pages/NotifikationerPage.jsx');
  assert.match(storage, /deleteNotificationsForUser/);
  assert.match(bell, /deleteNotificationsForUser/);
  assert.match(page, /deleteNotificationsForUser/);
  assert.doesNotMatch(page, /function addDismissedIds/);
});

test('Sprint C: profile can moderate and list blocks', () => {
  const modal = read('../../src/dashboard/PlayerProfileModal.jsx');
  const profil = read('../../src/dashboard/ProfilTab.jsx');
  assert.match(modal, /BeskedChatActions/);
  assert.match(modal, /context="profile"/);
  assert.match(profil, /blocked-users-section/);
  assert.match(profil, /fetchUsersIBlocked/);
});
