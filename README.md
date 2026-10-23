<img src="Image/naditown-logo.png" alt="NADITOWN" width="360" />

# NADITOWN — Adaptive Township Emergency Operating System

**Sime Darby Property University Hackathon 2026**
Theme: **People & Planet** · Focus: Smart Township, Flood Emergency Coordination, Climate Resilience
Pilot site: **Bandar Elmina (City of Elmina), Shah Alam, Selangor**

> NADITOWN is a flood-emergency command centre for a township. It gives one commander a single
> common operating picture — road conditions, shelter capacity, resident requests and route
> recalculations — and gives residents a simple mobile SOS channel that still works when the
> network is down.

**Everything in this repository is a simulation prototype.** It is a decision-support demonstrator,
not a field-verified route or a real-world safety assessment. In a real emergency, always call **999**.

---

## Contents

1. [What it is](#what-it-is)
2. [How to open it](#how-to-open-it)
3. [How to use it (5-minute tour)](#how-to-use-it-5-minute-tour)
4. [Roles and permissions](#roles-and-permissions)
5. [Resident SOS (mobile channel)](#resident-sos-mobile-channel)
6. [How it works](#how-it-works)
7. [Project structure](#project-structure)
8. [Simulation data and parameters](#simulation-data-and-parameters)
9. [Troubleshooting](#troubleshooting)
10. [Tech stack and requirements](#tech-stack-and-requirements)
11. [The team](#the-team)
12. [Attribution](#attribution)

---

## What it is

During a flash flood, township teams juggle several disconnected tools: a road-status sheet, a
shelter spreadsheet, phone calls from residents, and a map. NADITOWN pulls all of it into **one
screen** and makes every recommendation explainable.

It answers four questions a commander asks during an event:

| Question | How NADITOWN answers it |
| --- | --- |
| *Which roads are still passable?* | Colour-coded corridor map aligned to OpenStreetMap, with live status, water depth and hazard flags. |
| *Where can people go?* | Shelter capacity and intake for each approved evacuation centre (PPS), with availability limits. |
| *Who needs help right now?* | Resident SOS requests, prioritised, with allocation against **declared** stock only. |
| *What is the safest way to reach them?* | A route engine that compares a **Fastest** and a **Safest** corridor, avoiding closed roads and flood hazards, and explains the trade-off. |

Every action a commander takes — approvals, dispatches, role switches — is written to a **tamper-evident
SHA-256 audit chain** that can be verified and exported.

---

## How to open it

There are two entry points:

- **`dashboard.html`** — the command centre (desktop).
- **`resident.html`** — the resident SOS app (phone).

> `index.html` is an identical copy of `dashboard.html` kept in sync for tooling that expects an
> `index.html` root. Use either one.

### Option A — just double-click (fastest, zero setup)

1. Open the folder.
2. Double-click **`dashboard.html`**.
3. It opens in your browser in **offline fallback mode**. The dashboard, simulation, matching,
   approvals and the audit chain all work. Live map tiles and OpenStreetMap route alignment
   need internet, so those will use the built-in schematic road graph instead.

This is the quickest way to see the system. For the **full experience** (live map, OSM-aligned
routes, and the installable resident PWA), use Option B.

### Option B — run the small local server (recommended)

A dependency-free PowerShell server is included. It serves the correct MIME types and lets the
service worker and map tiles work properly.

1. Open **PowerShell** in this folder.
2. Run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\server.ps1
   ```

3. You will see `Server started on http://localhost:8080/`.
4. Open **<http://localhost:8080>** in **Chrome or Edge** for the command centre.
5. Open **<http://localhost:8080/resident.html>** for the resident app.

Press **Ctrl + C** in PowerShell to stop the server.

**No `npm install` and no build step are required** — NADITOWN runs as plain HTML, CSS and ES
modules. (You do not need Node.js unless you want to use an optional bundler.)

### Internet connection

- **Required for:** live map tiles (CartoDB / Esri), and OpenStreetMap route alignment via the
  public Valhalla/OSRM services.
- **Not required for:** the dashboard, simulation controls, resource matching, approvals, the audit
  chain, the resident SOS queue, and the fallback routing graph.
- If the network or the routing services are unavailable, NADITOWN automatically falls back to its
  built-in schematic road graph and clearly labels the result.

---

## How to use it (5-minute tour)

### The header

Across the top of the command centre you will find:

| Control | What it does |
| --- | --- |
| **Emergency level pill** | Current alert level (Green / Orange / Red). |
| **Guided demo** | Opens the built-in 6-step scripted tour with spotlight highlights. |
| **Resident SOS** | Opens the mobile resident app in a new tab. |
| **Demo tools** | Role switch, export situation report, pilot brief, verify audit chain, reset demo data. |
| **Live clock** | Malaysian time (UTC+8). |

### The five command pages

1. **📊 Operations Dashboard** — the common operating picture: road network status, shelter
   capacity and resources, citizen-request summary, and route-calculation verification.
2. **🗺️ Tactical Map & Simulation** — the OSM-aligned corridor map, the route planner
   (Fastest vs Safest), and the hydrology sandbox (rainfall, surge, flood-risk slider and
   scenario presets).
3. **📋 Reports & Operations** — decision support (high-impact actions awaiting authorization),
   the outstanding operations queue, and the verification & audit trail.
4. **🏥 Facility & Resource Coordination** — approved shelters, declared resources with allocation
   state, and the route-aware request matching and dispatch desk.
5. **🤝 Community Requests** — the resident-facing intake view and the community request board.

### Suggested demo flow

1. **Dashboard** — point out the four pillars on one screen, and the simulation disclaimer.
2. **Tactical Map** — open the route planner and switch between **Fastest** and **Safest**.
   Watch hazard exposure change the recommendation and the route geometry snap to OpenStreetMap.
3. **Simulation** — click the **Sector 2 Flash Flood** preset. A bridge closes and the route
   recalculates automatically.
4. **Coordination** — press **Auto-Match**. Each request is matched against declared stock and now
   reports distance, ETA, hazard segments and closures avoided.
5. **Dispatch** — dispatch a matched request (a Commander confirmation is required). The planned
   route and ETA are carried through, and the action is written to the audit trail.
6. **Reports** — approve a high-impact decision as Commander, then switch to **Auditor** in Demo
   tools to show the interface becoming read-only.
7. **Resident SOS** — open the mobile app, submit a request, then watch it appear in the command
   centre with the phone number masked.
8. **Verify** — open **Verify chain** to validate the SHA-256 audit log, and export the situation
   report.

### Demo tools menu

- **View as** — switch between Commander, Operator and Auditor.
- **Export situation report** — generates a print-ready SITREP in a new window.
- **Pilot and commercial brief** — the pilot framing and value summary.
- **Verify audit chain** — recomputes and validates the SHA-256 chain.
- **Open resident SOS** — the mobile channel.
- **Reset demo data** — restores the original fixtures and clears the resident queue.

State is stored in this browser (`localStorage`). Use **Reset demo data** to return to a clean state.

---

## Roles and permissions

NADITOWN enforces role-based control, not just labels. The role selector lives in **Demo tools →
View as**.

| Capability | Commander | Operator | Auditor |
| --- | :---: | :---: | :---: |
| View all pages and data | ✅ | ✅ | ✅ |
| Change road status / run simulation | ✅ | ✅ | ❌ |
| Match and dispatch resources | ✅ | ✅ | ❌ |
| Release an allocation | ✅ | ❌ | ❌ |
| Authorize high-impact decisions | ✅ | ❌ | ❌ |
| Verify and export audit trail | ✅ | ✅ | ✅ |

Attempted actions outside a role return a clear "not authorized" message and are recorded in the
audit log.

---

## Resident SOS (mobile channel)

`resident.html` is a lightweight, installable (PWA) resident app.

- **Bilingual** — Bahasa Melayu and English.
- **Works offline** — requests are queued on the device (`naditown.sosQueue.v1`) and sync when the
  command centre is available.
- **Location** — uses GPS if permitted, otherwise falls back to the sector centre.
- **Privacy** — phone numbers are **masked** in the command view (e.g. `******6789`).
- **Safety** — a prominent "Call 999" prompt is shown for immediate danger.

To try it: open **<http://localhost:8080/resident.html>** (via the server), fill in the form and
submit. Switch back to the command centre — the request appears in the Community Requests and
Coordination views within a few seconds.

To install it as an app, use your browser's **Install / Add to Home Screen** option (available when
served over `http://localhost`).

---

## How it works

NADITOWN is a single-page command centre backed by a reactive state store and an explainable
routing engine.

### State and persistence

- `store.js` is the single source of truth (a small observable state manager).
- The command centre state is persisted to `localStorage` under `naditown.operationalState.v1`.
- Resident requests are persisted under `naditown.sosQueue.v1` and imported by the command centre
  through a local demo queue (polled and via the `storage` event).

### Routing engine

- `route-engine.js` contains an 18-node township road graph and a Dijkstra solver.
- Road corridors are snapped to **OpenStreetMap** geometry via **Valhalla**, with **OSRM** as a
  fallback. Geometry is cached (`naditown.roadGeometry.v1`).
- Two cost models are produced for every query:
  - **Fastest** — optimises time, accepts hazard segments.
  - **Safest** — penalises flood hazards (hazard cost multiplier `2.5×`, +25 min penalty) and
    avoids closed roads.
- If the external services are unreachable, the engine returns the schematic graph result and the
  UI labels it as a fallback.

### Allocation and dispatch

- Available resource = `quantityTotal − quantityAllocated − quantityUnavailable`; allocations never
  exceed declared stock (no partial allocation).
- Matching is **route-aware**: it records the planned route, distance, ETA, hazard exposure and the
  closures avoided. Dispatch preserves that planned route and ETA.

### Verifiable audit

- `audit.js` computes a **SHA-256 hash chain**. Each entry stores `prevHash` and `auditHash`
  (`SHA256-…`).
- **Verify chain** recomputes the chain and reports the number of verified entries; **Export JSON**
  produces an audit pack, and the situation report can be generated for the commander.

---

## Project structure

```
naditown-prototype/
├── dashboard.html          # Command centre (served by default at http://localhost:8080/)
├── index.html              # Byte-identical copy of dashboard.html
├── resident.html           # Resident SOS mobile app (PWA)
├── server.ps1              # Dependency-free local web server (port 8080)
├── manifest.webmanifest    # PWA manifest for the resident app
├── sw.js                   # Service worker (offline resident app shell)
│
├── dashboard.js            # Command-centre UI: 5 pages, guided demo, roles, SITREP
├── map.js                  # Leaflet map engine: corridors, facilities, sensors, flood zones
├── store.js                # Reactive state, matching, dispatch, audit, resident import
├── route-engine.js         # Graph + Dijkstra + Fastest/Safest cost models
├── routing.js              # Routing API surface (findRoute, fetchRoadFollowingRoute)
├── audit.js                # SHA-256 audit-chain hashing
├── data.js                 # Township dataset (facilities, roads, sensors, requests, decisions)
├── fallback-data.js        # Generated dataset for file:// offline fallback
├── coordination-fallback.js# Classic-script fallbacks when ES modules are unavailable
├── main.js                 # Optional standalone entrypoint (equivalent to the inline bootstrap)
│
└── Image/                  # Logos and PWA icons
```

`index.html` / `dashboard.html` boot the app two ways: a modern **ES-module** path (the normal
case) and a **classic-script fallback** so the app still opens correctly when launched directly
from disk with `file://` and CORS is restricted.

---

## Simulation data and parameters

The prototype ships with a fixed, self-consistent dataset for Bandar Elmina:

| Item | Count |
| --- | --- |
| Facilities (PPS shelters, health, responders, logistics) | 8 |
| Road corridors | 6 |
| Water-level IoT sensors | 4 |
| Flood zones | 3 |
| Resident/emergency requests (fixtures) | 8 |
| Decision-support items | 4 |
| Declared resource types | 8 |
| Road-graph nodes | 18 |

Default route-planner example: **Elmina West Community Hall → SK Subang Bestari (Main Hall)**,
≈ **7.2 km / ~18 min** (Safest), with hazard segments and closures shown.

**Disclaimer shown in-app:** *"Simulation only — not a field-verified route or real-world safety
assessment."* All coordinates, capacities, road statuses and requests are demonstration data.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Map is grey / tiles missing | No internet. Tiles need connectivity; the rest of the app still works. |
| Route shows "schematic" / fallback | Valhalla/OSRM unreachable. This is expected offline; the graph result is used. |
| Resident request does not appear | The command centre imports from `localStorage`. Open both apps from the **same origin** (use `http://localhost:8080`, not a mix of `file://` and `localhost`). |
| "Install" option missing for resident app | PWA install needs `http://localhost` (Option B), not `file://`. |
| App looks stale after edits | Hard-refresh (Ctrl + Shift + R); the service worker may cache the resident shell. |
| Want a clean slate | **Demo tools → Reset demo data**. |

---

## Tech stack and requirements

- **Frontend:** vanilla HTML, CSS and ES modules — no framework, no build step.
- **Map:** [Leaflet](https://leafletjs.com/) 1.9.4 (loaded from CDN).
- **Routing:** custom Dijkstra engine + OpenStreetMap geometry via Valhalla/OSRM.
- **Crypto:** Web Crypto `SHA-256` for the audit chain.
- **Server:** PowerShell `System.Net.HttpListener` (`server.ps1`), no dependencies.
- **Browser:** a current **Chrome** or **Edge** is recommended. Also works in Firefox and Safari,
  with graceful fallbacks where a feature is unavailable.
- **Node.js / npm:** not required to run the prototype. `package.json` and `package-lock.json` are
  retained only for optional tooling.

---

## The team

Built by a five-person team for the **Sime Darby Property University Hackathon 2026**.

| Member | Name | Phone Number | Email | University |
| --- | --- | --- | --- | --- |
| Ahli 1 | **Salman Nurhakim Bin Sableh** (Team Leader) | 011-10260175 | salmansableh@gmail.com | UiTM Shah Alam |
| Ahli 2 | **Ana Batrisyia Binti Asaruddin** | 012-4250129 | batrisyiana729@gmail.com | UiTM Shah Alam |
| Ahli 3 | **Afiqah Alya binti Azile** | 011-60821675 | fiqalyaa2004@gmail.com | UiTM Shah Alam |
| Ahli 4 | **Muhammad Izzat Izzudin bin Anuar** | 011-23253147 | izzatanuar08@gmail.com | UiTM Shah Alam |
| Ahli 5 | **Aufa Yumna binti Mohd Zaki Sham** | 011-15402303 | aufayumena@gmail.com | UiTM Shah Alam |

---

## Attribution

Built as a smart-township flood-resilience prototype for **Bandar Elmina** (theme **People & Planet**).

- Dataset, map centre and facility names reference the real Bandar Elmina township for realism.
- Map tiles © OpenStreetMap contributors, CartoDB and Esri. Routing data © OpenStreetMap
  contributors (Valhalla / OSRM public services).
- All emergency data in this prototype is simulated.
