import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { theme, font } from '../lib/platformTheme';
import { AvatarCircle } from './AvatarCircle';
import { X } from 'lucide-react';

const americanoOutcomeColors = {
  win: { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669' },
  loss: { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626' },
  tie: { bg: '#F1F5F9', border: '#E2E8F0', text: '#475569' },
  neutral: { bg: '#EFF6FF', border: '#DBEAFE', text: '#1D4ED8' }
};

interface PlayerStatsModalProps {
  userId: string;
  onClose: () => void;
  fallbackName?: string;
}

export function PlayerStatsModal({ userId, onClose, fallbackName }: PlayerStatsModalProps) {
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<any>(null);
  const [fetchErr, setFetchErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchErr(false);
      setRow(null);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, name, avatar, elo_rating, games_played, games_won, americano_wins, americano_losses, americano_draws, americano_played')
          .eq('id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        setRow(data);
      } catch {
        if (!cancelled) {
          setFetchErr(true);
          setRow(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const elo = Math.round(Number(row?.elo_rating) || 1000);
  const padelGames = Number(row?.games_played) || 0;
  const padelWins = Number(row?.games_won) || 0;
  
  const amW = Number(row?.americano_wins) || 0;
  const amL = Number(row?.americano_losses) || 0;
  const amD = Number(row?.americano_draws) || 0;
  const amPlayed = Number(row?.americano_played) || 0;

  const title = String(row?.full_name || row?.name || fallbackName || 'Spiller').trim() || fallbackName || 'Spiller';

  const cell = (label: string, value: string | number, opts: any) => (
    <div key={label} style={{ textAlign: 'center', padding: '10px 6px', background: opts.bg, borderRadius: 8, border: `1px solid ${opts.border}` }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: opts.text, fontFamily: font }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  );

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
        fontFamily: font,
        backdropFilter: "blur(4px)"
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          position: "relative"
        }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#64748B", cursor: "pointer" }}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
          <AvatarCircle avatar={row?.avatar || '🎾'} size={56} emojiSize="28px" bg="#F1F5F9" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {loading ? '…' : title}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Spillerprofil</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 14 }}>Henter statistik…</div>
        ) : fetchErr ? (
          <div style={{ fontSize: 14, color: theme.red, textAlign: "center", padding: 24 }}>Kunne ikke hente profil.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Padel Stats */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Padel Ranking</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {cell('ELO', elo, { bg: '#F0F9FF', border: '#BAE6FD', text: '#0369A1' })}
                {cell('Kampe', padelGames, { bg: '#F1F5F9', border: '#E2E8F0', text: '#475569' })}
                {cell('Sejre', padelWins, { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669' })}
              </div>
            </div>

            {/* Americano Stats */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Americano</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {cell('Turneringer', amPlayed, { bg: '#F5F3FF', border: '#DDD6FE', text: '#7C3AED' })}
                {cell('Runder vundet', amW, { ...americanoOutcomeColors.win })}
                {cell('Uafgjort', amD, { ...americanoOutcomeColors.tie })}
                {cell('Runder tabt', amL, { ...americanoOutcomeColors.loss })}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#F1F5F9', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 24 }}
        >
          Luk
        </button>
      </div>
    </div>
  );
}
