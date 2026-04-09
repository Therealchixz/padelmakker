import { useRef, useState } from 'react';
import { font, theme } from '../lib/platformTheme';
import { sortEloHistoryChronological, formatEloHistoryDate } from '../lib/eloHistoryUtils';

export function EloGraph({ data }) {
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  const W = 320;
  const H = 140;
  const PX = 32;
  const PY = 20;
  const hasGraph = data && data.length >= 2;
  const sorted = hasGraph ? sortEloHistoryChronological(data) : [];
  const values = (() => {
    if (!sorted.length) return [];
    let r = Math.round(Number(sorted[0].old_rating) || 1000);
    return sorted.map((d) => {
      const ch = d.change;
      if (ch != null && ch !== '' && Number.isFinite(Number(ch))) {
        r = Math.round(r + Number(ch));
      } else if (
        d.old_rating != null &&
        d.new_rating != null &&
        Number.isFinite(Number(d.old_rating)) &&
        Number.isFinite(Number(d.new_rating))
      ) {
        r = Math.round(Number(d.new_rating));
      }
      return r;
    });
  })();
  const minV = hasGraph ? Math.min(...values) - 20 : 1000;
  const maxV = hasGraph ? Math.max(...values) + 20 : 1000;
  const rangeV = maxV - minV || 1;

  const points = hasGraph
    ? sorted.map((d, i) => {
        const x = PX + (i / (sorted.length - 1)) * (W - PX * 2);
        const y = PY + (1 - (values[i] - minV) / rangeV) * (H - PY * 2);
        return { x, y, val: values[i], date: d.date };
      })
    : [];

  const clientXToSvgX = (clientX) => {
    const el = svgRef.current;
    if (!el) return 0;
    const pt = el.createSVGPoint();
    pt.x = clientX;
    pt.y = 0;
    const ctm = el.getScreenCTM();
    if (ctm) {
      const inv = ctm.inverse();
      return pt.matrixTransform(inv).x;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return ((clientX - rect.left) / rect.width) * W;
  };

  const pickNearestIndex = (clientX) => {
    if (points.length === 0) return 0;
    let svgX = clientXToSvgX(clientX);
    const xMin = points[0].x;
    const xMax = points[points.length - 1].x;
    svgX = Math.max(xMin, Math.min(xMax, svgX));
    let best = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const onSvgPointerMove = (e) => {
    setHoverIdx(pickNearestIndex(e.clientX));
  };

  const onSvgPointerLeave = () => {
    setHoverIdx(null);
  };

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath =
    hasGraph && points.length > 0
      ? line + ` L${points[points.length - 1].x},${H - PY} L${points[0].x},${H - PY} Z`
      : '';

  const gridLines = 3;
  const gridVals = Array.from({ length: gridLines }, (_, i) =>
    Math.round(minV + (rangeV * (i / (gridLines - 1))))
  );

  const hi = hoverIdx != null && points[hoverIdx] ? points[hoverIdx] : null;
  const last = points[points.length - 1];

  if (!hasGraph) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: theme.textLight, fontSize: '13px' }}>
        Spil mindst 2 kampe for at se din ELO-graf.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingBottom: '44px' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', maxHeight: '180px', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onSvgPointerMove}
        onMouseLeave={onSvgPointerLeave}
        onTouchStart={(e) => {
          if (e.touches[0]) setHoverIdx(pickNearestIndex(e.touches[0].clientX));
        }}
        onTouchMove={(e) => {
          if (e.touches[0]) setHoverIdx(pickNearestIndex(e.touches[0].clientX));
        }}
        onTouchEnd={onSvgPointerLeave}
      >
        {gridVals.map((v, i) => {
          const y = PY + (1 - (v - minV) / rangeV) * (H - PY * 2);
          return (
            <g key={i}>
              <line x1={PX} y1={y} x2={W - PX} y2={y} stroke={theme.border} strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={PX - 4} y={y + 3} textAnchor="end" fontSize="8" fill={theme.textLight} fontFamily={font}>
                {v}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.accent} stopOpacity="0.25" />
            <stop offset="100%" stopColor={theme.accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#eloGrad)" />
        <path d={line} fill="none" stroke={theme.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hi && (
          <line
            x1={hi.x}
            y1={PY}
            x2={hi.x}
            y2={H - PY}
            stroke={theme.accent}
            strokeWidth="1"
            strokeOpacity={0.35}
            pointerEvents="none"
          />
        )}
        {points.map((p, i) => {
          const active = hoverIdx === i;
          const isLast = i === points.length - 1;
          const r = active ? 5 : isLast ? 4 : 2.5;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={r}
              fill={theme.accent}
              stroke="#fff"
              strokeWidth={active ? 2 : 1.5}
            />
          );
        })}
        {!hi && points.length > 0 && (
          <text x={last.x} y={last.y - 8} textAnchor="middle" fontSize="9" fontWeight="700" fill={theme.accent} fontFamily={font}>
            {Math.round(last.val)}
          </text>
        )}
      </svg>
      {hi && (
        <div
          style={{
            position: 'absolute',
            left: `${(hi.x / W) * 100}%`,
            bottom: '4px',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 2,
            background: theme.surface,
            border: '1px solid ' + theme.border,
            borderRadius: '8px',
            padding: '6px 10px',
            boxShadow: theme.shadow,
            fontFamily: font,
            textAlign: 'center',
            minWidth: '120px',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 800, color: theme.accent, letterSpacing: '-0.02em' }}>
            ELO {Math.round(hi.val)}
          </div>
          <div style={{ fontSize: '11px', color: theme.textMid, marginTop: '2px', lineHeight: 1.3 }}>
            {formatEloHistoryDate(hi.date)}
          </div>
        </div>
      )}
    </div>
  );
}
