import { ArrowRight, Gauge, Truck } from "lucide-react";
import { Empty } from "./ui";
import { num } from "../lib/format";

export interface Vehicle { vehicle_id?: string; registration_number?: string; vehicle_model?: string; capacity_kl?: string; vehicle_status?: string }

const MAX_KL = 20; // largest tanker size offered at registration

/** Side-view tanker; the tank's water level shows capacity relative to the largest class. */
export function TankerArt({ capacity, active }: { capacity: number; active: boolean }) {
  const level = Math.max(0.12, Math.min(1, capacity / MAX_KL));
  const tankX = 10, tankY = 14, tankW = 92, tankH = 34;
  const waterTop = tankY + tankH * (1 - level);
  const id = `tank-${capacity}-${active ? 1 : 0}`;
  return (
    <svg viewBox="0 0 150 72" className="tanker-art" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}><rect x={tankX} y={tankY} width={tankW} height={tankH} rx={17} /></clipPath>
        <linearGradient id={`${id}-water`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={active ? "#38bdf8" : "#b8c2cf"} />
          <stop offset="100%" stopColor={active ? "#1463d6" : "#8a97a8"} />
        </linearGradient>
      </defs>
      {/* chassis */}
      <rect x="6" y="50" width="134" height="6" rx="3" fill="#334155" />
      {/* tank shell */}
      <rect x={tankX} y={tankY} width={tankW} height={tankH} rx={17} fill="#eef3f8" stroke="#cbd5e1" />
      <g clipPath={`url(#${id}-clip)`}>
        <path
          d={`M${tankX} ${waterTop} q 11.5 -4 23 0 t 23 0 t 23 0 t 23 0 V ${tankY + tankH} H ${tankX} Z`}
          fill={`url(#${id}-water)`}
        />
      </g>
      <rect x={tankX} y={tankY} width={tankW} height={tankH} rx={17} fill="none" stroke="#94a3b8" strokeWidth="1.2" />
      <line x1="40" y1={tankY} x2="40" y2={tankY + tankH} stroke="#cbd5e1" />
      <line x1="72" y1={tankY} x2="72" y2={tankY + tankH} stroke="#cbd5e1" />
      {/* cab */}
      <path d="M108 50 V26 a6 6 0 0 1 6 -6 h12 l12 14 v16 z" fill={active ? "#0b1626" : "#5f6e82"} />
      <path d="M116 25 h9 l8 10 h-17 z" fill="#bfe0ff" opacity="0.9" />
      {/* wheels */}
      {[26, 86, 124].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="58" r="8" fill="#1d2a3d" />
          <circle cx={cx} cy="58" r="3.2" fill="#cbd5e1" />
        </g>
      ))}
    </svg>
  );
}

function Donut({ part, total }: { part: number; total: number }) {
  const r = 30, c = 2 * Math.PI * r;
  const frac = total > 0 ? part / total : 0;
  return (
    <svg viewBox="0 0 80 80" className="donut" role="img" aria-label={`${part} of ${total} tankers free`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
      {frac > 0 && (
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--teal)" strokeWidth="9" strokeLinecap={frac < 1 ? "round" : "butt"}
          strokeDasharray={`${Math.max(0.001, c * frac)} ${c}`} transform="rotate(-90 40 40)" />
      )}
      <text x="40" y="38" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--ink-900)" style={{ fontVariantNumeric: "tabular-nums" }}>{part}</text>
      <text x="40" y="52" textAnchor="middle" fontSize="9.5" fill="var(--ink-500)">of {total} free</text>
    </svg>
  );
}

export function FleetPanel({ vehicles, free, total, onJob }: { vehicles: Vehicle[]; free: number; total: number; onJob: number }) {
  const caps = vehicles.map((v) => Number(v.capacity_kl) || 0);
  const totalKl = caps.reduce((a, b) => a + b, 0);
  return (
    <section className="card fleet">
      <header className="card-head">
        <div><h2>Fleet</h2><p>{vehicles.length} registered vehicle{vehicles.length === 1 ? "" : "s"}</p></div>
        <a href="/tanker/reports" className="btn btn-sm btn-ghost">Documents <ArrowRight /></a>
      </header>
      <div className="fleet-summary">
        <Donut part={free} total={Math.max(total, free)} />
        <dl>
          <div><dt><Truck size={13} /> On a job</dt><dd className="num">{onJob}</dd></div>
          <div><dt><Gauge size={13} /> Fleet capacity</dt><dd className="num">{num(totalKl)} <small>KL</small></dd></div>
          <div><dt>Largest tanker</dt><dd className="num">{caps.length ? num(Math.max(...caps)) : "—"} <small>KL</small></dd></div>
        </dl>
      </div>
      {vehicles.length ? (
        <div className="fleet-grid">
          {vehicles.map((v, i) => {
            const cap = Number(v.capacity_kl) || 0;
            const active = String(v.vehicle_status || "active").toLowerCase() === "active";
            return (
              <article key={v.vehicle_id ?? i} className="vehicle" data-active={active}>
                <TankerArt capacity={cap} active={active} />
                <div className="vehicle-meta">
                  <span className="plate num">{v.registration_number || v.vehicle_id}</span>
                  <span className="vehicle-cap num">{num(cap)} KL</span>
                </div>
                <div className="vehicle-sub">
                  <span>{v.vehicle_model || "Water tanker"}</span>
                  <span className={active ? "v-on" : "v-off"}>{active ? "In service" : String(v.vehicle_status || "Inactive")}</span>
                </div>
                <div className="cap-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (cap / MAX_KL) * 100)}%` }} /></div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty icon={Truck} title="No vehicles yet" action={<a className="btn btn-sm btn-secondary" href="/tanker/reports">Add a vehicle</a>} />
      )}
    </section>
  );
}
