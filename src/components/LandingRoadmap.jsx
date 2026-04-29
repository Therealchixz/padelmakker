import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  MapPinned,
  MessageCircleHeart,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  UserRoundCog,
  Users,
} from 'lucide-react';

const roadmapColumns = [
  {
    title: 'Live nu',
    status: 'Klar i appen',
    tone: 'live',
    icon: CheckCircle2,
    items: [
      { icon: Users, title: 'Find makker', detail: 'Se spillere tæt på dit niveau og område.' },
      { icon: Target, title: 'Opret kampe', detail: 'Åbne og lukkede 2v2-kampe med tilmelding.' },
      { icon: TrendingUp, title: 'ELO-ranking', detail: 'Resultater og rating samlet ét sted.' },
      { icon: MapPinned, title: 'Baneoversigt', detail: 'Udvalgte centre med direkte bookingvej.' },
    ],
  },
  {
    title: 'På vej',
    status: 'Under udvikling',
    tone: 'soon',
    icon: Sparkles,
    items: [
      { icon: Users, title: 'Bedre makker-forslag', detail: 'Mere relevante forslag ud fra niveau, region og aktivitet.' },
      { icon: TrendingUp, title: 'Mere ELO-forklaring', detail: 'Tydeligere hvorfor rating ændrer sig efter en kamp.' },
      { icon: Bell, title: 'Skarpere notifikationer', detail: 'Færre støjbeskeder og mere relevante kamp-signaler.' },
      { icon: MapPinned, title: 'Flere centre', detail: 'Mere dækning i baneoversigten.' },
    ],
  },
  {
    title: 'Senere',
    status: 'Idéfase',
    tone: 'later',
    icon: Lightbulb,
    items: [
      { icon: Trophy, title: 'Turneringer og ligaer', detail: 'Flere formater til klubber og grupper.' },
      { icon: UserRoundCog, title: 'Udvidede profiler', detail: 'Spillestil, favoritcentre og tilgængelighed.' },
      { icon: MessageCircleHeart, title: 'Brugerønsker', detail: 'Stem på de forbedringer der betyder mest.' },
      { icon: ClipboardList, title: 'Klubfunktioner', detail: 'Bedre værktøjer til arrangører.' },
    ],
  },
];

export function LandingRoadmap() {
  return (
    <section className="pm-roadmap-section" aria-labelledby="landing-roadmap-heading">
      <div className="pm-roadmap-inner">
        <div className="pm-roadmap-copy pm-reveal">
          <p className="pm-landing-kicker">Roadmap</p>
          <h2 id="landing-roadmap-heading">PadelMakker bliver hele tiden bedre</h2>
          <p>
            Vi bygger platformen sammen med spillerne. Her er noget af det, der er live nu,
            og det vi arbejder på næste.
          </p>
        </div>

        <div className="pm-roadmap-grid" aria-label="PadelMakker roadmap">
          {roadmapColumns.map((column, columnIndex) => {
            const ColumnIcon = column.icon;
            return (
              <article
                className={`pm-roadmap-card pm-roadmap-card--${column.tone} pm-reveal pm-delay-${columnIndex + 1}`}
                key={column.title}
              >
                <div className="pm-roadmap-card-head">
                  <span className="pm-roadmap-main-icon" aria-hidden="true">
                    <ColumnIcon size={22} strokeWidth={2.5} />
                  </span>
                  <span className="pm-roadmap-status">{column.status}</span>
                </div>
                <h3>{column.title}</h3>
                <ul className="pm-roadmap-items">
                  {column.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <li className="pm-roadmap-item" key={item.title}>
                        <span className="pm-roadmap-item-icon" aria-hidden="true">
                          <ItemIcon size={16} strokeWidth={2.4} />
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
