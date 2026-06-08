import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('tom-tilstande på Kampe bruger Lucide via EmptyStateIcon', () => {
  const kampe = readFileSync(join(root, 'src/dashboard/KampeTab.jsx'), 'utf8');
  const americano = readFileSync(join(root, 'src/features/americano/AmericanoTab.tsx'), 'utf8');
  const liga = readFileSync(join(root, 'src/dashboard/LigaTab.jsx'), 'utf8');
  const icon = readFileSync(join(root, 'src/components/EmptyStateIcon.jsx'), 'utf8');

  assert.match(icon, /pm-empty-state-icon/);
  assert.match(kampe, /EmptyStateIcon icon=\{Swords\}/);
  assert.match(kampe, /EmptyStateIcon icon=\{Users\}/);
  assert.match(kampe, /EmptyStateIcon icon=\{BarChart3\}/);
  assert.doesNotMatch(kampe, /pm-state-icon">⚔️/);
  assert.match(americano, /EmptyStateIcon icon=\{CalendarDays\}/);
  assert.match(americano, /EmptyStateIcon icon=\{Inbox\}/);
  assert.doesNotMatch(americano, /pm-state-icon">📭/);
  assert.match(liga, /EmptyStateIcon icon=\{Trophy\}/);
});
