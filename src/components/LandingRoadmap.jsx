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
      { icon: TrendingUp, title: 'Dynamisk 2v2-ELO', detail: 'Individuel forventning, K-faktor og sejrsmargin i alle 2v2-kampe.' },
      { icon: Trophy, title: 'Separat Americano/Mexicano ELO', detail: 'Egen rating for Americano og Mexicano, beregnet ved afslutning af Americano/Mexicano.' },
      { icon: MapPinned, title: 'Baneoversigt', detail: 'Udvalgte centre med direkte bookingvej.' },
    ],
  },
  {
    title: 'Næste skridt',
    status: 'Under udvikling',
    tone: 'soon',
    icon: Sparkles,
    items: [
      { icon: Users, title: 'Bedre makker-forslag', detail: 'Mere relevante forslag ud fra niveau, region og aktivitet.' },
      { icon: Bell, title: 'Skarpere notifikationer', detail: 'Færre støjbeskeder og mere relevante kamp-signaler.' },
      { icon: ClipboardList, title: 'Mere statistik i profiler', detail: 'Flere indsigter om form, udvikling og historik over tid.' },
      { icon: MapPinned, title: 'Flere centre', detail: 'Mere dækning i baneoversigten.' },
    ],
  },
  {
    title: 'På sigt',
    status: 'Idéfase',
    tone: 'later',
    icon: Lightbulb,
    items: [
      { icon: Target, title: 'Flere Americano/Mexicano-formater', detail: 'Endnu flere formater til klubber, grupper og events.' },
      { icon: UserRoundCog, title: 'Udvidede profiler', detail: 'Spillestil, favoritcentre og tilgængelighed.' },
      { icon: MessageCircleHeart, title: 'Brugerønsker', detail: 'Stem på de forbedringer der betyder mest.' },
      { icon: ClipboardList, title: 'Klubfunktioner', detail: 'Flere værktøjer til arrangører og admins.' },
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
            hvad vi arbejder på lige nu, og hvad der ligger længere fremme.
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
