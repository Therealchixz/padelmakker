import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const CLOSE_DISTANCE = 110; // px traek nedad, der lukker arket
const CLOSE_VELOCITY = 0.5; // px/ms: et hurtigt svirp lukker ogsaa
const EXIT_MS = 220;

/**
 * Et ark, der glider op nedefra (telefon). Kan lukkes ved at traekke det ned,
 * trykke uden for det, trykke Escape eller paa en lukkeknap i indholdet.
 * Traek virker fra toppen af arket, og fra listen naar den er rullet helt op.
 */
export function BottomSheet({ open, onClose, ariaLabel, children, className = '' }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);
  const openerRef = useRef(null);
  const closeTimerRef = useRef(0);

  useEffect(() => {
    if (open) {
      window.clearTimeout(closeTimerRef.current);
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, EXIT_MS);
    }
    return undefined;
  }, [open, mounted]);

  useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

  const requestClose = useCallback(() => onClose?.(), [onClose]);

  // Escape, fokus og stop for scroll bag arket.
  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = window.requestAnimationFrame(() => sheetRef.current?.focus({ preventScroll: true }));
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, [open, requestClose]);

  // Traek nedad for at lukke (touch-haendelser, saa det ogsaa virker i Safari).
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!open || !sheet) return undefined;
    let startY = 0;
    let startT = 0;
    let lastY = 0;
    let lastT = 0;
    let tracking = false;
    let dragging = false;

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      const scroller = scrollRef.current;
      // Fra toppen af arket altid; fra listen kun naar den staar helt oeverst,
      // ellers er det almindelig scroll.
      const fromTop = e.touches[0].clientY - sheet.getBoundingClientRect().top < 72;
      tracking = fromTop || !scroller || scroller.scrollTop <= 0;
      dragging = false;
      startY = lastY = e.touches[0].clientY;
      startT = lastT = performance.now();
    };
    const onMove = (e) => {
      if (!tracking) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (!dragging) {
        if (dy < -4) { tracking = false; return; }
        if (dy < 6) return;
        dragging = true;
        sheet.style.transition = 'none';
      }
      e.preventDefault();
      lastY = y;
      lastT = performance.now();
      sheet.style.transform = `translate3d(0, ${Math.max(0, dy)}px, 0)`;
    };
    const onEnd = () => {
      if (!dragging) { tracking = false; return; }
      const dy = lastY - startY;
      const dt = Math.max(1, lastT - startT);
      const v = dy / dt;
      tracking = false;
      dragging = false;
      sheet.style.transition = '';
      if (dy > CLOSE_DISTANCE || v > CLOSE_VELOCITY) {
        sheet.style.transform = 'translate3d(0, 100%, 0)';
        requestClose();
      } else {
        sheet.style.transform = '';
      }
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [open, requestClose]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={'pm-sheet-backdrop' + (closing ? ' is-closing' : '')}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={'pm-sheet' + (closing ? ' is-closing' : '') + (className ? ' ' + className : '')}
      >
        <div className="pm-sheet-grip" aria-hidden="true" />
        <div ref={scrollRef} className="pm-sheet-scroll">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
