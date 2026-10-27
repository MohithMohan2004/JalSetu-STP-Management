import { useRef, useState } from "react";
import {
  CircleAlert, CircleCheck, Clock, Droplets, FileText, FileUp, Gauge, Mail, MapPin, Phone, Radar, RefreshCw, ShieldCheck, Truck, Upload,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { roleNav } from "../components/nav";
import { UserMenu } from "../components/UserMenu";
import { TankerArt } from "../components/Fleet";
import { Empty, Notice, Spinner, StatusBadge } from "../components/ui";
import { getJSON, postForm } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useToast } from "../lib/toast";
import { num, when } from "../lib/format";
import "./fleet-reports.css";

interface Doc { document_id: string; document_type: string; original_filename: string; uploaded_at: string; verification_status: string; admin_remark?: string; verified_at?: string }
interface Vehicle { vehicle_id: string; registration_number: string; vehicle_model?: string; capacity_kl?: string; vehicle_status?: string; created_at?: string }
interface Reports {
  operator: Record<string, string | number | null>;
  operator_type: string;
  operational_tankers: number;
  active_tankers: number;
  available_tankers: number;
  vehicles: Vehicle[];
  documents: Record<string, Record<string, Doc>>;
}

const DOC_TYPES: { key: string; label: string; short: string }[] = [
  { key: "rc", label: "Registration certificate", short: "RC" },
  { key: "insurance", label: "Insurance", short: "Insurance" },
  { key: "puc", label: "Pollution certificate", short: "PUC" },
  { key: "permit", label: "Permit", short: "Permit" },
];
const SEG_COLORS = ["#1463d6", "#0d9488", "#7c3aed", "#d97706", "#0284c7", "#e11d48", "#64748b"];
type DocState = "verified" | "pending" | "rejected" | "missing";
const docState = (d?: Doc): DocState => {
  const s = String(d?.verification_status ?? "").toLowerCase();
  if (!d) return "missing";
  if (s === "verified" || s === "approved") return "verified";
  if (s === "rejected") return "rejected";
  return "pending";
};

