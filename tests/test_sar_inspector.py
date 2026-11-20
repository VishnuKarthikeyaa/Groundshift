"""
Tests for GROUNDSHIFT Product-Aware SAR Metadata Inspection Engine.
Validates GeoTIFF, HDF5, and SAFE directory inspection, memory safety,
and detection of corrupted or incomplete files.
"""

import pytest
import numpy as np
from pathlib import Path
import tempfile
try:
    import rasterio
    from rasterio.transform import from_bounds
    _has_rasterio = True
except ImportError:
    rasterio = None
    from_bounds = None
    _has_rasterio = False

try:
    import h5py
    _has_h5py = True
except ImportError:
    h5py = None
    _has_h5py = False

from processing.sar_inspector import (
    inspect_sar_asset,
    inspect_geotiff_sar,
    inspect_hdf5_sar,
    inspect_sentinel1_safe,
)


@pytest.fixture
def sample_geotiff(tmp_path: Path) -> Path:
    """Creates a synthetic small GeoTIFF with SAR metadata."""
    if not _has_rasterio:
        pytest.skip("rasterio not installed")
    tif_path = tmp_path / "S1A_IW_GRDH_1SDV_20230501T003819_test.tif"
    width, height = 50, 50
    transform = from_bounds(80.1, 12.9, 80.3, 13.1, width, height)
    data = np.ones((1, height, width), dtype=np.float32) * 0.25

    with rasterio.open(
        tif_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype=np.float32,
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(data)
        dst.update_tags(
            POLARIZATION="VV",
            PRODUCT_TYPE="GRD",
            SATELLITE="SENTINEL-1A",
        )

    return tif_path


@pytest.fixture
def sample_hdf5_nisar(tmp_path: Path) -> Path:
    """Creates a synthetic small HDF5 file with NISAR L-band structure."""
    if not _has_h5py:
        pytest.skip("h5py not installed")
    h5_path = tmp_path / "NISAR_L_PR_RSLC_001_005_A_089_20240915T004210_test.h5"
    with h5py.File(h5_path, "w") as f:
        sci = f.create_group("science/LSAR/SLC/swaths/frequencyA")
        # Store tiny complex array
        c_data = np.zeros((10, 10), dtype=np.complex64)
        sci.create_dataset("HH", data=c_data)
        sci.create_dataset("HV", data=c_data)
        ident = f.create_group("science/LSAR/identification")
        ident.attrs["mission"] = "NISAR"
    return h5_path


@pytest.fixture
def sample_sentinel1_safe(tmp_path: Path) -> Path:
    """Creates a synthetic Sentinel-1 .SAFE folder with manifest.safe."""
    safe_dir = tmp_path / "S1A_IW_SLC__1SDV_20240112T124530_TEST.SAFE"
    safe_dir.mkdir(parents=True)
    meas_dir = safe_dir / "measurement"
    meas_dir.mkdir(parents=True)

    # Create dummy measurement TIFF
    dummy_tiff = meas_dir / "s1a-iw1-slc-vv-20240112.tiff"
    dummy_tiff.write_bytes(b"II*\x00" + b"\x00" * 1024)

    # Create manifest.safe XML
    manifest_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <xfdu:XFDU xmlns:xfdu="urn:ccsds:schema:xfdu:1">
      <metadataSection>
        <coordinates>12.8,80.1 12.8,80.4 13.2,80.4 13.2,80.1</coordinates>
      </metadataSection>
    </xfdu:XFDU>
    """
    (safe_dir / "manifest.safe").write_text(manifest_xml, encoding="utf-8")
    return safe_dir


def test_inspect_geotiff(sample_geotiff: Path):
    """Verifies GeoTIFF inspection extracts bounding box, mission, and band."""
    res = inspect_sar_asset(str(sample_geotiff))
    assert res.is_valid is True
    assert res.format_detected == "GeoTIFF"
    assert res.mission == "Sentinel-1"
    assert res.sensor_band == "C"
    assert res.frequency_ghz == 5.405
    assert res.product_type == "GRD"
    assert res.polarization in ["VV", "VV+VH"]
    assert res.bbox[0] < res.bbox[2]
    assert res.sha256_hash is not None
    assert len(res.sha256_hash) == 64


def test_inspect_hdf5_nisar(sample_hdf5_nisar: Path):
    """Verifies HDF5 inspection detects NISAR hierarchy and polarizations."""
    res = inspect_sar_asset(str(sample_hdf5_nisar))
    assert res.is_valid is True
    assert res.format_detected == "HDF5"
    assert res.mission == "NISAR"
    assert res.sensor_band == "L"
    assert res.frequency_ghz == 1.257
    assert res.product_type == "RSLC"
    assert "HH" in res.polarization
    assert res.sha256_hash is not None


def test_inspect_sentinel1_safe(sample_sentinel1_safe: Path):
    """Verifies SAFE directory inspection parses manifest.safe and measurements."""
    res = inspect_sar_asset(str(sample_sentinel1_safe))
    assert res.is_valid is True
    assert res.format_detected == "SAFE"
    assert res.mission == "Sentinel-1"
    assert res.product_type == "SLC"
    assert res.polarization == "VV+VH"
    assert res.integrity_checks["measurement_files_count"] == 1


def test_inspect_corrupt_or_missing_file(tmp_path: Path):
    """Ensures corrupt or zero-byte files are flagged and never crash the engine."""
    empty_file = tmp_path / "empty_file.tif"
    empty_file.touch()

    res_empty = inspect_sar_asset(str(empty_file))
    assert res_empty.is_valid is False
    assert res_empty.status == "CORRUPT_ZERO_BYTE"

    res_missing = inspect_sar_asset(str(tmp_path / "non_existent.h5"))
    assert res_missing.is_valid is False
    assert res_missing.status == "ERROR_NOT_FOUND"

