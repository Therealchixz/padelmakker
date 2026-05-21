export const LEVELS = [
  'Begynder (1.0–1.9)',
  'Let øvet (2.0–2.9)',
  'Øvet (3.0)',
  'Avanceret øvet (3.5)',
  'Meget øvet (4.0–4.9)',
  'Elite (5.0–7.0)',
];

/**
 * Korte band-tekster (fallback). Detaljer pr. 0,5-trin: LEVEL_FINE_DESCS.
 * Niveau-skala inspireret af almindelig padel/Playtomic 1–7 (tekster er PadelMakkers egne).
 */
export const LEVEL_DESCS = {
  'Begynder (1.0–1.9)':
    'Helt ny eller få gange på banen. Fokus på regler, grundslag og at få bolden i spil.',
  'Let øvet (2.0–2.9)':
    'Kan holde banespil i roligt tempo, bruger væggene mere og forstår enkle positioner.',
  'Øvet (3.0)':
    'Jævnlig spiller med solid grundteknik. Længere dueller, men stadig mange uprovokerede fejl.',
  'Avanceret øvet (3.5)':
    'Ugentlig spil med bedre boldvalg, taktik og kontrol i tempo. Klar til stærkere klubkampe.',
  'Meget øvet (4.0–4.9)':
    'Stærk teknik og taktik i højt tempo. Svært at finde svage sider i almindelige klubkampe.',
  'Elite (5.0–7.0)':
    'Turnerings- eller professionelt niveau med konstant høj intensitet og få fejl.',
};

/** Finere trin på slideren (0,5) — opdateres live når brugeren trækker. */
export const LEVEL_FINE_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7];

export const LEVEL_FINE_DESCS = {
  1: 'Du er helt ny i padel eller har kun prøvet det et par gange. Du lærer stadig regler, scoring og grundslag (serve, return, enkle volleys). Boldkontrol og placering på banen er ustabil, og du har svært ved hurtige bolde og vægge. Fair match: andre begyndere i roligt tempo.',
  1.5: 'Du har spillet lidt og kender reglerne, men teknikken er ikke automatiseret endnu. Du kan returnere langsomme bolde og begynder at bruge glasvæggene, men dueller er korte og fejl kommer ofte under pres. Fair match: spillere omkring 1,0–2,0 der vil øve uden højt pres.',
  2: 'Du spiller med begyndende kontrol og kan deltage i hyggelige kampe i lavt tempo. Du rammer de fleste grundslag i ro, men har begrænset taktik og positionering. Serve og netspil er uforudsigelige under pres. Fair match: 1,5–2,5 — gerne hygge eller let træning.',
  2.5: 'Du har udviklet mere stabilt banespil og forstår hvornår du skal stå højt eller dybt. Du kan holde længere dueller i moderat tempo og bruger væggene bevidst. Stadig taktiske huller og fejl når tempoet stiger. Fair match: 2,0–3,0 i klubkampe eller sociale turneringer.',
  3: 'Du spiller jævnligt med god sikkerhed i grundslagene og kan styre retning i normalt tempo. Du forstår double-positioner og simple taktikker (lob, drop, angreb på net). Du laver stadig mange uprovokerede fejl og kan blive for offensiv. Fair match: DPF 25/50-niveau eller stærk 3. division — typisk 2,5–3,5.',
  3.5: 'Du spiller ugentligt med færre fejl, bedre boldkontrol og længere dueller. Du varierer tempo, bruger væggene taktisk og har styr på netspil i de fleste situationer. Du kan stadig miste fokus mod stærkere pres. Fair match: DPF 50/100 eller 2./3. division — typisk 3,0–4,0.',
  4: 'Du mestrer de fleste slag med retningskontrol og kan spille fladt, med slice og i højere tempo. Du forstår kampens rytme, teamwork og hvornår du skal angribe eller forsvare. Du har svært ved at lukke point mod meget stærke modstandere. Fair match: erfarne klubspillere og regionale turneringer — typisk 3,5–4,5.',
  4.5: 'Du har stærk teknik og taktik, god fysik og få lette fejl i normale kampe. Du spiller bandeja/vibora-lignende slag med rimelig sikkerhed og læser modstanderens spil. Du kan stadig blive presset af top-amatører. Fair match: stærke divisionshold og DPF200-klasser — typisk 4,0–5,0.',
  5: 'Du har høj teknisk og taktisk standard, spiller hurtigt og konsekvent med få uprovokerede fejl. Du dominerer net og vægge i de fleste kampe og tænker flere slag frem. Fair match: landsholds- eller elite-amatørniveau i turneringer — typisk 4,5–5,5.',
  5.5: 'Du er blandt de stærkeste amatører i regionen med turneringserfaring og høj intensitet hele kampen. Du har avancerede slag, mental styrke og fysisk kapacitet til lange kampe. Fair match: nationale turneringer og top divisionsniveau — typisk 5,0–6,0.',
  6: 'Du spiller på meget højt amatør- eller semi-professionelt niveau med dyb taktisk forståelse, kraft og præcision. Du forsvares solidt på vægge og afslutter point ved nettet. Fair match: elite turneringer og erfarne pro-træningsgrupper — typisk 5,5–6,5.',
  6.5: 'Du er tæt på professionelt niveau med konstant høj kvalitet under pres, få svage sider og stærk turneringserfaring. Fair match: nationale/elite turneringer og WPT-niveau træningskampe — typisk 6,0–7,0.',
  7: 'Professionelt niveau (landshold, WPT eller tilsvarende). Du konkurrerer for resultater på højeste plan med fuld fysisk og mental kapacitet. Fair match: kun andre professionelle eller top 50 WPT.',
};

