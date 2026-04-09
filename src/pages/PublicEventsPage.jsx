import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { font, theme, btn, heading } from '../lib/platformTheme';
import { formatMatchDateDa, formatTimeSlotDa } from '../lib/matchDisplayUtils';
import { PublicLegalFooter } from '../components/PublicLegalFooter';

function statusLabel(status) {
  if (status === 'playing') return { text: 'I gang', bg: theme.warmBg, border: '#FCD34D', color: theme.warm };
  return { text: 'Tilmelding åben', bg: theme.accentBg, border: '#93C5FD', color: theme.accent };
}

export function PublicEventsPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured) {
        setLoading(false);
        setError('konfiguration');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcErr } = await supabase.rpc('public_upcoming_americano_events', {
          p_limit: 40,
        });
        if (cancelled) return;
        if (rpcErr) throw rpcErr;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(e?.message || 'fetch');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ctaPrimary = () => {
    if (user && profile) {
      navigate('/dashboard/kampe');
      return;
    }
    navigate('/opret');
  };

  const ctaSecondary = () => {
    navigate('/login');
  };

  return (
    <div
      className="pm-root"
      style={{
        fontFamily: font,
        background: theme.bg,
        minHeight: '100dvh',
        color: theme.text,
        paddingBottom: 'max(96px, env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'max(16px, env(safe-area-inset-top)) clamp(16px, 4vw, 28px) 0' }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{ ...btn(false), marginBottom: '20px', padding: '8px 14px', fontSize: '13px' }}
        >
          ← Til forsiden
        </button>

        <div
          style={{
            background: theme.surface,
            borderRadius: '14px',
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadow,
            padding: 'clamp(22px, 5vw, 32px)',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '12px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: theme.accentBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden
            >
              <CalendarDays size={24} color={theme.accent} strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: theme.accent,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  margin: '0 0 6px',
                }}
              >
                Kommende på PadelMakker
              </p>
              <h1 style={{ ...heading('clamp(22px, 5vw, 28px)'), margin: 0, letterSpacing: '-0.02em' }}>
                Americano & events
              </h1>
              <p style={{ fontSize: '15px', color: theme.textMid, lineHeight: 1.6, margin: '12px 0 0' }}>
                Åben oversigt over turneringer med tilmelding eller i gang. Log ind for at tilmelde dig — vi viser ikke navne på
                deltagere her.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '22px' }}>
            <button type="button" onClick={ctaPrimary} style={{ ...btn(true), padding: '12px 20px', fontSize: '14px' }}>
              {user && profile ? 'Gå til Kampe' : 'Opret profil og tilmeld dig'}
            </button>
            {!(user && profile) && (
              <button type="button" onClick={ctaSecondary} style={{ ...btn(false), padding: '12px 20px', fontSize: '14px' }}>
                Har du allerede en konto? Log ind
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: theme.textMid, fontSize: '14px' }}>
            <div className="pm-spinner" style={{ margin: '0 auto 16px' }} />
            Henter kommende turneringer…
          </div>
        )}

        {!loading && error === 'konfiguration' && (
          <p style={{ fontSize: '14px', color: theme.textMid, lineHeight: 1.6, padding: '8px 4px 0' }}>
            Supabase er ikke konfigureret i denne miljø — events kan ikke vises her.
          </p>
        )}

        {!loading && error && error !== 'konfiguration' && (
          <div
            style={{
              background: theme.redBg,
              border: `1px solid ${theme.border}`,
              borderRadius: '12px',
              padding: '16px 18px',
              fontSize: '14px',
              color: theme.textMid,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: theme.text }}>Kunne ikke hente kalenderen.</strong>
            <br />
            Hvis du er administrator: kør SQL-scriptet{' '}
            <code style={{ fontSize: '12px', background: theme.surface, padding: '2px 6px', borderRadius: '4px' }}>
              supabase/sql/public_upcoming_americano_events.sql
            </code>{' '}
            i Supabase for at aktivere den offentlige funktion.
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p style={{ fontSize: '15px', color: theme.textMid, lineHeight: 1.65, padding: '12px 4px 0' }}>
            Der er ingen kommende Americano-turneringer lige nu. Opret en selv under{' '}
            <strong style={{ color: theme.text }}>Kampe → Americano</strong>, når du er logget ind.
          </p>
        )}

        {!loading && rows.length > 0 && (
          <ul style={{ listStyle: 'none', margin: '20px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rows.map((row) => {
              const st = statusLabel(row.status);
              const court = row.court_name && String(row.court_name).trim() !== '' ? row.court_name : 'Bane ikke angivet';
              const filled = Number(row.participant_count) || 0;
              const cap = Number(row.player_slots) || 0;
              const desc = row.description && String(row.description).trim() !== '' ? String(row.description).trim() : null;
              return (
                <li
                  key={row.id}
                  style={{
                    background: theme.surface,
                    borderRadius: '12px',
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.shadow,
                    padding: '18px 18px 16px',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: st.bg,
                        border: `1px solid ${st.border}`,
                        color: st.color,
                      }}
                    >
                      Americano · {st.text}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: theme.text }}>
                      {formatMatchDateDa(row.tournament_date)} kl. {formatTimeSlotDa(row.time_slot)}
                    </span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 800, color: theme.text, letterSpacing: '-0.02em', marginBottom: '6px' }}>
                    {row.name}
                  </div>
                  <div style={{ fontSize: '13px', color: theme.textMid, marginBottom: '4px' }}>
                    {court} · {filled}/{cap} tilmeldt · {row.points_per_match} point pr. kamp
                  </div>
                  {desc && (
                    <p style={{ fontSize: '13px', color: theme.textLight, margin: '10px 0 0', lineHeight: 1.5 }}>
                      {desc.length > 220 ? `${desc.slice(0, 217)}…` : desc}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p style={{ fontSize: '13px', color: theme.textLight, marginTop: '28px', lineHeight: 1.55 }}>
          Baner bookes hos centrene; PadelMakker viser overblik og turneringer i appen.
        </p>

        <PublicLegalFooter />
      </div>
    </div>
  );
}
