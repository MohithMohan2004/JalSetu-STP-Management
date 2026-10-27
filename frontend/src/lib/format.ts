export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** Order / transfer status → badge tone. Colour carries status only. */
export function statusTone(status?: string | null): Tone {
  const s = String(status ?? "").toLowerCase();
  if (["delivered", "completed", "approved", "accepted", "active", "available", "verified"].includes(s)) return "success";
  if (["out for delivery", "in transit", "picked up", "assigned"].includes(s)) return "info";
  if (["pending", "awaiting", "offered"].includes(s)) return "warning";
  if (["rejected", "cancelled", "canceled", "expired", "failed"].includes(s)) return "danger";
  return "neutral";
}

export function num(value: unknown, digits = 0): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "2026-10-19T09:50:02.146014" → "19 Oct, 09:50" */
export function when(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

export function initials(name?: string): string {
  return (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
