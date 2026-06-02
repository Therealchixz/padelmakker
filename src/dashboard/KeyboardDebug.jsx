import { useEffect, useRef, useState } from 'react';

/**
 * MIDLERTIDIG diagnostik til mobil-chat-layout på iOS.
 * Viser de faktiske viewport-tal fra enheden. Tryk for at skjule.
 * Fjernes igen når layoutet er bekræftet i orden.
 */
export function KeyboardDebug() {
  const [v, setV] = useState({});
  const [hidden, setHidden] = useState(false);
  const safeRef = useRef(null);

  useEffect(() => {
    const vv = window.visualViewport;
    const read = () => {
      const shell = document.getElementById('pm-app-shell');
      const rect = shell ? shell.getBoundingClientRect() : null;
      const bar = document.querySelector('.pm-chat-v2-input-bar');
      const barRect = bar ? bar.getBoundingClientRect() : null;
      const cs = getComputedStyle(document.documentElement);
      const safe = safeRef.current ? safeRef.current.getBoundingClientRect().height : null;
      setV({
        standalone: String(
          window.matchMedia('(display-mode: standalone)').matches ||
          window.navigator.standalone || false
        ),
        innerH: window.innerHeight,
        vvH: vv ? Math.round(vv.height) : 'n/a',
        vvTop: vv ? Math.round(vv.offsetTop) : 'n/a',
        cssVvh: cs.getPropertyValue('--vvh').trim() || '(unset)',
        cssVvs: cs.getPropertyValue('--vvs').trim() || '(unset)',
        shellTop: rect ? Math.round(rect.top) : 'n/a',
        shellH: rect ? Math.round(rect.height) : 'n/a',
        shellBot: rect ? Math.round(rect.bottom) : 'n/a',
        barBot: barRect ? Math.round(barRect.bottom) : 'n/a',
        safeBottom: safe != null ? Math.round(safe) : 'n/a',
      });
    };
    read();
    const id = setInterval(read, 300);
    vv?.addEventListener('resize', read);
    vv?.addEventListener('scroll', read);
    window.addEventListener('resize', read);
    return () => {
      clearInterval(id);
      vv?.removeEventListener('resize', read);
      vv?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  if (hidden) return null;

  return (
    <>
      <div
        ref={safeRef}
        aria-hidden
        style={{ position: 'fixed', bottom: 0, left: 0, width: 1, height: 'env(safe-area-inset-bottom)', opacity: 0, pointerEvents: 'none' }}
      />
      <div
        onClick={() => setHidden(true)}
        style={{
          position: 'fixed',
          top: 'env(safe-area-inset-top, 0px)',
          left: 4,
          zIndex: 2147483647,
          background: 'rgba(0,0,0,0.82)',
          color: '#19ff19',
          font: '10px/1.35 ui-monospace, monospace',
          padding: '6px 8px',
          borderRadius: 6,
          maxWidth: '80vw',
          whiteSpace: 'pre',
          pointerEvents: 'auto',
        }}
      >
        {`standalone:${v.standalone}
innerH:${v.innerH}  vvH:${v.vvH}  vvTop:${v.vvTop}
--vvh:${v.cssVvh}  --vvs:${v.cssVvs}
shell top:${v.shellTop} h:${v.shellH} bot:${v.shellBot}
inputbar bot:${v.barBot}  safeBottom:${v.safeBottom}
(tryk for at skjule)`}
      </div>
    </>
  );
}