export default function FleetReports() {
  const r = useAsync((s) => getJSON<Reports>("/api/tanker/reports", s));
  const d = r.data;
  const op = d?.operator ?? {};
  const vehicles = d?.vehicles ?? [];

  const caps = vehicles.map((v) => Number(v.capacity_kl) || 0);
  const totalKl = caps.reduce((a, b) => a + b, 0);
  const states = vehicles.flatMap((v) => DOC_TYPES.map((t) => docState(d?.documents?.[v.vehicle_id]?.[t.key])));
  const count = (s: DocState) => states.filter((x) => x === s).length;
  const required = states.length;
  const verifiedPct = required ? (count("verified") / required) * 100 : 0;

  return (
    <AppShell
      nav={roleNav.tanker!}
      title="Fleet & documents"
      subtitle="Vehicles, capacity and compliance for your operation"
      actions={
        <>
          <button type="button" className="btn btn-ghost btn-icon" onClick={r.reload} aria-label="Refresh" title="Refresh">
            {r.loading ? <Spinner /> : <RefreshCw />}
          </button>
          <UserMenu />
        </>
      }
    >
      <main className="page fleet-page">
        {r.error && <Notice tone="danger">{r.error}</Notice>}

        {/* HERO */}
        <section className="fleet-hero">
          <div className="fleet-hero-id">
            <span className="fleet-hero-icon"><Truck size={22} /></span>
            <div>
              <div className="row wrap" style={{ gap: 8 }}>
                <h2>{op.operator_name ?? " "}</h2>
                {op.verification_status && <StatusBadge status={String(op.verification_status)} />}
              </div>
              <p className="num">{op.operator_id} · {d?.operator_type === "contracted" ? "Contracted partner" : "Independent operator"}</p>
              <ul className="fleet-contact">
                {op.phone && <li><Phone size={13} /> {op.phone}</li>}
                {op.email && <li><Mail size={13} /> {op.email}</li>}
                {op.area && <li><MapPin size={13} /> {op.area}{op.pincode ? ` · ${op.pincode}` : ""}</li>}
              </ul>
            </div>
          </div>
          <div className="fleet-hero-stats">
            <Ring value={d?.available_tankers ?? 0} total={Math.max(d?.operational_tankers ?? 0, d?.available_tankers ?? 0)} label="free" color="#5eead4" />
            <dl>
              <div><dt>Operational</dt><dd className="num">{d ? d.operational_tankers : "—"}</dd></div>
              <div><dt>On a job</dt><dd className="num">{d ? d.active_tankers : "—"}</dd></div>
              <div><dt>Available</dt><dd className="num">{d ? d.available_tankers : "—"}</dd></div>
            </dl>
          </div>
        </section>

        {/* GRAPHIC SUMMARY */}
        <section className="fleet-summary-grid">
          <article className="card fs-card">
            <header><span className="fs-icon" data-tone="blue"><Gauge size={16} /></span><h3>Fleet capacity</h3></header>
            <div className="fs-figure num">{num(totalKl)} <small>KL per trip</small></div>
            <div className="cap-stack" role="img" aria-label="Capacity by vehicle">
              {vehicles.map((v, i) => (
                <span key={v.vehicle_id} style={{ flexGrow: Number(v.capacity_kl) || 0, background: SEG_COLORS[i % SEG_COLORS.length] }} title={`${v.registration_number}: ${v.capacity_kl} KL`} />
              ))}
            </div>
            <ul className="cap-legend">
              {vehicles.map((v, i) => (
                <li key={v.vehicle_id}><i style={{ background: SEG_COLORS[i % SEG_COLORS.length] }} /><span className="num">{v.registration_number}</span><b className="num">{num(v.capacity_kl)} KL</b></li>
              ))}
            </ul>
          </article>

          <article className="card fs-card">
            <header><span className="fs-icon" data-tone="teal"><ShieldCheck size={16} /></span><h3>Document compliance</h3></header>
            <div className="compliance">
              <Ring value={count("verified")} total={required} label="verified" color="var(--success)" track="var(--surface-3)" dark />
              <ul className="comp-list">
                <CompRow tone="success" label="Verified" n={count("verified")} total={required} />
                <CompRow tone="warning" label="Under review" n={count("pending")} total={required} />
                <CompRow tone="danger" label="Rejected" n={count("rejected")} total={required} />
                <CompRow tone="neutral" label="Missing" n={count("missing")} total={required} />
              </ul>
            </div>
            <p className="fs-note">{required ? `${Math.round(verifiedPct)}% of ${required} required documents verified` : "Add vehicles to track documents"}</p>
          </article>

          <article className="card fs-card">
            <header><span className="fs-icon" data-tone="violet"><Radar size={16} /></span><h3>Service area</h3></header>
            <div className="radius-art" aria-hidden="true">
              <svg viewBox="0 0 200 120">
                <circle cx="100" cy="60" r="54" fill="var(--violet-tint)" stroke="var(--violet)" strokeOpacity=".25" strokeDasharray="4 5" />
                <circle cx="100" cy="60" r="34" fill="var(--violet-tint)" stroke="var(--violet)" strokeOpacity=".3" />
                <circle cx="100" cy="60" r="14" fill="var(--violet-tint)" />
                <circle cx="100" cy="60" r="6" fill="var(--violet)" />
                <line x1="100" y1="60" x2="154" y2="60" stroke="var(--violet)" strokeWidth="1.5" />
                <circle cx="154" cy="60" r="3" fill="var(--violet)" />
              </svg>
              <span className="radius-label num">{op.service_radius_km ? `${num(op.service_radius_km)} km` : "—"}</span>
            </div>
            <dl className="svc-facts">
              <div><dt><Droplets size={13} /> Water type</dt><dd>{String(op.water_type_supported || "—")}</dd></div>
              <div><dt><MapPin size={13} /> Base</dt><dd>{String(op.area || "—")}</dd></div>
            </dl>
          </article>
        </section>

        {/* VEHICLES */}
        <div className="section-title">
          <h2>Vehicles <span className="muted num">({vehicles.length})</span></h2>
          <span className="muted" style={{ fontSize: 12.5 }}>Upload each document as a PDF; the team verifies it.</span>
        </div>
        {vehicles.length ? (
          <div className="vehicle-list">
            {vehicles.map((v, i) => (
              <VehicleCard key={v.vehicle_id} v={v} index={i} docs={d?.documents?.[v.vehicle_id] ?? {}} onUploaded={r.reload} />
            ))}
          </div>
        ) : !r.loading && (
          <div className="card"><Empty icon={Truck} title="No vehicles registered">Vehicles added at registration appear here with their documents.</Empty></div>
        )}
      </main>
    </AppShell>
  );
}

