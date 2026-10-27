import { useEffect, useState } from "react";
import type { LatLngTuple } from "leaflet";

export interface RouteInfo { coords: LatLngTuple[]; km: number; mins: number }
const AVG_SPEED_KMH = 28; // same ETA model as the order pages

const finite = (p?: LatLngTuple | null): p is LatLngTuple => !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && !(p[0] === 0 && p[1] === 0);

/** Road route between two points from the public OSRM server; falls back to a straight line. */
export function useRoute(from?: LatLngTuple | null, to?: LatLngTuple | null) {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const key = finite(from) && finite(to) ? `${from.join()}|${to.join()}` : "";

  useEffect(() => {
    setRoute(null);
    if (!key) return;
    const [a, b] = [from!, to!];
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const r = d.routes?.[0];
        if (!r) throw new Error("no route");
        const km = r.distance / 1000;
        setRoute({ km, mins: (km / AVG_SPEED_KMH) * 60, coords: r.geometry.coordinates.map(([x, y]: [number, number]) => [y, x] as LatLngTuple) });
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        void e;
        // Straight-line fallback keeps the map useful when routing is unreachable.
        const R = 6371, toRad = (v: number) => (v * Math.PI) / 180;
        const dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
        const km = 2 * R * Math.asin(Math.sqrt(h));
        setRoute({ km, mins: (km / AVG_SPEED_KMH) * 60, coords: [a, b] });
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { route, loading };
}

export const toPoint = (lat: unknown, lon: unknown): LatLngTuple | null => {
  const p: LatLngTuple = [Number(lat), Number(lon)];
  return lat !== "" && lat != null && finite(p) ? p : null;
};
