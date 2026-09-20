/**
 * To halvfaerdige funktioner blev fundet som "ubrugt kode": al deres
 * beregning koerte, men resultatet naaede aldrig braendefladen. Testene her
 * vogter den sidste ledning i begge, saa de ikke stille falder fra igen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(join(root, p), 'utf8');

test('antal chat-beskeder naar hele vejen ud i "Match chat (N)"', () => {
  const kampe = read('src/dashboard/KampeTab.jsx');
  const card = read('src/components/kampe/MatchDetailActionCard.jsx');

  // Tallet hentes ved indlaesning ...
  assert.match(kampe, /setMatchChatTotalById\(counts\)/);
  // ... laegges i kortets tilstand ...
  assert.match(kampe, /totalChatCount: matchChatTotalById\[String\(m\.id\)\] \|\| 0/);
  // ... staar i memo'ens afhaengigheder, saa det opdateres ...
  assert.match(kampe, /^\s*matchChatTotalById,$/m);
  // ... og sendes til kortet.
  assert.match(kampe, /totalChatCount=\{totalChatCount\}/);

  // Kortet tager imod og viser det.
  assert.match(card, /totalChatCount = 0/);
  assert.ok(
    card.includes("<b>Match chat{totalChatCount > 0 ? ` (${totalChatCount})` : ''}</b>"),
    'labelen viser ikke tallet',
  );
});

test('rundvisningen aabner notifikations-panelet paa mobil', () => {
  const dash = read('src/dashboard/DashboardPage.jsx');
  const home = read('src/dashboard/HomeTab.jsx');
  const bell = read('src/components/NotificationBell.jsx');

  // Trinnet peger paa panelet, som kun findes i DOM'en naar klokken er aaben.
  assert.match(dash, /id: 'notification-bell'/);
  assert.match(dash, /\[data-tour="notification-panel"\]/);

  // Flaget beregnes og sendes videre - det var netop leddet der manglede.
  assert.match(dash, /const tourOnNotificationStep =/);
  assert.match(dash, /tourForceNotificationOpen=\{tourOnNotificationStep\}/);

  // Mobil-klokken bor i HomeTab, ikke i DashboardPage.
  assert.match(home, /tourForceNotificationOpen = false/);
  assert.match(home, /<NotificationBell tourForceOpen=\{tourForceNotificationOpen\} \/>/);

  // Og proppen aabner faktisk panelet.
  assert.match(bell, /if \(!tourForceOpen\) return;\s*\n\s*setOpen\(true\);/);
});
