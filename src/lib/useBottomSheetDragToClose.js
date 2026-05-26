import { useCallback, useRef, useState } from 'react';

const CLOSE_THRESHOLD_PX = 72;
const CLOSE_VELOCITY_PX_PER_S = 520;

/**
 * Drag-to-dismiss for bottom sheets (handle / header zone).
 * Returns props for the drag zone and inline style for the sheet panel.
 */
export function useBottomSheetDragToClose({ onClose, enabled = true } = {}) {
  const dragRef = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const resetDrag = useCallback(() => {
    dragRef.current = null;
    setDragOffset(0);
    setIsDragging(false);
  }, []);

  const finishDrag = useCallback(
    (clientY) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dy = Math.max(0, clientY - drag.startY);
      const elapsedMs = Math.max(1, Date.now() - drag.startT);
      const velocity = (dy / elapsedMs) * 1000;
      const shouldClose = dy >= CLOSE_THRESHOLD_PX || (dy > 24 && velocity >= CLOSE_VELOCITY_PX_PER_S);

      resetDrag();
      if (shouldClose) onClose?.();
    },
    [onClose, resetDrag],
  );

  const onDragZonePointerDown = useCallback(
    (event) => {
      if (!enabled || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startT: Date.now(),
      };
      setIsDragging(true);
    },
    [enabled],
  );

  const onDragZonePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dy = Math.max(0, event.clientY - drag.startY);
    setDragOffset(dy);
  }, []);

  const onDragZonePointerUp = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      finishDrag(event.clientY);
    },
    [finishDrag],
  );

  const onDragZonePointerCancel = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      resetDrag();
    },
    [resetDrag],
  );

  const sheetStyle =
    dragOffset > 0
      ? {
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s ease-out',
        }
      : undefined;

  const sheetClassName = isDragging ? 'pm-kampe-v2-sheet--dragging' : '';

  return {
    dragZoneProps: {
      className: 'pm-kampe-v2-sheet-handle-zone',
      onPointerDown: onDragZonePointerDown,
      onPointerMove: onDragZonePointerMove,
      onPointerUp: onDragZonePointerUp,
      onPointerCancel: onDragZonePointerCancel,
      'aria-hidden': true,
    },
    sheetStyle,
    sheetClassName,
  };
}
