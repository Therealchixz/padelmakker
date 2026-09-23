/**
 * GDPR-efterlevelse, maalt paa koden frem for paa en hensigt.
 *
 * Gennemgang 23. sep. 2026 fandt fire ting, der ikke var meninger:
 *   - Afkrydsningsfeltet "jeg accepterer" var obligatorisk, men svaret blev
 *     aldrig gemt. Art. 7 stk. 1 kraever, at man kan PAAVISE samtykket.
 *   - /opret lovede "hoejst én om ugen". Loftet var dagen foer aendret til
 *     én om dagen. Teksten var altsaa urigtig.
 *   - Begge mails skrev "fordi du har slaaet e-mail til". 97 ud af 98 havde
 *     ikke slaaet noget til - vi slog det til for dem.
 *   - Resend behandler navn og e-mailadresse for hver eneste besked og stod
 *     ikke i privatlivspolitikken.
 *
 * Den sidste test er den vigtigste: den udleder af koden, hvilke fremmede
 * tjenester der faar personoplysninger, og kraever at politikken naevner dem.
 * Den fanger den NAESTE glemte underleverandoer, ikke kun denne.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGAL_INFO } from '../../src/lib/legalInfo.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const onboarding = read('src/pages/OnboardingPage.jsx');
const privacy = read('src/pages/PrivacyPage.jsx');
const discovery = read('supabase/functions/send-discovery-email/index.ts');
const reactivation = read('supabase/functions/send-reactivation/index.ts');

// --- Samtykke kan paavises (art. 7 stk. 1) ------------------------------

test('accepten sendes med fra alle oprettelsesveje', () => {
  // Tre veje skriver metadata: Google uden telefon, Google med telefon, og
  // almindelig e-mail-oprettelse. Glemmes én, mangler beviset for de brugere.
  const antal = onboarding.split('...consentMeta').length - 1;
  assert.equal(antal, 3, `consentMeta spredes ${antal} steder, forventede 3`);
});

test('accepten stemples med tidspunkt, version og hvor', () => {
  assert.match(onboarding, /terms_accepted_at:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(onboarding, /terms_version:\s*LEGAL_INFO\.lastUpdated/);
  assert.match(onboarding, /terms_source:/);
});

test('browseren skriver ikke selv i samtykke-loggen', () => {
  // Kontoen maa ikke kunne rette sin egen historik. Kun SELECT er givet.
  const m = read('supabase/migrations/20260923112121_consent_log_records_signup_acceptance.sql');
  assert.match(m, /ALTER TABLE public\.consent_log ENABLE ROW LEVEL SECURITY/);
  assert.match(m, /REVOKE ALL ON TABLE public\.consent_log FROM authenticated/);
  assert.match(m, /GRANT SELECT ON TABLE public\.consent_log TO authenticated/);
  assert.doesNotMatch(m, /CREATE POLICY[\s\S]*?FOR (INSERT|UPDATE|DELETE)/);
});

test('triggeren lytter ogsaa paa opdatering, ikke kun oprettelse', () => {
  // Google-brugeren findes allerede, naar han krydser af. Kun AFTER INSERT
  // ville miste hver eneste Google-oprettelse.
  const m = read('supabase/migrations/20260923112121_consent_log_records_signup_acceptance.sql');
  assert.match(m, /AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth\.users/);
});

// --- Det vi lover, er det vi goer --------------------------------------

test('frekvensen paa oprettelsessiden svarer til spaerren i databasen', () => {
  const lovet = /højst én om (dagen|ugen)/.exec(onboarding);
  assert.ok(lovet, 'oprettelsessiden naevner ingen frekvens');

  const cap = read('supabase/migrations/20260923103039_discovery_email_cap_one_per_day.sql');
  const faktisk = /p_min_interval interval DEFAULT interval '(\d+) (day|days|week|weeks)'/.exec(cap);
  assert.ok(faktisk, 'fandt ikke standardgraensen i migrationen');

  const ord = faktisk[2].startsWith('day') ? 'dagen' : 'ugen';
  assert.equal(
    lovet[1],
    ord,
    `siden lover "${lovet[1]}", databasen giver "${faktisk[1]} ${faktisk[2]}"`,
  );
  assert.equal(faktisk[1], '1', 'et loft over 1 kan ikke beskrives som "én om dagen"');
});

test('begge mailtyper deler den samme daglige spaerre', () => {
  // Hver sin spaerre ville betyde to mails samme dag, og saa er loeftet paa
  // oprettelsessiden usandt uanset hvad der staar i hver enkelt funktion.
  for (const [navn, kilde] of [['discovery', discovery], ['reactivation', reactivation]]) {
    const m = /claim_email_send_slot[\s\S]{0,160}?p_kind:\s*"([a-z_]+)"/.exec(kilde);
    assert.ok(m, `${navn} tager ingen plads i email_send_log`);
    assert.equal(m[1], 'discovery', `${navn} bruger noeglen "${m[1]}" og deler derfor ikke loftet`);
  }
});

test('en fejlet afsendelse spilder ikke dagens plads', () => {
  for (const [navn, kilde] of [['discovery', discovery], ['reactivation', reactivation]]) {
    assert.match(kilde, /release_email_send_slot/, `${navn} giver ikke pladsen tilbage ved fejl`);
  }
});

// --- Mailens indhold ----------------------------------------------------

test('mailen paastaar ikke, at modtageren selv har slaaet den til', () => {
  // Den var slaaet til som standard for 97 af 98. Saetningen var altsaa
  // forkert for naesten alle, der fik mailen.
  for (const [navn, kilde] of [['discovery', discovery], ['reactivation', reactivation]]) {
    assert.doesNotMatch(
      kilde,
      /har slået e-mail til/,
      `${navn} paastaar stadig, at modtageren selv slog den til`,
    );
  }
});

test('mailen kan afmeldes med ét klik og oplyser afsenderen', () => {
  for (const [navn, kilde] of [['discovery', discovery], ['reactivation', reactivation]]) {
    assert.match(kilde, /"List-Unsubscribe":/, `${navn} mangler List-Unsubscribe`);
    assert.match(kilde, /"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"/, `${navn} mangler ét-klik`);
    assert.match(kilde, /email-unsubscribe/, `${navn} mangler afmeldingslink i kroppen`);
    assert.ok(
      kilde.includes(`CVR ${LEGAL_INFO.cvr}`),
      `${navn} oplyser ikke afsenderens CVR-nummer`,
    );
    assert.match(kilde, /privatlivspolitik/, `${navn} linker ikke til privatlivspolitikken`);
  }
});

// --- Underleverandoerer: udledt af koden, ikke af hukommelsen -----------

/**
 * Fremmede vaerter vi selv kalder, og som derfor ser noget om brugeren.
 * Nøglen er vaerten i koden; vaerdien er det navn politikken skal bruge.
 */