export function nearestFineLevelStep(num) {
  const x = Number(num);
  if (!Number.isFinite(x)) return 3;
  let best = LEVEL_FINE_STEPS[0];
  let bestDist = Infinity;
  for (const step of LEVEL_FINE_STEPS) {
    const d = Math.abs(x - step);
    if (d < bestDist) {
      bestDist = d;
      best = step;
    }
  }
  return best;
}

/** Konvertér gemt tal (fx 1.0, 3.5) til kort visningsnavn */
export function levelLabel(num) {
  if (!num) return null;
  const n = Number(num);
  if (n < 2) return 'Begynder';
  if (n < 3) return 'Let øvet';
  if (n < 3.25) return 'Øvet (3.0)';
  if (n < 4) return 'Avanceret øvet (3.5)';
  if (n < 5) return 'Meget øvet';
  return 'Elite';
}

/** Interval for hvornår et preset anses som valgt (fx 3.3 → Avanceret øvet). */
export function levelPresetBand(levelString) {
  const matches = String(levelString || '').match(/[\d.]+/g);
  if (!matches?.length) return { min: 1, max: 7 };
  const nums = matches.map((m) => parseFloat(m));
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  const c = nums[0];
  return { min: Math.max(1, c - 0.25), max: Math.min(7, c + 0.24) };
}

export function levelMatchesPreset(level, levelString) {
  const n = Number(level);
  if (!Number.isFinite(n)) return false;
  const { min, max } = levelPresetBand(levelString);
  return n >= min && n <= max;
}

/** Standardværdi når bruger vælger et niveau-preset (midtpunkt i intervallet). */
export function defaultLevelForPreset(levelString) {
  const matches = String(levelString || '').match(/[\d.]+/g);
  if (!matches?.length) return 3;
  const nums = matches.map((m) => parseFloat(m));
  if (nums.length >= 2) {
    return Math.round(((nums[0] + nums[1]) / 2) * 10) / 10;
  }
  return Math.round(nums[0] * 10) / 10;
}

/** Fuld kategori-titel for et niveau-tal (fx 3.3 → "Avanceret øvet (3.5)"). */
export function levelBandTitleForNum(num) {
  const n = Number(num);
  if (!Number.isFinite(n)) return '';
  for (const l of LEVELS) {
    if (levelMatchesPreset(n, l)) return l;
  }
  return '';
}

