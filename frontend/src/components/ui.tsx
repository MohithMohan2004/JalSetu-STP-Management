import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, Info } from "lucide-react";
import { statusTone, type Tone } from "../lib/format";

export function StatusBadge({ status }: { status?: string | null }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
  return <span className="badge" data-tone={statusTone(status)}>{label}</span>;
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className="badge" data-tone={tone}>{children}</span>;
}

export function Stat({ label, value, unit, hint, icon: Icon }: {
  label: string; value: ReactNode; unit?: string; hint?: ReactNode; icon?: LucideIcon;
}) {
  return (
    <div className="card stat">
      <div className="stat-label">
        {Icon && <Icon size={15} />}
        {label}
      </div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }: {
  icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon size={20} /></span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  const I = tone === "info" ? Info : CircleAlert;
  return (
    <div className="notice" data-tone={tone}>
      <I size={16} />
      <div>{children}</div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="list">
      {Array.from({ length: rows }, (_, i) => (
        <div className="list-row" key={i}>
          <div className="skeleton" style={{ height: 14, width: "40%" }} />
          <div className="skeleton mt-8" style={{ height: 12, width: "70%" }} />
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
