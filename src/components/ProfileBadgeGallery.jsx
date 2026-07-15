import { theme } from '../lib/platformTheme';
import { groupProfileBadgesByCategory } from '../lib/profileBadges';

function BadgeItem({ badge }) {
  return (
    <div
      style={{ textAlign: 'center', flex: '0 0 68px', minWidth: 68 }}
      aria-label={badge.earned ? `${badge.label} — opnået` : `${badge.label} — ${badge.hint}`}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          fontSize: 20,
          lineHeight: 1,
          opacity: badge.earned ? 1 : 0.42,
          background: badge.earned ? theme.navy : theme.surfaceAlt,
          color: badge.earned ? 'var(--pm-on-accent)' : theme.textLight,
          border: badge.earned ? 'none' : `1px solid ${theme.border}`,
          boxShadow: badge.earned ? '0 2px 8px rgba(13, 39, 82, 0.18)' : 'none',
        }}
      >
        <span aria-hidden>{badge.icon}</span>
      </div>
      <span
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 600,
          marginTop: 5,
          color: badge.earned ? theme.textMid : theme.textLight,
          lineHeight: 1.2,
        }}
      >
        {badge.label}
      </span>
      <span
        style={{
          display: 'block',
          fontSize: 8.5,
          lineHeight: 1.25,
          marginTop: 2,
          color: badge.earned ? theme.green : theme.textLight,
        }}
      >
        {badge.earned ? 'Opnået' : badge.hint}
      </span>
    </div>
  );
}

export function ProfileBadgeGallery({ badges, modeLabel }) {
  if (!badges?.length) return null;

  const earnedCount = badges.filter((b) => b.earned).length;
  const groups = groupProfileBadgesByCategory(badges);

  return (
    <div style={{ marginTop: 4, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.2px', color: theme.text, margin: 0 }}>
          Badges · {modeLabel}
        </h3>
        <span style={{ fontSize: 11.5, color: theme.textLight, fontWeight: 600 }}>
          {earnedCount}/{badges.length} opnået
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map((group) => (
          <div key={group.category}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: theme.textLight,
                marginBottom: 8,
              }}
            >
              {group.label}
            </div>
            <div
              className="pm-profile-badges-scroll"
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 2,
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {group.badges.map((badge) => (
                <BadgeItem key={badge.key} badge={badge} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
