# Project GeoSync — Open Proxy Datasets Catalog (SIH26013)
**Initiative:** Digital India Land Records Modernisation Programme (DILRMP 3.0) & NAKSHA Pilot  
**Problem Statement:** Automated Integration and Intelligent Harmonization of Multi-Source Geospatial Data

---

## 1. Ready-to-Use Local Proxy Datasets (Inside this Repo)

We have generated and bundled ready-to-test datasets inside the [`demo_datasets/`](.) folder:

| File | Description | Purpose | Format |
|---|---|---|---|
| [`sample_legacy_cadastre_1974.geojson`](./sample_legacy_cadastre_1974.geojson) | 18 land parcels for Mohanlalganj Ward 12 with $2.4^\circ$ rotational drift and non-linear moisture shrinkage | Test layer upload, ORB global homography, and Thin-Plate Splines (TPS) rubber-sheeting | RFC 7946 GeoJSON |
| [`sample_ground_control_points.json`](./sample_ground_control_points.json) | 4 Ground Control Points (GCPs) connecting boundary stones to terrain features | Execute local non-linear warping in Patwari workspace | JSON |
| [`backend/geosync_offline.db`](../backend/geosync_offline.db) | Pre-seeded offline SQLite database with Mohanlalganj Ward 12 cadastral parcels | Air-gapped venue demonstration | SQLite DB |

---

## 2. Open Drone Imagery Proxy Datasets (5cm – 10cm GSD)

For high-resolution aerial and drone imagery, these public and open-access repositories provide exact proxy data:

### A. OpenAerialMap (OAM) — *Recommended for Open Drone GeoTIFFs*
- **Portal:** [https://map.openaerialmap.org](https://map.openaerialmap.org)
- **License:** CC-BY 4.0 (Open Imagery Network)
- **Resolution:** 2cm to 8cm/pixel Ground Sample Distance (GSD).
- **Features:** 
  - Direct download of full **GeoTIFF** orthomosaics.
  - Ready-to-use **XYZ/TMS tile URLs** that can be pasted directly into GIS tools or Leaflet.
- **How to download:**
  1. Open [map.openaerialmap.org](https://map.openaerialmap.org).
  2. Search for any region or pan to agricultural/suburban areas.
  3. Click any purple tile footprint $\to$ Click **Download** for the GeoTIFF raster.

### B. OpenDroneMap Benchmark Datasets (ODMdata)
- **Repository:** [https://github.com/OpenDroneMap/ODMdata](https://github.com/OpenDroneMap/ODMdata)
- **License:** Open Access
- **Key Drone Datasets:**
  - **`aukerman`**: Agricultural fields with clear bunds (*medh*), trees, and ditches — perfect for testing GeoSAM boundary extraction and tree canopy occlusion scoring.
  - **`bellus`**: Suburban area with compound walls, rooftops, and roads — ideal for testing urban cadastre harmonization.
  - **`brighton_beach`**: Coastal/terrain mapping with high feature variability for ORB keypoint matching.

### C. Pix4D Example Real Photogrammetry Datasets
- **Portal:** [Pix4D Real Photogrammetry Datasets](https://support.pix4d.com/hc/en-us/articles/202559779-Example-projects-real-photogrammetry-data)
- **Included Files:** Raw drone survey images, surveyed Ground Control Points (GCPs), and processed centimeter-level GeoTIFF orthomosaics.
- **Datasets:**
  - *Quarry / Agricultural Terrain*: Demonstrates digital surface models and orthomosaics.
  - *PIX4Dmatic Industrial / Mixed Zone*: 1,469 high-res aerial drone images with millimeter GPS precision.

### D. Esri World Imagery (Pre-Integrated High-Res Basemap)
- **Tile URL:** `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
- **Resolution:** Sub-meter worldwide (up to zoom level 20 in urban and peri-urban centers).
- **Status:** **Already active in GeoSync!** When you open [http://localhost:3000/patwari](http://localhost:3000/patwari), the "5cm Drone" layer streams this aerial imagery directly.

---

## 3. Cadastral Map Proxy Datasets (Village Cadastre / Parcels)

### A. Data{Meet} Indian Open Maps Initiative
- **Repository:** [https://projects.datameet.org/maps/](https://projects.datameet.org/maps/) & [https://github.com/datameet/maps](https://github.com/datameet/maps)
- **License:** Creative Commons / ODbL
- **Data Available:** Village boundaries, taluk boundaries, and district survey polygons for Indian states (Uttar Pradesh, Maharashtra, Karnataka, Gujarat, etc.) in GeoJSON and Shapefile formats.

### B. Official State BhuNaksha Portals (NIC)
- **UP BhuNaksha:** [https://upbhunaksha.gov.in](https://upbhunaksha.gov.in)
- **MP BhuAbhilekh:** [https://mpbhulekh.gov.in](https://mpbhulekh.gov.in)
- **Maharashtra Mahabhunaksha:** [https://mahabhunakasha.mahabhumi.gov.in](https://mahabhunakasha.mahabhumi.gov.in)
- **Usage:** Download village-level Shajra maps (PDF or high-res raster), convert to PNG/JPG, and upload directly into GeoSync's Patwari Workspace.

### C. OpenStreetMap (OSM) Live Cadastre Query via Overpass Turbo
You can extract real land parcels and village road networks as GeoJSON using [Overpass Turbo](https://overpass-turbo.eu/):
```overpass
[out:json][timeout:25];
(
  // Fetch landuse and boundary polygons for target coordinates
  way["landuse"="farmland"](26.75, 80.89, 26.77, 80.91);
  way["boundary"="administrative"](26.75, 80.89, 26.77, 80.91);
);
out body;
>;
out skel qt;
```
Click **Export $\to$ GeoJSON** to download the exact vector layer for your area of interest.

---

## 4. How to Test with the Included Proxy Dataset

### Option 1: Test via Frontend UI (Zero-Code)
1. Open [http://localhost:3000/patwari](http://localhost:3000/patwari).
2. The 18 parcels of Mohanlalganj Ward 12 will load automatically on top of the 5cm drone basemap.
3. Click **"Align (ORB)"** $\to$ inspect inlier confidence.
4. Click **"Thin-Plate Splines"** $\to$ observe how the legacy distorted contours rubber-sheet into the drone boundaries!

### Option 2: Upload via API
To upload [`sample_legacy_cadastre_1974.geojson`](./sample_legacy_cadastre_1974.geojson) directly to the backend:
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/upload-layers" \
  -F "geojson_file=@demo_datasets/sample_legacy_cadastre_1974.geojson" \
  -F "village_name=Mohanlalganj" \
  -F "ward_name=Ward 12"
```

The system will ingest the 18 parcels, normalize the CRS to `EPSG:3857`, and make them instantly accessible across all Patwari and Tehsildar dashboards.
