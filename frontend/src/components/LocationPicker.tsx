import { useState } from "react";
import { Marker, useMapEvents } from "react-leaflet";
import { CircleCheck, LocateFixed, MapPin, Search } from "lucide-react";
import { FitBounds, MapFrame, pinIcon } from "./map";
import { Spinner } from "./ui";
import { useToast } from "../lib/toast";

export interface PickedPoint { lat: number; lon: number; label: string }
interface Suggestion { display_name: string; lat: string; lon: string }

/** Search an address, use the device location, or click / drag the pin. */
export function LocationPicker({ value, onChange, icon = "plant", invalid }: {
  value: PickedPoint | null; onChange: (p: PickedPoint) => void; icon?: "plant" | "truck"; invalid?: boolean;
}) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  async function search() {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const qs = new URLSearchParams({ q: `${q.trim()}, Bengaluru, Karnataka, India`, format: "jsonv2", limit: "5", countrycodes: "in" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error();
      setResults(await res.json());
    } catch {
      toast("Address search is unavailable. Click the map to place the pin instead.", "danger");
    } finally {
      setBusy(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) return toast("Location isn't supported in this browser.", "danger");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); onChange({ lat: p.coords.latitude, lon: p.coords.longitude, label: "Current location" }); },
      () => { setLocating(false); toast("Location permission was denied.", "danger"); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const fmt = (lat: number, lon: number) => `Pinned at ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  return (
    <div className="picker" data-invalid={invalid || undefined}>
      <div className="picker-bar">
        <div className="input-group" style={{ flex: 1 }}>
          <MapPin size={16} />
          <input
            className="input"
            placeholder="Search address or landmark"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
            aria-label="Search location"
          />
          {results && (
            <ul className="suggest" role="listbox">
              {results.length === 0 && <li className="suggest-empty">No match. Try a fuller address or click the map.</li>}
              {results.map((r) => (
                <li key={r.lat + r.lon}>
                  <button type="button" role="option" onClick={() => { onChange({ lat: +r.lat, lon: +r.lon, label: r.display_name }); setResults(null); }}>
                    <MapPin size={14} /> <span>{r.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void search()} disabled={busy || !q.trim()}>{busy ? <Spinner /> : <Search />} Search</button>
        <button type="button" className="btn btn-secondary btn-icon" onClick={locate} disabled={locating} aria-label="Use my location" title="Use my location">
          {locating ? <Spinner /> : <LocateFixed />}
        </button>
      </div>
      <MapFrame className="picker-map" scrollZoom>
        <FitBounds bounds={value ? [[value.lat, value.lon]] : null} fitKey={value ? `${value.lat},${value.lon}` : ""} maxZoom={16} />
        <Pick onPick={(lat, lon) => onChange({ lat, lon, label: fmt(lat, lon) })} />
        {value && (
          <Marker
            position={[value.lat, value.lon]}
            icon={pinIcon(icon, "brand")}
            draggable
            eventHandlers={{ dragend: (e) => { const ll = e.target.getLatLng(); onChange({ lat: ll.lat, lon: ll.lng, label: fmt(ll.lat, ll.lng) }); } }}
          />
        )}
      </MapFrame>
      <p className="picker-status">
        {value ? (
          <><CircleCheck size={14} color="var(--success)" /> <span>{value.label}</span></>
        ) : (
          <span className="muted">No location yet — search, use your location, or click the map.</span>
        )}
      </p>
    </div>
  );
}

function Pick({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
