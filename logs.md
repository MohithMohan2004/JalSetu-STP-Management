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

## 13. Invoice, OCEMS, admin and signup (2026-10-27)

- **Invoice pricing fixed:** water was billed at a hard-coded ₹30/KL, ignoring each plant's rate card. The rate now comes from the plant's base price, with the peak surcharge or off-peak discount applied by booking time. It is frozen on the order (`invoice_water_rate`, `invoice_tariff` in `orders.csv`), so later price edits never change an issued invoice. Orders booked before this keep the ₹30 they were quoted. GST is shown as CGST 9% + SGST 9%, amounts are rounded to paise, and the total is written out in words.
- **Invoice page:** a tax-invoice layout with an order timeline and print/PDF support. Pay buttons appear only while payment is actually due; a delivered order previously still said "Awaiting payment".
- **OCEMS loader bug:** the Excel files have an empty first column, so the company and station names showed as the labels "Company Name" / "Station Name", and "Parameter Name" was treated as a parameter. The loader now finds the label column. The page now uses the server's limits everywhere; the old page drew different CPCB limits than it enforced.
- **OCEMS page:** reading cards with gauge and sparkline, a trend chart per parameter (24 h / 3 days / all), compliance per parameter, data coverage, history with gap toggle, CSV download.
- **Admin security:** `/admin`, `/admin/add_stp`, `/admin/delete_stp/<id>` and both approve/reject routes had no login check. They now require `@login_required(role="admin")`.
- **Admin demand map:** an order-density gradient weighted by order size, with a "fewer → more orders" scale. Plants use the same plant pin as the React pages (`pinIcon("plant")`): brand blue with free capacity, faded ink when full. Plants at identical coordinates share one pin; hover shows the name and the popup lists each plant with a capacity bar.
- **OCEMS review page (`admin_ocems_view.html`):** rebuilt in light mode with the admin styling; the spreadsheet preview highlights the header rows and hides fully empty columns, and rejecting without a remark is caught inline (the server already requires one).
- **Admin page:** tabs (Overview, Plants, Approvals, Orders) on one page, driven by the URL hash so action redirects return to the same tab. Fake nav links and the "All systems operational" panel were removed; capacities are rounded; confirmations were added before delete/approve/reject.
- **Signup page:** matches the login page. Login's styles moved to `static/auth.css`, shared by both. It has role tiles, inline validation, a password-strength meter and keeps entered values after a server error.
- **Admin signup removed:** the signup form and `/api/signup` no longer accept the Admin role. Admin accounts are created directly in Supabase; existing admins still sign in normally.
- **Files changed:** `app.py`, `templates/{invoice,supply_ocems,admin,admin_ocems_view,signup,login}.html`, new `static/auth.css`.
- **Verified:** admin routes send logged-out users to `/login` and other roles to their own dashboard; posting `role=admin` to either signup endpoint returns "Please select a valid account type."; invoice math checked by hand (₹82 × 10 KL + ₹100 transport = ₹920, + ₹82.80 CGST + ₹82.80 SGST = ₹1,085.60), and peak (₹94) / off-peak (₹75) rates resolve correctly; the OCEMS loader returns the real company and station names. All pages were screenshotted at desktop and phone widths.
- **Not exercised** (they write real records): paying or choosing COD on an invoice, approving/rejecting an OCEMS report or registration, adding/deleting a plant, submitting signup. Test each once on test data.

## 14. Project cleanup (2026-10-27)

- **Templates:** 12 remain, and each is still rendered by a live route (login, signup, admin + operator details + OCEMS review, invoice, the three tracking pages, trip history, OCEMS details, tanker status). They go away only as each page moves to React.
- **Templates removed (4):**
  - `tanker_summary.html`: shown after Accept pickup / Accept transfer, which React now calls with `fetch`. Both routes now redirect to `/tanker`.
  - `registration_success.html`, `stp_registration_success.html`: no-JavaScript fallbacks. The React forms always took the JSON branch, so the registration routes now always return JSON and the `wants_json()` helper was removed.
  - `request_water.html`: nothing linked to the standalone page; requests are made from the Supply page. `/request-water` now redirects to `/supply`.
- **Files removed:** `app_backup_before_flutter_auth.py` (old copy of `app.py`), `tree.txt`, `tree_clean.txt`, `project_tree.txt` (stale listings), `Profile` (typo copy of `Procfile`), `database.zip`, `models.py` (unused SQLAlchemy model), root `models/` (stray copy of the first upload; the app loads `ml/models/`), `synthetic_bangalore_wastewater_dataset.csv`, `database/bangalore_tanker_operators_synthetic_updated.csv`, `database/stp_updates.csv`, `static/assets/logo.png` (no page used it), `__pycache__/`.
- **Moved:** dev scripts `check_project.py`, `generate_synthetic_orders.py` and `nearest_stp_routing.py` to `scripts/`, with paths fixed to resolve from the project root.
- **requirements.txt:** dropped `firebase-admin` and `Flask-SQLAlchemy`; nothing imports them.
- **Verified:** `scripts/check_project.py` passes; every page route was requested for each role with the Flask test client and returns the same status as before. Accept pickup/transfer were not run (they write records); they now return a redirect, which React's `postForm` follows as a success.

