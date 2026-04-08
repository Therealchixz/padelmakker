import { useState, useCallback } from 'react';
import { theme, btn, inputStyle, heading, tag } from '../lib/platformTheme';
import {
  HALBOOKING_VENUES,
  halbookingSlotsUrl,
  halbookingOpenUrl,
  halbookingOpenVenueUrl,
} from '../lib/halbookingVenues';
import { MapPin, Building2, Sun, ExternalLink, RefreshCw, Clock } from 'lucide-react';

/**
 * @typedef {{ time: string, status: string, ruleHint?: string }} HalSlot
 * @typedef {{ name: string, slots: HalSlot[], available: string[] }} HalCourt
 */

/** @typedef {{ courts: HalCourt[], dateLabel: string, fetchedAt: string, openBookingPath: string }} VenueLoadState */

export function BanerTab() {
  /** @type {[Record<string, VenueLoadState | null>, function]} */
  const [byVenue, setByVenue] = useState({});
  /** @type {[Record<string, boolean>, function]} */
  const [loadingVenue, setLoadingVenue] = useState({});
  /** @type {[Record<string, string | null>, function]} */
  const [errorVenue, setErrorVenue] = useState({});

  const loadVenue = useCallback(async (venueId) => {
    setLoadingVenue((m) => ({ ...m, [venueId]: true }));
    setErrorVenue((m) => ({ ...m, [venueId]: null }));
    try {
      const r = await fetch(halbookingSlotsUrl(venueId), { credentials: 'omit' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Fejl ${r.status}`);
      }
      const data = await r.json();
      setByVenue((m) => ({
        ...m,
        [venueId]: {
          courts: data.courts || [],
          dateLabel: data.dateLabel || '',
          fetchedAt: data.fetchedAt || '',
          openBookingPath: data.openBookingPath || halbookingOpenVenueUrl(venueId),
        },
      }));
    } catch (e) {
      console.error(e);
      setErrorVenue((m) => ({ ...m, [venueId]: e.message || 'Kunne ikke hente tider' }));
      setByVenue((m) => ({ ...m, [venueId]: null }));
    } finally {
      setLoadingVenue((m) => ({ ...m, [venueId]: false }));
    }
  }, []);

  const onDetailsToggle = (venueId, open) => {
    if (open) {
      loadVenue(venueId);
    }
  };

  return (
    <div>
      <h2 style={{ ...heading('clamp(20px,4.5vw,24px)'), marginBottom: '12px' }}>
        Ledige padelbaner (Halbooking)
      </h2>
      <p style={{ fontSize: '13px', color: theme.textMid, lineHeight: 1.5, marginBottom: '20px' }}>
        Åbn et sted nedenfor for at hente tider. <strong>Grøn</strong> = kan bookes på Halbooking.{' '}
        <strong>Gul</strong> = ser ledig ud, men klubbens regler tillader ikke booking (hold musen over for tekst fra
        Halbooking).
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {HALBOOKING_VENUES.map((v) => {
          const loaded = byVenue[v.id];
          const loading = !!loadingVenue[v.id];
          const err = errorVenue[v.id];
          const openHref = loaded?.openBookingPath || halbookingOpenVenueUrl(v.id);

          return (
            <details
              key={v.id}
              style={{
                background: theme.surface,
                borderRadius: theme.radius,
                boxShadow: theme.shadow,
                border: '1px solid ' + theme.border,
                overflow: 'hidden',
              }}
              onToggle={(e) => onDetailsToggle(v.id, e.currentTarget.open)}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  listStyle: 'none',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  userSelect: 'none',
                }}
                className="pm-baner-summary"
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700 }}>{v.title}</div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: theme.textLight,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '4px',
                    }}
                  >
                    <MapPin size={11} /> {v.address}
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textLight, marginTop: '4px' }}>{v.region}</div>
                </div>
                <span style={v.indoor ? tag(theme.blueBg, theme.blue) : tag(theme.warmBg, theme.warm)}>
                  {v.indoor ? (
                    <>
                      <Building2 size={10} /> Indoor
                    </>
                  ) : (
                    <>
                      <Sun size={10} /> Outdoor
                    </>
                  )}
                </span>
              </summary>

              <div style={{ padding: '0 16px 16px', borderTop: '1px solid ' + theme.border }}>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center',
                    marginTop: '12px',
                    marginBottom: '10px',
                  }}
                >
                  <a
                    href={openHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      ...btn(true),
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                    }}
                  >
                    <ExternalLink size={16} />
                    Åbn booking
                  </a>
                  <button
                    type="button"
                    onClick={() => loadVenue(v.id)}
                    disabled={loading}
                    style={{
                      ...btn(false),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      opacity: loading ? 0.65 : 1,
                    }}
                  >
                    <RefreshCw size={15} className={loading ? 'pm-baner-refresh-spin' : undefined} />
                    Opdater tider
                  </button>
                  {loaded?.dateLabel && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: theme.textLight,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={12} />
                      {loaded.dateLabel}
                    </span>
                  )}
                </div>

                {loaded?.fetchedAt && (
                  <p style={{ fontSize: '11px', color: theme.textLight, marginBottom: '12px' }}>
                    Senest hentet: {new Date(loaded.fetchedAt).toLocaleString('da-DK')}
                  </p>
                )}

                {loading && !loaded?.courts?.length && (
                  <div style={{ textAlign: 'center', padding: '20px', color: theme.textLight, fontSize: '13px' }}>
                    Henter tider…
                  </div>
                )}

                {err && (
                  <div
                    style={{
                      ...inputStyle,
                      borderColor: theme.warm,
                      background: theme.warmBg,
                      padding: '12px',
                      fontSize: '13px',
                      marginBottom: '8px',
                    }}
                  >
                    {err}
                  </div>
                )}

                {loaded && loaded.courts.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loaded.courts.map((c) => (
                      <div
                        key={c.name}
                        style={{
                          background: theme.bg,
                          borderRadius: '8px',
                          padding: '12px',
                          border: '1px solid ' + theme.border,
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>{c.name}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {c.slots.map((s) => {
                            if (s.status === 'free') {
                              return (
                                <a
                                  key={s.time}
                                  href={halbookingOpenUrl(v.id, c.name, s.time)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Book på Halbooking"
                                  style={{
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    color: '#15803d',
                                    border: '1px solid rgba(34, 197, 94, 0.45)',
                                    padding: '6px 11px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    textDecoration: 'none',
                                  }}
                                >
                                  {s.time} · Ledig
                                </a>
                              );
                            }
                            if (s.status === 'booked') {
                              return (
                                <span
                                  key={s.time}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    color: '#b91c1c',
                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                    padding: '6px 11px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                  }}
                                >
                                  {s.time} · Optaget
                                </span>
                              );
                            }
                            if (s.status === 'blocked_rule') {
                              return (
                                <span
                                  key={s.time}
                                  title={s.ruleHint || 'Kan ikke bookes (klubbens regel)'}
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.18)',
                                    color: '#b45309',
                                    border: '1px solid rgba(245, 158, 11, 0.5)',
                                    padding: '6px 11px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'help',
                                  }}
                                >
                                  {s.time} · Ikke bookbar
                                </span>
                              );
                            }
                            return (
                              <span
                                key={s.time}
                                style={{
                                  background: theme.border + '55',
                                  color: theme.textLight,
                                  border: '1px solid ' + theme.border,
                                  padding: '6px 11px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                }}
                              >
                                {s.time}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>

      <style>{`
        .pm-baner-summary::-webkit-details-marker { display: none; }
        @keyframes pm-baner-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .pm-baner-refresh-spin {
          animation: pm-baner-spin 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
}
