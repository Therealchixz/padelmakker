import { CalendarDays } from 'lucide-react';
import { isAvatarUrl } from '../lib/avatarUpload';

const SEASON_LABELS = { weekly: 'Ugentlig', monthly: 'Månedlig' };

/** Blå gradient header — samme stil på tværs af 2v2 / Americano / Liga */
const HEADER_GRADIENT = 'linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%)';

const C = {
  white: '#FFFFFF',
  text: '#0B1120',
  textMid: '#3E4C63',
  textDim: '#94A3B8',
  border: '#E2E8F0',
  surfaceAlt: '#F8FAFC',
  accent: '#1D4ED8',
  green: '#059669',
  greenBg: '#D1FAE5',
  amber: '#D97706',
  amberBg: '#FEF3C7',
  pendingBg: '#FEF3C7',
  pending: '#D97706',
  /** Subtile farver til hold-initial bokse — vælges deterministisk fra hold-id */
  teamPalette: [
    { bg: '#1D4ED8', fg: '#FFFFFF' },
    { bg: '#059669', fg: '#FFFFFF' },
    { bg: '#7C3AED', fg: '#FFFFFF' },
    { bg: '#D97706', fg: '#FFFFFF' },
    { bg: '#DB2777', fg: '#FFFFFF' },
    { bg: '#0891B2', fg: '#FFFFFF' },
  ],
};

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function teamColor(teamId) {
  return C.teamPalette[hashStr(String(teamId || 'x')) % C.teamPalette.length];
}

function teamInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('') || '?';
}

