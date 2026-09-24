import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarClock, Check, Clock, X, Users } from 'lucide-react';
import { theme, btn, font, inputStyle, labelStyle } from '../lib/platformTheme';
import { useAuth } from '../lib/AuthContext';
import { resolveDisplayName } from '../lib/platformUtils';
import { mapUserFacingError } from '../lib/userFacingErrors';
import { buildKampe2v2DetailPath } from '../lib/kampeDetailRoutes';
import {
  QUICK_MATCH_MAX_WINDOW_MINUTES,
  createQuickMatch,
  findOverlappingOpenMatches,
} from '../lib/quickMatch';
import { AppModal } from './AppModal';
import { AvatarCircle } from './AvatarCircle';
import { PlayerProfileModal } from '../dashboard/PlayerProfileModal';
import { formatPlaytomicLevel } from '../lib/padelLevelUtils';
import {
  PLAY_WINDOW_PRESETS,
  PLAY_START_SLOTS,
  cancelPlayIntent,
  clampEndToWindow,
  compactHourRange,
  dayChoiceLabel,
  dayLabel,
  deadlineInfo,
  endSlotsAfter,
  fetchMyPlayIntents,
  fetchPendingProposals,
  isValidPlayWindow,
  windowMinutes,
  isoDateOffset,
  matchingPresetKey,
  parseProposalFocusId,
  pickFocusedProposal,
  iHaveAcceptedProposal,
  respondToMatchProposal,
  shortTime,
} from '../lib/playIntents';

const DAY_CHOICES = Array.from({ length: 14 }, (_, i) => isoDateOffset(i));
const DEFAULT_START = '18:00';
const DEFAULT_END = '21:00';

/**
 * "Jeg vil spille" — den hurtige vej til en kamp: vælg dag og tidsrum, så
 * oprettes en åben kamp uden bane, og spillere på dit niveau i dit område får
 * besked (se src/lib/quickMatch.js for hvorfor puljen blev erstattet).
 *
 * Forslag fra den gamle pulje ("I er 4 — bekræft") vises stadig, så længe
 * der findes nogen.
 */
function proposalFirstName(name) {
  const t = String(name || '').trim();
  if (!t) return 'Spiller';
  return t.split(/\s+/)[0];
}

