/**
 * `eslint .` afslutter med kode 0 uanset hvor mange advarsler der er. Repoet
 * naaede 37 - heriblandt fem reelle fejl der havde vaeret live i over en maaned -
 * mens CI var groen hver gang. Vaerktoejet fandt dem; ingen hoerte efter.
 *
 * Spaerren gaelder kun saa laenge nogen ikke bare haever tallet. Testen her
 * goer det til en bevidst handling: haever man loftet, fejler den.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

/** Det aftalte loft. Maa kun saenkes - aldrig haeves for at faa CI groen. */
const LOFT = 4;

test('lint-scriptet fejler paa nye advarsler', () => {
  const lint = pkg.scripts?.lint || '';
  const m = /--max-warnings[= ](\d+)/.exec(lint);
  assert.ok(
    m,
    `npm run lint mangler --max-warnings, saa advarsler igen bliver tavse. Nu: "${lint}"`,
  );
  const n = Number(m[1]);
  assert.ok(
    n <= LOFT,
    `loftet er haevet til ${n}. Det er ${LOFT}. En ny advarsel er enten en fejl der skal `
      + 'rettes, eller fortjener en eslint-disable-next-line med begrundelse - ikke et hoejere tal.',
  );
});

test('AGENTS.md forklarer hvorfor loftet findes', () => {
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /--max-warnings/, 'AGENTS.md naevner ikke spaerren');
  assert.match(
    agents,
    /Haev aldrig tallet|Hæv aldrig tallet/,
    'AGENTS.md advarer ikke mod at haeve tallet',
  );
});
