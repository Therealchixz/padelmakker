import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Play, Plus, Search, Check } from 'lucide-react';
import { eloToLevel, formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { supabase } from '../lib/supabase';
import { theme, btn, inputStyle, labelStyle } from '../lib/platformTheme';
import { AvatarCircle } from '../components/AvatarCircle';
import { ReportResultErrorButton } from '../components/ReportResultErrorButton';
import { completionMsForLeague } from '../lib/resultErrorReports';
import {
  shortLigaDate,
  ligaIsSwiss,
  ligaIsRoundRobin,
  ligaIsKnockout,
  ligaMatchSystemLabel,
} from '../lib/ligaDisplayUtils';
import { validatePadelScore } from '../lib/ligaStandings';
import { LigaStandingsTable, LigaDivisionStandings } from './LigaDetailSheet';
import { buildProfileNameSearchOrFilter } from '../lib/postgrestFilterUtils';
import { CreatorTag } from '../components/kampe/CreatorTag';

function ligaPlayerLabel(name, userId, creatorUserId, currentUserId) {
  const isCreator = creatorUserId && userId && String(userId) === String(creatorUserId);
  const isMe = currentUserId && userId && String(userId) === String(currentUserId);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {isMe ? 'Dig' : name}
      {isCreator ? <CreatorTag /> : null}
    </span>
  );
}

const SWISS_RULES = [
  { icon: '🎾', text: 'Hvert hold spiller én kamp per runde — ingen eliminering, alle spiller videre.' },
  { icon: '📊', text: 'Hold parres mod andre med samme pointtal. Jo flere runder, jo mere præcis ranglisten bliver.' },
  { icon: '🔁', text: 'To hold mødes aldrig hinanden mere end én gang i samme turnering.' },
  { icon: '🏆', text: 'Point: Sejr = 3 · Tab i tiebreak (7-6) = 1 · Klart tab = 0.' },
  { icon: '📏', text: 'Ved pointlighed afgøres placeringen af spilsforskel (antal games vundet minus tabt).' },
  { icon: '🔢', text: 'Antal runder sættes automatisk som et loft (ca. log2 af holdantal) — ligaen kan afsluttes tidligere hvis alle modstandere er mødt.' },
  { icon: '🎯', text: 'Score er obligatorisk ved indberetning — gyldige: 6-0 til 6-4, 7-5 eller 7-6.' },
  { icon: '⏸️', text: 'Næste runde genereres først når alle kampe i indeværende runde er indberettet.' },
  { icon: '👥', text: 'Ulige antal hold? Ét hold får fri runde og tæller automatisk som sejr (3 point).' },
  { icon: '📋', text: 'W = Wins (sejre) · L = Losses (nederlag) · Diff = spilsforskel (games vundet minus games tabt).' },
];

const RR_RULES = [
  { icon: '📅', text: 'Alle-mod-alle: hvert hold møder alle andre hold præcis én gang.' },
  { icon: '🗂️', text: 'Hele kampprogrammet genereres ved start — “Næste runde” aktiverer blot næste planlagte runde.' },
  { icon: '👥', text: 'Ulige antal hold? Ét hold har fri (bye) i hver runde.' },
  { icon: '🏆', text: 'Stillingen opdateres med point efter hvert resultat (sejr / tiebreak-tab / tab).' },
  { icon: '⏸️', text: 'Næste runde kan først aktiveres når alle kampe i indeværende runde er indberettet.' },
];

const KO_RULES = [
  { icon: '⚔️', text: 'Knockout: tab = færdig. Kun vindere går videre til næste runde.' },
  { icon: '🌱', text: 'Seedning efter kombineret hold-ELO (stærkest først). Top seeds kan få bye i runde 1.' },
  { icon: '🏁', text: 'Turneringen slutter når der er én vinder (finalen er spillet).' },
  { icon: '⏸️', text: 'Næste runde genereres først når alle kampe i indeværende runde er indberettet.' },
];

