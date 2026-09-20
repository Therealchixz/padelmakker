#!/usr/bin/env node
/**
 * Gør supabase/sql/ opslagsbar igen.
 *
 * Problemet: mappen indeholder 160 løse filer, og 56 funktioner er defineret i
 * flere af dem (én i syv). Åbner man mappen for at finde ud af hvad databasen
 * gør, får man flere forskellige svar uden at vide hvilket der gælder.
 *
 * Sandheden er supabase/migrations/: det er den rækkefølge `supabase db push`
 * kører, så den SIDSTE migration der definerer en funktion, er den der kører i
 * produktion. Dette script bruger den kendsgerning til at udpege, hvilken fil i
 * supabase/sql/ (hvis nogen) der svarer til virkeligheden.
 *
 * Sammenligningen er på funktionens KROP, normaliseret (små bogstaver, al
 * whitespace fjernet) — samme normalisering som
 * `md5(lower(regexp_replace(prosrc, '\s+', '', 'g')))` i Postgres, så
 * resultatet kan verificeres direkte mod den kørende database.
 *
 *   node scripts/sql-index.mjs           # skriv supabase/sql/INDEX.md
 *   node scripts/sql-index.mjs --check   # fejl hvis INDEX.md er forældet
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SQL_DIR = join(ROOT, 'supabase/sql');
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const INDEX_PATH = join(SQL_DIR, 'INDEX.md');
const LIVE_ONLY_PATH = join(SQL_DIR, 'live-only-functions.json');

/** Normaliser som Postgres' prosrc-sammenligning: små bogstaver, ingen whitespace. */
function fingerprint(body) {
  return createHash('md5').update(body.toLowerCase().replace(/\s+/g, '')).digest('hex');
}

/**
 * Træk (navn, krop) ud for hver CREATE [OR REPLACE] FUNCTION i en SQL-tekst.
 * Kroppen er teksten mellem dollar-citaterne ($$ eller $function$ osv.).
 */
export function extractFunctions(sql) {
  const out = [];
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const name = m[1].toLowerCase();
    // Første dollar-citat efter hovedet åbner kroppen.
    const openRe = /\$([a-z0-9_]*)\$/gi;
    openRe.lastIndex = re.lastIndex;
    const open = openRe.exec(sql);
    if (!open) continue;
    const tag = `$${open[1]}$`;
    const bodyStart = open.index + tag.length;
    const bodyEnd = sql.indexOf(tag, bodyStart);
    if (bodyEnd === -1) continue;
    out.push({ name, body: sql.slice(bodyStart, bodyEnd) });
  }
  return out;
}

function listSql(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
}

