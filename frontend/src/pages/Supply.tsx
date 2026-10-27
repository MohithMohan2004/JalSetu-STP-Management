import { useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Marker, Polyline, Popup } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import {
  ArrowLeftRight, ArrowRight, CalendarClock, Check, ClipboardList, Droplets, Factory, FileUp, Gauge, Inbox,
  MapPinned, Navigation, Pencil, Phone, Plus, RefreshCw, Timer, TrendingUp, X,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { roleNav } from "../components/nav";
import { UserMenu } from "../components/UserMenu";
import { ChatWidget } from "../components/ChatWidget";
import { ForecastChart } from "../components/ForecastChart";
import { FitBounds, MapFrame, pinIcon, dotIcon } from "../components/map";
import { OcemsGrid } from "../components/OcemsGrid";
import { Dialog } from "../components/Dialog";
import { Empty, Notice, Segmented, SkeletonRows, Spinner, Stat, StatusBadge } from "../components/ui";
import { getJSON, postForm, postJSON } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useToast } from "../lib/toast";
import { num, when } from "../lib/format";
import { applyFilter, bucketOf, BUCKET_COLOR, filterOptions, type OrderFilter } from "../lib/orders";
import { toPoint, useRoute } from "../lib/route";
import type { OcemsReading, Stp } from "../lib/types";
import "./supply.css";

interface DemandRow {
  request_id: string; site_name: string; quantity: string; quality_required: string; buyer_name: string;
  buyer_phone: string; status: string; created_at: string; water_type?: string; distance_km?: string;
  payment_status?: string; assigned_operator_name?: string; delivery_lat?: string; delivery_lon?: string;
}
interface TransferRow {
  transfer_id: string; source_stp_name: string; destination_stp_id?: string; destination_stp_name: string; quantity_kld: string;
  quality: string; water_type: string; distance_km: string; status: string; requested_at: string; tanker_status?: string;
  assigned_operator_name?: string;
}
interface Pricing {
  base_price_per_kld: string | number; peak_incentive: string | number; off_peak_incentive: string | number;
  peak_start: string; peak_end: string; off_peak_start: string; off_peak_end: string;
  sustainability_credit: string | number; reliability_bonus: string | number;
}
interface Overview {
  bound_stp_id: string; stps: Stp[]; selected_stp: Stp | null; demands: DemandRow[]; prediction: number | null;
  weekly_forecast: number[]; pricing: Pricing | null; transfer_requests: TransferRow[];
}
type Focus = { kind: "order"; id: string } | { kind: "transfer"; id: string } | null;

const QUALITIES = ["Platinum", "Gold", "Silver", "General"];

