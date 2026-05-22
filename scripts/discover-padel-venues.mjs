/**
 * Grund-søgning: probe MATCHi-slugs og Halbooking proc_baner for padel.
 * Kør: node scripts/discover-padel-venues.mjs
 * Output: scripts/output/padel-venue-discovery.json
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'output', 'padel-venue-discovery.json');

/** @type {{ slug: string, region: string, title: string, indoor?: boolean }[]} */
const MATCHI_CANDIDATES = [
  { slug: 'padel8500', region: 'Østjylland', title: 'Padel8500', indoor: true },
  { slug: 'padelmaster', region: 'Østjylland', title: 'PadelMaster (MATCHi?)' },
  { slug: 'Padelland', region: 'Midtjylland', title: 'Padel Land' },
  { slug: 'ViPadelAarhus', region: 'Midtjylland', title: 'ViPadel Aarhus' },
  { slug: 'padelnord', region: 'Nordjylland', title: 'Padel Nord' },
  { slug: 'padel99', region: 'Nordjylland', title: 'Padel99' },
  { slug: 'SkagenPadelcenter', region: 'Nordjylland', title: 'Skagen Padelcenter' },
  { slug: 'vissenbjergpadel', region: 'Fyn', title: 'Vissenbjerg Padel' },
  { slug: 'breinhotlgardpadel', region: 'Sønderjylland', title: 'Breintholtgård Padel' },
  { slug: 'k7-padel', region: 'Sønderjylland', title: 'K7 Padel Løsning' },
  { slug: 'NrLyndelsePadeltennis', region: 'Fyn', title: 'Nr. Lyndelse Padeltennis', indoor: false },
  { slug: 'padelyard', region: 'Hovedstaden', title: 'Padel Yard Reffen' },
  { slug: 'Padel4alle', region: 'Sjælland', title: 'Padel4alle Køge' },
  { slug: 'padelnorth', region: 'Sjælland', title: 'Padel North Kokkedal' },
  { slug: 'HerningPadel', region: 'Midtjylland', title: 'Herning Padel' },
  { slug: 'herningpadel', region: 'Midtjylland', title: 'Herning Padel alt' },
  { slug: 'RandersPadel', region: 'Østjylland', title: 'Randers Padel' },
  { slug: 'randerspadel', region: 'Østjylland', title: 'Randers Padel alt' },
  { slug: 'HorsensPadel', region: 'Østjylland', title: 'Horsens Padel' },
  { slug: 'horsenspadel', region: 'Østjylland', title: 'Horsens Padel alt' },
  { slug: 'HerningCentret', region: 'Midtjylland', title: 'Herning Centret' },
  { slug: 'padel-aarhus', region: 'Midtjylland', title: 'Padel Aarhus' },
  { slug: 'aarhuspadel', region: 'Midtjylland', title: 'Aarhus Padel' },
  { slug: 'RocketPadelKolding', region: 'Sønderjylland', title: 'Rocket Padel Kolding' },
  { slug: 'MiddelfartPadel', region: 'Fyn', title: 'Middelfart Padel' },
  { slug: 'svendborgpadel', region: 'Fyn', title: 'Svendborg Padel' },
  { slug: 'nyborgpadel', region: 'Fyn', title: 'Nyborg Padel' },
  { slug: 'VejlePadel', region: 'Sønderjylland', title: 'Vejle Padel' },
  { slug: 'HolstebroPadel', region: 'Midtjylland', title: 'Holstebro Padel' },
  { slug: 'ViborgPadel', region: 'Midtjylland', title: 'Viborg Padel' },
  { slug: 'ThistedPadel', region: 'Nordjylland', title: 'Thisted Padel' },
  { slug: 'HjorringPadel', region: 'Nordjylland', title: 'Hjørring Padel' },
  { slug: 'lic-padel', region: 'Nordjylland', title: 'Løkken Padel' },
  // Padellife-oversigt (maj 2026)
  { slug: 'vipadelslagelse', region: 'Sjælland', title: 'VI Padel Slagelse' },
  { slug: 'RacketClubTaastrup', region: 'Sjælland', title: 'Racket Club Taastrup' },
  { slug: 'PadelgroundViborg', region: 'Vestjylland', title: 'Padelground Viborg', indoor: false },
];

