"""
GROUNDSHIFT Multi-Mission SAR Data Ingestion and Catalog API Router.
Handles remote SAR discovery, local asset inspection, cryptographic deduplication,
and catalog management for NISAR, Sentinel-1, SAOCOM, RADARSAT, and UAVSAR.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, HTTPException, UploadFile, File, Form, Body
from pydantic import BaseModel, Field
from pathlib import Path
import datetime

from processing.catalog_db import (
    init_catalog_db,
    upsert_dataset,
    get_dataset_by_id,
    get_dataset_by_product_id,
    get_dataset_by_sha256,
    query_catalog,
    delete_dataset,
    get_catalog_statistics,
)
from processing.sar_inspector import inspect_sar_asset
from processing.discovery_clients import (
    search_multi_mission_catalogues,
    MISSION_FREQUENCIES,
    OFFLINE_MISSION_ARCHIVE,
)
from processing.provenance import create_provenance_manifest
from backend.app.core.logger import logger
from backend.app.config import settings

# Initialize catalog database schema on module load
init_catalog_db()

router = APIRouter(prefix="/ingest", tags=["SAR Data Ingestion Engine"])


# ------------------------------------------------------------------------------
# Pydantic Schemas
# ------------------------------------------------------------------------------

class InspectPathRequest(BaseModel):
    file_path: str = Field(..., description="Absolute or relative local file/directory path to inspect")


class LocalImportRequest(BaseModel):
    file_path: str = Field(..., description="Path to local SAR file or .SAFE directory")
    custom_product_id: Optional[str] = None
    custom_mission: Optional[str] = None


class RemoteRegisterRequest(BaseModel):
    product_id: str
    mission: str
    sensor_band: str
    frequency_ghz: float
    product_type: str
    processing_level: str
    polarization: str
    acquisition_date: str
    orbit_direction: Optional[str] = "ASCENDING"
    incidence_angle_near: Optional[float] = None
    incidence_angle_far: Optional[float] = None
    bbox_min_lon: float
    bbox_min_lat: float
    bbox_max_lon: float
    bbox_max_lat: float
    geojson_geometry: Optional[Dict[str, Any]] = None
    file_format: str
    source_catalogue: str
    source_url: str
    access_restriction: Optional[str] = None


# ------------------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------------------

@router.get("/search")
async def search_datasets(
    min_lon: float = Query(79.0, description="Minimum longitude (deg)"),
    min_lat: float = Query(10.0, description="Minimum latitude (deg)"),
    max_lon: float = Query(81.0, description="Maximum longitude (deg)"),
    max_lat: float = Query(14.0, description="Maximum latitude (deg)"),
    start_date: Optional[str] = Query(None, description="ISO Start date e.g. 2023-01-01"),
    end_date: Optional[str] = Query(None, description="ISO End date e.g. 2024-12-31"),
    mission: Optional[str] = Query(None, description="Mission name filter or 'ALL'"),
    product_type: Optional[str] = Query(None, description="Product type (SLC, GRD, GCOV, GUNW, etc.)"),
    polarization: Optional[str] = Query(None, description="Polarization (VV, VH, HH, HV, QUAD)"),
    processing_level: Optional[str] = Query(None, description="Processing level (L0, L1, L2, L3)"),
    limit: int = Query(30, ge=1, le=100),
    allow_live_network: bool = Query(True, description="Attempt live remote DAAC query"),
):
    """
    Discovers remote SAR datasets across supported missions (NISAR L/S, Sentinel-1,
    SAOCOM, RADARSAT-1, RCM, UAVSAR).
    Returns verified remote holdings with explicit scientific provenance tags.
    """
    bbox = (min_lon, min_lat, max_lon, max_lat)
    res = search_multi_mission_catalogues(
        bbox=bbox,
        start_date=start_date,
        end_date=end_date,
        mission=mission,
        product_type=product_type,
        polarization=polarization,
        processing_level=processing_level,
        limit=limit,
        allow_live_network=allow_live_network,
    )
    return res


@router.post("/inspect")
async def inspect_local_path(payload: InspectPathRequest):
    """
    Inspects a local file or directory without loading full raster datasets into RAM.
    Supports GeoTIFF, HDF5 (NISAR/UAVSAR), and Sentinel-1 .SAFE directories.
    Detects corrupt or incomplete files and flags them.
    """
    res = inspect_sar_asset(payload.file_path, compute_hash=True)
    return res.to_dict()


@router.post("/inspect-upload")
async def inspect_uploaded_file(file: UploadFile = File(...)):
    """
    Uploads a small SAR product (e.g. sample GeoTIFF or metadata XML) to the raw staging
    directory and inspects its headers memory-safely.
    """
    staging_dir = settings.DATA_RAW_DIR / "uploads"
    staging_dir.mkdir(parents=True, exist_ok=True)
    temp_path = staging_dir / file.filename

    # Stream write in 64KB chunks to protect RAM
    total_written = 0
    with open(temp_path, "wb") as f:
        while chunk := await file.read(65536):
            total_written += len(chunk)
            f.write(chunk)

    res = inspect_sar_asset(str(temp_path), compute_hash=True)
    return res.to_dict()


@router.post("/import-local")
async def import_local_file(payload: LocalImportRequest):
    """
    Imports and catalogues a local SAR file or .SAFE container into the GROUNDSHIFT catalog.
    Computes cryptographic SHA-256 hash, runs integrity checks, performs deduplication,
    and generates an immutable JSON-LD provenance manifest.
    """
    path = Path(payload.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {payload.file_path}")

    # Inspect file
    inspected = inspect_sar_asset(str(path), compute_hash=True)
    if not inspected.is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"SAR file inspection failed: {inspected.status} - {inspected.error_message}"
        )

    # Check deduplication by SHA-256
    existing_by_hash = get_dataset_by_sha256(inspected.sha256_hash)
    if existing_by_hash:
        logger.info(f"Duplicate file detected by SHA-256: {existing_by_hash['product_id']}")

    # Formulate product identifier
    product_id = payload.custom_product_id or path.stem

    # Create Provenance Manifest
    manifest = create_provenance_manifest(
        asset_id=product_id,
        classification="OBSERVABLE_MEASURED",
        algorithm_name="GROUNDSHIFT_SAR_INSPECTION_ENGINE",
        algorithm_version="1.0.0",
        parameters={
            "format_detected": inspected.format_detected,
            "integrity_checks": inspected.integrity_checks,
            "sensor_band": inspected.sensor_band,
            "polarization": inspected.polarization,
        },
        source_datasets=[{
            "local_path": str(path.resolve()),
            "file_size_bytes": inspected.file_size_bytes,
            "sha256": inspected.sha256_hash or "UNKNOWN",
        }]
    )

    record = {
        "product_id": product_id,
        "mission": payload.custom_mission or inspected.mission,
        "sensor_band": inspected.sensor_band,
        "frequency_ghz": inspected.frequency_ghz,
        "product_type": inspected.product_type,
        "processing_level": inspected.processing_level,
        "polarization": inspected.polarization,
        "acquisition_date": inspected.acquisition_date or datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "orbit_direction": inspected.orbit_direction or "ASCENDING",
        "incidence_angle_near": inspected.incidence_angle_near,
        "incidence_angle_far": inspected.incidence_angle_far,
        "bbox_min_lon": inspected.bbox[0],
        "bbox_min_lat": inspected.bbox[1],
        "bbox_max_lon": inspected.bbox[2],
        "bbox_max_lat": inspected.bbox[3],
        "geojson_geometry": inspected.geojson_geometry,
        "file_format": inspected.format_detected,
        "source_catalogue": "LOCAL_IMPORT",
        "source_url": f"file:///{path.resolve()}",
        "access_restriction": "Local Storage - User Managed",
        "local_file_path": str(path.resolve()),
        "file_size_bytes": inspected.file_size_bytes,
        "sha256_hash": inspected.sha256_hash,
        "download_status": "INGESTED",
        "processing_status": "INSPECTED",
        "provenance_manifest": manifest,
    }

    upsert_dataset(record)
    saved = get_dataset_by_product_id(product_id)
    return {
        "message": "Dataset successfully catalogued",
        "dataset": saved,
        "deduplicated": existing_by_hash is not None,
    }


@router.post("/register-remote")
async def register_remote_dataset(payload: RemoteRegisterRequest):
    """
    Registers a discovered remote SAR dataset into the local catalog to track its download status.
    """
    existing = get_dataset_by_product_id(payload.product_id)
    if existing:
        return {"message": "Dataset already registered in catalog", "dataset": existing}

    record = payload.model_dump()
    record["download_status"] = "AVAILABLE"
    record["processing_status"] = "UNPROCESSED"
    record["local_file_path"] = None
    record["file_size_bytes"] = None
    record["sha256_hash"] = None
    record["provenance_manifest"] = None

    upsert_dataset(record)
    saved = get_dataset_by_product_id(payload.product_id)
    return {"message": "Remote dataset registered in catalog", "dataset": saved}


@router.get("/catalog")
async def list_catalog(
    mission: Optional[str] = Query(None),
    product_type: Optional[str] = Query(None),
    polarization: Optional[str] = Query(None),
    processing_level: Optional[str] = Query(None),
    download_status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Lists datasets currently tracked or ingested in the GROUNDSHIFT local catalog."""
    items = query_catalog(
        mission=mission,
        product_type=product_type,
        polarization=polarization,
        processing_level=processing_level,
        download_status=download_status,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    return {"total": len(items), "datasets": items}


@router.get("/catalog/{product_id}")
async def get_catalog_item(product_id: str):
    """Retrieves full details and provenance manifest for a catalogued SAR dataset."""
    item = get_dataset_by_product_id(product_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {product_id}")
    return item


@router.delete("/catalog/{product_id}")
async def delete_catalog_item(product_id: str):
    """Removes a dataset record from the catalog database."""
    success = delete_dataset(product_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Dataset not found: {product_id}")
    return {"message": f"Dataset {product_id} successfully removed from catalog"}


@router.get("/stats")
async def get_stats():
    """Returns aggregated summary metrics of catalogued SAR datasets."""
    return get_catalog_statistics()


@router.post("/seed-reference-samples")
async def seed_reference_samples():
    """
    Populates the catalog with verified sample SAR metadata across all 7 supported missions
    (NISAR L/S, Sentinel-1, SAOCOM, RADARSAT-1, RCM, UAVSAR) over study areas.
    """
    count = 0
    for item in OFFLINE_MISSION_ARCHIVE:
        b = item["bbox"]
        geojson = {
            "type": "Polygon",
            "coordinates": [[
                [b[0], b[1]],
                [b[2], b[1]],
                [b[2], b[3]],
                [b[0], b[3]],
                [b[0], b[1]]
            ]]
        }
        rec = {
            "product_id": item["product_id"],
            "mission": item["mission"],
            "sensor_band": item["sensor_band"],
            "frequency_ghz": item["frequency_ghz"],
            "product_type": item["product_type"],
            "processing_level": item["processing_level"],
            "polarization": item["polarization"],
            "acquisition_date": item["acquisition_date"],
            "orbit_direction": item["orbit_direction"],
            "incidence_angle_near": item.get("incidence_angle_near"),
            "incidence_angle_far": item.get("incidence_angle_far"),
            "bbox_min_lon": b[0],
            "bbox_min_lat": b[1],
            "bbox_max_lon": b[2],
            "bbox_max_lat": b[3],
            "geojson_geometry": geojson,
            "file_format": item["file_format"],
            "source_catalogue": item["source_catalogue"],
            "source_url": item["source_url"],
            "access_restriction": item["access_restriction"],
            "local_file_path": None,
            "file_size_bytes": 1024 * 1024 * 512,  # ~512 MB nominal size
            "sha256_hash": None,
            "download_status": "AVAILABLE",
            "processing_status": "UNPROCESSED",
            "provenance_manifest": {
                "classification": "OBSERVABLE_MEASURED",
                "source": item["source_catalogue"],
                "notice": "Official mission archive reference record."
            }
        }
        upsert_dataset(rec)
        count += 1

    return {"message": f"Successfully seeded {count} multi-mission SAR records.", "stats": get_catalog_statistics()}


@router.get("/footprints")
async def get_footprints(
    mission: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000)
):
    """
    Returns GeoJSON FeatureCollection of all catalogued SAR dataset footprints
    for map rendering, metadata inspection, and intersection analysis.
    """
    datasets = query_catalog(mission=mission, download_status=status, limit=limit)
    features = []
    
    for d in datasets:
        # Determine geometry
        geometry = d.get("geojson_geometry")
        if not geometry:
            min_lon = d["bbox_min_lon"]
            min_lat = d["bbox_min_lat"]
            max_lon = d["bbox_max_lon"]
            max_lat = d["bbox_max_lat"]
            geometry = {
                "type": "Polygon",
                "coordinates": [[
                    [min_lon, min_lat],
                    [max_lon, min_lat],
                    [max_lon, max_lat],
                    [min_lon, max_lat],
                    [min_lon, min_lat]
                ]]
            }
        
        feature = {
            "type": "Feature",
            "id": d["product_id"],
            "geometry": geometry,
            "properties": {
                "id": d["id"],
                "product_id": d["product_id"],
                "mission": d["mission"],
                "sensor_band": d["sensor_band"],
                "frequency_ghz": d["frequency_ghz"],
                "product_type": d["product_type"],
                "processing_level": d["processing_level"],
                "polarization": d["polarization"],
                "acquisition_date": d["acquisition_date"],
                "orbit_direction": d["orbit_direction"],
                "incidence_angle_near": d.get("incidence_angle_near"),
                "incidence_angle_far": d.get("incidence_angle_far"),
                "file_format": d["file_format"],
                "download_status": d["download_status"],
                "processing_status": d["processing_status"],
                "source_catalogue": d["source_catalogue"],
                "file_size_bytes": d.get("file_size_bytes", 0),
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "count": len(features),
        "features": features
    }


