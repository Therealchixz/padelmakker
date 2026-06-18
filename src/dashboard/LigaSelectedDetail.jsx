import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Play, Plus, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { theme, btn, inputStyle, labelStyle } from '../lib/platformTheme';
import { AvatarCircle } from '../components/AvatarCircle';
import { ReportResultErrorButton } from '../components/ReportResultErrorButton';
import { completionMsForLeague } from '../lib/resultErrorReports';
import { shortLigaDate, ligaIsSwiss } from '../lib/ligaDisplayUtils';
import { validatePadelScore } from '../lib/ligaStandings';
import { LigaStandingsTable } from './LigaDetailSheet';

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

export function SwissRulesBox({ collapsible = false, storageKey = '' }) {
  const [open, setOpen] = useState(() => {
    if (!collapsible) return true;
    if (!storageKey) return false;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === null) return false;
      return saved === '1' || saved.toLowerCase() === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!collapsible || !storageKey) return;
    try {
      localStorage.setItem(storageKey, open ? '1' : '0');
    } catch {
      // ignore storage issues
    }
  }, [collapsible, storageKey, open]);

  return (
    <div className="pm-help-box" style={{ marginBottom: 16 }}>
      <div className="pm-help-box-header">
        <button
          type="button"
          onClick={() => collapsible && setOpen((o) => !o)}
          className="pm-help-box-toggle"
          style={{ cursor: collapsible ? 'pointer' : 'default' }}
        >
          <span className="pm-help-box-title">Sådan fungerer Swiss-ligaen</span>
          {collapsible && (
            <span className="pm-help-box-chevron">
              {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          )}
        </button>
      </div>
      {open && (
        <div className="pm-help-box-content">
          {SWISS_RULES.map((r, i) => (
            <div key={i} className="pm-help-box-item">
              <span style={{ flexShrink: 0 }}>{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søg efter makker..."
          style={{ ...inputStyle, paddingLeft: '32px' }}
        />
      </div>
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: theme.surface, border: '1px solid ' + theme.border, borderRadius: '8px', boxShadow: theme.shadow, zIndex: 100, marginTop: '4px' }}>
          {results.map((p) => {
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

function teamInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?';
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const TEAM_COLORS = ['#16377E', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];

function teamColor(teamId) {
  return TEAM_COLORS[hashStr(String(teamId || 'x')) % TEAM_COLORS.length];
}

function RegistrationDetail({
  league,
  regTeams,
  myTeam,
  user,
  maxTeams,
  filled,
  showTeamForm,
  teamName,
  setTeamName,
  selectedPartner,
  setSelectedPartner,
  onCreateTeam,
  onCancelTeamForm,
  onLeaveLeague,
  onKickTeam,
  onTeamProfile,
  busyId,
  busy,
  isAdmin,
  canManageTeams,
  manageToolsOpen,
  toggleManageTools,
  onStartLeague,
}) {
  const emptySlots = Math.max(0, maxTeams - filled);
  const fillPct = maxTeams > 0 ? Math.min(100, Math.round((filled / maxTeams) * 100)) : 0;
  const totalRounds = league.total_rounds || (maxTeams > 0 ? Math.max(1, maxTeams - 1) : null);
  const showManageToolsToggle = (canManageTeams && league.status === 'registration') || (isAdmin && league.status === 'active');
  const kickEnabled = canManageTeams && manageToolsOpen;

  return (
    <>
      <div className="pm-liga-v2-meta-cards">
        <div className="pm-liga-v2-meta-card">
          <div className="pm-liga-v2-meta-card-lbl">Start</div>
          <div className="pm-liga-v2-meta-card-val">{shortLigaDate(league.start_date)}</div>
        </div>
        <div className="pm-liga-v2-meta-card">
          <div className="pm-liga-v2-meta-card-lbl">Frist</div>
          <div className="pm-liga-v2-meta-card-val">{shortLigaDate(league.end_date)}</div>
        </div>
        <div className="pm-liga-v2-meta-card">
          <div className="pm-liga-v2-meta-card-lbl">Pris</div>
          <div className="pm-liga-v2-meta-card-val">Gratis</div>
        </div>
      </div>

      <div className="pm-americano-v2-list-progress-row" style={{ marginBottom: 16 }}>
        <div
          className={`pm-americano-v2-list-progress${filled >= maxTeams ? ' pm-americano-v2-list-progress--full' : ''}`}
          role="progressbar"
          aria-valuenow={filled}
          aria-valuemin={0}
          aria-valuemax={maxTeams}
          aria-label={`${filled} af ${maxTeams} hold tilmeldt`}
        >
          <div
            className="pm-americano-v2-list-progress-fill"
            style={{ width: `${filled >= maxTeams ? 100 : fillPct}%` }}
          />
        </div>
        <span className={`pm-americano-v2-list-progress-count${filled >= maxTeams ? ' pm-americano-v2-list-progress-count--full' : ''}`}>
          {filled}/{maxTeams}
        </span>
      </div>

      {league.description ? (
        <p style={{ fontSize: 13, color: theme.textMid, margin: '0 0 14px', lineHeight: 1.45 }}>{league.description}</p>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {regTeams.map((t) => {
          const isMine = myTeam?.id === t.id;
          const color = teamColor(t.id);
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="pm-liga-v2-team-row"
                onClick={() => onTeamProfile(t)}
                style={{ flex: 1 }}
              >
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${color}22`,
                    color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  {teamInitials(t.name)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: theme.text }}>
                    {t.name}
                    {isMine ? <span style={{ fontSize: 11, color: theme.accent, fontWeight: 700 }}> · dig</span> : null}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: theme.textMid, marginTop: 2 }}>
                    {t.player1_name} + {t.player2_name}
                  </span>
                </span>
                {t.status === 'pending' ? (
                  <span className="pm-status-badge pm-status-badge--warm" style={{ flexShrink: 0 }}>Afventer</span>
                ) : null}
              </button>
              {kickEnabled && t.player1_id !== user.id && t.player2_id !== user.id ? (
                <button
                  type="button"
                  onClick={() => onKickTeam(t)}
                  disabled={busyId === t.id + '-kick'}
                  style={{ ...btn(false), padding: '6px 10px', fontSize: 11, color: theme.red, borderColor: 'var(--pm-danger-border)', flexShrink: 0 }}
                >
                  Fjern
                </button>
              ) : null}
            </div>
          );
        })}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="pm-liga-v2-team-row"
            style={{ cursor: 'default', borderStyle: 'dashed', opacity: 0.7 }}
            aria-hidden
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1.5px dashed ${theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.textLight,
                flexShrink: 0,
              }}
            >
              <Plus size={14} />
            </span>
            <span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: theme.textLight }}>Ledig holdplads</span>
              <span style={{ display: 'block', fontSize: 11, color: theme.textLight }}>2 spillere</span>
            </span>
          </div>
        ))}
      </div>

      {totalRounds ? (
        <p style={{ fontSize: 11, color: theme.textLight, textAlign: 'center', margin: '0 0 16px' }}>
          {totalRounds} runder · 2 pr. hold{ligaIsSwiss(league) ? ' · Swiss-parring' : ''}
        </p>
      ) : null}

      {ligaIsSwiss(league) ? <SwissRulesBox collapsible storageKey="pm-liga-swiss-rules" /> : null}

      {myTeam ? (
        <div
          className={`pm-card-subpanel ${myTeam.status === 'pending' ? '' : 'pm-card-subpanel--green'}`.trim()}
          style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}
        >
          <div style={{ fontSize: 12, color: myTeam.status === 'pending' ? theme.warm : theme.green, fontWeight: 700 }}>
            {myTeam.status === 'pending'
              ? `⏳ Afventer godkendelse fra ${myTeam.player2_name}`
              : `✓ Du er tilmeldt som ${myTeam.name}`}
          </div>
          <button onClick={onLeaveLeague} disabled={busy} style={{ ...btn(false), padding: '6px 12px', fontSize: 12 }}>
            Afmeld hold
          </button>
        </div>
      ) : null}

      {showTeamForm ? (
        <div className="pm-card-subpanel" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Tilmeld hold</div>
          <label style={labelStyle}>Holdnavn</label>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="F.eks. Smash Bros"
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <label style={labelStyle}>Din makker</label>
          <PartnerSearch userId={user.id} onSelect={setSelectedPartner} />
          {selectedPartner ? (
            <div className="pm-card-row-item pm-card-row-item--accent" style={{ marginTop: 8 }}>
              <AvatarCircle avatar={selectedPartner.avatar} size={24} emojiSize="12px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedPartner.full_name || selectedPartner.name}</span>
              <span style={{ fontSize: 11, color: theme.textLight }}>ELO {Math.round(Number(selectedPartner.elo_rating) || 1000)}</span>
              <button onClick={() => setSelectedPartner(null)} style={{ ...btn(false), padding: '2px 8px', fontSize: 11, marginLeft: 'auto' }}>×</button>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={onCreateTeam} disabled={busyId === league.id + '-team'} style={{ ...btn(true), fontSize: 13, padding: '10px 14px' }}>
              {busyId === league.id + '-team' ? 'Tilmelder…' : 'Tilmeld hold'}
            </button>
            <button onClick={onCancelTeamForm} style={{ ...btn(false), fontSize: 13, padding: '10px 14px' }}>Annullér</button>
          </div>
        </div>
      ) : null}

      {showManageToolsToggle ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={toggleManageTools}
            style={{
              ...btn(false),
              padding: '7px 12px',
              fontSize: 12,
              color: theme.warm,
              borderColor: theme.warm + '55',
              background: theme.warmBg,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <span>{manageToolsOpen ? 'Skjul admin-værktøjer' : 'Vis admin-værktøjer'}</span>
            {manageToolsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {isAdmin && manageToolsOpen ? (
            <button onClick={onStartLeague} disabled={busy} style={{ ...btn(true), padding: '7px 12px', fontSize: 12, background: theme.warm, borderColor: theme.warm }}>
              <Play size={13} /> Start liga
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ActiveDetail({
  league,
  teams,
  matches,
  myTeam,
  standings,
  joined,
  onPlayerClick,
  onTeamProfile,
  reportingMatch,
  setReportingMatch,
  scoreText,
  setScoreText,
  selectedWinnerId,
  setSelectedWinnerId,
  confirmPending,
  setConfirmPending,
  cancelReporting,
  reportResult,
  busyId,
  showToast,
  isAdmin,
  manageToolsOpen,
  toggleManageTools,
  onNextRound,
  onCompleteLeague,
  busy,
  matchesByLeague,
}) {
  const currentRoundMatches = matches.filter((m) => m.round_number === league.current_round);
  const myMatch = myTeam ? currentRoundMatches.find((m) => m.team1_id === myTeam.id || m.team2_id === myTeam.id) : null;
  const opponentTeamId = myMatch ? (myMatch.team1_id === myTeam?.id ? myMatch.team2_id : myMatch.team1_id) : null;
  const opponentTeam = opponentTeamId ? teams.find((t) => t.id === opponentTeamId) : null;
  const pendingCount = (matchesByLeague[league.id] || []).filter((m) => m.round_number === league.current_round && m.status === 'pending').length;

  return (
    <>
      {teams.length > 0 ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Holdrangliste
          </div>
          <LigaStandingsTable standings={standings} myTeamId={myTeam?.id} />
        </>
      ) : null}

      {joined && myMatch ? (
        <div className="pm-card-subpanel pm-card-subpanel--accent" style={{ padding: 14, marginTop: 16, marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Jeres kamp — runde {league.current_round}
          </div>
          {myMatch.team2_id === null ? (
            <div style={{ fontSize: 13, color: theme.textMid }}>Fri runde — automatisk sejr 🎾</div>
          ) : myMatch.status === 'reported' ? (
            <div style={{ fontSize: 13, color: theme.textMid }}>
              {myMatch.winner_id === myTeam.id ? '🏆 I vandt' : '😔 I tabte'}
              {myMatch.score_text ? <span style={{ color: theme.textLight }}> · {myMatch.score_text}</span> : null}
              {opponentTeam ? <span style={{ color: theme.textLight }}> mod {opponentTeam.name}</span> : null}
            </div>
          ) : opponentTeam ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{myTeam.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <span onClick={() => onPlayerClick(myTeam.player1_id, myTeam.player1_name, myTeam.player1_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <AvatarCircle avatar={myTeam.player1_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                      <span style={{ fontSize: 10, color: theme.textMid, fontWeight: 600 }}>{myTeam.player1_name}</span>
                    </span>
                    <span onClick={() => onPlayerClick(myTeam.player2_id, myTeam.player2_name, myTeam.player2_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <AvatarCircle avatar={myTeam.player2_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                      <span style={{ fontSize: 10, color: theme.textMid, fontWeight: 600 }}>{myTeam.player2_name}</span>
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: theme.textLight }}>vs</div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <button type="button" onClick={() => onTeamProfile(opponentTeam)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, color: theme.text }}>{opponentTeam.name}</div>
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                    <span onClick={() => onPlayerClick(opponentTeam.player1_id, opponentTeam.player1_name, opponentTeam.player1_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <AvatarCircle avatar={opponentTeam.player1_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                      <span style={{ fontSize: 10, color: theme.textMid, fontWeight: 600 }}>{opponentTeam.player1_name}</span>
                    </span>
                    <span onClick={() => onPlayerClick(opponentTeam.player2_id, opponentTeam.player2_name, opponentTeam.player2_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <AvatarCircle avatar={opponentTeam.player2_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                      <span style={{ fontSize: 10, color: theme.textMid, fontWeight: 600 }}>{opponentTeam.player2_name}</span>
                    </span>
                  </div>
                </div>
              </div>
              {reportingMatch === myMatch.id ? (
                confirmPending ? (
                  <div style={{ background: theme.surface, borderRadius: 10, padding: 16, border: '2px solid ' + (confirmPending.winnerId === myTeam.id ? theme.green : theme.red) }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: theme.text }}>Bekræft resultat</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0', padding: '10px 12px', background: theme.surfaceAlt, borderRadius: 8 }}>
                      <span style={{ fontSize: 20 }}>{confirmPending.winnerId === myTeam.id ? '🏆' : '😔'}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: confirmPending.winnerId === myTeam.id ? theme.green : theme.red }}>
                          {confirmPending.winnerId === myTeam.id ? `${myTeam.name} vandt` : `${opponentTeam.name} vandt`}
                        </div>
                        <div style={{ fontSize: 12, color: theme.textMid, marginTop: 2 }}>
                          Score: <strong>{confirmPending.score}</strong>
                          {' · '}{myTeam.name} vs {opponentTeam.name}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => reportResult(myMatch, confirmPending.winnerId, confirmPending.score)} disabled={busyId === myMatch.id}
                        style={{ ...btn(true), padding: '9px 16px', fontSize: 13, background: theme.green, borderColor: theme.green }}>
                        {busyId === myMatch.id ? 'Gemmer…' : '✓ Bekræft'}
                      </button>
                      <button onClick={() => setConfirmPending(null)} style={{ ...btn(false), padding: '8px 14px', fontSize: 13 }}>
                        ← Ret
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Score (påkrævet)</div>
                      <input
                        value={scoreText}
                        onChange={(e) => setScoreText(e.target.value)}
                        placeholder="F.eks. 6-4"
                        style={{ ...inputStyle, fontSize: 18, textAlign: 'center', fontWeight: 700, letterSpacing: '0.08em' }}
                      />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Hvem vandt?</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                      {[
                        { team: myTeam, label: 'Jeres hold' },
                        { team: opponentTeam, label: 'Modstanderne' },
                      ].map(({ team, label }) => {
                        const isSelected = selectedWinnerId === team.id;
                        return (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => setSelectedWinnerId(team.id)}
                            style={{ border: '2px solid ' + (isSelected ? theme.green : theme.border), background: isSelected ? theme.greenBg : theme.surface, borderRadius: 10, padding: '12px 8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}
                          >
                            <div style={{ fontSize: 9, fontWeight: 700, color: isSelected ? theme.green : theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? theme.green : theme.text, marginBottom: 8 }}>{team.name}</div>
                            {isSelected ? <div style={{ fontSize: 18, marginTop: 6 }}>🏆</div> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => {
                          const err = validatePadelScore(scoreText);
                          if (err) { showToast(err); return; }
                          if (!selectedWinnerId) { showToast('Vælg en vinder.'); return; }
                          setConfirmPending({ winnerId: selectedWinnerId, score: scoreText.trim() });
                        }}
                        style={{ ...btn(true), padding: '9px 18px', fontSize: 13, opacity: (!scoreText || !selectedWinnerId) ? 0.5 : 1 }}
                      >
                        Fortsæt →
                      </button>
                      <button type="button" onClick={cancelReporting} style={{ ...btn(false), padding: '8px 12px', fontSize: 12 }}>Annullér</button>
                    </div>
                  </div>
                )
              ) : (
                <button type="button" onClick={() => setReportingMatch(myMatch.id)} style={{ ...btn(true), padding: '8px 14px', fontSize: 13 }}>
                  Indberét resultat
                </button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {isAdmin ? (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={toggleManageTools}
            style={{
              ...btn(false),
              padding: '7px 12px',
              fontSize: 12,
              color: theme.warm,
              borderColor: theme.warm + '55',
              background: theme.warmBg,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              width: '100%',
            }}
          >
            <span>{manageToolsOpen ? 'Skjul admin-værktøjer' : 'Vis admin-værktøjer'}</span>
            {manageToolsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {manageToolsOpen ? (
            <div style={{ borderTop: '1px solid ' + theme.border, paddingTop: 12, marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={onNextRound} disabled={busy || pendingCount > 0}
                title={pendingCount > 0 ? `${pendingCount} kamp${pendingCount > 1 ? 'e' : ''} mangler resultat` : ''}
                style={{ ...btn(true), padding: '7px 12px', fontSize: 12, background: pendingCount > 0 ? theme.textLight : theme.warm, borderColor: pendingCount > 0 ? theme.textLight : theme.warm, opacity: pendingCount > 0 ? 0.7 : 1 }}>
                ⏭ Næste runde{pendingCount > 0 ? ` (${pendingCount} afventer)` : ''}
              </button>
              <button onClick={onCompleteLeague} disabled={busy} style={{ ...btn(false), padding: '7px 12px', fontSize: 12 }}>
                Afslut liga
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function CompletedDetail({ league, standings, myTeam, isCreator }) {
  return (
    <>
      {standings.length > 0 && league.status === 'completed' ? (
        <>
          {(() => {
            const w = standings[0];
            return (
              <div className="pm-card-subpanel pm-card-subpanel--warm" style={{ marginBottom: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 28, lineHeight: 1 }}>🏆</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: theme.warm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Vinder</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: theme.textMid, marginTop: 4 }}>{w.wins}W · {w.losses}L · {w.points} pt</div>
                </div>
              </div>
            );
          })()}
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Slutstilling
          </div>
          <LigaStandingsTable standings={standings} myTeamId={myTeam?.id} />
        </>
      ) : null}
      {isCreator ? (
        <div style={{ marginTop: 16 }}>
          <ReportResultErrorButton
            sourceType="league"
            entityId={league.id}
            completedAtMs={completionMsForLeague(league)}
            isCreator={isCreator}
            entityLabel={`Liga · ${league.name}`}
          />
        </div>
      ) : null}
    </>
  );
}

export function LigaSelectedDetail(props) {
  const { league } = props;
  if (!league) return null;

  if (league.status === 'registration') {
    return <RegistrationDetail {...props} />;
  }
  if (league.status === 'active') {
    return <ActiveDetail {...props} />;
  }
  if (league.status === 'completed') {
    return <CompletedDetail {...props} />;
  }
  return null;
}
