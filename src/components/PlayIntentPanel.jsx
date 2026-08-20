import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, X, Users } from 'lucide-react';
import { theme, btn } from '../lib/platformTheme';
import { AppModal } from './AppModal';
import {
  PLAY_TIME_BANDS,
  cancelPlayIntent,
  createPlayIntent,
  dayLabel,
  fetchMyPlayIntents,
  fetchPendingProposals,
  isoDateOffset,
  respondToMatchProposal,
  shortTime,
} from '../lib/playIntents';

const DAY_CHOICES = Array.from({ length: 14 }, (_, i) => isoDateOffset(i));

/**
 * "Jeg vil spille" — lav-forpligtelses indgang til en kamp.
 *
 * Brugeren vælger dag og tidsbånd; systemet finder de øvrige tre og sender et
 * forslag. Formålet er at fjerne organiseringsbyrden, ikke at erstatte det at
 * oprette en kamp manuelt.
 */
export function PlayIntentPanel({ user, showToast, onMatchCreated }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(DAY_CHOICES[0]);
  const [bandKey, setBandKey] = useState('aften');
  const [saving, setSaving] = useState(false);
  const [intents, setIntents] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [busyProposal, setBusyProposal] = useState(null);

  const userId = user?.id;

  const reload = useCallback(async () => {
    if (!userId) return;
    const [mine, pending] = await Promise.all([
      fetchMyPlayIntents(userId),
      fetchPendingProposals(userId),
    ]);
    setIntents(mine);
    setProposals(pending);
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  const band = useMemo(
    () => PLAY_TIME_BANDS.find((b) => b.key === bandKey) || PLAY_TIME_BANDS[0],
    [bandKey]
  );

  const submit = useCallback(async () => {
    if (!userId || saving) return;
    setSaving(true);
    const res = await createPlayIntent({
      playDate: day,
      startTime: band.start,
      endTime: band.end,
      viewerId: userId,
    });
    setSaving(false);

    if (!res.ok) {
      showToast?.(res.error, 'error');
      return;
    }

    setOpen(false);
    if (res.formed) {
      showToast?.('I er 4 — bekræft kampen nedenfor', 'success');
    } else if (res.othersWaiting > 0) {
      showToast?.(
        `Du er meldt klar. ${res.othersWaiting} ${res.othersWaiting === 1 ? 'anden står' : 'andre står'} klar i samme tidsrum.`,
        'success'
      );
    } else {
      showToast?.('Du er meldt klar. Vi giver besked, når der er fire.', 'success');
    }
    await reload();
  }, [userId, saving, day, band, showToast, reload]);

  const respond = useCallback(async (proposalId, accept) => {
    setBusyProposal(proposalId);
    const res = await respondToMatchProposal(proposalId, accept);
    setBusyProposal(null);

    if (!res.ok) {
      showToast?.(res.error, 'error');
      return;
    }
    if (res.status === 'confirmed') {
      showToast?.('Kampen er oprettet — aftal bane i chatten', 'success');
      onMatchCreated?.(res.matchId);
    } else if (res.status === 'pending') {
      showToast?.(`Du er med. Mangler svar fra ${res.awaiting}.`, 'success');
    } else if (res.status === 'declined') {
      showToast?.('Afvist — du står stadig klar i puljen', 'info');
    } else if (res.status === 'expired') {
      showToast?.('Forslaget er udløbet', 'info');
    }
    await reload();
  }, [showToast, onMatchCreated, reload]);

  const drop = useCallback(async (intentId) => {
    const res = await cancelPlayIntent(intentId);
    if (!res.ok) {
      showToast?.(res.error, 'error');
      return;
    }
    await reload();
  }, [showToast, reload]);

  if (!userId) return null;

  return (
    <div style={{ margin: '0 18px 18px' }}>
      {proposals.map((p) => (
        <div
          key={p.id}
          style={{
            border: `1.5px solid ${theme.accent}`,
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 10,
            background: 'var(--pm-surface-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Users size={15} color={theme.accent} />
            <strong style={{ fontSize: 14, color: theme.text }}>I er 4 — bekræft jeres kamp</strong>
          </div>
          <div style={{ fontSize: 13, color: theme.textMid, marginBottom: 12 }}>
            {dayLabel(p.play_date)} kl. {shortTime(p.start_time)}–{shortTime(p.end_time)}
            {p.region ? ` · ${p.region}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={busyProposal === p.id}
              onClick={() => respond(p.id, true)}
              style={{ ...btn(true), flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Check size={15} /> Jeg er med
            </button>
            <button
              type="button"
              disabled={busyProposal === p.id}
              onClick={() => respond(p.id, false)}
              style={{ ...btn(false), flex: 1 }}
            >
              Kan ikke
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          ...btn(true),
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '13px 16px',
        }}
      >
        <CalendarClock size={17} /> Jeg vil spille
      </button>

      {intents.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {intents.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 2px',
                fontSize: 12.5,
                color: theme.textMid,
              }}
            >
              <span>
                {dayLabel(it.play_date)} kl. {shortTime(it.start_time)}–{shortTime(it.end_time)}
                {it.status === 'proposed' ? ' · afventer svar' : ' · venter på flere'}
              </span>
              {it.status === 'open' && (
                <button
                  type="button"
                  onClick={() => drop(it.id)}
                  aria-label="Fortryd"
                  style={{ background: 'none', border: 'none', color: theme.textLight, cursor: 'pointer', padding: 4 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <AppModal open={open} onClose={() => setOpen(false)} ariaLabel="Meld dig klar til at spille">
        <h3 style={{ fontSize: 17, fontWeight: 600, color: theme.text, margin: '0 0 4px' }}>
          Hvornår kan du spille?
        </h3>
        <p style={{ fontSize: 13, color: theme.textMid, margin: '0 0 16px', lineHeight: 1.45 }}>
          Vi samler fire spillere, der passer sammen, og sender jer et forslag. Du bekræfter, før der sker noget.
        </p>

        <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, marginBottom: 8 }}>Dag</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 16 }}>
          {DAY_CHOICES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              style={{
                flexShrink: 0,
                padding: '8px 12px',
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${d === day ? theme.accent : theme.border}`,
                background: d === day ? theme.accent : 'transparent',
                color: d === day ? theme.onAccent : theme.textMid,
              }}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, marginBottom: 8 }}>Tidsrum</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {PLAY_TIME_BANDS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBandKey(b.key)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                border: `1px solid ${b.key === bandKey ? theme.accent : theme.border}`,
                background: b.key === bandKey ? 'var(--pm-surface-muted)' : 'transparent',
                color: theme.text,
              }}
            >
              {b.label}
              <div style={{ fontSize: 11.5, fontWeight: 500, color: theme.textLight, marginTop: 2 }}>
                {b.start}–{b.end}
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={saving}
          style={{ ...btn(true), width: '100%' }}
        >
          {saving ? 'Melder dig klar…' : 'Meld mig klar'}
        </button>
      </AppModal>
    </div>
  );
}
