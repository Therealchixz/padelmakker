import { useLayoutEffect, useRef, useState } from 'react';
import { AppModal } from './AppModal';
import { theme } from '../lib/platformTheme';
import { groupProfileBadgesByCategory, PROFILE_BADGE_CATEGORY_LABELS } from '../lib/profileBadges';

const PREVIEW_LIMIT = 5;

function badgeDetailBody(badge) {
  if (badge.description) return badge.description;
  if (badge.earned) {
    return `Du har opnået dette ${badge.categoryLabel?.toLowerCase() || 'badge'}. Fortsæt med at spille for at samle flere.`;
  }
  return `Et ${badge.categoryLabel?.toLowerCase() || 'badge'}-mål du kan sigte mod. Opfyld kravet nedenfor for at låse det op.`;
}

function BadgeDetailPanel({ badge, onClose }) {
  if (!badge) return null;

  return (
    <div
      style={{
        background: badge.earned ? theme.accentBg : theme.surfaceAlt,
        border: `1px solid ${badge.earned ? theme.accent + '35' : theme.border}`,
        borderRadius: 14,
        padding: '14px 14px 12px',
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            background: badge.earned ? theme.navy : theme.surface,
            color: badge.earned ? 'var(--pm-on-accent)' : theme.textLight,
            border: badge.earned ? 'none' : `1px solid ${theme.border}`,
            boxShadow: badge.earned ? theme.shadow : 'none',
          }}
          aria-hidden
        >
          {badge.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, letterSpacing: '-0.2px' }}>{badge.label}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: theme.textLight, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {badge.categoryLabel || PROFILE_BADGE_CATEGORY_LABELS[badge.category] || badge.category}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Luk badge-detaljer"
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                padding: 2,
                fontFamily: 'inherit',
                fontSize: 18,
                lineHeight: 1,
                color: theme.textLight,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 8,
              fontSize: 10.5,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 999,
              background: badge.earned ? theme.greenBg : theme.surface,
              color: badge.earned ? theme.green : theme.textMid,
              border: `1px solid ${badge.earned ? theme.green + '40' : theme.border}`,
            }}
          >
            {badge.earned ? 'Opnået' : 'Ikke opnået endnu'}
          </div>
        </div>
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 12.5, color: theme.textMid, lineHeight: 1.5 }}>
        {badgeDetailBody(badge)}
      </p>
      <div
        style={{
          marginTop: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          fontSize: 12,
          color: theme.text,
          lineHeight: 1.45,
        }}
      >
        <span style={{ fontWeight: 700, color: theme.textMid }}>Krav: </span>
        {badge.hint}
      </div>
    </div>
  );
}

function BadgeItem({ badge, compact = false, selected = false, onSelect }) {
  const size = compact ? 40 : 48;
  const fontSize = compact ? 17 : 20;
  const interactive = typeof onSelect === 'function';

  const content = (
    <>
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
          border: selected
            ? `2px solid ${theme.accent}`
            : badge.earned
              ? 'none'
              : `1px solid ${theme.border}`,
          boxShadow: selected
            ? `0 0 0 3px ${theme.accentBg}`
            : badge.earned
              ? '0 2px 8px rgba(13, 39, 82, 0.18)'
              : 'none',
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
    </>
  );

  const wrapperStyle = {
    textAlign: 'center',
    flex: compact ? '0 0 56px' : '0 0 68px',
    minWidth: compact ? 56 : 68,
  };

  if (!interactive) {
    return (
      <div style={wrapperStyle} aria-label={badge.earned ? `${badge.label} — opnået` : `${badge.label} — ${badge.hint}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(badge)}
      style={{
        ...wrapperStyle,
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      aria-label={badge.earned ? `${badge.label} — opnået. Tryk for detaljer.` : `${badge.label} — ${badge.hint}. Tryk for detaljer.`}
      aria-pressed={selected}
    >
      {content}
    </button>
  );
}

function pickPreviewBadges(badges, limit = PREVIEW_LIMIT) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);
  if (earned.length >= limit) return earned.slice(0, limit);
  return [...earned, ...locked.slice(0, limit - earned.length)];
}

function ProfileBadgeGalleryFull({ badges, selectedKey, onSelectBadge }) {
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
              <BadgeItem
                key={badge.key}
                badge={badge}
                selected={selectedKey === badge.key}
                onSelect={onSelectBadge}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileBadgeGallery({ badges, modeLabel }) {
  const [open, setOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const scrollRef = useRef(null);

  const closeModal = () => {
    setOpen(false);
    setSelectedBadge(null);
  };

  const openModal = (badge = null) => {
    setSelectedBadge(badge);
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !selectedBadge) return;
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [open, selectedBadge?.key]);

  if (!badges?.length) return null;

  const earnedCount = badges.filter((b) => b.earned).length;
  const previewBadges = pickPreviewBadges(badges);
  const hasMore = badges.length > previewBadges.length;

  const handleSelectBadge = (badge) => {
    setSelectedBadge((prev) => (prev?.key === badge.key ? null : badge));
  };

  return (
    <>
      <div style={{ marginTop: 4, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
          <h3 style={{ fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.2px', color: theme.text, margin: 0 }}>
            Badges
          </h3>
          <button
            type="button"
            onClick={() => openModal()}
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
            <BadgeItem key={badge.key} badge={badge} compact onSelect={(b) => openModal(b)} />
          ))}
          {hasMore ? (
            <button
              type="button"
              onClick={() => openModal()}
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
        onClose={closeModal}
        ariaLabel={`Badges for ${modeLabel}`}
        maxWidthPreset="sm"
        contentStyle={{ overflow: 'hidden', maxHeight: 'min(82vh, 720px)' }}
      >
        <div ref={scrollRef} className="pm-modal-body" style={{ maxHeight: 'min(82vh, 720px)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: selectedBadge ? 10 : 14 }}>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.text, margin: '0 0 4px', letterSpacing: '-0.3px' }}>
                Badges · {modeLabel}
              </h2>
              <p style={{ margin: 0, fontSize: 12.5, color: theme.textMid, lineHeight: 1.45 }}>
                {earnedCount} af {badges.length} opnået. Tryk på et badge for at læse mere.
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                padding: '2px 0',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                color: theme.accent,
                cursor: 'pointer',
              }}
            >
              Luk
            </button>
          </div>
          <BadgeDetailPanel badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
          <ProfileBadgeGalleryFull
            badges={badges}
            selectedKey={selectedBadge?.key}
            onSelectBadge={handleSelectBadge}
          />
        </div>
      </AppModal>
    </>
  );
}
