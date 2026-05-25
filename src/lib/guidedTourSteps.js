/** Bump når trin/tekst ændres — brugere får guiden igen én gang. */
export const GUIDED_TOUR_VERSION = 3;

/**
 * @param {boolean} isMobileView
 * @param {(tabId: string) => string} tabTourSelector
 */
export function buildGuidedTourSteps(isMobileView, tabTourSelector) {
  const base = [
    {
      id: 'intro',
      title: 'Velkommen til PadelMakker',
      description:
        'Denne korte guide viser de vigtigste funktioner, så du hurtigt kan finde makkere, tilmelde dig kampe og følge din udvikling.',
    },
    {
      id: 'push-notifications',
      title: 'Hold dig opdateret',
      description:
        'På næste trin åbner vi notifikationspanelet. Der kan du aktivere push — så får du besked om kampe og invitationer, også når appen er lukket.',
    },
    {
      id: 'notification-bell',
      selector: '[data-tour="notification-panel"]',
      interactive: true,
      title: 'Aktiver push i klokken',
      description:
        'Klokken er åben. Tryk Aktiver i panelet (browseren kan bede om tilladelse). Du kan altid finde notifikationer i klokken bagefter.',
    },
    {
      id: 'home',
      tab: 'hjem',
      selector: tabTourSelector('hjem'),
      title: 'Hjem-overblik',
      description: 'Her får du et samlet overblik over aktivitet, genveje og det vigtigste der sker lige nu.',
    },
    {
      id: 'quick-action',
      tab: 'hjem',
      selector: '[data-tour="quick-action-kampe"]',
      title: 'Hurtig handling',
      description: 'Fra forsiden kan du hoppe direkte til kampe — fx tilmelde dig åbne 2v2-kampe.',
    },
    {
      id: 'latest-activity',
      tab: 'hjem',
      selector: '[data-tour="home-latest-activity"]',
      scrollBlock: 'start',
      title: 'Seneste aktivitet',
      description:
        'Her ser du hvad der rører sig: nye kampe, ELO-ændringer, Americano, liga og spillere der søger makker.',
    },
    {
      id: 'makkere',
      tab: 'makkere',
      selector: tabTourSelector('makkere'),
      title: 'Find makker',
      description: 'Her finder du spillere der matcher niveau og område, så du hurtigere får sat en kamp op.',
    },
    {
      id: 'baner-booking',
      tab: 'baner',
      selector: tabTourSelector('baner'),
      title: 'Book bane',
      description:
        'Vælg din region og et center. PadelMakker viser ledige tider hvor det er muligt — booking sker altid hos centret.',
    },
    {
      id: 'kampe',
      tab: 'kampe',
      selector: tabTourSelector('kampe'),
      title: 'Kampe',
      description:
        'Under Kampe finder du 2v2, Americano og liga: opret, tilmeld dig, og håndter resultater på ét sted.',
    },
  ];

  if (isMobileView) {
    base.push({
      id: 'mobile-more',
      selector: '[data-tour="mobile-more-sheet"]',
      tooltipPlacement: 'above',
      waitForMount: true,
      skipScroll: true,
      title: 'Mere-menu',
      description: 'Her finder du Ranking, Beskeder, Profil og flere indstillinger.',
    });
    base.push({
      id: 'profile',
      tab: 'profil',
      selector: '[data-tour="profile-main"]',
      scrollBlock: 'start',
      title: 'Din profil',
      description: 'Her opdaterer du profil, følger ELO og styrer dine præferencer.',
    });
  } else {
    base.push(
      {
        id: 'ranking',
        tab: 'ranking',
        selector: tabTourSelector('ranking'),
        title: 'Ranking',
        description: 'Her kan du følge ELO, placering og udvikling over tid.',
      },
      {
        id: 'account-menu',
        selector: '[data-tour="account-menu-dropdown"]',
        openAccountMenu: true,
        title: 'Menu ved dit navn',
        description:
          'Tryk på dit navn øverst til højre for Min profil, Start guide, Rapportér fejl og log ud.',
      },
      {
        id: 'profile',
        tab: 'profil',
        selector: '[data-tour="profile-main"]',
        scrollBlock: 'start',
        title: 'Din profil',
        description: 'Her opdaterer du profil, følger ELO og styrer dine præferencer.',
      },
    );
  }

  return base;
}
