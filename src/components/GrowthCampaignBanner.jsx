import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Trophy } from 'lucide-react';
import { theme, font } from '../lib/platformTheme';
import {
  fetchMyGrowthCampaignStatus,
  formatCampaignSpotsLabel,
  tryAutoEnrollGrowthCampaign,
} from '../lib/growthCampaign';

export function GrowthCampaignBanner() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const next = await tryAutoEnrollGrowthCampaign();
      if (!cancelled) {
        setStatus(next);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading || !status?.found) return null;

  const spots = formatCampaignSpotsLabel(status);

  if (status.is_winner) {
    return (
      <div
        style={{
          margin: '0 18px 12px',
          padding: '12px 14px',
          borderRadius: 12,
          background: theme.greenBg,
          border: `1px solid ${theme.green}44`,
          fontSize: 13,
          lineHeight: 1.5,
          color: theme.textMid,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Gift size={18} color={theme.green} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <div>
            <strong style={{ color: theme.text }}>Tillykke — du vandt Første 200!</strong>
            {' '}Du blev trukket som vinder (lod #{status.entry_number}). Vi kontakter dig snart om præmien.
          </div>
        </div>
      </div>
    );
  }

  if (status.draw_completed && status.enrolled) {
    return (
      <div
        style={{
          margin: '0 18px 12px',
          padding: '12px 14px',
          borderRadius: 12,
          background: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          fontSize: 13,
          lineHeight: 1.5,
          color: theme.textMid,
        }}
      >
        Lodtrækningen for Første 200 er gennemført. Dit lod var #{status.entry_number}. Tak for deltagelsen!
      </div>
    );
  }

  if (status.draw_completed) return null;

  if (status.enrolled && status.entry_number) {
    return (
      <div
        style={{
          margin: '0 18px 12px',
          padding: '12px 14px',
          borderRadius: 12,
          background: theme.accentBg,
          border: `1px solid ${theme.accent}33`,
          fontSize: 13,
          lineHeight: 1.5,
          color: theme.textMid,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Gift size={18} color={theme.accent} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ color: theme.text }}>Du er med i Første 200!</strong>{' '}
            Dit lodnummer er <strong style={{ color: theme.accent }}>#{status.entry_number}</strong>.
            {' '}{spots} pladser taget.
            {' '}
            <Link to="/kampagne/forste-200" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}>
              Se regler
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status.qualified && status.is_open) {
    return (
      <div
        style={{
          margin: '0 18px 12px',
          padding: '12px 14px',
          borderRadius: 12,
          background: theme.warmBg,
          border: `1px solid ${theme.warm}33`,
          fontSize: 13,
          lineHeight: 1.5,
          color: theme.textMid,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Gift size={18} color={theme.warm} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <div>
            <strong style={{ color: theme.text }}>Første 200 — lodtrækning</strong>
            {' '}({spots} pladser taget). Du er kvalificeret og bliver tilmeldt automatisk.
            {' '}
            <Link to="/kampagne/forste-200" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}>
              Læs regler
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!status.qualified && status.is_open) {
    return (
      <div
        style={{
          margin: '0 18px 12px',
          padding: '12px 14px',
          borderRadius: 12,
          background: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          fontSize: 13,
          lineHeight: 1.5,
          color: theme.textMid,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Gift size={18} color={theme.textLight} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <div>
            <strong style={{ color: theme.text }}>Første 200</strong> — {spots} pladser taget.
            Udfyld profil og bekræft telefon for at deltage.
            {' '}
            <Link to="/kampagne/forste-200" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}>
              Se regler
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status.campaign_full && !status.enrolled) {
    return (
      <div
        style={{
          margin: '0 18px 12px',
          padding: '12px 14px',
          borderRadius: 12,
          background: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          fontSize: 13,
          color: theme.textMid,
        }}
      >
        Første 200 er fyldt ({spots}). Tak for interessen!
      </div>
    );
  }

  return null;
}

export function MonthMasterTeaser({ compact = false }) {
  const style = compact
    ? {
      margin: '0 18px 10px',
      padding: '10px 12px',
      borderRadius: 10,
      background: theme.surfaceAlt,
      border: `1px solid ${theme.border}`,
      fontSize: 12,
      color: theme.textMid,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: font,
    }
    : {
      margin: '0 18px 14px',
      padding: '12px 14px',
      borderRadius: 12,
      background: `linear-gradient(135deg, ${theme.surfaceAlt}, ${theme.surface})`,
      border: `1px solid ${theme.border}`,
      fontSize: 13,
      lineHeight: 1.5,
      color: theme.textMid,
      fontFamily: font,
    };

  return (
    <div style={style}>
      <Trophy size={compact ? 16 : 18} color={theme.amber} style={{ flexShrink: 0 }} aria-hidden />
      <span>
        <strong style={{ color: theme.text }}>Månedens mester</strong> — kommer snart, når der er flere aktive spillere.
      </span>
    </div>
  );
}

/** Hook til dashboard auto-enroll uden banner. */
export function useGrowthCampaignAutoEnroll() {
  useEffect(() => {
    void tryAutoEnrollGrowthCampaign().then((s) => {
      if (s?.enrolled) void fetchMyGrowthCampaignStatus();
    });
  }, []);
}
