/**
 * Mail er den eneste kanal, der naar de frafaldne.
 *
 * Maalt i produktionen 22. sep. 2026: 98 oprettede brugere, men kun 12 aktive
 * de sidste 21 dage og 8 den sidste uge. 2 har push slaaet til. For de
 * resterende 96 er mail den ENESTE maade at fortaelle noget paa.
 *
 * To ting stod i vejen:
 *   1. Mail var slaaet FRA som standard, og knappen ligger inde i
 *      klokke-menuen. 1 ud af 98 havde fundet den.
 *   2. Modtageren skulle have aabnet appen inden for 3 uger - et filter lavet
 *      til klokken inde i appen, som mailen arvede. Det udelukkede praecis de
 *      mennesker, en mail er til for.
 *
 * Testene vogter begge dele OG de spaerrer, der goer det forsvarligt: hoejst
 * én mail per person per uge, og hoejst tre ulaeste beskeder ad gangen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeNotificationPrefs } from '../../src/lib/notificationPreferences.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = join(root, 'supabase/migrations');
const BASELINE = '00000000000000_baseline_schema.sql';

const mailFn = readFileSync(join(root, 'supabase/functions/send-discovery-email/index.ts'), 'utf8');

function sidsteMigrationMed(udtryk) {
  const traef = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f !== BASELINE)
    .sort()
    .map((f) => ({ f, sql: readFileSync(join(migrationsDir, f), 'utf8') }))
    .filter(({ sql }) => udtryk.test(sql));
  return traef.length ? traef[traef.length - 1] : null;
}

// --- 1. Mail er slaaet til som standard ---------------------------------

test('en ny bruger har mail slaaet til', () => {
  assert.equal(normalizeNotificationPrefs(null).email.opdagelse, true);
  assert.equal(normalizeNotificationPrefs({}).email.opdagelse, true);
  assert.equal(normalizeNotificationPrefs({ push: { chat: false } }).email.opdagelse, true);
});

test('et fravalg respekteres', () => {
  // Det er hele forskellen paa "har aldrig roert den" og "har sagt nej".
  assert.equal(
    normalizeNotificationPrefs({ email: { opdagelse: false } }).email.opdagelse,
    false,
  );
});

test('standarden i databasen matcher standarden i appen', () => {
  const m = sidsteMigrationMed(/ALTER COLUMN notification_prefs SET DEFAULT/i);
  assert.ok(m, 'ingen migration saetter standarden');
  assert.match(
    m.sql,
    /"email":\s*\{"opdagelse":\s*true\}/,
    `${m.f}: databasen skal ogsaa have mail slaaet til`,
  );
});

test('backfillen rammer kun dem der aldrig har taget stilling', () => {
  const m = sidsteMigrationMed(/UPDATE public\.profiles[\s\S]*'\{email\}'/);
  assert.ok(m, 'ingen migration slaar det til for de eksisterende brugere');
  assert.match(
    m.sql,
    /WHERE NOT \(COALESCE\(notification_prefs, '\{\}'::jsonb\) \? 'email'\)/,
    `${m.f}: en bruger der har slaaet mails FRA, maa ikke faa det slaaet til igen`,
  );
});

test('brugeren faar det at vide ved oprettelse', () => {
  // Slaar vi noget til som standard, skal det staa paa skaermen - ikke gemt i
  // en indstilling, man skal lede efter.
  const src = readFileSync(join(root, 'src/pages/OnboardingPage.jsx'), 'utf8');
  assert.match(src, /Vi sender dig en mail/, 'teksten skal fortaelle, at vi sender mail');
  // Ugen blev til en dag 23. sep. Teksten skal foelge loftet, ikke omvendt:
  // gdprEfterlevelse.test.mjs kraever at de to tal er det samme.
  assert.match(src, /højst én om dagen/, 'og hvor ofte');
  assert.match(src, /afmelde med ét klik/, 'og hvordan man slipper af med den');
});

// --- 2. 3-ugers-filteret er vaek for opdagelse --------------------------

for (const [navn, funktion, type] of [
  ['makker', 'notify_makker_watchers', 'makker_suggestion'],
  ['kamp', 'notify_match_watchers', 'match_watch_match'],
]) {
  test(`${navn}: de frafaldne udelukkes ikke laengere`, () => {
    const m = sidsteMigrationMed(new RegExp(`FUNCTION public\\.${funktion}`));
    assert.ok(m, `ingen migration definerer ${funktion}`);
    assert.doesNotMatch(
      m.sql,
      /v_inactive_days/,
      `${m.f}: aktivitetsfilteret udelukker praecis dem, en mail er til for`,
    );
  });

  test(`${navn}: der hober sig ikke ulaeste beskeder op`, () => {
    // Det, der erstatter tidsfilteret. Har man tre ulaeste liggende, hjaelper
    // en fjerde ikke - saa stopper vi, uanset hvornaar man sidst var inde.
    const m = sidsteMigrationMed(new RegExp(`FUNCTION public\\.${funktion}`));
    assert.match(m.sql, /v_max_unread constant integer := 3;/, `${m.f}: graensen skal vaere 3`);
    assert.match(
      m.sql,
      new RegExp(
        `SELECT count\\(\\*\\) FROM public\\.notifications nu[\\s\\S]{0,200}nu\\.type = '${type}'[\\s\\S]{0,80}nu\\.read = false[\\s\\S]{0,40}\\) < v_max_unread`,
      ),
      `${m.f}: graensen skal taelle ULAESTE beskeder af den rigtige type`,
    );
  });

  test(`${navn}: spam-spaerrerne er uroerte`, () => {
    const m = sidsteMigrationMed(new RegExp(`FUNCTION public\\.${funktion}`));
    assert.match(m.sql, /v_max_per_day constant integer := 5;/, 'dagsgraensen skal vaere 5');
    assert.match(m.sql, /interval '7 days'/, '7-dages gentagelsesspaerren skal bestaa');
    assert.match(m.sql, /SECURITY DEFINER/, 'rettighederne skal bevares');
    assert.match(m.sql, /SET row_security = off/, 'row_security skal vaere off');
  });
}

// --- 3. Hoejst én mail per person per uge -------------------------------

test('mailen reserverer en plads, foer den sender', () => {
  assert.match(mailFn, /claim_email_send_slot/, 'ugespaerren skal bruges');
  const blok = mailFn.slice(mailFn.indexOf('claim_email_send_slot'));
  assert.match(
    blok.slice(0, 400),
    /if \(slotOk !== true\) \{[\s\S]{0,120}continue;/,
    'uden en plads skal modtageren springes over',
  );
});

test('reservationen tages foer afsendelsen, ikke efter', () => {
  // Funktionen kaldes fra browseren og kan koere flere gange samtidig. Blev
  // pladsen foerst taget EFTER afsendelsen, kunne to kald begge naa at sende.
  assert.ok(
    mailFn.indexOf('claim_email_send_slot') < mailFn.indexOf('https://api.resend.com/emails'),
    'reservationen skal ligge foer kaldet til Resend',
  );
});

test('en fejlet mail giver ugen tilbage', () => {
  // Ellers har brugeren brugt sin uge paa en mail, der aldrig kom frem - og
  // faar ingenting i syv dage, uden at nogen opdager det.
  const blok = mailFn.slice(mailFn.indexOf('if (!resendResponse.ok)'));
  assert.match(
    blok.slice(0, 700),
    /release_email_send_slot/,
    'reservationen skal frigives, naar afsendelsen fejler',
  );
});

test('spaerren ligger i databasen, ikke kun i koden', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.claim_email_send_slot/);
  assert.ok(m, 'ingen migration definerer spaerren');
  // Bevidst aendret fra '7 days' 23. sep: af de uger hvor nogen overhovedet
  // fik en besked, havde 2 ud af 3 mere end én, og ugespaerren slugte resten.
  assert.match(
    m.sql,
    /p_min_interval interval DEFAULT interval '1 day'/,
    `${m.f}: standarden skal vaere ét doegn`,
  );
  assert.match(
    m.sql,
    /pg_advisory_xact_lock/,
    `${m.f}: to samtidige kald maa ikke begge faa lov`,
  );
});

test('kun den nyeste reservation kan frigives', () => {
  // Ellers kunne et fejlet kald frigive en aeldre, gyldig reservation og
  // dermed aabne for en ekstra mail.
  const m = sidsteMigrationMed(/FUNCTION public\.release_email_send_slot/);
  assert.ok(m, 'ingen migration definerer frigivelsen');
  assert.match(
    m.sql,
    /sent_at >= now\(\) - interval '1 minute'/,
    `${m.f}: kun reservationen fra dette kald maa frigives`,
  );
});

test('log-tabellen er laast for almindelige brugere', () => {
  const m = sidsteMigrationMed(/CREATE TABLE IF NOT EXISTS public\.email_send_log/);
  assert.ok(m, 'ingen migration opretter log-tabellen');
  assert.match(m.sql, /ENABLE ROW LEVEL SECURITY/, `${m.f}: RLS skal vaere slaaet til`);
  for (const rolle of ['anon', 'authenticated']) {
    assert.match(
      m.sql,
      new RegExp(`REVOKE ALL ON public\\.email_send_log FROM ${rolle};`),
      `${m.f}: rettighederne skal trkkes eksplicit fra ${rolle}`,
    );
  }
});

test('begge spaerre-funktioner kan kun kaldes af serveren', () => {
  for (const [fn, sig] of [
    ['claim_email_send_slot', 'uuid, text, interval'],
    ['release_email_send_slot', 'uuid, text'],
  ]) {
    const m = sidsteMigrationMed(new RegExp(`FUNCTION public\\.${fn}`));
    for (const rolle of ['anon', 'authenticated']) {
      assert.match(
        m.sql,
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\(${sig}\\) FROM ${rolle};`),
        `${m.f}: ${fn} skal vaere lukket for ${rolle}`,
      );
    }
    assert.match(
      m.sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(${sig}\\) TO service_role;`),
      `${m.f}: ${fn} skal kunne kaldes af serveren`,
    );
  }
});

test('frameldingen er stadig et krav for at sende', () => {
  // Fra forrige skridt. Nu hvor mails er slaaet til for 97 brugere, er det
  // vigtigere end nogensinde, at ingen mail gaar ud uden en vej ud.
  assert.match(mailFn, /email_unsub_token_for/, 'token skal hentes per modtager');
  assert.match(
    mailFn,
    /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/,
    'one-click-headeren skal bestaa',
  );
});
