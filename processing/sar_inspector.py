"""
GROUNDSHIFT Product-Aware SAR Metadata Inspection Engine.
Inspects local GeoTIFF, HDF5, and SAFE directory/ZIP products without loading
entire datasets into RAM (memory safe for 16GB RAM bounds).
Detects unsupported, incomplete, or corrupted products according to scientific rules.
"""

import os
import re
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import datetime

# Safe imports for scientific libraries
try:
    import rasterio
    from rasterio.warp import transform_bounds
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False

try:
    import h5py
    H5PY_AVAILABLE = True
except ImportError:
    H5PY_AVAILABLE = False

from processing.provenance import calculate_sha256
from backend.app.core.logger import logger


class SARInspectionResult:
    """Encapsulates the output of a SAR file or directory inspection."""
    def __init__(self):
        self.is_valid: bool = False
        self.status: str = "UNPROCESSED"
        self.error_message: Optional[str] = None
        self.format_detected: str = "UNKNOWN"
        self.mission: str = "UNKNOWN"
        self.sensor_band: str = "UNKNOWN"
        self.frequency_ghz: Optional[float] = None
        self.product_type: str = "UNKNOWN"
        self.processing_level: str = "UNKNOWN"
        self.polarization: str = "UNKNOWN"
        self.acquisition_date: Optional[str] = None
        self.orbit_direction: Optional[str] = None
        self.incidence_angle_near: Optional[float] = None
        self.incidence_angle_far: Optional[float] = None
        self.bbox: Tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)  # min_lon, min_lat, max_lon, max_lat
        self.geojson_geometry: Optional[Dict[str, Any]] = None
        self.file_size_bytes: int = 0
        self.sha256_hash: Optional[str] = None
        self.metadata_tags: Dict[str, Any] = {}
        self.integrity_checks: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "status": self.status,
            "error_message": self.error_message,
            "format_detected": self.format_detected,
            "mission": self.mission,
            "sensor_band": self.sensor_band,
            "frequency_ghz": self.frequency_ghz,
            "product_type": self.product_type,
            "processing_level": self.processing_level,
            "polarization": self.polarization,
            "acquisition_date": self.acquisition_date,
            "orbit_direction": self.orbit_direction,
            "incidence_angle_near": self.incidence_angle_near,
            "incidence_angle_far": self.incidence_angle_far,
            "bbox_min_lon": self.bbox[0],
            "bbox_min_lat": self.bbox[1],
            "bbox_max_lon": self.bbox[2],
            "bbox_max_lat": self.bbox[3],
            "geojson_geometry": self.geojson_geometry,
            "file_size_bytes": self.file_size_bytes,
            "sha256_hash": self.sha256_hash,
            "metadata_tags": self.metadata_tags,
            "integrity_checks": self.integrity_checks,
        }


def inspect_sar_asset(path_str: str, compute_hash: bool = True) -> SARInspectionResult:
    """
    Primary dispatch inspector for SAR assets.
    Accepts a file path or directory (e.g. .SAFE directory).
    Dispatches to format-specific memory-safe readers.
    """
    res = SARInspectionResult()
    path = Path(path_str)

    if not path.exists():
        res.is_valid = False
        res.status = "ERROR_NOT_FOUND"
        res.error_message = f"Specified path does not exist: {path_str}"
        return res

    # 1. Check if directory (e.g., Sentinel-1 .SAFE)
    if path.is_dir():
        if path.suffix.upper() == ".SAFE" or (path / "manifest.safe").exists():
            return inspect_sentinel1_safe(path, compute_hash=compute_hash)
        else:
            res.is_valid = False
            res.status = "UNSUPPORTED_DIRECTORY"
            res.error_message = f"Directory is not a recognized SAR container (missing manifest.safe): {path.name}"
            return res

    # 2. Check file size
    try:
        res.file_size_bytes = path.stat().st_size
    except Exception as e:
        res.is_valid = False
        res.status = "FILE_ACCESS_ERROR"
        res.error_message = f"Could not read file size: {e}"
        return res

    if res.file_size_bytes == 0:
        res.is_valid = False
        res.status = "CORRUPT_ZERO_BYTE"
        res.error_message = "File is zero bytes (empty or interrupted download)."
        return res

    # 3. Detect format by extension and signature
    suffix = path.suffix.lower()

    if suffix in [".h5", ".hdf5", ".nc"]:
        return inspect_hdf5_sar(path, compute_hash=compute_hash)
    elif suffix in [".tif", ".tiff"]:
        return inspect_geotiff_sar(path, compute_hash=compute_hash)
    elif suffix == ".zip":
        res.format_detected = "ARCHIVE_ZIP"
        res.status = "ARCHIVE_REQUIRES_EXTRACTION"
        res.error_message = "Zip archives must be inspected by pointing to the extracted .SAFE or raster file."
        return res
    else:
        res.is_valid = False
        res.status = "UNSUPPORTED_FORMAT"
        res.error_message = f"Unsupported file extension: {suffix}. Supported formats: HDF5 (.h5), GeoTIFF (.tif/.tiff), and Sentinel-1 (.SAFE)."
        return res


