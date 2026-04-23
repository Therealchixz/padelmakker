import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { font, theme } from '../lib/platformTheme';

const OVERLAY_Z_INDEX = 10040;
const TARGET_PADDING = 8;
const TOOLTIP_WIDTH = 320;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function GuidedTourOverlay({
  open,
  steps = [],
  stepIndex = 0,
  onBack,
  onNext,
  onSkip,
  onFinish,
}) {
  const step = steps[stepIndex] || null;
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    if (!open || !step?.selector) {
      setTargetRect(null);
      return undefined;
    }

    let rafId = null;
    const updateRect = () => {
      const el = document.querySelector(step.selector);
      if (!el) {
        setTargetRect(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setTargetRect({
        left: Math.max(0, rect.left),
        top: Math.max(0, rect.top),
        width: Math.max(0, rect.width),
        height: Math.max(0, rect.height),
      });
    };

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateRect);
    };

    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const intervalId = window.setInterval(schedule, 400);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearInterval(intervalId);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [open, step?.selector, stepIndex]);

  const tooltipPos = useMemo(() => {
    if (!targetRect) {
      const centerLeft = Math.max(12, (window.innerWidth - TOOLTIP_WIDTH) / 2);
      const centerTop = Math.max(24, (window.innerHeight - 220) / 2);
      return { left: centerLeft, top: centerTop };
    }

    const left = clamp(
      targetRect.left + targetRect.width / 2 - TOOLTIP_WIDTH / 2,
      12,
      Math.max(12, window.innerWidth - TOOLTIP_WIDTH - 12)
    );

    const placeBelow = targetRect.top < window.innerHeight * 0.55;
    const top = placeBelow
      ? Math.min(window.innerHeight - 210, targetRect.top + targetRect.height + 14)
      : Math.max(14, targetRect.top - 198);

    return { left, top };
  }, [targetRect]);

  if (!open || !step) return null;

  const isLast = stepIndex >= steps.length - 1;

  return createPortal(
    <div
      aria-live="polite"
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: OVERLAY_Z_INDEX }}
    >
      {!targetRect && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.58)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        />
      )}

      {targetRect && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: targetRect.left - TARGET_PADDING,
            top: targetRect.top - TARGET_PADDING,
            width: targetRect.width + TARGET_PADDING * 2,
            height: targetRect.height + TARGET_PADDING * 2,
            borderRadius: 14,
            boxShadow: '0 0 0 2px rgba(255,255,255,0.96), 0 0 0 9999px rgba(15, 23, 42, 0.58)',
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          left: tooltipPos.left,
          top: tooltipPos.top,
          width: `min(${TOOLTIP_WIDTH}px, calc(100vw - 24px))`,
          background: theme.surface,
          border: '1px solid ' + theme.border,
          borderRadius: 14,
          boxShadow: '0 18px 40px rgba(2, 6, 23, 0.32)',
          padding: '14px 14px 12px',
          color: theme.text,
          fontFamily: font,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>{step.title}</div>
          <div style={{ fontSize: 11, color: theme.textLight, fontWeight: 700 }}>
            {stepIndex + 1}/{steps.length}
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 13, color: theme.textMid, lineHeight: 1.45 }}>
          {step.description}
        </div>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button
            type="button"
            onClick={onSkip}
            style={{
              border: 'none',
              background: 'transparent',
              color: theme.textLight,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: font,
              padding: '6px 2px',
            }}
          >
            Skip
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onBack}
              disabled={stepIndex === 0}
              style={{
                border: '1px solid ' + theme.border,
                background: theme.surface,
                color: theme.textMid,
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 700,
                cursor: stepIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: stepIndex === 0 ? 0.45 : 1,
                fontFamily: font,
                padding: '7px 11px',
              }}
            >
              Tilbage
            </button>

            <button
              type="button"
              onClick={isLast ? onFinish : onNext}
              style={{
                border: 'none',
                background: theme.accent,
                color: '#fff',
                borderRadius: 9,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: font,
                padding: '7px 12px',
              }}
            >
              {isLast ? 'Færdig' : 'Næste'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
