import { useEffect, useRef, type ReactNode } from "react";
import L, { type LatLngBoundsExpression, type LatLngExpression } from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export const BENGALURU: LatLngExpression = [12.9716, 77.5946];

const glyph = {
  plant: '<path d="M2 20h20"/><path d="M5 20V8l5 3V8l5 3V4h4v16"/>',
  drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
};

/** Map pins drawn in CSS + SVG so they match the UI (no image markers). */
export function pinIcon(kind: keyof typeof glyph, tone: "brand" | "success" | "ink" = "brand", color?: string) {
  return L.divIcon({
    className: "",
    html: `<div class="pin pin-${tone}"${color ? ` style="background:${color}"` : ""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph[kind]}</svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

/** Small coloured dot for dense layers (e.g. many orders). */
export function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span class="map-dot" style="--dot:${color}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export const liveDot = L.divIcon({ className: "", html: '<div class="pin-dot"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

export function MapFrame({ children, center = BENGALURU, zoom = 11, height, aspect, className = "", scrollZoom = false, zoomControl = true, interactive = true }: {
  children?: ReactNode; center?: LatLngExpression; zoom?: number; height?: number | string; aspect?: string;
  className?: string; scrollZoom?: boolean; zoomControl?: boolean; interactive?: boolean;
}) {
  return (
    <div className={`map ${className}`} style={{ height, aspectRatio: aspect }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollZoom}
        zoomControl={zoomControl}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        attributionControl
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {children}
      </MapContainer>
    </div>
  );
}

/** Fit to bounds whenever the key changes (new search, new data). */
export function FitBounds({ bounds, fitKey, maxZoom = 15, padRight = 0 }: { bounds: LatLngBoundsExpression | null; fitKey: string; maxZoom?: number; padRight?: number }) {
  const map = useMap();
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const userMoved = useRef(false);
  const padRightRef = useRef(padRight);
  padRightRef.current = padRight;

  useEffect(() => {
    userMoved.current = false;
    if (bounds) map.fitBounds(bounds, { paddingTopLeft: [48, 48], paddingBottomRight: [48 + padRight, 48], maxZoom, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // Layout can settle after the first fit (grid reflow, mobile stacking);
  // keep the data framed until the user takes over.
  useEffect(() => {
    const onUser = () => (userMoved.current = true);
    map.on("dragstart", onUser);
    map.getContainer().addEventListener("wheel", onUser, { passive: true });
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (!userMoved.current && boundsRef.current) map.fitBounds(boundsRef.current, { paddingTopLeft: [48, 48], paddingBottomRight: [48 + padRightRef.current, 48], maxZoom, animate: false });
    });
    ro.observe(map.getContainer());
    return () => {
      map.off("dragstart", onUser);
      map.getContainer().removeEventListener("wheel", onUser);
      ro.disconnect();
    };
  }, [map, maxZoom]);
  return null;
}

/** Leaflet measures its container once; tell it when layout changes. */
export function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}
