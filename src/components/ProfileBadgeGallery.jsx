import { useState } from 'react';
import { AppModal } from './AppModal';
import { theme, btn } from '../lib/platformTheme';
import { groupProfileBadgesByCategory } from '../lib/profileBadges';

const PREVIEW_LIMIT = 5;

function BadgeItem({ badge, compact = false }) {
  const size = compact ? 40 : 48;
  const fontSize = compact ? 17 : 20;

  return (
    <div
      style={{
        textAlign: 'center',
        flex: compact ? '0 0 56px' : '0 0 68px',
        minWidth: compact ? 56 : 68,
      }}
      aria-label={badge.earned ? `${badge.label} — opnået` : `${badge.label} — ${badge.hint}`}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          fontSize,
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
          fontSize: compact ? 9 : 10,
          fontWeight: 600,
          marginTop: compact ? 4 : 5,
          color: badge.earned ? theme.textMid : theme.textLight,
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {badge.label}
      </span>
      {!compact && (
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
      )}
    </div>
  );
}

function pickPreviewBadges(badges, limit = PREVIEW_LIMIT) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);
  if (earned.length >= limit) return earned.slice(0, limit);
  return [...earned, ...locked.slice(0, limit - earned.length)];
}

function ProfileBadgeGalleryFull({ badges }) {
  const groups = groupProfileBadgesByCategory(badges);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {groups.map((group) => (
        <div key={group.category}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: theme.textLight,
              marginBottom: 10,
            }}
          >
            {group.label}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {group.badges.map((badge) => (
              <BadgeItem key={badge.key} badge={badge} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileBadgeGallery({ badges, modeLabel }) {
  const [open, setOpen] = useState(false);

  if (!badges?.length) return null;

  const earnedCount = badges.filter((b) => b.earned).length;
  const previewBadges = pickPreviewBadges(badges);
  const hasMore = badges.length > previewBadges.length;

  return (
    <>
      <div style={{ marginTop: 4, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
          <h3 style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.2px', color: theme.text, margin: 0 }}>
            Badges
          </h3>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              color: theme.accent,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Se alle ({earnedCount}/{badges.length})
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 2,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {previewBadges.map((badge) => (
            <BadgeItem key={badge.key} badge={badge} compact />
          ))}
          {hasMore ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Se alle ${badges.length} badges`}
              style={{
                flex: '0 0 56px',
                minWidth: 56,
                textAlign: 'center',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: theme.surfaceAlt,
                  border: `1px dashed ${theme.border}`,
                  color: theme.textMid,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                +{badges.length - previewBadges.length}
              </div>
              <span style={{ display: 'block', fontSize: 9, fontWeight: 600, marginTop: 4, color: theme.textLight }}>
                Flere
              </span>
            </button>
          ) : null}
        </div>
      </div>

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel={`Badges for ${modeLabel}`}
        maxWidthPreset="sm"
        contentStyle={{ maxHeight: 'min(82vh, 720px)', overflowY: 'auto', padding: '18px 16px 12px' }}
        footer={(
          <div style={{ padding: '12px 16px 16px', borderTop: `1px solid ${theme.border}` }}>
            <button type="button" onClick={() => setOpen(false)} style={{ ...btn(false), width: '100%' }}>
              Luk
            </button>
          </div>
        )}
      >
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
            Badges · {modeLabel}
          </h2>
          <p style={{ margin: 0, fontSize: 12.5, color: theme.textMid, lineHeight: 1.45 }}>
            {earnedCount} af {badges.length} opnået. Låste badges viser hvad du kan sigte efter næste.
          </p>
        </div>
        <ProfileBadgeGalleryFull badges={badges} />
      </AppModal>
    </>
  );
}
