/**
 * Framelding af mails med ét klik.
 *
 * Hvorfor det her er vigtigere end det lyder: en mail, man ikke kan komme af
 * med, ender med at blive markeret som spam. Faar padelmakker.dk nok
 * spam-markeringer, begynder Gmail og Outlook at sortere ALLE domaenets mails
 * fra - ogsaa "nulstil kodeord" og "bekraeft din konto". Saa kan nye brugere
 * ikke engang oprette sig.
 *
 * Testene vogter fire ting:
 *   1. GET afmelder ALDRIG af sig selv (mailscannere henter links automatisk).
 *   2. Der sendes ikke mail uden et frameldingslink.
 *   3. Headerne, der giver Gmail/Outlook deres egen afmeld-knap, er sat.
 *   4. Token-tabellen kan ikke laeses af almindelige brugere.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = join(root, 'supabase/migrations');
const BASELINE = '00000000000000_baseline_schema.sql';

const unsubFn = readFileSync(join(root, 'supabase/functions/email-unsubscribe/index.ts'), 'utf8');
const mailFn = readFileSync(join(root, 'supabase/functions/send-discovery-email/index.ts'), 'utf8');

function sidsteMigrationMed(udtryk) {
  const traef = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f !== BASELINE)
    .sort()
    .map((f) => ({ f, sql: readFileSync(join(migrationsDir, f), 'utf8') }))
    .filter(({ sql }) => udtryk.test(sql));
  return traef.length ? traef[traef.length - 1] : null;
}

// --- 1. GET maa aldrig afmelde ------------------------------------------

test('GET sender videre til siden paa padelmakker.dk i stedet for at afmelde', () => {
  // Mailscannere, link-previews og "beskyt mod ondsindede links" henter GET
  // automatisk. Afmeldte GET, ville folk blive afmeldt uden at roere linket.
  // Supabase viser ikke HTML fra supabase.co som en side (ejeren 7. okt. 2026:
  // en bruger saa raa kode), saa siden ligger paa vores eget domaene.
  const getBlok = unsubFn.slice(
    unsubFn.indexOf('if (req.method === "GET")'),
    unsubFn.indexOf('if (req.method !== "POST")'),
  );
  assert.ok(getBlok.length > 0, 'GET-grenen skal findes');
  assert.match(getBlok, /status: 303/, 'GET skal sende videre');
  assert.match(getBlok, /Location: afmeldPage\(token\)/, 'GET skal sende videre til /afmeld');
  assert.match(unsubFn, /\$\{siteUrl\(\)\}\/afmeld/, 'siden skal ligge paa vores eget domaene');
  assert.doesNotMatch(
    getBlok,
    /email_unsubscribe_by_token|\.rpc\(/,
    'GET maa ikke kalde afmeldingen',
  );
  assert.doesNotMatch(unsubFn, /text\/html/, 'ingen HTML fra supabase.co - den vises som raa kode');
});

test('siden afmelder foerst, naar man trykker paa knappen (POST)', () => {
  const page = readFileSync(join(root, 'src/pages/EmailUnsubscribePage.jsx'), 'utf8');
  const lib = readFileSync(join(root, 'src/lib/emailUnsubscribe.js'), 'utf8');
  const routes = readFileSync(join(root, 'src/padelmakker-platform.jsx'), 'utf8');
  assert.match(routes, /path="\/afmeld" element=\{<EmailUnsubscribePageLazy \/>\}/, '/afmeld skal findes');
  assert.match(page, /onClick=\{\(\) => \{ void unsubscribe\(\); \}\}/, 'knappen skal afmelde');
  assert.doesNotMatch(page, /useEffect/, 'siden maa ikke afmelde af sig selv ved indlaesning');
  assert.match(lib, /method: 'POST'/, 'afmeldingen skal vaere et POST');
});

test('siden viser rigtigt svar for afmeldt, ukendt link og fejl', async () => {
  const { postEmailUnsubscribe } = await import('../../src/lib/emailUnsubscribe.js');
  const token = '19e09cfa-b7e8-4ce5-ae9e-8928a51477a8';
  const svar = (status, body) => async () => ({ ok: status < 300, status, json: async () => body });
  assert.equal(await postEmailUnsubscribe(token, { url: 'x', fetchImpl: svar(200, { ok: true }) }), 'done');
  assert.equal(await postEmailUnsubscribe(token, { url: 'x', fetchImpl: svar(404, { ok: false, error: 'unknown_token' }) }), 'invalid');
  assert.equal(await postEmailUnsubscribe(token, { url: 'x', fetchImpl: svar(500, { ok: false, error: 'server' }) }), 'error');
  assert.equal(await postEmailUnsubscribe(token, { url: 'x', fetchImpl: async () => { throw new Error('net'); } }), 'error');
  assert.equal(await postEmailUnsubscribe('ikke-et-token', { url: 'x', fetchImpl: svar(200, { ok: true }) }), 'invalid');
});

test('kun POST afmelder', () => {
  const postIdx = unsubFn.indexOf('req.method !== "POST"');
  const rpcIdx = unsubFn.indexOf('email_unsubscribe_by_token');
  assert.ok(postIdx > 0 && rpcIdx > postIdx, 'afmeldingen skal ligge efter POST-tjekket');
});

test('andre metoder afvises', () => {
  assert.match(unsubFn, /status: 405/, 'alt andet end GET/POST skal give 405');
});

// --- 2. Ingen mail uden frameldingslink ---------------------------------

test('en modtager uden token springes over', () => {
  // Hellere ingen mail end en mail, man ikke kan komme af med.
  assert.match(mailFn, /email_unsub_token_for/, 'token skal hentes per modtager');
  const blok = mailFn.slice(mailFn.indexOf('email_unsub_token_for'));
  assert.match(
    blok.slice(0, 600),
    /if \(tokenErr \|\| !unsubToken\) \{[\s\S]{0,300}continue;/,
    'mangler token, skal modtageren springes over',
  );
});

test('den gamle "skriv til os for at blive afmeldt" er vaek', () => {
  assert.doesNotMatch(
    mailFn,
    /unsubMailto/,
    'mailto-afmelding dur ikke - folk trykker spam i stedet',
  );
  assert.doesNotMatch(mailFn, /Afmeld via e-mail/, 'teksten skal ogsaa vaek');
});

test('linket staar baade i tekst- og HTML-udgaven', () => {
  // Mange laeser ren tekst. Er linket kun i HTML, er det vaek for dem.
  assert.match(mailFn, /Afmeld med ét klik: \$\{unsubLink\}/, 'tekstudgaven mangler linket');
  assert.match(mailFn, /escapeHtml\(unsubLink\)/, 'HTML-udgaven mangler linket');
});

// --- 3. Gmail og Outlooks egen afmeld-knap ------------------------------

test('begge one-click-headere er sat', () => {
  // Uden BEGGE viser Gmail/Outlook ikke deres egen afmeld-knap i toppen af
  // mailen - og det er den knap, folk faktisk finder.
  assert.match(mailFn, /"List-Unsubscribe": `<\$\{unsubLink\}>`/, 'List-Unsubscribe mangler');
  assert.match(
    mailFn,
    /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/,
    'List-Unsubscribe-Post mangler',
  );
});

test('funktionen deployes uden login-krav', () => {
  const wf = readFileSync(join(root, '.github/workflows/deploy-supabase-functions.yml'), 'utf8');
  assert.match(
    wf,
    /report-feedback\|email-unsubscribe\)[\s\S]{0,200}--no-verify-jwt/,
    'email-unsubscribe skal deployes med --no-verify-jwt, ellers kraever linket login',
  );
});

// --- 4. Token'et maa ikke kunne laeses af andre -------------------------

test('token-tabellen er laast for almindelige brugere', () => {
  const m = sidsteMigrationMed(/CREATE TABLE IF NOT EXISTS public\.email_unsubscribe_tokens/);
  assert.ok(m, 'ingen migration opretter token-tabellen');
  assert.match(m.sql, /ENABLE ROW LEVEL SECURITY/, `${m.f}: RLS skal vaere slaaet til`);
  // Nye tabeller i public faar ALLE rettigheder til anon og authenticated som
  // standard, og REVOKE FROM PUBLIC fjerner dem IKKE. Begge roller skal naevnes.
  for (const rolle of ['anon', 'authenticated']) {
    assert.match(
      m.sql,
      new RegExp(`REVOKE ALL ON public\\.email_unsubscribe_tokens FROM ${rolle};`),
      `${m.f}: rettighederne skal trkkes eksplicit fra ${rolle}`,
    );
  }
});

test('token ligger ikke paa profiles, hvor alle kan laese det', () => {
  // Find makker viser alle spillere, saa enhver indlogget bruger kan laese
  // alle profilraekker. Et token dér kunne bruges til at afmelde andre.
  const m = sidsteMigrationMed(/CREATE TABLE IF NOT EXISTS public\.email_unsubscribe_tokens/);
  assert.doesNotMatch(
    m.sql,
    /ALTER TABLE public\.profiles[\s\S]{0,120}ADD COLUMN[^;]*token/i,
    `${m.f}: token'et maa ikke ligge paa profiles`,
  );
});

test('afmeldnings-funktionerne kan kun kaldes af serveren', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.email_unsubscribe_by_token/);
  assert.ok(m, 'ingen migration definerer afmeldingen');
  for (const fn of ['email_unsubscribe_by_token', 'email_unsub_token_for']) {
    for (const rolle of ['anon', 'authenticated']) {
      assert.match(
        m.sql,
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\(uuid\\) FROM ${rolle};`),
        `${m.f}: ${fn} skal vaere lukket for ${rolle}`,
      );
    }
    assert.match(
      m.sql,
      new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\(uuid\\) TO service_role;`),
      `${m.f}: ${fn} skal kunne kaldes af serveren`,
    );
  }
});

test('et ukendt token roeber ikke noget', () => {
  const m = sidsteMigrationMed(/FUNCTION public\.email_unsubscribe_by_token/);
  assert.match(m.sql, /'unknown_token'/, 'ukendt token skal give et neutralt svar');
  assert.doesNotMatch(
    m.sql,
    /jsonb_build_object\('ok', false[^)]*v_user/,
    'svaret maa ikke indeholde, hvem token’et hoerer til',
  );
});

test('afmeldingen roerer kun mail, ikke push', () => {
  // Push-indstillingerne er brugerens egne valg inde i appen. En afmelding af
  // MAILS maa ikke slaa notifikationer i appen fra.
  const m = sidsteMigrationMed(/FUNCTION public\.email_unsubscribe_by_token/);
  assert.match(m.sql, /'\{email\}'/, 'kun email-grenen maa aendres');
  assert.doesNotMatch(m.sql, /'\{push[,}]/, 'push maa ikke roeres');
});

test('en fejl bliver ikke til et stille "det gik fint"', () => {
  // Svarer vi 200 paa en fejlet afmelding, holder mailene ikke op - og
  // brugerens naeste skridt er spam-knappen.
  const blok = unsubFn.slice(unsubFn.indexOf('if (error) {'), unsubFn.indexOf('if (!data?.ok)'));
  assert.match(blok, /console\.error\("email-unsubscribe rpc:"/, 'fejlen skal logges');
  assert.match(blok, /\n\s*500,\n/, 'svaret skal vaere 500, ikke 200');
  assert.match(blok, /false,/, 'svaret skal sige, at det mislykkedes');
});
