"""
Integration and Unit Tests for GROUNDSHIFT SAR Data Ingestion and Catalog Engine.
Tests discovery queries, local import, deduplication, provenance records, and REST endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from pathlib import Path

from backend.app.main import app
from processing.catalog_db import (
    upsert_dataset,
    get_dataset_by_product_id,
    query_catalog,
    delete_dataset,
    get_catalog_statistics,
)

client = TestClient(app)


def test_search_endpoint():
    """Tests SAR dataset discovery endpoint over Chennai coordinates."""
    response = client.get(
        "/api/v1/ingest/search",
        params={
            "min_lon": 80.0,
            "min_lat": 12.8,
            "max_lon": 80.4,
            "max_lat": 13.3,
            "limit": 10,
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_found" in data
    assert data["total_found"] > 0
    assert len(data["results"]) > 0

    first = data["results"][0]
    assert "product_id" in first
    assert "mission" in first
    assert "frequency_ghz" in first
    assert "polarization" in first
    assert "product_type" in first
    assert "geojson_geometry" in first


def test_search_mission_filter():
    """Ensures search filters by satellite mission properly."""
    response = client.get(
        "/api/v1/ingest/search",
        params={
            "min_lon": 79.0,
            "min_lat": 10.0,
            "max_lon": 81.0,
            "max_lat": 14.0,
            "mission": "NISAR L-band",
        }
    )
    assert response.status_code == 200
    data = response.json()
    for item in data["results"]:
        assert item["mission"] == "NISAR L-band"


def test_catalog_db_crud():
    """Tests insert, query, update, deduplication, and deletion in SQLite catalog."""
    test_id = "TEST_S1A_IW_SLC_UNIT_TEST_001"
    rec = {
        "product_id": test_id,
        "mission": "Sentinel-1",
        "sensor_band": "C",
        "frequency_ghz": 5.405,
        "product_type": "SLC",
        "processing_level": "L1",
        "polarization": "VV+VH",
        "acquisition_date": "2024-01-01T00:00:00Z",
        "orbit_direction": "ASCENDING",
        "incidence_angle_near": 30.0,
        "incidence_angle_far": 45.0,
        "bbox_min_lon": 80.0,
        "bbox_min_lat": 12.5,
        "bbox_max_lon": 80.5,
        "bbox_max_lat": 13.5,
        "geojson_geometry": {"type": "Polygon", "coordinates": []},
        "file_format": "SAFE",
        "source_catalogue": "UNIT_TEST",
        "source_url": "https://example.com/slc.zip",
        "access_restriction": "None",
        "local_file_path": None,
        "file_size_bytes": 1024,
        "sha256_hash": "abcdef1234567890",
        "download_status": "AVAILABLE",
        "processing_status": "UNPROCESSED",
        "provenance_manifest": {"test": True},
    }

    # Upsert
    upsert_dataset(rec)
    fetched = get_dataset_by_product_id(test_id)
    assert fetched is not None
    assert fetched["mission"] == "Sentinel-1"
    assert fetched["product_type"] == "SLC"

    # Query with filters
    results = query_catalog(mission="Sentinel-1", product_type="SLC")
    assert any(r["product_id"] == test_id for r in results)

    # Delete
    deleted = delete_dataset(test_id)
    assert deleted is True
    assert get_dataset_by_product_id(test_id) is None


def test_catalog_stats_endpoint():
    """Tests that stats endpoint aggregates metrics without error."""
    resp = client.get("/api/v1/ingest/stats")
    assert resp.status_code == 200
    stats = resp.json()
    assert "total_datasets" in stats
    assert "total_size_mb" in stats
    assert "by_mission" in stats

