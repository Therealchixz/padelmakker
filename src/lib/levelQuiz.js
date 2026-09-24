/**
 * "Ikke sikker på dit niveau?" – 4 spørgsmål ved oprettelse.
 *
 * Research (24. sep. 2026, se PR): alle store padel-apps lader spilleren
 * vurdere sig selv, og folk gætter for højt (Playtomic typisk 0,5–1,0 over).
 * Det, der skiller niveauerne, er konkrete slag, ikke antal år:
 *   - kan man tage bolden af bagglasset under pres? ("sometimes, if it's
 *     slow" = under 3,0)
 *   - svarer man på en høj bold ved nettet med andet end et fladt smash?
 *     (bandeja = 4,0 og op; kun smash = under 4,0)
 * Erfaring fra tennis, squash og badminton trækker op fra start.
 *
 * Forslaget rundes NED til nærmeste halve, fordi folk overvurderer sig selv.
 * Man kan altid rette det bagefter.
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
];

const WEIGHTS = { years: 0.25, racket: 0.2, glass: 0.5, overhead: 0.5 };

function answerIndex(answers, id) {
  const n = Number(answers?.[id]);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
}

export function levelQuizComplete(answers) {
  return LEVEL_QUIZ.every((q) => answerIndex(answers, q.id) != null);
}

/**
 * @param {Record<string, number>} answers id → valgt svar (0–3)
 * @returns {number | null} foreslået niveau (1,0–5,0 i halve), eller null hvis ikke alle er besvaret
 */
export function suggestLevelFromQuiz(answers) {
  if (!levelQuizComplete(answers)) return null;
  let raw = 1;
  for (const q of LEVEL_QUIZ) raw += WEIGHTS[q.id] * answerIndex(answers, q.id);
  // Kan man ikke styre bagglasset, er man under 3,0; kun smash ved nettet er under 4,0.
  if (answerIndex(answers, 'glass') <= 1) raw = Math.min(raw, 2.9);
  if (answerIndex(answers, 'overhead') <= 1) raw = Math.min(raw, 3.9);
  const rounded = Math.floor(raw * 2) / 2;
  return Math.max(1, Math.min(5, rounded));
}
