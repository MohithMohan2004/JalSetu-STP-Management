import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Built assets are served by Flask from /static/app/.
// In development, Vite proxies every non-asset request to Flask so
// session cookies and the existing JSON/form endpoints just work.
const FLASK = process.env.FLASK_URL ?? "http://localhost:10000";
const proxied = [
  "/api", "/static", "/create_order", "/handle_request", "/handle_transfer_request",
  "/request-water", "/upload_ocems_report", "/accept_pickup", "/reject_pickup",
  "/accept_transfer_pickup", "/reject_transfer_pickup", "/complete_transfer",
  "/tanker/order", "/tanker/respond_request", "/login", "/logout", "/signup",
  "/invoice", "/track", "/stp_track", "/track_stp", "/trip_history", "/tanker/reports",
  "/tanker/register", "/tanker/status", "/stp/register", "/profile", "/admin", "/supply_ocems",
];

export default defineConfig({
  plugins: [react()],
  base: "/static/app/",
  build: {
    outDir: "../static/app",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(proxied.map((p) => [p, { target: FLASK, changeOrigin: false }])),
  },
});
