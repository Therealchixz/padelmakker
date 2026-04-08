import { useState, useEffect, useCallback } from 'react';
import { theme, btn, inputStyle, heading, tag } from '../lib/platformTheme';
import { SKANSEN_PADEL_HALBOOKING_URL, skansenBookingHintUrl } from '../lib/skansenHalbooking';
import { MapPin, Building2, ExternalLink, RefreshCw, Clock } from 'lucide-react';

/** I dev proxes Vite til produktion så `/api/...` virker uden `vercel dev`. */
const SLOTS_API =
  (import.meta.env.VITE_SKANSEN_SLOTS_URL && String(import.meta.env.VITE_SKANSEN_SLOTS_URL).trim()) ||
  '/api/halbooking-skansen-padel';

/**
 * @typedef {{ time: string, status: string }} HalSlot
 * @typedef {{ name: string, slots: HalSlot[], available: string[] }} HalCourt
 */

export function BanerTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** @type {[HalCourt[] | null, function]} */
  const [courts, setCourts] = useState(null);
  const [meta, setMeta] = useState({ dateLabel: '', fetchedAt: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(SLOTS_API, { credentials: 'omit' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Fejl ${r.status}`);
      }
      const data = await r.json();
      setCourts(data.courts || []);
      setMeta({
        dateLabel: data.dateLabel || '',
        fetchedAt: data.fetchedAt || '',
      });
    } catch (e) {
      console.error(e);
      setError(e.message || 'Kunne ikke hente ledige tider');
      setCourts(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h2 style={{ ...heading('clamp(20px,4.5vw,24px)'), marginBottom: '12px' }}>
        Skansen Padel — ledige tider
      </h2>
      <p style={{ fontSize: '13px', color: theme.textMid, lineHeight: 1.5, marginBottom: '16px' }}>
        Tiderne hentes løbende fra klubbens Halbooking. For at booke skal du logge ind på deres site — klik på
        en grøn tid for at åbne booking med bane og tid som hjælp, eller brug knappen nedenfor for hele kalenderen.
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          marginBottom: '18px',
        }}
      >
        <a
          href={SKANSEN_PADEL_HALBOOKING_URL}
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
          Åbn Halbooking (book bane)
        </a>
        <button
          type="button"
          onClick={() => load()}
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
        {meta.dateLabel && (
          <span style={{ fontSize: '12px', color: theme.textLight, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} />
            {meta.dateLabel}
          </span>
        )}
      </div>

      {meta.fetchedAt && (
        <p style={{ fontSize: '11px', color: theme.textLight, marginTop: '-10px', marginBottom: '16px' }}>
          Senest hentet: {new Date(meta.fetchedAt).toLocaleString('da-DK')}
        </p>
      )}

      <div
        style={{
          background: theme.surface,
          borderRadius: theme.radius,
          padding: '16px',
          boxShadow: theme.shadow,
          border: '1px solid ' + theme.border,
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '4px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>Skansen Padel</div>
            <div style={{ fontSize: '12px', color: theme.textLight, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <MapPin size={11} /> Lerumbakken 11, 9400 Nørresundby
            </div>
          </div>
          <span style={tag(theme.blueBg, theme.blue)}>
            <Building2 size={10} />
            Indoor
          </span>
        </div>
      </div>

      {loading && !courts && (
        <div style={{ textAlign: 'center', padding: '36px', color: theme.textLight, fontSize: '14px' }}>
          Henter ledige tider fra Halbooking…
        </div>
      )}

      {error && (
        <div
          style={{
            ...inputStyle,
            borderColor: theme.warm,
            background: theme.warmBg,
            color: theme.text,
            padding: '14px',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
          <div style={{ marginTop: '10px', fontSize: '12px', color: theme.textMid }}>
            Du kan stadig booke direkte på Halbooking via knappen ovenfor.
          </div>
        </div>
      )}

      {courts && courts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {courts.map((c) => (
            <div
              key={c.name}
              style={{
                background: theme.surface,
                borderRadius: theme.radius,
                padding: '16px',
                boxShadow: theme.shadow,
                border: '1px solid ' + theme.border,
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>{c.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {c.slots.map((s) => {
                  if (s.status === 'free') {
                    return (
                      <a
                        key={s.time}
                        href={skansenBookingHintUrl(c.name, s.time)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Book på Halbooking (login på deres site)"
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

      <style>{`
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
