import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MapPin, CalendarDays, Users, Swords } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { PublicLegalFooter } from '../components/PublicLegalFooter';
import { formatMatchDateDa, matchTimeLabel } from '../lib/matchDisplayUtils';
import { parseMatchLevelRange } from '../lib/matchLevelRange';
import { formatMatchLevelRangeLabel } from '../lib/padelLevelUtils';
import { buildKampe2v2DetailPath } from '../lib/kampeDetailRoutes';
import { buildPublicMatchPath } from '../lib/publicShareRoutes';
import { authReturnSignupUrl } from '../lib/authReturnPath';
import { applyPublicShareMeta } from '../lib/publicShareMeta';

function matchStatusLabel(status) {
  if (status === 'in_progress') return { text: 'I gang', tone: theme.warm };
  if (status === 'full') return { text: 'Fuld', tone: theme.textMid };
  return { text: 'Åben for tilmelding', tone: theme.green };
}

export function PublicMatchPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured || !matchId) {
        setLoading(false);
        setError('konfiguration');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcErr } = await supabase.rpc('public_match_preview', { p_match_id: matchId });
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
  }, [matchId]);

  useEffect(() => {
    if (!row) return;
    const prefs = parseMatchLevelRange(row.level_range);
    const levelLabel = formatMatchLevelRangeLabel(prefs?.min, prefs?.max) || 'Alle niveauer';
    const when = [row.date ? formatMatchDateDa(row.date) : '', row.time ? matchTimeLabel(row.time) : ''].filter(Boolean).join(' · ');
    applyPublicShareMeta({
      pathname: buildPublicMatchPath(row.id),
      title: `Padel-kamp${when ? ` · ${when}` : ''} | PadelMakker`,
      description: `${row.creator_first_name || 'En spiller'} mangler makker (${row.current_players}/${row.max_players} pladser). ${levelLabel}. Opret gratis profil og tilmeld dig.`,
    });
  }, [row]);

  const ctaPrimary = () => {
    const returnPath = buildPublicMatchPath(matchId);
    if (user && profile) {
      navigate(buildKampe2v2DetailPath(matchId));
      return;
    }
    navigate(authReturnSignupUrl(returnPath));
  };

  const ctaSecondary = () => {
    navigate(`/login?next=${encodeURIComponent(buildPublicMatchPath(matchId))}`);
  };

  return (
    <div className="pm-root" style={{ fontFamily: font, background: theme.bg, minHeight: '100dvh', color: theme.text, paddingBottom: 'max(96px, env(safe-area-inset-bottom))' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'max(16px, env(safe-area-inset-top)) clamp(16px, 4vw, 28px) 0' }}>
        <button type="button" onClick={() => navigate('/')} style={{ ...btn(false), marginBottom: '20px', padding: '8px 14px', fontSize: '13px' }}>
          ← Til forsiden
        </button>

        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: theme.textMid }}>
            <div className="pm-spinner" style={{ margin: '0 auto 16px' }} />
            Henter kamp…
          </div>
        )}

        {!loading && error === 'konfiguration' && (
          <p style={{ fontSize: '14px', color: theme.textMid }}>Kampen kan ikke vises i dette miljø.</p>
        )}

        {!loading && error && error !== 'konfiguration' && (
          <div style={{ background: theme.surface, borderRadius: '14px', border: `1px solid ${theme.border}`, padding: '24px', boxShadow: theme.shadow }}>
            <h1 style={{ ...heading('22px'), margin: '0 0 10px' }}>Kampen er ikke tilgængelig</h1>
            <p style={{ fontSize: '14px', color: theme.textMid, lineHeight: 1.6, margin: 0 }}>
              {error === 'past'
                ? 'Kampen er afsluttet eller ligger i fortiden.'
                : 'Linket er ugyldigt, eller kampen er lukket.'}
            </p>
            <button type="button" onClick={() => navigate('/opret')} style={{ ...btn(true), marginTop: '18px' }}>
              Opret profil og find kampe
            </button>
          </div>
        )}

        {!loading && row && (() => {
          const prefs = parseMatchLevelRange(row.level_range);
          const levelLabel = formatMatchLevelRangeLabel(prefs?.min, prefs?.max) || 'Alle niveauer';
          const st = matchStatusLabel(row.status);
          const when = row.date ? formatMatchDateDa(row.date) : '';
          const time = row.time ? matchTimeLabel(row.time) : '';
          return (
            <>
              <div style={{ background: theme.surface, borderRadius: '14px', border: `1px solid ${theme.border}`, boxShadow: theme.shadow, padding: 'clamp(22px, 5vw, 32px)', marginBottom: '16px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: theme.accent, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                  Padel-kamp · 2v2
                </p>
                <h1 style={{ ...heading('clamp(22px, 5vw, 28px)'), margin: '0 0 12px', letterSpacing: '-0.02em' }}>
                  {row.court_name}
                </h1>
                <p style={{ fontSize: '15px', color: theme.textMid, lineHeight: 1.6, margin: '0 0 18px' }}>
                  {row.creator_first_name || 'En spiller'} leder efter spillere til en padel-kamp på PadelMakker.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                  {(when || time) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: theme.text }}>
                      <CalendarDays size={18} color={theme.accent} aria-hidden />
                      <span>{[when, time && `kl. ${time}`].filter(Boolean).join(' ')}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: theme.text }}>
                    <MapPin size={18} color={theme.accent} aria-hidden />
                    <span>{row.court_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: theme.text }}>
                    <Users size={18} color={theme.accent} aria-hidden />
                    <span>{row.current_players}/{row.max_players} pladser · {levelLabel}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: st.tone }}>
                    <Swords size={18} color={st.tone} aria-hidden />
                    <span>{st.text}{row.match_type === 'closed' ? ' · godkendelse kræves' : ''}</span>
                  </div>
                </div>

                {row.description ? (
                  <p style={{ fontSize: '13px', color: theme.textLight, lineHeight: 1.55, margin: '0 0 18px' }}>{row.description}</p>
                ) : null}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button type="button" onClick={ctaPrimary} style={{ ...btn(true), padding: '12px 20px', fontSize: '14px' }}>
                    {user && profile ? 'Gå til kampen' : 'Opret profil og tilmeld dig'}
                  </button>
                  {!(user && profile) && (
                    <button type="button" onClick={ctaSecondary} style={{ ...btn(false), padding: '12px 20px', fontSize: '14px' }}>
                      Log ind
                    </button>
                  )}
                </div>
              </div>

              <p style={{ fontSize: '13px', color: theme.textLight, lineHeight: 1.55 }}>
                PadelMakker er gratis at bruge. Vi viser ikke deltagernes navne på denne side af hensyn til privatlivets fred.
                {' '}
                <Link to="/kampagne/forste-200" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}>
                  Se Første 200-kampagnen
                </Link>
              </p>
            </>
          );
        })()}

        <PublicLegalFooter />
      </div>
    </div>
  );
}
