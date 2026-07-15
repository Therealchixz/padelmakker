import { useRef, useState } from 'react';
import { font, theme } from '../lib/platformTheme';
import { sortEloHistoryChronological, formatEloHistoryDate } from '../lib/eloHistoryUtils';

function shortEloDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }).replace('.', '');
}

function graphPalette(dark) {
  if (dark) {
    return {
      gridLine: 'rgba(255, 255, 255, 0.24)',
      gridText: 'rgba(255, 255, 255, 0.68)',
      line: '#FFFFFF',
      lineHover: 'rgba(255, 255, 255, 0.38)',
      areaStart: 'rgba(255, 255, 255, 0.3)',
      areaEnd: 'rgba(255, 255, 255, 0.03)',
      dotFill: '#FFFFFF',
      dotStroke: 'rgba(13, 39, 82, 0.35)',
      valueLabel: '#FFFFFF',
      axisLabel: 'rgba(255, 255, 255, 0.72)',
      emptyText: 'var(--pm-hero-subtitle)',
      lineWidth: 2.5,
      dotR: { active: 5.5, last: 4.5, default: 3.5 },
    };
  }
  return {
    gridLine: theme.border,
    gridText: theme.textLight,
    line: theme.accent,
    lineHover: theme.accent,
    areaStart: theme.accent,
    areaStartOpacity: 0.25,
    areaEnd: theme.accent,
    areaEndOpacity: 0.02,
    dotFill: theme.accent,
    dotStroke: theme.onAccent,
    valueLabel: theme.accent,
    axisLabel: theme.textLight,
    emptyText: theme.textLight,
    lineWidth: 2,
    dotR: { active: 5, last: 4, default: 2.5 },
  };
}

export function EloGraph({
  data,
  valueLabel = 'ELO',
  emptyText = 'Spil mindst 2 kampe for at se din ELO-graf.',
  dark = false,
}) {
  const svgRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const palette = graphPalette(dark);
  const gradId = dark ? 'eloGradDark' : 'eloGradLight';

  const W = 320;
  const H = 150;
  const PX = 36;
  const PY = 22;
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
        const y = PY + (1 - (values[i] - minV) / rangeV) * (H - PY * 2 - 14);
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
      ? line + ` L${points[points.length - 1].x},${H - PY - 8} L${points[0].x},${H - PY - 8} Z`
      : '';

  const gridLines = 3;
  const gridVals = Array.from({ length: gridLines }, (_, i) =>
    Math.round(minV + (rangeV * (i / (gridLines - 1))))
  );

  const hi = hoverIdx != null && points[hoverIdx] ? points[hoverIdx] : null;
  const last = points[points.length - 1];
  const showXLabels = points.length <= 6;

  if (!hasGraph) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: palette.emptyText, fontSize: '13px' }}>
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingBottom: '44px' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', maxHeight: '190px', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onSvgPointerMove}
        onMouseLeave={onSvgPointerLeave}
        onTouchStart={(e) => {
          if (e.touches[0]) setHoverIdx(pickNearestIndex(e.touches[0].clientX));
        }}
        onTouchMove={(e) => {
          if (e.touches[0]) setHoverIdx(pickNearestIndex(e.touches[0].clientX));
        }}
        onTouchEnd={onSvgPointerLeave}
        aria-label={`${valueLabel}-graf over tid`}
      >
        {gridVals.map((v, i) => {
          const y = PY + (1 - (v - minV) / rangeV) * (H - PY * 2 - 14);
          return (
            <g key={i}>
              <line x1={PX} y1={y} x2={W - PX} y2={y} stroke={palette.gridLine} strokeWidth="1" strokeDasharray="4,4" />
              <text x={PX - 6} y={y + 3} textAnchor="end" fontSize="9" fill={palette.gridText} fontFamily={font}>
                {v}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={dark ? palette.areaStart : palette.areaStart}
              stopOpacity={dark ? 1 : palette.areaStartOpacity}
            />
            <stop
              offset="100%"
              stopColor={dark ? palette.areaEnd : palette.areaEnd}
              stopOpacity={dark ? 1 : palette.areaEndOpacity}
            />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={palette.line}
          strokeWidth={palette.lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hi && (
          <line
            x1={hi.x}
            y1={PY}
            x2={hi.x}
            y2={H - PY - 8}
            stroke={palette.lineHover}
            strokeWidth="1"
            pointerEvents="none"
          />
        )}
        {points.map((p, i) => {
          const active = hoverIdx === i;
          const isLast = i === points.length - 1;
          const r = active ? palette.dotR.active : isLast ? palette.dotR.last : palette.dotR.default;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={r}
              fill={palette.dotFill}
              stroke={palette.dotStroke}
              strokeWidth={active ? 2 : 1.5}
            />
          );
        })}
        {!hi && points.length > 0 && (
          <text
            x={last.x}
            y={last.y - 10}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill={palette.valueLabel}
            fontFamily={font}
          >
            {Math.round(last.val)}
          </text>
        )}
        {showXLabels &&
          points.map((p, i) => (
            <text
              key={`x-${i}`}
              x={p.x}
              y={H - 4}
              textAnchor="middle"
              fontSize="8.5"
              fill={palette.axisLabel}
              fontFamily={font}
            >
              {shortEloDate(p.date)}
            </text>
          ))}
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
            {valueLabel} {Math.round(hi.val)}
          </div>
          <div style={{ fontSize: '11px', color: theme.textMid, marginTop: '2px', lineHeight: 1.3 }}>
            {formatEloHistoryDate(hi.date)}
          </div>
        </div>
      )}
    </div>
  );
}
