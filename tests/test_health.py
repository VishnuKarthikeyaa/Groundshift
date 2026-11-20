"""
GROUNDSHIFT API Integration & Health Endpoint Tests.
"""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["platform"] == "GROUNDSHIFT"
    assert data["status"] == "online"

def test_health_endpoints():
    r1 = client.get("/api/v1/health")
    assert r1.status_code == 200
    assert r1.json()["status"] == "healthy"

    r2 = client.get("/api/v1/health/system")
    assert r2.status_code == 200
    system_data = r2.json()
    assert "memory" in system_data
    assert "total_physical_mb" in system_data["memory"]

    r3 = client.get("/api/v1/health/science")
    assert r3.status_code == 200
    science_data = r3.json()
    assert "rasterio" in science_data["libraries"]
    assert "gdal" in science_data["libraries"]

def test_missions_endpoint():
    response = client.get("/api/v1/missions")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 5
    mission_ids = [m["id"] for m in data["missions"]]
    assert "nisar" in mission_ids
    assert "sentinel1" in mission_ids
    assert "saocom" in mission_ids

def test_study_areas_endpoint():
    response = client.get("/api/v1/study-areas")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 2
    area_ids = [a["id"] for a in data["study_areas"]]
    assert "chennai" in area_ids
    assert "cauvery_delta" in area_ids

def test_validation_decompose_endpoint():
    payload = {
        "d_asc_mm": -12.4,
        "d_desc_mm": -14.2,
        "inc_asc_deg": 39.2,
        "head_asc_deg": 348.5,
        "inc_desc_deg": 41.5,
        "head_desc_deg": 192.1,
        "sigma_asc": 1.5,
        "sigma_desc": 1.5
    }
    response = client.post("/api/v1/validation/decompose", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    assert "d_east" in res["results"]
    assert "d_up" in res["results"]
    assert res["results"]["is_well_conditioned"] is True

