import { ArrowRight } from 'lucide-react';

/**
 * Tre forenklede app-skaerme til "Saadan virker det" paa forsiden.
 * Det er illustrationer med eksempeldata (maerket "Eksempel"), ikke rigtige brugere.
 * De er skjult for skaermlaesere; teksten ved siden af forklarer trinnet.
 */

function PhoneTop() {
  return (
    <div className="pm-lp-phone-top pm-lp-mono">
      <span>PadelMakker</span>
      <span className="pm-lp-phone-tag">Eksempel</span>
    </div>
  );
}

function LevelScreen() {
  const options = [
    { lvl: '1.5', label: 'Nyt for mig', sub: 'Under 6 mdr.' },
    { lvl: '2.5', label: 'Jævnligt', sub: '1-2 år', on: true },
    { lvl: '3.5', label: 'Erfaren', sub: 'Turneringer' },
    { lvl: '5.0', label: 'Elite', sub: 'Ranglistespiller' },
  ];
  return (
    <div className="pm-lp-phone">
      <PhoneTop />
      <div className="pm-lp-phone-body">
        <div className="pm-lp-phone-title">Hvor længe har du spillet?</div>
        <div className="pm-lp-phone-muted">Giver dit startniveau. ELO justerer efter dine kampe.</div>
        <div className="pm-lp-phone-grid">
          {options.map((o) => (
            <div key={o.lvl} className={'pm-lp-phone-opt' + (o.on ? ' is-on' : '')}>
              <span className="pm-lp-phone-lvl">{o.lvl}</span>
              <span>
                <b>{o.label}</b>
                <br />
                <small>{o.sub}</small>
              </span>
            </div>
          ))}
        </div>
        <div className="pm-lp-phone-btn">
          <span>Næste</span>
          <ArrowRight size={18} aria-hidden />
        </div>
      </div>
    </div>
  );
}

function PlayScreen() {
  const days = [
    { d: 'ONS', n: 4, on: true },
    { d: 'TOR', n: 5, on: true },
    { d: 'FRE', n: 6 },
    { d: 'LØR', n: 7, on: true },
    { d: 'SØN', n: 8 },
  ];
  const matches = [
    { t: '17:30', c: 'Åben kamp · niveau 2.5-3.5', f: '2 ledige' },
    { t: '19:00', c: 'Åben kamp · niveau 2.0-3.0', f: '1 ledig' },
  ];
  return (
    <div className="pm-lp-phone">
      <PhoneTop />
      <div className="pm-lp-phone-body">
        <div className="pm-lp-phone-title">Hvornår kan du spille?</div>
        <div className="pm-lp-phone-days">
          {days.map((d) => (
            <div key={d.d} className={'pm-lp-phone-day pm-lp-mono' + (d.on ? ' is-on' : '')}>
              {d.d}
              <b>{d.n}</b>
            </div>
          ))}
        </div>
        <div>
          {matches.map((m) => (
            <div key={m.t} className="pm-lp-phone-row">
              <span className="pm-lp-phone-big">{m.t}</span>
              <b>{m.c}</b>
              <span className="pm-lp-mono" style={{ color: 'var(--pm-clay)' }}>{m.f}</span>
            </div>
          ))}
        </div>
        <div className="pm-lp-phone-btn">
          <span>Vis 2 kampe</span>
          <ArrowRight size={18} aria-hidden />
        </div>
      </div>
    </div>
  );
}

function RankScreen() {
  const rows = [
    { r: 1, n: 'Spiller A', e: 1184, d: '+22' },
    { r: 2, n: 'Spiller B', e: 1161, d: '+9' },
    { r: 3, n: 'Spiller C', e: 1140, d: '-4' },
    { r: 14, n: 'Dig', e: 1025, d: '+25', me: true },
    { r: 15, n: 'Spiller D', e: 1012, d: '-18' },
  ];
  return (
    <div className="pm-lp-phone">
      <PhoneTop />
      <div className="pm-lp-phone-body">
        <div className="pm-lp-phone-title">Rangliste</div>
        <div className="pm-lp-phone-muted">Din region · denne måned</div>
        <div>
          {rows.map((x) => (
            <div key={x.r} className={'pm-lp-phone-row' + (x.me ? ' is-me' : '')}>
              <span className="pm-lp-phone-big">{x.r}</span>
              <b>{x.n}</b>
              <span className="pm-lp-mono">
                {x.e} · {x.d}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const LANDING_STORY_STEPS = [
  {
    key: 'niveau',
    title: 'Fortæl os dit niveau',
    text: 'Fire spørgsmål, under et minut. Din ELO justerer niveauet efter hver kamp.',
    Screen: LevelScreen,
  },
  {
    key: 'spil',
    title: 'Tryk "Spil"',
    text: 'Vælg hvornår og hvor. Du ser kampe, der passer, eller opretter din egen.',
    Screen: PlayScreen,
  },
  {
    key: 'elo',
    title: 'Spil og stig i ELO',
    text: 'Når alle fire har bekræftet resultatet, flytter kampen dig på ranglisten.',
    Screen: RankScreen,
  },
];
