import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

const ACTION_W = 84; // bredden paa den roede Slet-knap
const DELETE_AT = 0.45; // traekker man mere end 45 % af bredden, slettes med det samme

/**
 * Raekke man kan svippe til venstre for at slette (som i Mail paa iPhone).
 * Kort svip: Slet-knappen bliver staaende. Langt svip: raekken slettes.
 * Slet-knappen kan ogsaa naas med tastatur/skaermlaeser (raekken glider til side ved fokus).
 */
export function SwipeToDelete({ children, onDelete, label = 'Slet' }) {
  const rowRef = useRef(null);
  const slideRef = useRef(null);
  const openRef = useRef(false);
  const removingRef = useRef(false);

  const setX = (x, animate) => {
    const el = slideRef.current;
    if (!el) return;
    el.style.transition = animate ? '' : 'none';
    el.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
  };

  const remove = () => {
    if (removingRef.current) return;
    removingRef.current = true;
    const row = rowRef.current;
    const el = slideRef.current;
    if (!row || !el) { onDelete?.(); return; }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { onDelete?.(); return; }
    setX(-row.offsetWidth, true);
    // Saa lukkes hullet, saa raekkerne under glider op.
    row.style.height = row.offsetHeight + 'px';
    window.requestAnimationFrame(() => {
      row.classList.add('is-removing');
      row.style.height = '0px';
    });
    window.setTimeout(() => onDelete?.(), 380);
  };

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    let sx = 0;
    let sy = 0;
    let base = 0;
    let dir = null; // 'x' | 'y' | null
    let dx = 0;

    const onStart = (e) => {
      if (e.touches.length !== 1 || removingRef.current) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      base = openRef.current ? -ACTION_W : 0;
      dir = null;
      dx = 0;
    };
    const onMove = (e) => {
      if (removingRef.current) return;
      const mx = e.touches[0].clientX - sx;
      const my = e.touches[0].clientY - sy;
      if (!dir) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        dir = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      }
      if (dir !== 'x') return;
      e.preventDefault();
      e.stopPropagation();
      dx = mx;
      let x = base + mx;
      if (x > 0) x = x * 0.25; // lidt modstand mod hoejre
      setX(x, false);
    };
    const onEnd = () => {
      if (dir !== 'x' || removingRef.current) return;
      const x = base + dx;
      const w = row.offsetWidth || 1;
      if (-x > w * DELETE_AT) {
        remove();
      } else if (-x > ACTION_W / 2) {
        openRef.current = true;
        setX(-ACTION_W, true);
      } else {
        openRef.current = false;
        setX(0, true);
      }
      dir = null;
    };
    // Et tryk paa raekken, mens Slet staar fremme, lukker den i stedet for at aabne notifikationen.
    const onClickCapture = (e) => {
      if (openRef.current && !e.target.closest('.pm-swipe-action')) {
        e.preventDefault();
        e.stopPropagation();
        openRef.current = false;
        setX(0, true);
      }
    };

    row.addEventListener('touchstart', onStart, { passive: true });
    row.addEventListener('touchmove', onMove, { passive: false });
    row.addEventListener('touchend', onEnd);
    row.addEventListener('touchcancel', onEnd);
    row.addEventListener('click', onClickCapture, true);
    return () => {
      row.removeEventListener('touchstart', onStart);
      row.removeEventListener('touchmove', onMove);
      row.removeEventListener('touchend', onEnd);
      row.removeEventListener('touchcancel', onEnd);
      row.removeEventListener('click', onClickCapture, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers laeser refs
  }, []);

  return (
    <div ref={rowRef} className="pm-swipe-row">
      <button type="button" className="pm-swipe-action" onClick={remove} aria-label={label}>
        <Trash2 size={18} aria-hidden="true" />
        <span>Slet</span>
      </button>
      <div ref={slideRef} className="pm-swipe-slide">
        {children}
      </div>
    </div>
  );
}
