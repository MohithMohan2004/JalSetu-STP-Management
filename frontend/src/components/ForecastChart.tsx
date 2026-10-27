import { useEffect, useId, useMemo, useRef, useState } from "react";

/** Monotone cubic interpolation (Fritsch–Carlson) → no overshoot between points. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  const n = pts.length;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1]![0] - pts[i]![0];
    m[i] = (pts[i + 1]![1] - pts[i]![1]) / dx[i]!;
  }
  const t: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2;
  t[n - 1] = m[n - 2]!;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i]! / m[i]!, b = t[i + 1]! / m[i]!, h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]!; t[i + 1] = k * b * m[i]!; }
  }
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!, [x1, y1] = pts[i + 1]!, h = dx[i]! / 3;
    d += ` C${x0 + h},${y0 + t[i]! * h} ${x1 - h},${y1 - t[i + 1]! * h} ${x1},${y1}`;
  }
  return d;
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

/** Seven-day demand forecast as a smooth area chart with a hover readout. */
export function ForecastChart({ values, unit = "KLD" }: { values: number[]; unit?: string }) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Draw at the real pixel width so axis text stays legible in narrow columns.
  const [W, setW] = useState(560);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 200, pad = { t: 18, r: 14, b: 28, l: 40 };
  const days = useMemo(() => values.map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return { short: d.toLocaleDateString("en-IN", { weekday: "short" }), long: d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }) };
  }), [values]);

  const vmin = Math.min(...values), vmax = Math.max(...values);
  const padV = Math.max((vmax - vmin) * 0.35, vmax * 0.02, 1);
  const ticks = niceTicks(Math.max(0, vmin - padV), vmax + padV);
  const y0 = ticks[0]!, y1 = ticks[ticks.length - 1]!;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, values.length - 1);
  const y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - pad.t - pad.b);
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smoothPath(pts);
  const area = `${line} L${x(values.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const peak = values.indexOf(vmax);
  const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const active = hover ?? peak;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach(([px0], i) => { if (Math.abs(px0 - px) < Math.abs(pts[best]![0] - px)) best = i; });
    setHover(best);
  }

  const fmt = (v: number) => Math.round(v).toLocaleString("en-IN");
  const tipX = Math.min(Math.max(pts[active]![0], pad.l + 60), W - pad.r - 60);

  return (
    <div className="forecast" ref={boxRef}>
      <div className="forecast-summary">
        <div><span>Peak</span><strong className="num">{fmt(vmax)} <small>{unit}</small></strong><em>{days[peak]?.short}</em></div>
        <div><span>Average</span><strong className="num">{fmt(avg)} <small>{unit}</small></strong><em>per day</em></div>
        <div><span>Week total</span><strong className="num">{fmt(values.reduce((a, b) => a + b, 0))} <small>{unit}</small></strong><em>7 days</em></div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`Seven-day demand forecast. Peak ${fmt(vmax)} ${unit} on ${days[peak]?.long}, average ${fmt(avg)} ${unit}.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ touchAction: "pan-y", display: "block" }}
      >
        <defs>
          <linearGradient id={`fa-${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1463d6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1463d6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`fl-${gid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#1463d6" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === y0 ? undefined : "3 4"} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-400)" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(t)}</text>
          </g>
        ))}

        <line x1={pad.l} x2={W - pad.r} y1={y(avg)} y2={y(avg)} stroke="var(--teal)" strokeOpacity="0.5" strokeDasharray="2 3" />
        <text x={W - pad.r} y={y(avg) - 5} textAnchor="end" fontSize="10.5" fill="var(--teal)" fontWeight="600">avg</text>

        <path d={area} fill={`url(#fa-${gid})`} />
        <path d={line} fill="none" stroke={`url(#fl-${gid})`} strokeWidth="2.75" strokeLinecap="round" />

        {days.map((d, i) => (
          <text key={i} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11.5" fill={i === active ? "var(--ink-900)" : "var(--ink-500)"} fontWeight={i === active ? 600 : 400}>
            {d.short}
          </text>
        ))}

        <line x1={pts[active]![0]} x2={pts[active]![0]} y1={pad.t} y2={H - pad.b} stroke="var(--ink-300)" strokeDasharray="3 3" />
        {pts.map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={i === active ? 5.5 : 3} fill={i === active ? "#fff" : "#1463d6"} stroke="#1463d6" strokeWidth={i === active ? 2.5 : 0} style={{ transition: "r 140ms" }} />
        ))}

        <g transform={`translate(${tipX}, ${Math.max(pts[active]![1] - 44, 4)})`} pointerEvents="none">
          <rect x="-58" y="0" width="116" height="34" rx="8" fill="var(--ink-900)" />
          <text x="0" y="14" textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,0.7)">{days[active]?.long}</text>
          <text x="0" y="28" textAnchor="middle" fontSize="12.5" fontWeight="650" fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(values[active]!)} {unit}</text>
        </g>
      </svg>
    </div>
  );
}
