import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Marker, Polyline, Popup } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import { ArrowLeftRight, Check, Droplets, MapPinned, Navigation, RefreshCw, Route, Search, Truck, X } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { roleNav } from "../components/nav";
import { UserMenu } from "../components/UserMenu";
import { FitBounds, MapFrame, pinIcon } from "../components/map";
import { Badge, Empty, Notice, Segmented, SkeletonRows, Spinner, Stat, StatusBadge } from "../components/ui";
import { getJSON } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { num, when } from "../lib/format";
import { applyFilter, bucketOf, filterOptions, type OrderFilter } from "../lib/orders";
import { toPoint } from "../lib/route";
import "./trip-history.css";

interface Trip {
  trip_id: string; request_type: "demand" | "stp_transfer"; trip_type: string; trip_status: string;
  pickup_name: string; destination_name: string; quantity_kld?: string; quality?: string; water_type?: string;
  tankers_required?: string; trip_distance_km?: string; trip_created_at?: string; assigned_at?: string;
  pickup_at?: string; delivered_at?: string;
  pickup_lat?: number | null; pickup_lon?: number | null; drop_lat?: number | null; drop_lon?: number | null;
}
interface TripsResponse { operator_id: string; operator_name: string; trips: Trip[] }

const DAYS = 30;
const isTransfer = (t: Trip) => t.request_type === "stp_transfer";
const parse = (v?: string) => (v ? new Date(String(v).replace(" ", "T")) : null);
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function TripHistory() {
  const r = useAsync((s) => getJSON<TripsResponse>("/api/tanker/trips", s));
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const mapRef = useRef<HTMLElement>(null);

  const trips = r.data?.trips ?? [];
  const delivered = trips.filter((t) => t.trip_status === "Delivered");
  const totalKld = delivered.reduce((a, t) => a + (Number(t.quantity_kld) || 0), 0);
  const totalKm = trips.reduce((a, t) => a + (Number(t.trip_distance_km) || 0), 0);
  const activeCount = trips.filter((t) => bucketOf(t.trip_status) === "active").length;

  const q = query.trim().toLowerCase();
  const visible = applyFilter(trips, filter, (t) => t.trip_status).filter(
    (t) => !q || [t.trip_id, t.pickup_name, t.destination_name].some((f) => String(f ?? "").toLowerCase().includes(q)),
  );

  const legs = trips
    .map((t) => ({ t, a: toPoint(t.pickup_lat, t.pickup_lon), b: toPoint(t.drop_lat, t.drop_lon) }))
    .filter((x) => x.a && x.b);
  const sel = legs.find((x) => x.t.trip_id === selected) ?? null;
  const fit = useMemo<LatLngTuple[] | null>(() => {
    if (sel) return [sel.a!, sel.b!];
    const pts = legs.flatMap((x) => [x.a!, x.b!]);
    return pts.length ? pts : null;
  }, [selected, legs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function view(id: string) {
    setSelected(id);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <AppShell
      nav={roleNav.tanker!}
      title="Trip history"
      subtitle={r.data ? `${r.data.operator_name || "Your operation"} · ${r.data.operator_id}` : "Every trip assigned to your tankers"}
      actions={
        <>
          <button type="button" className="btn btn-ghost btn-icon" onClick={r.reload} aria-label="Refresh" title="Refresh">
            {r.loading ? <Spinner /> : <RefreshCw />}
          </button>
          <UserMenu />
        </>
      }
    >
      <main className="page trips">
        {r.error && <Notice tone="danger">{r.error}</Notice>}

        <section className="grid grid-4">
          <Stat icon={Route} label="Trips" value={r.data ? trips.length : "—"} hint={`${delivered.length} delivered`} />
          <Stat icon={Droplets} label="Water delivered" value={r.data ? num(totalKld) : "—"} unit="KLD" hint="Across completed trips" />
          <Stat icon={Navigation} label="Distance hauled" value={r.data ? num(totalKm, 1) : "—"} unit="km" hint="Plant to drop-off" />
          <Stat icon={Truck} label="In progress" value={r.data ? activeCount : "—"} hint="Accepted or out for delivery" />
        </section>

        <div className="trips-top mt-16">
          <section className="card card-pad">
            <header className="trips-card-head">
              <div><h2>Water delivered</h2><p>KLD per day, last {DAYS} days</p></div>
            </header>
            {r.loading && !r.data ? <SkeletonRows rows={3} /> : <DeliveryBars trips={delivered} />}
          </section>

          <section className="card hero-map-card trips-map-card" ref={mapRef} aria-label="Trip routes">
            <MapFrame className="trips-map" scrollZoom>
              <FitBounds bounds={fit} fitKey={`${selected ?? ""}|${legs.length}`} />
              {legs.map(({ t, a, b }) => {
                const on = !selected || selected === t.trip_id;
                return (
                  <Polyline key={t.trip_id} positions={[a!, b!]} eventHandlers={{ click: () => setSelected(t.trip_id) }}
                    pathOptions={{ color: on ? "#1463d6" : "#8a97a8", weight: selected === t.trip_id ? 5 : 3, opacity: on ? 0.85 : 0.35, dashArray: isTransfer(t) ? "6 6" : undefined }} />
                );
              })}
              {legs.map(({ t, a, b }) => (!selected || selected === t.trip_id) && (
                <span key={t.trip_id}>
                  <Marker position={a!} icon={pinIcon("plant", "success")}><Popup><strong>Pickup</strong><br />{t.pickup_name}</Popup></Marker>
                  <Marker position={b!} icon={pinIcon(isTransfer(t) ? "plant" : "drop", "brand")}><Popup><strong>Drop-off</strong><br />{t.destination_name}</Popup></Marker>
                </span>
              ))}
            </MapFrame>
            <div className="map-overlay">
              <span><span className="legend-dot" style={{ background: "var(--success)" }} />Pickup</span>
              <span><span className="legend-dot" style={{ background: "var(--brand)" }} />Drop-off</span>
            </div>
            {sel && (
              <div className="map-chip trips-chip">
                <span className="num">{sel.t.trip_id}</span>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelected(null)} aria-label="Show all routes"><X size={14} /></button>
              </div>
            )}
          </section>
        </div>

        <section className="card mt-16">
          <header className="card-head wrap">
            <div><h2>Trips</h2><p>Newest first</p></div>
            <div className="row wrap" style={{ gap: 10 }}>
              <div className="input-group trips-search">
                <Search size={15} />
                <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search trip, pickup or drop-off" aria-label="Search trips" />
              </div>
              <Segmented<OrderFilter> label="Filter trips" value={filter} onChange={setFilter} options={filterOptions(trips, (t) => t.trip_status)} />
            </div>
          </header>
          {r.loading && !r.data ? <SkeletonRows rows={4} /> : visible.length ? (
            <ul className="list">
              {visible.map((t) => <TripRow key={t.trip_id} t={t} selected={selected === t.trip_id} onView={() => view(t.trip_id)} />)}
            </ul>
          ) : (
            <Empty icon={Route} title={trips.length ? "No trips match" : "No trips yet"}>
              {trips.length ? "Try another filter or search term." : "Trips you accept from the dashboard appear here, with their delivery record."}
            </Empty>
          )}
        </section>
      </main>
    </AppShell>
  );
}

function TripRow({ t, selected, onView }: { t: Trip; selected: boolean; onView: () => void }) {
  const steps = [
    { label: "Assigned", at: t.assigned_at || t.trip_created_at },
    { label: "Picked up", at: t.pickup_at },
    { label: "Delivered", at: t.delivered_at },
  ];
  const reached = t.trip_status === "Delivered" ? 3 : t.trip_status === "Out for Delivery" ? 2 : 1;
  const hasRoute = toPoint(t.pickup_lat, t.pickup_lon) && toPoint(t.drop_lat, t.drop_lon);
  return (
    <li className="list-row trip" data-selected={selected}>
      <div className="trip-head">
        <div className="row wrap" style={{ gap: 8 }}>
          <strong className="num">{t.trip_id}</strong>
          {isTransfer(t) && <Badge><ArrowLeftRight size={11} /> Plant transfer</Badge>}
          <StatusBadge status={t.trip_status} />
        </div>
        {hasRoute && <button className="btn btn-sm btn-ghost" onClick={onView}><MapPinned /> View route</button>}
      </div>

      <div className="journey">
        <div className="journey-end"><i className="leg-dot pick" /><span><small>Pickup</small>{t.pickup_name}</span></div>
        <div className="journey-line" data-done={reached >= 2} aria-hidden="true">
          <span className="journey-truck" data-stage={reached}><Truck size={14} /></span>
          {t.trip_distance_km && <em className="num">{num(t.trip_distance_km, 1)} km</em>}
        </div>
        <div className="journey-end"><i className="leg-dot drop" /><span><small>Drop-off</small>{t.destination_name}</span></div>
      </div>

      <div className="trip-foot">
        <div className="req-facts">
          <span className="num"><b>{num(t.quantity_kld)}</b> KLD</span>
          {t.quality && <span>{t.quality} grade</span>}
          {t.tankers_required && <span className="num">{t.tankers_required} tanker{t.tankers_required === "1" ? "" : "s"}</span>}
        </div>
        <ol className="trip-steps" aria-label="Trip progress">
          {steps.map((s, i) => (
            <li key={s.label} data-done={i < reached}>
              <span className="step-dot">{i < reached && <Check size={11} strokeWidth={3} />}</span>
              <span className="step-text"><b>{s.label}</b>{i < reached && s.at ? when(s.at) : i < reached ? "Done" : "—"}</span>
            </li>
          ))}
        </ol>
      </div>
    </li>
  );
}

/** Delivered KLD per day — one series, so no legend; hover a bar for the day's figures. */
function DeliveryBars({ trips }: { trips: Trip[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(520);
  const [hover, setHover] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    setW(Math.max(260, Math.round(el.clientWidth))); // measure before first paint
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const days = useMemo(() => {
    const out: { date: Date; kld: number; trips: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      out.push({ date: d, kld: 0, trips: 0 });
    }
    const idx = new Map(out.map((d, i) => [dayKey(d.date), i]));
    trips.forEach((t) => {
      const d = parse(t.delivered_at);
      const i = d ? idx.get(dayKey(d)) : undefined;
      if (i === undefined) return;
      out[i]!.kld += Number(t.quantity_kld) || 0;
      out[i]!.trips += 1;
    });
    return out;
  }, [trips]);

  const H = 190, pad = { t: 16, r: 8, b: 24, l: 34 };
  const max = Math.max(...days.map((d) => d.kld), 0);
  const top = max > 0 ? Math.ceil(max / 5) * 5 : 10;
  const ticks = [0, top / 2, top];
  const slot = (W - pad.l - pad.r) / DAYS;
  const bw = Math.max(3, slot - 2); // 2px surface gap between bars
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const total = days.reduce((a, d) => a + d.kld, 0);
  const active = hover !== null ? days[hover]! : null;
  const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="bars" ref={boxRef}>
      <div className="bars-readout">
        {active ? (
          <><strong className="num">{num(active.kld)} <small>KLD</small></strong><span>{fmtDay(active.date)} · {active.trips} trip{active.trips === 1 ? "" : "s"}</span></>
        ) : (
          <><strong className="num">{num(total)} <small>KLD</small></strong><span>delivered in the last {DAYS} days</span></>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" style={{ display: "block", touchAction: "pan-y" }}
        aria-label={`Water delivered per day over the last ${DAYS} days, ${num(total)} KLD in total.`}
        onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-400)" style={{ fontVariantNumeric: "tabular-nums" }}>{num(t)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = pad.l + i * slot + (slot - bw) / 2;
          const h = d.kld > 0 ? Math.max(4, y(0) - y(d.kld)) : 0;
          const r = Math.min(4, bw / 2);
          return (
            <g key={i} onPointerEnter={() => setHover(i)}>
              {/* hit target spans the full column, taller than the mark */}
              <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(0) - h + r} q0,-${r} ${r},-${r} h${bw - 2 * r} q${r},0 ${r},${r} V${y(0)} Z`}
                  fill="#1463d6" opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {hover === i && <rect x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} fill="var(--brand-tint)" pointerEvents="none" />}
            </g>
          );
        })}
        {[0, Math.floor(DAYS / 2), DAYS - 1].map((i) => (
          <text key={i} x={pad.l + i * slot + slot / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === DAYS - 1 ? "end" : "middle"} fontSize="11" fill="var(--ink-500)">
            {i === DAYS - 1 ? "Today" : fmtDay(days[i]!.date)}
          </text>
        ))}
      </svg>
    </div>
  );
}
