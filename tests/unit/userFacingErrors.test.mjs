import test from 'node:test';
import assert from 'node:assert/strict';
import { mapUserFacingError } from '../../src/lib/userFacingErrors.js';

test('mapUserFacingError maps network errors', () => {
  assert.equal(
    mapUserFacingError(new Error('Failed to fetch')),
    'Kunne ikke forbinde. Tjek dit netværk og prøv igen.',
  );
});

test('mapUserFacingError maps auth-like messages via auth mapper', () => {
  assert.equal(
    mapUserFacingError(new Error('Invalid login credentials')),
    'Forkert email eller adgangskode.',
  );
});

test('mapUserFacingError hides technical PostgREST codes', () => {
  assert.equal(
    mapUserFacingError(new Error('PGRST116: JSON object requested, multiple (or no) rows returned')),
    'Noget gik galt. Prøv igen.',
  );
});

test('mapUserFacingError keeps short Danish product errors', () => {
  assert.equal(
    mapUserFacingError(new Error('Kampen er allerede fyldt.')),
    'Kampen er allerede fyldt.',
  );
});

test('mapUserFacingError uses custom fallback', () => {
  assert.equal(
    mapUserFacingError(new Error('permission denied for table matches'), 'Kunne ikke gemme.'),
    'Du har ikke adgang til den handling.',
  );
});
