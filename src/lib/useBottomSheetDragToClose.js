import { useCallback, useEffect, useRef, useState } from 'react';

const SNAP_MS = 240;

/**
 * Bottom-sheet dismiss thresholds (industry defaults — do not tune ad hoc).
 *
 * **Web (Vaul / shadcn Drawer):** `closeThreshold` 0.25, `VELOCITY_THRESHOLD` 0.4 px/ms
 * @see https://github.com/emilkowalski/vaul/blob/main/src/constants.ts
 * @see https://github.com/emilkowalski/vaul/blob/main/src/index.tsx (onRelease)
 *
 * **Android (Material BottomSheetBehavior):** `HIDE_THRESHOLD` 0.5, `HIDE_FRICTION` 0.1,
 * `significantVelocityThreshold` 500 px/s — projection-based; we use Vaul on web for parity
 * with React drawer UX.
 * @see https://github.com/material-components/material-components-android/blob/master/lib/java/com/google/android/material/bottomsheet/BottomSheetBehavior.java
 */
export const BOTTOM_SHEET_CLOSE_THRESHOLD = 0.25;
/** Vaul default; velocity alone must not dismiss tiny pulls. */
export const BOTTOM_SHEET_VELOCITY_THRESHOLD_PX_PER_MS = 0.4;
/** Fast flick must still move the sheet at least this far (avoids accidental close on release). */
export const BOTTOM_SHEET_MIN_FLICK_DISMISS_FRACTION = 0.15;

/** Matches `.pm-kampe-v2-sheet { max-height: min(85vh, 640px) }` — fallback before measure. */
export function getEstimatedSheetHeightPx() {
  if (typeof window === 'undefined') return 520;
  return Math.min(Math.round(window.innerHeight * 0.85), 640);
}

export function getBottomSheetCloseDistanceThresholdPx(sheetHeightPx = getEstimatedSheetHeightPx()) {
  return Math.round(Math.max(1, sheetHeightPx) * BOTTOM_SHEET_CLOSE_THRESHOLD);
}

/**
 * Vaul-style release: fast flick past min distance, or slow drag past 25% of sheet height.
 */
export function shouldCloseBottomSheetDrag({ dy, sheetHeightPx, elapsedMs }) {
  const distance = Math.max(0, dy);
  if (distance <= 0) return false;

  const height = Math.max(1, sheetHeightPx ?? getEstimatedSheetHeightPx());
  const ms = Math.max(1, elapsedMs ?? 9999);
  const velocityPxPerMs = distance / ms;
  const minFlickDistance = height * BOTTOM_SHEET_MIN_FLICK_DISMISS_FRACTION;

  if (
    velocityPxPerMs > BOTTOM_SHEET_VELOCITY_THRESHOLD_PX_PER_MS &&
    distance >= minFlickDistance
  ) {
    return true;
  }

  return distance >= height * BOTTOM_SHEET_CLOSE_THRESHOLD;
}

/**
 * Drag-to-dismiss for bottom sheets (handle / header zone).
 * Attach `sheetRef` to the sheet panel for height-based threshold.
 */