export function buildIndex() {
  // 1) Produktionssandheden: sidste migration der definerer en funktion vinder.
  const liveByName = new Map();
  for (const file of listSql(MIGRATIONS_DIR)) {
    for (const fn of extractFunctions(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))) {
      liveByName.set(fn.name, { file, fingerprint: fingerprint(fn.body) });
    }
  }

  // 2) Hvad hver fil i supabase/sql/ påstår.
  const claimsByName = new Map();
  for (const file of listSql(SQL_DIR)) {
    for (const fn of extractFunctions(readFileSync(join(SQL_DIR, file), 'utf8'))) {
      if (!claimsByName.has(fn.name)) claimsByName.set(fn.name, []);
      claimsByName.get(fn.name).push({ file, fingerprint: fingerprint(fn.body) });
    }
  }

  // 3) Match påstandene mod sandheden.
  const rows = [];
  for (const name of [...new Set([...liveByName.keys(), ...claimsByName.keys()])].sort()) {
    const live = liveByName.get(name) || null;
    const claims = claimsByName.get(name) || [];
    const matching = live ? claims.filter((c) => c.fingerprint === live.fingerprint) : [];
    const stale = live ? claims.filter((c) => c.fingerprint !== live.fingerprint) : claims;
    rows.push({ name, live, claims, matching, stale });
  }

  const inMigrations = rows.filter((r) => r.live);
  const orphans = rows.filter((r) => !r.live && r.claims.length);
  const matched = inMigrations.filter((r) => r.matching.length);
  const noMatch = inMigrations.filter((r) => r.claims.length && !r.matching.length);
  const notInSql = inMigrations.filter((r) => !r.claims.length);

  const lines = [];
  lines.push('# Hvilken fil gælder? — genereret oversigt');
  lines.push('');
  lines.push('**Rediger ikke denne fil i hånden.** Kør `npm run db:sql-index`.');
  lines.push('');
  lines.push('`supabase/migrations/` er det der kører i produktion — det er rækkefølgen');
  lines.push('`supabase db push` udfører. `supabase/sql/` er et arkiv af løse scripts, hvor');
  lines.push('samme funktion kan optræde i flere filer i flere generationer.');
  lines.push('');
  lines.push('Tabellen nedenfor siger, for hver funktion, hvilken migration der gælder, og');
  lines.push('hvilken arkivfil (hvis nogen) der er identisk med den. Sammenligningen er på');
  lines.push('funktionens krop, normaliseret på samme måde som Postgres gemmer den, så den');
  lines.push('kan efterprøves direkte mod den kørende database.');
  lines.push('');
  lines.push('## Tal');
  lines.push('');
  lines.push(`| | Antal |`);
  lines.push(`|---|---|`);
  lines.push(`| Funktioner i migrations (= i drift) | ${inMigrations.length} |`);
  lines.push(`| ...med en identisk fil i \`supabase/sql/\` | ${matched.length} |`);
  lines.push(`| ...hvor ingen arkivfil matcher (alle er forældede) | ${noMatch.length} |`);
  lines.push(`| ...som slet ikke findes i arkivet | ${notInSql.length} |`);
  lines.push(`| Funktioner kun i arkivet (aldrig deployet herfra) | ${orphans.length} |`);
  lines.push('');
  lines.push('## Funktioner i drift');
  lines.push('');
  lines.push('| Funktion | Gældende migration | Identisk arkivfil | Forældede kopier |');
  lines.push('|---|---|---|---|');
  for (const r of inMigrations) {
    const match = r.matching.length ? r.matching.map((c) => `\`${c.file}\``).join('<br>') : '—';
    const staleTxt = r.stale.length ? `${r.stale.length}` : '—';
    lines.push(`| \`${r.name}\` | \`${r.live.file}\` | ${match} | ${staleTxt} |`);
  }
  if (orphans.length) {
    lines.push('');
    lines.push('## Kun i arkivet');
    lines.push('');
    lines.push('Disse defineres i `supabase/sql/` men af ingen migration. Enten historiske,');
    lines.push('eller kørt manuelt uden migrationsfil — i så fald er de ikke dækket af deploy.');
    lines.push('');
    lines.push('| Funktion | Filer |');
    lines.push('|---|---|');
    for (const r of orphans) {
      lines.push(`| \`${r.name}\` | ${r.claims.map((c) => `\`${c.file}\``).join('<br>')} |`);
    }
  }

  // Oejebliksbillede: funktioner der koerer i produktion uden nogen migration.
  if (existsSync(LIVE_ONLY_PATH)) {
    const snap = JSON.parse(readFileSync(LIVE_ONLY_PATH, 'utf8'));
    const names = snap.functions || [];
    lines.push('');
    lines.push('## I databasen, men i ingen migration');
    lines.push('');
    lines.push(`Oejebliksbillede fra **${snap.snapshot_dato}** (projekt \`${snap.projekt}\`).`);
    lines.push('Ikke auto-genereret — se `live-only-functions.json` for hvordan det opdateres.');
    lines.push('');
    lines.push(`**${names.length} funktioner koerer i produktion, som ingen migration opretter.**`);
    lines.push('En database bygget fra `supabase/migrations/` alene ville mangle dem, saa et');
    lines.push('nyt miljoe (staging, gendannelse efter nedbrud) kan ikke bygges fra historikken');
    lines.push('som den er nu.');
    lines.push('');
    lines.push('| Funktion | Findes i arkivet? |');
    lines.push('|---|---|');
    for (const n of names) {
      const claims = claimsByName.get(n) || [];
      lines.push(`| \`${n}\` | ${claims.length ? claims.map((c) => `\`${c.file}\``).join('<br>') : '**nej**'} |`);
    }
  }

  lines.push('');
  const output = lines.join('\n') + '\n';

  if (process.argv.includes('--check')) {
    const current = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '';
    if (current !== output) {
      console.error('INDEX.md er forældet. Kør: npm run db:sql-index');
      process.exit(1);
    }
    console.log('INDEX.md er opdateret.');
  } else {
    writeFileSync(INDEX_PATH, output);
    console.log(`Skrev ${basename(INDEX_PATH)}`);
    console.log(`  i drift: ${inMigrations.length}  |  match i arkiv: ${matched.length}  |  intet match: ${noMatch.length}  |  ikke i arkiv: ${notInSql.length}  |  kun i arkiv: ${orphans.length}`);
  }
}

// Kun naar scriptet koeres direkte — import maa ikke skrive filer.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  buildIndex();
}