const TREDJEPARTER = {
  'api.resend.com': 'Resend',
  'api.twilio.com': 'Twilio',
  'api.dataforsyningen.dk': 'Dataforsyningen',
  'api.pwnedpasswords.com': 'Have I Been Pwned',
};

/** Vaerter der ikke er databehandlere: vores egne, og links brugeren klikker. */
const IKKE_RELEVANT = /padelmakker\.dk|supabase\.co|localhost/;

test('alle fremmede tjenester vi kalder, staar i privatlivspolitikken', () => {
  const kilder = [];
  for (const dir of readdirSync(join(root, 'supabase/functions'), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    try {
      kilder.push(read(`supabase/functions/${dir.name}/index.ts`));
    } catch {
      /* en mappe uden index.ts er ikke en funktion */
    }
  }
  for (const f of readdirSync(join(root, 'src/lib'))) {
    if (f.endsWith('.js') || f.endsWith('.jsx')) kilder.push(read(`src/lib/${f}`));
  }

  const fundne = new Set();
  for (const kilde of kilder) {
    for (const m of kilde.matchAll(/https:\/\/([a-z0-9.-]+)/gi)) {
      const vaert = m[1].toLowerCase();
      if (IKKE_RELEVANT.test(vaert)) continue;
      if (TREDJEPARTER[vaert]) fundne.add(TREDJEPARTER[vaert]);
    }
  }

  assert.ok(fundne.size >= 3, `fandt kun ${fundne.size} kendte tredjeparter — er listen faldet fra hinanden?`);

  const mangler = [...fundne].filter((navn) => !privacy.includes(navn));
  assert.deepEqual(
    mangler,
    [],
    `disse tjenester faar oplysninger, men staar ikke i privatlivspolitikken: ${mangler.join(', ')}`,
  );
});

test('politikken naevner ogsaa dem vi ikke kalder over https', () => {
  // Supabase, Vercel, Google og Cloudflare kommer ikke frem af en
  // vaerts-soegning, men behandler data for os alligevel.
  for (const navn of ['Supabase', 'Vercel', 'Google', 'Cloudflare']) {
    assert.ok(privacy.includes(navn), `${navn} mangler i privatlivspolitikken`);
  }
});

test('politikkens dato er den version, accepten gemmes under', () => {
  // consent_log gemmer LEGAL_INFO.lastUpdated som policy_version. Aendres
  // politikken uden at datoen foelger med, peger beviset paa den forkerte tekst.
  assert.match(LEGAL_INFO.lastUpdated, /^\d{1,2}\. \p{L}+ \d{4}$/u);
  assert.match(onboarding, /terms_version:\s*LEGAL_INFO\.lastUpdated/);
});
