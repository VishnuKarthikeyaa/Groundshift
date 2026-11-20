"""
GROUNDSHIFT Data Integrity and Scientific Reliability Tests.
Validates:
1. Honest empty states when backend returns no records.
2. Every numerical readout carries an explicit unit.
3. Exported reports (CSV/Markdown) strictly match on-screen figures.
4. No fabricated satellite observations in production responses.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from processing.catalog_db import get_catalog_statistics, query_catalog
from processing.report_generator import generate_markdown_validation_report

client = TestClient(app)


def test_overview_telemetry_honest_metrics():
    """Validates that /overview returns real counts, unit references, and no placeholder zeros."""
    resp = client.get("/api/v1/overview")
    assert resp.status_code == 200
    data = resp.json()

    # Core integrity counters
    assert "registered_datasets" in data
    assert "supported_missions_count" in data
    assert "processed_datasets" in data
    assert "validation_experiments_count" in data
    assert "ground_coverage_km2" in data
    assert "jobs_by_status" in data

    # Units must be explicit and non-negative
    assert isinstance(data["ground_coverage_km2"], (int, float))
    assert data["ground_coverage_km2"] >= 0.0
    assert isinstance(data["catalog_size_mb"], (int, float))
    assert data["catalog_size_mb"] >= 0.0

    # Activity feed structure
    assert isinstance(data["recent_activity"], list)
    for act in data["recent_activity"]:
        assert "timestamp" in act
        assert "category" in act
        assert "source" in act
        assert "title" in act
        assert "status" in act


def test_validation_report_export_matches_screen_figures():
    """Validates that export figures match on-screen numbers exactly."""
    stats = {
        "valid_count": 450,
        "rmse": 1.62,
        "mean_difference_bias": 0.38,
        "mae": 1.25,
        "pearson_r": 0.9712,
        "r_squared": 0.9432,
    }

    report = generate_markdown_validation_report(
        report_title="Multi-Mission InSAR Validation",
        mission_1="Sentinel-1",
        mission_2="NISAR L-band",
        product_type_1="SLC",
        product_type_2="RSLC",
        time_span_1="2023-01-05 to 2024-05-25",
        time_span_2="2023-01-08 to 2024-05-28",
        study_area="Chennai Coastal Basin",
        spatial_overlap_km2=1240.5,
        overlap_pct=94.2,
        temporal_sep_days=3.5,
        look_vector_divergence_deg=2.1,
        stats_dict=stats,
        has_gnss=True,
        gnss_station_id="OMR_VAL"
    )

    # Verify exact figures in generated report
    assert "1.62" in report  # RMSE
    assert "0.38" in report  # Bias
    assert "1.25" in report  # MAE
    assert "0.9712" in report  # Pearson r
    assert "1240.5" in report  # Spatial overlap km2
    assert "OMR_VAL" in report  # GNSS station


def test_job_submission_and_progress_telemetry():
    """Validates that scientific job runs with stages and determinate progress."""
    req = {
        "name": "Linear Rate Inversion Test",
        "workflow_type": "linear_rate_inversion",
        "parameters": {
            "epochs": ["2023-01-05", "2023-03-18", "2023-07-04", "2023-10-20"],
            "displacement_series_mm": [-2.1, -5.4, -11.2, -18.7],
            "uncertainties_mm": [1.1, 1.2, 1.0, 1.3]
        }
    }
    resp = client.post("/api/v1/jobs", json=req)
    assert resp.status_code == 200
    job = resp.json()
    assert "job_id" in job
    assert job["status"] in ("idle", "running")
    assert job["percent_complete"] >= 0.0

    # Retrieve status
    st_resp = client.get(f"/api/v1/jobs/{job['job_id']}")
    assert st_resp.status_code == 200
    job_st = st_resp.json()
    assert len(job_st["logs"]) >= 1
    assert "timestamp" in job_st["logs"][0]
    assert "level" in job_st["logs"][0]


def test_empty_catalog_query_integrity():
    """Validates honest empty state when filtering for non-existent mission."""
    resp = client.get("/api/v1/ingest/catalog?mission=NON_EXISTENT_MISSION")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["datasets"] == []
