import { Marker } from "react-leaflet";
import {
  AtSign, Building2, CircleCheck, ClipboardList, Droplets, Factory, Gauge, IdCard, LogOut, Mail, MapPin, Phone,
  Radar, ShieldCheck, Truck,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { publicNav, roleNav } from "../components/nav";
import { Avatar, ROLE_META, UserMenu } from "../components/UserMenu";
import { InvalidateOnResize, MapFrame, pinIcon } from "../components/map";
import { Empty, Notice, SkeletonRows, StatusBadge } from "../components/ui";
import { getJSON } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { initials, num, when } from "../lib/format";
import type { Stp } from "../lib/types";
import "./profile.css";

interface ProfileData {
  user_id: string; first_name: string; last_name: string; name: string; username: string; email: string;
  mobile: string; role: string; plant: Stp | null;
  operator: Record<string, string | number | null> | null;
}
interface MyOrder { order_id: string; status: string; stp_name: string; quantity_kld: string; created_at: string }

export default function Profile() {
  const p = useAsync((s) => getJSON<ProfileData>("/api/profile", s));
  const role = p.data?.role ?? "";
  const meta = ROLE_META[role];
  const nav = roleNav[role] ?? publicNav;

  return (
    <AppShell nav={nav} title="Profile" subtitle="Your account and organisation details" actions={<UserMenu />}>
      <main className="page page-narrow profile">
        {p.error && <Notice tone="danger">{p.error}</Notice>}

        <section className="card profile-hero" data-tone={meta?.tone ?? "blue"}>
          <div className="profile-hero-band" aria-hidden="true" />
          <div className="profile-hero-body">
            {p.data ? (
              <Avatar initials={initials(p.data.name)} role={role} size={76} />
            ) : (
              <div className="skeleton" style={{ width: 76, height: 76, borderRadius: "50%" }} />
            )}
            <div className="profile-id">
              <h2>{p.data?.name ?? " "}</h2>
              <div className="row wrap" style={{ gap: 8 }}>
                {meta && <span className="role-chip" data-tone={meta.tone}>{meta.label}</span>}
                <span className="badge" data-tone="success">Active</span>
              </div>
            </div>
            <div className="profile-actions">
              {meta && <a className="btn btn-secondary" href={meta.home}>Open dashboard</a>}
              <a className="btn btn-danger" href="/logout"><LogOut /> Sign out</a>
            </div>
          </div>
          <dl className="profile-facts">
            <Fact icon={Mail} label="Email" value={p.data?.email} />
            <Fact icon={Phone} label="Mobile" value={p.data?.mobile} />
            <Fact icon={AtSign} label="Username" value={p.data?.username} />
            <Fact icon={IdCard} label="Account ID" value={p.data?.user_id ? p.data.user_id.slice(0, 8).toUpperCase() : undefined} mono />
          </dl>
        </section>

        {p.loading && !p.data ? (
          <div className="card"><SkeletonRows rows={3} /></div>
        ) : role === "demand" ? (
          <DemandSummary />
        ) : role === "stp" ? (
          <PlantCard plant={p.data?.plant ?? null} />
        ) : role === "tanker" ? (
          <OperatorCard op={p.data?.operator ?? null} />
        ) : null}

        <p className="profile-note">
          <ShieldCheck size={14} /> To change your name, email or phone number, contact the network administrator so
          linked orders and registrations stay consistent.
        </p>
      </main>
    </AppShell>
  );
}

function Fact({ icon: Icon, label, value, mono }: { icon: typeof Mail; label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt><Icon size={14} /> {label}</dt>
      <dd className={mono ? "num" : undefined}>{value || <span className="muted">Not provided</span>}</dd>
    </div>
  );
}

function DemandSummary() {
  const o = useAsync((s) => getJSON<MyOrder[]>("/api/my_orders", s));
  const list = o.data ?? [];
  const active = list.filter((x) => ["Pending", "Accepted", "Out for Delivery"].includes(x.status)).length;
  const done = list.filter((x) => x.status === "Delivered");
  const kld = done.reduce((a, x) => a + (Number(x.quantity_kld) || 0), 0);
  return (
    <section className="card">
      <header className="card-head">
        <div><h2>Your water orders</h2><p>Lifetime activity for this account</p></div>
        <a className="btn btn-sm btn-ghost" href="/track">All orders</a>
      </header>
      <div className="mini-stats">
        <Mini icon={ClipboardList} tone="blue" label="Orders placed" value={num(list.length)} />
        <Mini icon={Truck} tone="amber" label="In progress" value={num(active)} />
        <Mini icon={CircleCheck} tone="teal" label="Delivered" value={num(done.length)} />
        <Mini icon={Droplets} tone="sky" label="Water received" value={num(kld)} unit="KLD" />
      </div>
      {list.length ? (
        <ul className="list">
          {list.slice(0, 5).map((x) => (
            <li key={x.order_id} className="list-row row-between">
              <span>
                <strong className="num" style={{ fontSize: 13.5 }}>{x.order_id}</strong>
                <span className="muted" style={{ display: "block", fontSize: 12.5 }}>{num(x.quantity_kld)} KLD · {x.stp_name} · {when(x.created_at)}</span>
              </span>
              <StatusBadge status={x.status} />
            </li>
          ))}
        </ul>
      ) : !o.loading && <Empty icon={ClipboardList} title="No orders yet">Orders you place appear here.</Empty>}
    </section>
  );
}

function PlantCard({ plant }: { plant: Stp | null }) {
  if (!plant) return <div className="card"><Empty icon={Factory} title="No plant linked">This account isn't linked to a treatment plant yet.</Empty></div>;
  const total = (Number(plant.total_capacity_mld) || 0) * 1000;
  const avail = (Number(plant.available_capacity_mld) || 0) * 1000;
  return (
    <section className="card org-card">
      <div className="org-body">
        <header className="card-head" style={{ borderBottom: 0, padding: "18px 20px 6px" }}>
          <div><h2>{plant.stp_name}</h2><p className="num">{plant.stp_id}</p></div>
          <span className="role-chip" data-tone="teal">{plant.quality_grade || "General"} grade</span>
        </header>
        <div className="mini-stats">
          <Mini icon={Gauge} tone="teal" label="Capacity" value={num(total)} unit="KLD" />
          <Mini icon={Droplets} tone="sky" label="Available" value={num(avail)} unit="KLD" />
          <Mini icon={Factory} tone="violet" label="Technology" value={plant.technology && plant.technology !== "Not Specified" ? plant.technology : "—"} small />
          <Mini icon={Building2} tone="amber" label="Treatment cost" value={plant.treatment_cost_per_kl != null ? `₹${num(plant.treatment_cost_per_kl, 1)}` : "—"} unit="/ KL" />
        </div>
      </div>
      {plant.latitude && plant.longitude && (
        <MapFrame center={[plant.latitude, plant.longitude]} zoom={14} className="org-map">
          <InvalidateOnResize />
          <Marker position={[plant.latitude, plant.longitude]} icon={pinIcon("plant", "brand")} />
        </MapFrame>
      )}
    </section>
  );
}

function OperatorCard({ op }: { op: Record<string, string | number | null> | null }) {
  if (!op) return <div className="card"><Empty icon={Truck} title="No operator record">This account isn't linked to a tanker registration.</Empty></div>;
  const lat = Number(op.latitude), lon = Number(op.longitude);
  return (
    <section className="card org-card">
      <div className="org-body">
        <header className="card-head" style={{ borderBottom: 0, padding: "18px 20px 6px" }}>
          <div><h2>{op.operator_name}</h2><p className="num">{op.operator_id} · {op.operator_type === "contracted" ? "Contracted partner" : "Independent operator"}</p></div>
          <StatusBadge status={String(op.verification_status || "pending")} />
        </header>
        <div className="mini-stats">
          <Mini icon={Truck} tone="violet" label="Fleet size" value={num(op.operational_tankers)} unit="tankers" />
          <Mini icon={Radar} tone="sky" label="Service radius" value={op.service_radius_km ? num(op.service_radius_km) : "—"} unit="km" />
          <Mini icon={Droplets} tone="teal" label="Water type" value={String(op.water_type_supported || "—")} small />
          <Mini icon={MapPin} tone="amber" label="Base area" value={`${op.area || "—"}${op.pincode ? ` · ${op.pincode}` : ""}`} small />
        </div>
      </div>
      {Number.isFinite(lat) && lat !== 0 && (
        <MapFrame center={[lat, lon]} zoom={13} className="org-map">
          <InvalidateOnResize />
          <Marker position={[lat, lon]} icon={pinIcon("truck", "ink")} />
        </MapFrame>
      )}
    </section>
  );
}

function Mini({ icon: Icon, tone, label, value, unit, small }: {
  icon: typeof Mail; tone: string; label: string; value: string; unit?: string; small?: boolean;
}) {
  return (
    <div className="mini">
      <span className="mini-icon" data-tone={tone}><Icon size={16} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        <div className={small ? "mini-value small" : "mini-value num"}>{value}{unit && <small>{unit}</small>}</div>
      </div>
    </div>
  );
}
