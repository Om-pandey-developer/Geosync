import os
import sys
import json

# Ensure utf-8 output encoding for Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

os.environ["GEOSYNC_TEST_MODE"] = "1"

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("\n" + "=" * 60)
print("TEST 1: API Health Check")
print("=" * 60)
res = client.get("/api/health")
print(f"Health Status: {res.status_code}")
assert res.status_code == 200, f"Expected 200, got {res.status_code}"

print("\n" + "=" * 60)
print("TEST 2: POST /api/v1/align-uploaded-images with Mohanlalganj Cloth Map")
print("=" * 60)

demo_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "demo_datasets"))
cad_path = os.path.join(demo_dir, "mohanlalganj_1974_cadastral_cloth_map.png")
sat_path = os.path.join(demo_dir, "mohanlalganj_drone_orthomosaic.png")

with open(cad_path, "rb") as fc, open(sat_path, "rb") as fs:
    files = {
        "old_map": ("mohanlalganj_1974_cadastral_cloth_map.png", fc, "image/png"),
        "drone_image": ("mohanlalganj_drone_orthomosaic.png", fs, "image/png"),
    }
    data = {
        "pixel_scale": "0.05",
    }
    res_align = client.post("/api/v1/align-uploaded-images", files=files, data=data)

print(f"Align Status Code: {res_align.status_code}")
assert res_align.status_code == 200, f"Expected 200, got {res_align.status_code}: {res_align.text}"

result = res_align.json()
print(f"Status:             {result.get('status')}")
print(f"Overall Confidence: {result.get('confidence_score')}% ({result.get('confidence_band')})")
print(f"Inlier GCPs:        {result.get('inlier_gcps')} matched")
print(f"Reprojection RMSE:  +-{result.get('rmse_meters')} m")
print(f"Parcels Aligned:    {result.get('parcels_aligned')}")
print(f"Plots Flagged Red:  {result.get('plots_flagged_red')}")
print(f"Processing Time:    {result.get('processing_time_ms')} ms")
print(f"Report PNG URL:     {result.get('report_png_url')}")
print(f"Aligned GeoJSON:    {result.get('aligned_geojson_url')}")
print(f"Summary JSON:       {result.get('summary_json_url')}")

# Verify base64 data url exists
assert result.get("aligned_image_url", "").startswith("data:image/png;base64,"), "Data URL missing or invalid"

# Verify files exist on disk
for key, fpath in result.get("output_files", {}).items():
    exists = os.path.exists(fpath)
    size = os.path.getsize(fpath) if exists else 0
    print(f"  Disk Artifact [{key}]: exists={exists}, size={size:,} bytes, path={os.path.basename(fpath)}")
    assert exists and size > 0, f"Artifact {fpath} does not exist or is empty"

print("\n" + "=" * 60)
print("TEST 3: Static File Serving Check for Report Artifacts")
print("=" * 60)
report_url = result.get("report_png_url")
res_static = client.get(report_url)
print(f"Static Report PNG [{report_url}] HTTP Status: {res_static.status_code}")
assert res_static.status_code == 200, f"Static fetch failed with {res_static.status_code}"

geojson_url = result.get("aligned_geojson_url")
res_geojson = client.get(geojson_url)
print(f"Static Aligned GeoJSON [{geojson_url}] HTTP Status: {res_geojson.status_code}")
assert res_geojson.status_code == 200, f"Static geojson fetch failed with {res_geojson.status_code}"

print("\n" + "=" * 60)
print("TEST 4: POST /api/v1/align-uploaded-images with GeoJSON Vector Cadastre + Explicit Form GCPs")
print("=" * 60)
geojson_path = os.path.join(demo_dir, "sample_legacy_cadastre_1974.geojson")
gcp_path = os.path.join(demo_dir, "sample_ground_control_points.json")

with open(gcp_path, "r", encoding="utf-8") as gf:
    gcp_json_str = gf.read()

with open(geojson_path, "rb") as fg, open(sat_path, "rb") as fs:
    files = {
        "old_map": ("sample_legacy_cadastre_1974.geojson", fg, "application/geo+json"),
        "drone_image": ("mohanlalganj_drone_orthomosaic.png", fs, "image/png"),
    }
    data = {
        "gcps": gcp_json_str,
        "pixel_scale": "0.05",
    }
    res_v2 = client.post("/api/v1/align-uploaded-images", files=files, data=data)

print(f"GeoJSON Align Status Code: {res_v2.status_code}")
assert res_v2.status_code == 200, f"Expected 200, got {res_v2.status_code}: {res_v2.text}"

res_v2_json = res_v2.json()
print(f"Status:             {res_v2_json.get('status')}")
print(f"Overall Confidence: {res_v2_json.get('confidence_score')}% ({res_v2_json.get('confidence_band')})")
print(f"Inlier GCPs:        {res_v2_json.get('inlier_gcps')} matched")
print(f"Reprojection RMSE:  +-{res_v2_json.get('rmse_meters')} m")
print(f"Parcels Aligned:    {res_v2_json.get('parcels_aligned')}")
print(f"Plots Flagged Red:  {res_v2_json.get('plots_flagged_red')}")
print(f"Report PNG:         {res_v2_json.get('report_png_url')}")

# Verify 3 output files on disk
for key, fpath in res_v2_json.get("output_files", {}).items():
    exists = os.path.exists(fpath)
    size = os.path.getsize(fpath) if exists else 0
    print(f"  Artifact [{key}]: exists={exists}, size={size:,} bytes")
    assert exists and size > 0

print("\n" + "=" * 60)
print("ALL MULTI-FORMAT API ENDPOINT INTEGRATION TESTS PASSED SUCCESSFULLY!")
print("=" * 60)
