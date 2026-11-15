/**
 * UX-gennemgangens punkt 8-11 (spillerprofil, kampdetalje, opret kamp, Kampe-toppen).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultMatchLevelEloRange, eloToLevel, MATCH_DEFAULT_LEVEL_WINDOW } from '../../src/lib/padelLevelUtils.js';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

test('punkt 8: invitér og send besked står fast i bunden af spillerprofilen', () => {
  const src = read('src/dashboard/PlayerProfileModal.jsx');
  const scrollEnd = src.lastIndexOf('</div>\n        {/* Handlingerne');
  const bar = src.indexOf('className="pm-player-profile-actions"');
  assert.ok(bar > 0 && scrollEnd > 0 && bar > scrollEnd, 'knapperne skal ligge uden for det rullende indhold');
  assert.match(read('src/responsive.css'), /\.pm-player-profile-actions \{[\s\S]*?env\(safe-area-inset-bottom/);
});

test('punkt 9: din egen ELO-ændring og holdnavne i stedet for "Vindere/Modstandere"', () => {
  const src = read('src/components/kampe/MatchCompletedDetail.jsx');
  assert.doesNotMatch(src, /label="Modstandere"/);
  assert.match(src, /label: 'Dig'/);
  assert.match(src, /din ELO-ændring/);
  assert.match(src, /gennemsnit for holdet/);
  const sheet = read('src/components/kampe/KampeMatchDetailSheet.jsx');
  assert.match(sheet, /const showBooked = matchPrefs\?\.booked != null && !isFinished;/);
});

test('punkt 10: standard-niveau er dit eget niveau ± 0,5', () => {
  assert.equal(MATCH_DEFAULT_LEVEL_WINDOW, 0.5);
  const r = defaultMatchLevelEloRange({ level: 3.2 });
  assert.equal(eloToLevel(r.min).toFixed(1), '2.7');
  assert.equal(eloToLevel(r.max).toFixed(1), '3.7');
});

test('punkt 10: een skaerm (kampkort), valgfrit for sig, og gratis indtil der er en pris', () => {
  // H-designet (15. nov. 2026): de to trin Info/Bekraeft er afloest af een skaerm,
  // hvor et resume oeverst viser hvad der oprettes, og hvert valg folder ud paa stedet.
  const form = read('src/components/kampe/CreateMatchForm.jsx');
  assert.doesNotMatch(form, /label: "Bekræft"/);
  assert.match(form, /pm-opret-head-title/, 'resume oeverst');
  assert.match(form, /aria-expanded=\{open\}/, 'raekker folder ud');
  assert.match(form, /Valgfrit/);
  assert.match(form, /\{hasPrice \? \(/, 'betaling vises kun med en pris');
  assert.match(form, /paid \? \(m\.payment_method === 'free' \? 'mobilepay' : m\.payment_method\) : 'free'/);
  assert.match(form, /onClick=\{createMatch\}/, 'eet tryk opretter');
  const tab = read('src/dashboard/KampeTab.jsx');
  assert.match(tab, /payment_method: "free",/);
});

test('punkt 11: kampene kommer før forklaringen', () => {
  const tab = read('src/dashboard/KampeTab.jsx');
  assert.ok(
    tab.indexOf('<div className="pm-kampe-v2-list">') < tab.indexOf('Sådan fungerer 2v2-kampe'),
    'forklaringen skal stå under listen',
  );
  const panel = read('src/components/ActiveSeekingPanel.jsx');
  assert.match(panel, /notifyOnly && active \? null :/);
});
