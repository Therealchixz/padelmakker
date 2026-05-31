import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { theme, btn } from '../lib/platformTheme';
import { AppModal } from '../components/AppModal';

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
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: teamColors[teamId] || theme.textLight,
          display: 'inline-grid',
          placeItems: 'center',
          fontSize: '10px',
          fontWeight: 700,
          color: theme.onAccent,
          flexShrink: 0,
        }}
      >
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
  const t2Stats = match.team2_id ? prevStats[match.team2_id] || { wins: 0, losses: 0 } : null;
  const t1Wins = reported && (match.winner_id === match.team1_id || !match.team2_id);
  const t2Wins = reported && !!t2 && match.winner_id === match.team2_id;

  let t1Score = '—';
  let t2Score = '—';
  if (reported && match.score_text) {
    const sp = match.score_text.match(/^(\d+)-(\d+)$/);
    if (sp) {
      const ws = Math.max(+sp[1], +sp[2]);
      const ls = Math.min(+sp[1], +sp[2]);
      t1Score = String(t1Wins ? ws : ls);
      t2Score = String(t2Wins ? ws : ls);
    }
  }

  const winner = t1Wins ? t1 : t2Wins ? t2 : null;
  const statusLabel = !t2 ? 'Fri runde' : !reported ? 'Planlagt' : 'Afsluttet';
  const resultLabel = !t2
    ? `${t1?.name} — fri runde (automatisk sejr)`
    : !reported
      ? '—'
      : `${winner?.name} vinder ${Math.max(+t1Score || 0, +t2Score || 0)}–${Math.min(+t1Score || 0, +t2Score || 0)}`;

  return (
    <AppModal open onClose={onClose} ariaLabel={`Ligakamp runde ${rn}`} maxWidth={520} zIndex={200} contentStyle={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ overflow: 'hidden' }}>
        <div style={{ padding: '22px 26px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.textLight, fontWeight: 600 }}>
            Runde {rn}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              border: '1px solid ' + theme.border,
              background: theme.surfaceAlt,
              color: theme.textLight,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '10px 26px 26px' }}>
          {!t2 ? (
            <div style={{ padding: '20px 0', borderBottom: `1px solid ${theme.border}`, textAlign: 'center' }}>
              <DotName teamId={t1?.id} name={t1?.name} teamColors={teamColors} />
              <div style={{ marginTop: '8px', fontSize: '12px', color: theme.textLight }}>
                {t1?.player1_name} · {t1?.player2_name}
              </div>
              <div style={{ marginTop: '14px', fontSize: '13px', color: theme.textMid, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Fri runde</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '16px', padding: '20px 0', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', opacity: reported && !t1Wins ? 0.45 : 1 }}>
                <DotName teamId={t1?.id} name={t1?.name} teamColors={teamColors} />
                <div style={{ fontSize: '12px', color: theme.textLight }}>{[t1?.player1_name, t1?.player2_name].filter(Boolean).join(' · ')}</div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '40px', fontWeight: 600, letterSpacing: '-0.02em', color: t1Wins ? theme.text : theme.textLight, marginTop: '6px' }}>
                  {t1Score}
                </div>
              </div>
              <div style={{ color: theme.textLight, fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '18px', alignSelf: 'center' }}>vs</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', textAlign: 'right', opacity: reported && !t2Wins ? 0.45 : 1 }}>
                <DotName teamId={t2?.id} name={t2?.name} teamColors={teamColors} />
                <div style={{ fontSize: '12px', color: theme.textLight }}>{[t2?.player1_name, t2?.player2_name].filter(Boolean).join(' · ')}</div>
                <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '40px', fontWeight: 600, letterSpacing: '-0.02em', color: t2Wins ? theme.text : theme.textLight, marginTop: '6px' }}>
                  {t2Score}
                </div>
              </div>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontSize: '13px' }}>
            <tbody>
              {[
                ['Runde', `Runde ${rn}`],
                ['Status', statusLabel],
                ['Resultat', resultLabel],
                t2 && ['Records før', `${t1Stats.wins}W-${t1Stats.losses}L · ${t2Stats?.wins}W-${t2Stats?.losses}L`],
              ]
                .filter(Boolean)
                .map(([label, value]) => (
                  <tr key={label} style={{ borderTop: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '10px 0', color: theme.textLight, fontSize: '12px' }}>{label}</td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: theme.text }}>{value}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppModal>
  );
}

