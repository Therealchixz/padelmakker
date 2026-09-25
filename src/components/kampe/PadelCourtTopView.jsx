/* Padelbane set oppefra i rigtige mål (20 × 10 m) til toppen af kamp- og
   turneringsdetaljen — med spillernes profilbilleder på deres pladser og
   stiplede ringe for ledige pladser (ejeren 25. sep. 2026).
   Ren SVG: skarp i alle størrelser, ingen billede-download ud over avatarer. */
import { useId } from 'react';
import { isAvatarUrl } from '../../lib/avatarUpload';

/** Placering af 1–4 baner i en viewBox på 400 × 176 (kortet dækker de nederste ~34 px). */
function courtLayout(count) {
  if (count <= 1) return { s: 8.4, spots: [[116, 48]] };
  if (count === 2) return { s: 6.6, spots: [[56, 58], [212, 58]] };
  if (count === 3) return { s: 4.8, spots: [[42, 67], [152, 67], [262, 67]] };
  return { s: 4.2, spots: [[108, 44], [208, 44], [108, 96], [208, 96]] };
}

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function PlayerDot({ cx, cy, r, player, clipId }) {
  if (!player) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="rgba(255,255,255,0.10)"
        stroke="#fff"
        strokeOpacity="0.8"
        strokeWidth={Math.max(1.1, r * 0.13)}
        strokeDasharray={`${r * 0.34} ${r * 0.28}`}
      />
    );
  }
  const avatar = String(player.avatar || '').trim();
  const ring = Math.max(1.4, r * 0.16);
  if (isAvatarUrl(avatar)) {
    return (
      <g>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <circle cx={cx} cy={cy} r={r} fill="#F2A93B" />
        <image
          href={avatar}
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeWidth={ring} />
      </g>
    );
  }
  const emoji = avatar && avatar.length <= 8 ? avatar : '';
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={emoji ? '#fff' : '#F2A93B'} stroke="#F2A93B" strokeWidth={ring} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={emoji ? r * 1.15 : r * 0.9}
        fontWeight="800"
        fill="#0D2752"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
      >
        {emoji || initialsOf(player.name)}
      </text>
    </g>
  );
}

/**
 * Én bane. positions: [hold 1 øverst, hold 1 nederst, hold 2 øverst, hold 2 nederst];
 * hver er { name, avatar } eller null (ledig). Uden positions vises ingen pladser.
 */
function Court({ x, y, s, positions, idBase }) {
  const L = 20 * s;
  const W = 10 * s;
  const net = x + L / 2;
  const svc = 6.95 * s; // servelinjen ligger 6,95 m fra nettet
  const glass = 4 * s; // glas i enden og 4 m ind langs siden
  const midY = y + W / 2;
  const r = Math.min(13, s * 1.5);
  const spots = [
    [net - svc / 2, y + W / 4],
    [net - svc / 2, y + (3 * W) / 4],
    [net + svc / 2, y + W / 4],
    [net + svc / 2, y + (3 * W) / 4],
  ];
  return (
    <g>
      <rect x={x} y={y} width={L} height={W} fill="#2E6BC4" />
      <rect x={net - svc} y={y} width={svc * 2} height={W} fill="#3478D2" />
      <g stroke="#fff" strokeWidth={Math.max(1.1, s * 0.14)} fill="none" strokeLinecap="round">
        <rect x={x} y={y} width={L} height={W} />
        <line x1={net - svc} y1={y} x2={net - svc} y2={y + W} />
        <line x1={net + svc} y1={y} x2={net + svc} y2={y + W} />
        <line x1={net - svc} y1={midY} x2={net + svc} y2={midY} />
      </g>
      <line x1={net} y1={y - s * 0.5} x2={net} y2={y + W + s * 0.5} stroke="#fff" strokeWidth={Math.max(1.8, s * 0.26)} strokeLinecap="round" />
      <g stroke="#9FD3FF" strokeOpacity="0.85" strokeWidth={Math.max(2, s * 0.32)} strokeLinecap="round" fill="none">
        <path d={`M${x + glass} ${y} H${x} V${y + W} H${x + glass}`} />
        <path d={`M${x + L - glass} ${y} H${x + L} V${y + W} H${x + L - glass}`} />
      </g>
      <g stroke="#fff" strokeOpacity="0.45" strokeWidth={Math.max(0.9, s * 0.12)} strokeDasharray={`${s * 0.3} ${s * 0.35}`}>
        <line x1={x + glass} y1={y} x2={x + L - glass} y2={y} />
        <line x1={x + glass} y1={y + W} x2={x + L - glass} y2={y + W} />
      </g>
      {positions
        ? spots.map(([cx, cy], i) => (
            <PlayerDot key={i} cx={cx} cy={cy} r={r} player={positions[i] || null} clipId={`${idBase}-${i}`} />
          ))
        : null}
    </g>
  );
}

/**
 * @param {{
 *   className?: string,
 *   courts?: number,
 *   players?: ({ name?: string, avatar?: string | null } | null)[] | null,
 * }} props
 * players: pladserne i rækkefølge, 4 pr. bane (se Court). null = vis ingen pladser.
 */
export function PadelCourtTopView({ className, courts = 1, players = null }) {
  const rawId = useId();
  const uid = `pmct${String(rawId).replace(/[^a-zA-Z0-9]/g, '')}`;
  const count = Math.max(1, Math.min(4, Math.floor(Number(courts)) || 1));
  const { s, spots } = courtLayout(count);
  return (
    <svg className={className} viewBox="0 0 400 176" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B4380" />
          <stop offset="1" stopColor="#0D2850" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="55%" r="55%">
          <stop offset="0" stopColor="#3B78C0" stopOpacity="0.45" />
          <stop offset="1" stopColor="#3B78C0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="176" fill={`url(#${uid}-bg)`} />
      <rect width="400" height="176" fill={`url(#${uid}-glow)`} />
      {spots.map(([x, y], c) => (
        <Court
          key={c}
          x={x}
          y={y}
          s={s}
          idBase={`${uid}-c${c}`}
          positions={players ? [0, 1, 2, 3].map((k) => players[c * 4 + k] || null) : null}
        />
      ))}
    </svg>
  );
}
