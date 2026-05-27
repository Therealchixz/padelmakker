/**
 * Audit alle allowlisted Halbooking-venues: find korrekt padel-omraede og banenavne.
 * Kør: node scripts/audit-halbooking-padel.mjs
 */

import { HALBOOKING_VENUE_ALLOWLIST } from '../padelmakker-server/halbookingVenuesAllowlist.js';
import { fetchHalbookingPadelSchedule } from '../padelmakker-server/halbookingFetch.js';

/** @param {string} html */
function extractOmraedeOptions(html) {
  const areas = [];
  const re = /<select[^>]*name=["']soeg_omraede["'][^>]*>([\s\S]*?)<\/select>/gi;
  let m;
  while ((m = re.exec(html))) {
    for (const o of m[1].matchAll(/<option[^>]*value=['"](\d*)['"][^>]*>([^<]+)/gi)) {
      areas.push({ omraede: o[1], label: o[2].trim() });
    }
  }
  const andre = html.match(/<select[^>]*name=["']soeg_anden[^"']*["'][^>]*>([\s\S]*?)<\/select>/i);
  if (andre) {
    for (const o of andre[1].matchAll(/<option[^>]*value=['"](\d*)['"][^>]*>([^<]+)/gi)) {
      areas.push({ omraede: o[1], label: `andre:${o[2].trim()}`, anden: true });
    }
  }
  return areas;
}

function looksLikePadel(courts, htmlSnippet = '') {
  const names = (courts || []).map((c) => c.name).join(' ');
  if (/tennis/i.test(names) && !/padel/i.test(names)) return false;
  if (/padel/i.test(names)) return true;
  if (/# Padel/i.test(htmlSnippet)) return true;
  if ((courts || []).length > 0 && !/Bane T\d/i.test(names) && !/tennis/i.test(names)) return true;
  return false;
}

function pickPadelOmraede(areas) {
  const padel = areas.filter((a) => /padel/i.test(a.label) && !/tennis/i.test(a.label));
  if (padel.length === 1) return { omraede: padel[0].omraede, label: padel[0].label };
  if (padel.length > 1) {
    const indoor = padel.find((a) => /indend/i.test(a.label));
    return { omraede: (indoor || padel[0]).omraede, label: padel.map((p) => p.label).join(' | ') };
  }
  const onlyPadelWord = areas.filter((a) => /^padel$/i.test(a.label.trim()) || a.label === 'Padel');
  if (onlyPadelWord.length) return { omraede: onlyPadelWord[0].omraede, label: onlyPadelWord[0].label };
  return null;
}

const report = [];

for (const [id, cfg] of Object.entries(HALBOOKING_VENUE_ALLOWLIST)) {
  const proc = cfg.procBaner;
  let firstHtml = '';
  try {
    const res = await fetch(proc, { headers: { 'User-Agent': 'PadelMakkerAudit/1.0' } });
    firstHtml = await res.text();
  } catch (e) {
    report.push({ id, status: 'fetch_fail', error: String(e.message) });
    continue;
  }

  const areas = extractOmraedeOptions(firstHtml);
  const padelPick = pickPadelOmraede(areas);
  const current = cfg.omraede;

  let currentResult = await fetchHalbookingPadelSchedule(proc, current);
  const currentOk = looksLikePadel(currentResult.courts);

  let suggested = current;
  let suggestedResult = currentResult;
  if (!currentOk && padelPick) {
    suggested = padelPick.omraede;
    suggestedResult = await fetchHalbookingPadelSchedule(proc, suggested);
  } else if (!currentOk) {
    for (const a of areas) {
      if (/tennis/i.test(a.label) && !/padel/i.test(a.label)) continue;
      const trial = await fetchHalbookingPadelSchedule(proc, a.omraede);
      if (looksLikePadel(trial.courts)) {
        suggested = a.omraede;
        suggestedResult = trial;
        break;
      }
    }
  }

  const suggestedOk = looksLikePadel(suggestedResult.courts);
  report.push({
    id,
    currentOmraede: current,
    suggestedOmraede: suggestedOk && suggested !== current ? suggested : null,
    padelAreas: areas.filter((a) => /padel/i.test(a.label)),
    allAreas: areas.map((a) => `${a.omraede}:${a.label}`).join('; '),
    currentCourts: currentResult.courts?.map((c) => c.name).slice(0, 4),
    suggestedCourts: suggestedOk ? suggestedResult.courts?.map((c) => c.name).slice(0, 4) : null,
    currentOk,
    suggestedOk,
    needsFix: !currentOk || (suggestedOk && suggested !== current),
  });
  await new Promise((r) => setTimeout(r, 300));
}

console.log(JSON.stringify(report, null, 2));
const fixes = report.filter((r) => r.needsFix);
console.error('\nNeeds fix:', fixes.length);
for (const f of fixes) {
  console.error(
    f.id,
    'current',
    f.currentOmraede,
    f.currentOk ? 'ok' : 'BAD',
    '->',
    f.suggestedOmraede ?? '?',
    f.suggestedCourts || f.currentCourts
  );
}
