/**
 * Liga-oversigten i H-stil (prototypen "H · Ligaer", ejeren 17. nov. 2026).
 *
 * I stedet for tre faner (Tilmelding · Aktiv · Afsluttede) vises alt på én side:
 * åbne ligaer som store kort med holdpladser og "Tilmeld dit hold", derunder
 * "Sådan foregår det", ligaer i gang og afsluttede ligaer.
 *
 * Kun rigtige tal: ligaer har ikke et niveau-spænd i databasen, så prototypens
 * niveau-spaendet og "passer til dit niveau" fra prototypen vises ikke.
 */
import { ChevronRight } from 'lucide-react';
import { DateTime } from 'luxon';
import '../styles/liga-h.css';

const STEPS = [
  'Vælg en makker, og tilmeld jer som hold.',
  'Hver runde får I en modstander og aftaler selv tid og bane.',
  'Resultaterne tæller i ligaens stilling.',
];

function fmtDay(value) {
  if (!value) return '';
  const d = DateTime.fromISO(String(value).slice(0, 10), { locale: 'da' });
  return d.isValid ? d.toFormat('ccc d. LLL') : '';
}

function fmtShort(value) {
  if (!value) return '';
  const d = DateTime.fromISO(String(value).slice(0, 10), { locale: 'da' });
  return d.isValid ? d.toFormat('d. LLL') : '';
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function SlotGrid({ taken, max }) {
  if (!max || max > 16) return null;
  const cols = Math.min(max, 8);
  return (
    <div
      className="pm-lh-slots"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      role="img"
      aria-label={`${taken} af ${max} holdpladser taget`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < taken ? 'is-taken' : 'is-free'}>{i < taken ? i + 1 : ''}</span>
      ))}
    </div>
  );
}

function OpenLeagueCard({ item, onSignUp, onOpen }) {
  const { league, regionLabel, regCount, maxTeams, joined, totalRounds } = item;
  const free = maxTeams ? Math.max(0, maxTeams - regCount) : null;
  const isFull = free === 0;
  const meta = [
    totalRounds ? plural(totalRounds, 'runde', 'runder') : null,
    league.start_date ? `fra ${fmtDay(league.start_date)}` : null,
    regionLabel || null,
  ].filter(Boolean).join(' · ');
  const deadline = league.registration_deadline ? `Tilmelding senest ${fmtShort(league.registration_deadline)}` : '';

  return (
    <section className="pm-lh-open" aria-label={league.name}>
      <div className="pm-lh-open-top">
        <span className="pm-lh-chip">{joined ? 'I er tilmeldt' : isFull ? 'Fuld' : 'Åben for tilmelding'}</span>
        {deadline ? <span className="pm-lh-open-deadline">{deadline}</span> : null}
      </div>
      <h2 className="pm-lh-open-name">{league.name}</h2>
      {meta ? <p className="pm-lh-open-meta">{meta}</p> : null}
      <SlotGrid taken={regCount} max={maxTeams} />
      <p className="pm-lh-open-count">
        {maxTeams
          ? `${regCount} af ${maxTeams} hold tilmeldt${free > 0 ? ` · ${plural(free, 'ledig holdplads', 'ledige holdpladser')}` : ''}`
          : `${plural(regCount, 'hold', 'hold')} tilmeldt`}
      </p>
      {joined || isFull ? (
        <button type="button" className="pm-lh-open-cta pm-lh-open-cta--ghost" onClick={onOpen}>
          Se ligaen
        </button>
      ) : (
        <>
          <button type="button" className="pm-lh-open-cta" onClick={onSignUp}>
            Tilmeld dit hold
          </button>
          <button type="button" className="pm-lh-open-link" onClick={onOpen}>
            Se hold og regler
          </button>
        </>
      )}
    </section>
  );
}

function LeagueRow({ eyebrow, title, meta, action, onClick, onAction }) {
  return (
    <div className="pm-lh-row">
      <button type="button" className="pm-lh-row-main" onClick={onClick}>
        <span className="pm-lh-row-eyebrow">{eyebrow}</span>
        <span className="pm-lh-row-title">{title}</span>
        {meta ? <span className="pm-lh-row-meta">{meta}</span> : null}
      </button>
      <button type="button" className="pm-lh-row-action" onClick={onAction}>
        {action}
        <ChevronRight size={16} aria-hidden />
      </button>
    </div>
  );
}

/**
 * @param {{
 *   open: any[], active: any[], completed: any[],
 *   isAdmin: boolean, emptyAdminHint?: string,
 *   onSignUp: (id: string) => void, onOpen: (id: string) => void,
 *   onSchedule: (id: string) => void, onContact: () => void,
 * }} props
 */
export function LigaOverview({ open, active, completed, isAdmin, emptyAdminHint, onSignUp, onOpen, onSchedule, onContact }) {
  return (
    <div className="pm-lh">
      {open.length > 0 ? (
        open.map((item) => (
          <OpenLeagueCard
            key={item.league.id}
            item={item}
            onSignUp={() => onSignUp(item.league.id)}
            onOpen={() => onOpen(item.league.id)}
          />
        ))
      ) : (
        <section className="pm-lh-empty">
          <h2>Ingen åbne ligaer lige nu</h2>
          {isAdmin ? (
            <p>{emptyAdminHint}</p>
          ) : (
            <>
              <p>Ligaer oprettes af PadelMakker. Skriv til os, hvis I vil have en liga i jeres område.</p>
              <button type="button" className="pm-lh-empty-btn" onClick={onContact}>Skriv til os</button>
            </>
          )}
        </section>
      )}

      <section className="pm-lh-how" aria-labelledby="pm-lh-how-title">
        <h2 id="pm-lh-how-title">Sådan foregår det</h2>
        <ol>
          {STEPS.map((text, i) => (
            <li key={i}><span aria-hidden>{i + 1}</span>{text}</li>
          ))}
        </ol>
      </section>

      {active.length > 0 ? (
        <section className="pm-lh-list" aria-label="Ligaer i gang">
          {active.map(({ league, teamCount, regionLabel, totalRounds, myTeamRank }) => (
            <LeagueRow
              key={league.id}
              eyebrow={`I gang${league.current_round && totalRounds ? ` · runde ${league.current_round} af ${totalRounds}` : ''}`}
              title={league.name}
              meta={[plural(teamCount, 'hold', 'hold'), myTeamRank ? `I er nr. ${myTeamRank}` : null, regionLabel || null].filter(Boolean).join(' · ')}
              action="Se stillingen"
              onClick={() => onOpen(league.id)}
              onAction={() => onSchedule(league.id)}
            />
          ))}
        </section>
      ) : null}

      {completed.length > 0 ? (
        <section className="pm-lh-list" aria-labelledby="pm-lh-done-title">
          <h2 id="pm-lh-done-title" className="pm-lh-list-title">Afsluttede</h2>
          {completed.map(({ league, regionLabel }) => (
            <LeagueRow
              key={league.id}
              eyebrow={league.end_date ? `Sluttede ${fmtShort(league.end_date)}` : 'Afsluttet'}
              title={league.name}
              meta={regionLabel || null}
              action="Se resultater"
              onClick={() => onOpen(league.id)}
              onAction={() => onSchedule(league.id)}
            />
          ))}
        </section>
      ) : null}

      <p className="pm-lh-foot">Ligaer oprettes af PadelMakker.</p>
    </div>
  );
}