/** Detaljeret beskrivelse mens bruger trækker slideren (nærmeste 0,5-trin). */
export function levelDescriptionForNum(num) {
  const step = nearestFineLevelStep(num);
  return LEVEL_FINE_DESCS[step] || LEVEL_DESCS[levelBandTitleForNum(num)] || null;
}

/** Konvertér gemt tal til fuld LEVELS-streng til brug i formular */
export function levelStringFromNum(num) {
  if (!num) return '';
  const n = Number(num);
  // Præcis match (inden for lille tolerance)
  const exact = LEVELS.find(l => {
    const matches = l.match(/[\d.]+/g);
    return matches?.some(m => Math.abs(parseFloat(m) - n) < 0.01);
  });
  if (exact) return exact;
  // Fallback: afrunding til heltal
  return LEVELS.find(l => {
    const m = l.match(/[\d.]+/);
    return m && Math.floor(parseFloat(m[0])) === Math.floor(n);
  }) || '';
}

export const PLAY_STYLES = ['Offensiv', 'Defensiv', 'Allround', 'Ved ikke endnu'];
export const COURT_SIDES = ['Venstre side', 'Højre side', 'Begge sider'];

/** Danmarks fem regioner (administrativ inddeling) */
export const REGIONS = [
  'Region Hovedstaden',
  'Region Midtjylland',
  'Region Nordjylland',
  'Region Sjælland',
  'Region Syddanmark',
];
export const DEFAULT_REGION = REGIONS[0];

export const AVAILABILITY = ['Morgener', 'Formiddage', 'Eftermiddage', 'Aftener', 'Weekender', 'Flexibel'];

export const DAYS_OF_WEEK = [
  { key: 'mon', label: 'Man' },
  { key: 'tue', label: 'Tir' },
  { key: 'wed', label: 'Ons' },
  { key: 'thu', label: 'Tor' },
  { key: 'fri', label: 'Fre' },
  { key: 'sat', label: 'Lør' },
  { key: 'sun', label: 'Søn' },
];

export const PARTNER_LEVELS = [
  { value: 'same',     label: 'Samme niveau',           desc: 'Find spillere tæt på mit ELO' },
  { value: 'stronger', label: 'Lidt stærkere',          desc: 'Jeg vil udfordres' },
  { value: 'weaker',   label: 'Lidt svagere',           desc: 'Jeg vil hygge' },
  { value: 'wide',     label: 'Bredt — alle niveauer',  desc: 'Jeg er fleksibel om niveau' },
];

export const PARTNER_LEVEL_LABELS = Object.fromEntries(PARTNER_LEVELS.map((p) => [p.value, p.label]));

export const INTENTS = [
  { value: 'hygge',       label: 'Hygge',        desc: 'Afslappet spil med god stemning' },
  { value: 'træning',     label: 'Træning',       desc: 'Fokus på at forbedre mit spil' },
  { value: 'konkurrence', label: 'Konkurrence',   desc: 'Vil gerne vinde og teste mit niveau' },
  { value: 'fast_makker', label: 'Fast makker',   desc: 'Søger en fast partner at spille med' },
  { value: 'turnering',   label: 'Turnering',     desc: 'Klar til turneringer og ligaer' },
];

export const INTENT_LABELS = Object.fromEntries(INTENTS.map((i) => [i.value, i.label]));

// Shared UI/data refresh timings
export const PROFILE_REFRESH_COOLDOWN_MS = 30_000;
export const HOME_FEED_CACHE_TTL_MS = 45_000;
/** Hvor længe "søger makker/kamp" (feedVisible) er aktivt fra seeking_match_at. */
export const SEEK_TTL_DAYS = 7;
export const SEEK_TTL_MS = SEEK_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Bruger-tekst: "7 dage" / "24 timer" */
export function seekingVisibleDurationLabel() {
  return SEEK_TTL_DAYS === 1 ? '24 timer' : `${SEEK_TTL_DAYS} dage`;
}
