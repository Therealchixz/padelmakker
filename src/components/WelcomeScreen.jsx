import { Users, Swords, Compass, ArrowRight, Check } from 'lucide-react';
import { theme, font } from '../lib/platformTheme';

/**
 * Velkommen-skærm efter onboarding (første login). Viser en kort hilsen og
 * 3 "kom godt i gang"-genveje. Vises kun én gang.
 */
export function WelcomeScreen({ name, levelText, onFindPartner, onJoinMatch, onStartTour, onGoToApp }) {
  const firstName = String(name || '').trim().split(/\s+/)[0] || 'spiller';

  const cards = [
    { icon: <Users size={18} />, title: 'Find din første makker', desc: 'Match med spillere på dit niveau i nærheden.', onClick: onFindPartner },
    { icon: <Swords size={18} />, title: 'Meld dig på en åben kamp', desc: 'Hop med i en 2v2-kamp, americano eller liga.', onClick: onJoinMatch },
    { icon: <Compass size={18} />, title: 'Tag den guidede rundtur', desc: 'Et hurtigt overblik over appen på 30 sekunder.', onClick: onStartTour },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Velkommen"
      style={{
        position: 'fixed', inset: 0, zIndex: 1300, background: theme.bg,
        display: 'flex', flexDirection: 'column', fontFamily: font,
        padding: 'max(28px, env(safe-area-inset-top)) 22px max(24px, env(safe-area-inset-bottom))',
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 460, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: theme.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: theme.shadow }}>
            <Check size={32} strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: theme.text, margin: 0 }}>
            Velkommen, {firstName}!
          </h1>
          <p style={{ fontSize: 13.5, color: theme.textMid, marginTop: 8, lineHeight: 1.5 }}>
            Din profil er klar{levelText ? ` — du starter på niveau ${levelText}` : ''}. Sådan kommer du hurtigt i gang:
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          {cards.map((c) => (
            <button
              key={c.title}
              type="button"
              onClick={c.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left',
                background: theme.surface, border: '1px solid ' + theme.border, borderRadius: 14,
                padding: '14px 16px', cursor: 'pointer', fontFamily: font, width: '100%',
                boxShadow: theme.shadowSoft || 'none',
              }}
            >
              <span style={{ width: 40, height: 40, borderRadius: 10, background: theme.accentBg, color: theme.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {c.icon}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: theme.text }}>{c.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: theme.textMid, marginTop: 2, lineHeight: 1.4 }}>{c.desc}</span>
              </span>
              <ArrowRight size={16} color={theme.textLight} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <button
            type="button"
            onClick={onGoToApp}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: theme.navy, color: '#fff', fontSize: 14.5, fontWeight: 700,
              cursor: 'pointer', fontFamily: font,
            }}
          >
            Gå til appen
          </button>
        </div>
      </div>
    </div>
  );
}
