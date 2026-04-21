import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { theme, btn, inputStyle, labelStyle, tag } from '../lib/platformTheme';
import { Trophy, Users, Plus, Play, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { AvatarCircle } from '../components/AvatarCircle';
import { formatMatchDateDa } from '../lib/matchDisplayUtils';
import { PlayerProfileModal } from './PlayerProfileModal';

function isTiebreakScore(scoreText) {
  return !!(scoreText && /7-6|6-7/.test(scoreText));
}

function parseGameDiff(scoreText, winnerId, team1Id) {
  if (!scoreText) return 0;
  const m = scoreText.trim().match(/^(\d+)-(\d+)$/);
  if (!m) return 0;
  const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
  // max(a,b) always belongs to winner; min(a,b) to loser
  const winnerGames = Math.max(a, b), loserGames = Math.min(a, b);
  // return diff from team1 perspective
  return winnerId === team1Id ? winnerGames - loserGames : loserGames - winnerGames;
}

function computeStandings(teams, matches) {
  const map = {};
  for (const t of teams) map[t.id] = { ...t, points: 0, wins: 0, losses: 0, played: 0, gameDiff: 0 };
  for (const m of matches) {
    if (m.status !== 'reported' || !m.winner_id) continue;
    const winner = map[m.winner_id];
    const loserId = m.winner_id === m.team1_id ? m.team2_id : m.team1_id;
    const loser = loserId ? map[loserId] : null;
    const tb = isTiebreakScore(m.score_text);
    const diffT1 = parseGameDiff(m.score_text, m.winner_id, m.team1_id);
    if (winner) {
      winner.wins++; winner.points += 3; winner.played++;
      winner.gameDiff += m.winner_id === m.team1_id ? diffT1 : -diffT1;
    }
    if (loser) {
      loser.losses++; if (tb) loser.points += 1; loser.played++;
      loser.gameDiff += loserId === m.team1_id ? diffT1 : -diffT1;
    }
  }
  return Object.values(map).sort((a, b) =>
    b.points   !== a.points   ? b.points   - a.points   :
    b.gameDiff !== a.gameDiff ? b.gameDiff - a.gameDiff :
    b.wins     !== a.wins     ? b.wins     - a.wins     :
    b.elo_combined - a.elo_combined
  );
}

function generatePairings(standings, allMatches) {
  const played = new Set(
    allMatches
      .filter(m => m.team1_id && m.team2_id)
      .map(m => [m.team1_id, m.team2_id].sort().join('|'))
  );
  const pairings = [];
  const used = new Set();
  for (let i = 0; i < standings.length; i++) {
    if (used.has(standings[i].id)) continue;
    const t1 = standings[i];
    let paired = false;
    for (let j = i + 1; j < standings.length; j++) {
      if (used.has(standings[j].id)) continue;
      const t2 = standings[j];
      if (played.has([t1.id, t2.id].sort().join('|'))) continue;
      pairings.push({ team1_id: t1.id, team2_id: t2.id });
      used.add(t1.id); used.add(t2.id);
      paired = true; break;
    }
    if (!paired && !used.has(t1.id)) {
      pairings.push({ team1_id: t1.id, team2_id: null });
      used.add(t1.id);
    }
  }
  return pairings;
}

function validatePadelScore(score) {
  const s = score.trim();
  if (!s) return 'Angiv scoren før du indberetter resultatet.';
  const m = s.match(/^(\d+)-(\d+)$/);
  if (!m) return 'Scoren skal skrives som X-Y, f.eks. 6-4';
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if ((hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6))) return null;
  return 'Ugyldig padel-score. Gyldige resultater: 6-0 → 6-4, 7-5 eller 7-6';
}

const SEASON_LABELS = { weekly: 'Ugentlig', monthly: 'Månedlig' };
const STATUS_LABELS = { registration: 'Tilmelding åben', active: 'Aktiv', completed: 'Afsluttet' };
const STATUS_COLORS = {
  registration: { bg: theme.warmBg,    color: theme.warm },
  active:       { bg: theme.greenBg,   color: theme.green },
  completed:    { bg: theme.surfaceAlt, color: theme.textMid },
};

const SWISS_RULES = [
  { icon: '🎾', text: 'Hvert hold spiller én kamp per runde — ingen eliminering, alle spiller videre.' },
  { icon: '📊', text: 'Hold parres mod andre med samme pointtal. Jo flere runder, jo mere præcis ranglisten bliver.' },
  { icon: '🔁', text: 'To hold mødes aldrig hinanden mere end én gang i samme turnering.' },
  { icon: '🏆', text: 'Point: Sejr = 3 · Tab i tiebreak (7-6) = 1 · Klart tab = 0.' },
  { icon: '📏', text: 'Ved pointlighed afgøres placeringen af spilsforskel (antal games vundet minus tabt).' },
  { icon: '🔢', text: 'Antal runder beregnes automatisk: 3 hold → 2 runder, 4 hold → 3 runder, 8 hold → 3 runder, 16 hold → 4 runder.' },
  { icon: '🎯', text: 'Score er obligatorisk ved indberetning — gyldige: 6-0 til 6-4, 7-5 eller 7-6.' },
  { icon: '⏸️', text: 'Næste runde genereres først når alle kampe i indeværende runde er indberettet.' },
  { icon: '👥', text: 'Ulige antal hold? Ét hold får fri runde og tæller automatisk som sejr (3 point).' },
  { icon: '📋', text: 'W = Wins (sejre) · L = Losses (nederlag) · Diff = spilsforskel (games vundet minus games tabt).' },
];

