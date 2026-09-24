import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { theme } from '../lib/platformTheme';
import { mailReturnRows, mailSentSummary } from '../lib/mailReturnStats.js';

const DAYS = 30;

/** Admin: hvor mange kom tilbage til appen via et link i en mail. */
export function AdminMailReturnsCard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('admin_mail_return_stats', { p_days: DAYS });
    if (rpcError) setError('Kunne ikke hente tallene.');
    else setStats(data || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = mailReturnRows(stats);

  return (
    <div className="pm-ui-card" style={{ marginBottom: 16, padding: '16px 18px' }}>
      <div className="pm-admin-section-title" style={{ marginBottom: 4 }}>Kommer folk tilbage fra mails?</div>
      <div style={{ fontSize: 13, color: theme.textMid, marginBottom: 10 }}>
        Personer der trykkede på et link i en mail og var logget ind, de sidste {DAYS} dage.
        {stats ? ` ${mailSentSummary(stats)}.` : ''}
      </div>
      {error ? <div className="pm-admin-error-msg">{error}</div> : null}
      {loading && !stats ? (
        <div style={{ fontSize: 13, color: theme.textLight }}>Henter…</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {rows.map((r) => (
            <div
              key={r.kilde}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}
            >
              <span style={{ color: theme.text }}>{r.label}</span>
              <span style={{ color: theme.textMid, whiteSpace: 'nowrap' }}>
                <b style={{ color: theme.text }}>{r.personer}</b> {r.personer === 1 ? 'person' : 'personer'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
