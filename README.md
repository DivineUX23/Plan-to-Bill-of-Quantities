# PlanToBOQ: Intelligent Architectural Taking-Off & BESMM4 BOQ Engine

[![Live App](https://img.shields.io/badge/Live%20App-Vercel-success?style=flat&logo=vercel)](https://plan-to-bill-of-quantities.vercel.app/)
[![API Status](https://img.shields.io/badge/API%20Live-Render-46E3B7?style=flat&logo=render)](https://plantoboq-api.onrender.com/health)
[![Swagger Docs](https://img.shields.io/badge/Swagger%20Docs-FastAPI-009688?style=flat&logo=fastapi)](https://plantoboq-api.onrender.com/docs)
[![CI Tests](https://img.shields.io/badge/tests-8%20passed-success)](backend/tests)
[![Python](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg)](https://www.typescriptlang.org/)
[![Measurement Standard](https://img.shields.io/badge/Standard-NIQS%20BESMM4%20%2F%20NRM2-1E3A8A.svg)](https://niqs.org.ng/)

> **PlanToBOQ** is an end-to-end Quantity Surveying and Architectural Measurement platform that bridges the gap between raw architectural floor plans (CAD vector PDFs, scans, blueprints) and production-grade **Bills of Quantities (BOQ)** compliant with the **Nigerian Institute of Quantity Surveyors (NIQS) BESMM4** (NRM2 / SMM7 adaptation).

---

> 🚀 **Live Production Deployments:**
> - **Live Web Studio (Vercel)**: [https://plan-to-bill-of-quantities.vercel.app/](https://plan-to-bill-of-quantities.vercel.app/)
> - **Live REST API (Render)**: [https://plantoboq-api.onrender.com/](https://plantoboq-api.onrender.com/)
> - **Interactive Swagger Docs**: [https://plantoboq-api.onrender.com/docs](https://plantoboq-api.onrender.com/docs)
> - **Health Check**: [https://plantoboq-api.onrender.com/health](https://plantoboq-api.onrender.com/health)

---

## Table of Contents

- [Live Deployments & Endpoints](#live-deployments--endpoints)
- [Overview & The Problem It Solves](#overview--the-problem-it-solves)
- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Engineering Highlights & Technical Rigor](#engineering-highlights--technical-rigor)
- [Step-by-Step User Guide](#step-by-step-user-guide)
- [Local Setup & Quickstart](#local-setup--quickstart)
- [Automated Testing](#automated-testing)
- [Cloud Deployment (Render + Vercel)](#cloud-deployment-render--vercel)
- [Contributing Guidelines](#contributing-guidelines)
- [License](#license)

---

## Live Deployments & Endpoints

| Resource | Service | URL | Description |
| :--- | :--- | :--- | :--- |
| **Web Application** | Vercel | [`plan-to-bill-of-quantities.vercel.app`](https://plan-to-bill-of-quantities.vercel.app/) | Interactive Taking-Off Studio & BESMM4 BOQ Suite |
| **REST API Root** | Render | [`plantoboq-api.onrender.com`](https://plantoboq-api.onrender.com/) | FastAPI backend web service |
| **Interactive API Docs** | Swagger UI | [`plantoboq-api.onrender.com/docs`](https://plantoboq-api.onrender.com/docs) | Interactive API playground & schema definitions |
| **ReDoc Documentation** | ReDoc | [`plantoboq-api.onrender.com/redoc`](https://plantoboq-api.onrender.com/redoc) | Alternate structured API documentation |
| **API Health Check** | JSON | [`plantoboq-api.onrender.com/health`](https://plantoboq-api.onrender.com/health) | Uptime monitoring & status probe |
| **BESMM4 Clause Reference** | JSON | [`plantoboq-api.onrender.com/api/besmm4/reference?code=1.14:2.1.1`](https://plantoboq-api.onrender.com/api/besmm4/reference?code=1.14:2.1.1) | Dynamic classification & page lookup |
| **BESMM4 PDF Stream** | Application/PDF | [`plantoboq-api.onrender.com/api/besmm4/pdf`](https://plantoboq-api.onrender.com/api/besmm4/pdf) | In-browser streaming of 509-page NIQS standard |

---

## Overview & The Problem It Solves

In traditional civil engineering and quantity surveying workflows:
1. **Manual Measurement is Slow**: Estimators manually measure wall girths, floor areas, and window/door openings using scale rulers or desktop CAD overlays, taking hours or days per drawing.
2. **Formula & Calculation Errors**: Complex deductions (e.g. subtracting abutting wall thicknesses at T-junctions, deducting door/window voids $\le 0.50\,\text{m}^2$ per standard rules) introduce human error.
3. **Manual BOQ Compilation**: Converting measurements into formal bill items, looking up standard classification clauses, and entering unit rates is fragmented across static spreadsheets.

**PlanToBOQ automates this entire pipeline:**
$$\text{Architectural PDF/Drawing} \longrightarrow \text{Computational Geometry Engine} \longrightarrow \text{Interactive Taking-Off Studio} \longrightarrow \text{NIQS BESMM4 Elemental BOQ}$$

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER (React 19 + TypeScript + Vite)           │
│                                                                                        │
│   ┌─────────────────────────────┐  ┌───────────────────────────┐  ┌──────────────────┐ │
│   │   Interactive Canvas Studio │  │   Elemental BOQ Studio    │  │ BESMM4 PDF Panel │ │
│   │   • Konva.js Hardware Accel │  │   • Live Recalculation    │  │ • 509-Page Sync  │ │
│   │   • Sub-pixel Snapping      │  │   • Multi-Currency Rates  │  │ • Clause Lookup  │ │
│   │   • Wheel Zoom & HUD Pan    │  │   • Timesing / Squaring   │  │ • Inline Viewer  │ │
│   └──────────────┬──────────────┘  └─────────────┬─────────────┘  └────────▲─────────┘ │
└──────────────────┼───────────────────────────────┼─────────────────────────┼───────────┘
                   │ REST API                      │ Export Downloads        │ Stream PDF
┌──────────────────▼───────────────────────────────▼─────────────────────────▼───────────┐
│                                  APPLICATION LAYER (FastAPI + Python 3.12)             │
│                                                                                        │
│   ┌─────────────────────────────┐  ┌───────────────────────────┐  ┌──────────────────┐ │
│   │  Ingestion & Detection      │  │  Computational Geometry   │  │  BESMM4 Rules    │ │
│   │  • PyMuPDF Vector Parser    │  │  • Shapely 2.0 Polygons   │  │  • Clause 1.14.02│ │
│   │  • OpenCV Edge Fallback     │  │  • Mitred Offset Engine   │  │  • Rounding 1.5.3│ │
│   │  • Two-Point Calibration    │  │  • T/Cross Junction Net   │  │  • 6 Bills Engine│ │
│   └──────────────┬──────────────┘  └─────────────┬─────────────┘  └────────┬─────────┘ │
│                  └───────────────────────┬───────┘                         │           │
│                                          ▼                                 ▼           │
│                           ┌─────────────────────────────┐  ┌─────────────────────────┐ │
│                           │  Export & Report Engine     │  │ Persistence Layer       │ │
│                           │  • OpenPyXL (Multi-Tab Xlsx)│  │ • PostgreSQL (Render)   │ │
│                           │  • Dynamic `=SUM` Formulas  │  │ • SQLite (Local Dev)    │ │
│                           │  • Print/PDF HTML Generator │  │ • SQLAlchemy 2.0 Async  │ │
│                           └─────────────────────────────┘  └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Interactive Taking-Off Studio (`/projects/:id`)
* **Precision Canvas**: Powered by HTML5 Canvas & Konva.js with pointer-centered mouse wheel zooming, middle-click panning, spacebar pan, and HUD directional navigation.
* **Metric & Architectural Grid**: Metric grid with live coordinate indicators and configurable snap-to-grid (`G` key).
* **Wall Tracing & Editing**:
  * Trace external walls (green) and internal partition walls (amber).
  * Whole-wall drag-and-move with generous hit areas ($24\,\text{px}+$ tolerance).
  * Midpoint handle splitters (`+`) to insert vertices into existing walls.
  * Orthogonal constraints (Hold `Shift` for true $0^\circ, 90^\circ, 180^\circ, 270^\circ$).
* **Room Polygons & Deductions**: Enclosed room polygon tracing with real-time area squaring ($\text{m}^2$) and perimeter girth ($\text{m}$).
* **Openings Schedule**: Click-to-place doors and windows along walls with automated width deductions from wall elevations.
* **Interactive Plan Legend**: Floating hero guide explaining every line color, element type, live counts, and taking-off functions (`L` key).

### 2. NIQS BESMM4 BOQ Studio (`/projects/:id/boq`)
* **Strict NIQS Clause 1.14.02 Coding**: Every item displays its official hierarchical classification code (`1.WS:C1.C2.C3`), such as `1.5:3.1.1` (Trench Excavation) or `1.14:2.1.1` (Superstructure 225mm Sandcrete Blockwork).
* **6 Elemental Bills Structure**:
  * **Bill 1**: Preliminaries & General Items (Work Section 1)
  * **Bill 2**: Substructure (Site clearance, excavation, hardcore, blinding, strip footings, ground slab, foundation blockwork, DPC, DPM)
  * **Bill 3**: Superstructure (Lintels, ring beams, reinforcement, formwork, external 225mm walling, internal 150mm walling, timber roof truss, 0.55mm aluminium roofing sheets, doors & windows)
  * **Bill 4**: Finishes (Plaster, render, vitrified floor tiles, emulsion and texcote painting)
  * **Bill 5**: Building Services (Plumbing, sanitary appliances, foul drainage, electrical installations)
  * **Bill 6**: External Works & Provisional Sums (Inspection chambers, interlocking paving, perimeter aprons, testing, statutory connections)
  * **Grand Summary**: Subtotal 1, Physical & Price Contingencies ($5\%$), Subtotal 2, Statutory VAT ($7.5\%$), and Total Tender Sum.
* **BESMM4 Rule 1.5.3 Rounding Engine**: Reinforcement and structural steel in Tonnes ($\text{t}$) to 2 decimal places; all other quantities rounded to the nearest whole unit (minimum 1 unit). One-click toggle between BESMM4 Whole Units and 2 Decimal Places.
* **Live In-Place Rate Editing**: Modify any unit rate inline; item amounts, bill subtotals, contingency sums, VAT, and grand totals recalculate instantaneously.
* **Multi-Currency Support**: Switch between **₦ NGN**, **$ USD**, **£ GBP**, and **€ EUR**.

### 3. Integrated BESMM4 PDF Reference Viewer
* **Direct Clause-to-Page Sync**: Clicking any BESMM4 code badge in the BOQ table immediately opens the **NIQS BESMM4 Reference Side Panel** and scrolls the official 509-page document directly to that work section's tabulated classification table.
* **Measurement Rules Card**: Collapsible breakdown displaying the Work Section, 1st/2nd/3rd division classifications, and governing measurement rules (e.g. *Rule M6: voids not exceeding 0.50 m² are not deducted*).
* **PDF Navigation**: Quick jumps to Clause 1.14.02 (Page 20), Section Tables, Table of Contents (Page 4), direct page input, and full-screen split view toggle.

### 4. Traditional QS Dimension Sheet (Squaring)
* Traditional taking-off grid supporting timesing syntax (e.g. `2/`, `2/3/`), dimension entries (Length, Breadth, Depth/Height), automated squaring math, and one-click conversion into BOQ line items.

### 5. Multi-Format Production Exports
* **Excel Workbook (`.xlsx`)**: Formatted multi-tab workbook with Cover Sheet, Grand Summary, and individual sheets for Bills 1 through 6. Uses live Excel formulas (`=Qty*Rate`, `=SUM(...)`, cross-sheet references) rather than hardcoded static values.
* **Print / PDF-Ready HTML**: Clean tabular typography with standard QS double underlines, print pagination (`page-break`), and client metadata.

---

## Engineering Highlights & Technical Rigor

This repository was designed with production software engineering standards:

* **Computational Geometry via Shapely 2.0**:
  * Wall centerline girths are computed using polygon mitred offsets, resolving corner overlaps and ensuring external wall perimeters account for wall thickness.
  * Abutting wall intersections at T-junctions and cross-junctions are subtracted using polygon spatial differences to prevent double-counting wall quantities.
* **Vector-First Ingestion**:
  * Uses PyMuPDF (`fitz`) to extract raw PDF vector primitives (lines, rectangles, Bézier curves) directly from CAD exports.
  * Bypasses slow and noisy OCR/rasterization whenever vector data is available.
* **Sub-Pixel Canvas Architecture**:
  * React Konva rendering optimized with layer separation (background sheet layer, static geometry layer, interactive selection/drag layer) to maintain $60\,\text{FPS}$ performance during zooming and dragging.
* **Full Audit Trail**:
  * Every quantity in the BOQ carries an audit calculation trace (e.g. `Length: 35.24m × Height: 2.70m - Openings: 6.30m² = 88.85m²`) providing explainability for commercial quantity surveying audits.
* **Test-Driven Design**:
  * Comprehensive test suite (`pytest`) testing geometric calculations, corner offsets, squaring formulas, and end-to-end API workflows.

---

## Step-by-Step User Guide

### 1. Create a Project
1. Open the dashboard at [https://plan-to-bill-of-quantities.vercel.app/](https://plan-to-bill-of-quantities.vercel.app/) (or `http://localhost:5173` locally).
2. Click **Create Project**, enter the Project Name (e.g. *3-Bedroom Executive Bungalow*), Client Name, and Site Location.

### 2. Upload and Calibrate Drawing
1. Click into the project $\rightarrow$ select **Upload Plan**.
2. Select an architectural PDF or image (`.pdf`, `.png`, `.jpg`).
3. Click **Calibrate Scale** on the toolbar:
   * Click any dimensioned wall line (e.g. from bedroom corner to corner).
   * Enter the real-world distance (e.g. `4.2m` or `4200mm`).
   * The system automatically calculates the pixels-to-meters scale ratio.

### 3. Trace and Review Elements
1. Select **External Wall** (Green) or **Internal Wall** (Amber) and click along wall paths.
2. Hold `Shift` while drawing to lock orthogonal ($90^\circ$) angles.
3. Use the **Select** tool (`V`) to drag entire walls or reposition vertices.
4. Add doors and windows by selecting their respective tools and clicking on wall lines.
5. Press `L` to toggle the **Live Plan Legend** and review line colors and counts.

### 4. Review Quantities and Generate BOQ
1. Click **View Takeoff Summary** to inspect net wall lengths, ceiling areas, and opening deductions.
2. Click **Generate BOQ** (or open the **BOQ** tab):
   * Inspect Bills 1 through 6.
   * Click any **BESMM4 Code** badge (e.g. `1.14:2.1.1`) to inspect the official standard in the slide-out viewer.
   * Tweak unit rates directly inline to match your local supplier pricing.
3. Click **Excel (.xlsx)** or **Print / PDF** to export your final tender package.

---

## Local Setup & Quickstart

### Prerequisites
* **Python**: 3.11 or 3.12
* **Node.js**: 18.x, 20.x, or 22.x
* **Git**: Installed on your system

### Quick Launch Scripts (Windows)
If you are on Windows, simply double-click:
* `run_all.bat` — Starts both backend and frontend concurrently in separate terminal windows.
* `run_backend.bat` — Starts only the FastAPI backend server.
* `run_frontend.bat` — Starts only the Vite frontend dev server.

---

### Manual Setup (macOS / Linux / Windows)

#### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python -m venv .venv

# Windows (Command Prompt / PowerShell):
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
* **API Documentation**: Swagger UI is accessible at `http://localhost:8000/docs`
* **Health Check**: `http://localhost:8000/health`

#### 2. Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
* **Web App**: Accessible at `http://localhost:5173`

---

## Automated Testing

The backend includes a comprehensive automated test suite covering quantities calculation, wall body net lengths, polygon mitre offsets, rounding conventions, and API workflows:

```bash
# Run tests with pytest
backend\.venv\Scripts\python.exe -m pytest -v backend/tests

# Output:
# backend/tests/test_backend.py::test_wall_body_and_net_lengths PASSED
# backend/tests/test_backend.py::test_closed_external_wall_mitre_offset PASSED
# backend/tests/test_backend.py::test_quantities_substructure_and_finishes PASSED
# backend/tests/test_backend.py::test_full_api_workflow PASSED
# backend/tests/test_boq.py::test_besmm4_rounding_rules PASSED
# backend/tests/test_boq.py::test_raw_takeoff_squaring PASSED
# backend/tests/test_boq.py::test_boq_generation_and_export PASSED
# backend/tests/test_boq.py::test_boq_api_endpoints PASSED
# ======================== 8 passed in 5.97s ========================
```

Frontend type-checking and production bundling:
```bash
cd frontend
npm run build
# Runs `tsc -b && vite build` (builds cleanly with 0 TypeScript errors)
```

---

## Cloud Deployment (Render + Vercel)

PlanToBOQ is deployed and running live:
* **Frontend**: [https://plan-to-bill-of-quantities.vercel.app/](https://plan-to-bill-of-quantities.vercel.app/)
* **Backend**: [https://plantoboq-api.onrender.com/](https://plantoboq-api.onrender.com/)

### Production Configuration

1. **Backend on Render**:
   * Uses [`render.yaml`](render.yaml) infrastructure specification.
   * Root Directory: `backend`
   * Build Command: `pip install -r requirements.txt`
   * Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   * Environment Variables:
     * `CORS_ORIGIN_REGEX`: `^https://.*\.vercel\.app$`
     * `CORS_ORIGINS`: `https://plan-to-bill-of-quantities.vercel.app,http://localhost:5173`
     * `DATABASE_URL`: Managed PostgreSQL connection string (auto-normalized to `postgresql+psycopg://`).

2. **Frontend on Vercel**:
   * Framework: `Vite`
   * Root Directory: `frontend`
   * Build Command: `npm run build`
   * Output Directory: `dist`
   * Environment Variable:
     * `VITE_API_URL`: `https://plantoboq-api.onrender.com`
   * SPA client-side routing rewrites configured via [`frontend/vercel.json`](frontend/vercel.json).

---

## Contributing Guidelines

Contributions from Quantity Surveyors, civil engineers, and software developers are warmly welcome!

### How to Contribute
1. **Fork the Repository**: Click the **Fork** button on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/nrm2-rules-expansion
   ```
3. **Make Your Changes**:
   * Adhere to PEP 8 conventions in `backend/` and ESLint/Prettier standards in `frontend/`.
   * Ensure any new BOQ calculation rules include corresponding audit calculation traces.
4. **Run Tests**:
   ```bash
   pytest backend/tests
   cd frontend && npm run build
   ```
5. **Submit a Pull Request**: Provide a clear description of the problem solved and test evidence.

### Roadmap & Ideas for Contributions
- [ ] Multi-story / multi-floor plan synchronization (Ground Floor + First Floor cumulative BOQ).
- [ ] Integration of AI Vision model (Gemini 2.5 Flash / GPT-4o) for automated text schedule OCR.
- [ ] Support for CESMM4 (Civil Engineering Standard Method of Measurement) for road and infrastructure projects.
- [ ] Export to IFC / BIM compatible formats.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