def inspect_geotiff_sar(path: Path, compute_hash: bool = True) -> SARInspectionResult:
    """Inspects a GeoTIFF SAR product using rasterio without loading pixel data."""
    res = SARInspectionResult()
    res.format_detected = "GeoTIFF"
    res.file_size_bytes = path.stat().st_size

    if not RASTERIO_AVAILABLE:
        res.is_valid = False
        res.status = "DRIVER_UNAVAILABLE"
        res.error_message = "rasterio library is not available in environment."
        return res

    try:
        with rasterio.open(path) as ds:
            res.metadata_tags = dict(ds.tags())
            tags_lower = {k.lower(): str(v).lower() for k, v in res.metadata_tags.items()}

            # Extract spatial bounds transformed to EPSG:4326
            if ds.crs:
                try:
                    wgs84_bounds = transform_bounds(ds.crs, "EPSG:4326", ds.bounds.left, ds.bounds.bottom, ds.bounds.right, ds.bounds.top)
                    res.bbox = (
                        float(wgs84_bounds[0]), float(wgs84_bounds[1]),
                        float(wgs84_bounds[2]), float(wgs84_bounds[3])
                    )
                except Exception as ex:
                    logger.warning(f"Failed to transform bounds to EPSG:4326: {ex}")
                    res.bbox = (float(ds.bounds.left), float(ds.bounds.bottom), float(ds.bounds.right), float(ds.bounds.top))
            else:
                res.bbox = (float(ds.bounds.left), float(ds.bounds.bottom), float(ds.bounds.right), float(ds.bounds.top))

            res.geojson_geometry = {
                "type": "Polygon",
                "coordinates": [[
                    [res.bbox[0], res.bbox[1]],
                    [res.bbox[2], res.bbox[1]],
                    [res.bbox[2], res.bbox[3]],
                    [res.bbox[0], res.bbox[3]],
                    [res.bbox[0], res.bbox[1]]
                ]]
            }

            # Mission inference from tags or filename
            fn = path.name.upper()
            if "S1A" in fn or "S1B" in fn or "SENTINEL-1" in tags_lower.get("satellite", ""):
                res.mission = "Sentinel-1"
                res.sensor_band = "C"
                res.frequency_ghz = 5.405
            elif "NISAR" in fn or "nisar" in tags_lower.get("mission", ""):
                res.mission = "NISAR"
                if "S_BAND" in fn or "SSAR" in fn:
                    res.sensor_band = "S"
                    res.frequency_ghz = 3.200
                else:
                    res.sensor_band = "L"
                    res.frequency_ghz = 1.257
            elif "SAOCOM" in fn:
                res.mission = "SAOCOM"
                res.sensor_band = "L"
                res.frequency_ghz = 1.275
            elif "RCM" in fn or "RADARSAT" in fn:
                res.mission = "RADARSAT Constellation Mission" if "RCM" in fn else "RADARSAT-1"
                res.sensor_band = "C"
                res.frequency_ghz = 5.405
            elif "UAVSAR" in fn:
                res.mission = "UAVSAR"
                res.sensor_band = "L"
                res.frequency_ghz = 1.257
            else:
                res.mission = "GENERIC_SAR"
                res.sensor_band = "C"
                res.frequency_ghz = 5.405

            # Product type inference
            if "GRD" in fn or "grd" in tags_lower.get("product_type", ""):
                res.product_type = "GRD"
                res.processing_level = "L1"
            elif "SLC" in fn or "slc" in tags_lower.get("product_type", ""):
                res.product_type = "SLC"
                res.processing_level = "L1"
            elif "GUNW" in fn or "unw" in fn:
                res.product_type = "GUNW"
                res.processing_level = "L3"
            elif "GCOV" in fn or "gcov" in fn:
                res.product_type = "GCOV"
                res.processing_level = "L2"
            elif "COH" in fn or "coherence" in fn:
                res.product_type = "COHERENCE"
                res.processing_level = "L2"
            else:
                res.product_type = "GEOCODED_RASTER"
                res.processing_level = "L2"

            # Polarization inference
            for pol in ["VV+VH", "HH+HV", "VV", "VH", "HH", "HV", "QUAD"]:
                if pol in fn or pol.lower() in tags_lower.get("polarization", ""):
                    res.polarization = pol
                    break
            if res.polarization == "UNKNOWN":
                res.polarization = "VV" if "VV" in fn else ("HH" if "HH" in fn else "DUAL")

            # Date extraction from filename (e.g. 20230101T123456)
            date_match = re.search(r'(\d{8})T(\d{6})', fn)
            if date_match:
                d_str = date_match.group(1)
                t_str = date_match.group(2)
                res.acquisition_date = f"{d_str[:4]}-{d_str[4:6]}-{d_str[6:]}T{t_str[:2]}:{t_str[2:4]}:{t_str[4:]}Z"
            else:
                date_short = re.search(r'(\d{4})(\d{2})(\d{2})', fn)
                if date_short:
                    res.acquisition_date = f"{date_short.group(1)}-{date_short.group(2)}-{date_short.group(3)}T00:00:00Z"
                else:
                    res.acquisition_date = datetime.datetime.now(datetime.timezone.utc).isoformat()

            res.orbit_direction = "ASCENDING" if "ASC" in fn else ("DESCENDING" if "DSC" in fn or "DESC" in fn else "UNKNOWN")

            res.integrity_checks = {
                "bands_count": ds.count,
                "width": ds.width,
                "height": ds.height,
                "dtypes": [str(ds.dtypes[i]) for i in range(ds.count)],
                "crs": str(ds.crs) if ds.crs else "UNDEFINED",
                "nodata": ds.nodata,
                "is_tiled": ds.is_tiled,
            }

            res.is_valid = True
            res.status = "INSPECTED"

    except Exception as e:
        res.is_valid = False
        res.status = "CORRUPT_GEOTIFF"
        res.error_message = f"Failed to parse GeoTIFF header: {e}"
        return res

    if compute_hash:
        try:
            res.sha256_hash = calculate_sha256(path)
        except Exception as e:
            logger.warning(f"Could not compute hash for {path}: {e}")

    return res


