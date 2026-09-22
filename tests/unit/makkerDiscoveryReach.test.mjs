/**
 * "Find makker": hvem kan se en markering, og hvor laenge staar den?
 *
 * Maalt i produktionen 22. sep. 2026: 14 brugere havde sat fluebenet "jeg
 * soeger makker". Kun 1 var synlig. De 13 andre var udloebet efter 7 dage uden
 * at faa besked - de havde ikke fortrudt, de havde bare ikke fornyet noget,
 * ingen havde fortalt dem skulle fornys.
 *
 * Oveni naaede beskeden om en ny makker 2 mennesker i hele landet, fordi
 *   1) "giv mig besked om nye makkere" var slaaet FRA som standard, og
 *   2) modtageren skulle bo i PRAECIS samme region.
 *
 * Testene her vogter tre ting: at markeringen ikke udloeber, at beskeden er
 * slaaet til som standard, og at naboregionerne taeller med. Udvaelgelsen sker
 * i Postgres og kan ikke koeres her, saa SQL-reglerne kontrolleres i teksten.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isProfileMakkerFeedVisible,
  isProfileMatchFeedVisible,
} from '../../src/lib/seekingFeedTtl.js';
import { seekingTtlRemainingMs } from '../../src/lib/activeSeeking.js';
import {
  seekingVisibilityPhrase,
  seekingVisibilityPhraseOther,
  seekingChannelExpires,
  SEEK_MAKKER_TTL_DAYS,
} from '../../src/lib/platformConstants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = join(root, 'supabase/migrations');
const BASELINE = '00000000000000_baseline_schema.sql';
const DAY = 24 * 60 * 60 * 1000;

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

/** En profil der soeger makker, markeret for n dage siden. */
function makkerSoeger(dageSiden) {
  const since = new Date(Date.now() - dageSiden * DAY).toISOString();
  return {
    area: 'Hovedstaden',
    level: 3,
    seeking_match: true,
    seeking_match_at: since,
    makker_search_prefs: {
      region: 'Hovedstaden',
      feedVisible: true,
      feedVisibleSince: since,
      level: 3,
    },
  };
}

// --- Markeringen udloeber ikke -------------------------------------------

test('en makker-markering fra i gaar er synlig', () => {
  assert.equal(isProfileMakkerFeedVisible(makkerSoeger(1)), true);
});

test('en makker-markering paa 30 dage er STADIG synlig', () => {
  // Det var praecis her de 13 forsvandt: efter dag 7 var de vaek fra listen,
  // mens fluebenet stadig stod som slaaet til paa deres egen profil.
  assert.equal(isProfileMakkerFeedVisible(makkerSoeger(8)), true);
  assert.equal(isProfileMakkerFeedVisible(makkerSoeger(30)), true);
  assert.equal(isProfileMakkerFeedVisible(makkerSoeger(400)), true);
});

test('et fravalg slaar den fra med det samme', () => {
  // Den eneste maade at forsvinde paa er nu at sige det selv.
  const fra = makkerSoeger(1);
  fra.makker_search_prefs = { ...fra.makker_search_prefs, feedVisible: false };
  assert.equal(isProfileMakkerFeedVisible(fra), false);
});

test('uden et tidspunkt er der ingen markering at vise', () => {
  const tom = makkerSoeger(1);
  tom.seeking_match_at = null;
  tom.makker_search_prefs = { ...tom.makker_search_prefs, feedVisibleSince: null };
  assert.equal(isProfileMakkerFeedVisible(tom), false);
});

test('KAMP-kanalen udloeber fortsat efter 24 timer', () => {
  // En konkret kamp i morgen er ikke aktuel i naeste uge. Aendringen maa kun
  // gaelde makker-kanalen.
  const nu = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const gammel = new Date(Date.now() - 2 * DAY).toISOString();
  const kamp = (since) => ({
    area: 'Hovedstaden',
    level: 3,
    seeking_match: true,
    seeking_match_at: since,
    match_search_prefs: { region: 'Hovedstaden', feedVisible: true, feedVisibleSince: since, level: 3 },
  });
  assert.equal(isProfileMatchFeedVisible(kamp(nu)), true);
  assert.equal(isProfileMatchFeedVisible(kamp(gammel)), false);
});

