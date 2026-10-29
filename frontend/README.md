# ReFlow web frontend

React 19 + TypeScript + Vite. Renders the landing page and the demand, STP and
tanker dashboards. Every other page is still a Flask/Jinja template.

## Develop

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, proxies API calls to Flask on :10000
```

Start Flask as usual (`python app.py`). Set `FLASK_URL` if it isn't on `:10000`.

## Build

```bash
npm run build        # typechecks, then writes the bundle to ../static/app/
```

Flask serves `static/app/index.html` for `/`, `/demand`, `/supply` and `/tanker`.
Commit `static/app/` after building so deployments without Node keep working.

## Layout

- `src/pages/`: one file per screen (Landing, Demand, Supply, Tanker)
- `src/components/`: app shell with collapsible sidebar, maps, dialogs, chat widget
- `src/lib/`: API helpers, session, toasts, formatting
- `src/styles/`: design tokens and shared UI styles
