import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractFunctions } from '../../scripts/sql-index.mjs';

test('finder navn og krop i en almindelig definition', () => {
  const sql = `
CREATE OR REPLACE FUNCTION public.foo(a int)
RETURNS int LANGUAGE plpgsql AS $$
BEGIN
  RETURN a;
END;
$$;`;
  const fns = extractFunctions(sql);
  assert.equal(fns.length, 1);
  assert.equal(fns[0].name, 'foo');
  assert.match(fns[0].body, /RETURN a;/);
  // Kroppen må ikke indeholde hovedet eller dollar-citaterne.
  assert.ok(!fns[0].body.includes('CREATE'));
  assert.ok(!fns[0].body.includes('$$'));
});

test('håndterer navngivne dollar-citater som $function$', () => {
  const sql = `CREATE FUNCTION bar() RETURNS void LANGUAGE plpgsql AS $function$
BEGIN PERFORM 1; END;
$function$;`;
  const fns = extractFunctions(sql);
  assert.equal(fns.length, 1);
  assert.equal(fns[0].name, 'bar');
  assert.match(fns[0].body, /PERFORM 1;/);
});

test('finder flere funktioner i samme fil og bevarer rækkefølgen', () => {
  const sql = `
CREATE OR REPLACE FUNCTION public.en() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.to() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;`;
  assert.deepEqual(extractFunctions(sql).map((f) => f.name), ['en', 'to']);
});

test('public-præfiks er valgfrit, og navnet gøres til små bogstaver', () => {
  const sql = `CREATE OR REPLACE FUNCTION Baz() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;`;
  assert.equal(extractFunctions(sql)[0].name, 'baz');
});

test('to filer med samme krop men forskellig indrykning giver samme normaliserede form', () => {
  const a = extractFunctions(`CREATE FUNCTION f() RETURNS void AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;`);
  const b = extractFunctions(`CREATE FUNCTION f() RETURNS void AS $$
BEGIN
  RETURN;
END;
$$ LANGUAGE plpgsql;`);
  const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
  assert.equal(norm(a[0].body), norm(b[0].body));
});

test('en ufuldstændig definition springes over i stedet for at kaste', () => {
  assert.deepEqual(extractFunctions('CREATE OR REPLACE FUNCTION public.halv(a int) RETURNS int AS $$ BEGIN'), []);
  assert.deepEqual(extractFunctions(''), []);
  assert.deepEqual(extractFunctions('-- bare en kommentar'), []);
});

// ---- extractTables: hullet i migrationshistorikken ----

test('extractTables skelner mellem oprettede og ændrede tabeller', async () => {
  const { extractTables } = await import('../../scripts/sql-index.mjs');
  const { created, altered } = extractTables(`
CREATE TABLE IF NOT EXISTS public.ny (id uuid);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS x text;
ALTER TABLE public.ny ADD COLUMN y text;
`);
  assert.ok(created.has('ny'));
  assert.ok(!created.has('matches'), 'matches oprettes ikke her');
  assert.ok(altered.has('matches'));
  assert.ok(altered.has('ny'));
});

test('extractTables er ufølsom for public-præfiks, citationstegn og store bogstaver', async () => {
  const { extractTables } = await import('../../scripts/sql-index.mjs');
  const a = extractTables('CREATE TABLE "Profiles" (id uuid);');
  assert.ok(a.created.has('profiles'));
  const b = extractTables('ALTER TABLE ONLY public."matches" ADD COLUMN z text;');
  assert.ok(b.altered.has('matches'));
  const c = extractTables('alter table if exists courts add column w text;');
  assert.ok(c.altered.has('courts'));
});

test('extractTables kaster ikke på tom eller irrelevant SQL', async () => {
  const { extractTables } = await import('../../scripts/sql-index.mjs');
  for (const sql of ['', '-- kommentar', 'SELECT 1;']) {
    const { created, altered } = extractTables(sql);
    assert.equal(created.size, 0);
    assert.equal(altered.size, 0);
  }
});

