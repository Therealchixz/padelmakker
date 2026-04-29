export const landingMockupBrand = {
  nameLines: ['PADEL', 'MAKKER'],
  tagline: 'FIND DIN PERFEKTE MAKKER',
};

export const landingMockupScreens = [
  {
    key: 'profile',
    eyebrow: 'Profil',
    title: 'Profil klar',
    detail: 'Niveau 3.5 · Aarhus · tirsdag/torsdag',
    metric: '1 min',
    tone: 'blue',
    cards: [
      { label: 'Niveau', value: '3.5', detail: 'Matcher dig med jævnbyrdige spillere' },
      { label: 'Område', value: 'Aarhus', detail: 'Finder spillere tæt på dine baner' },
      { label: 'Spilledage', value: 'Tir / tor', detail: 'Gør det nemt at aftale kamp' },
    ],
  },
  {
    key: 'matches',
    eyebrow: 'Find makker',
    title: '3 relevante makkere',
    detail: 'Samme niveau · under 8 km væk',
    metric: 'ELO match',
    tone: 'green',
    cards: [
      { label: 'Kevin', value: '1041 ELO', detail: 'Kan spille i aften' },
      { label: 'Mike', value: '1096 ELO', detail: 'Foretrækker 2v2' },
      { label: 'Karl', value: '927 ELO', detail: 'Svarer hurtigt' },
    ],
  },
  {
    key: 'booking',
    eyebrow: 'Opret kamp',
    title: 'Bane kl. 19:00',
    detail: 'Skansen Padel · 2v2 · åben tilmelding',
    metric: '4 pladser',
    tone: 'amber',
    cards: [
      { label: 'Bane', value: 'Skansen Padel', detail: '28.04.2026 kl. 19:00' },
      { label: 'Hold', value: '2v2 kamp', detail: 'Spillere kan tilmelde sig direkte' },
      { label: 'Status', value: '1 plads ledig', detail: 'Klar når sidste spiller joiner' },
    ],
  },
  {
    key: 'elo',
    eyebrow: 'Resultat',
    title: 'ELO opdateret',
    detail: '6-4, 5-7, 6-3 · bekræftet af modstander',
    metric: '+25 ELO',
    tone: 'green',
    cards: [
      { label: 'Resultat', value: '6-4, 5-7, 6-3', detail: 'Begge hold kan se scoren' },
      { label: 'Bekræftelse', value: 'Modstander OK', detail: 'Fair resultat før ELO ændres' },
      { label: 'Ny rating', value: '1065 ELO', detail: '+25 efter sejren' },
    ],
  },
];

export const landingMockupCarouselScreens = [
  ...landingMockupScreens,
  {
    ...landingMockupScreens[0],
    key: `${landingMockupScreens[0].key}-loop`,
    sourceKey: landingMockupScreens[0].key,
    isLoopClone: true,
  },
];

export function getLandingMockupAriaLabel() {
  return 'Animeret app-eksempel der viser profil, makker-match, bane, kamp og ELO-resultat i PadelMakker.';
}