function Ring({ value, total, label, color, track = "rgba(255,255,255,.14)", dark }: { value: number; total: number; label: string; color: string; track?: string; dark?: boolean }) {
  const r = 34, c = 2 * Math.PI * r, frac = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <svg viewBox="0 0 84 84" className="ring" role="img" aria-label={`${value} of ${total} ${label}`}>
      <circle cx="42" cy="42" r={r} fill="none" stroke={track} strokeWidth="8" />
      {frac > 0 && <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap={frac < 1 ? "round" : "butt"} strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 42 42)" />}
      <text x="42" y="41" textAnchor="middle" fontSize="18" fontWeight="700" fill={dark ? "var(--ink-900)" : "#fff"} style={{ fontVariantNumeric: "tabular-nums" }}>{value}</text>
      <text x="42" y="55" textAnchor="middle" fontSize="9.5" fill={dark ? "var(--ink-500)" : "rgba(255,255,255,.75)"}>of {total} {label}</text>
    </svg>
  );
}

function CompRow({ tone, label, n, total }: { tone: string; label: string; n: number; total: number }) {
  return (
    <li data-tone={tone}>
      <span className="comp-dot" />
      <span>{label}</span>
      <b className="num">{n}</b>
      <span className="comp-bar"><span style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></span>
    </li>
  );
}

function VehicleCard({ v, index, docs, onUploaded }: { v: Vehicle; index: number; docs: Record<string, Doc>; onUploaded: () => void }) {
  const cap = Number(v.capacity_kl) || 0;
  const active = String(v.vehicle_status || "active").toLowerCase() === "active";
  const verified = DOC_TYPES.filter((t) => docState(docs[t.key]) === "verified").length;
  return (
    <article className="card vcard">
      <div className="vcard-side">
        <span className="vcard-n num">{String(index + 1).padStart(2, "0")}</span>
        <TankerArt capacity={cap} active={active} />
        <div className="vcard-id">
          <span className="plate num">{v.registration_number}</span>
          <span className={active ? "v-on" : "v-off"}>{active ? "In service" : String(v.vehicle_status || "Inactive")}</span>
        </div>
        <dl className="vcard-facts">
          <div><dt>Capacity</dt><dd className="num">{num(cap)} KL</dd></div>
          <div><dt>Model</dt><dd>{v.vehicle_model || "—"}</dd></div>
          <div><dt>Added</dt><dd>{v.created_at ? new Date(v.created_at.replace(" ", "T")).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</dd></div>
        </dl>
        <div className="vcard-comp">
          <span>Documents verified</span>
          <span className="num"><b>{verified}</b>/{DOC_TYPES.length}</span>
          <span className="comp-steps">
            {DOC_TYPES.map((t) => <i key={t.key} data-state={docState(docs[t.key])} title={`${t.short}: ${docState(docs[t.key])}`} />)}
          </span>
        </div>
      </div>
      <div className="doc-grid">
        {DOC_TYPES.map((t) => <DocTile key={t.key} vehicleId={v.vehicle_id} type={t} doc={docs[t.key]} onUploaded={onUploaded} />)}
      </div>
    </article>
  );
}

function DocTile({ vehicleId, type, doc, onUploaded }: { vehicleId: string; type: (typeof DOC_TYPES)[number]; doc?: Doc; onUploaded: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const state = docState(doc);
  const Icon = { verified: CircleCheck, pending: Clock, rejected: CircleAlert, missing: FileText }[state];

  async function upload(file: File) {
    if (file.type && file.type !== "application/pdf") return toast("Please choose a PDF file.", "danger");
    setBusy(true);
    try {
      await postForm(`/tanker/vehicle/${encodeURIComponent(vehicleId)}/document/${type.key}/upload`, { document: file });
      toast(`${type.label} uploaded. It's now waiting for verification.`, "success");
      onUploaded();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "danger");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="doc-tile" data-state={state}>
      <div className="doc-head">
        <span className="doc-icon"><Icon size={16} /></span>
        <div style={{ minWidth: 0 }}>
          <strong>{type.label}</strong>
          <span className="doc-file">{doc ? doc.original_filename : "No PDF uploaded"}</span>
        </div>
      </div>
      <div className="doc-meta">
        <span className="doc-state">{{ verified: "Verified", pending: "Under review", rejected: "Rejected", missing: "Missing" }[state]}</span>
        {doc && <span className="muted">{when(doc.verified_at || doc.uploaded_at)}</span>}
      </div>
      {doc?.admin_remark && <p className="doc-remark">“{doc.admin_remark}”</p>}
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      <button type="button" className={`btn btn-sm ${state === "missing" || state === "rejected" ? "btn-primary" : "btn-secondary"}`} onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Spinner /> : state === "missing" ? <Upload /> : <FileUp />} {state === "missing" ? "Upload PDF" : "Replace"}
      </button>
    </div>
  );
}
