export const landingEloScoreExample = {
  playerName: 'Karl',
  oldElo: 1040,
  newElo: 1065,
  delta: 25,
  result: 'Vundet 6-4, 5-7, 6-3',
  confirmation: 'Bekræftet af modstanderholdet',
};

export const landingEloAnimationConfig = {
  durationMs: 2800,
  startDelayMs: 300,
};

export const landingEloExplainerSteps = [
  {
    key: 'before',
    label: 'Før kampen',
    title: 'Niveauet er kendt',
    detail: 'Din forventning beregnes mod modstanderholdets gennemsnit.',
  },
  {
    key: 'match',
    label: 'Efter resultat',
    title: 'Scoren bekræftes',
    detail: 'Resultatet godkendes, og sejrsmarginen tæller med.',
  },
  {
    key: 'after',
    label: 'Ny rating',
    title: 'Udviklingen gemmes',
    detail: 'Din 2v2-ELO opdateres. Americano/Mexicano ELO er separat.',
  },
];

export function formatEloDelta(delta) {
  const numericDelta = Number(delta) || 0;
  return `${numericDelta > 0 ? '+' : ''}${numericDelta} ELO`;
}
