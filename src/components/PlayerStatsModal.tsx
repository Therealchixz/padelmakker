import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { theme, font } from '../lib/platformTheme';
import { AvatarCircle } from './AvatarCircle';
import { X } from 'lucide-react';
import { statsFromEloHistoryRows } from '../lib/eloHistoryUtils';

const americanoOutcomeColors = {
  win:     { bg: theme.greenBg,  border: theme.green,  text: theme.green },
  loss:    { bg: theme.redBg,    border: theme.red,    text: theme.red },
  tie:     { bg: theme.surfaceAlt, border: theme.border, text: theme.textMid },
  neutral: { bg: theme.accentBg,   border: theme.border, text: theme.accent },
};

interface PlayerStatsModalProps {
  userId: string;
  onClose: () => void;
  fallbackName?: string;
}

type PlayerRow = {
  full_name?: string | null;
  name?: string | null;
  avatar?: string | null;
  elo_rating?: number | null;
  games_played?: number | null;
  games_won?: number | null;
  americano_wins?: number | null;
  americano_losses?: number | null;
  americano_draws?: number | null;
  americano_played?: number | null;
} | null;

type HistoryStats = {
  elo: number;
  games: number;
  wins: number;
} | null;

type CellStyleOpts = {
  bg: string;
  border: string;
  text: string;
};

export function PlayerStatsModal({ userId, onClose, fallbackName }: PlayerStatsModalProps) {
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<PlayerRow>(null);
  const [histStats, setHistStats] = useState<HistoryStats>(null);
  const [fetchErr, setFetchErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchErr(false);
      setRow(null);
      setHistStats(null);
      try {
        const [pRes, hRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, name, avatar, elo_rating, games_played, games_won, americano_wins, americano_losses, americano_draws, americano_played')
            .eq('id', userId)
            .maybeSingle(),
          supabase
            .from('elo_history')
            .select('*')
            .eq('user_id', userId)
        ]);

        if (cancelled) return;
        if (pRes.error) throw pRes.error;
        
        setRow(pRes.data);
        if (hRes.data) {
          setHistStats(statsFromEloHistoryRows(hRes.data));
        }
      } catch {
        if (!cancelled) {
          setFetchErr(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Priority: history-based stats, fallback to profile columns
  const elo = histStats?.elo ?? Math.round(Number(row?.elo_rating) || 1000);
  const padelGames = histStats?.games ?? (Number(row?.games_played) || 0);
  const padelWins = histStats?.wins ?? (Number(row?.games_won) || 0);
  
  const amW = Number(row?.americano_wins) || 0;
  const amL = Number(row?.americano_losses) || 0;
  const amD = Number(row?.americano_draws) || 0;
  const amPlayed = Number(row?.americano_played) || 0;

  const title = String(row?.full_name || row?.name || fallbackName || 'Spiller').trim() || fallbackName || 'Spiller';

  const cell = (label: string, value: string | number, opts: CellStyleOpts) => (
    <div key={label} style={{ textAlign: 'center', padding: '10px 6px', background: opts.bg, borderRadius: 8, border: `1px solid ${opts.border}` }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: opts.text, fontFamily: font }}>{value}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: theme.textLight, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
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
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          padding: 24,
          maxWidth: 380,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          position: "relative"
        }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: theme.textLight, cursor: "pointer" }}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
          <AvatarCircle
            avatar={row?.avatar || '🎾'}
            size={56}
            emojiSize="28px"
            style={{ background: theme.surfaceAlt }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, letterSpacing: '-0.02em', overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {loading ? '…' : title}
            </div>
            <div style={{ fontSize: 12, color: theme.textLight, marginTop: 4 }}>Spillerprofil</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: theme.textLight, fontSize: 14 }}>Henter statistik…</div>
        ) : fetchErr ? (
          <div style={{ fontSize: 14, color: theme.red, textAlign: "center", padding: 24 }}>Kunne ikke hente profil.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Padel Stats */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Padel Ranking</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {cell('ELO', elo, { bg: theme.surfaceAlt, border: theme.border, text: theme.accent })}
                {cell('Kampe', padelGames, { bg: theme.surfaceAlt, border: theme.border, text: theme.textMid })}
                {cell('Sejre', padelWins, { bg: theme.surfaceAlt, border: theme.border, text: theme.green })}
              </div>
            </div>

            {/* Americano Stats */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Americano</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {cell('Turneringer', amPlayed, { bg: theme.surfaceAlt, border: theme.border, text: theme.purple })}
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
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: theme.surfaceAlt, color: theme.textMid, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 24 }}
        >
          Luk
        </button>
      </div>
    </div>
  );
}
