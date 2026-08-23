import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { shouldExplainIosPushRequiresHomeScreen } from '../../src/lib/iosInstallPrompt.js';

const dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(dir, rel), 'utf8');

test('Aktiver og Slå fra ligger på notifikationssiden (mobil)', () => {
  const page = read('../../src/pages/NotifikationerPage.jsx');
  const controls = read('../../src/components/NotificationPushControls.jsx');
  const bell = read('../../src/components/NotificationBell.jsx');
  assert.match(page, /NotificationPushControls/);
  assert.match(page, /variant="page"/);
  assert.match(bell, /NotificationPushControls/);
  assert.match(controls, /Slå fra/);
  assert.match(controls, /Aktiver/);
  assert.match(controls, /shouldExplainIosPushRequiresHomeScreen/);
});

test('iOS-Safari uden hjemmeskærm skal stadig få forklaring', () => {
  const ios = read('../../src/lib/iosInstallPrompt.js');
  assert.match(ios, /shouldExplainIosPushRequiresHomeScreen/);
  assert.equal(typeof shouldExplainIosPushRequiresHomeScreen, 'function');
});