function SwissRulesBox({ collapsible = false }) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <div style={{ background: theme.accentBg, borderRadius: '10px', border: '1px solid ' + theme.border, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => collapsible && setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 14px', background: 'none', border: 'none', cursor: collapsible ? 'pointer' : 'default', textAlign: 'left' }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, color: theme.accent }}>ℹ️ Sådan fungerer Swiss-ligaen</span>
        {collapsible && <span style={{ fontSize: '12px', color: theme.accent }}>{open ? '▲' : '▼'}</span>}
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {SWISS_RULES.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: theme.textMid, lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0 }}>{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TEAM_PALETTE = [
  'oklch(0.62 0.14 155)',
  'oklch(0.55 0.14 255)',
  'oklch(0.62 0.14 25)',
  'oklch(0.58 0.15 295)',
  'oklch(0.65 0.14 60)',
  'oklch(0.55 0.14 195)',
];

function DotName({ teamId, name, teamColors }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: teamColors[teamId] || '#94A3B8', display: 'inline-grid', placeItems: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
        {name?.slice(0, 1).toUpperCase()}
      </span>
      <span style={{ fontFamily: 'system-ui', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>{name}</span>
    </span>
  );
}

function MatchDetailModal({ match, rn, teamMap, teamColors, prevStats, onClose }) {
  const t1 = teamMap[match.team1_id];
  const t2 = match.team2_id ? teamMap[match.team2_id] : null;
  const reported = match.status === 'reported';
  const t1Stats = prevStats[match.team1_id] || { wins: 0, losses: 0 };
  const t2Stats = match.team2_id ? (prevStats[match.team2_id] || { wins: 0, losses: 0 }) : null;
  const t1Wins = reported && (match.winner_id === match.team1_id || !match.team2_id);
  const t2Wins = reported && !!t2 && match.winner_id === match.team2_id;

  let t1Score = '—', t2Score = '—';
  if (reported && match.score_text) {
    const sp = match.score_text.match(/^(\d+)-(\d+)$/);
    if (sp) {
      const ws = Math.max(+sp[1], +sp[2]), ls = Math.min(+sp[1], +sp[2]);
      t1Score = String(t1Wins ? ws : ls);
      t2Score = String(t2Wins ? ws : ls);
    }
  }

  const winner = t1Wins ? t1 : t2Wins ? t2 : null;
  const statusLabel = !t2 ? 'Fri runde' : !reported ? 'Planlagt' : 'Afsluttet';
  const resultLabel = !t2 ? `${t1?.name} — fri runde (automatisk sejr)` : !reported ? '—' : `${winner?.name} vinder ${Math.max(+t1Score || 0, +t2Score || 0)}–${Math.min(+t1Score || 0, +t2Score || 0)}`;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'grid', placeItems: 'center', padding: '20px', animation: 'fadein .2s ease' }}
    >
      <style>{`@keyframes fadein{from{opacity:0}to{opacity:1}}@keyframes popin{from{opacity:0;transform:translateY(10px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
      <div onClick={e => e.stopPropagation()}
        style={{ background: theme.surface, borderRadius: '20px', width: '100%', maxWidth: '520px', boxShadow: theme.shadowLg, overflow: 'hidden', animation: 'popin .24s cubic-bezier(.2,.9,.3,1)', border: '1px solid ' + theme.border }}
      >
        {/* Header */}
        <div style={{ padding: '22px 26px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.textLight, fontWeight: 600 }}>
            Runde {rn}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '8px', border: '1px solid ' + theme.border, background: theme.surfaceAlt, color: theme.textLight, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            ×
          </button>
        </div>

        {/* Score section */}
        <div style={{ padding: '10px 26px 26px' }}>
          {!t2 ? (
            <div style={{ padding: '20px 0', borderBottom: '1px solid #E2E8F0', textAlign: 'center' }}>
              <DotName teamId={t1?.id} name={t1?.name} teamColors={teamColors} />
              <div style={{ marginTop: '8px', fontSize: '12px', color: theme.textLight }}>{t1?.player1_name} · {t1?.player2_name}</div>
              <div style={{ marginTop: '14px', fontSize: '13px', color: theme.textMid, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Fri runde</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '16px', padding: '20px 0', borderBottom: '1px solid #E2E8F0' }}>
              {/* Team 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', opacity: reported && !t1Wins ? 0.45 : 1 }}>
                <DotName teamId={t1?.id} name={t1?.name} teamColors={teamColors} />
                <div style={{ fontSize: '12px', color: theme.textLight }}>
                  {[t1?.player1_name, t1?.player2_name].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '40px', fontWeight: 600, letterSpacing: '-0.02em', color: t1Wins ? theme.text : theme.textLight, marginTop: '6px' }}>
                  {t1Score}
                </div>
              </div>
              {/* VS */}
              <div style={{ color: theme.textLight, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '18px', alignSelf: 'center' }}>vs</div>
              {/* Team 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', textAlign: 'right', opacity: reported && !t2Wins ? 0.45 : 1 }}>
                <DotName teamId={t2?.id} name={t2?.name} teamColors={teamColors} />
                <div style={{ fontSize: '12px', color: theme.textLight }}>
                  {[t2?.player1_name, t2?.player2_name].filter(Boolean).join(' · ')}
                </div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '40px', fontWeight: 600, letterSpacing: '-0.02em', color: t2Wins ? theme.text : theme.textLight, marginTop: '6px' }}>
                  {t2Score}
                </div>
              </div>
            </div>
          )}

          {/* Info table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontSize: '13px' }}>
            <tbody>
              {[
                ['Runde', `Runde ${rn}`],
                ['Status', statusLabel],
                ['Resultat', resultLabel],
                t2 && ['Records før', `${t1Stats.wins}W-${t1Stats.losses}L · ${t2Stats?.wins}W-${t2Stats?.losses}L`],
              ].filter(Boolean).map(([label, value]) => (
                <tr key={label} style={{ borderTop: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '10px 0', color: theme.textLight, fontSize: '12px' }}>{label}</td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: theme.text }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SwissBracket({ teams, matches, currentRound, totalRounds, myTeam }) {
  const [open, setOpen] = useState(false);
  const [highlightTeam, setHighlightTeam] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const bracketRef = useRef(null);
  const [connectors, setConnectors] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const teamMap = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t])), [teams]);

  const teamColors = useMemo(() => {
    const m = {};
    teams.forEach((t, i) => { m[t.id] = TEAM_PALETTE[i % TEAM_PALETTE.length]; });
    return m;
  }, [teams]);

  const teamMatchByRound = useMemo(() => {
    const map = {};
    for (const m of matches) {
      for (const tid of [m.team1_id, m.team2_id].filter(Boolean)) {
        if (!map[tid]) map[tid] = {};
        map[tid][m.round_number] = m.id;
      }
    }
    return map;
  }, [matches]);

  const { statsAfterRound, roundsMap, allRounds } = useMemo(() => {
    const cumW = {}, cumL = {};
    for (const t of teams) { cumW[t.id] = 0; cumL[t.id] = 0; }
    const sar = {};
    const rMap = {};
    for (const m of matches) {
      if (!rMap[m.round_number]) rMap[m.round_number] = [];
      rMap[m.round_number].push(m);
    }
    const sortedRNs = Object.keys(rMap).map(Number).sort((a, b) => a - b);
    for (const rn of sortedRNs) {
      for (const m of rMap[rn]) {
        if (m.status !== 'reported' || !m.winner_id) continue;
        const loserId = m.winner_id === m.team1_id ? m.team2_id : m.team1_id;
        if (cumW[m.winner_id] !== undefined) cumW[m.winner_id]++;
        if (loserId && cumL[loserId] !== undefined) cumL[loserId]++;
      }
      sar[rn] = {};
      for (const id of Object.keys(cumW)) sar[rn][id] = { wins: cumW[id], losses: cumL[id] };
    }
    const maxR = Math.max(totalRounds || 0, currentRound || 0, ...Object.keys(rMap).map(Number), 1);
    const allR = Array.from({ length: maxR }, (_, i) => i + 1);
    return { statsAfterRound: sar, roundsMap: rMap, allRounds: allR };
  }, [matches, teams, totalRounds, currentRound]);

  useEffect(() => {
    if (!open) { setConnectors([]); return; }
    const compute = () => {
      if (!bracketRef.current) return;
      const br = bracketRef.current;
      const bracketRect = br.getBoundingClientRect();
      setSvgSize({ w: br.scrollWidth, h: br.scrollHeight });
      const lines = [];
      for (let ri = 0; ri < allRounds.length - 1; ri++) {
        const rn = allRounds[ri];
        const roundMatches = roundsMap[rn] || [];
        const teamsHere = new Set();
        roundMatches.forEach(m => {
          if (m.team1_id) teamsHere.add(m.team1_id);
          if (m.team2_id) teamsHere.add(m.team2_id);
        });
        for (const tid of teamsHere) {
          const srcMatch = roundMatches.find(m => m.team1_id === tid || m.team2_id === tid);
          const nextMatchId = teamMatchByRound[tid]?.[rn + 1];
          if (!srcMatch || !nextMatchId) continue;
          const srcEl = br.querySelector(`[data-match-id="${srcMatch.id}"]`);
          const tgtEl = br.querySelector(`[data-match-id="${nextMatchId}"]`);
          if (!srcEl || !tgtEl) continue;
          const sRect = srcEl.getBoundingClientRect();
          const tRect = tgtEl.getBoundingClientRect();
          const srcRow = srcEl.querySelector(`[data-team-row="${tid}"]`);
          const tgtRow = tgtEl.querySelector(`[data-team-row="${tid}"]`);
          const sr = srcRow ? srcRow.getBoundingClientRect() : sRect;
          const tr = tgtRow ? tgtRow.getBoundingClientRect() : tRect;
          let kind = 'pending';
          if (srcMatch.status === 'reported') {
            kind = (!srcMatch.team2_id || srcMatch.winner_id === tid) ? 'win' : 'lose';
          }
          const x1 = sRect.right - bracketRect.left;
          const y1 = sr.top + sr.height / 2 - bracketRect.top;
          const x2 = tRect.left - bracketRect.left;
          const y2 = tr.top + tr.height / 2 - bracketRect.top;
          const dx = x2 - x1;
          lines.push({
            path: `M ${x1} ${y1} C ${x1 + dx * 0.55} ${y1}, ${x2 - dx * 0.55} ${y2}, ${x2} ${y2}`,
            kind, tid, x1, y1, x2, y2,
          });
        }
      }
      setConnectors(lines);
    };
    requestAnimationFrame(() => requestAnimationFrame(compute));
    const ro = new ResizeObserver(compute);
    if (bracketRef.current) ro.observe(bracketRef.current);
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [open, allRounds, roundsMap, teamMatchByRound]);

  if (teams.length === 0) return null;

  const orderedConnectors = [...connectors].sort((a, b) =>
    ({ pending: 0, lose: 1, win: 2 }[a.kind] - { pending: 0, lose: 1, win: 2 }[b.kind])
  );

  return (
    <div style={{ marginBottom: '10px' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ ...btn(false), padding: '7px 12px', fontSize: '12px', width: '100%', justifyContent: 'space-between' }}>
        <span>🏟️ Swiss-turneringsplan</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div style={{ marginTop: '12px' }}>
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '12px' }}>
            {[['win', 'Vinder', '#16A34A', false], ['lose', 'Taber', '#EF4444', false], ['pending', 'Afventer', '#CBD5E1', true]].map(([kind, label, color, dashed]) => (
              <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: theme.textMid }}>
                <svg width="18" height="8" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2"
                    strokeDasharray={dashed ? '4 5' : undefined} strokeLinecap="round" />
                </svg>
                {label}
              </div>
            ))}
          </div>

          {/* Team hover-highlight chips */}
          {teams.length > 1 && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Hold:</span>
              {teams.map(t => (
                <span key={t.id}
                  onMouseEnter={() => setHighlightTeam(t.id)}
                  onMouseLeave={() => setHighlightTeam(null)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px 4px 4px', borderRadius: '999px',
                    border: '1px solid ' + (highlightTeam === t.id ? theme.accent : theme.border),
                    background: highlightTeam === t.id ? theme.accentBg : theme.surfaceAlt,
                    color: highlightTeam === t.id ? theme.accent : theme.text,
                    fontSize: '12px', fontWeight: 500, cursor: 'default', transition: 'all .15s',
                  }}
                >
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: teamColors[t.id], display: 'inline-grid', placeItems: 'center', fontSize: '8px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {t.name.slice(0, 1).toUpperCase()}
                  </span>
                  {t.name}
                </span>
              ))}
            </div>
          )}

          {/* Bracket */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ background: theme.surface, borderRadius: '14px', border: '1px solid ' + theme.border, padding: '20px 20px 24px', boxShadow: theme.shadow }}>
              <div
                ref={bracketRef}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${allRounds.length}, minmax(200px, 1fr))`,
                  gap: '24px',
                  position: 'relative',
                  minWidth: Math.max(allRounds.length * 200 + (allRounds.length - 1) * 24, 400) + 'px',
                }}
              >
                {/* SVG connector overlay */}
                <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }} width={svgSize.w} height={svgSize.h}>
                  {orderedConnectors.map((c, i) => {
                    const dim = highlightTeam && c.tid !== highlightTeam;
                    const isHi = highlightTeam === c.tid;
                    const stroke = c.kind === 'win' ? '#16A34A' : c.kind === 'lose' ? '#EF4444' : '#CBD5E1';
                    return (
                      <g key={i} style={{ opacity: dim ? 0.1 : 1 }}>
                        <path d={c.path} fill="none" stroke={stroke} strokeWidth={isHi ? 3 : 2}
                          strokeLinecap="round" strokeDasharray={c.kind === 'pending' ? '4 5' : undefined} />
                        <circle cx={c.x1} cy={c.y1} r="3.5" fill="white" stroke={stroke} strokeWidth="2" />
                        <circle cx={c.x2} cy={c.y2} r="3.5" fill="white" stroke={stroke} strokeWidth="2" />
                      </g>
                    );
                  })}
                </svg>

                {/* Round columns */}
                {allRounds.map(rn => {
                  const roundMatches = roundsMap[rn] || [];
                  const isCurrent = rn === currentRound;
                  const isDone = roundMatches.length > 0 && roundMatches.every(m => m.status === 'reported');
                  const isFuture = rn > (currentRound || 0);
                  const prevStats = statsAfterRound[rn - 1] || {};

                  return (
                    <div key={rn} style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}>
                      {/* Round header */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '10px',
                        background: isDone ? theme.accentBg : theme.surfaceAlt,
                        border: '1px solid ' + (isDone ? 'transparent' : theme.border),
                        marginBottom: '6px',
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isDone ? theme.accent : isCurrent ? theme.textMid : theme.textLight }}>
                          Runde {rn}{totalRounds ? ` / ${totalRounds}` : ''}
                        </span>
                        <span style={{ fontSize: '11px', color: isDone ? theme.accent : theme.textLight }}>
                          {isDone ? '✓ Afsluttet' : isCurrent ? '● Aktiv' : 'Kommende'}
                        </span>
                      </div>

                      {isFuture ? (
                        <div style={{ border: '2px dashed ' + theme.border, borderRadius: '12px', padding: '20px 12px', textAlign: 'center', color: theme.textLight, fontSize: '11px' }}>
                          Genereres efter<br />runde {rn - 1}
                        </div>
                      ) : roundMatches.length === 0 ? (
                        <div style={{ border: '1px solid ' + theme.border, borderRadius: '12px', padding: '20px', textAlign: 'center', color: theme.textLight, fontSize: '11px' }}>
                          Ingen kampe
                        </div>
                      ) : roundMatches.map(match => {
                        const t1 = teamMap[match.team1_id];
                        const t2 = match.team2_id ? teamMap[match.team2_id] : null;
                        const reported = match.status === 'reported';
                        const isMyMatch = myTeam && (match.team1_id === myTeam?.id || match.team2_id === myTeam?.id);
                        const t1Stats = prevStats[match.team1_id] || { wins: 0, losses: 0 };
                        const t2Stats = t2 ? (prevStats[match.team2_id] || { wins: 0, losses: 0 }) : null;
                        const t1Wins = reported && (match.winner_id === match.team1_id || !match.team2_id);
                        const t2Wins = reported && !!t2 && match.winner_id === match.team2_id;

                        // Resolve per-team scores from score_text
                        let t1Score = '—', t2Score = '—';
                        if (reported && match.score_text) {
                          const sp = match.score_text.match(/^(\d+)-(\d+)$/);
                          if (sp) {
                            const ws = Math.max(+sp[1], +sp[2]);
                            const ls = Math.min(+sp[1], +sp[2]);
                            t1Score = String(t1Wins ? ws : ls);
                            t2Score = String(t2Wins ? ws : ls);
                          }
                        }

                        const recStyle = (isWin, isLose) => ({
                          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                          fontSize: '10px', fontWeight: 600,
                          padding: '3px 6px', borderRadius: '5px',
                          background: isWin ? theme.greenBg : isLose ? theme.redBg : theme.surfaceAlt,
                          color: isWin ? theme.green : isLose ? theme.red : theme.textLight,
                          minWidth: '44px', textAlign: 'center', flexShrink: 0, display: 'inline-block',
                        });

                        const dotStyle = (teamId) => ({
                          width: 14, height: 14, borderRadius: '50%',
                          background: teamColors[teamId] || '#94A3B8',
                          display: 'inline-grid', placeItems: 'center',
                          fontSize: '8px', fontWeight: 700, color: 'white', flexShrink: 0,
                        });

                        return (
                          <div key={match.id} data-match-id={match.id}
                            onClick={() => setSelectedMatch({ match, rn, prevStats })}
                            style={{
                              background: theme.surface,
                              border: '1px solid ' + (isMyMatch ? theme.accent + '60' : theme.border),
                              borderRadius: '12px', padding: '10px 12px',
                              display: 'grid', gap: '6px', cursor: 'pointer',
                              boxShadow: isMyMatch ? '0 0 0 3px ' + theme.accentBg : '0 1px 2px rgba(0,0,0,0.04)',
                              transition: 'border-color .18s, box-shadow .18s, transform .18s',
                            }}
                          >
                            {!t2 ? (
                              <>
                                <div data-team-row={match.team1_id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: '8px', padding: '4px 2px' }}>
                                  <span style={recStyle(reported, false)}>{t1Stats.wins}W-{t1Stats.losses}L</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: theme.text, overflow: 'hidden' }}>
                                    <span style={dotStyle(t1.id)}>{t1.name.slice(0, 1).toUpperCase()}</span>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t1.name}</span>
                                  </span>
                                </div>
                                <div style={{ height: '1px', background: theme.border, margin: '0 2px' }} />
                                <div style={{ textAlign: 'center', fontSize: '11px', color: theme.textLight, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 0' }}>Fri runde</div>
                              </>
                            ) : (
                              <>
                                <div data-team-row={match.team1_id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '8px', padding: '4px 2px' }}>
                                  <span style={recStyle(t1Wins, reported && !t1Wins)}>{t1Stats.wins}W-{t1Stats.losses}L</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: t1Wins ? 600 : 500, color: theme.text, overflow: 'hidden' }}>
                                    <span style={dotStyle(t1.id)}>{t1.name.slice(0, 1).toUpperCase()}</span>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t1.name}</span>
                                  </span>
                                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '15px', fontWeight: 600, color: theme.text, minWidth: '20px', textAlign: 'right' }}>{t1Score}</span>
                                </div>
                                <div style={{ height: '1px', background: theme.border, margin: '0 2px' }} />
                                <div data-team-row={match.team2_id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '8px', padding: '4px 2px' }}>
                                  <span style={recStyle(t2Wins, reported && !t2Wins)}>{t2Stats.wins}W-{t2Stats.losses}L</span>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: t2Wins ? 600 : 500, color: theme.text, overflow: 'hidden' }}>
                                    <span style={dotStyle(t2.id)}>{t2.name.slice(0, 1).toUpperCase()}</span>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t2.name}</span>
                                  </span>
                                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '15px', fontWeight: 600, color: theme.text, minWidth: '20px', textAlign: 'right' }}>{t2Score}</span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match detail modal */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch.match}
          rn={selectedMatch.rn}
          teamMap={teamMap}
          teamColors={teamColors}
          prevStats={selectedMatch.prevStats}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
}