/** @type {{ id: string, procBaner: string, region: string, title: string }[]} */
const HALBOOKING_CANDIDATES = [
  { id: 'padelmaster_halbooking', procBaner: 'https://padelmaster.halbooking.dk/newlook/proc_baner.asp', region: 'Østjylland', title: 'PadelMaster' },
  { id: 'xpadel_halbooking', procBaner: 'https://xpadel.halbooking.dk/newlook/proc_baner.asp', region: 'Sjælland', title: 'XPADEL Helsingør' },
  { id: 'padelpit_halbooking', procBaner: 'https://padelpit.halbooking.dk/newlook/proc_baner.asp', region: 'Sjælland', title: 'PADELPIT' },
  { id: 'padel_fun4all', procBaner: 'https://padel-fun4all.halbooking.dk/newlook/proc_baner.asp', region: 'Midtjylland', title: 'Padel Fun4all' },
  { id: 'lic_halbooking', procBaner: 'https://lic.halbooking.dk/newlook/proc_baner.asp', region: 'Nordjylland', title: 'Løkken Idrætscenter' },
  { id: 'oebg_silkeborg', procBaner: 'https://oebgtennis.halbooking.dk/newlook/proc_baner.asp', region: 'Midtjylland', title: 'ØBG Silkeborg' },
  { id: 'egif_halbooking', procBaner: 'https://egif.halbooking.dk/newlook/proc_baner.asp', region: 'Sønderjylland', title: 'EGIF Esbjerg' },
  { id: 'padellounge_herning', procBaner: 'https://padellounge.halbooking.dk/newlook/proc_baner.asp', region: 'Midtjylland', title: 'Padel Lounge (Herning?)' },
  // Padellife-oversigt — Sjælland / Fyn
  { id: 'htpk_hillerod', procBaner: 'https://htpk.halbooking.dk/newlook/proc_baner.asp', region: 'Sjælland', title: 'Hillerød Tennis & Padel (HTPK)' },
  { id: 'match_padel_ballerup', procBaner: 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', region: 'Sjælland', title: 'Match Padel Ballerup' },
  { id: 'match_padel_naestved', procBaner: 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', region: 'Sjælland', title: 'Match Padel Næstved' },
  { id: 'match_padel_nykobing', procBaner: 'https://matchpadel.halbooking.dk/newlook/proc_baner.asp', region: 'Sjælland', title: 'Match Padel Nykøbing F.' },
  { id: 'koge_tennis_halbooking', procBaner: 'https://koge-tennis.halbooking.dk/newlook/proc_baner.asp', region: 'Sjælland', title: 'Køge Tennis og Padel' },
  { id: 'at_tennis_alleroed', procBaner: 'https://at-tennis.halbooking.dk/newlook/proc_baner.asp', region: 'Sjælland', title: 'Allerød Tennis & Padel' },
  { id: 'tisvilde_tennis', procBaner: 'https://tisvildetennis.halbooking.dk/newlook/proc_baner.asp', region: 'Sjælland', title: 'Tisvilde Tennis & Padel' },
];

async function probeMatchi(slug) {
  const url = `https://www.matchi.se/facilities/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PadelMakkerDiscovery/1.0' },
      redirect: 'follow',
    });
    if (!res.ok) return { ok: false, status: res.status, facilityId: null, bookingUrl: url };
    const html = await res.text();
    const m = html.match(/facilityId[=:](\d+)/);
    const hasPadel = /padel/i.test(html) && /Available time slots|Ledige|schedule/i.test(html);
    return {
      ok: true,
      status: res.status,
      facilityId: m ? m[1] : null,
      hasPadel,
      bookingUrl: `https://www.matchi.se/facilities/${slug}`,
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e), facilityId: null };
  }
}

async function probeHalbooking(procBaner) {
  try {
    const res = await fetch(procBaner, { headers: { 'User-Agent': 'PadelMakkerDiscovery/1.0' } });
    const html = await res.text();
    const m = html.match(/<select name="soeg_omraede"[\s\S]*?<\/select>/i);
    if (!m) {
      const hasPadelWord = /padel/i.test(html);
      return { ok: false, hasPadelWord, omraeder: [], note: 'no soeg_omraede select' };
    }
    const omraeder = [];
    for (const o of m[0].matchAll(/<option value='(\d+)'[^>]*>([^<]+)/g)) {
      if (/padel/i.test(o[2]) || omraeder.length === 0) {
        omraeder.push({ omraede: o[1], label: o[2].trim() });
      }
    }
    const padelOmraeder = [...m[0].matchAll(/<option value='(\d+)'[^>]*>([^<]+)/g)]
      .map((o) => ({ omraede: o[1], label: o[2].trim() }))
      .filter((o) => /padel/i.test(o.label) || o.label.length > 2);
    return {
      ok: padelOmraeder.length > 0 || /# Padel/i.test(html),
      omraeder: padelOmraeder.length ? padelOmraeder : omraeder.slice(0, 5),
      hasCalendar: /proc_baner/i.test(procBaner),
    };
  } catch (e) {
    return { ok: false, error: String(e.message || e), omraeder: [] };
  }
}

const matchi = [];
for (const c of MATCHI_CANDIDATES) {
  const r = await probeMatchi(c.slug);
  matchi.push({ ...c, ...r });
  await new Promise((r) => setTimeout(r, 120));
}

const halbooking = [];
for (const c of HALBOOKING_CANDIDATES) {
  const r = await probeHalbooking(c.procBaner);
  halbooking.push({ ...c, ...r });
  await new Promise((r) => setTimeout(r, 150));
}

const report = {
  generatedAt: new Date().toISOString(),
  note: 'Integrér kun poster med ok:true og facilityId/omraede. WannaSport og Padellife har ingen åben API — brug som manuel krydstjek.',
  catalogs: {
    wannasport: 'https://www.wannasport.com/dnk/da',
    padellife:
      'https://padellife.dk/blogs/tips-og-tricks/oversigt-over-padelbaner-i-danmark',
  },
  matchi: matchi.filter((x) => x.ok && x.facilityId),
  matchiFailed: matchi.filter((x) => !x.ok || !x.facilityId),
  halbooking: halbooking.filter((x) => x.ok && x.omraeder?.length),
  halbookingFailed: halbooking.filter((x) => !x.ok || !x.omraeder?.length),
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(report, null, 2), 'utf8');
console.log('Wrote', OUT);
console.log('MATCHi OK:', report.matchi.length, 'Halbooking OK:', report.halbooking.length);
