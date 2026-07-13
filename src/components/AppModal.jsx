import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { theme, resolveModalMaxWidth } from '../lib/platformTheme';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function AppModal({
  open,
  onClose,
  ariaLabel,
  children,
  maxWidth,
  maxWidthPreset = 'md',
  zIndex = 1000,
  closeOnBackdrop = true,
  closeOnEscape = true,
  lockBodyScroll = true,
  contentStyle = {},
  backdropStyle = {},
  footer = null,
}) {
  const contentRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const contentEl = contentRef.current;
    if (!contentEl) return undefined;

    const previousOverflow = document.body.style.overflow;
    if (lockBodyScroll) document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const focusableNodes = Array.from(contentEl.querySelectorAll(FOCUSABLE_SELECTOR));
      const firstNode = focusableNodes[0] || contentEl;
      if (typeof firstNode.focus === "function") firstNode.focus();
    };
    const rafId = window.requestAnimationFrame(focusFirst);

    const onKeyDown = (event) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== "Tab") return;
      const focusableNodes = Array.from(contentEl.querySelectorAll(FOCUSABLE_SELECTOR));
      if (!focusableNodes.length) {
        event.preventDefault();
        if (typeof contentEl.focus === "function") contentEl.focus();
        return;
      }

      const firstNode = focusableNodes[0];
      const lastNode = focusableNodes[focusableNodes.length - 1];
      const activeNode = document.activeElement;
      const isInside = contentEl.contains(activeNode);

      if (!isInside) {
        event.preventDefault();
        if (typeof firstNode.focus === "function") firstNode.focus();
        return;
      }

      if (event.shiftKey && activeNode === firstNode) {
        event.preventDefault();
        if (typeof lastNode.focus === "function") lastNode.focus();
        return;
      }

      if (!event.shiftKey && activeNode === lastNode) {
        event.preventDefault();
        if (typeof firstNode.focus === "function") firstNode.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener('keydown', onKeyDown);
      if (lockBodyScroll) document.body.style.overflow = previousOverflow;
      if (openerRef.current && typeof openerRef.current.focus === "function") openerRef.current.focus();
    };
  }, [closeOnEscape, lockBodyScroll, onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const resolvedMaxWidth = resolveModalMaxWidth(maxWidth ?? maxWidthPreset);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="pm-app-modal-backdrop"
      onClick={(event) => {
        if (!closeOnBackdrop) return;
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: theme.overlay,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        ...backdropStyle,
      }}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className="pm-app-modal-content"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(100%, " + resolvedMaxWidth + ")",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          background: theme.surface,
          border: "1px solid " + theme.border,
          borderRadius: theme.radiusXl,
          boxShadow: theme.modalShadow,
          ...contentStyle,
        }}
      >
        {children}
        {footer ? <div className="pm-app-modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