## 15. Juno on Ollama, STP accept fix, tanker pages, cleanup (2026-10-28)

- **Juno now runs on a local Ollama server** instead of Gemini. `chatbot/llm/gateway.py` points the `openai` client at Ollama's OpenAI-compatible API (`http://localhost:11434/v1`), uses JSON mode and `temperature=0`. Settings: `OLLAMA_BASE_URL`, `JUNO_LLM_MODEL` (default `llama3.2:3b`), `JUNO_LLM_TIMEOUT` (default 45 s). No API key is needed. If Ollama is down, Juno falls back to fuzzy matching as before. On this CPU-only machine a call takes about 9–15 s; the LLM only runs when fuzzy matching is unsure or a location is needed. `Procfile` sets gunicorn's `--timeout 120` so a slow reply can't kill the worker (default 30 s).
- **Bug: an order the STP accepted late never reached a tanker.** The 30-minute tanker-assignment deadline counted from when the buyer placed the order. Pending orders don't expire, so an STP could accept an order more than 30 minutes old, and `offer_next_operator_for_order()` then marked it `Expired` on the spot, before offering it to anyone. (Example: `ORD-7CFC162543`, placed 16:08, accepted 23:46.) The window now starts at STP acceptance (`assignment_window_start()` returns `accepted_at`, falling back to the creation time for old rows). All 8 deadline checks use it, for demand orders and plant transfers, including the per-offer expiry. Both Accept buttons on the Supply page (list row and "View info" panel) call the same endpoint, so both paths were affected.
- **Trip history moved to React** (`pages/TripHistory.tsx`). The old page was a text list with raw ISO timestamps and its own outdated sidebar. The new one has stat tiles (trips, KLD delivered, km hauled, in progress), a 30-day delivered-volume bar chart with hover, a routes map of every trip (click one to focus it), and trip cards with a pickup → drop-off journey line and an Assigned / Picked up / Delivered timeline, plus search and the shared order filter. Data comes from the new `/api/tanker/trips` (`build_trip_history()`, extracted from the old route). The route now also requires `login_required(role="tanker")`.
- **Registration status moved to React** (`pages/register/TankerStatus.tsx`, `POST /api/tanker/status`). It has a hero banner, a status stepper (Submitted → Under review → Approved / Not approved) and a next-step prompt. The old page's wordmark showed only "Flow" ("Re" was white on a white navbar). The lookup now ignores a `+91` prefix and refuses empty input; before, an empty ID and phone could match a row with both fields blank.
- **The other tanker pages** (dashboard, Fleet & documents, registration) already had the map, charts and tanker illustrations. They were checked with screenshots and left as they were.
- **Removed:** `templates/trip_history.html`, `templates/tanker_status.html` (replaced by React pages), `static/style.css` (nothing referenced it), dead `SQLALCHEMY_*` / `UPLOAD_FOLDER` settings in `config.py` (nothing read them; `static/uploads` and `database/app.db` don't exist), and the Flutter/Android sections of `.gitignore`.
- **Moved:** `database/tanker_locations_migration.sql` to `supabase/`. `database/` now holds only the app's runtime records.
- **Layout:** `app.py` + `config.py` (Flask), `chatbot/` (Juno), `ml/` (forecast models + training), `frontend/` (React source) → `static/app/` (build), `templates/` + `static/` (remaining Flask pages), `data/` (plant master data, pricing, synthetic demand), `database/` (runtime CSV/XLSX records), `uploads/` (uploaded OCEMS sheets and tanker PDFs), `scripts/` (dev scripts), `supabase/` (SQL to run in Supabase).
- **Verified** (in a scratch copy of the project, so the real CSVs were not touched): `check_project.py` passes; `npm run build` type-checks; all 37 parameterless GET routes for anonymous/demand/stp/tanker/admin return no 5xx. Full order lifecycle run with the test client: create → COD → STP accepts it 2 hours after it was placed → offered to OP-BLR-0003 → tanker accepts → picked up → delivered → appears in trip history, invoice renders. The same late accept against the old `app.py` produced `Expired` with no offer. Juno through `/api/chat`: "yo can u find me sum water near jayanagar" (fuzzy score 55) was resolved by Ollama to `nearest_stp` + Jayanagar and returned the nearest plant. Trip history and status pages were screenshotted at desktop and phone width.
