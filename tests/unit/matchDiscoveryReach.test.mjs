/**
 * Hvor mange mennesker kan faa at vide, at der er en ny kamp?
 *
 * Maalt i produktionen 22. sep. 2026: 13 kampe oprettet nogensinde. De 3 der
 * naaede fire spillere blev ALLE spillet. De 10 aflyste havde i gennemsnit
 * under én spiller. Kun 6 personer ud af 98 har nogensinde meldt sig til en
 * andens kamp.
 *
 * Aarsagen var ikke matchningen, men raekkevidden: beskeden om en ny kamp naaede
 * 2 mennesker i hele landet, fordi
 *   1) "giv mig besked om nye kampe" var slaaet FRA som standard (11 af 98), og
 *   2) modtageren skulle bo i PRAECIS samme region som opretteren.
 *
 * Testene her vogter begge dele i migrationerne. Selve udvaelgelsen sker i
 * Postgres og kan ikke koeres her, saa reglerne kontrolleres i SQL-teksten.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = join(root, 'supabase/migrations');
const BASELINE = '00000000000000_baseline_schema.sql';

function migrationsEfterBaseline() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f !== BASELINE)
    .sort();
}

/** Den SIDSTE migration der naevner et udtryk, er den der gaelder. */
function sidsteMigrationMed(udtryk) {
  const traef = migrationsEfterBaseline()
    .map((f) => ({ f, sql: readFileSync(join(migrationsDir, f), 'utf8') }))
    .filter(({ sql }) => udtryk.test(sql));
  return traef.length ? traef[traef.length - 1] : null;
}

test('besked om nye kampe er slaaet til som standard', () => {
  const m = sidsteMigrationMed(/ALTER COLUMN match_watch_enabled SET DEFAULT/i);
  assert.ok(m, 'ingen migration saetter standarden for match_watch_enabled');
  assert.match(
    m.sql,
    /ALTER COLUMN match_watch_enabled SET DEFAULT true/i,
    `${m.f}: standarden skal vaere true - ellers starter hver ny bruger tavs`,
  );
});

test('backfillen rammer kun dem der aldrig har taget stilling', () => {
  const m = sidsteMigrationMed(/UPDATE public\.profiles[\s\S]*match_watch_enabled = true/i);
  assert.ok(m, 'ingen migration slaar det til for de eksisterende brugere');
  assert.match(
    m.sql,
    /WHERE match_watch_at IS NULL/i,
    `${m.f}: uden denne betingelse ville et fravalg blive overskrevet`,
  );
});

test('kamp-discovery naar naboregioner, ikke kun sin egen', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.notify_match_watchers/i);
  assert.ok(m, 'ingen migration definerer notify_match_watchers');
  assert.match(
    m.sql,
    /app_region_neighbours\(v_creator_region\)/,
    `${m.f}: regionen skal udvides med naboerne`,
  );
  assert.doesNotMatch(
    m.sql,
    /canonical_app_region\(p\.area\) = v_creator_region\s*$/m,
    `${m.f}: den gamle praecise regions-sammenligning maa ikke staa tilbage som filter`,
  );
});

test('naermeste modtagere kommer foerst, saa graensen paa 8 ikke spildes', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.notify_match_watchers/i);
  assert.match(
    m.sql,
    /ORDER BY[\s\S]{0,400}canonical_app_region\(p\.area\) = v_creator_region THEN 1 ELSE 0 END\) DESC/,
    `${m.f}: egen region skal sorteres foerst`,
  );
});

test('spam-spaerrerne er uroerte', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.notify_match_watchers/i);
  // Hele pointen med at aabne for flere modtagere staar og falder med, at
  // graenserne bliver staaende. Otte per kamp, fem om dagen per person.
  assert.match(m.sql, /v_max_per_match constant integer := 8/, 'graensen per kamp skal vaere 8');
  assert.match(m.sql, /v_max_per_day constant integer := 5/, 'dagsgraensen skal vaere 5');
  assert.match(m.sql, /interval '7 days'/, '7-dages gentagelsesspaerren skal bestaa');
  assert.match(m.sql, /v_elo_window constant integer := 250/, 'ELO-vinduet skal vaere uaendret');
});

test('naboregionerne haenger sammen begge veje', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.app_region_neighbours/i);
  assert.ok(m, 'ingen migration definerer app_region_neighbours');

  // Naboskab skal vaere gensidigt: er A nabo til B, skal B vaere nabo til A.
  // Ellers ser den ene halvdel af landet den anden uden at blive set igen.
  const kort = {};
  const re = /WHEN '([^']+)'\s*THEN ARRAY\[([^\]]+)\]/g;
  for (const t of m.sql.matchAll(re)) {
    kort[t[1]] = t[2].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  }
  assert.ok(Object.keys(kort).length >= 8, `fandt kun ${Object.keys(kort).length} regioner`);

  for (const [region, naboer] of Object.entries(kort)) {
    assert.ok(naboer.includes(region), `${region} mangler sig selv i sin egen liste`);
    for (const nabo of naboer) {
      if (nabo === region) continue;
      assert.ok(kort[nabo], `${region} peger paa ukendt region ${nabo}`);
      assert.ok(
        kort[nabo].includes(region),
        `${region} ser ${nabo}, men ${nabo} ser ikke ${region} - naboskab skal gaa begge veje`,
      );
    }
  }
});

test('Bornholm staar alene', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.app_region_neighbours/i);
  assert.match(
    m.sql,
    /WHEN 'Bornholm'\s*THEN ARRAY\['Bornholm'\]/,
    'der er ingen nabo man lige tager over til fra Bornholm',
  );
});

test('et fravalg registreres, saa det ikke bliver slaaet til igen', () => {
  // Foer: match_watch_at blev sat til null ved fravalg, saa "har slaaet fra"
  // var umuligt at skelne fra "har aldrig roert den". Med standarden nu slaaet
  // til er det forskellen paa at respektere et nej og at overskrive det.
  for (const fil of [
    'src/lib/matchWatchUtils.js',
    'src/lib/matchSearchFilterCore.js',
    'src/lib/makkerSearchFilterCore.js',
  ]) {
    const src = readFileSync(join(root, fil), 'utf8');
    assert.doesNotMatch(
      src,
      /watch_at: \w+ \? new Date\(\)\.toISOString\(\) : null/,
      `${fil}: tidspunktet maa ikke nulstilles ved fravalg`,
    );
    assert.match(
      src,
      /watch_at: new Date\(\)\.toISOString\(\)/,
      `${fil}: tidspunktet skal saettes, uanset om der vaelges til eller fra`,
    );
  }
});
