/**
 * Rankedin-spillerside vist inde i PadelMakker (ejeren 7. okt. 2026).
 *
 * Rankedin har ingen åben adgang til kampe og resultater, men deres
 * spillerside må gerne vises i andre apps (ingen X-Frame-Options/frame-ancestors).
 * Siden vises derfor i et vindue nederst på skærmen, og "Åbn på Rankedin"
 * er reserven, hvis de en dag slår det fra.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ExternalLink, House, X } from 'lucide-react';
import { useBottomSheetDragToClose } from '../lib/useBottomSheetDragToClose';
import { rankedinProfileUrl } from '../lib/rankedin.js';

/*
 * Tilbage-knap (ejeren 8. okt. 2026: "man kan ikke gå frem eller tilbage").
 * Rankedin ligger på et andet domæne, så vi kan ikke spørge rammen, hvor den
 * er. Men når man klikker rundt i den, får browserens historik nye punkter, og
 * history.back() går så tilbage INDE I RAMMEN. Vi tæller kun de punkter, der
 * er kommet til, mens vinduet er åbent, og går aldrig længere tilbage end det —
 * ellers ville "Tilbage" forlade selve PadelMakker-siden.
 */
function useFrameHistory(open) {
  const baseLength = useRef(0);
  const [steps, setSteps] = useState(0);
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    baseLength.current = window.history.length;
    setSteps(0);
    let seen = window.history.length;
    const timer = window.setInterval(() => {
      const now = window.history.length;
      if (now > seen) {
        setSteps((n) => n + (now - seen));
        seen = now;
      }
    }, 400);
    return () => window.clearInterval(timer);
  }, [open, frameKey]);

  const goBack = () => {
    if (steps <= 0) return;
    setSteps((n) => n - 1);
    window.history.back();
  };

  // Ny ramme fra spillerens forside. Gamle historik-punkter bliver liggende,
  // men tælleren starter forfra, så "Tilbage" aldrig rammer dem.
  const goHome = () => setFrameKey((k) => k + 1);

  return { canGoBack: steps > 0, goBack, frameKey, goHome };
}

export function RankedinSheet({ rankedinId, playerName = '', onClose }) {
  const url = rankedinProfileUrl(rankedinId);
  const open = Boolean(url);
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({ onClose, enabled: open });
  const { canGoBack, goBack, frameKey, goHome } = useFrameHistory(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const title = playerName ? `${playerName} på Rankedin` : 'Rankedin-profil';
  return createPortal(
    <>
      <button
        type="button"
        className="pm-kampe-v2-sheet-backdrop pm-kampe-v2-sheet-backdrop--stacked pm-rankedin-backdrop"
        aria-label="Luk Rankedin-profil"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`pm-kampe-v2-sheet pm-rankedin-sheet${sheetClassName ? ` ${sheetClassName}` : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div {...dragZoneProps} aria-label="Træk her for at lukke">
          <div className="pm-kampe-v2-sheet-handle" aria-hidden />
          <div className="pm-rankedin-head">
            <button
              type="button"
              className="pm-rankedin-icon"
              onClick={goBack}
              onPointerDown={(event) => event.stopPropagation()}
              disabled={!canGoBack}
              aria-label="Tilbage"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="pm-rankedin-icon"
              onClick={goHome}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Tilbage til spillerens forside på Rankedin"
            >
              <House size={16} aria-hidden />
            </button>
            <div className="pm-rankedin-title">{title}</div>
            <a
              className="pm-rankedin-open"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Åbn på Rankedin"
            >
              Åbn <ExternalLink size={13} aria-hidden />
            </a>
            <button
              type="button"
              className="pm-rankedin-close"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Luk"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
        <iframe
          key={frameKey}
          className="pm-rankedin-frame"
          src={url}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
        />
      </div>
    </>,
    document.body,
  );
}

/** Knap der åbner Rankedin-vinduet. Vises kun, når der er et gyldigt nummer. */
export function RankedinButton({ rankedinId, onOpen, style }) {
  if (!rankedinProfileUrl(rankedinId)) return null;
  return (
    <button type="button" className="pm-rankedin-button" onClick={onOpen} style={style}>
      <span className="pm-rankedin-button-badge" aria-hidden>R</span>
      Se Rankedin-profil
      <span className="pm-rankedin-button-sub">kampe og resultater</span>
      <ChevronRight size={16} aria-hidden className="pm-rankedin-button-chevron" />
    </button>
  );
}