function ProposalConfirmCard({ proposal, now, busy, onAccept, onDecline, onPlayerClick }) {
  const deadline = deadlineInfo(proposal.expires_at, now);
  const expired = Boolean(deadline?.expired);
  const members = Array.isArray(proposal.members) ? proposal.members : [];
  const waiting = iHaveAcceptedProposal(proposal);
  const acceptedCount = members.filter((m) => m?.response === 'accepted').length;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: members.length ? 12 : 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Users size={15} color={expired ? theme.textLight : theme.accent} />
            <strong style={{ fontSize: 14, color: theme.text }}>
              {waiting ? 'Du er med — venter på de andre' : 'I er 4 — bekræft jeres kamp'}
            </strong>
          </div>
          <div style={{ fontSize: 13, color: theme.textMid }}>
            {dayLabel(proposal.play_date)} kl. {shortTime(proposal.start_time)}–{shortTime(proposal.end_time)}
            {proposal.region ? ` · ${proposal.region}` : ''}
          </div>
        </div>
        {members.length > 0 && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: expired ? theme.textLight : theme.accent, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {acceptedCount}/{members.length}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: theme.textLight, marginTop: 2 }}>har sagt ja</div>
          </div>
        )}
      </div>
      {members.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 10,
          }}
        >
          {members.map((m) => {
            const accepted = m.response === 'accepted';
            const level = m.level != null && m.level !== '' ? formatPlaytomicLevel(m.level) : '';
            const first = proposalFirstName(m.name);
            const canOpen = Boolean(m.id && onPlayerClick);
            const label = m.is_me ? `${first} (dig)` : first;
            return (
              <button
                key={m.id || m.name}
                type="button"
                disabled={!canOpen}
                onClick={() => canOpen && onPlayerClick(m)}
                aria-label={canOpen ? `Åbn profil for ${m.name || first}` : undefined}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${accepted ? 'var(--pm-success-border)' : theme.border}`,
                  background: accepted ? 'var(--pm-green-bg)' : 'var(--pm-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  cursor: canOpen ? 'pointer' : 'default',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  color: 'inherit',
                }}
              >
                <AvatarCircle avatar={m.avatar} size={32} emojiSize="15px" alt="" clickable={canOpen} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: theme.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: accepted ? 'var(--pm-green)' : theme.textLight }}>
                    {accepted ? 'Ja' : 'Venter'}
                  </div>
                  {level ? (
                    <div style={{ fontSize: 11, color: theme.textMid }}>Niveau {level}</div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
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
      {waiting ? (
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          style={{ ...btn(false), width: '100%' }}
        >
          Kan alligevel ikke
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={busy || expired}
            onClick={onAccept}
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
            disabled={busy}
            onClick={onDecline}
            style={{ ...btn(false), flex: 1 }}
          >
            Kan ikke
          </button>
        </div>
      )}
    </>
  );
}

export function PlayIntentPanel({ user, showToast, onMatchCreated, onMessagePlayer, style }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(DAY_CHOICES[0]);
  const [overlaps, setOverlaps] = useState(null);
  const { user: authUser } = useAuth();
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [saving, setSaving] = useState(false);
  const [intents, setIntents] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [droppingId, setDroppingId] = useState(null);
  const [busyProposal, setBusyProposal] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [proposalsLoaded, setProposalsLoaded] = useState(false);
  const [viewPlayer, setViewPlayer] = useState(null);
  const skipMissingFocusToastRef = useRef(false);

  const userId = user?.id;
  const focusId = parseProposalFocusId(location.search);
  const focusedProposal = useMemo(
    () => pickFocusedProposal(proposals, focusId),
    [proposals, focusId],
  );

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
    setProposalsLoaded(true);
  }, [userId]);

  const clearProposalFocus = useCallback(() => {
    if (!parseProposalFocusId(location.search)) return;
    navigate('/dashboard/hjem', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    if (!focusId || !proposalsLoaded) return;
    if (focusedProposal) return;
    if (skipMissingFocusToastRef.current) {
      skipMissingFocusToastRef.current = false;
      return;
    }
    showToast?.('Forslaget er ikke længere aktivt', 'info');
    clearProposalFocus();
  }, [focusId, proposalsLoaded, focusedProposal, showToast, clearProposalFocus, proposals.length]);

  useEffect(() => { void reload(); }, [reload]);

  const waitingOnOthers = useMemo(
    () => proposals.some((p) => iHaveAcceptedProposal(p)),
    [proposals],
  );

  useEffect(() => {
    if (!waitingOnOthers || !userId) return undefined;
    const id = setInterval(() => { void reload(); }, 20000);
    return () => clearInterval(id);
  }, [waitingOnOthers, userId, reload]);

  const presetKey = matchingPresetKey(start, end);
  // En kamp er 1½–3 timer; "hele dagen" giver ikke mening som kamptid.
  const endOptions = endSlotsAfter(start).filter(
    (t) => windowMinutes(start, t) <= QUICK_MATCH_MAX_WINDOW_MINUTES,
  );
  const windowOk = isValidPlayWindow(start, end)
    && windowMinutes(start, end) <= QUICK_MATCH_MAX_WINDOW_MINUTES;

  const applyPreset = useCallback((preset) => {
    setStart(preset.start);
    setEnd(preset.end);
  }, []);

  const onStartChange = useCallback((nextStart) => {
    setStart(nextStart);
    setEnd((prev) => {
      const clamped = clampEndToWindow(nextStart, prev);
      const allowed = endSlotsAfter(nextStart).filter(
        (t) => windowMinutes(nextStart, t) <= QUICK_MATCH_MAX_WINDOW_MINUTES,
      );
      return allowed.includes(clamped) ? clamped : (allowed[allowed.length - 1] || clamped);
    });
    setOverlaps(null);
  }, []);

  const pickDay = useCallback((isoDate) => {
    setDay(isoDate);
    setOverlaps(null);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setOverlaps(null);
  }, []);

  const openMatch = useCallback((matchId) => {
    closeModal();
    navigate(buildKampe2v2DetailPath(matchId));
  }, [closeModal, navigate]);

  const submit = useCallback(async ({ skipOverlapCheck = false } = {}) => {
    if (!userId || saving || !windowOk || !day) return;
    setSaving(true);
    // Er der allerede en åben kamp i samme tidsrum, så vis den først: det er
    // bedre at fylde én kamp end at have to halvtomme.
    if (!skipOverlapCheck) {
      const found = await findOverlappingOpenMatches({ userId, date: day, start, end });
      if (found.length > 0) {
        setOverlaps(found);
        setSaving(false);
        return;
      }
    }
    const res = await createQuickMatch({
      user,
      displayName: resolveDisplayName(user, authUser),
      email: authUser?.email || user?.email,
      date: day,
      start,
      end,
    });
    setSaving(false);
    if (!res.ok) {
      showToast?.(mapUserFacingError(res.error, 'Kunne ikke oprette kampen. Prøv igen.'), 'error');
      return;
    }
    closeModal();
    showToast?.(
      res.notified > 0
        ? `Kampen er oprettet. ${res.notified} ${res.notified === 1 ? 'spiller' : 'spillere'} på dit niveau har fået besked.`
        : 'Kampen er oprettet. Del den gerne med nogen, du kender.',
      'success',
    );
    onMatchCreated?.(res.matchId);
    navigate(buildKampe2v2DetailPath(res.matchId));
  }, [userId, saving, windowOk, day, start, end, user, authUser, showToast, closeModal, onMatchCreated, navigate]);

  const respond = useCallback(async (proposalId, accept) => {
    setBusyProposal(proposalId);
    const res = await respondToMatchProposal(proposalId, accept);
    setBusyProposal(null);

    if (!res.ok) {
      showToast?.(res.error, 'error');
      return;
    }
    if (res.status === 'confirmed') {
      skipMissingFocusToastRef.current = true;
      showToast?.('Kampen er oprettet — aftal bane i chatten', 'success');
      clearProposalFocus();
      onMatchCreated?.(res.matchId);
    } else if (res.status === 'pending') {
      showToast?.(`Du er med. Mangler svar fra ${res.awaiting}.`, 'success');
    } else if (res.status === 'declined') {
      skipMissingFocusToastRef.current = true;
      showToast?.('Du har sagt nej til forslaget', 'info');
      clearProposalFocus();
    } else if (res.status === 'expired') {
      skipMissingFocusToastRef.current = true;
      showToast?.('Forslaget er udløbet', 'info');
      clearProposalFocus();
    }
    await reload();
  }, [showToast, onMatchCreated, reload, clearProposalFocus]);

  const drop = useCallback(async (intentId) => {
    if (droppingId) return;
    setDroppingId(intentId);
    const res = await cancelPlayIntent(intentId);
    setDroppingId(null);
    if (!res.ok) {
      showToast?.(res.error, 'error');
      return;
    }
    await reload();
  }, [droppingId, showToast, reload]);

  const openMemberProfile = useCallback((member) => {
    if (!member?.id) return;
    setViewPlayer({
      id: member.id,
      full_name: member.name,
      avatar: member.avatar,
    });
  }, []);

  if (!userId) return null;

  return (
    <div style={{ margin: '0 18px 18px', ...style }}>
      {proposals.map((p) => {
        if (focusedProposal && String(p.id) === String(focusedProposal.id)) return null;
        const expired = Boolean(deadlineInfo(p.expires_at, now)?.expired);
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
            <ProposalConfirmCard
              proposal={p}
              now={now}
              busy={busyProposal === p.id}
              onAccept={() => respond(p.id, true)}
              onDecline={() => respond(p.id, false)}
              onPlayerClick={openMemberProfile}
            />
          </div>
        );
      })}

      <AppModal
        open={Boolean(focusedProposal)}
        onClose={clearProposalFocus}
        ariaLabel="Bekræft jeres kamp"
        maxWidthPreset="sm"
        showClose
      >
        <div className="pm-modal-body pm-modal-body--compact" style={{ fontFamily: font }}>
          <ProposalConfirmCard
            proposal={focusedProposal || {}}
            now={now}
            busy={busyProposal === focusedProposal?.id}
            onAccept={() => focusedProposal && respond(focusedProposal.id, true)}
            onDecline={() => focusedProposal && respond(focusedProposal.id, false)}
            onPlayerClick={openMemberProfile}
          />
        </div>
      </AppModal>

      {viewPlayer && (
        <PlayerProfileModal
          player={viewPlayer}
          onClose={() => setViewPlayer(null)}
          onMessage={
            onMessagePlayer
              ? () => {
                  onMessagePlayer(viewPlayer);
                }
              : undefined
          }
        />
      )}

      <div className={`pm-play-intent-block${intents.length ? ' pm-play-intent-block--active' : ''}`}>
        <button
          type="button"
          className="pm-play-intent-cta"
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
          <div className="pm-play-intent-chips" aria-label="Dine spilletider">
            {intents.map((it) => {
              const proposed = it.status === 'proposed';
              return (
                <span
                  key={it.id}
                  className={`pm-play-intent-chip${proposed ? ' pm-play-intent-chip--proposed' : ''}`}
                >
                  {proposed ? (
                    <span className="pm-play-intent-chip__dot" title="Afventer svar" />
                  ) : null}
                  <span>
                    {dayChoiceLabel(it.play_date)} · {compactHourRange(it.start_time, it.end_time)}
                  </span>
                  {it.status === 'open' && (
                    <button
                      type="button"
                      className="pm-play-intent-chip__x"
                      onClick={() => drop(it.id)}
                      disabled={droppingId === it.id}
                      aria-label={`Fortryd ${dayLabel(it.play_date)}`}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <AppModal
        open={open}
        onClose={closeModal}
        ariaLabel="Hvornår vil du spille?"
        maxWidthPreset="sm"
        showClose
        footer={overlaps ? (
          <button
            type="button"
            onClick={() => submit({ skipOverlapCheck: true })}
            disabled={saving}
            style={{ ...btn(false), width: '100%' }}
          >
            {saving ? 'Opretter…' : 'Opret min egen kamp alligevel'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit()}
            disabled={saving || !windowOk}
            style={{ ...btn(true), width: '100%', opacity: windowOk ? 1 : 0.5 }}
          >
            {saving ? 'Opretter kamp…' : `Opret kamp · ${dayChoiceLabel(day)} ${compactHourRange(start, end)}`}
          </button>
        )}
      >
        <div className="pm-modal-body pm-modal-body--compact" style={{ fontFamily: font }}>
          {overlaps ? (
            <>
              <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, margin: '0 0 6px' }}>
                {overlaps.length === 1 ? 'Der er allerede en åben kamp' : `Der er allerede ${overlaps.length} åbne kampe`}
              </h3>
              <p style={{ fontSize: 13, color: theme.textMid, margin: '0 0 14px', lineHeight: 1.45 }}>
                {dayLabel(day)} i dit tidsrum. Meld dig til den i stedet, så bliver der hurtigere fire.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {overlaps.map((m) => {
                  const free = Math.max(0, (Number(m.max_players) || 4) - (Number(m.current_players) || 0));
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => openMatch(m.id)}
                      style={{
                        ...btn(true),
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 14px',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700 }}>
                          kl. {compactHourRange(m.time, m.time_end || m.time)}
                        </span>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 500, opacity: 0.85 }}>
                          {m.court_name || 'Bane ikke valgt endnu'} · {free} {free === 1 ? 'plads' : 'pladser'} tilbage
                        </span>
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700 }}>Se kampen</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, margin: '0 0 6px' }}>
                Hvornår vil du spille?
              </h3>
              <p style={{ fontSize: 13, color: theme.textMid, margin: '0 0 18px', lineHeight: 1.45 }}>
                Vi opretter en åben kamp og giver besked til spillere på dit niveau i dit område.
                Bane og præcis tid aftaler I bagefter i kampens chat.
              </p>

              <div style={labelStyle}>Dag</div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
                {DAY_CHOICES.map((d) => {
                  const selected = d === day;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => pickDay(d)}
                      aria-pressed={selected}
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

              <div style={labelStyle}>Tidsrum</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginBottom: 16 }}>
                {PLAY_WINDOW_PRESETS.map((p) => {
                  const selected = p.key === presetKey;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={selected}
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
                    onChange={(e) => { setEnd(e.target.value); setOverlaps(null); }}
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
                  ? `${dayLabel(day)} kl. ${start}–${end}. Kampen er gratis, og banen kan vælges senere.`
                  : 'Vælg mellem 1½ og 3 timer.'}
              </p>
            </>
          )}
        </div>
      </AppModal>
    </div>
  );
}
