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
    detail: 'Begge hold starter med en tydelig rating.',
  },
  {
    key: 'match',
    label: 'Efter resultat',
    title: 'Scoren bekræftes',
    detail: 'Modstanderholdet godkender, før ELO ændres.',
  },
  {
    key: 'after',
    label: 'Ny rating',
    title: 'Udviklingen gemmes',
    detail: 'Profilen viser din opdaterede ELO over tid.',
  },
];

export function formatEloDelta(delta) {
  const numericDelta = Number(delta) || 0;
  return `${numericDelta > 0 ? '+' : ''}${numericDelta} ELO`;
}