export function LigaSwissBracket({
  teams,
  matches,
  currentRound,
  totalRounds,
  myTeam,
  defaultOpen = false,
  hideToggle = false,
}) {
  const [open, setOpen] = useState(defaultOpen || hideToggle);
  const [highlightTeam, setHighlightTeam] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const bracketRef = useRef(null);
  const [connectors, setConnectors] = useState([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const isExpanded = hideToggle || open;

  const teamMap = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);

  const teamColors = useMemo(() => {
    const m = {};
    teams.forEach((t, i) => {
      m[t.id] = TEAM_PALETTE[i % TEAM_PALETTE.length];
    });
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
    const cumW = {};
    const cumL = {};
    for (const t of teams) {
      cumW[t.id] = 0;
      cumL[t.id] = 0;
    }
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
    if (!isExpanded) {
      setConnectors([]);
      return;
    }
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
        roundMatches.forEach((m) => {
          if (m.team1_id) teamsHere.add(m.team1_id);
          if (m.team2_id) teamsHere.add(m.team2_id);
        });
        for (const tid of teamsHere) {
          const srcMatch = roundMatches.find((m) => m.team1_id === tid || m.team2_id === tid);
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
            kind = !srcMatch.team2_id || srcMatch.winner_id === tid ? 'win' : 'lose';
          }
          const x1 = sRect.right - bracketRect.left;
          const y1 = sr.top + sr.height / 2 - bracketRect.top;
          const x2 = tRect.left - bracketRect.left;
          const y2 = tr.top + tr.height / 2 - bracketRect.top;
          const dx = x2 - x1;
          lines.push({
            path: `M ${x1} ${y1} C ${x1 + dx * 0.55} ${y1}, ${x2 - dx * 0.55} ${y2}, ${x2} ${y2}`,
            kind,
            tid,
            x1,
            y1,
            x2,
            y2,
          });
        }
      }
      setConnectors(lines);
    };
    requestAnimationFrame(() => requestAnimationFrame(compute));
    const ro = new ResizeObserver(compute);
    if (bracketRef.current) ro.observe(bracketRef.current);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [isExpanded, allRounds, roundsMap, teamMatchByRound]);

  if (teams.length === 0) return null;

  const orderedConnectors = [...connectors].sort(
    (a, b) => ({ pending: 0, lose: 1, win: 2 }[a.kind] - { pending: 0, lose: 1, win: 2 }[b.kind])
  );

  const bracketBody = (
    <div style={{ marginTop: hideToggle ? 0 : '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {[
          ['win', 'Vinder', theme.green, false],
          ['lose', 'Taber', theme.red, false],
          ['pending', 'Afventer', theme.border, true],
        ].map(([kind, label, color, dashed]) => (
          <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: theme.textMid }}>
            <svg width="18" height="8" style={{ flexShrink: 0 }}>
              <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '4 5' : undefined} strokeLinecap="round" />
            </svg>
            {label}
          </div>
        ))}
      </div>
      {teams.length > 1 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Hold:</span>
          {teams.map((t) => (
            <span
              key={t.id}
              onMouseEnter={() => setHighlightTeam(t.id)}
              onMouseLeave={() => setHighlightTeam(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px 4px 4px',
                borderRadius: '999px',
                border: '1px solid ' + (highlightTeam === t.id ? theme.accent : theme.border),
                background: highlightTeam === t.id ? theme.accentBg : theme.surfaceAlt,
                color: highlightTeam === t.id ? theme.accent : theme.text,
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'default',
                transition: 'all .15s',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: teamColors[t.id],
                  display: 'inline-grid',
                  placeItems: 'center',
                  fontSize: '8px',
                  fontWeight: 700,
                  color: 'white',
                  flexShrink: 0,
                }}
              >
                {t.name.slice(0, 1).toUpperCase()}
              </span>
              {t.name}
            </span>
          ))}
        </div>
      )}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div
          style={{
            width: 'max-content',
            minWidth: '100%',
            boxSizing: 'border-box',
            background: theme.surface,
            borderRadius: '14px',
            border: '1px solid ' + theme.border,
            padding: '20px 20px 24px',
            boxShadow: theme.shadow,
          }}
        >
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
            <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }} width={svgSize.w} height={svgSize.h}>
              {orderedConnectors.map((c, i) => {
                const dim = highlightTeam && c.tid !== highlightTeam;
                const isHi = highlightTeam === c.tid;
                const stroke = c.kind === 'win' ? theme.green : c.kind === 'lose' ? theme.red : theme.border;
                return (
                  <g key={i} style={{ opacity: dim ? 0.1 : 1 }}>
                    <path d={c.path} fill="none" stroke={stroke} strokeWidth={isHi ? 3 : 2} strokeLinecap="round" strokeDasharray={c.kind === 'pending' ? '4 5' : undefined} />
                    <circle cx={c.x1} cy={c.y1} r="3.5" fill="white" stroke={stroke} strokeWidth="2" />
                    <circle cx={c.x2} cy={c.y2} r="3.5" fill="white" stroke={stroke} strokeWidth="2" />
                  </g>
                );
              })}
            </svg>
            {allRounds.map((rn) => {
              const roundMatches = roundsMap[rn] || [];
              const isCurrent = rn === currentRound;
              const isDone = roundMatches.length > 0 && roundMatches.every((m) => m.status === 'reported');
              const isFuture = rn > (currentRound || 0);
              const prevStats = statsAfterRound[rn - 1] || {};

              return (
                <div key={rn} style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: isDone ? theme.accentBg : theme.surfaceAlt,
                      border: '1px solid ' + (isDone ? 'transparent' : theme.border),
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isDone ? theme.accent : isCurrent ? theme.textMid : theme.textLight }}>
                      Runde {rn}
                      {totalRounds ? ` / ${totalRounds}` : ''}
                    </span>
                    <span style={{ fontSize: '11px', color: isDone ? theme.accent : theme.textLight }}>
                      {isDone ? '✓ Afsluttet' : isCurrent ? '● Aktiv' : 'Kommende'}
                    </span>
                  </div>
                  {isFuture ? (
                    <div className="pm-data-empty-note pm-data-empty-note--dashed" style={{ padding: '20px 12px', fontSize: '11px' }}>
                      Genereres efter
                      <br />
                      runde {rn - 1}
                    </div>
                  ) : roundMatches.length === 0 ? (
                    <div className="pm-data-empty-note" style={{ padding: '20px', fontSize: '11px' }}>
                      Ingen kampe
                    </div>
                  ) : (
                    roundMatches.map((match) => {
                      const t1 = teamMap[match.team1_id];
                      const t2 = match.team2_id ? teamMap[match.team2_id] : null;
                      const reported = match.status === 'reported';
                      const isMyMatch = myTeam && (match.team1_id === myTeam?.id || match.team2_id === myTeam?.id);
                      const t1Stats = prevStats[match.team1_id] || { wins: 0, losses: 0 };
                      const t2Stats = t2 ? prevStats[match.team2_id] || { wins: 0, losses: 0 } : null;
                      const t1Wins = reported && (match.winner_id === match.team1_id || !match.team2_id);
                      const t2Wins = reported && !!t2 && match.winner_id === match.team2_id;

                      let t1Score = '—';
                      let t2Score = '—';
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
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '3px 6px',
                        borderRadius: '5px',
                        background: isWin ? theme.greenBg : isLose ? theme.redBg : theme.surfaceAlt,
                        color: isWin ? theme.green : isLose ? theme.red : theme.textLight,
                        minWidth: '44px',
                        textAlign: 'center',
                        flexShrink: 0,
                        display: 'inline-block',
                      });

                      const dotStyle = (teamId) => ({
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: teamColors[teamId] || theme.textLight,
                        display: 'inline-grid',
                        placeItems: 'center',
                        fontSize: '8px',
                        fontWeight: 700,
                        color: theme.onAccent,
                        flexShrink: 0,
                      });

                      return (
                        <div
                          key={match.id}
                          data-match-id={match.id}
                          onClick={() => setSelectedMatch({ match, rn, prevStats })}
                          style={{
                            background: theme.surface,
                            border: '1px solid ' + (isMyMatch ? theme.accent + '60' : theme.border),
                            borderRadius: '12px',
                            padding: '10px 12px',
                            display: 'grid',
                            gap: '6px',
                            cursor: 'pointer',
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
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: hideToggle ? 0 : '10px' }}>
      {!hideToggle && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="pm-accordion-trigger" style={{ ...btn(false), padding: '7px 12px', fontSize: '12px' }}>
          <span>🏟️ Swiss-turneringsplan</span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}
      {isExpanded && bracketBody}
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
