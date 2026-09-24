/**
 * Kvittering efter en kamp er oprettet: hvad blev oprettet, og hvordan deler
 * man det.
 *
 * Flyttet ud af KampeTab uaendret. Blokken hang i bunden af en 4.000-linjers
 * return og havde kun to baand til resten af komponenten - derfor er den det
 * reneste snit i filen.
 */
import { useState } from 'react';
import { theme, font } from '../../lib/platformTheme';
import { CalendarDays, CalendarPlus, ArrowRight, Share2, Copy, Check, MapPin } from 'lucide-react';
import { parseMatchLevelRange } from '../../lib/matchLevelRange';
import { formatMatchLevelRangeLabel } from '../../lib/padelLevelUtils';
import { formatMatchDateDa, matchTimeLabel } from '../../lib/matchDisplayUtils';
import { SITE_ORIGIN } from '../../lib/siteMeta';
import { shareMatchUrl } from '../../lib/matchShareText.js';

export function CreatedMatchReceipt({ match, user, showToast, onClose, onAddToCalendar, onShare }) {
  // "Kopieret!"-kvitteringen hoerer kun til denne boks; den laa foer som
  // tilstand i hele KampeTab.
  const [receiptUrlCopied, setReceiptUrlCopied] = useState(false);
  if (!match) return null;
  const m = match;
  const matchPrefs = parseMatchLevelRange(m.level_range);
  const levelStr = formatMatchLevelRangeLabel(matchPrefs?.min, matchPrefs?.max);
  const isClosed = m.match_type === 'closed';
  const court = m.court_name?.trim() || null;
  const datePart = m.date ? formatMatchDateDa(m.date) : '';
  const timePart = matchTimeLabel(m);
  const timeStr = timePart && timePart !== '—' ? `Kl. ${timePart}` : '';
  const matchUrl = shareMatchUrl(SITE_ORIGIN, m.id);
  const handleCopy = () => {
    if (!matchUrl) return;
    navigator.clipboard?.writeText(matchUrl).then(() => {
      setReceiptUrlCopied(true);
      setTimeout(() => setReceiptUrlCopied(false), 2000);
    }).catch(() => showToast('Kopiering mislykkedes'));
  };
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: theme.bg, display: 'flex', flexDirection: 'column',
      fontFamily: font,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: 'max(10px, calc(env(safe-area-inset-top) + 8px)) 14px 10px', borderBottom: '1px solid ' + theme.border, background: theme.surface, flexShrink: 0 }}>
        <h2 style={{ flex: 1, fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, textAlign: 'center' }}>PadelMakker</h2>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {/* Checkmark */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: theme.navy, color: 'var(--pm-on-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Check size={32} strokeWidth={2.8} />
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', padding: '16px 32px 0' }}>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.3px', color: theme.text }}>Kamp oprettet!</div>
          <p style={{ fontSize: 12.5, color: theme.textMid, marginTop: 6, marginBottom: 0 }}>
            {isClosed ? 'Din lukkede kamp er klar – invitér dine spillere.' : 'Din kamp er nu synlig for andre spillere.'}
          </p>
        </div>

        {/* Summary card */}
        <div style={{ margin: '16px 18px 0', background: theme.surface, borderRadius: 16, border: '1px solid ' + theme.border, padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: theme.navy, color: 'var(--pm-on-accent)', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em' }}>
              {isClosed ? 'LUKKET' : '2V2'}
            </span>
            {levelStr && (
              <span style={{ background: theme.accentBg, color: theme.accent, borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600 }}>
                {levelStr}
              </span>
            )}
          </div>

          {/* Date + time row */}
          {(datePart || timeStr) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: theme.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarDays size={14} color={theme.textMid} />
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                {datePart && <b style={{ color: theme.text, display: 'block' }}>{datePart}</b>}
                {timeStr && <span style={{ color: theme.textMid }}>{timeStr}</span>}
              </div>
            </div>
          )}

          {/* Location row */}
          {court && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: theme.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={14} color={theme.textMid} />
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                <b style={{ color: theme.text }}>{court}</b>
              </div>
            </div>
          )}

          {/* Slots row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 12, borderTop: '1px solid ' + theme.border }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: theme.navy, color: 'var(--pm-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                {(user?.avatar || '🎾')}
              </div>
            </div>
            <span style={{ fontSize: 11.5, color: theme.textMid, fontWeight: 600 }}>1/4 pladser optaget</span>
          </div>
        </div>

        {/* Share section: det hurtigste sted at finde de sidste tre er ens egne venner */}
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMid, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '16px 18px 8px' }}>
          Del kamp
        </div>
        <div style={{ margin: '0 18px 10px', fontSize: 13, color: theme.textMid, lineHeight: 1.5 }}>
          Send kampen til venner på WhatsApp, Messenger eller SMS. De kan se den og melde sig til med det samme.
        </div>
        <div style={{ margin: '0 18px 10px' }}>
          <button
            type="button"
            onClick={() => void onShare(m)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: theme.navy, color: 'var(--pm-on-accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}
          >
            <Share2 size={16} />
            Send til venner
          </button>
        </div>
        <div style={{ margin: '0 18px 12px', background: theme.surface, borderRadius: 10, border: '1px solid ' + theme.border, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
          <span style={{ flex: 1, fontSize: 12, color: theme.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {matchUrl || 'padelmakker.dk/kamp/…'}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 7, border: '1px solid ' + theme.border, background: theme.surfaceAlt, color: receiptUrlCopied ? theme.green : theme.textMid, cursor: 'pointer', flexShrink: 0, fontFamily: font }}
          >
            <Copy size={12} />
            {receiptUrlCopied ? 'Kopieret!' : 'Kopiér'}
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <button
            type="button"
            onClick={() => onAddToCalendar(m)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '11px 16px', borderRadius: 10, border: '1px solid ' + theme.border, background: theme.surface, color: theme.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: font }}
          >
            <CalendarPlus size={15} />
            Tilføj til kalender
          </button>
        </div>
      </div>

      {/* CTA bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 18px', background: theme.surface, borderTop: '1px solid ' + theme.border }}>
        <button
          type="button"
          onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px 16px', borderRadius: 12, border: 'none', background: theme.navy, color: 'var(--pm-on-accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font }}
        >
          Gå til kamp-oversigt
          <ArrowRight size={16} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