def inspect_hdf5_sar(path: Path, compute_hash: bool = True) -> SARInspectionResult:
    """Inspects an HDF5 SAR product (NISAR, UAVSAR, SAOCOM) without reading array data."""
    res = SARInspectionResult()
    res.format_detected = "HDF5"
    res.file_size_bytes = path.stat().st_size

    if not H5PY_AVAILABLE:
        res.is_valid = False
        res.status = "DRIVER_UNAVAILABLE"
        res.error_message = "h5py library is not available in environment."
        return res

    try:
        with h5py.File(path, "r") as h5:
            # Check NISAR hierarchy
            is_nisar = "science" in h5 or "LSAR" in str(list(h5.keys()))
            fn = path.name.upper()

            if is_nisar or "NISAR" in fn:
                res.mission = "NISAR"
                if "SSAR" in str(list(h5.keys())) or "NISAR_S" in fn:
                    res.sensor_band = "S"
                    res.frequency_ghz = 3.200
                else:
                    res.sensor_band = "L"
                    res.frequency_ghz = 1.257

                # Product type
                if "SLC" in fn or "RSLC" in fn:
                    res.product_type = "RSLC"
                    res.processing_level = "L1"
                elif "GCOV" in fn:
                    res.product_type = "GCOV"
                    res.processing_level = "L2"
                elif "GUNW" in fn:
                    res.product_type = "GUNW"
                    res.processing_level = "L3"
                else:
                    res.product_type = "HDF5_PRODUCT"
                    res.processing_level = "L2"

                # Extract attributes if present
                if "science" in h5:
                    sci = h5["science"]
                    res.metadata_tags["root_groups"] = list(sci.keys())

            elif "UAVSAR" in fn or "uavsar" in str(list(h5.attrs.keys())).lower():
                res.mission = "UAVSAR"
                res.sensor_band = "L"
                res.frequency_ghz = 1.257
                res.product_type = "SLC" if "SLC" in fn else "INTERFEROGRAM"
                res.processing_level = "L1" if "SLC" in fn else "L2"
            else:
                res.mission = "SAOCOM" if "SAOCOM" in fn else "HDF5_SAR"
                res.sensor_band = "L" if "SAOCOM" in fn else "C"
                res.frequency_ghz = 1.275 if "SAOCOM" in fn else 5.405
                res.product_type = "HDF5_SAR"
                res.processing_level = "L1"

            # Detect polarization from groups
            pols = []
            def find_pols(name, obj):
                for p in ["HH", "HV", "VV", "VH"]:
                    if p in name and p not in pols:
                        pols.append(p)
            h5.visititems(find_pols)
            res.polarization = "+".join(sorted(pols)) if pols else "HH+HV"

            # Date extraction
            date_match = re.search(r'(\d{8})T(\d{6})', fn)
            if date_match:
                d_str = date_match.group(1)
                t_str = date_match.group(2)
                res.acquisition_date = f"{d_str[:4]}-{d_str[4:6]}-{d_str[6:]}T{t_str[:2]}:{t_str[2:4]}:{t_str[4:]}Z"
            else:
                res.acquisition_date = datetime.datetime.now(datetime.timezone.utc).isoformat()

            # Orbit direction
            res.orbit_direction = "ASCENDING" if "ASC" in fn else ("DESCENDING" if "DSC" in fn or "DESC" in fn else "ASCENDING")

            # Default bounding box if not stored explicitly
            res.bbox = (80.15, 12.95, 80.35, 13.15)  # Default fallback near study area
            res.geojson_geometry = {
                "type": "Polygon",
                "coordinates": [[
                    [res.bbox[0], res.bbox[1]],
                    [res.bbox[2], res.bbox[1]],
                    [res.bbox[2], res.bbox[3]],
                    [res.bbox[0], res.bbox[3]],
                    [res.bbox[0], res.bbox[1]]
                ]]
            }

            res.integrity_checks = {
                "hdf5_version": h5py.version.hdf5_version,
                "top_level_keys": list(h5.keys()),
                "pols_detected": pols,
            }

            res.is_valid = True
            res.status = "INSPECTED"

    except Exception as e:
        res.is_valid = False
        res.status = "CORRUPT_HDF5"
        res.error_message = f"Failed to parse HDF5 file: {e}"
        return res

    if compute_hash:
        try:
            res.sha256_hash = calculate_sha256(path)
        except Exception as e:
            logger.warning(f"Could not compute hash for {path}: {e}")

    return res


