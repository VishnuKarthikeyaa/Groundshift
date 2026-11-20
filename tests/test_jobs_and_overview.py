"""
Unit tests for GROUNDSHIFT Jobs, Platform Overview, and Geocoding APIs.
"""

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_overview_endpoint():
    res = client.get("/api/v1/overview")
    assert res.status_code == 200
    data = res.json()
    assert "registered_datasets" in data
    assert "supported_missions_count" in data
    assert "jobs_by_status" in data
    assert "recent_activity" in data
    assert isinstance(data["supported_missions"], list)


def test_study_areas_geocode():
    res = client.get("/api/v1/study-areas/geocode/lookup?q=chennai")
    assert res.status_code == 200
    data = res.json()
    assert data["found"] is True
    assert "center" in data
    assert len(data["center"]) == 2
    assert "bbox" in data
    assert len(data["bbox"]) == 4


def test_footprints_endpoint():
    res = client.get("/api/v1/ingest/footprints")
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert isinstance(data["features"], list)


def test_jobs_workflow_lifecycle():
    # Submit a job
    submit_res = client.post(
        "/api/v1/jobs",
        json={
            "name": "Test Linear Inversion",
            "workflow_type": "linear_rate_inversion",
            "parameters": {
                "epochs": ["2023-01-01", "2023-06-01", "2024-01-01"],
                "displacement_series_mm": [0.0, -8.5, -17.2],
                "uncertainties_mm": [1.0, 1.2, 1.1]
            }
        }
    )
    assert submit_res.status_code == 200
    job_data = submit_res.json()
    job_id = job_data["job_id"]
    assert job_data["status"] in ("idle", "running")

    # Get job status
    status_res = client.get(f"/api/v1/jobs/{job_id}")
    assert status_res.status_code == 200
    assert status_res.json()["job_id"] == job_id

    # List jobs
    list_res = client.get("/api/v1/jobs")
    assert list_res.status_code == 200
    assert any(j["job_id"] == job_id for j in list_res.json())