test('der vises ingen nedtaelling paa noget der ikke loeber ud', () => {
  assert.equal(seekingTtlRemainingMs(makkerSoeger(3), 'makker'), null);
  assert.equal(seekingTtlRemainingMs(makkerSoeger(30), 'makker'), null);
});

// --- Teksten lover ikke laengere 7 dage ----------------------------------

test('brugerteksten siger ikke syv dage om makker', () => {
  assert.equal(seekingChannelExpires('makker'), false);
  assert.equal(seekingChannelExpires('kamp'), true);
  assert.equal(seekingVisibilityPhrase('kamp'), 'i 24 timer');
  assert.doesNotMatch(seekingVisibilityPhrase('makker'), /dage|timer/);
  assert.match(seekingVisibilityPhrase('makker'), /slår det fra/);
  // Paa en ANDEN spillers profil peger "du" paa den forkerte person.
  assert.doesNotMatch(seekingVisibilityPhraseOther('makker'), /\bdu\b/);
});

test('ingen skaerm lover en varighed makker-kanalen ikke holder', () => {
  for (const fil of [
    'src/components/ActiveSeekingPanel.jsx',
    'src/components/SeekingFilterShortcutCard.jsx',
    'src/lib/makkerSearchFilterCore.js',
  ]) {
    const src = readFileSync(join(root, fil), 'utf8');
    assert.doesNotMatch(
      src,
      /seekingVisibleDurationLabel/,
      `${fil}: varighed i brugertekst skal gaa gennem seekingVisibilityPhrase`,
    );
  }
});

test('rangeringen bruger stadig hvor frisk en markering er', () => {
  // Det er med vilje: en gammel markering skal SYNKE i listen, ikke forsvinde.
  // Derfor bliver SEEK_MAKKER_TTL_DAYS staaende som friskheds-signal.
  const src = readFileSync(join(root, 'src/lib/matchmakingUtils.js'), 'utf8');
  assert.match(src, /SEEK_MAKKER_TTL_DAYS \* 24/);
  assert.equal(SEEK_MAKKER_TTL_DAYS, 7);
});

test('feed-query’en henter langt nok tilbage', () => {
  // Databasen filtrerer paa seeking_match_at. Var graensen stadig 7 dage,
  // ville de gamle markeringer aldrig komme med i svaret - uanset hvad
  // koden bagefter mener om dem.
  const src = readFileSync(join(root, 'src/lib/seekingFeedTtl.js'), 'utf8');
  assert.match(src, /SEEK_FEED_QUERY_TTL_MS = 365 \* 24 \* 60 \* 60 \* 1000/);
  const home = readFileSync(join(root, 'src/dashboard/HomeTab.jsx'), 'utf8');
  assert.match(home, /SEEK_FEED_QUERY_TTL_MS/);
});

test('"soeger siden ..." forsvinder ikke efter syv dage', () => {
  const src = readFileSync(join(root, 'src/lib/seekingActivityLabel.js'), 'utf8');
  assert.match(
    src,
    /channelSinceIso\(prefs, profile, null\)/,
    'makker-blokken maa ikke skaere tidspunktet fra ved en TTL',
  );
});

// --- Databasen -----------------------------------------------------------

test('makker_feed_is_active har ingen udloebsgraense', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.makker_feed_is_active/i);
  assert.ok(m, 'ingen migration definerer makker_feed_is_active');
  assert.match(
    m.sql,
    /RETURN v_since IS NOT NULL;/,
    `${m.f}: synlighed skal kun afhaenge af, om der ER et tidspunkt`,
  );
  assert.doesNotMatch(
    m.sql,
    /v_since >= now\(\) - interval/,
    `${m.f}: den gamle 7-dages graense maa ikke staa tilbage`,
  );
});

