export const landingMockupLogoSrc = '/logo-brand.png';

export const landingMockupSteps = [
  {
    key: 'profile',
    eyebrow: 'Profil klar',
    title: 'Niveau 3.5',
    detail: 'Aarhus · tirsdag/torsdag',
    metric: 'Klar på 1 min',
    tone: 'blue',
  },
  {
    key: 'matches',
    eyebrow: 'Find makker',
    title: '3 spillere matcher dig',
    detail: 'ELO 950-1100 · under 8 km væk',
    metric: 'Niveau-match',
    tone: 'green',
  },
  {
    key: 'court',
    eyebrow: 'Book bane',
    title: 'Ledig bane fundet',
    detail: 'Skansen Padel · kl. 19:00',
    metric: '10+ centre',
    tone: 'amber',
  },
  {
    key: 'match',
    eyebrow: 'Kamp oprettet',
    title: 'Kevin & Mike vs Karl & Hans',
    detail: '2v2 · i gang i aften',
    metric: '4 spillere',
    tone: 'blue',
  },
  {
    key: 'elo',
    eyebrow: 'Resultat',
    title: 'ELO opdateret',
    detail: '6-4, 5-7, 6-3 · bekræftet',
    metric: '+18 ELO',
    tone: 'green',
  },
];

export function getLandingMockupAriaLabel() {
  return 'Animeret app-eksempel der viser profil, makker-match, bane, kamp og ELO-resultat i PadelMakker.';
}
