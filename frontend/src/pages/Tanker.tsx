import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Marker, Polyline, Popup } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import {
  ArrowLeftRight, Check, CircleStop, Clock, Inbox, MapPinned, Navigation, PackageCheck, Phone, Play, RefreshCw, Timer, Truck, X,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { roleNav } from "../components/nav";
import { UserMenu } from "../components/UserMenu";
import { ChatWidget } from "../components/ChatWidget";
import { FitBounds, MapFrame, liveDot, pinIcon } from "../components/map";
import { FleetPanel, type Vehicle } from "../components/Fleet";
import { Badge, Empty, Notice, Segmented, SkeletonRows, Spinner, Stat, StatusBadge } from "../components/ui";
import { getJSON, postForm, postJSON } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useToast } from "../lib/toast";
import { num, when } from "../lib/format";
import { applyFilter, filterOptions, type OrderFilter } from "../lib/orders";
import { toPoint } from "../lib/route";
import "./tanker.css";

interface Order {
  order_id: string; transfer_id?: string; request_type?: "demand" | "stp_transfer"; status: string;
  stp_name?: string; source_stp_name?: string; location?: string; quantity_kld?: string; quality?: string;
  buyer_name?: string; buyer_phone?: string; distance_km?: string; delivered_at?: string;
  offered_operator_id?: string; assigned_operator_id?: string; offer_expires_at?: string; tankers_required?: string;
  stp_lat?: number | string | null; stp_lon?: number | string | null; delivery_lat?: number | string | null; delivery_lon?: number | string | null;
}
interface Overview {
  operator: { operator_name?: string; area?: string; operator_type?: string; verification_status?: string };
  operator_id: string; operational_tankers: number; active_tankers: number; available_tankers: number;
  operator_latitude: number; operator_longitude: number; orders: Order[]; completed: Order[]; vehicles: Vehicle[];
}
type Stage = "offer" | "pickup" | "deliver" | "done";
interface Job { o: Order; stage: Stage; status: string }

const POLL_MS = 20000;
const SEND_MS = 5000;
const isTransfer = (o: Order) => o.request_type === "stp_transfer";

function stageOf(o: Order, me: string): Stage {
  if (o.status === "Delivered") return "done";
  if (o.status === "Out for Delivery") return "deliver";
  if (!isTransfer(o) && o.assigned_operator_id && o.assigned_operator_id === me) return "pickup";
  return "offer";
}
const STAGE_STATUS: Record<Stage, string> = { offer: "Pending", pickup: "Assigned", deliver: "Out for Delivery", done: "Delivered" };

