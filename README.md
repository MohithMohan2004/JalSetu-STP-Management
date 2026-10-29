# ReFlow

ReFlow routes treated wastewater from sewage treatment plants (STPs) to demand sites in Bengaluru and coordinates the tankers that deliver it.

Treated water is a useful resource, but buyers rarely know which plant is nearby, whether its water meets quality limits, or how to get it delivered. ReFlow puts the three sides of that exchange on one platform:

| Role | Who they are | What they do in ReFlow |
|---|---|---|
| **Demand** | Buyers (construction sites, apartments, industry) | Find the nearest suitable plant, check its quality readings, place and track orders, pay invoices |
| **STP** | Plant operators | Accept or reject orders, set pricing, update capacity, upload OCEMS quality data, request water from other plants |
| **Tanker** | Delivery partners (independent or contracted) | Receive job offers, run the pickup → drop-off route, track trips, manage fleet and documents |
| **Admin** | Platform staff | Approve registrations and OCEMS reports, manage plants, watch demand on a map |

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Pages and routes](#pages-and-routes)
- [Data](#data)
- [Demand forecasting](#demand-forecasting)
- [Juno, the assistant](#juno-the-assistant)
- [Order lifecycle](#order-lifecycle)

## Features

**Demand**
- Search by address, current location or a map pin (minimum order is 5 KLD).
- A match card shows the road route with alternatives, distance, ETA and the plant's OCEMS readings.
- Orders list with All / Active / Pending / Completed filters, reorder, tracking and shareable tracking links.
- Invoices follow a tax-invoice layout with CGST 9% + SGST 9%, an order timeline, print/PDF, and pay-now or cash-on-delivery.

**STP (supply)**
- Map with the plant's orders; "View info" draws the delivery route and shows Accept/Reject.
- Stat cards, a 7-day demand forecast chart, editable pricing (base rate with peak surcharge and off-peak discount) and capacity updates.
- OCEMS quality data upload, with readings checked against the CPCB limits the server enforces.
- Plant-to-plant water transfer requests.

**Tanker**
- Dashboard with a live map, a two-stage route (base → plant → drop-off), job offers with an expiry countdown, and auto-refresh every 20 seconds.
- Trip history with stat tiles, a 30-day delivered-volume chart, a routes map and an Assigned / Picked up / Delivered timeline.
- Fleet and documents page (RC, insurance, PUC, permit per vehicle) with upload and replace.
- Step-by-step registration for independent and contracted operators, with a status lookup page.
- Live location sharing.

**Admin**
- Tabbed dashboard (Overview, Plants, Approvals, Orders) driven by the URL hash.
- Order-density heat map with STP pins on top.
- Approve or reject STP and tanker registrations and OCEMS reports.
- Add and delete plants.

**Platform**
- Juno, a chat assistant that finds plants, answers questions and resolves free-text requests.
- XGBoost demand forecasts per plant.
- Supabase authentication.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Flask (single `app.py`), Gunicorn |
| Auth | Supabase |
| Data storage | Postgres (Supabase) through SQLAlchemy when `DATABASE_URL` is set, otherwise CSV/JSON files under `database/` and `data/`. Uploads stay in `uploads/` |
| Forecasting | XGBoost, scikit-learn, pandas, NumPy |
| Routing and geo | OSMnx, NetworkX, Haversine distance, OpenStreetMap |
| Assistant | Ollama (`llama3.2:3b`) through the `openai` client, with RapidFuzz fuzzy matching |
| Frontend (React pages) | React 19, TypeScript, Vite, React Router 7, React-Leaflet, lucide-react |
| Frontend (remaining pages) | Jinja templates styled by `static/design-system.css` |

## Project layout

```
app.py                 Flask application (routes, business logic, JSON APIs)
config.py              Settings read from environment variables
store.py               Postgres storage for the data files (used when DATABASE_URL is set)
Procfile               gunicorn app:app --timeout 120
requirements.txt       Python dependencies

chatbot/               Juno: fuzzy matcher and the Ollama LLM gateway
ml/                    Demand forecasting: dataset, preprocessing, training, prediction
  models/              One trained XGBoost model per plant (xgboost_PSTP001..014.pkl)
frontend/              React source (Vite). Builds into static/app/
static/                Design system CSS, brand mark, and the built React app (static/app/)
templates/             Jinja pages still rendered by Flask
data/                  Plant master data, pricing, synthetic demand
database/              Runtime records (orders, registrations, vehicles, OCEMS submissions, users)
uploads/               Uploaded OCEMS sheets and tanker documents
scripts/               Dev scripts (project check, synthetic orders, nearest-STP routing)
supabase/              SQL to run in Supabase (tanker locations migration)
```

## Getting started

### Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer (only needed to change the frontend)
- A Supabase project (URL and key) for authentication
- Optional: [Ollama](https://ollama.com) with `llama3.2:3b` for Juno's LLM fallback

### 1. Backend

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the project root (see [Configuration](#configuration)), then:

```bash
python app.py          # http://localhost:10000 (set PORT to change)
```

For production the `Procfile` runs `gunicorn app:app --timeout 120`. The longer timeout stops a slow Juno reply from killing the worker.

Flask caches templates when it is not in debug mode, so restart it after editing a template.

### 2. Frontend (only when changing React code)

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173, proxies API calls to Flask on :10000
npm run build          # typechecks, then builds into ../static/app
```

Set `FLASK_URL` if Flask is not on port 10000. The built bundle in `static/app/` is committed, so deployments do not need Node. Run `npm run build` and commit `static/app/` after any frontend change.

### 3. Optional: Juno's LLM

```bash
ollama pull llama3.2:3b
ollama serve
```

Without Ollama, Juno still works through fuzzy matching.

### 4. Check the project

```bash
venv/bin/python scripts/check_project.py
```

A quick static check of `app.py`, the templates and the CSV files.

## Configuration

Environment variables, loaded from `.env`:

| Variable | Required | Purpose |
|---|---|---|
| `FLASK_SECRET_KEY` | Yes | Signs session cookies. The fallback in `config.py` is for local use only, so set a real value in production |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase API key |
| `DATABASE_URL` | No | Postgres connection string. When set, orders, registrations, vehicles, transfers, OCEMS submissions, pricing, plant data and profile edits are stored in Postgres. Without it the app uses the local files |
| `DATABASE_SCHEMA` | No | Postgres schema for those tables (default `reflow`) |
| `PORT` | No | Port for `python app.py` (default 10000) |
| `OLLAMA_BASE_URL` | No | Ollama's OpenAI-compatible endpoint (default `http://localhost:11434/v1`) |
| `JUNO_LLM_MODEL` | No | Model Juno uses (default `llama3.2:3b`) |
| `JUNO_LLM_TIMEOUT` | No | Seconds to wait for the LLM (default 45) |

Never commit `.env`.

**Admin accounts** are created directly in Supabase. The public signup only accepts `demand`, `stp` and `tanker`.

## Pages and routes

### React pages (served from `static/app/`)

| Route | Page |
|---|---|
| `/` | Landing |
| `/demand` | Demand dashboard |
| `/supply` | STP dashboard |
| `/tanker` | Tanker dashboard |
| `/tanker/reports` | Fleet and documents |
| `/trip_history` | Trip history |
| `/profile` | Profile |
| `/stp/register` | STP registration |
| `/tanker/register`, `/tanker/register/independent`, `/tanker/register/contracted` | Tanker registration |
| `/tanker/status` | Registration status lookup |

### Flask (Jinja) pages

`/login`, `/signup`, `/admin` (and its sub-pages), `/track`, `/stp_track`, `/track_stp`, `/supply_ocems`, `/invoice`.

### JSON endpoints used by the React pages

`/api/supply/overview`, `/api/tanker/overview`, `/api/tanker/reports`, `/api/tanker/trips`, `/api/tanker/status` (POST), `/api/profile`, `/api/current_user`, `/api/stps`, `/api/my_orders`, `/api/demand_heatmap`, `/api/order_tracking/<id>`, `/api/stp_pricing/<stp_id>`, `/api/chat`, and others. The form endpoints (`/handle_request`, `/accept_pickup`, `/create_order`, …) redirect on success and return a short text error on failure. Registration endpoints always return JSON.

`app.py` defines more than 80 routes. `grep -n "@app.route" app.py` lists them all.

## Data

### Postgres

Set `DATABASE_URL` to keep the app's records in Postgres, so every machine and deployment shares the same orders and registrations. For Supabase, copy the **Session pooler** connection string from *Project Settings → Database* and fill in the database password.

Then copy the existing records in, once, from the machine that has them:

```bash
venv/bin/python scripts/migrate_to_postgres.py
```

The script leaves the local files untouched and skips any table that already has rows (pass `--force` to replace them). Start the app afterwards.

`store.py` keeps one table per CSV file (one text column per CSV column, in the `reflow` schema, which Supabase's REST API does not expose) plus a `json_documents` table for the JSON files. New CSV columns are added automatically. Uploaded files (`uploads/`, `database/ocems/`) and the synthetic and ML datasets stay on disk.

### Files

Without `DATABASE_URL`, plain files act as the datastore. The app rewrites the runtime ones while it runs. Files holding user data (orders, registrations, vehicles, users, uploads) are not part of the repository; the app creates empty ones on first start.

| Location | Contents |
|---|---|
| `data/stp_data.json` | Plant master data (rewritten by the app) |
| `data/stp_pricing.csv`, `database/stp_pricing.csv` | Per-plant rate cards |
| `data/synthetic_demand.csv`, `ml/` | Synthetic demand used to train the forecasts |
| `database/orders.csv` | All orders (runtime data) |
| `database/stp_registrations.csv`, `database/tanker_registrations.csv` | Registration records |
| `database/tanker_vehicles.csv`, `database/tanker_vehicle_documents.csv` | Fleet and document records |
| `database/stp_transfers.csv` | Plant-to-plant transfers |
| `database/ocems_submissions.csv`, `database/ocems/*.xlsx` | OCEMS submissions and the approved sheets |
| `uploads/` | Uploaded OCEMS sheets and tanker PDFs |

Notes:
- **OCEMS Excel files** have an empty first column. The loader finds the "Company Name" label column, so don't hard-code column 0.
- **Invoice rates** are frozen on the order when the draft is created (`invoice_water_rate`, `invoice_tariff`). Later price changes never alter an issued invoice.
- `supabase/tanker_locations_migration.sql` must be run in Supabase for live tanker locations.

## Demand forecasting

`ml/` holds one XGBoost regressor per plant (14 plants, `PSTP001`–`PSTP014`).

- `ml/generate_dataset.py` builds a synthetic dataset.
- `ml/preprocess.py` loads and prepares the data.
- `ml/train_model.py` trains the models and writes them to `ml/models/`, reporting MAE, RMSE and R².
- `ml/predict_demand.py` predicts next-day and 7-day demand. The Supply page charts the 7-day forecast.

To retrain: `cd ml && python train_model.py`. The app loads models from `ml/models/` only.

## Juno, the assistant

Juno is the chat widget on the dashboards, served by `POST /api/chat`.

1. It tries fuzzy matching (RapidFuzz) first.
2. When fuzzy matching is unsure, or a location has to be extracted, it asks the local Ollama model (`chatbot/llm/gateway.py`) for a JSON intent and entities.
3. If Ollama is down, it falls back to fuzzy matching alone.

On a CPU-only machine an LLM call takes roughly 9–15 seconds. For example, "yo can u find me sum water near jayanagar" resolves to a nearest-plant lookup for Jayanagar.

## Order lifecycle

1. The buyer creates an order (`/create_order`) and chooses pay-now or COD.
2. The STP accepts or rejects it. Accepting starts the 30-minute tanker-assignment window (it counts from acceptance, not from when the order was placed).
3. The order is offered to tanker operators one at a time, each offer with its own expiry. If nobody accepts, it expires.
4. The tanker accepts, picks up at the plant and delivers to the site.
5. The order appears in trip history and the invoice is available to pay or confirm.

Plant-to-plant transfers follow the same assignment flow.
