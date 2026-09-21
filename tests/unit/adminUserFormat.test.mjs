/**
 * Oprettelsesdatoen i admin-panelets brugerliste. Datoen kommer fra
 * profiles.created_at, som RPC'en admin_profiles_with_email allerede returnerer
 * (den giver SETOF profiles), saa der skulle ingen aendring til i databasen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSignupDateDa } from '../../src/lib/adminUserFormat.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('datoen vises kort og paa dansk', () => {
  assert.equal(formatSignupDateDa('2026-04-07T10:00:00Z'), '7. apr. 2026');
});

test('datoen laeses som dansk tid, ikke som enhedens tidszone', () => {
  // 23:30 UTC den 21. er 01:30 dansk tid den 22. (sommertid, UTC+2).
  // Uden en fast tidszone ville svaret afhaenge af, hvor admin'en staar.
  assert.equal(formatSignupDateDa('2026-09-21T23:30:00Z'), '22. sep. 2026');
  // Og om vinteren, hvor Danmark er UTC+1.
  assert.equal(formatSignupDateDa('2026-12-31T23:30:00Z'), '1. jan. 2027');
});

test('en Date kan gives direkte', () => {
  assert.equal(formatSignupDateDa(new Date('2026-12-01T12:00:00Z')), '1. dec. 2026');
});

test('manglende dato giver en laeselig tekst, ikke "Invalid Date"', () => {
  for (const tom of [null, undefined, '', 'ikke en dato', NaN]) {
    assert.equal(formatSignupDateDa(tom), 'ukendt dato');
  }
});

test('tallet 0 er ikke en gyldig oprettelsesdato', () => {
  // 0 er et gyldigt tidsstempel (1. jan. 1970) og ville ellers staa i listen
  // som en helt almindelig dato. Det fanges eksplicit.
  assert.equal(formatSignupDateDa(0), 'ukendt dato');
});

test('brugerlisten viser datoen under mailen', () => {
  const src = readFileSync(join(root, 'src/dashboard/AdminTab.jsx'), 'utf8');
  assert.match(src, /formatSignupDateDa\(u\.created_at\)/, 'datoen skal komme fra created_at');
  assert.match(src, /pm-admin-user-created/, 'den skal have sin egen klasse, saa den kan styles');
});

test('datoen har en stil, saa den ikke arver noget tilfaeldigt', () => {
  const css = readFileSync(join(root, 'src/responsive.css'), 'utf8');
  assert.match(css, /\.pm-admin-user-created\s*\{/, 'klassen skal findes i stilarket');
});
