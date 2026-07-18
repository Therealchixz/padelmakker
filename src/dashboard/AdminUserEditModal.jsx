import { memo } from 'react';
import { X, Smartphone } from 'lucide-react';
import { AppModal } from '../components/AppModal';
import { PlaytomicLevelPicker } from '../components/PlaytomicLevelPicker';
import { AdminUserProfileOverview } from './AdminUserProfileOverview';
import { theme, btn, inputStyle, heading, labelStyle } from '../lib/platformTheme';
import { PLAY_STYLES, REGIONS, COURT_SIDES } from '../lib/platformConstants';
import { TOURNAMENT_ELO_LABEL } from '../lib/tournamentCopy';

const ProfileOverview = memo(AdminUserProfileOverview);

/** Gamle værdier (backhand/forehand/both) → samme labels som profil/onboarding. */
function courtSideForEdit(value) {
  if (!value) return '';
  if (COURT_SIDES.includes(value)) return value;
  const legacy = { backhand: 'Venstre side', forehand: 'Højre side', both: 'Begge sider' };
  return legacy[value] || '';
}

export function AdminUserEditModal({
  open,
  loading,
  saving,
  user,
  profileOverview,
  formatDateTime,
  onClose,
  onChange,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      ariaLabel="Rediger spiller"
      maxWidthPreset="sm"
      zIndex={1000}
      contentStyle={{
        maxHeight: 'min(90dvh, 900px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      backdropStyle={{
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }}
    >
      {loading && !user ? (
        <div className="pm-admin-modal-body" style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div className="pm-spinner" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, color: theme.textMid }}>Henter opdateret profil…</div>
        </div>
      ) : null}
      {user ? (
        <div className="pm-admin-modal-scroll pm-admin-modal-body">
          <button
            type="button"
            onClick={onClose}
            className="pm-admin-modal-close"
            aria-label="Luk redigering"
          >
            <X size={20} />
          </button>
          <h3 style={{ ...heading('18px'), marginBottom: '8px' }}>Rediger spiller</h3>
          <p className="pm-admin-help-copy" style={{ marginBottom: '12px' }}>
            Profil hentes frisk fra databasen. Felter nedenfor kan redigeres; fold profiloversigt sammen for hurtigere scroll.
          </p>

          <details className="pm-admin-profile-overview-fold">
            <summary className="pm-admin-profile-overview-fold-summary">Profiloversigt (som Find makker)</summary>
            <ProfileOverview profile={profileOverview ?? user} formatDateTime={formatDateTime} />
          </details>

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
            Rediger felter
          </div>

          <form onSubmit={onSubmit} className="pm-admin-form-stack">
            <div className="pm-admin-form-elo-block">
              <div>
                <label style={{ ...labelStyle, marginBottom: '4px', display: 'block' }}>Fulde Navn</label>
                <input
                  type="text"
                  value={user.full_name ?? user.name ?? ''}
                  onChange={(e) => onChange({ ...user, full_name: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, marginBottom: '4px', display: 'block' }}>2v2-ELO</label>
                <input
                  type="number"
                  value={user.elo_rating}
                  onChange={(e) => onChange({ ...user, elo_rating: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="pm-admin-label-nowrap" style={{ ...labelStyle, marginBottom: '4px', display: 'block' }}>
                  {TOURNAMENT_ELO_LABEL}
                </label>
                <input
                  type="number"
                  value={user.americano_elo_rating}
                  onChange={(e) => onChange({ ...user, americano_elo_rating: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="pm-admin-form-grid-2">
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ ...labelStyle, marginBottom: '6px', display: 'block' }}>Niveau (Playtomic)</label>
                <PlaytomicLevelPicker
                  value={user.level}
                  onChange={(n) => onChange({ ...user, level: n })}
                />
              </div>
            </div>

            <div>
              <label style={{ ...labelStyle, marginBottom: '4px', display: 'block' }}>Foretrukket side</label>
              <select
                value={courtSideForEdit(user.court_side)}
                onChange={(e) => onChange({ ...user, court_side: e.target.value || null })}
                style={inputStyle}
              >
                <option value="">Ikke valgt</option>
                {COURT_SIDES.map((side) => (
                  <option key={side} value={side}>
                    {side}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ ...labelStyle, marginBottom: '4px', display: 'block' }}>Område</label>
              <select
                value={user.area || ''}
                onChange={(e) => onChange({ ...user, area: e.target.value })}
                style={inputStyle}
              >
                <option value="" disabled>
                  Vælg område
                </option>
                {REGIONS.map((regionOption) => (
                  <option key={regionOption} value={regionOption}>
                    {regionOption}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ ...labelStyle, marginBottom: '4px', display: 'block' }}>Spillestil</label>
              <select
                value={user.play_style || ''}
                onChange={(e) => onChange({ ...user, play_style: e.target.value })}
                style={inputStyle}
              >
                <option value="" disabled>
                  Vælg spillestil
                </option>
                {PLAY_STYLES.map((styleOption) => (
                  <option key={styleOption} value={styleOption}>
                    {styleOption}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ ...labelStyle, marginBottom: '4px', display: 'block' }}>Bio / Om mig</label>
              <textarea
                value={user.bio || ''}
                onChange={(e) => onChange({ ...user, bio: e.target.value })}
                style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
              />
            </div>

            <div className={`pm-admin-panel-box ${user.is_banned ? 'pm-admin-panel-box--danger' : ''}`}>
              <div className="pm-admin-panel-head">
                <div>
                  <div className={`pm-admin-panel-title ${user.is_banned ? 'pm-admin-panel-title--danger' : ''}`}>
                    {user.is_banned ? 'Brugeren er UDELUKKET' : 'Status: Aktiv'}
                  </div>
                  <div className="pm-admin-panel-copy">
                    {user.is_banned ? 'Brugeren kan ikke logge ind.' : 'Brugeren har normal adgang.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onChange({ ...user, is_banned: !user.is_banned })}
                  className="pm-admin-action-chip"
                  style={{
                    ...btn(user.is_banned),
                    background: user.is_banned ? theme.accent : theme.red,
                    borderColor: user.is_banned ? theme.accent : theme.red,
                  }}
                >
                  {user.is_banned ? 'Ophæv ban' : 'Udeluk spiller'}
                </button>
              </div>

              {user.is_banned ? (
                <div style={{ marginTop: '12px' }}>
                  <label style={{ ...labelStyle, marginBottom: '4px', display: 'block' }}>
                    Begrundelse (vises til spilleren)
                  </label>
                  <textarea
                    value={user.ban_reason || ''}
                    onChange={(e) => onChange({ ...user, ban_reason: e.target.value })}
                    placeholder="Skriv hvorfor spilleren er udelukket..."
                    style={{
                      ...inputStyle,
                      minHeight: '50px',
                      fontSize: '12px',
                      background: theme.surface,
                      borderColor: `${theme.red}40`,
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className={`pm-admin-panel-box ${user.phone_verification_exempt ? 'pm-admin-panel-box--accent' : ''}`}>
              <div className="pm-admin-panel-head pm-admin-panel-head--start">
                <Smartphone
                  size={16}
                  style={{
                    color: user.phone_verification_exempt ? theme.accent : theme.textLight,
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className={`pm-admin-panel-title ${user.phone_verification_exempt ? 'pm-admin-panel-title--accent' : ''}`}
                  >
                    {user.phone_verification_exempt
                      ? 'Ingen telefon-SMS påkrævet'
                      : 'Telefon-SMS påkrævet ved login'}
                  </div>
                  <div className="pm-admin-panel-copy">
                    {user.phone_verification_exempt
                      ? 'Brugeren kan bruge appen uden bekræftet telefonnummer (fx testkonto).'
                      : 'Brugeren skal bekræfte telefonnummer med SMS, hvis de mangler det ved login.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...user,
                      phone_verification_exempt: !user.phone_verification_exempt,
                    })
                  }
                  className="pm-admin-action-chip"
                  style={{
                    ...btn(user.phone_verification_exempt),
                    background: user.phone_verification_exempt ? theme.textMid : theme.accent,
                    borderColor: user.phone_verification_exempt ? theme.textMid : theme.accent,
                    flexShrink: 0,
                  }}
                >
                  {user.phone_verification_exempt ? 'Kræv telefon igen' : 'Undtag (test)'}
                </button>
              </div>
            </div>

            <div className="pm-admin-form-actions">
              <button type="button" onClick={onClose} style={{ ...btn(false), flex: 1 }} disabled={loading || saving}>
                Annuller
              </button>
              <button type="submit" style={{ ...btn(true), flex: 1 }} disabled={loading || saving}>
                {saving ? 'Gemmer...' : 'Gem ændringer'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppModal>
  );
}
