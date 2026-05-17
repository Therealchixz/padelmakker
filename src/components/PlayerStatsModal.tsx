import { PlayerProfileModal } from '../dashboard/PlayerProfileModal';

interface PlayerStatsModalProps {
  userId: string;
  onClose: () => void;
  fallbackName?: string;
  /** Valgfrit avatar (fx fra turneringsdeltagerliste) */
  avatar?: string | null;
}

/**
 * Let wrapper om den fulde spillerprofil — samme modal som Kampe, Liga, Ranking m.fl.
 * (2v2, Americano og Liga-faner).
 */
export function PlayerStatsModal({ userId, onClose, fallbackName, avatar }: PlayerStatsModalProps) {
  const name = String(fallbackName || '').trim() || 'Spiller';
  return (
    <PlayerProfileModal
      player={{
        id: userId,
        full_name: name,
        name,
        avatar: avatar ?? null,
      }}
      onClose={onClose}
    />
  );
}