export function useBottomSheetDragToClose({ onClose, enabled = true } = {}) {
  const sheetElRef = useRef(null);
  const sheetHeightRef = useRef(getEstimatedSheetHeightPx());
  const dragRef = useRef(null);
  const animTimerRef = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const measureSheetHeight = useCallback(() => {
    const el = sheetElRef.current;
    if (!el) {
      const estimated = getEstimatedSheetHeightPx();
      sheetHeightRef.current = estimated;
      return estimated;
    }
    const height = Math.round(el.getBoundingClientRect().height);
    sheetHeightRef.current = height > 0 ? height : getEstimatedSheetHeightPx();
    return sheetHeightRef.current;
  }, []);

  const clearAnimTimer = useCallback(() => {
    if (animTimerRef.current != null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  }, []);

  const resetDrag = useCallback(() => {
    clearAnimTimer();
    dragRef.current = null;
    setDragOffset(0);
    setIsDragging(false);
    setIsAnimating(false);
  }, [clearAnimTimer]);

  const animateDragOffset = useCallback((nextOffset) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDragOffset(nextOffset);
      });
    });
  }, []);

  const runSnapBack = useCallback(() => {
    clearAnimTimer();
    setIsDragging(false);
    setIsAnimating(true);
    animateDragOffset(0);
    animTimerRef.current = window.setTimeout(() => {
      setIsAnimating(false);
      animTimerRef.current = null;
    }, SNAP_MS + 50);
  }, [animateDragOffset, clearAnimTimer]);

  const runDismiss = useCallback(() => {
    clearAnimTimer();
    setIsDragging(false);
    setIsAnimating(true);
    const dismissY = typeof window !== 'undefined' ? window.innerHeight : 900;
    animateDragOffset(dismissY);
    animTimerRef.current = window.setTimeout(() => {
      resetDrag();
      onClose?.();
    }, SNAP_MS);
  }, [animateDragOffset, clearAnimTimer, onClose, resetDrag]);

  const finishDrag = useCallback(
    (clientY, { allowClose = true } = {}) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dy = Math.max(0, clientY - drag.startY);
      const elapsedMs = Date.now() - drag.startT;
      const sheetHeight = sheetHeightRef.current ?? measureSheetHeight();
      const shouldClose =
        allowClose &&
        shouldCloseBottomSheetDrag({ dy, sheetHeightPx: sheetHeight, elapsedMs });

      dragRef.current = null;
      setIsDragging(false);

      if (shouldClose) {
        runDismiss();
      } else if (dy > 0) {
        runSnapBack();
      } else {
        setDragOffset(0);
        setIsAnimating(false);
      }
    },
    [measureSheetHeight, runDismiss, runSnapBack],
  );

  const onDragZonePointerDown = useCallback(
    (event) => {
      if (!enabled || event.button !== 0) return;
      clearAnimTimer();
      setIsAnimating(false);
      measureSheetHeight();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startT: Date.now(),
        lastY: event.clientY,
      };
      setIsDragging(true);
    },
    [clearAnimTimer, enabled, measureSheetHeight],
  );

  const onDragZonePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    drag.lastY = event.clientY;
    const dy = Math.max(0, event.clientY - drag.startY);
    setDragOffset(dy);
  }, []);

  const onDragZonePointerUp = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
      finishDrag(event.clientY);
    },
    [finishDrag],
  );

  const onDragZonePointerCancel = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dy = Math.max(0, (drag.lastY ?? drag.startY) - drag.startY);
      dragRef.current = null;
      setIsDragging(false);
      if (dy > 0) runSnapBack();
      else resetDrag();
    },
    [resetDrag, runSnapBack],
  );

  useEffect(() => {
    if (!enabled) resetDrag();
  }, [enabled, resetDrag]);

  useEffect(() => () => clearAnimTimer(), [clearAnimTimer]);

  const sheetStyle =
    isDragging || isAnimating || dragOffset > 0
      ? {
          '--sheet-drag-y': `${dragOffset}px`,
          transition: isDragging ? 'none' : `transform ${SNAP_MS}ms ease-out`,
        }
      : undefined;

  const sheetClassName = isDragging ? 'pm-kampe-v2-sheet--dragging' : '';

  return {
    sheetRef: sheetElRef,
    dragZoneProps: {
      className: 'pm-kampe-v2-sheet-handle-zone',
      onPointerDown: onDragZonePointerDown,
      onPointerMove: onDragZonePointerMove,
      onPointerUp: onDragZonePointerUp,
      onPointerCancel: onDragZonePointerCancel,
      onClick: (event) => event.stopPropagation(),
      'aria-hidden': true,
    },
    sheetStyle,
    sheetClassName,
  };
}
