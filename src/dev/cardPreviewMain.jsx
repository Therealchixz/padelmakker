/* Dev-only preview af KampeMatchListCard med mock-data — gør det muligt at se
   og justere kortdesignet uden login. Åbn /card-preview.html (?theme=dark). */
import { createRoot } from 'react-dom/client';
import '../index.css';
import '../styles/variables.css';
import '../responsive.css';
import { KampeMatchListCard } from '../components/kampe/KampeMatchListCard';

const theme = new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.setAttribute('data-theme', theme);

const profilesById = {
  1: { name: 'Mads Jensen', avatar: '🎾' },
  2: { name: 'Sofie Holm', avatar: '👩' },
  3: { name: 'Jonas Berg', avatar: '🧔' },
  4: { name: 'Emma Friis', avatar: '👱‍♀️' },
};
const p = (id) => ({ user_id: String(id) });
const baseMatch = {
  id: 'm1',
  court_name: 'Padel Club Aalborg — Bane 3',
  date: '2026-07-05',
  time: '18:00',
  duration: 90,
  max_players: 4,
};
const prefs = { min: 1050, max: 1350, booked: true };
const noop = () => {};

const completedResult = {
  confirmed: true,
  match_winner: 'team1',
  set1_team1: 6, set1_team2: 3,
  set2_team1: 4, set2_team2: 6,
  set3_team1: 7, set3_team2: 5,
};

const cases = [
  {
    title: 'Åben — 2 ledige pladser, CTA',
    props: {
      match: { ...baseMatch, id: 'a' },
      teamStats: { t1: [p(1)], t2: [p(3)] },
      status: 'open', left: 2, isFull: false, joined: false, matchPrefs: prefs,
      primaryAction: { label: 'Tilmeld mig', onClick: noop },
    },
  },
  {
    title: 'Åben — fuld, ikke tilmeldt (dull)',
    props: {
      match: { ...baseMatch, id: 'b', court_name: 'Racket Club København' },
      teamStats: { t1: [p(1), p(2)], t2: [p(3), p(4)] },
      status: 'open', left: 0, isFull: true, joined: false, matchPrefs: prefs,
    },
  },
  {
    title: 'Lukket — 2 anmodninger (attention)',
    props: {
      match: { ...baseMatch, id: 'c' },
      teamStats: { t1: [p(1)], t2: [] },
      status: 'open', left: 3, isFull: false, joined: true, isClosed: true, matchPrefs: prefs,
      unreadCount: 2, attentionReason: '2 tilmeldingsanmodninger',
      primaryAction: { label: 'Venter på spillere', onClick: noop, disabled: true, variant: 'secondary' },
    },
  },
  {
    title: 'I gang — live',
    props: {
      match: { ...baseMatch, id: 'd', started_at: new Date(Date.now() - 40 * 60000).toISOString() },
      teamStats: { t1: [p(1), p(2)], t2: [p(3), p(4)] },
      status: 'in_progress', left: 0, isFull: true, joined: true, matchPrefs: prefs,
      primaryAction: { label: 'Indrapportér resultat', onClick: noop },
    },
  },
  {
    title: 'I gang — bekræft resultat (attention)',
    props: {
      match: { ...baseMatch, id: 'e', started_at: new Date(Date.now() - 95 * 60000).toISOString() },
      teamStats: { t1: [p(1), p(2)], t2: [p(3), p(4)] },
      status: 'in_progress', left: 0, isFull: true, joined: true, matchPrefs: prefs,
      unreadCount: 1, attentionReason: 'Bekræft resultat',
      primaryAction: { label: 'Bekræft resultat', onClick: noop },
    },
  },
  {
    title: 'I gang — venter på modstander (statusNote)',
    props: {
      match: { ...baseMatch, id: 'f', started_at: new Date(Date.now() - 100 * 60000).toISOString() },
      teamStats: { t1: [p(1), p(2)], t2: [p(3), p(4)] },
      status: 'in_progress', left: 0, isFull: true, joined: true, matchPrefs: prefs,
      statusNote: 'Venter på modstander',
    },
  },
  {
    title: 'Spillet — vundet med score',
    props: {
      match: { ...baseMatch, id: 'g' },
      teamStats: { t1: [p(1), p(2)], t2: [p(3), p(4)] },
      status: 'completed', left: 0, isFull: true, joined: true, matchPrefs: prefs,
      matchResult: completedResult, winnerTeam: 1, myTeam: 1, myEloChange: 18, currentUserId: '1',
    },
  },
  {
    title: 'Spillet — tabt',
    props: {
      match: { ...baseMatch, id: 'h', court_name: 'Padel Zone Odense' },
      teamStats: { t1: [p(1), p(2)], t2: [p(3), p(4)] },
      status: 'completed', left: 0, isFull: true, joined: true, matchPrefs: prefs,
      matchResult: { ...completedResult, match_winner: 'team2' }, winnerTeam: 2, myTeam: 1,
      myEloChange: -12, currentUserId: '1',
    },
  },
];

function Preview() {
  return (
    <div style={{ maxWidth: 390, margin: '0 auto', padding: '16px 14px 60px', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: 15, fontWeight: 800 }}>KampeMatchListCard — {theme}</h1>
      {cases.map((c) => (
        <div key={c.title} style={{ margin: '18px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {c.title}
          </div>
          <div className="pm-kampe-v2-list">
            <KampeMatchListCard profilesById={profilesById} onClick={noop} {...c.props} />
          </div>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Preview />);
