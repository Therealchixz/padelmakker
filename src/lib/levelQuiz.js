/**
 * "Ikke sikker på dit niveau?" – 5 spørgsmål ved oprettelse.
 *
 * Skalaen følger Dansk Padel Forbund ("Find/kend dit padelniveau", sendt af
 * ejeren 24. sep. 2026):
 *   1.0–1.9 Begynder    ny, eller rammer bolden uden kontrol
 *   2.0–2.9 Let øvet    får dueller i gang; fra 2.5 rigtige padelslag
 *   3.0–3.4 Øvet        3. division / DPF50
 *   3.5–3.9             2. division / DPF100
 *   4.0–4.4 Meget øvet  1. division / DPF200
 *   4.5–4.9             Elitedivision / DPF400
 *   5.0+    Elite
 * Niveau 3.0 og op er altså divisions- og turneringsspillere. Derfor afgør
 * spørgsmålet om division/turneringer loftet; slagene placerer én under det.
 *
 * Research (Playtomic m.fl.): folk gætter for højt, og konkrete slag skiller
 * bedre end antal år. Forslaget rundes NED til nærmeste halve. Det er kun et
 * forslag – man kan altid skrive sit niveau selv.
 */

export const LEVEL_QUIZ = [
  {
    id: 'years',
    question: 'Hvor længe har du spillet padel?',
    options: ['Aldrig', 'Under et halvt år', '½–2 år', 'Over 2 år'],
  },
  {
    id: 'racket',
    question: 'Har du spillet tennis, squash eller badminton?',
    options: ['Nej', 'Lidt', 'I flere år', 'På konkurrenceniveau'],
  },
  {
    id: 'glass',
    question: 'Bolden kommer ud fra bagglasset. Hvad sker der?',
    options: [
      'Jeg rammer den sjældent',
      'Nogle gange, hvis den er langsom',
      'Jeg får den som regel tilbage',
      'Også under pres, og jeg vælger hvorhen',
    ],
  },
  {
    id: 'overhead',
    question: 'En høj bold ved nettet. Hvad gør du?',
    options: [
      'Lader den gå eller trækker mig tilbage',
      'Slår så hårdt jeg kan',
      'Bandeja',
      'Bandeja eller vibora – som jeg vælger',
    ],
  },
  {
    id: 'competition',
    question: 'Spiller du holdturnering (division) eller DPF-turneringer?',
    options: [
      'Nej',
      '3. division eller DPF25–50',
      '2. division eller DPF100',
      '1. division, DPF200 eller højere',
    ],
  },
];

const SKILL_WEIGHTS = { years: 0.25, racket: 0.2, glass: 0.35, overhead: 0.3 };

/** Ramme pr. svar på division/turneringer (DPF-skalaen). */
const COMPETITION_BANDS = [
  { min: 1.0, max: 3.0 }, // ingen division: højst 3.0
  { min: 3.0, max: 3.4 }, // 3. division / DPF50
  { min: 3.5, max: 3.9 }, // 2. division / DPF100
  { min: 4.0, max: 4.9 }, // 1. division / DPF200 og op
];

function answerIndex(answers, id) {
  const n = Number(answers?.[id]);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
}

export function levelQuizComplete(answers) {
  return LEVEL_QUIZ.every((q) => answerIndex(answers, q.id) != null);
}

/**
 * @param {Record<string, number>} answers id → valgt svar (0–3)
 * @returns {number | null} foreslået niveau (1,0–4,5 i halve), eller null hvis ikke alle er besvaret
 */
export function suggestLevelFromQuiz(answers) {
  if (!levelQuizComplete(answers)) return null;
  // Slagene: 1,0 (intet) til ca. 4,3 (alt på plads).
  let raw = 1;
  for (const [id, w] of Object.entries(SKILL_WEIGHTS)) raw += w * answerIndex(answers, id);
  // Kan man ikke styre bagglasset, er man under 3,0 (DPF: "mangler kontrol").
  if (answerIndex(answers, 'glass') <= 1) raw = Math.min(raw, 2.9);
  const band = COMPETITION_BANDS[answerIndex(answers, 'competition')];
  raw = Math.max(band.min, Math.min(band.max, raw));
  return Math.floor(raw * 2) / 2;
}
