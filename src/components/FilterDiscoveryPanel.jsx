import { Bell, Zap } from 'lucide-react';
import { theme } from '../lib/platformTheme';
import { seekingVisibleDurationLabel, DISCOVERY_NOTIFY_DAILY_PER_CHANNEL } from '../lib/platformConstants';

function ToggleSwitch({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        background: checked ? theme.accent : theme.border,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: theme.surface,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

/**
 * Synlighed + notifikationer — øverst på filter-sider.
 * @param {'makker' | 'kamp'} channel
 * @param {{ notify: boolean, feedVisible: boolean }} prefs
 * @param {(patch: object) => void} onChange
 */
export function FilterDiscoveryPanel({ channel, prefs, onChange }) {
  const isKamp = channel === 'kamp';
  const durationLabel = seekingVisibleDurationLabel(isKamp ? 'kamp' : 'makker');
  const notifyHint = isKamp
    ? `Push og in-app når en ny kamp passer dit filter (max ${DISCOVERY_NOTIFY_DAILY_PER_CHANNEL} kamp-beskeder om dagen).`
    : `Push og in-app når en spiller søger makker og passer (max ${DISCOVERY_NOTIFY_DAILY_PER_CHANNEL} makker-beskeder om dagen).`;
  const visibleTitle = isKamp ? 'Vis at jeg søger kamp' : 'Vis at jeg søger makker';
  const visibleHint = isKamp
    ? `Andre kan se dig i aktivitetsfeed i ${durationLabel}. Slå fra når du har fundet kamp.`
    : `Andre kan finde dig under Find makker i ${durationLabel}. Slå fra når du har fundet makker.`;

  return (
    <div
      style={{
        background: theme.accentBg,
        border: `1px solid ${theme.accent}44`,
        borderRadius: 12,
        padding: '14px 14px 12px',
        marginBottom: 20,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: theme.accent,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: '0 0 10px',
        }}
      >
        Trin 1 · Bliv fundet
      </p>
      <p style={{ fontSize: 12, color: theme.textMid, lineHeight: 1.5, margin: '0 0 12px' }}>
        {isKamp
          ? 'Uden synlighed kan andre ikke se, at du mangler en kamp — og du får færre relevante matches.'
          : 'Uden synlighed kan andre ikke se, at du søger makker — du bliver usynlig i feedet.'}
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: theme.surface,
          border: `1px solid ${prefs.feedVisible ? theme.accent + '66' : theme.border}`,
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
          <Zap size={18} color={theme.warm} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{visibleTitle}</div>
            <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2, lineHeight: 1.4 }}>{visibleHint}</div>
          </div>
        </div>
        <ToggleSwitch
          checked={prefs.feedVisible}
          onChange={(next) => onChange({ feedVisible: next })}
          ariaLabel={prefs.feedVisible ? 'Skjul søger-synlighed' : 'Vis at jeg søger'}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 10,
          padding: '10px 12px',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
          <Bell size={18} color={theme.accent} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>Notifikationer</div>
            <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2, lineHeight: 1.4 }}>{notifyHint}</div>
          </div>
        </div>
        <ToggleSwitch
          checked={prefs.notify}
          onChange={(next) => onChange({ notify: next })}
          ariaLabel={prefs.notify ? 'Slå notifikationer fra' : 'Slå notifikationer til'}
        />
      </div>
    </div>
  );
}
