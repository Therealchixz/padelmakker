/**
 * Besked om nye kampe følger niveauet (ejerens beslutning 24. sep. 2026).
 *
 * Før fik alle inden for 250 ELO af opretteren besked (~3,75 niveauer), uanset
 * kampens eget niveau og modtagerens kamp-filter. Nu skal kampen passe inden for
 * den ramme, modtageren har valgt: selvvalgt fra-til, ellers eget niveau.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  matchLevelBounds,
  matchPassesLevelFilter,
  matchWatcherLevelBounds,
  matchFilterLevelLabel,
} from '../../src/lib/padelLevelUtils.js';
import { openMatchMatchesFilter, normalizeMatchSearchPrefs } from '../../src/lib/matchSearchFilterCore.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('kampens niveau læses fra level_range, ellers opretterens niveau ±0,5', () => {
  assert.deepEqual(matchLevelBounds({ level_range: 'elo:913-980|booked:no' }, { level: 5 }), { min: 2.7, max: 3.7 });
  assert.deepEqual(matchLevelBounds({ level_range: '' }, { level: 3.2 }), { min: 2.7, max: 3.7 });
});

test('uden selvvalgt spænd skal eget niveau ligge inden for kampens niveau', () => {
  const match = { level_range: 'elo:913-980|booked:no' }; // 2.7–3.7
  assert.equal(matchPassesLevelFilter(3.2, {}, null, match), true);
  assert.equal(matchPassesLevelFilter(3.7, {}, null, match), true);
  assert.equal(matchPassesLevelFilter(5.0, {}, null, match), false);
  // Det gamle ±-valg (levelWindow) udvider ikke længere rammen.
  assert.equal(matchPassesLevelFilter(3.8, { levelWindow: 0.5 }, null, match), false);
  assert.deepEqual(matchWatcherLevelBounds({}, 3.2), { min: 3.2, max: 3.2 });
});

test('selvvalgt fra-til skal overlappe kampens niveau', () => {
  const prefs = { levelMin: 3.3, levelMax: 3.6 };
  assert.equal(matchPassesLevelFilter(5.0, prefs, null, { level_range: 'elo:953-1000' }), true); // 3.3–4.0
  assert.equal(matchPassesLevelFilter(3.2, prefs, null, { level_range: 'elo:887-947' }), false); // 2.3–3.2
  assert.equal(matchFilterLevelLabel(prefs, 3.2), 'Niveau 3.3–3.6');
  assert.equal(matchFilterLevelLabel({}, 3.2), 'Kampe for niveau 3.2');
});

test('kamp-filteret gemmer levelMin/levelMax og bruger dem i matchningen', () => {
  const profile = { area: 'Region Hovedstaden', level: 3.2 };
  const prefs = normalizeMatchSearchPrefs({ region: 'Region Hovedstaden', levelMin: 4.0, levelMax: 4.5 }, profile);
  assert.equal(prefs.levelMin, 4);
  assert.equal(prefs.levelMax, 4.5);
  const match = { status: 'open', max_players: 4, current_players: 1, creator_id: 'c', level_range: 'elo:913-980' };
  const creator = { area: 'Region Hovedstaden', level: 3.2 };
  assert.equal(openMatchMatchesFilter(match, creator, prefs, profile, 'me'), false);
  const plain = normalizeMatchSearchPrefs({ region: 'Region Hovedstaden' }, profile);
  assert.equal(openMatchMatchesFilter(match, creator, plain, profile, 'me'), true);
});

test('SQL: notify_match_watchers filtrerer begge modtagergrupper på niveau', () => {
  const dir = join(root, 'supabase/migrations');
  const fil = readdirSync(dir).filter((f) => f.endsWith('_match_notify_follows_level.sql'))[0];
  assert.ok(fil, 'migrationen mangler');
  const sql = readFileSync(join(dir, fil), 'utf8');
  assert.doesNotMatch(sql, /BETWEEN v_elo_min AND v_elo_max/);
  assert.equal((sql.match(/match_fits_watcher_level\(p\.match_search_prefs, p\.level::numeric, v_match_min, v_match_max\)/g) || []).length, 2);
  assert.match(sql, /FROM public\.match_level_bounds\(v_match\.level_range, v_creator\.level::numeric\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.match_fits_watcher_level\(jsonb, numeric, numeric, numeric\) FROM PUBLIC, anon, authenticated/);
});

test('SQL: kampbeskeder bruger regionen fra kamp-filteret, ellers profilens', () => {
  const dir = join(root, 'supabase/migrations');
  const fil = readdirSync(dir).filter((f) => f.endsWith('_match_notify_uses_filter_region.sql'))[0];
  assert.ok(fil, 'migrationen mangler');
  const sql = readFileSync(join(dir, fil), 'utf8');
  assert.match(sql, /COALESCE\(NULLIF\(btrim\(COALESCE\(p_prefs->>'region', ''\)\), ''\), p_area, ''\)/);
  assert.equal((sql.match(/match_watcher_region\(p\.match_search_prefs, p\.area\) = ANY \(v_regions\)/g) || []).length, 2);
  assert.doesNotMatch(sql, /canonical_app_region\(p\.area\)/);
  // Niveau-reglen fra forrige migration skal stadig gælde.
  assert.equal((sql.match(/match_fits_watcher_level\(p\.match_search_prefs, p\.level::numeric, v_match_min, v_match_max\)/g) || []).length, 2);
});
