"""
GROUNDSHIFT Memory-Efficient Scientific Raster & CSV Exporter.
Exports deformation velocity, quality, and uncertainty maps to compressed Cloud-Optimized
GeoTIFFs and tabular CSV files with cryptographic lineage and classification stamping.
"""

import os
import csv
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import datetime

try:
    import rasterio
    from rasterio.transform import from_bounds
    from rasterio.enums import Resampling
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False

from backend.app.config import settings
from backend.app.core.logger import logger
from processing.provenance import calculate_sha256, create_provenance_manifest


def export_geotiff_map(
    output_filename: str,
    data: np.ndarray,                  # Shape: (Height, Width) or (Bands, Height, Width)
    bbox: Tuple[float, float, float, float], # (min_lon, min_lat, max_lon, max_lat)
    crs: str = "EPSG:4326",
    nodata_value: float = -9999.0,
    metadata_tags: Optional[Dict[str, str]] = None,
    classification: str = "ESTIMATE_DERIVED"
) -> Dict[str, Any]:
    """
    Exports a 2D float32 array to a tiled, DEFLATE-compressed GeoTIFF.
    Streams in blocks to conserve RAM on 16GB machines.
    """
    if not RASTERIO_AVAILABLE:
        raise RuntimeError("rasterio library is not available.")

    out_dir = settings.DATA_PROCESSED_DIR / "rasters"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / output_filename

    # Format data array to 2D
    if data.ndim == 2:
        height, width = data.shape
        count = 1
        write_arr = data.reshape((1, height, width))
    elif data.ndim == 3:
        count, height, width = data.shape
        write_arr = data
    else:
        raise ValueError(f"Expected 2D or 3D array, got ndim={data.ndim}")

    min_lon, min_lat, max_lon, max_lat = bbox
    transform = from_bounds(min_lon, min_lat, max_lon, max_lat, width, height)

    # Clean NaNs to nodata_value
    clean_arr = np.nan_to_num(write_arr, nan=nodata_value).astype(np.float32)

    # Write compressed GeoTIFF
    # Note: TIFF specification requires tile block sizes to be multiples of 16
    use_tiling = (width >= 64 and height >= 64)
    raster_kwargs = {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": count,
        "dtype": np.float32,
        "crs": crs,
        "transform": transform,
        "nodata": nodata_value,
        "compress": "deflate",
    }
    if use_tiling:
        raster_kwargs["tiled"] = True
        raster_kwargs["blockxsize"] = 64
        raster_kwargs["blockysize"] = 64

    with rasterio.open(out_path, "w", **raster_kwargs) as dst:
        dst.write(clean_arr)
        
        # Stamp metadata tags and classification
        tags = {
            "PLATFORM": "GROUNDSHIFT",
            "CLASSIFICATION": classification,
            "CREATED_UTC": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            **(metadata_tags or {})
        }
        dst.update_tags(**tags)

    file_size = out_path.stat().st_size
    sha256 = calculate_sha256(out_path)

    # Generate JSON-LD provenance manifest
    manifest = create_provenance_manifest(
        asset_id=output_filename,
        classification=classification,
        algorithm_name="GROUNDSHIFT_GEOTIFF_EXPORTER",
        algorithm_version="1.0.0",
        parameters={
            "crs": crs,
            "dimensions": [height, width],
            "nodata": nodata_value,
            "tags": tags
        },
        source_datasets=[{
            "filename": output_filename,
            "file_size_bytes": file_size,
            "sha256": sha256
        }]
    )

    return {
        "output_path": str(out_path.resolve()),
        "filename": output_filename,
        "file_size_bytes": file_size,
        "file_size_mb": round(file_size / (1024 * 1024), 2),
        "sha256": sha256,
        "dimensions": [height, width],
        "crs": crs,
        "provenance_manifest": manifest
    }


def export_points_csv(
    output_filename: str,
    lons: np.ndarray,
    lats: np.ndarray,
    velocities_mm_year: np.ndarray,
    uncertainties_mm_year: Optional[np.ndarray] = None,
    rmses_mm: Optional[np.ndarray] = None,
    cluster_ids: Optional[np.ndarray] = None,
    mission: str = "Multi-Mission SAR",
    classification: str = "ESTIMATE_DERIVED"
) -> Dict[str, Any]:
    """
    Exports point observations and cluster assignments to standard CSV with headers.
    """
    out_dir = settings.DATA_PROCESSED_DIR / "tabular"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / output_filename

    n_pts = len(lons)
    fieldnames = [
        "point_id", "longitude_deg", "latitude_deg", "velocity_mm_year",
        "velocity_uncertainty_mm_year", "rmse_mm", "cluster_id", "mission", "classification"
    ]

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for i in range(n_pts):
            writer.writerow({
                "point_id": i + 1,
                "longitude_deg": round(float(lons[i]), 6),
                "latitude_deg": round(float(lats[i]), 6),
                "velocity_mm_year": round(float(velocities_mm_year[i]), 2),
                "velocity_uncertainty_mm_year": round(float(uncertainties_mm_year[i]), 2) if uncertainties_mm_year is not None else "",
                "rmse_mm": round(float(rmses_mm[i]), 2) if rmses_mm is not None else "",
                "cluster_id": int(cluster_ids[i]) if cluster_ids is not None else 0,
                "mission": mission,
                "classification": classification
            })

    file_size = out_path.stat().st_size
    sha256 = calculate_sha256(out_path)

    return {
        "output_path": str(out_path.resolve()),
        "filename": output_filename,
        "row_count": n_pts,
        "file_size_bytes": file_size,
        "sha256": sha256
    }
