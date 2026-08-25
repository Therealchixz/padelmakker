import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clock, Users } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { AvatarCircle } from '../components/AvatarCircle';
import { btn, font, heading, theme } from '../lib/platformTheme';

const PLAYERS = [
  { id: 'mike', avatar: '🎾', name: 'Mike Pedersen', first: 'Mike', me: true, accepted: true, level: '3.5' },
  { id: 'kevin', avatar: '🔥', name: 'Kevin Rastung', first: 'Kevin', me: false, accepted: true, level: '3.2' },
  { id: 'storm', avatar: '⚡', name: 'Storm Claësson', first: 'Storm', me: false, accepted: false, level: '3.0' },
  { id: 'tim', avatar: '🦁', name: 'Tim Lionett', first: 'Tim', me: false, accepted: false, level: '2.5' },
];

function statusLabel(p) {
  if (p.me && p.shownAccepted) return 'Dig · har sagt ja';
  if (p.me) return 'Dig';
  if (p.shownAccepted) return 'Har sagt ja';
  return 'Afventer';
}

function playerState(waiting) {
  return PLAYERS.map((p) => ({
    ...p,
    shownAccepted: waiting ? p.accepted : false,
  }));
}

function CardShell({ children }) {
  return (
    <div
      style={{
        border: `1.5px solid ${theme.accent}`,
        borderRadius: 14,
        padding: '14px 16px',
        background: 'var(--pm-surface-muted)',
      }}
    >
      {children}
    </div>
  );
}

function Actions({ waiting }) {
  if (waiting) {
    return (
      <button type="button" style={{ ...btn(false), width: '100%' }}>
        Kan alligevel ikke
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        style={{
          ...btn(true),
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Check size={15} /> Jeg er med
      </button>
      <button type="button" style={{ ...btn(false), flex: 1 }}>
        Kan ikke
      </button>
    </div>
  );
}

function Deadline({ style }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        marginBottom: 12,
        padding: '3px 9px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        color: theme.textMid,
        border: `1px solid ${theme.border}`,
        ...style,
      }}
    >
      <Clock size={12} /> 2 timer tilbage
    </div>
  );
}

function VariantA({ waiting }) {
  const players = playerState(waiting);
  return (
    <CardShell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Users size={15} color={theme.accent} />
        <strong style={{ fontSize: 14, color: theme.text }}>
          {waiting ? 'Du er med — venter på de andre' : 'I er 4 — bekræft jeres kamp'}
        </strong>
      </div>
      <div style={{ fontSize: 13, color: theme.textMid, marginBottom: 12 }}>
        Tir 25/8 kl. 19:00–20:30 · Nordjylland
        {waiting ? ' · mangler 2 svar' : ''}
      </div>
      <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {players.map((p) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AvatarCircle avatar={p.avatar} size={32} emojiSize="15px" alt={p.name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: p.me ? 700 : 600,
                  color: theme.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </div>
              <div style={{ fontSize: 11, color: theme.textLight }}>
                {statusLabel(p)} · Niveau {p.level}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Deadline />
      <Actions waiting={waiting} />
    </CardShell>
  );
}

function VariantB({ waiting }) {
  const players = playerState(waiting);
  const yesCount = players.filter((p) => p.shownAccepted).length;
  return (
    <CardShell>
      <strong style={{ display: 'block', fontSize: 14, color: theme.text, marginBottom: 4 }}>
        {waiting ? 'Du er med — venter på de andre' : 'I er 4 — bekræft jeres kamp'}
      </strong>
      <div style={{ fontSize: 13, color: theme.textMid, marginBottom: 12 }}>
        Tir 25/8 · 19:00–20:30 · Nordjylland
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 12 }}>
        {players.map((p) => (
          <div key={p.id} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <AvatarCircle
                avatar={p.avatar}
                size={36}
                emojiSize="16px"
                alt={p.name}
                style={{
                  border: `2px solid ${p.shownAccepted ? 'var(--pm-green)' : theme.border}`,
                }}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: p.me ? 700 : 600,
                color: theme.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {p.first}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                fontWeight: 700,
                color: p.shownAccepted ? 'var(--pm-green)' : theme.textLight,
              }}
            >
              {p.shownAccepted ? 'Ja' : 'Venter'}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: 999,
            border: `1px solid ${theme.border}`,
            color: theme.textMid,
          }}
        >
          {yesCount} af 4 har sagt ja
        </span>
        <Deadline style={{ marginBottom: 0 }} />
      </div>
      <Actions waiting={waiting} />
    </CardShell>
  );
}

