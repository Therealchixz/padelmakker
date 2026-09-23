/**
 * Den ugentlige "kom tilbage"-paamindelse.
 *
 * Den har koert hver dag kl. 07 i maanedsvis, lykkedes hver gang, og naaet
 * NUL mennesker. To uafhaengige grunde, maalt i produktionen 23. sep. 2026:
 *
 *   1. Den kraevede en push-abonnering. 32 brugere opfyldte alt andet. Ingen
 *      af dem havde push - det kraever appen installeret som PWA, og det har
 *      2 ud af 98 gjort.
 *   2. Den taeller kun AABNE KAMPE, og der er nul - ikke bare denne uge, men
 *      fremadrettet. Imens soegte 17 spillere en makker.
 *
 * Efter aendringen: 19 brugere er klar til en paamindelse, alle via mail.
 *
 * Testene vogter begge dele, og at mailen ikke gaar ud uden en vej ud igen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = join(root, 'supabase/migrations');
const BASELINE = '00000000000000_baseline_schema.sql';
const fn = readFileSync(join(root, 'supabase/functions/send-reactivation/index.ts'), 'utf8');

function sidsteMigrationMed(udtryk) {
  const traef = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f !== BASELINE)
    .sort()
    .map((f) => ({ f, sql: readFileSync(join(migrationsDir, f), 'utf8') }))
    .filter(({ sql }) => udtryk.test(sql));
  return traef.length ? traef[traef.length - 1] : null;
}

const nudgeMig = () => {
  const m = sidsteMigrationMed(/FUNCTION public\.get_due_reactivation_nudges/);
  assert.ok(m, 'ingen migration definerer get_due_reactivation_nudges');
  return m;
};

// --- 1. Push maa ikke laengere vaere et krav ----------------------------

test('push er ikke laengere et krav for at blive paamindet', () => {
  const m = nudgeMig();
  assert.match(
    m.sql,
    /exists \(select 1 from public\.push_subscriptions ps where ps\.user_id = p\.id\)\s*\n\s*or coalesce\(\(p\.notification_prefs->'email'->>'opdagelse'\)::boolean, false\) = true/,
    `${m.f}: der skal kunne naas via push ELLER mail`,
  );
});

test('kravet staar som et ELLER, ikke som to krav', () => {
  // Det oprindelige var et rent AND-krav paa push. Blev det staaende ved
  // siden af mail-kravet, ville listen vaere lige saa tom som foer.
  const m = nudgeMig();
  const kandidatblok = m.sql.slice(m.sql.indexOf('candidates as ('), m.sql.indexOf('counted as ('));
  const pushKrav = (kandidatblok.match(/and exists \(select 1 from public\.push_subscriptions/g) || []).length;
  assert.equal(pushKrav, 0, `${m.f}: der maa ikke staa et selvstaendigt AND-krav om push`);
});

test('has_push returneres, saa afsenderen kan vaelge kanal', () => {
  const m = nudgeMig();
  assert.match(m.sql, /has_push boolean/, `${m.f}: kolonnen skal vaere i returtypen`);
});

// --- 2. Paamindelsen skal have noget at sige ---------------------------

test('makker-soegende taeller med, ikke kun aabne kampe', () => {
  const m = nudgeMig();
  assert.match(m.sql, /seeking_count integer/, `${m.f}: antallet skal returneres`);
  assert.match(
    m.sql,
    /makker_feed_is_active\(sp\.makker_search_prefs, sp\.seeking_at|makker_feed_is_active\(sp\.makker_search_prefs, sp\.seeking_match_at\)/,
    `${m.f}: soegende findes via makker_feed_is_active`,
  );
});

test('graensen gaelder summen, ikke kun kampene', () => {
  // Var den stadig "mindst 2 AABNE KAMPE", ville 17 makker-soegende ikke
  // hjaelpe det mindste.
  const m = nudgeMig();
  assert.match(
    m.sql,
    /\(t\.open_count \+ t\.seeking_count\) >= 2/,
    `${m.f}: begge slags skal taelle med i graensen`,
  );
});

test('soegende findes inden for samme afstand som kampene', () => {
  const m = nudgeMig();
  const seekerBlok = m.sql.slice(m.sql.indexOf('from seekers s'));
  assert.match(seekerBlok.slice(0, 500), /haversine_km\([^)]*\) <= 60/, `${m.f}: 60 km, som for kampe`);
});

test('teksten naevner makkere, naar det er dem der er', () => {
  assert.match(fn, /søger makker nær/, 'overskriften skal kunne handle om makkere');
  assert.match(fn, /spillere leder/, 'og teksten skal kunne det samme');
  // Og den gamle kampe-tekst skal stadig findes til naar der ER kampe.
  assert.match(fn, /Åbne kampe nær/, 'kampe-teksten skal bevares');
});

test('man bliver ikke paamindet om sig selv', () => {
  const m = nudgeMig();
  assert.match(m.sql, /where s\.id <> c\.user_id/, `${m.f}: sig selv skal trkkes fra`);
  assert.match(m.sql, /where om\.creator_id <> c\.user_id/, `${m.f}: ogsaa for kampe`);
});

// --- 3. Mailen skal kunne frameldes ------------------------------------

test('der sendes ikke mail uden et frameldingslink', () => {
  assert.match(fn, /email_unsub_token_for/, 'token skal hentes');
  const blok = fn.slice(fn.indexOf('email_unsub_token_for'));
  assert.match(
    blok.slice(0, 500),
    /if \(tokenErr \|\| !unsubToken\) \{[\s\S]{0,300}return "skipped"/,
    'mangler token, sendes der ikke',
  );
});

test('Gmail og Outlook faar deres egen afmeld-knap', () => {
  assert.match(fn, /"List-Unsubscribe": `<\$\{unsubLink\}>`/, 'List-Unsubscribe mangler');
  assert.match(
    fn,
    /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/,
    'List-Unsubscribe-Post mangler',
  );
});

test('linket staar baade i tekst- og HTML-udgaven', () => {
  assert.match(fn, /Afmeld med ét klik: \$\{unsubLink\}/, 'tekstudgaven mangler linket');
  assert.match(fn, /esc\(unsubLink\)/, 'HTML-udgaven mangler linket');
});

test('samtykket respekteres', () => {
  // Frameldingen saetter email.opdagelse = false. Laeser paamindelsen ikke
  // det flag, ville en afmelding ikke stoppe den.
  assert.match(
    fn,
    /emailPrefs\?\.opdagelse !== true\) continue;/,
    'uden samtykke sendes der ikke mail',
  );
});

// --- 4. Kanalvalg og optaelling ----------------------------------------

test('mail bruges kun naar der ikke er push', () => {
  // Ellers ville folk med push faa bade en notifikation og en mail om det samme.
  const blok = fn.slice(fn.indexOf('if (!subs || subs.length === 0)'));
  assert.match(blok.slice(0, 500), /sendReactivationEmail\(/, 'mail hoerer til gren uden push');
});

test('svaret viser, hvor mange mails der gik ud', () => {
  // Uden et tal i svaret er en tavs nul-afsendelse umulig at opdage - og det
  // var praecis den fejl, der holdt denne funktion doed i maanedsvis.
  assert.match(fn, /let mailed = 0;/, 'der skal taelles');
  assert.match(fn, /notified, pushed, mailed/, 'og tallet skal med i svaret');
});

test('en fejlet mail bliver ikke talt som sendt', () => {
  assert.match(fn, /if \(outcome === "sent"\) mailed\+\+;/, 'kun en faktisk sendt mail taeller');
  assert.match(fn, /console\.error\("send-reactivation resend:"/, 'og fejlen skal logges');
});