test('besked om nye makkere er slaaet til som standard', () => {
  const m = sidsteMigrationMed(/ALTER COLUMN makker_watch_enabled SET DEFAULT/i);
  assert.ok(m, 'ingen migration saetter standarden for makker_watch_enabled');
  assert.match(
    m.sql,
    /ALTER COLUMN makker_watch_enabled SET DEFAULT true/i,
    `${m.f}: standarden skal vaere true - ellers starter hver ny bruger tavs`,
  );
});

test('backfillen rammer kun dem der aldrig har taget stilling', () => {
  const m = sidsteMigrationMed(/UPDATE public\.profiles[\s\S]*makker_watch_enabled = true/i);
  assert.ok(m, 'ingen migration slaar det til for de eksisterende brugere');
  assert.match(
    m.sql,
    /WHERE makker_watch_at IS NULL/i,
    `${m.f}: uden denne betingelse ville et fravalg blive overskrevet`,
  );
});

test('makker-discovery naar naboregioner, ikke kun sin egen', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.notify_makker_watchers/i);
  assert.ok(m, 'ingen migration definerer notify_makker_watchers');
  assert.match(
    m.sql,
    /v_regions := public\.app_region_neighbours\(v_subject_region\);/,
    `${m.f}: regionen skal udvides med naboerne`,
  );
  // Begge loekker skal bruge den udvidede liste - ikke kun den ene.
  const antal = (m.sql.match(/v_watcher_region = ANY \(v_regions\)/g) || []).length;
  assert.equal(antal, 2, `${m.f}: begge loekker skal bruge nabolisten, fandt ${antal}`);
});

test('udloebsgaten er fjernet ogsaa i notifikationerne', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.notify_makker_watchers/i);
  // Ordet maa gerne staa i kommentaren der forklarer fjernelsen; det er
  // RETURN-gaten der ikke maa vaere der.
  assert.doesNotMatch(
    m.sql,
    /'skipped',\s*'seeking_expired'/,
    `${m.f}: en markering der ikke udloeber, kan ikke afvises som udloebet`,
  );
  assert.doesNotMatch(
    m.sql,
    /v_seek_ttl/,
    `${m.f}: der er ingen TTL at regne paa laengere`,
  );
});

test('naermeste modtagere kommer foerst, saa graensen paa 8 ikke spildes', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.notify_makker_watchers/i);
  assert.match(
    m.sql,
    /ORDER BY[\s\S]{0,400}= v_subject_region THEN 1 ELSE 0 END\) DESC/,
    `${m.f}: egen region skal sorteres foerst`,
  );
});

test('spam-spaerrerne er uroerte', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.notify_makker_watchers/i);
  // Hele pointen med at aabne for flere modtagere staar og falder med, at
  // graenserne bliver staaende.
  assert.match(m.sql, /v_max_per_subject constant integer := 8/, 'graensen per soegning skal vaere 8');
  assert.match(m.sql, /v_max_per_day constant integer := 5/, 'dagsgraensen skal vaere 5');
  assert.match(m.sql, /interval '7 days'/, '7-dages gentagelsesspaerren skal bestaa');
  assert.match(m.sql, /v_inactive_days constant integer := 21/, 'inaktive brugere skal fortsat springes over');
});

test('funktionen beholder sine rettigheder', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.notify_makker_watchers/i);
  // CREATE OR REPLACE beholder grants, men SECURITY DEFINER og search_path
  // skal skrives med hver gang - ellers falder funktionen tilbage til kaldere-
  // rettigheder og kan ikke laese profiles.
  assert.match(m.sql, /SECURITY DEFINER/, `${m.f}: skal vaere SECURITY DEFINER`);
  assert.match(m.sql, /SET search_path = public/, `${m.f}: search_path skal saettes`);
  assert.match(m.sql, /SET row_security = off/, `${m.f}: row_security skal vaere off`);
});
