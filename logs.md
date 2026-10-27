# ReFlow — change log

All frontend and supporting backend changes made during the redesign and React migration.
Nothing in this log has been committed yet; every change is in the working tree.

---

## 1. Design system pass on the existing Flask templates

**Goal:** apply the rules in `skill.md` (Apple-style fluid design) so the UI stops looking basic or vibe-coded.

- Rewrote `static/design-system.css` as a real design system:
  - tokens for neutrals, one brand blue, status colours, radius, shadow and motion
  - one typeface, with tighter letter-spacing on large text
  - a quiet sidebar, a translucent top bar, flat cards and consistent buttons, inputs, tables and badges
  - instant press feedback, visible keyboard focus
  - support for reduced-motion, reduced-transparency and high-contrast settings
- Loaded the design system last in every template, so it controls the shared parts of each page.
- Replaced Unicode glyph icons (⌂ ▤ ◉ ⚙ ↪ •) and emoji used as icons with consistent SVG line icons.
- Removed the hard-coded Poppins font and standardised on one font import.
- Fixed a dark navbar on the tracking pages that turned white-on-white.
- Rebuilt the old landing page layout (later replaced by React, see §2).

## 2. Move to React (Vite + React 19 + TypeScript)

**New app:** `frontend/` (Vite, React Router, react-leaflet, lucide icons). `npm run build` writes the bundle to `static/app/`.

- **Toolchain:**
  - Node 24 LTS installed to `~/.local/node` (user space; checksum verified).
  - Packages installed through the official `registry.yarnpkg.com` mirror, because this network blocks `registry.npmjs.org`.
- **Shared components** (`frontend/src/components/`):
  - `AppShell`: collapsible sidebar (icon rail with tooltips, remembers its state), mobile drawer, translucent top bar
  - `UserMenu`: account menu with avatar, role, email, Dashboard, Profile and Sign out
  - `map.tsx`: Leaflet map frame, pins drawn in CSS/SVG (no image markers), auto-fit to data, resize handling
  - `ForecastChart`: smooth area chart with peak/average/total, axis and hover readout
  - `Fleet`: tanker illustration, fleet ring chart, vehicle cards
  - `OcemsGrid`: pH/BOD/COD/TSS tiles checked against permissible limits
  - `LocationPicker`: address search, current location, or click/drag a pin
  - `Dialog`, `ChatWidget` (Juno, uses the existing `/api/chat`) and UI primitives (badges, stats, empty states, segmented filters, toasts)
- **Shared logic** (`frontend/src/lib/`):
  - API helpers, session, toasts and formatting
  - `orders.ts`: one All / Active / Pending / Completed filter vocabulary for every role
  - `route.ts`: OSRM road routing with a straight-line fallback

### Pages now in React
| Route | Page |
|---|---|
| `/` | Landing |
| `/demand` | Find water (demand site) |
| `/supply` | Plant overview (STP operator) |
| `/tanker` | Tanker dashboard |
| `/tanker/reports` | Fleet & documents |
| `/profile` | Profile |
| `/stp/register` | Register a plant |
| `/tanker/register` | Tanker partner choice |
| `/tanker/register/independent`, `/tanker/register/contracted` | Tanker registration forms |

Still Flask/Jinja (with the shared design system): login, signup, admin, order tracking (`/track`, `/stp_track`, `/track_stp`), invoice, trip history, OCEMS details, registration status, request-water.

## 3. Backend changes (`app.py`)

- **SPA serving:** added `serve_spa()`, which serves the built React app for the routes above, and `wants_json()`, which detects requests sent by React with `fetch`.
- **New JSON endpoints:**
  - `GET /api/supply/overview`: plant, orders (now with delivery coordinates), forecast, pricing and transfers. An STP account tied to a plant always sees its own plant.
  - `GET /api/tanker/overview`: operator (selected fields only), offers and assignments, completed trips and vehicles.
  - `GET /api/tanker/reports`: fleet, counts and per-vehicle documents. Stored file paths are not exposed.
  - `GET /api/profile`: built from the visitor's own session only.
- **Refactors:** the supply, tanker and reports routes now share helper functions (`build_supply_context`, `build_tanker_context`, `build_tanker_reports_context`, `tanker_completed_trips`) instead of duplicating logic.
- **Registration:** STP and tanker registration now return JSON on success when React submits. Plain form posts still render the old success pages.
- **`/api/current_user`:** now also returns the user's email.
- **Privacy fix:** the old profile page read the user from the shared, server-wide Supabase client, so it could show whoever signed in last on the server. `/api/profile` uses only the visitor's own session.

## 4. Role pages

- **Demand (`/demand`):**
  - search by address, current location or map pin; minimum 5 KLD enforced inline
  - match card with road route and alternatives, distance, ETA, OCEMS readings and Place order
  - orders list in the side column with All / Active / Pending / Completed filters
- **Supply (`/supply`):**
  - full-width map at the top; "View info" on any order or transfer draws the road route on that map, with a details panel and Accept/Reject
  - stat cards, the new 7-day forecast chart, OCEMS readings with upload, editable pricing, and "Request water" from another plant