function PartnerSearch({ userId, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, name, avatar, elo_rating')
        .or(`full_name.ilike.%${query}%,name.ilike.%${query}%`)
        .neq('id', userId)
        .limit(6);
      setResults(data || []);
      setOpen(true);
    }, 280);
    return () => clearTimeout(t);
  }, [query, userId]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: theme.textLight, pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); }}
          placeholder="Søg efter makker..."
          style={{ ...inputStyle, paddingLeft: '32px' }}
        />
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: theme.surface, border: '1px solid ' + theme.border, borderRadius: '8px', boxShadow: theme.shadow, zIndex: 100, marginTop: '4px' }}>
          {results.map(p => {
            const name = p.full_name || p.name || 'Spiller';
            return (
              <div
                key={p.id}
                onClick={() => { onSelect(p); setQuery(name); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid ' + theme.border + '80' }}
              >
                <AvatarCircle avatar={p.avatar} size={30} emojiSize="14px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: '11px', color: theme.textLight }}>ELO {Math.round(Number(p.elo_rating) || 1000)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LigaTab({ user, showToast, createOpen: createOpenProp, onCreateOpenChange }) {
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [view, setView] = useState('registration');
  const [scope, setScope] = useState('alle');
  const [search, setSearch] = useState('');
  const [viewPlayer, setViewPlayer] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [teamsByLeague, setTeamsByLeague] = useState({});
  const [allTeamsByLeague, setAllTeamsByLeague] = useState({});
  const [matchesByLeague, setMatchesByLeague] = useState({});
  const [myTeamByLeague, setMyTeamByLeague] = useState({});
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [openStandings, setOpenStandings] = useState(new Set());

  // Create league form (admin) — controlled by parent if props provided
  const [createOpenLocal, setCreateOpenLocal] = useState(false);
  const createOpen = createOpenProp !== undefined ? createOpenProp : createOpenLocal;
  const setCreateOpen = onCreateOpenChange !== undefined ? onCreateOpenChange : setCreateOpenLocal;
  const [createForm, setCreateForm] = useState({ name: '', description: '', season_type: 'monthly', start_date: '', end_date: '', max_teams: '' });

  // Create team form
  const [teamFormLeagueId, setTeamFormLeagueId] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [selectedPartner, setSelectedPartner] = useState(null);

  // Report result
  const [reportingMatch, setReportingMatch] = useState(null);
  const [scoreText, setScoreText] = useState('');
  const [selectedWinnerId, setSelectedWinnerId] = useState(null);
  const [confirmPending, setConfirmPending] = useState(null); // { match, winnerId }

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [lgRes, teamsRes] = await Promise.all([
        supabase.from('leagues').select('*').order('created_at', { ascending: false }),
        supabase.from('league_teams').select('*').or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`),
      ]);
      const lgList = lgRes.data || [];
      setLeagues(lgList);

      const myTeams = teamsRes.data || [];
      // Invitationer: hold hvor jeg er player2 og status = pending
      setPendingInvites(myTeams.filter(t => t.player2_id === user.id && t.status === 'pending'));
      const myTeamMap = {};
      for (const t of myTeams) {
        // Mit hold i en liga: kun ready, eller pending hvis jeg selv oprettede det
        if (t.status === 'ready' || t.player1_id === user.id) myTeamMap[t.league_id] = t;
      }
      setMyTeamByLeague(myTeamMap);

      if (lgList.length === 0) return;
      const ids = lgList.map(l => l.id);
      const [allTeamsRes, matchRes] = await Promise.all([
        supabase.from('league_teams').select('*').in('league_id', ids),
        supabase.from('league_matches').select('*').in('league_id', ids),
      ]);
      const tMap = {};
      const allMap = {};
      for (const t of (allTeamsRes.data || [])) {
        if (!allMap[t.league_id]) allMap[t.league_id] = [];
        allMap[t.league_id].push(t);
        if (t.status !== 'ready') continue;
        if (!tMap[t.league_id]) tMap[t.league_id] = [];
        tMap[t.league_id].push(t);
      }
      setTeamsByLeague(tMap);
      setAllTeamsByLeague(allMap);
      const mMap = {};
      for (const m of (matchRes.data || [])) {
        if (!mMap[m.league_id]) mMap[m.league_id] = [];
        mMap[m.league_id].push(m);
      }
      setMatchesByLeague(mMap);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const openProfile = (id, name, avatar) => setViewPlayer({ id, full_name: name, avatar });

  const createTeam = async (leagueId) => {
    if (!teamName.trim()) { showToast('Angiv et holdnavn.'); return; }
    if (!selectedPartner) { showToast('Vælg en makker.'); return; }
    setBusyId(leagueId + '-team');
    try {
      const myElo = Math.round(Number(user.elo_rating) || 1000);
      const partnerElo = Math.round(Number(selectedPartner.elo_rating) || 1000);
      const { error } = await supabase.from('league_teams').insert({
        league_id: leagueId,
        name: teamName.trim(),
        player1_id: user.id,
        player2_id: selectedPartner.id,
        player1_name: user.full_name || user.name || 'Spiller',
        player2_name: selectedPartner.full_name || selectedPartner.name || 'Spiller',
        player1_avatar: user.avatar || '🎾',
        player2_avatar: selectedPartner.avatar || '🎾',
        elo_combined: myElo + partnerElo,
        status: 'pending',
      });
      if (error) throw error;
      const leagueName = leagues.find(l => l.id === leagueId)?.name || 'ligaen';
      await supabase.rpc('notify_league_invite', {
        p_user_id: selectedPartner.id,
        p_title: 'Holdinvitation 🎾',
        p_body: `${user.full_name || user.name || 'En spiller'} inviterer dig til holdet "${teamName.trim()}" i ${leagueName}`,
      });
      showToast('Hold tilmeldt — invitation sendt til ' + (selectedPartner.full_name || selectedPartner.name) + '!');
      setTeamFormLeagueId(null);
      setTeamName('');
      setSelectedPartner(null);
      await load();
    } catch (e) {
      showToast(e.message.includes('unique') ? 'En af spillerne er allerede tilmeldt denne liga.' : 'Fejl: ' + e.message);
    } finally { setBusyId(null); }
  };

  const acceptInvite = async (team) => {
    setBusyId(team.id + '-accept');
    try {
      const { error } = await supabase.from('league_teams').update({ status: 'ready' }).eq('id', team.id);
      if (error) throw error;
      // Notify inviter (player1) via SECURITY DEFINER RPC
      supabase.rpc('notify_league_invite_accepted', {
        p_team_id: team.id,
        p_title: 'Invitation accepteret! 🎾',
        p_body: `${user.full_name || user.name || 'Din makker'} har accepteret invitationen til holdet "${team.name}".`,
      }).then(({ error: nErr }) => {
        if (nErr) console.warn('notify_league_invite_accepted:', nErr.message || nErr);
      });
      showToast('Du har accepteret invitationen! 🎾');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const declineInvite = async (team) => {
    if (!window.confirm(`Afvis invitation til holdet "${team.name}"?`)) return;
    setBusyId(team.id + '-decline');
    try {
      const { error } = await supabase.from('league_teams').delete().eq('id', team.id);
      if (error) throw error;
      showToast('Invitation afvist.');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const leaveLeague = async (leagueId) => {
    const myTeam = myTeamByLeague[leagueId];
    if (!myTeam) return;
    if (!window.confirm('Afmeld dit hold fra ligaen?')) return;
    setBusyId(leagueId + '-leave');
    try {
      const { error } = await supabase.from('league_teams').delete().eq('id', myTeam.id);
      if (error) throw error;
      showToast('Hold afmeldt.');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const kickTeam = async (team) => {
    if (!window.confirm(`Smid "${team.name}" ud af ligaen?`)) return;
    setBusyId(team.id + '-kick');
    try {
      const { error } = await supabase.from('league_teams').delete().eq('id', team.id);
      if (error) throw error;
      showToast('Hold fjernet fra ligaen.');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const cancelReporting = () => {
    setReportingMatch(null); setScoreText(''); setSelectedWinnerId(null); setConfirmPending(null);
  };

  const reportResult = async (match, winnerId, score) => {
    setBusyId(match.id);
    try {
      const { error } = await supabase.from('league_matches').update({
        winner_id: winnerId,
        score_text: score || null,
        status: 'reported',
        reported_by: user.id,
      }).eq('id', match.id);
      if (error) throw error;
      showToast('Resultat registreret! 🎾');
      cancelReporting();
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const createLeague = async () => {
    if (!createForm.name.trim() || !createForm.start_date || !createForm.end_date) {
      showToast('Udfyld navn og datoer.'); return;
    }
    setBusyId('create');
    try {
      const maxT = createForm.max_teams !== '' ? parseInt(createForm.max_teams, 10) : null;
      const { error } = await supabase.from('leagues').insert({
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        season_type: createForm.season_type,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        max_teams: maxT && maxT > 0 ? maxT : null,
        created_by: user.id,
      });
      if (error) throw error;
      showToast('Liga oprettet!');
      setCreateOpen(false);
      setCreateForm({ name: '', description: '', season_type: 'monthly', start_date: '', end_date: '', max_teams: '' });
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const startLeague = async (league) => {
    const teams = teamsByLeague[league.id] || [];
    if (teams.length < 2) { showToast('Mindst 2 hold kræves for at starte.'); return; }
    if (!window.confirm(`Start "${league.name}" og generér runde 1?`)) return;
    setBusyId(league.id + '-start');
    try {
      // Use the larger of log2 (Swiss minimum) and teams-1 (full round-robin for small groups)
      const totalRounds = Math.max(
        Math.ceil(Math.log2(Math.max(2, teams.length))),
        teams.length <= 6 ? teams.length - 1 : 0
      );
      const allMatches = matchesByLeague[league.id] || [];
      const standings = computeStandings(teams, allMatches);
      const pairings = generatePairings(standings, allMatches);
      const rows = pairings.map(p => ({
        league_id: league.id, round_number: 1,
        team1_id: p.team1_id, team2_id: p.team2_id || null,
        status: p.team2_id ? 'pending' : 'reported',
        winner_id: p.team2_id ? null : p.team1_id,
      }));
      const { error: mErr } = await supabase.from('league_matches').insert(rows);
      if (mErr) throw mErr;
      const { error: uErr } = await supabase.from('leagues').update({ status: 'active', current_round: 1, total_rounds: totalRounds }).eq('id', league.id);
      if (uErr) throw uErr;
      showToast(`Liga startet — runde 1 af ${totalRounds} genereret!`);
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const nextRound = async (league) => {
    const teams = teamsByLeague[league.id] || [];
    const allMatches = matchesByLeague[league.id] || [];
    const pending = allMatches.filter(m => m.round_number === league.current_round && m.status === 'pending');
    if (pending.length > 0) {
      showToast(`${pending.length} kamp${pending.length > 1 ? 'e' : ''} mangler stadig resultat i runde ${league.current_round}.`);
      return;
    }
    const totalRounds = league.total_rounds;
    if (totalRounds && league.current_round >= totalRounds) {
      if (window.confirm(`Alle ${totalRounds} planlagte runder er spillet! Afslut ligaen nu?`)) {
        await completeLeague(league);
      }
      return;
    }
    const round = league.current_round + 1;

    // Check if any real pairings are possible before generating
    const previewStandings = computeStandings(teams, allMatches);
    const previewPairings = generatePairings(previewStandings, allMatches);
    const hasRealMatches = previewPairings.some(p => p.team2_id !== null);
    if (!hasRealMatches) {
      if (window.confirm('Alle hold har allerede spillet mod hinanden — der er ingen gyldige parringer tilbage.\n\nVil du afslutte ligaen og låse ranglisten?')) {
        await completeLeague(league);
      }
      return;
    }

    if (!window.confirm(`Generér runde ${round}${totalRounds ? ` af ${totalRounds}` : ''}?`)) return;
    setBusyId(league.id + '-next');
    try {
      const standings = computeStandings(teams, allMatches);
      const pairings = generatePairings(standings, allMatches);
      const rows = pairings.map(p => ({
        league_id: league.id, round_number: round,
        team1_id: p.team1_id, team2_id: p.team2_id || null,
        status: p.team2_id ? 'pending' : 'reported',
        winner_id: p.team2_id ? null : p.team1_id,
      }));
      const { error: mErr } = await supabase.from('league_matches').insert(rows);
      if (mErr) throw mErr;
      const { error: uErr } = await supabase.from('leagues').update({ current_round: round }).eq('id', league.id);
      if (uErr) throw uErr;
      showToast(`Runde ${round}${totalRounds ? ` af ${totalRounds}` : ''} genereret!`);
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const completeLeague = async (league) => {
    if (!window.confirm(`Afslut "${league.name}"? Ranglisten låses.`)) return;
    setBusyId(league.id + '-complete');
    try {
      const { error } = await supabase.from('leagues').update({ status: 'completed' }).eq('id', league.id);
      if (error) throw error;
      showToast('Liga afsluttet!');
      await load();
    } catch (e) { showToast('Fejl: ' + e.message); }
    finally { setBusyId(null); }
  };

  const toggleStandings = (id) => setOpenStandings(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const visibleLeagues = leagues.filter(l => {
    if (l.status !== view) return false;
    if (scope === 'mine' && !myTeamByLeague[l.id] && l.created_by !== user.id) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.name?.toLowerCase().includes(q) && !l.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      {viewPlayer && (
        <PlayerProfileModal
          player={viewPlayer}
          onClose={() => setViewPlayer(null)}
          onMessage={() => { setViewPlayer(null); navigate('/dashboard/beskeder?med=' + viewPlayer.id); }}
        />
      )}

      {/* Scope selector: Mine / Alle */}
      <div style={{ display: 'flex', marginBottom: '12px', borderRadius: '8px', overflow: 'hidden', border: '1px solid ' + theme.border }}>
        {[
          { id: 'alle', label: 'Alle ligaer' },
          { id: 'mine', label: 'Mine ligaer' },
        ].map(t => (
          <button key={t.id} onClick={() => { setScope(t.id); setSearch(''); }} style={{
            flex: 1, padding: '10px 16px', fontSize: '13px',
            fontWeight: scope === t.id ? 700 : 500,
            background: scope === t.id ? theme.accent : theme.surface,
            color: scope === t.id ? '#fff' : theme.textMid,
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.textLight }} />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Søg liga…"
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid ' + theme.border, fontSize: '13px', fontFamily: 'inherit', background: theme.surface, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Admin: opret-formular */}
      {isAdmin && createOpen && (
        <div style={{ background: theme.surface, borderRadius: theme.radius, padding: '20px', border: '1px solid ' + theme.border, boxShadow: theme.shadow, marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '14px' }}>Ny liga</div>
          <label style={labelStyle}>Navn</label>
          <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="F.eks. Forårssæson 2026" style={{ ...inputStyle, marginBottom: '10px' }} />
          <label style={labelStyle}>Beskrivelse <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfri)</span></label>
          <input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Kort beskrivelse..." style={{ ...inputStyle, marginBottom: '10px' }} />
          <label style={labelStyle}>Type</label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            {['weekly', 'monthly'].map(t => (
              <button key={t} onClick={() => setCreateForm(f => ({ ...f, season_type: t }))} style={{ ...btn(createForm.season_type === t), padding: '6px 14px', fontSize: '12px' }}>
                {SEASON_LABELS[t]}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={labelStyle}>Startdato</label>
              <input type="date" value={createForm.start_date} onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Slutdato</label>
              <input type="date" value={createForm.end_date} onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <label style={labelStyle}>Maks antal hold <span style={{ fontWeight: 400, color: theme.textLight }}>(valgfri)</span></label>
          <input
            type="number"
            min="2"
            value={createForm.max_teams}
            onChange={e => setCreateForm(f => ({ ...f, max_teams: e.target.value }))}
            placeholder="Ubegrænset"
            style={{ ...inputStyle, marginBottom: '14px', width: '140px' }}
          />
          <div style={{ marginBottom: '14px' }}>
            <SwissRulesBox />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createLeague} disabled={busyId === 'create'} style={{ ...btn(true), fontSize: '13px' }}>
              {busyId === 'create' ? 'Opretter…' : 'Opret liga'}
            </button>
            <button onClick={() => setCreateOpen(false)} style={{ ...btn(false), fontSize: '13px' }}>Annullér</button>
          </div>
        </div>
      )}

      {/* Ventende invitationer */}
      {pendingInvites.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {pendingInvites.map(invite => {
            const league = leagues.find(l => l.id === invite.league_id);
            const busy = busyId === invite.id + '-accept' || busyId === invite.id + '-decline';
            return (
              <div key={invite.id} style={{ background: theme.warmBg, borderRadius: theme.radius, padding: '14px 16px', border: '1px solid ' + theme.warm, marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: theme.warm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  ⚡ Holdinvitation
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>{invite.name}</div>
                <div style={{ fontSize: '12px', color: theme.textMid, marginBottom: '10px' }}>
                  {invite.player1_name} inviterer dig med i {league?.name || 'en liga'}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => acceptInvite(invite)} disabled={busy}
                    style={{ ...btn(true), padding: '7px 14px', fontSize: '13px', background: '#16A34A', borderColor: '#16A34A' }}>
                    {busyId === invite.id + '-accept' ? 'Accepterer…' : '✓ Acceptér'}
                  </button>
                  <button onClick={() => declineInvite(invite)} disabled={busy}
                    style={{ ...btn(false), padding: '7px 14px', fontSize: '13px', color: '#DC2626', borderColor: '#FCA5A5' }}>
                    Afvis
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { id: 'registration', label: 'Tilmelding' },
          { id: 'active',       label: 'Aktiv sæson' },
          { id: 'completed',    label: 'Afsluttede' },
        ].map(v => {
          const count = leagues.filter(l => l.status === v.id).length;
          return (
            <button key={v.id} onClick={() => setView(v.id)} style={{ ...btn(view === v.id), padding: '7px 14px', fontSize: '12px' }}>
              {v.label}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: theme.textLight, fontSize: '14px' }}>Indlæser…</div>
      ) : visibleLeagues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 20px', color: theme.textLight }}>
          <Trophy size={44} color={theme.border} style={{ display: 'block', margin: '0 auto 14px' }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: theme.text, marginBottom: '6px' }}>
            {view === 'registration' ? 'Ingen åbne ligaer' : view === 'active' ? 'Ingen aktive ligaer' : 'Ingen afsluttede ligaer'}
          </div>
          {isAdmin && view === 'registration' ? (
            <div style={{ fontSize: '13px', color: theme.textLight }}>Opret en ny liga via knappen ovenfor.</div>
          ) : !isAdmin && view === 'registration' ? (
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '13px', color: theme.textMid, marginBottom: '14px', lineHeight: 1.5 }}>
                Der er ingen åbne ligaer i øjeblikket.<br />
                Kontakt en admin for at få oprettet en ny liga.
              </div>
              <button
                onClick={async () => {
                  const { data } = await supabase.from('profiles').select('id').eq('role', 'admin').ilike('full_name', '%Mike Pedersen%').maybeSingle();
                  if (data?.id) navigate('/dashboard/beskeder?med=' + data.id);
                  else showToast('Ingen admin fundet.');
                }}
                style={{ ...btn(true), fontSize: '13px', display: 'inline-flex' }}
              >
                💬 Kontakt admin
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visibleLeagues.map(league => {
            const teams = teamsByLeague[league.id] || [];
            const matches = matchesByLeague[league.id] || [];
            const myTeam = myTeamByLeague[league.id];
            const joined = !!myTeam;
            const standings = computeStandings(teams, matches);
            const standingsOpen = openStandings.has(league.id);
            const sc = STATUS_COLORS[league.status] || {};
            const busy = busyId === league.id || (typeof busyId === 'string' && busyId.startsWith(league.id + '-'));

            const currentRoundMatches = matches.filter(m => m.round_number === league.current_round);
            const myMatch = myTeam ? currentRoundMatches.find(m => m.team1_id === myTeam.id || m.team2_id === myTeam.id) : null;
            const opponentTeamId = myMatch ? (myMatch.team1_id === myTeam?.id ? myMatch.team2_id : myMatch.team1_id) : null;
            const opponentTeam = opponentTeamId ? teams.find(t => t.id === opponentTeamId) : null;

            const showTeamForm = teamFormLeagueId === league.id;
            const isCreator = league.created_by === user.id;
            const canManageTeams = isAdmin || isCreator;
            const regTeamCount = (allTeamsByLeague[league.id] || []).length;
            const isFull = league.max_teams && regTeamCount >= league.max_teams;

            return (
              <div key={league.id} style={{ background: theme.surface, borderRadius: theme.radius, padding: '18px', border: '1px solid ' + theme.border, boxShadow: theme.shadow }}>

                {/* Winner banner for completed leagues */}
                {league.status === 'completed' && standings.length > 0 && (() => {
                  const w = standings[0];
                  return (
                    <div style={{ marginBottom: '14px', padding: '14px 16px', background: theme.warmBg, borderRadius: '10px', border: '1.5px solid ' + theme.warm, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '28px', lineHeight: 1 }}>🏆</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: theme.warm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Vinder</div>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                          <span onClick={() => openProfile(w.player1_id, w.player1_name, w.player1_avatar)} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '11px', color: theme.text }}>
                            <AvatarCircle avatar={w.player1_avatar} size={20} emojiSize="10px" style={{ background: theme.surfaceAlt, border: '1px solid ' + theme.border }} />
                            {w.player1_name}
                          </span>
                          <span style={{ color: theme.textMid, fontSize: '10px' }}>+</span>
                          <span onClick={() => openProfile(w.player2_id, w.player2_name, w.player2_avatar)} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '11px', color: theme.text }}>
                            <AvatarCircle avatar={w.player2_avatar} size={20} emojiSize="10px" style={{ background: theme.surfaceAlt, border: '1px solid ' + theme.border }} />
                            {w.player2_name}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: theme.warm }}>{w.points}</div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: theme.warm }}>point</div>
                        <div style={{ fontSize: '10px', color: theme.textMid, marginTop: '2px' }}>{w.wins}W · {w.losses}L</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>{league.name}</div>
                    <div style={{ fontSize: '12px', color: theme.textLight }}>
                      {SEASON_LABELS[league.season_type]} · {formatMatchDateDa(league.start_date)} – {formatMatchDateDa(league.end_date)}
                      {league.status === 'active' && <span style={{ color: theme.accent, fontWeight: 700 }}> · Runde {league.current_round}{league.total_rounds ? ` af ${league.total_rounds}` : ''}</span>}
                    </div>
                    {league.description && (
                      <div style={{ fontSize: '12px', color: theme.textMid, marginTop: '4px', fontStyle: 'italic' }}>{league.description}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: sc.bg, color: sc.color }}>
                      {STATUS_LABELS[league.status]}
                    </span>
                    <span style={tag(theme.blueBg, theme.blue)}>
                      <Users size={10} /> {(allTeamsByLeague[league.id] || []).length}{league.max_teams ? `/${league.max_teams}` : ''} hold
                    </span>
                  </div>
                </div>

                {/* Swiss-regler — sammenklappelig */}
                <div style={{ marginBottom: '12px' }}>
                  <SwissRulesBox collapsible />
                </div>

                {/* Tilmelding */}
                {league.status === 'registration' && (
                  <div style={{ marginBottom: '12px' }}>
                    {joined ? (
                      <div style={{ background: myTeam.status === 'pending' ? theme.warmBg : theme.greenBg, borderRadius: '10px', padding: '12px 14px', border: '1px solid ' + (myTeam.status === 'pending' ? theme.warm : theme.green), display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: myTeam.status === 'pending' ? theme.warm : theme.green, marginBottom: '4px' }}>
                            {myTeam.status === 'pending' ? '⏳ Afventer godkendelse' : '✓'} {myTeam.name}
                          </div>
                          <div style={{ fontSize: '12px', color: theme.textMid, display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <AvatarCircle avatar={myTeam.player1_avatar} size={20} emojiSize="10px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border }} />
                            {myTeam.player1_name}
                            <span style={{ color: theme.textLight }}>+</span>
                            <AvatarCircle avatar={myTeam.player2_avatar} size={20} emojiSize="10px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border }} />
                            {myTeam.player2_name}
                            {myTeam.status === 'pending' && <span style={{ color: '#92400E', fontSize: '11px' }}>(venter på {myTeam.player2_name})</span>}
                          </div>
                        </div>
                        <button onClick={() => leaveLeague(league.id)} disabled={busy} style={{ ...btn(false), padding: '6px 12px', fontSize: '12px' }}>Afmeld hold</button>
                      </div>
                    ) : showTeamForm ? (
                      <div style={{ background: theme.surfaceAlt, borderRadius: '10px', padding: '14px', border: '1px solid ' + theme.border }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Tilmeld hold</div>
                        <label style={labelStyle}>Holdnavn</label>
                        <input
                          value={teamName}
                          onChange={e => setTeamName(e.target.value)}
                          placeholder="F.eks. Smash Bros"
                          style={{ ...inputStyle, marginBottom: '10px' }}
                        />
                        <label style={labelStyle}>Din makker</label>
                        <PartnerSearch userId={user.id} onSelect={setSelectedPartner} />
                        {selectedPartner && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px 10px', background: theme.accentBg, borderRadius: '8px' }}>
                            <AvatarCircle avatar={selectedPartner.avatar} size={24} emojiSize="12px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedPartner.full_name || selectedPartner.name}</span>
                            <span style={{ fontSize: '11px', color: theme.textLight }}>ELO {Math.round(Number(selectedPartner.elo_rating) || 1000)}</span>
                            <button onClick={() => setSelectedPartner(null)} style={{ ...btn(false), padding: '2px 8px', fontSize: '11px', marginLeft: 'auto' }}>×</button>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                          <button onClick={() => createTeam(league.id)} disabled={busyId === league.id + '-team'} style={{ ...btn(true), fontSize: '13px' }}>
                            {busyId === league.id + '-team' ? 'Tilmelder…' : 'Tilmeld hold'}
                          </button>
                          <button onClick={() => { setTeamFormLeagueId(null); setTeamName(''); setSelectedPartner(null); }} style={{ ...btn(false), fontSize: '13px' }}>Annullér</button>
                        </div>
                      </div>
                    ) : isFull ? (
                      <div style={{ fontSize: '13px', color: theme.textMid, padding: '8px 0' }}>
                        Ligaen er fuld ({league.max_teams}/{league.max_teams} hold).
                      </div>
                    ) : (
                      <button onClick={() => setTeamFormLeagueId(league.id)} style={{ ...btn(true), padding: '8px 16px', fontSize: '13px' }}>
                        <Plus size={14} /> Tilmeld hold
                      </button>
                    )}
                  </div>
                )}

                {/* Tilmeldte hold under tilmeldingsfasen */}
                {league.status === 'registration' && (() => {
                  const regTeams = allTeamsByLeague[league.id] || [];
                  if (regTeams.length === 0) return null;
                  return (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textMid, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                        Tilmeldte hold ({regTeams.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {regTeams.map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: t.status === 'pending' ? theme.warmBg : theme.greenBg, border: '1px solid ' + (t.status === 'pending' ? theme.warm : theme.green) }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                              <div style={{ fontSize: '11px', color: theme.text, display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px', flexWrap: 'wrap' }}>
                                <span onClick={() => openProfile(t.player1_id, t.player1_name, t.player1_avatar)} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                  <AvatarCircle avatar={t.player1_avatar} size={18} emojiSize="9px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                                  {t.player1_name}
                                </span>
                                <span style={{ color: theme.textMid }}>+</span>
                                <span onClick={() => openProfile(t.player2_id, t.player2_name, t.player2_avatar)} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                  <AvatarCircle avatar={t.player2_avatar} size={18} emojiSize="9px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                                  {t.player2_name}
                                </span>
                              </div>
                            </div>
                            {t.status === 'pending' && (
                              <span style={{ fontSize: '10px', fontWeight: 700, color: theme.warm, background: theme.warmBg, padding: '2px 7px', borderRadius: '10px', flexShrink: 0 }}>Afventer</span>
                            )}
                            {canManageTeams && (t.player1_id !== user.id && t.player2_id !== user.id) && (
                              <button
                                onClick={() => kickTeam(t)}
                                disabled={busyId === t.id + '-kick'}
                                style={{ ...btn(false), padding: '3px 9px', fontSize: '11px', color: '#DC2626', borderColor: '#FCA5A5', flexShrink: 0 }}
                              >
                                Fjern
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Min kamp denne runde */}
                {league.status === 'active' && joined && myMatch && (
                  <div style={{ background: theme.accentBg, borderRadius: '10px', padding: '14px', marginBottom: '12px', border: '1px solid ' + theme.accent + '30' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                      Jeres kamp — runde {league.current_round}
                    </div>
                    {myMatch.team2_id === null ? (
                      <div style={{ fontSize: '13px', color: theme.textMid }}>Fri runde — automatisk sejr 🎾</div>
                    ) : myMatch.status === 'reported' ? (
                      <div style={{ fontSize: '13px', color: theme.textMid }}>
                        {myMatch.winner_id === myTeam.id ? '🏆 I vandt' : '😔 I tabte'}
                        {myMatch.score_text && <span style={{ color: theme.textLight }}> · {myMatch.score_text}</span>}
                        {opponentTeam && <span style={{ color: theme.textLight }}> mod {opponentTeam.name}</span>}
                      </div>
                    ) : opponentTeam ? (
                      <div>
                        {/* Vores hold vs modstanderhold */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>{myTeam.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                              <span onClick={() => openProfile(myTeam.player1_id, myTeam.player1_name, myTeam.player1_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                <AvatarCircle avatar={myTeam.player1_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                                <span style={{ fontSize: '10px', color: theme.textMid, fontWeight: 600 }}>{myTeam.player1_name}</span>
                              </span>
                              <span onClick={() => openProfile(myTeam.player2_id, myTeam.player2_name, myTeam.player2_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                <AvatarCircle avatar={myTeam.player2_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                                <span style={{ fontSize: '10px', color: theme.textMid, fontWeight: 600 }}>{myTeam.player2_name}</span>
                              </span>
                            </div>
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 800, color: theme.textLight }}>vs</div>
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>{opponentTeam.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                              <span onClick={() => openProfile(opponentTeam.player1_id, opponentTeam.player1_name, opponentTeam.player1_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                <AvatarCircle avatar={opponentTeam.player1_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                                <span style={{ fontSize: '10px', color: theme.textMid, fontWeight: 600 }}>{opponentTeam.player1_name}</span>
                              </span>
                              <span onClick={() => openProfile(opponentTeam.player2_id, opponentTeam.player2_name, opponentTeam.player2_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                <AvatarCircle avatar={opponentTeam.player2_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                                <span style={{ fontSize: '10px', color: theme.textMid, fontWeight: 600 }}>{opponentTeam.player2_name}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                        {reportingMatch === myMatch.id ? (
                          confirmPending ? (
                            /* Step 2: Confirmation */
                            <div style={{ background: theme.surface, borderRadius: '10px', padding: '16px', border: '2px solid ' + (confirmPending.winnerId === myTeam.id ? theme.green : theme.red) }}>
                              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px', color: theme.text }}>Bekræft resultat</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0', padding: '10px 12px', background: theme.surfaceAlt, borderRadius: '8px' }}>
                                <span style={{ fontSize: '20px' }}>{confirmPending.winnerId === myTeam.id ? '🏆' : '😔'}</span>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: confirmPending.winnerId === myTeam.id ? theme.green : theme.red }}>
                                    {confirmPending.winnerId === myTeam.id ? myTeam.name + ' vandt' : opponentTeam.name + ' vandt'}
                                  </div>
                                  <div style={{ fontSize: '12px', color: theme.textMid, marginTop: '2px' }}>
                                    Score: <strong>{confirmPending.score}</strong>
                                    {' · '}{myTeam.name} vs {opponentTeam.name}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => reportResult(myMatch, confirmPending.winnerId, confirmPending.score)} disabled={busyId === myMatch.id}
                                  style={{ ...btn(true), padding: '9px 16px', fontSize: '13px', background: '#16A34A', borderColor: '#16A34A' }}>
                                  {busyId === myMatch.id ? 'Gemmer…' : '✓ Bekræft'}
                                </button>
                                <button onClick={() => setConfirmPending(null)} style={{ ...btn(false), padding: '8px 14px', fontSize: '13px' }}>
                                  ← Ret
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Step 1: Score + winner selection */
                            <div>
                              {/* Score input */}
                              <div style={{ marginBottom: '14px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Score (påkrævet)</div>
                                <input
                                  value={scoreText}
                                  onChange={e => setScoreText(e.target.value)}
                                  placeholder="F.eks. 6-4"
                                  style={{ ...inputStyle, fontSize: '18px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.08em' }}
                                />
                              </div>

                              {/* Winner selection */}
                              <div style={{ fontSize: '11px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Hvem vandt?</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                                {[
                                  { team: myTeam, label: 'Jeres hold' },
                                  { team: opponentTeam, label: 'Modstanderne' },
                                ].map(({ team, label }) => {
                                  const isSelected = selectedWinnerId === team.id;
                                  return (
                                    <button
                                      key={team.id}
                                      onClick={() => setSelectedWinnerId(team.id)}
                                      style={{ border: '2px solid ' + (isSelected ? theme.green : theme.border), background: isSelected ? theme.greenBg : theme.surface, borderRadius: '10px', padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                                    >
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: isSelected ? theme.green : theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
                                      <div style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? theme.green : theme.text, marginBottom: '8px' }}>{team.name}</div>
                                      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                        {[{ avatar: team.player1_avatar, name: team.player1_name }, { avatar: team.player2_avatar, name: team.player2_name }].map(p => (
                                          <div key={p.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                            <AvatarCircle avatar={p.avatar} size={26} emojiSize="12px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border }} />
                                            <span style={{ fontSize: '10px', color: isSelected ? theme.green : theme.textMid, fontWeight: 600 }}>{p.name.split(' ')[0]}</span>
                                          </div>
                                        ))}
                                      </div>
                                      {isSelected && <div style={{ fontSize: '18px', marginTop: '6px' }}>🏆</div>}
                                    </button>
                                  );
                                })}
                              </div>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => {
                                    const err = validatePadelScore(scoreText);
                                    if (err) { showToast(err); return; }
                                    if (!selectedWinnerId) { showToast('Vælg en vinder.'); return; }
                                    setConfirmPending({ winnerId: selectedWinnerId, score: scoreText.trim() });
                                  }}
                                  style={{ ...btn(true), padding: '9px 18px', fontSize: '13px', opacity: (!scoreText || !selectedWinnerId) ? 0.5 : 1 }}
                                >
                                  Fortsæt →
                                </button>
                                <button onClick={cancelReporting} style={{ ...btn(false), padding: '8px 12px', fontSize: '12px' }}>Annullér</button>
                              </div>
                            </div>
                          )
                        ) : (
                          <button onClick={() => setReportingMatch(myMatch.id)}
                            style={{ ...btn(true), padding: '8px 14px', fontSize: '13px' }}>
                            Indberét resultat
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Rangliste */}
                {(league.status === 'active' || league.status === 'completed') && teams.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <button onClick={() => toggleStandings(league.id)}
                      style={{ ...btn(false), padding: '7px 12px', fontSize: '12px', width: '100%', justifyContent: 'space-between' }}>
                      <span>🏅 Holdrangliste</span>
                      {standingsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {standingsOpen && (
                      <div style={{ marginTop: '8px', border: '1px solid ' + theme.border, borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 44px 36px 36px 44px', background: theme.surfaceAlt, borderBottom: '1px solid ' + theme.border }}>
                          {['#', 'Hold', 'Pts', 'W', 'L', 'Diff'].map(h => (
                            <div key={h} style={{ padding: '7px 8px', fontSize: '10px', fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', textAlign: h === 'Hold' ? 'left' : 'center' }}>{h}</div>
                          ))}
                        </div>
                        {standings.map((t, i) => {
                          const isMyTeam = myTeam?.id === t.id;
                          const diffColor = t.gameDiff > 0 ? '#16A34A' : t.gameDiff < 0 ? '#DC2626' : theme.textLight;
                          return (
                            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 44px 36px 36px 44px', borderTop: i > 0 ? '1px solid ' + theme.border : 'none', background: isMyTeam ? theme.accentBg : 'transparent' }}>
                              <div style={{ padding: '10px 8px', fontSize: '12px', fontWeight: 700, color: i < 3 ? theme.warm : theme.textLight, textAlign: 'center' }}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                              </div>
                              <div style={{ padding: '10px 8px', minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: isMyTeam ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.name}{isMyTeam ? ' (jer)' : ''}
                                </div>
                                <div style={{ fontSize: '11px', color: theme.text, display: 'flex', gap: '4px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                                  <span onClick={() => openProfile(t.player1_id, t.player1_name, t.player1_avatar)} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                                    <AvatarCircle avatar={t.player1_avatar} size={14} emojiSize="7px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                                    {t.player1_name}
                                  </span>
                                  <span style={{ color: theme.textMid }}>+</span>
                                  <span onClick={() => openProfile(t.player2_id, t.player2_name, t.player2_avatar)} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                                    <AvatarCircle avatar={t.player2_avatar} size={14} emojiSize="7px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                                    {t.player2_name}
                                  </span>
                                </div>
                              </div>
                              <div style={{ padding: '10px 4px', fontSize: '13px', fontWeight: 700, color: theme.accent, textAlign: 'center' }}>{t.points}</div>
                              <div style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, color: '#16A34A', textAlign: 'center' }}>{t.wins}</div>
                              <div style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, color: '#DC2626', textAlign: 'center' }}>{t.losses}</div>
                              <div style={{ padding: '10px 4px', fontSize: '12px', fontWeight: 600, color: diffColor, textAlign: 'center' }}>{t.gameDiff > 0 ? '+' : ''}{t.gameDiff}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Turneringsplan */}
                {(league.status === 'active' || league.status === 'completed') && (
                  <SwissBracket
                    teams={teams}
                    matches={matches}
                    currentRound={league.current_round}
                    totalRounds={league.total_rounds}
                    myTeam={myTeam}
                  />
                )}

                {/* Admin-panel */}
                {isAdmin && (
                  <div style={{ borderTop: '1px solid ' + theme.border, paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {league.status === 'registration' && (
                      <button onClick={() => startLeague(league)} disabled={busy}
                        style={{ ...btn(true), padding: '7px 12px', fontSize: '12px', background: '#D97706', borderColor: '#D97706' }}>
                        <Play size={13} /> Start liga
                      </button>
                    )}
                    {league.status === 'active' && (() => {
                      const pendingCount = (matchesByLeague[league.id] || []).filter(m => m.round_number === league.current_round && m.status === 'pending').length;
                      return (
                        <>
                          <button onClick={() => nextRound(league)} disabled={busy || pendingCount > 0}
                            title={pendingCount > 0 ? `${pendingCount} kamp${pendingCount > 1 ? 'e' : ''} mangler resultat` : ''}
                            style={{ ...btn(true), padding: '7px 12px', fontSize: '12px', background: pendingCount > 0 ? '#9CA3AF' : '#D97706', borderColor: pendingCount > 0 ? '#9CA3AF' : '#D97706', opacity: pendingCount > 0 ? 0.7 : 1 }}>
                            ⏭ Næste runde{pendingCount > 0 ? ` (${pendingCount} afventer)` : ''}
                          </button>
                          <button onClick={() => completeLeague(league)} disabled={busy}
                            style={{ ...btn(false), padding: '7px 12px', fontSize: '12px' }}>
                            Afslut liga
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
