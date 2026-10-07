/**
 * Rankedin-spillerside vist inde i PadelMakker (ejeren 7. okt. 2026).
 *
 * Rankedin har ingen åben adgang til kampe og resultater, men deres
 * spillerside må gerne vises i andre apps (ingen X-Frame-Options/frame-ancestors).
 * Siden vises derfor i et vindue nederst på skærmen, og "Åbn på Rankedin"
 * er reserven, hvis de en dag slår det fra.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ExternalLink, X } from 'lucide-react';
import { useBottomSheetDragToClose } from '../lib/useBottomSheetDragToClose';
import { RANKEDIN_TABS, rankedinProfileUrl } from '../lib/rankedin.js';

/*
 * Faner i stedet for tilbage-knap (ejeren 8. okt. 2026: "Tilbage knappen
 * virker ikke"). Rankedin ligger på et andet domæne, så appen kan ikke se,
 * hvor man er inde i rammen, og browserens tilbage virkede ikke på iPhone.
 * Fanerne sætter selv adressen på rammen, så de virker på alle telefoner:
 * man kommer altid tilbage til Info, Kampe osv. med ét tryk. Trykker man på
 * den fane, man står på, genindlæses den (fx efter at have klikket rundt).
 */
export function RankedinSheet({ rankedinId, playerName = '', onClose }) {
  const url = rankedinProfileUrl(rankedinId);
  const open = Boolean(url);
  const [tab, setTab] = useState('info');
  const [frameKey, setFrameKey] = useState(0);
  const frameUrl = rankedinProfileUrl(rankedinId, tab);
  const pickTab = (key) => {
    setTab(key);
    setFrameKey((k) => k + 1);
  };
  const { sheetRef, dragZoneProps, sheetStyle, sheetClassName } = useBottomSheetDragToClose({ onClose, enabled: open });

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
        <div className="pm-rankedin-tabs" role="tablist" aria-label="Sider på Rankedin">
          {RANKEDIN_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`pm-rankedin-tab${tab === t.key ? ' pm-rankedin-tab--active' : ''}`}
              onClick={() => pickTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <iframe
          key={frameKey}
          className="pm-rankedin-frame"
          src={frameUrl}
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