// ---- Citerede navne: formatet Supabases `db dump` bruger ----
//
// `supabase db dump` citerer ALT: CREATE TABLE IF NOT EXISTS "public"."profiles".
// Den første udgave af parseren forventede public.profiles uden anførselstegn og
// fangede derfor "public" som tabelnavnet — 42 tabeller blev til ét navn, og
// 152 funktioner til nul. Fejlen var tavs: INDEX.md så bare uændret ud.

test('extractTables forstår "public"."navn" med anførselstegn', async () => {
  const { extractTables } = await import('../../scripts/sql-index.mjs');
  const { created, altered } = extractTables(`
CREATE TABLE IF NOT EXISTS "public"."profiles" (
  "id" "uuid" NOT NULL
);
ALTER TABLE ONLY "public"."matches" ADD COLUMN "x" "text";
`);
  assert.ok(created.has('profiles'), 'skal fange profiles, ikke public');
  assert.ok(!created.has('public'), '"public" er skemaet, ikke et tabelnavn');
  assert.ok(altered.has('matches'));
  assert.ok(!altered.has('public'));
});

test('extractFunctions forstår "public"."navn"( med anførselstegn', async () => {
  const { extractFunctions } = await import('../../scripts/sql-index.mjs');
  const fns = extractFunctions(
    'CREATE OR REPLACE FUNCTION "public"."_growth_user_qualified"("p_user_id" "uuid") RETURNS boolean\n' +
    '    LANGUAGE "plpgsql"\n' +
    '    AS $$ BEGIN RETURN true; END; $$;',
  );
  assert.equal(fns.length, 1);
  assert.equal(fns[0].name, '_growth_user_qualified');
  assert.match(fns[0].body, /RETURN true/);
});

test('begge skrivemåder giver samme navn', async () => {
  const { extractTables, extractFunctions } = await import('../../scripts/sql-index.mjs');
  for (const variant of ['public.foo', '"public"."foo"', 'foo', '"foo"']) {
    const { created } = extractTables(`CREATE TABLE ${variant} (id int);`);
    assert.ok(created.has('foo'), `tabel: ${variant}`);
    assert.ok(!created.has('public'), `tabel må ikke blive "public": ${variant}`);
  }
  for (const variant of ['public.bar', '"public"."bar"', 'bar']) {
    const fns = extractFunctions(`CREATE FUNCTION ${variant}() RETURNS void AS $$ BEGIN END; $$;`);
    assert.equal(fns.length, 1, `funktion: ${variant}`);
    assert.equal(fns[0].name, 'bar', `funktion: ${variant}`);
  }
});

/**
 * Afsnittet "I databasen, men i ingen migration" paastod i maaneder at 49
 * funktioner manglede, og at en frisk database ikke kunne bygges. Teksten var
 * hardkodet, saa den blev staaende efter at baseline havde lukket hullet - og
 * den ville have sendt naeste laeser i den forkerte retning.
 *
 * Dommen beregnes nu. Testen holder INDEX.md og virkeligheden sammen begge veje.
 */
test('INDEX.md paastaar ikke et hul som migrations daekker', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
  const snapPath = join(root, 'supabase/sql/live-only-functions.json');
  if (!existsSync(snapPath)) return;

  const names = JSON.parse(readFileSync(snapPath, 'utf8')).functions || [];
  const migrationsDir = join(root, 'supabase/migrations');
  const defineret = new Set();
  for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith('.sql'))) {
    for (const fn of extractFunctions(readFileSync(join(migrationsDir, f), 'utf8'))) {
      defineret.add(fn.name);
    }
  }

  const mangler = names.filter((n) => !defineret.has(n));
  const index = readFileSync(join(root, 'supabase/sql/INDEX.md'), 'utf8');

  if (mangler.length === 0) {
    assert.match(index, /\*\*Hullet er lukket\.\*\*/);
    assert.doesNotMatch(
      index,
      /kan ikke bygges fra historikken/,
      'INDEX.md advarer stadig om et hul der er lukket',
    );
  } else {
    assert.match(
      index,
      new RegExp(`\\*\\*${mangler.length} af ${names.length} funktioner`),
      'INDEX.md naevner ikke det faktiske antal der mangler',
    );
  }
});
