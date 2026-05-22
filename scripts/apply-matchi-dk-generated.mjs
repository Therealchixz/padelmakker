import { readFileSync, writeFileSync } from 'node:fs';

const gen = readFileSync('scripts/output/matchi-dk-generated.txt', 'utf8');
const allowPart = gen.split('// BANER')[0].replace(/^\/\/ ALLOWLIST[^\n]*\n/, '').trimEnd();
const banerPart = gen.split('// BANER\n')[1].trimEnd();

function apply(path, check, from, to) {
  const before = readFileSync(path, 'utf8');
  if (before.includes(check)) {
    console.log(path, 'already ok');
    return;
  }
  if (!before.includes(from)) {
    console.error(path, 'anchor missing');
    process.exit(1);
  }
  const after = before.replace(from, to);
  if (after === before) {
    console.error(path, 'replace unchanged');
    process.exit(1);
  }
  writeFileSync(path, after);
  console.log('Patched', path);
}

const firstId = allowPart.match(/^\s+(matchi_\w+):/m)?.[1] || 'matchi_apn';

apply(
  'padelmakker-server/matchiAllowlist.js',
  `${firstId}:`,
  '\r\n};\r\n\r\nconst MATCHI_ORIGIN',
  `\r\n${allowPart.replace(/\n/g, '\r\n')}\r\n};\r\n\r\nconst MATCHI_ORIGIN`
);

apply(
  'src/lib/banerVenues.js',
  `id: '${firstId}'`,
  '\r\n];\r\n\r\nconst BANER_VENUES_LINKS_DEDUPED',
  `\r\n${banerPart.replace(/\n/g, '\r\n')}\r\n];\r\n\r\nconst BANER_VENUES_LINKS_DEDUPED`
);

const indoorLines = [...banerPart.matchAll(/id: '(matchi_[^']+)'[\s\S]*?indoor: (true|false)/g)].map(
  (m) => `  ${m[1]}: ${m[2]},`
);
if (indoorLines.length) {
  apply(
    'src/lib/banerVenueIndoorVerified.js',
    `${firstId}:`,
    '  matchi_padelaarup: true,\r\n};',
    `  matchi_padelaarup: true,\r\n${indoorLines.join('\r\n')}\r\n};`
  );
}