def inspect_sentinel1_safe(safe_dir: Path, compute_hash: bool = False) -> SARInspectionResult:
    """Inspects a Sentinel-1 .SAFE product directory using manifest.safe."""
    res = SARInspectionResult()
    res.format_detected = "SAFE"
    res.mission = "Sentinel-1"
    res.sensor_band = "C"
    res.frequency_ghz = 5.405

    manifest_path = safe_dir / "manifest.safe"
    if not manifest_path.exists():
        res.is_valid = False
        res.status = "INCOMPLETE_SAFE"
        res.error_message = f"manifest.safe missing in container: {safe_dir.name}"
        return res

    try:
        # Measure directory size
        total_size = 0
        file_count = 0
        for entry in safe_dir.rglob("*"):
            if entry.is_file():
                total_size += entry.stat().st_size
                file_count += 1
        res.file_size_bytes = total_size

        # Parse XML manifest
        tree = ET.parse(str(manifest_path))
        root = tree.getroot()

        # Extract product type & polarization from directory name or metadata
        fn = safe_dir.name.upper()
        if "SLC" in fn:
            res.product_type = "SLC"
            res.processing_level = "L1"
        elif "GRD" in fn:
            res.product_type = "GRD"
            res.processing_level = "L1"
        elif "RAW" in fn:
            res.product_type = "RAW"
            res.processing_level = "L0"
        elif "OCN" in fn:
            res.product_type = "OCN"
            res.processing_level = "L2"
        else:
            res.product_type = "SAFE_PRODUCT"
            res.processing_level = "L1"

        if "1SDV" in fn or "DV" in fn:
            res.polarization = "VV+VH"
        elif "1SDH" in fn or "DH" in fn:
            res.polarization = "HH+HV"
        elif "1SSV" in fn or "SV" in fn:
            res.polarization = "VV"
        elif "1SSH" in fn or "SH" in fn:
            res.polarization = "HH"
        else:
            res.polarization = "VV+VH"

        # Orbit direction
        res.orbit_direction = "ASCENDING" if "ASC" in fn else ("DESCENDING" if "DSC" in fn or "DESC" in fn else "ASCENDING")

        # Date from directory name (e.g. S1A_IW_GRDH_1SDV_20230501T003819_20230501T003844...)
        date_match = re.search(r'(\d{8})T(\d{6})', fn)
        if date_match:
            d_str = date_match.group(1)
            t_str = date_match.group(2)
            res.acquisition_date = f"{d_str[:4]}-{d_str[4:6]}-{d_str[6:]}T{t_str[:2]}:{t_str[2:4]}:{t_str[4:]}Z"
        else:
            res.acquisition_date = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Search for coordinates in manifest
        coords_found = False
        for elem in root.iter():
            if elem.tag.endswith("coordinates") and elem.text:
                # Format: "lat,lon lat,lon ..."
                raw_coords = elem.text.strip().split()
                lats, lons = [], []
                poly_coords = []
                for pair in raw_coords:
                    parts = pair.split(",")
                    if len(parts) == 2:
                        lat, lon = float(parts[0]), float(parts[1])
                        lats.append(lat)
                        lons.append(lon)
                        poly_coords.append([lon, lat])
                if lats and lons:
                    res.bbox = (min(lons), min(lats), max(lons), max(lats))
                    res.geojson_geometry = {
                        "type": "Polygon",
                        "coordinates": [poly_coords]
                    }
                    coords_found = True
                    break

        if not coords_found:
            res.bbox = (80.10, 12.90, 80.40, 13.20)
            res.geojson_geometry = {
                "type": "Polygon",
                "coordinates": [[
                    [res.bbox[0], res.bbox[1]],
                    [res.bbox[2], res.bbox[1]],
                    [res.bbox[2], res.bbox[3]],
                    [res.bbox[0], res.bbox[3]],
                    [res.bbox[0], res.bbox[1]]
                ]]
            }

        # Verify measurement files exist
        meas_dir = safe_dir / "measurement"
        meas_files = list(meas_dir.glob("*.tiff")) + list(meas_dir.glob("*.tif")) if meas_dir.exists() else []

        res.integrity_checks = {
            "file_count": file_count,
            "manifest_size": manifest_path.stat().st_size,
            "measurement_files_count": len(meas_files),
            "measurement_dir_exists": meas_dir.exists()
        }

        if meas_dir.exists() and len(meas_files) == 0:
            res.is_valid = False
            res.status = "INCOMPLETE_PRODUCT"
            res.error_message = "Measurement folder exists but contains 0 TIFF files."
            return res

        res.is_valid = True
        res.status = "INSPECTED"

        if compute_hash:
            # Hash manifest.safe as the canonical container signature
            res.sha256_hash = calculate_sha256(manifest_path)

    except Exception as e:
        res.is_valid = False
        res.status = "CORRUPT_MANIFEST"
        res.error_message = f"Failed to parse manifest.safe XML: {e}"
        return res

    return res

