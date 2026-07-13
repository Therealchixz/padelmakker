import { memo } from 'react';
import { MapPin } from 'lucide-react';
import { theme, tag } from '../lib/platformTheme';
import { availabilityTags } from '../lib/platformUtils';
import { calcAge, normalizeStringArrayField } from '../lib/profileUtils';
import { profileLevelDisplayText, formatPlaytomicLevel } from '../lib/padelLevelUtils';
import { getPlayerSeekingDetails, seekingActivityLabelDisplay } from '../lib/seekingActivityLabel';
import { isProfileMatchFeedVisible, isProfileMakkerFeedVisible } from '../lib/seekingFeedTtl';
import { DAYS_OF_WEEK } from '../lib/platformConstants';
import { AvatarCircle } from '../components/AvatarCircle';
import { resolveAmericanoEloDisplay } from '../features/americano/americanoDisplayUtils';

function InfoRow({ label, value }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      <span style={{ color: theme.textLight, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: theme.surfaceAlt,
        borderRadius: 10,
        border: `1px solid ${theme.border}`,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: theme.textLight,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

const COURT_SIDE_LABELS = {
  backhand: 'Venstre side',
  forehand: 'Højre side',
  both: 'Begge sider',
};

/**
 * Read-only profiloversigt i admin — samme kerneinformation som Find makker / profil-modal.
 */
export const AdminUserProfileOverview = memo(function AdminUserProfileOverview({ profile, formatDateTime }) {
  if (!profile) return null;

  const p = profile;
  const games = Number(p.games_played) || 0;
  const wins = Number(p.games_won) || 0;
  const winPct = games > 0 ? `${Math.round((wins / games) * 100)}%` : '—';
  const age = calcAge(p.birth_year, p.birth_month, p.birth_day);
  const location = [p.city, p.area].filter(Boolean).join(', ') || null;
  const levelDisplay = profileLevelDisplayText(p.level);
  const americanoElo = resolveAmericanoEloDisplay(
    p._americanoEloDisplay ?? p.americano_elo_rating,
    p._americanoEloHistoryPreview,
  );
  const amPlayed = Number(p.americano_played) || 0;
  const seekingDetails = getPlayerSeekingDetails(p);
  const avail = availabilityTags(p);
  const days = normalizeStringArrayField(p.available_days);
  const courtLabel = COURT_SIDE_LABELS[p.court_side] || p.court_side || null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
        <AvatarCircle avatar={p.avatar || '🎾'} size={56} emojiSize="28px" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, wordBreak: 'break-word' }}>
            {p.full_name || p.name || 'Spiller'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
            {p.elo_rating != null ? (
              <span style={tag(theme.accentBg, theme.accent)}>2v2 ELO {p.elo_rating}</span>
            ) : null}
            <span style={tag(theme.blueBg, theme.blue)}>Americano/Mexicano ELO {americanoElo}</span>
            {age ? <span style={tag(theme.blueBg, theme.blue)}>{age} år</span> : null}
            {location ? (
              <span style={tag(theme.warmBg, theme.amberText)}>
                <MapPin size={9} aria-hidden /> {location}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <Section title="Konto">
        <InfoRow label="E-mail" value={p.email || '—'} />
        <InfoRow label="Rolle" value={p.role || 'player'} />
        <InfoRow label="Oprettet" value={formatDateTime?.(p.created_at) || '—'} />
        <InfoRow label="Sidst aktiv" value={formatDateTime?.(p.last_active_at) || '—'} />
        {p.is_banned ? (
          <InfoRow label="Status" value={p.ban_reason ? `Udelukket: ${p.ban_reason}` : 'Udelukket'} />
        ) : (
          <InfoRow label="Status" value="Aktiv" />
        )}
        <InfoRow
          label="Telefon-SMS"
          value={p.phone_verification_exempt ? 'Undtaget (test)' : 'Påkrævet ved login'}
        />
      </Section>

      <Section title="Profil">
        <InfoRow
          label="Niveau (præcis)"
          value={levelDisplay || (p.level != null ? formatPlaytomicLevel(p.level) : null)}
        />
        <InfoRow label="Spillestil" value={p.play_style || null} />
        <InfoRow label="Foretrukket side" value={courtLabel} />
        <InfoRow label="Område" value={p.area || null} />
        <InfoRow label="By" value={p.city || null} />
        {p.bio ? (
          <div style={{ fontSize: 13, color: theme.textMid, lineHeight: 1.5, fontStyle: 'italic' }}>
            &ldquo;{p.bio}&rdquo;
          </div>
        ) : null}
      </Section>

      <Section title="Statistik (2v2)">
        <InfoRow label="ELO" value={p.elo_rating != null ? String(p.elo_rating) : null} />
        <InfoRow label="Kampe" value={games > 0 ? String(games) : games === 0 ? '0' : null} />
        <InfoRow label="Sejre" value={games > 0 ? String(wins) : games === 0 ? '0' : null} />
        <InfoRow label="Win %" value={winPct} />
      </Section>

      <Section title="Statistik (Americano/Mexicano)">
        <InfoRow label="ELO" value={String(americanoElo)} />
        <InfoRow label="Americano/Mexicano spillet" value={amPlayed > 0 ? String(amPlayed) : amPlayed === 0 ? '0' : null} />
        <InfoRow label="V / U / T" value={
          amPlayed > 0
            ? `${Number(p.americano_wins) || 0} / ${Number(p.americano_draws) || 0} / ${Number(p.americano_losses) || 0}`
            : null
        }
        />
      </Section>

      <Section title="Tilgængelighed">
        {avail.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {avail.map((a) => (
              <span key={a} style={tag(theme.accentBg, theme.accent)}>
                {a}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: theme.textMid }}>Ikke angivet</div>
        )}
        {days.length > 0 ? (
          <div>
            <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 6 }}>Spilledage</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {DAYS_OF_WEEK.map(({ key, label }) => {
                const active = days.includes(key);
                return (
                  <div
                    key={key}
                    className={active ? 'pm-day-pill pm-day-pill--active' : 'pm-day-pill pm-day-pill--inactive'}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Synlighed og søgning">
        <InfoRow
          label="Aktivitet"
          value={
            isProfileMatchFeedVisible(p) || isProfileMakkerFeedVisible(p)
              ? seekingActivityLabelDisplay(p)
              : 'Ikke synlig i feed'
          }
        />
        <InfoRow label="Søger kamp (flag)" value={p.seeking_match ? 'Ja' : 'Nej'} />
        <InfoRow
          label="Match-watch"
          value={p.match_watch_enabled ? 'Aktiv' : 'Nej'}
        />
        <InfoRow
          label="Makker-watch"
          value={p.makker_watch_enabled ? 'Aktiv' : 'Nej'}
        />
        {p.intent_now ? <InfoRow label="Intent nu" value={p.intent_now} /> : null}
        {seekingDetails?.blocks?.map((block) => (
          <div
            key={block.type}
            style={{
              fontSize: 12,
              color: theme.textMid,
              padding: '8px 10px',
              background: theme.surface,
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 4 }}>{block.label}</div>
            {block.sinceLabel ? (
              <div style={{ marginBottom: 4 }}>Siden: {block.sinceLabel}</div>
            ) : null}
            {(block.details?.length ? block.details : block.line ? [block.line] : []).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        ))}
      </Section>
    </div>
  );
});