export default function Supply() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const stpParam = params.get("stp_id") ?? "";
  const ov = useAsync((s) => getJSON<Overview>(`/api/supply/overview${stpParam ? `?stp_id=${encodeURIComponent(stpParam)}` : ""}`, s), [stpParam]);
  const stp = ov.data?.selected_stp ?? null;
  const ocems = useAsync(
    (s) => (stp ? getJSON<OcemsReading>(`/api/ocems_summary/${encodeURIComponent(stp.stp_id)}`, s) : Promise.resolve(null)),
    [stp?.stp_id],
  );

  const [filter, setFilter] = useState<OrderFilter>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const mapRef = useRef<HTMLElement>(null);

  const demands = useMemo(
    () => [...(ov.data?.demands ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    [ov.data],
  );
  const transfers = ov.data?.transfer_requests ?? [];
  const visible = applyFilter(demands, filter, (d) => d.status);
  const pendingCount = demands.filter((d) => d.status === "Pending").length + transfers.filter((t) => t.status === "Pending").length;
  const activeCount = demands.filter((d) => bucketOf(d.status) === "active").length;
  const deliveredCount = demands.filter((d) => d.status === "Delivered").length;

  const plantPt = stp ? toPoint(stp.latitude, stp.longitude) : null;
  const focusedOrder = focus?.kind === "order" ? demands.find((d) => d.request_id === focus.id) ?? null : null;
  const focusedTransfer = focus?.kind === "transfer" ? transfers.find((t) => t.transfer_id === focus.id) ?? null : null;
  const destStp = focusedTransfer ? ov.data?.stps.find((s) => s.stp_id === focusedTransfer.destination_stp_id || s.stp_name === focusedTransfer.destination_stp_name) : null;
  const focusPt = focusedOrder ? toPoint(focusedOrder.delivery_lat, focusedOrder.delivery_lon) : destStp ? toPoint(destStp.latitude, destStp.longitude) : null;
  const { route, loading: routing } = useRoute(plantPt, focusPt);

  function view(next: Focus) {
    setFocus(next);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function act(kind: "order" | "transfer", id: string, action: "accept" | "reject") {
    setBusy(`${id}:${action}`);
    try {
      if (kind === "order") await postForm("/handle_request", { request_id: id, action });
      else await postForm("/handle_transfer_request", { transfer_id: id, action });
      toast(`${kind === "order" ? "Order" : "Transfer"} ${id} ${action === "accept" ? "accepted" : "rejected"}.`, "success");
      ov.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action failed", "danger");
    } finally {
      setBusy(null);
    }
  }

  const availKld = (Number(stp?.available_capacity_mld) || 0) * 1000;
  const totalKld = (Number(stp?.total_capacity_mld) || 0) * 1000;
  const usedPct = totalKld > 0 ? Math.min(100, Math.max(0, ((totalKld - availKld) / totalKld) * 100)) : 0;

  const mapped = demands.map((d) => ({ d, pt: toPoint(d.delivery_lat, d.delivery_lon) })).filter((x) => x.pt);
  const fit = useMemo<LatLngTuple[] | null>(() => {
    if (route) return route.coords;
    const pts = [plantPt, ...mapped.filter((x) => bucketOf(x.d.status) !== "completed").map((x) => x.pt)].filter(Boolean) as LatLngTuple[];
    return pts.length ? pts : null;
  }, [route, plantPt?.[0], mapped.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const selector = !ov.data?.bound_stp_id && (ov.data?.stps?.length ?? 0) > 0 && (
    <select
      className="select plant-select"
      value={stp?.stp_id ?? ""}
      onChange={(e) => {
        const p = new URLSearchParams(params);
        if (e.target.value) p.set("stp_id", e.target.value); else p.delete("stp_id");
        setFocus(null);
        setParams(p);
      }}
      aria-label="Plant"
    >
      <option value="">Select a plant…</option>
      {ov.data!.stps.map((s) => <option key={s.stp_id} value={s.stp_id}>{s.stp_name}</option>)}
    </select>
  );

  return (
    <AppShell
      nav={roleNav.stp!}
      title={stp ? stp.stp_name : "Plant overview"}
      subtitle={stp ? `${stp.stp_id} · ${stp.quality_grade || "General"} grade${stp.technology && stp.technology !== "Not Specified" ? ` · ${stp.technology}` : ""}` : "Capacity, orders and quality for your plant"}
      actions={
        <>
          {selector}
          <button type="button" className="btn btn-ghost btn-icon" onClick={ov.reload} aria-label="Refresh" title="Refresh">
            {ov.loading ? <Spinner /> : <RefreshCw />}
          </button>
          <UserMenu />
        </>
      }
    >
      <main className="page supply">
        {ov.error && <Notice tone="danger">{ov.error}</Notice>}

        {!ov.loading && !stp ? (
          <div className="card">
            <Empty icon={Factory} title="Choose your plant">
              Select the treatment plant you operate from the menu at the top to see its orders and capacity.
            </Empty>
          </div>
        ) : (
          <>
            {/* MAP — the centrepiece */}
            <section className="card hero-map-card" ref={mapRef} aria-label="Delivery map">
              <MapFrame className="hero-map" center={plantPt ?? undefined} zoom={12} scrollZoom>
                <FitBounds padRight={focus && window.innerWidth > 760 ? 352 : 0} bounds={fit} fitKey={`${stp?.stp_id}|${focus?.id ?? ""}|${route ? 1 : 0}|${mapped.length}`} />
                {route && <Polyline positions={route.coords} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9 }} />}
                {route && <Polyline positions={route.coords} pathOptions={{ color: "#1463d6", weight: 5 }} />}
                {mapped.map(({ d, pt }) => {
                  const b = bucketOf(d.status);
                  const on = focusedOrder?.request_id === d.request_id;
                  if (b === "completed" && !on) return null;
                  return (
                    <Marker key={d.request_id} position={pt!} icon={on ? pinIcon("drop", "brand") : dotIcon(BUCKET_COLOR[b])} zIndexOffset={on ? 800 : 0}
                      eventHandlers={{ click: () => setFocus({ kind: "order", id: d.request_id }) }}>
                      <Popup><strong>{d.request_id}</strong><br />{num(d.quantity)} KLD · {d.status}</Popup>
                    </Marker>
                  );
                })}
                {destStp && focusPt && <Marker position={focusPt} icon={pinIcon("plant", "ink")} zIndexOffset={800} />}
                {plantPt && <Marker position={plantPt} icon={pinIcon("plant", "success")} zIndexOffset={900}><Popup><strong>{stp?.stp_name}</strong><br />Your plant</Popup></Marker>}
              </MapFrame>

              <div className="map-chip">
                <span className="live-dot" /> {stp?.stp_name ?? "Plant"}
                <span className="muted num">· {num(availKld)} KLD free</span>
              </div>

              <div className="map-overlay">
                <span><span className="legend-dot" style={{ background: "var(--success)" }} />Your plant</span>
                <span><span className="legend-dot" style={{ background: BUCKET_COLOR.pending }} />Pending</span>
                <span><span className="legend-dot" style={{ background: BUCKET_COLOR.active }} />In delivery</span>
              </div>

              {(focusedOrder || focusedTransfer) && (
                <aside className="map-panel" aria-live="polite">
                  <header className="row-between">
                    <div className="row" style={{ gap: 8 }}>
                      <strong className="num">{focusedOrder?.request_id ?? focusedTransfer?.transfer_id}</strong>
                      <StatusBadge status={focusedOrder?.status ?? focusedTransfer?.status} />
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setFocus(null)} aria-label="Close details"><X size={15} /></button>
                  </header>
                  <p className="panel-dest">
                    {focusedOrder ? focusedOrder.site_name : `${focusedTransfer!.destination_stp_name} (plant transfer)`}
                  </p>
                  <dl className="panel-figs">
                    <div><dt><Navigation size={13} /> Route</dt><dd className="num">{route ? `${num(route.km, 1)} km` : routing ? "…" : focusPt ? "—" : "No location"}</dd></div>
                    <div><dt><Timer size={13} /> Travel</dt><dd className="num">{route ? `${Math.round(route.mins)} min` : "—"}</dd></div>
                    <div><dt><Droplets size={13} /> Quantity</dt><dd className="num">{num(focusedOrder?.quantity ?? focusedTransfer?.quantity_kld)} KLD</dd></div>
                  </dl>
                  <div className="panel-meta">
                    <span>{focusedOrder?.quality_required || focusedTransfer?.quality || "Any"} grade</span>
                    <span>{when(focusedOrder?.created_at ?? focusedTransfer?.requested_at)}</span>
                    {focusedOrder?.payment_status && <span>{focusedOrder.payment_status}</span>}
                  </div>
                  {focusedOrder?.buyer_name && (
                    <div className="req-buyer">
                      {focusedOrder.buyer_name}
                      {focusedOrder.buyer_phone && <a href={`tel:${focusedOrder.buyer_phone}`}><Phone size={13} /> {focusedOrder.buyer_phone}</a>}
                    </div>
                  )}
                  {(focusedOrder?.status ?? focusedTransfer?.status) === "Pending" && (
                    <div className="panel-actions">
                      <button className="btn btn-sm btn-secondary" disabled={!!busy}
                        onClick={() => focusedOrder ? act("order", focusedOrder.request_id, "reject") : act("transfer", focusedTransfer!.transfer_id, "reject")}>
                        <X /> Reject
                      </button>
                      <button className="btn btn-sm btn-primary" disabled={!!busy}
                        onClick={() => focusedOrder ? act("order", focusedOrder.request_id, "accept") : act("transfer", focusedTransfer!.transfer_id, "accept")}>
                        <Check /> Accept
                      </button>
                    </div>
                  )}
                </aside>
              )}
            </section>

            <section className="grid grid-4 mt-16">
              <Stat icon={Droplets} label="Available today" value={ov.data ? num(availKld) : "—"} unit="KLD"
                hint={totalKld ? <Meter pct={usedPct} label={`${Math.round(usedPct)}% of ${num(totalKld)} KLD allocated`} /> : "Capacity not set"} />
              <Stat icon={Inbox} label="Pending requests" value={ov.data ? pendingCount : "—"} hint="Orders and transfers to review" />
              <Stat icon={ClipboardList} label="In delivery" value={ov.data ? activeCount : "—"} hint={`${deliveredCount} delivered so far`} />
              <Stat icon={TrendingUp} label="Forecast tomorrow" value={ov.data?.prediction != null ? num(ov.data.prediction) : "—"} unit={ov.data?.prediction != null ? "KLD" : undefined}
                hint={ov.data?.prediction != null ? "Predicted demand" : "Not enough history yet"} />
            </section>

            <div className="split mt-16">
              <div className="stack">
                <section className="card">
                  <header className="card-head wrap">
                    <div><h2>Orders</h2><p>Requests from demand sites for your plant</p></div>
                    <Segmented<OrderFilter> label="Filter orders" value={filter} onChange={setFilter} options={filterOptions(demands, (d) => d.status)} />
                  </header>
                  {ov.loading && !ov.data ? <SkeletonRows rows={3} /> : visible.length ? (
                    <ul className="list">
                      {visible.map((d) => (
                        <li key={d.request_id} className="list-row req" data-selected={focusedOrder?.request_id === d.request_id}>
                          <div className="req-main">
                            <div className="row wrap" style={{ gap: 8 }}>
                              <strong className="num">{d.request_id}</strong>
                              <StatusBadge status={d.status} />
                              {d.payment_status && <span className="muted req-meta">{d.payment_status}</span>}
                            </div>
                            <p className="req-site">{d.site_name}</p>
                            <div className="req-facts">
                              <span className="num"><b>{num(d.quantity)}</b> KLD</span>
                              <span>{d.quality_required || "Any"} grade</span>
                              {d.distance_km && <span className="num">{num(d.distance_km, 1)} km</span>}
                              <span>{when(d.created_at)}</span>
                            </div>
                            <div className="req-buyer">
                              {d.buyer_name}
                              {d.buyer_phone && <a href={`tel:${d.buyer_phone}`}><Phone size={13} /> {d.buyer_phone}</a>}
                              {d.assigned_operator_name && <span className="muted">· Tanker: {d.assigned_operator_name}</span>}
                            </div>
                          </div>
                          <div className="req-actions">
                            <button className="btn btn-sm btn-ghost" onClick={() => view({ kind: "order", id: d.request_id })}>
                              <MapPinned /> View info
                            </button>
                            {d.status === "Pending" && (
                              <>
                                <button className="btn btn-sm btn-secondary" disabled={!!busy} onClick={() => act("order", d.request_id, "reject")}>
                                  {busy === `${d.request_id}:reject` ? <Spinner /> : <X />} Reject
                                </button>
                                <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => act("order", d.request_id, "accept")}>
                                  {busy === `${d.request_id}:accept` ? <Spinner /> : <Check />} Accept
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty icon={Inbox} title={filter === "pending" ? "No pending orders" : "Nothing here"}>
                      {filter === "pending" ? "New requests from demand sites will appear here." : "No orders in this state."}
                    </Empty>
                  )}
                </section>

                <section className="card">
                  <header className="card-head">
                    <div><h2>Plant-to-plant transfers</h2><p>Other plants requesting water from you</p></div>
                    <button className="btn btn-sm btn-secondary" onClick={() => setRequestOpen(true)} disabled={!stp}><Plus /> Request water</button>
                  </header>
                  {transfers.length ? (
                    <ul className="list">
                      {transfers.map((t) => (
                        <li key={t.transfer_id} className="list-row req" data-selected={focusedTransfer?.transfer_id === t.transfer_id}>
                          <div className="req-main">
                            <div className="row wrap" style={{ gap: 8 }}>
                              <strong className="num">{t.transfer_id}</strong>
                              <StatusBadge status={t.status} />
                            </div>
                            <p className="req-site row" style={{ gap: 6 }}>
                              {t.destination_stp_name} <ArrowLeftRight size={13} className="muted" /> <span className="muted">your plant</span>
                            </p>
                            <div className="req-facts">
                              <span className="num"><b>{num(t.quantity_kld)}</b> KLD</span>
                              <span>{t.quality} grade</span>
                              {t.distance_km && <span className="num">{num(t.distance_km, 1)} km</span>}
                              <span>{when(t.requested_at)}</span>
                            </div>
                          </div>
                          <div className="req-actions">
                            <button className="btn btn-sm btn-ghost" onClick={() => view({ kind: "transfer", id: t.transfer_id })}><MapPinned /> View info</button>
                            {t.status === "Pending" && (
                              <>
                                <button className="btn btn-sm btn-secondary" disabled={!!busy} onClick={() => act("transfer", t.transfer_id, "reject")}>
                                  {busy === `${t.transfer_id}:reject` ? <Spinner /> : <X />} Reject
                                </button>
                                <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => act("transfer", t.transfer_id, "accept")}>
                                  {busy === `${t.transfer_id}:accept` ? <Spinner /> : <Check />} Accept
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty icon={ArrowLeftRight} title="No transfer requests">When another plant asks you for treated water, it shows up here.</Empty>
                  )}
                </section>
              </div>

              <aside className="stack">
                <section className="card">
                  <header className="card-head">
                    <div><h2>7-day demand forecast</h2><p>Model prediction for this plant</p></div>
                    <CalendarClock size={16} className="muted" />
                  </header>
                  <div className="card-body">
                    {ov.data?.weekly_forecast?.length ? <ForecastChart values={ov.data.weekly_forecast} /> : (
                      <p className="muted" style={{ fontSize: 13.5 }}>No forecast available for this plant yet.</p>
                    )}
                  </div>
                </section>

                <section className="card">
                  <header className="card-head">
                    <div><h2>Water quality</h2><p>Latest OCEMS readings</p></div>
                    <a href="/supply_ocems" className="btn btn-sm btn-ghost">Details <ArrowRight /></a>
                  </header>
                  <div className="card-body stack" style={{ gap: 14 }}>
                    <OcemsGrid reading={ocems.data} loading={ocems.loading} />
                    <OcemsUpload onDone={ocems.reload} />
                  </div>
                </section>

                <PricingCard pricing={ov.data?.pricing ?? null} onEdit={() => setPricingOpen(true)} />
              </aside>
            </div>
          </>
        )}
      </main>

      {pricingOpen && stp && ov.data?.pricing && (
        <PricingDialog stpId={stp.stp_id} pricing={ov.data.pricing} onClose={() => setPricingOpen(false)} onSaved={() => { setPricingOpen(false); ov.reload(); }} />
      )}
      {requestOpen && stp && (
        <RequestDialog me={stp} stps={ov.data?.stps ?? []} onClose={() => setRequestOpen(false)} onSaved={() => { setRequestOpen(false); ov.reload(); }} />
      )}
      <ChatWidget role="stp" />
    </AppShell>
  );
}

function Meter({ pct, label }: { pct: number; label: string }) {
  return (
    <span className="meter-wrap">
      <span className="meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
      {label}
    </span>
  );
}

function PricingCard({ pricing, onEdit }: { pricing: Pricing | null; onEdit: () => void }) {
  const base = Number(pricing?.base_price_per_kld) || 0;
  const peak = Number(pricing?.peak_incentive) || 0;
  const off = Number(pricing?.off_peak_incentive) || 0;
  return (
    <section className="card">
      <header className="card-head">
        <div><h2>Pricing</h2><p>Per KLD, by delivery window</p></div>
        <button className="btn btn-sm btn-ghost" onClick={onEdit} disabled={!pricing}><Pencil /> Edit</button>
      </header>
      {pricing ? (
        <div className="card-body">
          <div className="price-main">
            <span className="num">₹{num(base)}</span>
            <small>base / KLD</small>
          </div>
          <dl className="price-rows">
            <div><dt>Peak <span className="muted">{pricing.peak_start}–{pricing.peak_end}</span></dt><dd className="num">₹{num(base + peak)}</dd></div>
            <div><dt>Off-peak <span className="muted">{pricing.off_peak_start}–{pricing.off_peak_end}</span></dt><dd className="num">₹{num(Math.max(0, base - off))}</dd></div>
            <div><dt>Sustainability credit</dt><dd className="num">₹{num(pricing.sustainability_credit)}</dd></div>
            <div><dt>Reliability bonus</dt><dd className="num">₹{num(pricing.reliability_bonus)}</dd></div>
          </dl>
        </div>
      ) : (
        <Empty icon={Gauge} title="No pricing set" />
      )}
    </section>
  );
}

function OcemsUpload({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    try {
      await postForm("/ocems/upload", { ocems_file: file });
      toast("OCEMS report uploaded. It will appear once an admin approves it.", "success");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "danger");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="upload-row">
      <input ref={ref} type="file" accept=".xlsx,.xls" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      <span className="muted">Daily report (.xlsx)</span>
      <button className="btn btn-sm btn-secondary" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Spinner /> : <FileUp />} Upload report
      </button>
    </div>
  );
}

function PricingDialog({ stpId, pricing, onClose, onSaved }: { stpId: string; pricing: Pricing; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(() => ({ ...pricing, stp_id: stpId }));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Pricing) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await postJSON("/api/update_pricing", f);
      toast("Pricing updated.", "success");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not save pricing", "danger");
      setSaving(false);
    }
  }
  const money = (k: keyof Pricing, label: string) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <div className="input-prefix"><span>₹</span><input className="input num" inputMode="decimal" required value={String(f[k] ?? "")} onChange={set(k)} /></div>
    </label>
  );
  const time = (k: keyof Pricing, label: string) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <input className="input" value={String(f[k] ?? "")} onChange={set(k)} placeholder="06:00 AM" />
    </label>
  );
  return (
    <Dialog title="Edit pricing" onClose={onClose}>
      <form onSubmit={save} className="stack">
        <div className="grid grid-2">{money("base_price_per_kld", "Base price / KLD")}{money("peak_incentive", "Peak surcharge")}</div>
        <div className="grid grid-2">{time("peak_start", "Peak starts")}{time("peak_end", "Peak ends")}</div>
        <div className="grid grid-2">{money("off_peak_incentive", "Off-peak discount")}<span /></div>
        <div className="grid grid-2">{time("off_peak_start", "Off-peak starts")}{time("off_peak_end", "Off-peak ends")}</div>
        <div className="grid grid-2">{money("sustainability_credit", "Sustainability credit")}{money("reliability_bonus", "Reliability bonus")}</div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving && <Spinner />} Save pricing</button>
        </div>
      </form>
    </Dialog>
  );
}

function RequestDialog({ me, stps, onClose, onSaved }: { me: Stp; stps: Stp[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const sources = stps.filter((s) => s.stp_id !== me.stp_id);
  const [source, setSource] = useState("");
  const [qty, setQty] = useState("");
  const [quality, setQuality] = useState("");
  const [saving, setSaving] = useState(false);
  const src = sources.find((s) => s.stp_id === source);
  const srcAvail = src ? (Number(src.available_capacity_mld) || 0) * 1000 : null;
  const qtyN = Number(qty);
  const overCap = srcAvail !== null && qtyN > srcAvail;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await postJSON("/request-water/create", {
        source_stp_id: source, destination_stp_id: me.stp_id, quantity_kld: qtyN, quality, water_type: "Treated Water",
      });
      toast("Transfer requested. The source plant will be notified.", "success");
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not create the request", "danger");
      setSaving(false);
    }
  }
  return (
    <Dialog title="Request water from another plant" onClose={onClose}>
      <form onSubmit={save} className="stack">
        <label className="field">
          <span className="field-label">Source plant</span>
          <select className="select" required value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Choose a plant…</option>
            {sources.map((s) => (
              <option key={s.stp_id} value={s.stp_id}>{s.stp_name} — {num((Number(s.available_capacity_mld) || 0) * 1000)} KLD free</option>
            ))}
          </select>
          {src && <span className="field-hint">{src.quality_grade || "General"} grade · {num(srcAvail)} KLD available today</span>}
        </label>
        <div className="grid grid-2">
          <label className="field">
            <span className="field-label">Quantity</span>
            <div className="input-suffix"><input className="input num" inputMode="decimal" required value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))} aria-invalid={overCap} /><span>KLD</span></div>
            {overCap && <span className="field-error">Exceeds what this plant has available.</span>}
          </label>
          <label className="field">
            <span className="field-label">Quality grade</span>
            <select className="select" required value={quality} onChange={(e) => setQuality(e.target.value)}>
              <option value="">Choose…</option>
              {QUALITIES.map((q) => <option key={q}>{q}</option>)}
            </select>
          </label>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving || !source || !qtyN || !quality || overCap}>{saving && <Spinner />} Send request</button>
        </div>
      </form>
    </Dialog>
  );
}

