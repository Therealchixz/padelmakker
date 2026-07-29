import test from 'node:test';
import assert from 'node:assert/strict';
import { inferToastType, resolveToastType, toastDurationMs } from '../../src/lib/toastUtils.js';

test('inferToastType: errors', () => {
  assert.equal(inferToastType('Kunne ikke sende besked. Prøv igen.'), 'error');
  assert.equal(inferToastType('ELO fejl: Ukendt fejl'), 'error');
  assert.equal(inferToastType('Kopiering mislykkedes'), 'error');
  assert.equal(inferToastType('Du kan ikke sende beskeder til denne bruger.'), 'error');
});

test('inferToastType: success', () => {
  assert.equal(inferToastType('Du er tilmeldt kampen!'), 'success');
  assert.equal(inferToastType('Profil opdateret!'), 'success');
  assert.equal(inferToastType('Invitation sendt til Mike!'), 'success');
  assert.equal(inferToastType('Kamp slettet.'), 'success');
});

test('inferToastType: info fallback', () => {
  assert.equal(inferToastType('Opret en 2v2-kamp i 3 trin.'), 'info');
  assert.equal(inferToastType('Vælg en dato.'), 'info');
  assert.equal(inferToastType(''), 'info');
});

test('resolveToastType: explicit wins over inference', () => {
  assert.equal(resolveToastType('info', 'Kunne ikke gemme'), 'info');
  assert.equal(resolveToastType('success', 'Noget gik galt'), 'success');
  assert.equal(resolveToastType(undefined, 'Du er tilmeldt!'), 'success');
  assert.equal(resolveToastType('weird', 'Kunne ikke hente data'), 'error');
});

test('toastDurationMs: errors linger longer', () => {
  assert.equal(toastDurationMs('error'), 4500);
  assert.ok(toastDurationMs('success') >= 3000);
  assert.ok(toastDurationMs('info') >= 2500);
});
