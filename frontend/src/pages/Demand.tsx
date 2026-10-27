import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Marker, Polyline, Popup, useMapEvents } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import {
  ArrowRight, CircleCheck, ClipboardList, Crosshair, Droplets, Factory, LocateFixed, MapPin, Navigation, RotateCcw, Search, Timer,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { roleNav } from "../components/nav";
import { UserMenu } from "../components/UserMenu";
import { ChatWidget } from "../components/ChatWidget";
import { FitBounds, InvalidateOnResize, MapFrame, pinIcon } from "../components/map";
import { OcemsGrid } from "../components/OcemsGrid";
import { Badge, Empty, Notice, Segmented, SkeletonRows, Spinner, StatusBadge } from "../components/ui";
import { applyFilter, bucketOf, filterOptions, type OrderFilter } from "../lib/orders";
import { getJSON, postJSON } from "../lib/api";
import { useAsync } from "../lib/useAsync";
import { useToast } from "../lib/toast";
import { num, when } from "../lib/format";
import type { OcemsReading, Stp } from "../lib/types";
import "./demand.css";

const MIN_KLD = 5;
const AVG_SPEED_KMH = 28; // matches the previous ETA model
const QUALITIES = ["Platinum", "Gold", "Silver", "General"];
const TYPES = ["Treated", "Fresh", "General"];

interface Point { lat: number; lon: number; label: string }
interface Suggestion { display_name: string; lat: string; lon: string }
interface SearchResult {
  searched_location: { name: string; latitude: number; longitude: number };
  nearest_stp: (Stp & { distance_km: number }) | null;
  matching_error?: string;
  error?: string;
  minimum_quantity_kld?: number;
}
interface RouteOpt { coords: LatLngTuple[]; km: number; mins: number }
interface MyOrder { order_id: string; status: string; location: string; stp_name: string; quantity_kld: string; created_at: string; payment_status: string }

export default function Demand() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const { data: stps } = useAsync((s) => getJSON<Stp[]>("/api/stps", s));
  const orders = useAsync((s) => getJSON<MyOrder[]>("/api/my_orders", s));

  // Form
  const [address, setAddress] = useState("");
  const [kld, setKld] = useState("");
  const [quality, setQuality] = useState("");
  const [type, setType] = useState("");
  const [point, setPoint] = useState<Point | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [locating, setLocating] = useState(false);
  const [kldTouched, setKldTouched] = useState(false);

  // Result
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [routes, setRoutes] = useState<RouteOpt[]>([]);
  const [activeRoute, setActiveRoute] = useState(0);
  const [ocems, setOcems] = useState<OcemsReading | null>(null);
  const [ocemsLoading, setOcemsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const searchSeq = useRef(0);

  const kldNum = Number(kld);
  const kldInvalid = kld !== "" && (!Number.isFinite(kldNum) || kldNum < MIN_KLD);

  useEffect(() => {
    const paid = params.get("payment_success");
    if (paid) {
      toast(`Order ${paid} is confirmed. Track it under My orders.`, "success");
      params.delete("payment_success");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Address lookup (OpenStreetMap Nominatim) ---------- */
  async function lookupAddress() {
    const q = address.trim();
    if (!q) return;
    setLookingUp(true);
    try {
      const qs = new URLSearchParams({ q: `${q}, Bengaluru, Karnataka, India`, format: "jsonv2", limit: "5", countrycodes: "in" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error();
      setSuggestions(await res.json());
    } catch {
      toast("Address search is unavailable right now. Click the map to set the delivery point.", "danger");
    } finally {
      setLookingUp(false);
    }
  }

  function choose(lat: number, lon: number, label: string) {
    setPoint({ lat, lon, label });
    setAddress(label);
    setSuggestions(null);
    resetResult();
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast("Location isn't supported in this browser.", "danger");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        choose(p.coords.latitude, p.coords.longitude, "Current location");
      },
      () => {
        setLocating(false);
        toast("Location permission was denied.", "danger");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function resetResult() {
    searchSeq.current++;
    setResult(null);
    setRoutes([]);
    setOcems(null);
  }

  /* ---------- Matching ---------- */
  async function findPlant(e: FormEvent) {
    e.preventDefault();
    setKldTouched(true);
    if (!point) {
      if (address.trim()) await lookupAddress();
      else toast("Set a delivery point: search an address, use your location or click the map.", "info");
      return;
    }
    if (!Number.isFinite(kldNum) || kldNum < MIN_KLD) return;

    const seq = ++searchSeq.current;
    setSearching(true);
    setRoutes([]);
    setOcems(null);
    try {
      const qs = new URLSearchParams({ lat: String(point.lat), lon: String(point.lon), required_kld: String(kldNum), quality, type });
      const data = await getJSON<SearchResult>(`/api/search_place?${qs}`);
      if (seq !== searchSeq.current) return;
      if (data.error) throw new Error(data.error);
      setResult(data);
      const n = data.nearest_stp;
      if (!n || n.latitude == null || n.longitude == null) return;

      setOcemsLoading(true);
      getJSON<OcemsReading>(`/api/demand_ocems/${encodeURIComponent(n.stp_id)}`)
        .then((r) => seq === searchSeq.current && setOcems(r))
        .catch(() => seq === searchSeq.current && setOcems({ success: false, available: false }))
        .finally(() => seq === searchSeq.current && setOcemsLoading(false));

      fetch(`https://router.project-osrm.org/route/v1/driving/${point.lon},${point.lat};${n.longitude},${n.latitude}?overview=full&geometries=geojson&alternatives=true`)
        .then((r) => r.json())
        .then((rd) => {
          if (seq !== searchSeq.current || !rd.routes?.length) return;
          setActiveRoute(0);
          setRoutes(
            rd.routes.map((r: { distance: number; geometry: { coordinates: [number, number][] } }) => {
              const km = r.distance / 1000;
              return { km, mins: (km / AVG_SPEED_KMH) * 60, coords: r.geometry.coordinates.map(([x, y]) => [y, x] as LatLngTuple) };
            }),
          );
        })
        .catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Matching failed";
      toast(/minimum|5 kld/i.test(msg) ? `Minimum order is ${MIN_KLD} KLD.` : msg, "danger");
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }

  async function book() {
    const n = result?.nearest_stp;
    if (!n || !point) return;
    setBooking(true);
    try {
      const data = await postJSON<{ order_id?: string }>("/create_order", {
        stp_id: n.stp_id,
        stp_name: n.stp_name,
        quantity_kld: kldNum,
        quality,
        water_type: type,
        distance_km: n.distance_km,
        location: point.label,
        delivery_latitude: point.lat,
        delivery_longitude: point.lon,
      });
      if (!data.order_id) throw new Error("The order was created but no order ID came back. Check My orders.");
      window.location.assign(`/invoice?order_id=${encodeURIComponent(data.order_id)}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not place the order.", "danger");
      setBooking(false);
    }
  }

  /* ---------- Map data ---------- */
  const nearest = result?.nearest_stp ?? null;
  const fit = useMemo(() => {
    if (routes.length) return routes.flatMap((r) => r.coords);
    const pts: LatLngTuple[] = [];
    if (point) pts.push([point.lat, point.lon]);
    if (nearest?.latitude != null && nearest.longitude != null) pts.push([nearest.latitude, nearest.longitude]);
    if (pts.length) return pts;
    const plants = (stps ?? []).filter((s) => s.latitude && s.longitude).map((s) => [s.latitude!, s.longitude!] as LatLngTuple);
    return plants.length ? plants : null;
  }, [routes, point, nearest, stps]);
  const fitKey = `${point?.lat},${point?.lon}|${nearest?.stp_id ?? ""}|${routes.length}|${stps?.length ?? 0}`;
  const best = routes[activeRoute];

  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const allOrders = orders.data ?? [];
  const shownOrders = applyFilter(allOrders, orderFilter, (o) => o.status);

  return (
    <AppShell nav={roleNav.demand!} title="Find treated water" subtitle="Match your site with the nearest plant that can supply it" actions={<UserMenu />}>
      <main className="page demand">
        <form className="card search-bar" onSubmit={findPlant} noValidate>
          <div className="field addr">
            <label className="field-label" htmlFor="addr">Delivery point</label>
            <div className="addr-row">
              <div className="input-group" style={{ flex: 1 }}>
                <MapPin size={16} />
                <input
                  id="addr"
                  className="input"
                  placeholder="Search an address, e.g. Hebbal"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (point) { setPoint(null); resetResult(); }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !point) { e.preventDefault(); void lookupAddress(); }
                  }}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={!!suggestions}
                />
                {suggestions && (
                  <ul className="suggest" role="listbox">
                    {suggestions.length === 0 && <li className="suggest-empty">No match. Try a fuller address or click the map.</li>}
                    {suggestions.map((s) => (
                      <li key={s.lat + s.lon}>
                        <button type="button" role="option" onClick={() => choose(Number(s.lat), Number(s.lon), s.display_name)}>
                          <MapPin size={14} /> <span>{s.display_name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => void lookupAddress()} disabled={!address.trim() || lookingUp} title="Look up address" aria-label="Look up address">
                {lookingUp ? <Spinner /> : <Search />}
              </button>
              <button type="button" className="btn btn-secondary btn-icon" onClick={useMyLocation} disabled={locating} title="Use my location" aria-label="Use my location">
                {locating ? <Spinner /> : <LocateFixed />}
              </button>
            </div>
          </div>
          <div className="field qty">
            <label className="field-label" htmlFor="kld">Quantity</label>
            <div className="input-suffix">
              <input
                id="kld"
                className="input num"
                inputMode="decimal"
                placeholder={`Min ${MIN_KLD}`}
                value={kld}
                onChange={(e) => { setKld(e.target.value.replace(/[^\d.]/g, "")); resetResult(); }}
                onBlur={() => setKldTouched(true)}
                aria-invalid={kldTouched && (kldInvalid || kld === "")}
                aria-describedby="kld-err"
              />
              <span>KLD</span>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="quality">Quality grade</label>
            <select id="quality" className="select" value={quality} onChange={(e) => { setQuality(e.target.value); resetResult(); }}>
              <option value="">Any grade</option>
              {QUALITIES.map((q) => <option key={q}>{q}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="type">Water type</label>
            <select id="type" className="select" value={type} onChange={(e) => { setType(e.target.value); resetResult(); }}>
              <option value="">Any type</option>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field submit">
            <span className="field-label" aria-hidden="true">&nbsp;</span>
            <button className="btn btn-primary" type="submit" disabled={searching}>
              {searching ? <Spinner /> : <Search />} Find plant
            </button>
          </div>
          <p className="search-status" id="kld-err">
            {kldTouched && (kldInvalid || kld === "") ? (
              <span className="field-error">Enter at least {MIN_KLD} KLD.</span>
            ) : point ? (
              <span className="row" style={{ gap: 6 }}><CircleCheck size={14} color="var(--success)" /> Delivering to <strong>{point.label}</strong> — drag the pin or click the map to adjust.</span>
            ) : (
              <span className="muted">Search an address, use your location, or click the map to drop the delivery pin.</span>
            )}
          </p>
        </form>

        <div className="demand-grid">
          <section className="card map-card" aria-label="Route map">
            <MapFrame className="demand-map" scrollZoom>
              <InvalidateOnResize />
              <PickPoint onPick={(lat, lon) => choose(lat, lon, `Pinned location (${lat.toFixed(5)}, ${lon.toFixed(5)})`)} />
              <FitBounds bounds={fit} fitKey={fitKey} />
              {(stps ?? []).filter((s) => s.latitude && s.longitude && s.stp_id !== nearest?.stp_id).map((s) => (
                <Marker key={s.stp_id} position={[s.latitude!, s.longitude!]} icon={pinIcon("plant", "ink")} opacity={nearest ? 0.45 : 0.9}>
                  <Popup><strong>{s.stp_name}</strong><br />{s.quality_grade || "General"} grade</Popup>
                </Marker>
              ))}
              {routes.map((r, i) => i !== activeRoute && (
                <Polyline key={i} positions={r.coords} pathOptions={{ color: "#93b7ec", weight: 5, opacity: 0.9 }} eventHandlers={{ click: () => setActiveRoute(i) }} />
              ))}
              {best && <Polyline positions={best.coords} pathOptions={{ color: "#1463d6", weight: 6 }} />}
              {nearest?.latitude != null && nearest.longitude != null && (
                <Marker position={[nearest.latitude, nearest.longitude]} icon={pinIcon("plant", "success")} zIndexOffset={500}>
                  <Popup><strong>{nearest.stp_name}</strong><br />Matched plant · {num(nearest.distance_km, 1)} km</Popup>
                </Marker>
              )}
              {point && (
                <Marker
                  position={[point.lat, point.lon]}
                  icon={pinIcon("home", "brand")}
                  draggable
                  zIndexOffset={600}
                  eventHandlers={{
                    dragend: (e) => {
                      const ll = e.target.getLatLng();
                      choose(ll.lat, ll.lng, `Pinned location (${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)})`);
                    },
                  }}
                >
                  <Popup>Delivery point</Popup>
                </Marker>
              )}
            </MapFrame>
            <div className="map-overlay">
              <span><span className="legend-dot" style={{ background: "var(--brand)" }} />Delivery</span>
              <span><span className="legend-dot" style={{ background: "var(--success)" }} />Matched plant</span>
              <span><span className="legend-dot" style={{ background: "var(--ink-800)" }} />Other plants</span>
            </div>
          </section>

          <aside className="stack">
            <section className="card" aria-live="polite">
              <header className="card-head">
                <div>
                  <h2>Match</h2>
                  <p>Nearest plant that meets your request</p>
                </div>
                {nearest && <Badge tone="success">Available</Badge>}
              </header>
              {searching ? (
                <SkeletonRows rows={3} />
              ) : result?.nearest_stp ? (
                <div className="card-body match">
                  <div className="match-plant">
                    <span className="match-icon"><Factory size={18} /></span>
                    <div>
                      <strong>{nearest!.stp_name}</strong>
                      <span>{nearest!.quality_grade || "General"} grade · {nearest!.technology && nearest!.technology !== "Not Specified" ? nearest!.technology : "Treatment plant"}</span>
                    </div>
                  </div>
                  <dl className="match-figures">
                    <div><dt><Navigation size={14} /> Distance</dt><dd className="num">{best ? `${num(best.km, 1)} km` : `${num(nearest!.distance_km, 1)} km`}</dd></div>
                    <div><dt><Timer size={14} /> Est. travel</dt><dd className="num">{best ? `${Math.round(best.mins)} min` : "—"}</dd></div>
                    <div><dt><Droplets size={14} /> Quantity</dt><dd className="num">{num(kldNum)} KLD</dd></div>
                  </dl>
                  {routes.length > 1 && (
                    <div className="route-pick" role="group" aria-label="Route options">
                      {routes.map((r, i) => (
                        <button key={i} type="button" aria-pressed={i === activeRoute} onClick={() => setActiveRoute(i)}>
                          <span>{i === 0 ? "Fastest" : `Alternate ${i}`}</span>
                          <small className="num">{num(r.km, 1)} km · {Math.round(r.mins)} min</small>
                        </button>
                      ))}
                    </div>
                  )}
                  <div>
                    <div className="sub-head">Water quality (OCEMS)</div>
                    <OcemsGrid reading={ocems} loading={ocemsLoading} />
                  </div>
                  <button type="button" className="btn btn-primary btn-lg btn-block" onClick={book} disabled={booking}>
                    {booking ? <Spinner /> : null} Place order <ArrowRight />
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={resetResult} style={{ justifySelf: "center" }}>
                    <RotateCcw /> Change request
                  </button>
                </div>
              ) : result?.matching_error ? (
                <div className="card-body">
                  <Notice tone="warning">{result.matching_error} Try a lower quantity, another grade, or “Any type”.</Notice>
                </div>
              ) : (
                <Empty icon={Crosshair} title="No match yet">
                  Set the delivery point and quantity, then choose <strong>Find plant</strong>.
                </Empty>
              )}
            </section>


            <section className="card orders-side">
              <header className="card-head">
                <div>
                  <h2>Orders</h2>
                  <p>{orders.loading && !orders.data ? "Loading…" : `${allOrders.length} placed from this account`}</p>
                </div>
                <a className="btn btn-sm btn-ghost" href="/track">View all <ArrowRight /></a>
              </header>
              <div className="orders-filter">
                <Segmented<OrderFilter> label="Filter orders" value={orderFilter} onChange={setOrderFilter} options={filterOptions(allOrders, (o) => o.status)} />
              </div>
              {orders.loading && !orders.data ? (
                <SkeletonRows rows={3} />
              ) : shownOrders.length ? (
                <ul className="list order-list">
                  {shownOrders.slice(0, 6).map((o) => (
                    <li key={o.order_id} className="list-row">
                      <a href={`/track?order_id=${encodeURIComponent(o.order_id)}`} className="order-link">
                        <div className="row-between">
                          <strong className="num">{o.order_id}</strong>
                          <StatusBadge status={o.status} />
                        </div>
                        <span className="order-meta">
                          <b className="num">{num(o.quantity_kld)} KLD</b> · {o.stp_name}
                        </span>
                        <span className="order-meta muted">
                          {when(o.created_at)}{o.payment_status ? ` · ${o.payment_status}` : ""}
                          <span className="order-go">{bucketOf(o.status) === "completed" ? "Details" : "Track"} <ArrowRight size={13} /></span>
                        </span>
                      </a>
                    </li>
                  ))}
                  {shownOrders.length > 6 && (
                    <li className="list-row more-row"><a href="/track">+ {shownOrders.length - 6} more orders</a></li>
                  )}
                </ul>
              ) : (
                <Empty icon={ClipboardList} title={orderFilter === "all" ? "No orders yet" : "Nothing here"}>
                  {orderFilter === "all" ? "Orders you place appear here with their delivery status." : "No orders in this state."}
                </Empty>
              )}
            </section>
          </aside>
        </div>

      </main>
      <ChatWidget role="demand" />
    </AppShell>
  );
}

function PickPoint({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