- **Tanker (`/tanker`):**
  - full-width map at the top with a live-trip control, and the two-stage route (base → plant → drop-off) with a details panel
  - jobs filtered All / Active / Pending / Completed, with an expiry countdown on offers
  - auto-refresh every 20 s, with a notice when a new offer arrives
  - illustrated fleet section
- **Fleet & documents (`/tanker/reports`):**
  - operator banner with a fleet-availability ring
  - fleet-capacity bar, document-compliance ring and service-radius graphic
  - vehicle cards with the tanker illustration and four document tiles (RC, insurance, PUC, permit), each with upload or replace
- **Profile (`/profile`):**
  - identity card, plus role details: order totals (demand), plant (STP), operator and map (tanker)
  - the misleading "Delete account" button (it only logged out) was removed
- **Registration:**
  - step-by-step forms with a coloured banner, progress checklist, map location picker and fleet stepper (1–15 vehicles)
  - inline validation and a success screen with a copyable ID
  - the plate-number check is deliberately loose so newer formats like BH-series plates still pass; the server's own checks are unchanged

## 5. Removed as having no use to the user

- Fake stat cards ("Smart Routing: Active", "STP Network: Available"), the fake "All systems operational" panel, Settings links that went nowhere, the "AI Assisted" label and the "Your STP Advantages" marketing card.
- Firebase push-notification code, which only had placeholder keys and never ran.
- The 2.6-second splash screen on every visit.
- Templates replaced by React or no longer rendered: `index`, `demand`, `supply`, `tanker`, `tanker_with_stp_tracking`, `chatbot`, `profile`, `stp_register`, `tanker_register`, `tanker_register_contracted`, `tanker_register_independent`, `tanker_reports`.
- Unused static files: `chatbot.css/js`, `tanker.css`, `script.js`, `firebase-messaging-sw.js`, `js/live_location.js`.

## 6. No AI images

- Deleted AI-generated images: the Juno robot avatar, the routing-map illustration, the clip-art icons (analyze, predict, optimize, efficiency, stp, wastewater-sources), `ocean.png`, the robot chatbot images and the old "J" app icon.
- Replaced them with real Leaflet maps, SVG line icons and hand-drawn SVG illustrations.
- `static/assets/logo.png` (the PROVIDENT logo) is a real company logo and was kept.

## 7. Landing page

- **Hero:** a soft multi-colour background with a gradient accent on the headline.
- **Map:** no zoom buttons, set in a rounded frame with floating glass chips ("plants live", "available today"); plant pins coloured by quality grade, with a legend.
- **Live figures:** plants, capacity and available water, computed from `/api/stps` instead of the old made-up numbers.
- **Sections:**
  - colour-coded "How it works" steps joined by a connector line
  - illustrated role cards
  - a gradient call-to-action band
  - About and Contact

## 8. Brand: ReFlow

- **Rename:** "PURVA - JalSetu" became **ReFlow** everywhere: UI, page titles, Flask headers, the chatbot prompt, comments, the package name and the server's user-agent string.
- **Wordmark:** set in **Sora**: "Re" in ink, "Flow" in the blue-to-teal gradient, with a lighter variant on dark backgrounds. Sora is used only for the name.
- **Logo** (`static/brand-mark.svg`, `frontend/public/favicon.svg`, `BrandMark.tsx`): a water drop drawn as one line that curls back into itself, with a small droplet separating off, on a blue-to-teal rounded square.
- **Side effect:** the sidebar collapsed/expanded preference was saved under the old name, so it resets once for each user.

## 9. Login page (`templates/login.html`)

- **Background:** a deep navy base with blue, teal and violet glows, a faint dot grid, and route lines joining plant nodes, with a moving "flow" dash that stays still under reduced motion. The routes are placed so they never cross the text.
- **Brand panel:** logo, wordmark, headline "Treated water, back in circulation." and three feature rows.
- **Sign-in card:**
  - a thin colour strip on top and icons inside the fields
  - a show/hide password toggle and a "Signing in" spinner
  - "Create an account", partner quick links and "Back to home"
- **Unchanged:** form field names, the form target and the server's messages. The page now also shows the "account deleted" message from the logout flow.

## 10. Bugs found and fixed along the way

- **Map markers with reduced motion:** with "reduce motion" turned on, the global CSS stopped Leaflet's zoom animation from finishing, so markers stayed in the wrong place. Leaflet is now excluded from that rule, in both stylesheets.
- **Map tiles:** CARTO map tiles started requiring an API key, so the maps now use standard OpenStreetMap tiles.
- **Map framing:** maps re-fit to their data when the layout settles (mobile stacking, panels opening).
- **Hidden content:** content no longer depends on fade-in animations to become visible.

## 11. Verification notes

- Every page was checked in a headless browser, logged in as each role, at desktop and phone widths.
- Order actions, document uploads and full registration submissions were **not** executed, because they would write to the real CSV files. Only error paths and read-only endpoints were exercised. Test each once on test data.
- In the sandboxed test browser, the Inter web font rendered as invisible text once it loaded. This looks like a sandbox quirk, but the font import was switched to standard (non-variable) Inter weights to be safe.
- `data/stp_data.json` and `database/orders.csv` already had uncommitted changes before this work began, and the app rewrites them at runtime. Review them before committing.

## 12. Git preference

- Commits must not credit Claude (no co-author or "Generated with" lines) and must not be signed. This is saved as a standing preference.
