import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MapPin, CalendarDays, Users, Trophy } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { formatMatchDateDa, formatTimeSlotDa } from '../lib/matchDisplayUtils';
import { buildKampeAmericanoDetailPath } from '../lib/kampeDetailRoutes';
import { buildPublicTournamentPath } from '../lib/publicShareRoutes';
import { authReturnSignupUrl } from '../lib/authReturnPath';
import { applyPublicShareMeta } from '../lib/publicShareMeta';
import { getTournamentFormatLabel } from '../features/americano/americanoDisplayUtils';

function statusLabel(status) {
  if (status === 'playing') return { text: 'I gang', tone: theme.warm };
  return { text: 'Tilmelding åben', tone: theme.green };
}

export function PublicTournamentPage() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured || !tournamentId) {
        setLoading(false);
        setError('konfiguration');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcErr } = await supabase.rpc('public_americano_preview', { p_tournament_id: tournamentId });
        if (cancelled) return;
        if (rpcErr) throw rpcErr;
        if (!data?.found) {
          setRow(null);
          setError(data?.reason === 'past' ? 'past' : 'missing');
        } else {
          setRow(data);
        }
      } catch (e) {
        if (!cancelled) {
          setRow(null);
          setError(e?.message || 'fetch');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tournamentId]);

  useEffect(() => {
    if (!row) return;
    const when = row.tournament_date ? formatMatchDateDa(row.tournament_date) : '';
    applyPublicShareMeta({
      pathname: buildPublicTournamentPath(row.id),
      title: `${row.name}${when ? ` · ${when}` : ''} | PadelMakker`,
      description: `${getTournamentFormatLabel(row.format)} på PadelMakker — ${row.participant_count}/${row.player_slots} tilmeldt. Opret gratis profil og deltag.`,
    });
  }, [row]);

  const ctaPrimary = () => {
    const returnPath = buildPublicTournamentPath(tournamentId);
    if (user && profile) {
      navigate(buildKampeAmericanoDetailPath(tournamentId));
      return;
    }
    navigate(authReturnSignupUrl(returnPath));
  };

  const ctaSecondary = () => {
    navigate(`/login?next=${encodeURIComponent(buildPublicTournamentPath(tournamentId))}`);
  };

  return (
    <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: '100dvh', color: theme.text, paddingBottom: 'max(96px, env(safe-area-inset-bottom))' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'max(16px, env(safe-area-inset-top)) clamp(16px, 4vw, 28px) 0' }}>
        <button type="button" onClick={() => navigate('/events')} style={{ ...btn(false), marginBottom: '20px', padding: '8px 14px', fontSize: '13px' }}>
          ← Alle events
        </button>

        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: theme.textMid }}>
            <div className="pm-spinner" style={{ margin: '0 auto 16px' }} />
            Henter turnering…
          </div>
        )}

        {!loading && error && error !== 'konfiguration' && (
          <div style={{ background: theme.surface, borderRadius: '14px', border: `1px solid ${theme.border}`, padding: '24px', boxShadow: theme.shadow }}>
            <h1 style={{ ...heading('22px'), margin: '0 0 10px' }}>Turneringen er ikke tilgængelig</h1>
            <p style={{ fontSize: '14px', color: theme.textMid, lineHeight: 1.6, margin: 0 }}>
              {error === 'past' ? 'Turneringen er afsluttet eller ligger i fortiden.' : 'Linket er ugyldigt, eller tilmeldingen er lukket.'}
            </p>
          </div>
        )}

        {!loading && row && (() => {
          const st = statusLabel(row.status);
          const formatLabel = getTournamentFormatLabel(row.format);
          return (
            <>
              <div style={{ background: theme.surface, borderRadius: '14px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow, padding: 'clamp(22px, 5vw, 32px)', marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: theme.accent, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  {formatLabel}
                </p>
                <h1 style={{ ...heading('clamp(22px, 5vw, 28px)'), margin: '0 0 12px', letterSpacing: '-0.02em' }}>
                  {row.name}
                </h1>
                <p style={{ fontSize: '15px', color: theme.textMid, lineHeight: 1.6, margin: '0 0 18px' }}>
                  Tilmeld dig turneringen på PadelMakker — vi viser ikke deltagernes navne her.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                  {row.tournament_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: theme.text }}>
                      <CalendarDays size={18} color={theme.accent} aria-hidden />
                      <span>
                        {formatMatchDateDa(row.tournament_date)}
                        {row.time_slot ? ` kl. ${formatTimeSlotDa(row.time_slot)}` : ''}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: theme.text }}>
                    <MapPin size={18} color={theme.accent} aria-hidden />
                    <span>{row.court_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: theme.text }}>
                    <Users size={18} color={theme.accent} aria-hidden />
                    <span>{row.participant_count}/{row.player_slots} tilmeldt · {row.points_per_match} point pr. kamp</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: st.tone }}>
                    <Trophy size={18} color={st.tone} aria-hidden />
                    <span>{st.text}</span>
                  </div>
                </div>

                {row.description ? (
                  <p style={{ fontSize: '13px', color: theme.textLight, lineHeight: 1.55, margin: '0 0 18px' }}>{row.description}</p>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button type="button" onClick={ctaPrimary} style={{ ...btn(true), padding: '12px 20px', fontSize: '14px' }}>
                    {user && profile ? 'Gå til turneringen' : 'Opret profil og tilmeld dig'}
                  </button>
                  {!(user && profile) && (
                    <button type="button" onClick={ctaSecondary} style={{ ...btn(false), padding: '12px 20px', fontSize: '14px' }}>
                      Log ind
                    </button>
                  )}
                </div>
              </div>

              <p style={{ fontSize: '13px', color: theme.textLight, lineHeight: 1.55 }}>
                Flere events på{' '}
                <Link to="/events" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}>events-siden</Link>.
              </p>
            </>
          );
        })()}

        <PublicLegalFooter />
      </div>
    </div>
  );
}