function VariantC({ waiting }) {
  const players = playerState(waiting);
  const yesCount = players.filter((p) => p.shownAccepted).length;
  return (
    <CardShell>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <strong style={{ display: 'block', fontSize: 14, color: theme.text }}>
            {waiting ? 'Venter på de andre' : 'Bekræft jeres kamp'}
          </strong>
          <div style={{ fontSize: 13, color: theme.textMid, marginTop: 2 }}>Tir 25/8 kl. 19:00–20:30</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: theme.accent, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {yesCount}/4
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: theme.textLight, marginTop: 2 }}>har sagt ja</div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 10,
        }}
      >
        {players.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 10,
              borderRadius: 10,
              border: `1px solid ${p.shownAccepted ? 'var(--pm-success-border)' : theme.border}`,
              background: p.shownAccepted ? 'var(--pm-green-bg)' : theme.surface,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AvatarCircle avatar={p.avatar} size={32} emojiSize="15px" alt={p.name} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: theme.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.me ? `${p.first} (dig)` : p.first}
              </div>
              <div style={{ fontSize: 11, color: p.shownAccepted ? 'var(--pm-green)' : theme.textLight }}>
                {p.shownAccepted ? 'Ja' : 'Venter'}
              </div>
              <div style={{ fontSize: 11, color: theme.textMid }}>Niveau {p.level}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 12 }}>Nordjylland · 2 timer tilbage</div>
      <Actions waiting={waiting} />
    </CardShell>
  );
}

function VariantD({ waiting }) {
  const players = playerState(waiting);
  const awaiting = players.filter((p) => !p.shownAccepted);
  return (
    <CardShell>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <strong style={{ display: 'block', fontSize: 14, color: theme.text }}>Tir 25/8 · 19:00–20:30</strong>
          <div style={{ fontSize: 13, color: theme.textMid, marginTop: 2 }}>Nordjylland · 4 spillere</div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 9px',
            borderRadius: 999,
            background: waiting ? 'var(--pm-blue-bg)' : 'var(--pm-amber-bg)',
            color: waiting ? theme.blue : 'var(--pm-amber-text)',
            whiteSpace: 'nowrap',
          }}
        >
          {waiting ? 'Du har sagt ja' : 'Svar nu'}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {players.map((p) => (
          <span
            key={p.id}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: 999,
              background: p.shownAccepted ? 'var(--pm-green-bg)' : theme.surface,
              color: p.shownAccepted ? 'var(--pm-green)' : theme.textMid,
              border: `1px solid ${p.shownAccepted ? 'var(--pm-success-border)' : theme.border}`,
            }}
          >
            {p.first} · {p.shownAccepted ? 'ja' : 'venter'}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 13, color: theme.textMid, marginBottom: 12 }}>
        {waiting
          ? `Mangler svar fra ${awaiting.map((p) => p.first).join(' og ')}.`
          : '2 timer tilbage — bekræft hvis du kan.'}
      </div>
      <Actions waiting={waiting} />
    </CardShell>
  );
}

const VARIANTS = [
  { id: 'A', title: 'A · Liste', hint: 'Som nu — navne under hinanden', Component: VariantA },
  { id: 'B', title: 'B · Avatar-række', hint: 'Fire ansigter ved siden af hinanden', Component: VariantB },
  { id: 'C', title: 'C · Fire fliser', hint: '2×2 med navn, ja/venter og niveau', Component: VariantC },
  { id: 'D', title: 'D · Kompakt', hint: 'Tid først, fylder mindst på Hjem', Component: VariantD },
];

export function ProposalDesignPreviewPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [waiting, setWaiting] = useState(true);
  const backPath = session ? '/dashboard/hjem' : '/';

  return (
    <div
      style={{
        fontFamily: font,
        background: theme.bg,
        minHeight: '100dvh',
        color: theme.text,
        padding:
          'max(16px, env(safe-area-inset-top)) 16px max(32px, calc(env(safe-area-inset-bottom) + 24px))',
      }}
    >
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => navigate(backPath)}
          style={{ ...btn(false), marginBottom: 18, padding: '8px 14px', fontSize: 13 }}
        >
          {session ? '← Til Hjem' : '← Til forsiden'}
        </button>

        <h1 style={{ ...heading('22px'), margin: '0 0 8px' }}>Vælg kasse til kamp-forslag</h1>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: theme.textMid, lineHeight: 1.5 }}>
          Samme indhold, fire layouts. Sig A, B, C eller D — så lægger jeg den ind på Hjem.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          <button type="button" onClick={() => setWaiting(true)} style={{ ...btn(waiting), flex: 1, fontSize: 13 }}>
            Efter du har sagt ja
          </button>
          <button type="button" onClick={() => setWaiting(false)} style={{ ...btn(!waiting), flex: 1, fontSize: 13 }}>
            Før du har svaret
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {VARIANTS.map(({ id, title, hint, Component }) => (
            <section key={id}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{title}</div>
                <div style={{ fontSize: 12, color: theme.textLight }}>{hint}</div>
              </div>
              <Component waiting={waiting} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
