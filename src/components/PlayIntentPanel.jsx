import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, Clock, X, Users } from 'lucide-react';
import { theme, btn, font, inputStyle, labelStyle } from '../lib/platformTheme';
import { AppModal } from './AppModal';
import {
  PLAY_WINDOW_PRESETS,
  PLAY_START_SLOTS,
  cancelPlayIntent,
  clampEndToWindow,
  createPlayIntent,
  dayChoiceLabel,
  dayLabel,
  deadlineInfo,
  endSlotsAfter,
  fetchMyPlayIntents,
  fetchPendingProposals,
  isValidPlayWindow,
  isoDateOffset,
  matchingPresetKey,
  respondToMatchProposal,
  shortTime,
} from '../lib/playIntents';

const DAY_CHOICES = Array.from({ length: 14 }, (_, i) => isoDateOffset(i));
const DEFAULT_START = '18:00';
const DEFAULT_END = '21:00';

/**
 * "Jeg vil spille" — lav-forpligtelses indgang til en kamp.
 *
 * Brugeren vælger dag og et frit tidsrum; systemet finder de øvrige tre og
 * sender et forslag. Formålet er at fjerne organiseringsbyrden, ikke at
 * erstatte det at oprette en kamp manuelt.
 */
export function PlayIntentPanel({ user, showToast, onMatchCreated }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(DAY_CHOICES[0]);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [saving, setSaving] = useState(false);
  const [intents, setIntents] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [busyProposal, setBusyProposal] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const userId = user?.id;

  /* Fristen kan være helt nede på 30 minutter ved kort varsel, så nedtællingen
     skal opdatere sig selv frem for at fryse på det tidspunkt siden blev åbnet. */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

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

  const presetKey = matchingPresetKey(start, end);
  const endOptions = endSlotsAfter(start);
  const windowOk = isValidPlayWindow(start, end);

  const applyPreset = useCallback((preset) => {
    setStart(preset.start);
    setEnd(preset.end);
  }, []);

  const onStartChange = useCallback((nextStart) => {
    setStart(nextStart);
    setEnd((prev) => clampEndToWindow(nextStart, prev));
  }, []);

  const submit = useCallback(async () => {
    if (!userId || saving || !windowOk) return;
    setSaving(true);
    const res = await createPlayIntent({
      playDate: day,
      startTime: start,
      endTime: end,
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
  }, [userId, saving, windowOk, day, start, end, showToast, reload]);

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
      {proposals.map((p) => {
        const deadline = deadlineInfo(p.expires_at, now);
        const expired = Boolean(deadline?.expired);
        return (
          <div
            key={p.id}
            style={{
              border: `1.5px solid ${expired ? theme.border : theme.accent}`,
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 10,
              background: 'var(--pm-surface-muted)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Users size={15} color={expired ? theme.textLight : theme.accent} />
              <strong style={{ fontSize: 14, color: theme.text }}>I er 4 — bekræft jeres kamp</strong>
            </div>
            <div style={{ fontSize: 13, color: theme.textMid, marginBottom: 10 }}>
              {dayLabel(p.play_date)} kl. {shortTime(p.start_time)}–{shortTime(p.end_time)}
              {p.region ? ` · ${p.region}` : ''}
            </div>
            {deadline && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  marginBottom: 12,
                  padding: '3px 9px',
                  borderRadius: 999,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: deadline.urgent ? theme.red : theme.textMid,
                  background: 'transparent',
                  border: `1px solid ${deadline.urgent ? theme.red : theme.border}`,
                }}
              >
                <Clock size={12} /> {deadline.label}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={busyProposal === p.id || expired}
                onClick={() => respond(p.id, true)}
                style={{
                  ...btn(true),
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: expired ? 0.5 : 1,
                }}
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
        );
      })}

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

      <AppModal
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="Meld dig klar til at spille"
        maxWidthPreset="sm"
        footer={(
          <button
            type="button"
            onClick={submit}
            disabled={saving || !windowOk}
            style={{ ...btn(true), width: '100%', opacity: windowOk ? 1 : 0.5 }}
          >
            {saving ? 'Melder dig klar…' : `Meld mig klar · ${shortTime(start)}–${shortTime(end)}`}
          </button>
        )}
      >
        <div className="pm-modal-body pm-modal-body--compact" style={{ fontFamily: font }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, margin: '0 0 6px' }}>
            Hvornår kan du spille?
          </h3>
          <p style={{ fontSize: 13, color: theme.textMid, margin: '0 0 18px', lineHeight: 1.45 }}>
            Vælg det tidsrum, du kan. Vi finder tre andre i samme hul og sender et forslag — du bekræfter, før der sker noget.
          </p>

          <div style={labelStyle}>Dag</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
            {DAY_CHOICES.map((d) => {
              const selected = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 13px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: font,
                    cursor: 'pointer',
                    border: `1px solid ${selected ? theme.accent : theme.border}`,
                    background: selected ? theme.accent : theme.surface,
                    color: selected ? theme.onAccent : theme.text,
                  }}
                >
                  {dayChoiceLabel(d)}
                </button>
              );
            })}
          </div>

          <div style={labelStyle}>Hurtigt valg</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginBottom: 16 }}>
            {PLAY_WINDOW_PRESETS.map((p) => {
              const selected = p.key === presetKey;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p)}
                  style={{
                    padding: '9px 6px',
                    borderRadius: 12,
                    fontFamily: font,
                    cursor: 'pointer',
                    textAlign: 'center',
                    border: `1.5px solid ${selected ? theme.accent : theme.border}`,
                    background: selected ? 'var(--pm-accent-bg)' : theme.surface,
                    color: selected ? theme.accent : theme.text,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em' }}>{p.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, color: selected ? theme.accent : theme.textLight }}>
                    {shortTime(p.start)}–{shortTime(p.end)}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label htmlFor="play-intent-start" style={labelStyle}>Fra</label>
              <select
                id="play-intent-start"
                value={start}
                onChange={(e) => onStartChange(e.target.value)}
                style={inputStyle}
              >
                {PLAY_START_SLOTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="play-intent-end" style={labelStyle}>Til</label>
              <select
                id="play-intent-end"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                style={inputStyle}
              >
                {endOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <p style={{ fontSize: 12, color: theme.textLight, margin: 0, lineHeight: 1.4 }}>
            {windowOk
              ? `Klar ${dayChoiceLabel(day).toLowerCase()} kl. ${start}–${end}. Mindst 1½ time, så der er plads til en kamp.`
              : 'Vælg mindst 1½ time.'}
          </p>
        </div>
      </AppModal>
    </div>
  );
}
