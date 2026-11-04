import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = (rel) => readFile(new URL(`../../${rel}`, import.meta.url), 'utf8');

// Ejeren 4. nov. 2026: "Én fælles toplinje". Alle hovedsider bruger ScreenHeader,
// ingen hjemmelavede <h2 style={{ fontSize: 19 … }}>-titler længere.
test('alle hovedsider bruger den fælles toplinje', async () => {
  const files = {
    'src/dashboard/HomeTab.jsx': null,
    'src/dashboard/MakkereTab.jsx': 'Find makker',
    'src/dashboard/BanerTab.jsx': 'Baner',
    'src/components/kampe/KampeRedesignToolbar.jsx': 'Kampe',
    'src/dashboard/RankingTab.jsx': 'Rangliste',
    'src/dashboard/BeskedTab.jsx': 'Beskeder',
    'src/dashboard/ProfilTab.jsx': 'Min profil',
  };
  for (const [file, title] of Object.entries(files)) {
    const s = await src(file);
    assert.match(s, /<ScreenHeader\b/, `${file} mangler ScreenHeader`);
    if (title) assert.match(s, new RegExp(`title="${title}"`), `${file} titel`);
    assert.doesNotMatch(s, /<h2 style=\{\{ fontSize: 19, fontWeight: 600, letterSpacing: '-0\.3px', color: theme\.text, margin: 0 \}\}>/, `${file} har stadig egen titel`);
  }
  const inbox = await src('src/components/chat/ChatInbox.jsx');
  assert.doesNotMatch(inbox, /pm-chat-v2-inbox-title/);
});

test('ScreenHeader: titel er h1, klokken kun på mobil', async () => {
  const s = await src('src/components/ScreenHeader.jsx');
  assert.match(s, /<h1 className="pm-screen-header-title">/);
  assert.match(s, /const bell = showBell && isMobile/);
  assert.match(s, /\(max-width: 768px\)/);
});

test('standardbilledet er et tegnet padel-ikon i stedet for tennis-emojien', async () => {
  const { isDefaultAvatar } = await import('../../src/components/PadelRacketIcon.jsx').catch(() => ({}));
  const icon = await src('src/components/PadelRacketIcon.jsx');
  assert.match(icon, /export function isDefaultAvatar/);
  if (isDefaultAvatar) {
    assert.equal(isDefaultAvatar('🎾'), true);
    assert.equal(isDefaultAvatar(''), true);
    assert.equal(isDefaultAvatar('👩'), false);
  }
  const circle = await src('src/components/AvatarCircle.jsx');
  assert.match(circle, /isDefaultAvatar\(avatar\)/);
  assert.doesNotMatch(circle, /avatar \|\| '🎾'/);
  const profileAvatar = await src('src/components/ProfileAvatar.tsx');
  assert.doesNotMatch(profileAvatar, /avatar \|\| '🎾'/);
});