function LigaRulesBox({ title, rules, collapsible = false, storageKey = '' }) {
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
          <span className="pm-help-box-title">{title}</span>
          {collapsible && (
            <span className="pm-help-box-chevron">
              {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          )}
        </button>
      </div>
      {open && (
        <div className="pm-help-box-content">
          {rules.map((r, i) => (
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

export function SwissRulesBox(props) {
  return (
    <LigaRulesBox
      title="Sådan fungerer Swiss-ligaen"
      rules={SWISS_RULES}
      {...props}
    />
  );
}

export function LigaMatchSystemRulesBox({ league, collapsible = true }) {
  if (ligaIsKnockout(league)) {
    return (
      <LigaRulesBox
        title="Sådan fungerer knockout"
        rules={KO_RULES}
        collapsible={collapsible}
        storageKey="pm-liga-ko-rules"
      />
    );
  }
  if (ligaIsRoundRobin(league)) {
    return (
      <LigaRulesBox
        title="Sådan fungerer alle-mod-alle"
        rules={RR_RULES}
        collapsible={collapsible}
        storageKey="pm-liga-rr-rules"
      />
    );
  }
  if (ligaIsSwiss(league)) {
    return <SwissRulesBox collapsible={collapsible} storageKey="pm-liga-swiss-rules" />;
  }
  return null;
}

function partnerMetaLine(p) {
  const lvl = formatPlaytomicLevel(eloToLevel(Number(p.elo_rating) || 1000));
  const games = Number(p.gamesTogether) || 0;
  return games > 0 ? `Niveau ${lvl} · spillet ${games} ${games === 1 ? 'kamp' : 'kampe'} sammen` : `Niveau ${lvl}`;
}

function PartnerSearch({ userId, onSelect, selectedId = null }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Foreslåede makkere: dem brugeren har spillet flest 2v2-kampe med
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: mine } = await supabase.from('match_players').select('match_id').eq('user_id', userId);
        const matchIds = [...new Set((mine || []).map((r) => r.match_id).filter(Boolean))];
        if (matchIds.length === 0) return;
        const { data: co } = await supabase.from('match_players').select('user_id').in('match_id', matchIds).neq('user_id', userId);
        const counts = {};
        (co || []).forEach((r) => { if (r.user_id) counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
        const topIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
        if (topIds.length === 0) return;
        const { data: profs } = await supabase.from('profiles').select('id, full_name, name, avatar, elo_rating').in('id', topIds);
        const byId = Object.fromEntries((profs || []).map((p) => [p.id, p]));
        const list = topIds.map((id) => ({ ...(byId[id] || { id }), gamesTogether: counts[id] })).filter((p) => p.full_name || p.name);
        if (!cancelled) setSuggested(list);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const orFilter = buildProfileNameSearchOrFilter(query);
      if (!orFilter) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, name, avatar, elo_rating')
        .or(orFilter)
        .neq('id', userId)
        .limit(6);
      const gamesById = Object.fromEntries(suggested.map((s) => [s.id, s.gamesTogether]));
      setResults((data || []).map((p) => ({ ...p, gamesTogether: gamesById[p.id] || 0 })));
      setOpen(true);
    }, 280);
    return () => clearTimeout(t);
  }, [query, userId, suggested]);

  const PartnerRow = ({ p, inDropdown }) => {
    const name = p.full_name || p.name || 'Spiller';
    const isSel = selectedId && p.id === selectedId;
    return (
      <button
        type="button"
        onClick={() => { onSelect(p); setQuery(''); setOpen(false); }}
        style={{
          width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', cursor: 'pointer', background: isSel ? theme.accentBg : 'transparent',
          border: inDropdown ? 'none' : '1.5px solid ' + (isSel ? theme.accent : theme.border),
          borderRadius: inDropdown ? 0 : 12, marginBottom: inDropdown ? 0 : 8,
          borderBottom: inDropdown ? '1px solid ' + theme.border + '80' : undefined,
        }}
      >
        <AvatarCircle avatar={p.avatar} size={34} emojiSize="15px" style={{ background: theme.accentBg, border: '1px solid ' + theme.border, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11.5, color: theme.textLight, marginTop: 1 }}>{partnerMetaLine(p)}</div>
        </div>
        {isSel ? <Check size={18} color={theme.accent} strokeWidth={2.5} /> : null}
      </button>
    );
  };

  return (
    <div ref={ref}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: theme.textLight, pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Søg efter makker..."
          style={{ ...inputStyle, paddingLeft: '32px' }}
        />
        {open && results.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: theme.surface, border: '1px solid ' + theme.border, borderRadius: '8px', boxShadow: theme.shadow, zIndex: 100, marginTop: '4px', overflow: 'hidden' }}>
            {results.map((p) => <PartnerRow key={p.id} p={p} inDropdown />)}
          </div>
        )}
      </div>
      {query.length < 2 && suggested.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Foreslåede makkere</div>
          {suggested.map((p) => <PartnerRow key={p.id} p={p} />)}
        </div>
      ) : null}
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

const TEAM_COLORS = ['#16377E', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2']; // ui-hex-allow: dekorativ hold-palet (${color}22 alpha-tints, kan ikke være CSS-var)

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
          <div className="pm-liga-v2-meta-card-lbl">{league.registration_deadline ? 'Frist' : 'Slut'}</div>
          <div className="pm-liga-v2-meta-card-val">{shortLigaDate(league.registration_deadline || league.end_date)}</div>
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
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, fontSize: 11, color: theme.textMid, marginTop: 2 }}>
                    {ligaPlayerLabel(t.player1_name, t.player1_id, league.created_by, user.id)}
                    <span aria-hidden>+</span>
                    {ligaPlayerLabel(t.player2_name, t.player2_id, league.created_by, user.id)}
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
          {totalRounds} runder · 2 pr. hold · {ligaMatchSystemLabel(league.match_system)}
        </p>
      ) : null}

      <LigaMatchSystemRulesBox league={league} collapsible />

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
          <PartnerSearch userId={user.id} onSelect={setSelectedPartner} selectedId={selectedPartner?.id} />
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
  user,
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

  // Per-sæt score-input (udleder selv vinder + score-tekst)
  const [sets, setSets] = useState([{ a: 0, b: 0 }, { a: 0, b: 0 }, { a: 0, b: 0 }]);
  useEffect(() => {
    // Nulstil sæt når man åbner/lukker indberetning
    setSets([{ a: 0, b: 0 }, { a: 0, b: 0 }, { a: 0, b: 0 }]);
  }, [reportingMatch]);

  return (
    <>
      <LigaMatchSystemRulesBox league={league} collapsible />

      {teams.length > 0 ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
            Holdrangliste
          </div>
          <LigaDivisionStandings standings={standings} myTeamId={myTeam?.id} numDivisions={league.num_divisions} />
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
                      <span style={{ fontSize: 10, color: theme.textMid, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {ligaPlayerLabel(myTeam.player1_name, myTeam.player1_id, league.created_by, user?.id)}
                      </span>
                    </span>
                    <span onClick={() => onPlayerClick(myTeam.player2_id, myTeam.player2_name, myTeam.player2_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <AvatarCircle avatar={myTeam.player2_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                      <span style={{ fontSize: 10, color: theme.textMid, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {ligaPlayerLabel(myTeam.player2_name, myTeam.player2_id, league.created_by, user?.id)}
                      </span>
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
                      <span style={{ fontSize: 10, color: theme.textMid, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {ligaPlayerLabel(opponentTeam.player1_name, opponentTeam.player1_id, league.created_by, user?.id)}
                      </span>
                    </span>
                    <span onClick={() => onPlayerClick(opponentTeam.player2_id, opponentTeam.player2_name, opponentTeam.player2_avatar)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                      <AvatarCircle avatar={opponentTeam.player2_avatar} size={28} emojiSize="13px" style={{ background: theme.surface, border: '1px solid ' + theme.border }} />
                      <span style={{ fontSize: 10, color: theme.textMid, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {ligaPlayerLabel(opponentTeam.player2_name, opponentTeam.player2_id, league.created_by, user?.id)}
                      </span>
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
                    {(() => {
                      const played = sets.filter((s) => s.a + s.b > 0);
                      const tiedAfterTwo = played.length === 2
                        && ((sets[0].a > sets[0].b ? 1 : sets[0].b > sets[0].a ? 2 : 0)
                          !== (sets[1].a > sets[1].b ? 1 : sets[1].b > sets[1].a ? 2 : 0));
                      const visibleSets = tiedAfterTwo || (sets[2].a + sets[2].b > 0) ? 3 : 2;
                      let wonA = 0, wonB = 0;
                      played.forEach((s) => { if (s.a > s.b) wonA++; else if (s.b > s.a) wonB++; });
                      const winnerId = wonA > wonB ? myTeam.id : wonB > wonA ? opponentTeam.id : null;
                      const scoreStr = played.map((s) => `${s.a}-${s.b}`).join(', ');

                      const bump = (idx, side, delta) => {
                        setSets((prev) => prev.map((s, i) => i === idx
                          ? { ...s, [side]: Math.max(0, Math.min(9, s[side] + delta)) }
                          : s));
                      };

                      const Stepper = ({ idx, side, value }) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button type="button" aria-label="minus" onClick={() => bump(idx, side, -1)}
                            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid ' + theme.border, background: theme.surface, color: theme.text, fontSize: 18, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>−</button>
                          <span style={{ minWidth: 22, textAlign: 'center', fontSize: 18, fontWeight: 800, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                          <button type="button" aria-label="plus" onClick={() => bump(idx, side, 1)}
                            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: theme.accent, color: 'var(--pm-on-accent)', fontSize: 18, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>+</button>
                        </div>
                      );

                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 2px 8px' }}>
                            <span>{myTeam.name.split(' & ')[0]} …</span>
                            <span>Score pr. sæt</span>
                            <span>{opponentTeam.name.split(' & ')[0]} …</span>
                          </div>
                          {Array.from({ length: visibleSets }, (_, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', marginBottom: 8, border: '1px solid ' + theme.border, borderRadius: 10, background: theme.surface }}>
                              <Stepper idx={idx} side="a" value={sets[idx].a} />
                              <span style={{ fontSize: 10, fontWeight: 700, color: theme.textLight }}>SÆT {idx + 1}{idx === 2 ? ' (afgørende)' : ''}</span>
                              <Stepper idx={idx} side="b" value={sets[idx].b} />
                            </div>
                          ))}
                          <div style={{ textAlign: 'center', fontSize: 12, color: theme.textMid, margin: '4px 0 14px' }}>
                            {winnerId ? (
                              <>Vinder: <strong style={{ color: theme.green }}>{winnerId === myTeam.id ? myTeam.name : opponentTeam.name}</strong> · {scoreStr}</>
                            ) : played.length === 0 ? 'Indtast sæt-scores' : 'Uafgjort — spil et afgørende sæt'}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!scoreStr || played.length < 2) { showToast('Indtast mindst 2 sæt.'); return; }
                                for (const s of played) {
                                  const err = validatePadelScore(`${s.a}-${s.b}`);
                                  if (err) { showToast(`Sæt ${s.a}-${s.b}: ${err}`); return; }
                                }
                                if (!winnerId) { showToast('Resultatet er uafgjort — spil et afgørende sæt.'); return; }
                                setScoreText(scoreStr);
                                setSelectedWinnerId(winnerId);
                                setConfirmPending({ winnerId, score: scoreStr });
                              }}
                              style={{ ...btn(true), padding: '9px 18px', fontSize: 13, opacity: winnerId ? 1 : 0.5 }}
                            >
                              Fortsæt →
                            </button>
                            <button type="button" onClick={cancelReporting} style={{ ...btn(false), padding: '8px 12px', fontSize: 12 }}>Annullér</button>
                          </div>
                        </>
                      );
                    })()}
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
            <div style={{ borderTop: '1px solid ' + theme.border, paddingTop: 12, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ligaIsKnockout(league) ? (
                <p style={{ margin: 0, fontSize: 12, color: theme.textLight, lineHeight: 1.4 }}>
                  Knockout: kun vindere går videre · tab = færdig
                </p>
              ) : null}
              {ligaIsRoundRobin(league) ? (
                <p style={{ margin: 0, fontSize: 12, color: theme.textLight, lineHeight: 1.4 }}>
                  Alle-mod-alle: næste runde aktiverer næste planlagte kampe (allerede genereret)
                </p>
              ) : null}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={onNextRound} disabled={busy || pendingCount > 0}
                  title={pendingCount > 0 ? `${pendingCount} kamp${pendingCount > 1 ? 'e' : ''} mangler resultat` : ''}
                  style={{ ...btn(true), padding: '7px 12px', fontSize: 12, background: pendingCount > 0 ? theme.textLight : theme.warm, borderColor: pendingCount > 0 ? theme.textLight : theme.warm, opacity: pendingCount > 0 ? 0.7 : 1 }}>
                  ⏭ Næste runde{pendingCount > 0 ? ` (${pendingCount} afventer)` : ''}
                </button>
                <button onClick={onCompleteLeague} disabled={busy} style={{ ...btn(false), padding: '7px 12px', fontSize: 12 }}>
                  Afslut liga
                </button>
              </div>
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
          <LigaDivisionStandings standings={standings} myTeamId={myTeam?.id} numDivisions={league.num_divisions} />
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
