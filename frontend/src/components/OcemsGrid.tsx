import { Gauge } from "lucide-react";
import type { OcemsReading } from "../lib/types";
import { Badge } from "./ui";

const PARAMS: { key: "pH" | "BOD" | "COD" | "TSS"; unit: string; name: string }[] = [
  { key: "pH", unit: "", name: "pH" },
  { key: "BOD", unit: "mg/L", name: "BOD" },
  { key: "COD", unit: "mg/L", name: "COD" },
  { key: "TSS", unit: "mg/L", name: "TSS" },
];

/** Ranges arrive as "6.5 - 8.5", "<= 10" or {min, max}. */
function parseRange(r: unknown): { min?: number; max?: number } | null {
  if (r && typeof r === "object") {
    const o = r as { min?: number | null; max?: number | null };
    return { min: o.min ?? undefined, max: o.max ?? undefined };
  }
  const s = String(r ?? "").trim();
  let m = s.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = s.match(/^(?:<=|≤|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { max: Number(m[1]) };
  m = s.match(/^(?:>=|≥|>)\s*(-?\d+(?:\.\d+)?)$/);
  if (m) return { min: Number(m[1]) };
  return null;
}

function withinRange(reading: OcemsReading, key: string, value: unknown): boolean | null {
  const n = Number(value);
  const r = parseRange(reading.permissible_ranges?.[key]);
  if (!Number.isFinite(n) || value === "" || value === null || !r) return null;
  if (r.min !== undefined && n < r.min) return false;
  if (r.max !== undefined && n > r.max) return false;
  return true;
}

export function rangeLabel(reading: OcemsReading | null, key: string): string {
  const r = reading?.permissible_ranges?.[key];
  return typeof r === "string" ? r.replace("<=", "≤").replace(">=", "≥").replace(/\s*-\s*/, "–") : "";
}

export function OcemsGrid({ reading, loading }: { reading: OcemsReading | null; loading?: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-4" style={{ gap: 10 }}>
        {PARAMS.map((p) => <div key={p.key} className="skeleton" style={{ height: 64 }} />)}
      </div>
    );
  }
  if (!reading?.available) {
    return (
      <div className="row muted" style={{ fontSize: 13.5 }}>
        <Gauge size={16} /> No OCEMS readings reported for this plant yet.
      </div>
    );
  }
  return (
    <div>
      <div className="ocems-grid">
        {PARAMS.map((p) => {
          const v = reading[p.key];
          const ok = withinRange(reading, p.key, v);
          return (
            <div key={p.key} className="ocems-tile" data-ok={ok === null ? undefined : String(ok)}>
              <span>{p.name}</span>
              <strong className="num">{v === null || v === undefined || v === "" ? "—" : String(v)}</strong>
              <small title={rangeLabel(reading, p.key) ? `Permissible ${rangeLabel(reading, p.key)} ${p.unit}`.trim() : undefined}>{rangeLabel(reading, p.key) || p.unit || "scale"}</small>
            </div>
          );
        })}
      </div>
      <div className="row-between mt-8" style={{ fontSize: 12.5 }}>
        <span className="muted">{reading.timestamp ? `Reported ${reading.timestamp}` : "Timestamp unavailable"}</span>
        {PARAMS.some((p) => withinRange(reading, p.key, reading[p.key]) === false) ? (
          <Badge tone="warning">Outside limits</Badge>
        ) : (
          <Badge tone="success">Within limits</Badge>
        )}
      </div>
    </div>
  );
}
