"""
Automated Scientific Tests for GROUNDSHIFT SAR Processing Engine.
Covers:
- Module 1: Product classification & workflow selection.
- Module 2: Data quality, NoData detection, reference-area offset anchoring.
- Module 3: InSAR displacement rate estimation (WLS), RMSE, and parameter uncertainties.
- Module 4: Spatial analysis and DBSCAN clustering of subsidence bowls.
- Module 5: Multi-mission comparison and viewing geometry compatibility validation.
- Module 6: Memory-safe GeoTIFF and CSV product generation with provenance.
"""

import pytest
import numpy as np
from pathlib import Path

from processing.product_classifier import (
    classify_sar_product,
    SARProductCategory,
    ScientificWorkflow,
)
from processing.quality_assurance import (
    detect_and_clean_nodata,
    apply_coherence_quality_mask,
    validate_acquisition_epochs,
    apply_reference_area_offset,
)
from processing.displacement_engine import (
    estimate_linear_rate_1d,
    check_los_to_vertical_admissibility,
)
from processing.spatial_analysis import (
    cluster_deformation_zones_dbscan,
    extract_valid_pixel_table,
)
from processing.multi_mission_comparator import (
    compare_sar_point_series,
    check_geometric_compatibility,
    ComparisonMetadata,
)
from processing.raster_exporter import (
    export_geotiff_map,
    export_points_csv,
)


# ------------------------------------------------------------------------------
# Module 1: Product Classification Tests
# ------------------------------------------------------------------------------

def test_classify_nisar_gunw():
    res = classify_sar_product("NISAR_L_PR_GUNW_001_005_A_089_20240915T004210.h5")
    assert res.category == SARProductCategory.NISAR_GUNW
    assert res.is_phase_preserved is True
    assert res.is_displacement_ready is True
    assert ScientificWorkflow.SURFACE_DEFORMATION_MAPPING in res.supported_workflows


def test_classify_nisar_gcov_rejection():
    """GCOV must NOT be accepted for displacement inversion."""
    res = classify_sar_product("NISAR_L_PR_GCOV_001_005_A_089_20240915T004210.h5")
    assert res.category == SARProductCategory.NISAR_GCOV
    assert res.is_displacement_ready is False
    assert len(res.rejection_reasons) > 0


def test_classify_sentinel1_grd_rejection():
    """GRD amplitude must be rejected from interferometric deformation."""
    res = classify_sar_product("S1A_IW_GRDH_1SDV_20240112T124530.SAFE")
    assert res.category == SARProductCategory.GRD
    assert res.is_phase_preserved is False
    assert res.is_displacement_ready is False
    assert "intensity" in res.rejection_reasons[0].lower()


def test_classify_opera_disp():
    res = classify_sar_product("OPERA_L3_DISP-S1_20230101_20230113.nc")
    assert res.category == SARProductCategory.OPERA_DISP
    assert res.is_displacement_ready is True


# ------------------------------------------------------------------------------
# Module 2: Data Quality & QA Tests
# ------------------------------------------------------------------------------

def test_detect_nodata():
    raw = np.array([1.5, -9999.0, np.nan, 2.5, np.inf])
    cleaned, valid_mask = detect_and_clean_nodata(raw, nodata_value=-9999.0)
    assert valid_mask.tolist() == [True, False, False, True, False]
    assert np.isnan(cleaned[1])


def test_coherence_quality_masking():
    disp = np.array([10.0, 12.0, 14.0, 16.0])
    coh = np.array([0.7, 0.2, 0.8, 0.9]) # Index 1 is below coherence 0.35
    res = apply_coherence_quality_mask(disp, coherence=coh, min_coherence=0.35)
    assert res.valid_pixels == 3
    assert res.valid_mask[1] == False


def test_epoch_validation():
    epochs = ["2023-01-01", "2023-06-01", "2024-01-01"]
    parsed, t_years, errors = validate_acquisition_epochs(epochs)
    assert len(errors) == 0
    assert len(parsed) == 3
    assert t_years[0] == 0.0
    assert 0.95 < t_years[2] < 1.05


def test_reference_area_offset():
    # 2 epochs, 10x10 grid with artificial datum bias of +5.0 mm
    cube = np.zeros((2, 10, 10))
    cube[0, :, :] = 5.0
    cube[1, :, :] = 8.0
    referenced, offsets = apply_reference_area_offset(cube, ref_y_slice=slice(4, 6), ref_x_slice=slice(4, 6))
    assert np.allclose(referenced[0, 5, 5], 0.0)
    assert np.allclose(offsets, [5.0, 8.0])


# ------------------------------------------------------------------------------
# Module 3: Displacement Rate Estimation Tests
# ------------------------------------------------------------------------------

