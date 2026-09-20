import test from 'node:test';
import assert from 'node:assert/strict';

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