function PlayerMiniAvatar({ avatar, name, onClick }) {
  const initials = String(name || '?').split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '?';
  const Inner = (
    <div
      className={onClick ? 'pm-avatar-circle pm-avatar-circle--clickable' : 'pm-avatar-circle'}
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: C.surfaceAlt,
        border: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 700,
        color: C.textMid,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {avatar && isAvatarUrl(avatar) ? (
        <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : avatar ? (
        <span style={{ fontSize: 12 }}>{avatar}</span>
      ) : (
        initials
      )}
    </div>
  );
  if (!onClick) return Inner;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Åbn profil for ${name}`}
      title={name}
      style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex' }}
    >
      {Inner}
    </button>
  );
}

function TeamRow({ team, isMine, onPlayer1Click, onPlayer2Click, onKick, kickBusy }) {
  const color = teamColor(team.id);
  const initials = teamInitials(team.name);
  const isPending = team.status === 'pending';
  return (
    <div
      className="pm-card-row-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: isMine ? C.greenBg : C.surfaceAlt,
        border: `1px solid ${isMine ? '#86EFAC' : C.border}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: isPending ? C.pendingBg : color.bg,
          color: isPending ? C.pending : color.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.5,
          flexShrink: 0,
        }}
        aria-hidden
      >
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.text,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {team.name}
          {isMine && <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>(dit hold)</span>}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.textMid,
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          <span>{team.player1_name}</span>
          <span style={{ color: C.textDim }}>+</span>
          <span>{team.player2_name}</span>
          {isPending && (
            <span
              style={{
                marginLeft: 4,
                fontSize: 10,
                fontWeight: 700,
                color: C.pending,
                background: C.pendingBg,
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              Afventer
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <PlayerMiniAvatar avatar={team.player1_avatar} name={team.player1_name} onClick={onPlayer1Click} />
        <PlayerMiniAvatar avatar={team.player2_avatar} name={team.player2_name} onClick={onPlayer2Click} />
      </div>
      {onKick && (
        <button
          type="button"
          onClick={onKick}
          disabled={kickBusy}
          aria-label={`Fjern ${team.name}`}
          title={`Fjern ${team.name}`}
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: 'none',
            background: '#DC2626',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 700,
            cursor: kickBusy ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function EmptyTeamSlot() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        border: `1.5px dashed ${C.border}`,
        borderRadius: 10,
        background: 'transparent',
      }}
      aria-hidden
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border: `1.5px dashed ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.textDim,
          flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <line x1="7" y1="2" x2="7" y2="12" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
          <line x1="2" y1="7" x2="12" y2="7" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.textDim }}>Ledig holdplads</div>
        <div style={{ fontSize: 11, color: C.textDim }}>2 spillere</div>
      </div>
    </div>
  );
}

export function LigaOpenCard({
  league,
  teams = [],
  myTeamId = null,
  onPlayerClick,
  onKickTeam,
  kickBusyId,
  actions,
  extras,
}) {
  const maxTeams = league.max_teams || teams.length;
  const filled = teams.length;
  const emptySlots = Math.max(0, maxTeams - filled);
  const isFull = emptySlots === 0;
  const isAlmostFull = emptySlots === 1;
  const fillPct = maxTeams > 0 ? Math.min(100, Math.round((filled / maxTeams) * 100)) : 0;
  const seasonLabel = SEASON_LABELS[league.season_type] || league.season_type;
  const totalRounds = league.total_rounds || (maxTeams > 0 ? maxTeams - 1 : null);

  return (
    <div
      className="pm-ui-card"
      style={{
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Purple header band — Liga's visuelle signatur */}
      <div
        style={{
          background: HEADER_GRADIENT,
          color: C.white,
          padding: '16px 18px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                opacity: 0.85,
                marginBottom: 2,
              }}
            >
              {seasonLabel ? `${seasonLabel} Liga` : 'Liga'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {league.name}
            </div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.9,
                marginTop: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <CalendarDays size={13} strokeWidth={2} aria-hidden />
              {formatDateRange(league.start_date, league.end_date)}
            </div>
          </div>
          <span
            style={{
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.18)',
              color: C.white,
              backdropFilter: 'blur(4px)',
              whiteSpace: 'nowrap',
            }}
          >
            {filled}/{maxTeams} hold
          </span>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textMid }}>
            {filled} af {maxTeams} hold tilmeldt
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: isFull ? C.green : isAlmostFull ? C.amber : C.green,
              textAlign: 'right',
            }}
          >
            {isFull
              ? 'Klar til start ✓'
              : `${emptySlots} ${emptySlots === 1 ? 'plads' : 'pladser'} tilbage`}
          </span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: C.border, overflow: 'hidden', marginBottom: 14 }}>
          <div
            style={{
              width: `${fillPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #1D4ED8, #0EA5E9)',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* Description */}
        {league.description && (
          <div style={{ fontSize: 12, color: C.textMid, fontStyle: 'italic', marginBottom: 12, lineHeight: 1.45 }}>
            {league.description}
          </div>
        )}

        {/* Team list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {teams.map((t) => (
            <TeamRow
              key={t.id}
              team={t}
              isMine={myTeamId === t.id}
              onPlayer1Click={onPlayerClick ? () => onPlayerClick(t.player1_id, t.player1_name, t.player1_avatar) : null}
              onPlayer2Click={onPlayerClick ? () => onPlayerClick(t.player2_id, t.player2_name, t.player2_avatar) : null}
              onKick={onKickTeam ? () => onKickTeam(t) : null}
              kickBusy={kickBusyId === t.id}
            />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <EmptyTeamSlot key={`empty-${i}`} />
          ))}
        </div>

        {/* Info footer */}
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 14,
            fontSize: 10,
            fontWeight: 500,
            color: C.textDim,
          }}
        >
          {totalRounds && <span>⏱ {totalRounds} runder</span>}
          <span>👥 2 pr. hold</span>
          <span>📊 Swiss-parring</span>
        </div>

        {/* Actions */}
        {(actions || extras) && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actions}
            {extras}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateRange(start, end) {
  const fmt = (s) => {
    if (!s) return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const day = String(d.getDate()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const yr = String(d.getFullYear()).slice(-2);
    return `${day}.${mo}.${yr}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}
