# 🛰️ GeoSync

> **AI-Powered Spatial Middleware for Land Boundary Harmonization**

GeoSync is an intelligent geospatial platform designed to solve one of the biggest challenges in land administration: matching decades-old, distorted paper cadastral maps (*BhuNaksha*) with modern, high-resolution (5cm) drone surveys (*NAKSHA*). 

By combining computer vision, deep learning, and spatial databases, GeoSync automates map alignment, detects real physical boundaries, eliminates topological errors, and issues official 14-digit **Bhu-Aadhaar (ULPIN)** parcel IDs.

---

## 🚀 Core Features

### 1. Dual-Stage Map Alignment & Rubber-Sheeting
- **Global Alignment:** Uses OpenCV feature matching (ORB) and RANSAC homography to quickly orient, scale, and rotate legacy paper maps against drone orthomosaics.
- **Thin-Plate Splines (TPS) Warping:** Allows surveyors to drop Ground Control Points (GCPs) on landmarks to mathematically stretch and correct non-linear physical paper shrinkage.

### 2. AI-Powered Boundary Extraction (GeoSAM)
- Uses Meta's **Segment Anything Model (SAM)** to delineate real-world physical boundaries (compound walls, fences, field bunds, and buildings) directly from drone imagery.
- **Occlusion & Shadow Detection:** Automatically flags tree cover, shadows, or occlusions to prevent false boundaries and alert surveyors when manual verification is needed.

### 3. Automated Topological Cleansing
- Powered by PostGIS spatial operations:
  - **Overlap Slicing (`ST_Difference`):** Detects and resolves boundary disputes and overlapping claims between adjacent plots.
  - **Sliver Gap Snapping (`ST_Snap`):** Closes micro-gaps (within a 5cm tolerance) to ensure seamless, legally sound parcel geometries.

### 4. 14-Digit Bhu-Aadhaar (ULPIN) Generation
- Generates standardized 14-character alphanumeric Unique Land Parcel Identification Numbers (ULPIN) directly from the parcel's geographic centroid, following Indian Department of Land Resources (DoLR) and OGC standards.

### 5. Human-in-the-Loop (HITL) Governance
- Land records require legal accountability. GeoSync provides dedicated role-based workflows:
  - **Patwari (Field Surveyor) Workspace (`/patwari`):** Interactive map canvas to drop GCPs, run alignment, extract boundaries, and inspect parcel dossiers.
  - **Tehsildar (Magistrate) Chamber (`/tehsildar`):** Review queue where revenue officers audit AI-detected boundaries, add endorsements, and officially sanction records into the Land Stack.

### 6. Interactive Visual GIS Tools
- **Split-Screen Curtain Swiper:** Real-time sliding curtain to compare legacy maps directly over drone imagery.
- **Parcel Dossier:** Instant inspection of land ownership, survey numbers (Khasra), calculated area, and approval status.
- **Offline Resilience:** Seamlessly runs on local SQLite (`geosync_offline.db`) if Docker/PostGIS is unavailable, enabling field use without reliable internet.

---

## 🔄 How It Works

```
1. Legacy Map & Drone Ingestion ➡️ 2. ORB Alignment & TPS Warping ➡️ 3. GeoSAM AI Boundary Detection ➡️ 4. PostGIS Topological Cleaning ➡️ 5. ULPIN Generation & Tehsildar Sanction
```

1. **Ingest:** Upload high-resolution drone orthomosaics and legacy cadastral maps.
2. **Align:** Calculate global homography and refine with Ground Control Points (TPS).
3. **Delineate:** GeoSAM detects physical parcel boundaries with confidence scoring.
4. **Clean:** Clean overlaps and seal sliver gaps using spatial topology rules.
5. **Approve:** Surveyor submits to Tehsildar for statutory approval and Bhu-Aadhaar issuance.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (React 19), Tailwind CSS, React-Leaflet, Lucide Icons |
| **Backend** | FastAPI (Python 3.11+), Uvicorn, Pydantic |
| **Spatial & AI** | OpenCV, NumPy, Shapely, PyProj, GeoPandas, Segment Anything (GeoSAM) |
| **Database** | PostgreSQL 16 + PostGIS 3.4 (with SQLite offline fallback) |
| **DevOps** | Docker Compose, Hugging Face Spaces |

---

## ⚡ Quick Start

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.10+)
- **Docker** *(Optional, for PostgreSQL/PostGIS)*

---

### Option 1: One-Click Run (Windows)

Simply double-click `run_geosync.bat` or run in terminal:

```cmd
run_geosync.bat
```
This automatically starts the backend, frontend, and opens the app in your browser.

---

### Option 2: Manual Setup

#### 1. Start the Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed sample data & start server
python seed.py
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
- Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

#### 2. Start the Frontend

```bash
cd frontend

# Install packages
npm install

# Start development server
npm run dev
```
- Web Application: [http://localhost:3000](http://localhost:3000)

---

## 🗺️ Application Routes

- **Landing Page:** `http://localhost:3000/` — Overview, metrics, and portal entry.
- **Patwari Workspace:** `http://localhost:3000/patwari` — Drone mapping, alignment, AI boundary tools.
- **Tehsildar Chamber:** `http://localhost:3000/tehsildar` — Statutory adjudication and sanction docket.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