export default function Tanker() {
  const toast = useToast();
  const ov = useAsync((s) => getJSON<Overview>("/api/tanker/overview", s));
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [route, setRoute] = useState<{ toPickup: LatLngTuple[]; toDrop: LatLngTuple[]; km: number } | null>(null);
  const seenOffers = useRef<Set<string> | null>(null);
  const mapRef = useRef<HTMLElement>(null);

  const me = ov.data?.operator_id ?? "";
  const jobs: Job[] = useMemo(() => {
    const live = (ov.data?.orders ?? []).map((o) => ({ o, stage: stageOf(o, me) }));
    const done = (ov.data?.completed ?? []).map((o) => ({ o, stage: "done" as Stage }));
    return [...live, ...done].map((j) => ({ ...j, status: STAGE_STATUS[j.stage] }));
  }, [ov.data, me]);
  const offers = jobs.filter((j) => j.stage === "offer");
  const active = jobs.filter((j) => j.stage === "pickup" || j.stage === "deliver");
  const list = applyFilter(jobs, filter, (j) => j.status);

  const { reload } = ov;
  useEffect(() => {
    const t = window.setInterval(() => document.visibilityState === "visible" && reload(), POLL_MS);
    return () => window.clearInterval(t);
  }, [reload]);
  useEffect(() => {
    if (!ov.data) return;
    const ids = new Set(offers.map((x) => x.o.order_id));
    if (seenOffers.current) {
      const fresh = [...ids].filter((id) => !seenOffers.current!.has(id));
      if (fresh.length) toast(fresh.length === 1 ? `New pickup offer: ${fresh[0]}` : `${fresh.length} new pickup offers`, "info");
    }
    seenOffers.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ov.data]);

  async function act(o: Order, kind: "accept" | "reject" | "pickup" | "deliver") {
    const id = isTransfer(o) ? o.transfer_id || o.order_id : o.order_id;
    setBusy(`${o.order_id}:${kind}`);
    try {
      if (isTransfer(o)) {
        const url = { accept: "/accept_transfer_pickup", reject: "/reject_transfer_pickup", deliver: "/complete_transfer", pickup: "" }[kind];
        await postForm(url, { transfer_id: id });
      } else if (kind === "accept") await postForm("/accept_pickup", { order_id: id });
      else if (kind === "reject") await postForm("/reject_pickup", { order_id: id });
      else await postForm(`/tanker/order/${encodeURIComponent(id)}/${kind === "pickup" ? "pickup" : "delivered"}`, {});
      toast({ accept: "Pickup accepted.", reject: "Offer declined.", pickup: "Marked as picked up — now out for delivery.", deliver: "Delivery confirmed." }[kind], "success");
      if (kind === "reject" || kind === "deliver") setSelected(null);
      ov.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed", "danger");
    } finally {
      setBusy(null);
    }
  }

  /* ---------- Two-stage journey: base → plant → drop-off ---------- */
  const selJob = jobs.find((j) => j.o.order_id === selected) ?? null;
  const sel = selJob?.o ?? null;
  useEffect(() => {
    setRoute(null);
    if (!sel || !ov.data) return;
    const base = toPoint(ov.data.operator_latitude, ov.data.operator_longitude);
    const pick = toPoint(sel.stp_lat, sel.stp_lon);
    const drop = toPoint(sel.delivery_lat, sel.delivery_lon);
    if (!pick || !drop) return;
    const ctrl = new AbortController();
    const leg = (a: LatLngTuple, b: LatLngTuple) =>
      fetch(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => ({ coords: (d.routes?.[0]?.geometry?.coordinates ?? []).map(([x, y]: [number, number]) => [y, x] as LatLngTuple), km: (d.routes?.[0]?.distance ?? 0) / 1000 }))
        .catch(() => ({ coords: [a, b] as LatLngTuple[], km: 0 }));
    const showFirst = sel.status !== "Out for Delivery" && !!base;
    Promise.all([showFirst ? leg(base!, pick) : Promise.resolve({ coords: [] as LatLngTuple[], km: 0 }), leg(pick, drop)])
      .then(([a, b]) => !ctrl.signal.aborted && setRoute({ toPickup: a.coords, toDrop: b.coords, km: a.km + b.km }));
    return () => ctrl.abort();
  }, [sel?.order_id, sel?.status, ov.data?.operator_latitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const trip = useLiveTrip();
  const base = ov.data ? toPoint(ov.data.operator_latitude, ov.data.operator_longitude) : null;
  const liveOrders = ov.data?.orders ?? [];
  const fitPts = useMemo(() => {
    if (route) return [...route.toPickup, ...route.toDrop];
    const pts: LatLngTuple[] = [];
    if (base) pts.push(base);
    liveOrders.forEach((o) => {
      const p = toPoint(o.stp_lat, o.stp_lon), d = toPoint(o.delivery_lat, o.delivery_lon);
      if (p) pts.push(p);
      if (d) pts.push(d);
    });
    return pts.length ? pts : null;
  }, [route, liveOrders, base?.[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  function view(id: string) {
    setSelected(id);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const op = ov.data?.operator;
  return (
    <AppShell
      nav={roleNav.tanker!}
      title={op?.operator_name ?? "Tanker dashboard"}
      subtitle={op ? `${op.area || "Bengaluru"} · ${op.operator_type === "contracted" ? "Contracted partner" : "Independent operator"}` : "Pickups, deliveries and live trip"}
      actions={
        <>
          <button type="button" className="btn btn-ghost btn-icon" onClick={ov.reload} aria-label="Refresh" title="Refresh">
            {ov.loading ? <Spinner /> : <RefreshCw />}
          </button>
          <UserMenu />
        </>
      }
    >
      <main className="page tanker">
        {ov.error && <Notice tone="danger">{ov.error}</Notice>}

        {/* MAP — the centrepiece */}
        <section className="card hero-map-card" ref={mapRef} aria-label="Jobs map">
          <MapFrame className="hero-map" scrollZoom>
            <FitBounds padRight={selJob && window.innerWidth > 760 ? 352 : 0} bounds={fitPts} fitKey={`${selected}|${route ? 1 : 0}|${liveOrders.length}|${base?.[0] ?? ""}`} />
            {base && <Marker position={base} icon={pinIcon("truck", "ink")}><Popup><strong>Your base</strong></Popup></Marker>}
            {trip.pos && <Marker position={trip.pos} icon={liveDot} zIndexOffset={900}><Popup>Your live position</Popup></Marker>}
            {route && <Polyline positions={route.toPickup} pathOptions={{ color: "#5f6e82", weight: 5, dashArray: "6 8" }} />}
            {route && <Polyline positions={route.toDrop} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9 }} />}
            {route && <Polyline positions={route.toDrop} pathOptions={{ color: "#1463d6", weight: 5 }} />}
            {liveOrders.map((o) => {
              const dim = selected && selected !== o.order_id ? 0.35 : 1;
              const p = toPoint(o.stp_lat, o.stp_lon), d = toPoint(o.delivery_lat, o.delivery_lon);
              return (
                <span key={o.order_id}>
                  {p && (
                    <Marker position={p} icon={pinIcon("plant", "success")} opacity={dim} eventHandlers={{ click: () => setSelected(o.order_id) }}>
                      <Popup><strong>Pickup</strong><br />{o.stp_name || o.source_stp_name}</Popup>
                    </Marker>
                  )}
                  {d && (
                    <Marker position={d} icon={pinIcon("drop", "brand")} opacity={dim} eventHandlers={{ click: () => setSelected(o.order_id) }}>
                      <Popup><strong>Drop-off</strong><br />{o.location}</Popup>
                    </Marker>
                  )}
                </span>
              );
            })}
          </MapFrame>

          <div className="map-chip trip-chip" data-on={trip.on}>
            <span className={trip.on ? "live-dot" : "idle-dot"} />
            <span className="trip-chip-text">{trip.on ? "Sharing live location" : "Live trip off"}</span>
            {trip.on ? (
              <button className="btn btn-sm btn-danger" onClick={trip.stop}><CircleStop /> Stop</button>
            ) : (
              <button className="btn btn-sm btn-primary" onClick={trip.start} disabled={trip.starting}>{trip.starting ? <Spinner /> : <Play />} Start trip</button>
            )}
          </div>

          <div className="map-overlay">
            <span><span className="legend-dot" style={{ background: "var(--ink-800)" }} />Base</span>
            <span><span className="legend-dot" style={{ background: "var(--success)" }} />Pickup</span>
            <span><span className="legend-dot" style={{ background: "var(--brand)" }} />Drop-off</span>
          </div>

          {selJob && (
            <aside className="map-panel" aria-live="polite">
              <header className="row-between">
                <div className="row wrap" style={{ gap: 8 }}>
                  <strong className="num">{selJob.o.order_id}</strong>
                  {selJob.stage === "offer" ? <Badge tone="warning">New offer</Badge> : <StatusBadge status={selJob.status} />}
                </div>
                <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelected(null)} aria-label="Close details"><X size={15} /></button>
              </header>
              <div className="job-legs">
                <span><i className="leg-dot pick" /><em>{selJob.o.stp_name || selJob.o.source_stp_name || "Pickup plant"}</em></span>
                <span><i className="leg-dot drop" /><em>{selJob.o.location || "Drop-off"}</em></span>
              </div>
              <dl className="panel-figs">
                <div><dt><Navigation size={13} /> Trip</dt><dd className="num">{route?.km ? `${num(route.km, 1)} km` : selJob.o.distance_km ? `${num(selJob.o.distance_km, 1)} km` : "—"}</dd></div>
                <div><dt><Timer size={13} /> Drive</dt><dd className="num">{route?.km ? `${Math.round((route.km / 28) * 60)} min` : "—"}</dd></div>
                <div><dt><Truck size={13} /> Load</dt><dd className="num">{num(selJob.o.quantity_kld)} KLD</dd></div>
              </dl>
              {selJob.o.buyer_name && (
                <div className="req-buyer">
                  {selJob.o.buyer_name}
                  {selJob.o.buyer_phone && <a href={`tel:${selJob.o.buyer_phone}`}><Phone size={13} /> {selJob.o.buyer_phone}</a>}
                </div>
              )}
              {selJob.stage === "done" && <p className="muted" style={{ fontSize: 12.5 }}>Delivered {when(selJob.o.delivered_at)}</p>}
              <JobActions job={selJob} busy={busy} act={act} />
            </aside>
          )}
        </section>

        <section className="grid grid-4 mt-16">
          <Stat icon={Inbox} label="Offers waiting" value={ov.data ? offers.length : "—"} hint="Respond before they expire" />
          <Stat icon={Truck} label="Active jobs" value={ov.data ? active.length : "—"} hint={`${active.filter((x) => x.stage === "deliver").length} out for delivery`} />
          <Stat icon={PackageCheck} label="Completed" value={ov.data ? (ov.data.completed?.length ?? 0) : "—"} hint="Deliveries confirmed" />
          <Stat icon={Navigation} label="Live trip" value={trip.on ? "On" : "Off"} hint={trip.message} />
        </section>

        <div className="tanker-grid mt-16">
          <section className="card">
            <header className="card-head wrap">
              <div><h2>Jobs</h2><p>Offers, deliveries and completed trips</p></div>
              <Segmented<OrderFilter> label="Filter jobs" value={filter} onChange={setFilter} options={filterOptions(jobs, (j) => j.status)} />
            </header>
            {ov.loading && !ov.data ? <SkeletonRows rows={3} /> : list.length ? (
              <ul className="list">
                {list.map((j) => (
                  <li key={`${j.stage}-${j.o.order_id}`} className="list-row job" data-selected={selected === j.o.order_id}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <strong className="num">{j.o.order_id}</strong>
                      {isTransfer(j.o) && <Badge><ArrowLeftRight size={11} /> Plant transfer</Badge>}
                      {j.stage === "offer" ? <Badge tone="warning">New offer</Badge> : <StatusBadge status={j.status} />}
                      {j.stage === "offer" && j.o.offer_expires_at && <Countdown until={j.o.offer_expires_at} />}
                    </div>
                    <div className="job-legs">
                      <span><i className="leg-dot pick" /><em>{j.o.stp_name || j.o.source_stp_name || "Pickup plant"}</em></span>
                      <span><i className="leg-dot drop" /><em>{j.o.location || "Drop-off"}</em></span>
                    </div>
                    <div className="req-facts">
                      <span className="num"><b>{num(j.o.quantity_kld)}</b> KLD</span>
                      {j.o.quality && <span>{j.o.quality}</span>}
                      {j.o.distance_km && <span className="num">{num(j.o.distance_km, 1)} km haul</span>}
                      {j.stage === "done" && <span>Delivered {when(j.o.delivered_at)}</span>}
                    </div>
                    <div className="job-actions">
                      {j.stage !== "done" && (
                        <button className="btn btn-sm btn-ghost" onClick={() => view(j.o.order_id)}><MapPinned /> View on map</button>
                      )}
                      <JobActions job={j} busy={busy} act={act} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={Inbox} title={filter === "completed" ? "No completed trips yet" : filter === "active" ? "No active jobs" : "No offers right now"}>
                New pickup offers near you appear here automatically. This page refreshes every 20 seconds.
              </Empty>
            )}
          </section>

          <FleetPanel vehicles={ov.data?.vehicles ?? []} free={ov.data?.available_tankers ?? 0} total={ov.data?.operational_tankers ?? 0} onJob={ov.data?.active_tankers ?? 0} />
        </div>
      </main>
      <ChatWidget role="tanker" />
    </AppShell>
  );
}

function JobActions({ job, busy, act }: { job: Job; busy: string | null; act: (o: Order, k: "accept" | "reject" | "pickup" | "deliver") => void }) {
  const o = job.o;
  if (job.stage === "offer") {
    return (
      <>
        <button className="btn btn-sm btn-secondary" disabled={!!busy} onClick={() => act(o, "reject")}>{busy === `${o.order_id}:reject` ? <Spinner /> : <X />} Decline</button>
        <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => act(o, "accept")}>{busy === `${o.order_id}:accept` ? <Spinner /> : <Check />} Accept</button>
      </>
    );
  }
  if (job.stage === "pickup") {
    return <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => act(o, "pickup")}>{busy === `${o.order_id}:pickup` ? <Spinner /> : <Truck />} Mark picked up</button>;
  }
  if (job.stage === "deliver") {
    return <button className="btn btn-sm btn-success" disabled={!!busy} onClick={() => act(o, "deliver")}>{busy === `${o.order_id}:deliver` ? <Spinner /> : <PackageCheck />} Confirm delivery</button>;
  }
  return null;
}

function Countdown({ until }: { until: string }) {
  const end = new Date(String(until).replace(" ", "T")).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!Number.isFinite(end)) return null;
  const left = Math.max(0, Math.round((end - now) / 1000));
  return (
    <span className={`countdown num${left < 60 ? " urgent" : ""}`} title={`Offer expires ${when(until)}`}>
      <Clock size={12} /> {left ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Expired"}
    </span>
  );
}

/** Share GPS while a trip is active: watchPosition + POST every 5 s. */
function useLiveTrip() {
  const [on, setOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pos, setPos] = useState<LatLngTuple | null>(null);
  const [message, setMessage] = useState("Start a trip to share your location with buyers.");
  const watch = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef<GeolocationPosition | null>(null);

  useEffect(() => {
    getJSON<{ location: { latitude?: number; longitude?: number; recorded_at?: string } | null }>("/api/tanker/location/latest")
      .then(({ location: l }) => {
        if (l?.latitude && l.longitude) {
          setPos([Number(l.latitude), Number(l.longitude)]);
          if (l.recorded_at) setMessage(`Last shared ${when(l.recorded_at)}`);
        }
      })
      .catch(() => {});
  }, []);

  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    if (timer.current !== null) window.clearInterval(timer.current);
    watch.current = timer.current = null;
    setOn(false);
    setStarting(false);
    setMessage("Trip ended. Location sharing is off.");
  }, []);

  const send = useCallback(async () => {
    const p = latest.current;
    if (!p) return;
    try {
      await postJSON("/api/tanker/location", {
        latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, speed: p.coords.speed, heading: p.coords.heading,
      });
      setMessage(`Updated ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`);
    } catch {
      setMessage("Couldn't send location — retrying.");
    }
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) return setMessage("Location isn't available in this browser.");
    setStarting(true);
    setMessage("Waiting for GPS…");
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        latest.current = p;
        setPos([p.coords.latitude, p.coords.longitude]);
        if (timer.current === null) {
          setOn(true);
          setStarting(false);
          void send();
          timer.current = window.setInterval(() => void send(), SEND_MS);
        }
      },
      (err) => {
        stop();
        setMessage(err.code === err.PERMISSION_DENIED ? "Location permission denied." : "Couldn't get a GPS fix.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }, [send, stop]);

  useEffect(() => stop, [stop]);
  return { on, starting, pos, message, start, stop };
}