def test_linear_rate_estimation():
    # True velocity: -20.0 mm/year, intercept: 5.0 mm
    t_years = np.array([0.0, 0.25, 0.5, 0.75, 1.0])
    d_true = 5.0 - 20.0 * t_years
    res = estimate_linear_rate_1d(t_years, d_true)
    assert res is not None
    assert np.isclose(res.velocity_mm_year, -20.0, atol=0.01)
    assert np.isclose(res.intercept_mm, 5.0, atol=0.01)
    assert res.rmse_mm < 0.01
    assert res.r_squared > 0.999
    assert res.is_statistically_significant is True


def test_los_to_vertical_prohibition():
    res = check_los_to_vertical_admissibility(incidence_angle_deg=39.0, has_paired_descending_track=False)
    assert res["is_admissible"] is False
    assert "PROHIBITION" in res["warning"]


# ------------------------------------------------------------------------------
# Module 4: Spatial DBSCAN Clustering Tests
# ------------------------------------------------------------------------------

def test_dbscan_clustering_subsidence():
    # Two distinct spatial clusters
    np.random.seed(42)
    # Cluster A (Chennai OMR)
    lons_a = np.random.normal(80.22, 0.005, 15)
    lats_a = np.random.normal(12.92, 0.005, 15)
    vels_a = np.full(15, -18.0)

    # Cluster B (Velachery)
    lons_b = np.random.normal(80.20, 0.005, 12)
    lats_b = np.random.normal(12.98, 0.005, 12)
    vels_b = np.full(12, -12.0)

    # Background stable points
    lons_bg = np.array([80.10, 80.12, 80.15])
    lats_bg = np.array([12.80, 12.82, 12.85])
    vels_bg = np.array([-0.5, -0.2, 0.1])

    all_lons = np.concatenate([lons_a, lons_b, lons_bg])
    all_lats = np.concatenate([lats_a, lats_b, lats_bg])
    all_vels = np.concatenate([vels_a, vels_b, vels_bg])

    res = cluster_deformation_zones_dbscan(all_lons, all_lats, all_vels, velocity_threshold_mm_year=5.0, eps_km=2.0)
    assert res["n_clusters"] == 2
    assert res["total_deformation_points"] == 27
    assert len(res["clusters"]) == 2


# ------------------------------------------------------------------------------
# Module 5: Multi-Mission Comparison Tests
# ------------------------------------------------------------------------------

def test_multi_mission_geometric_incompatibility():
    # Opposing tracks (Ascending vs Descending) must be flagged incompatible for scalar differencing
    compat, diff_deg, reason = check_geometric_compatibility(
        orbit_1="ASCENDING", orbit_2="DESCENDING",
        incidence_1=39.0, incidence_2=41.0,
        heading_1=348.0, heading_2=192.0
    )
    assert compat is False
    assert "OPPOSING ORBITS" in reason


def test_multi_mission_compatible_agreement():
    # Both ascending, similar geometry
    meta = ComparisonMetadata(
        mission_1="Sentinel-1", mission_2="NISAR L-band",
        sensor_band_1="C", sensor_band_2="L",
        wavelength_1_m=0.0555, wavelength_2_m=0.2384,
        orbit_direction_1="ASCENDING", orbit_direction_2="ASCENDING",
        incidence_angle_1_deg=39.0, incidence_angle_2_deg=38.0,
        heading_angle_1_deg=348.0, heading_angle_2_deg=349.0
    )
    obs1 = np.array([-15.0, -12.0, -18.0, -8.0, -5.0])
    obs2 = np.array([-14.5, -11.8, -17.5, -8.2, -4.8]) # highly correlated with small noise

    res = compare_sar_point_series(obs1, obs2, meta=meta)
    assert res["is_valid_comparison"] is True
    assert res["is_geometrically_compatible"] is True
    assert res["pearson_r"] > 0.99
    assert res["rmse_mm"] < 1.0
    assert res["is_statistically_consistent"] is True


# ------------------------------------------------------------------------------
# Module 6: Export Tests
# ------------------------------------------------------------------------------

def test_export_geotiff(tmp_path: Path):
    try:
        import rasterio
    except ImportError:
        pytest.skip("rasterio is not installed")
    data = np.ones((20, 20), dtype=np.float32) * -15.5
    bbox = (80.1, 12.9, 80.3, 13.1)
    res = export_geotiff_map(
        output_filename="test_velocity_map.tif",
        data=data,
        bbox=bbox,
        classification="BENCHMARK_SYNTHETIC"
    )
    assert Path(res["output_path"]).exists()
    assert res["sha256"] is not None
    assert res["dimensions"] == [20, 20]
    assert res["provenance_manifest"]["classification"] == "BENCHMARK_SYNTHETIC"


def test_export_csv():
    lons = np.array([80.22, 80.23])
    lats = np.array([12.92, 12.93])
    vels = np.array([-18.5, -17.2])
    res = export_points_csv(
        output_filename="test_deformation_points.csv",
        lons=lons,
        lats=lats,
        velocities_mm_year=vels,
        classification="BENCHMARK_SYNTHETIC"
    )
    assert Path(res["output_path"]).exists()
    assert res["row_count"] == 2

