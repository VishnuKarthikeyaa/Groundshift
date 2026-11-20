"""
Comprehensive Automated Tests for GROUNDSHIFT Multi-Mission Validation and Comparison Engine.
Validates:
- Spatial alignment and footprint intersection.
- Temporal baseline separation and overlap calculation.
- Statistical metrics: Mean, Median, StdDev, RMSE, MAE, Pearson r, Spearman rho.
- Measurement uncertainty propagation and missing uncertainty detection.
- GNSS 3D-to-LOS projection and physical ground-truth validation.
- Research report generation and research integrity guardrails.
"""

import pytest
import numpy as np

from processing.spatial_alignment import compute_spatial_overlap
from processing.temporal_alignment import evaluate_temporal_alignment
from processing.validation_engine import compute_validation_statistics
from processing.gnss_benchmark_reference import (
    REFERENCE_GNSS_NETWORK,
    project_gnss_to_los,
    validate_sar_against_gnss,
)
from processing.report_generator import generate_markdown_validation_report


# ------------------------------------------------------------------------------
# 1. Spatial Alignment Tests
# ------------------------------------------------------------------------------

def test_spatial_overlap_calculation():
    # Chennai bounding box with overlapping sub-region
    bbox1 = (80.0, 12.8, 80.4, 13.2)
    bbox2 = (80.2, 12.9, 80.6, 13.3)
    res = compute_spatial_overlap(bbox1, bbox2)
    assert res.is_overlapping is True
    assert res.intersection_area_km2 > 0.0
    assert 0.0 < res.overlap_percentage_1 < 100.0
    assert 0.0 < res.overlap_percentage_2 < 100.0
    assert "Resampling justified" in res.resampling_justification


def test_spatial_non_overlapping():
    # Completely disjoint regions
    bbox1 = (80.0, 12.8, 80.4, 13.2)
    bbox2 = (85.0, 15.0, 85.4, 15.4)
    res = compute_spatial_overlap(bbox1, bbox2)
    assert res.is_overlapping is False
    assert res.intersection_area_km2 == 0.0
    assert res.overlap_percentage_1 == 0.0


# ------------------------------------------------------------------------------
# 2. Temporal Alignment Tests
# ------------------------------------------------------------------------------

def test_temporal_compatible_epochs():
    ep1 = ["2023-01-05", "2023-01-17", "2023-01-29"]
    ep2 = ["2023-01-08", "2023-01-20", "2023-02-01"]
    res = evaluate_temporal_alignment(ep1, ep2, max_pairwise_separation_days=5.0)
    assert res.is_temporally_compatible is True
    assert res.temporal_separation_days == 3.0
    assert res.matched_epoch_count == 3
    assert res.temporal_warning is None


def test_temporal_incompatible_separation():
    ep1 = ["2021-05-01"]
    ep2 = ["2023-05-01"]
    res = evaluate_temporal_alignment(ep1, ep2, max_pairwise_separation_days=12.0)
    assert res.is_temporally_compatible is False
    assert res.temporal_separation_days > 700.0
    assert "INSUFFICIENT TEMPORAL PROXIMITY" in res.temporal_warning


# ------------------------------------------------------------------------------
# 3. Statistical Validation Metrics Tests
# ------------------------------------------------------------------------------

def test_statistical_metrics_exact_agreement():
    # Identical values
    obs1 = np.array([10.0, 20.0, 30.0, 40.0, 50.0])
    obs2 = np.array([10.0, 20.0, 30.0, 40.0, 50.0])
    stats = compute_validation_statistics(obs1, obs2)

    assert stats.valid_count == 5
    assert stats.mean_difference_bias == 0.0
    assert stats.median_difference == 0.0
    assert stats.rmse == 0.0
    assert stats.mae == 0.0
    assert stats.std_difference == 0.0
    assert np.isclose(stats.pearson_r, 1.0)
    assert np.isclose(stats.spearman_rho, 1.0)
    assert np.isclose(stats.r_squared, 1.0)


def test_statistical_metrics_synthetic_bias_and_noise():
    # Known bias: +3.0 mm, with linear gradient
    obs1 = np.array([5.0, 10.0, 15.0, 20.0, 25.0])
    obs2 = np.array([2.0, 7.0, 12.0, 17.0, 22.0])
    stats = compute_validation_statistics(obs1, obs2)

    assert stats.valid_count == 5
    assert np.isclose(stats.mean_difference_bias, 3.0)
    assert np.isclose(stats.median_difference, 3.0)
    assert np.isclose(stats.mae, 3.0)
    assert np.isclose(stats.rmse, 3.0)
    assert np.isclose(stats.std_difference, 0.0) # all differences identical
    assert np.isclose(stats.pearson_r, 1.0)


def test_statistical_minimum_observation_threshold():
    # Less than 3 observations must raise ValueError
    with pytest.raises(ValueError, match="Insufficient overlapping"):
        compute_validation_statistics(np.array([1.0, 2.0]), np.array([1.0, 2.0]))


# ------------------------------------------------------------------------------
# 4. Uncertainty & Research Integrity Tests
# ------------------------------------------------------------------------------

def test_uncertainty_propagation():
    obs1 = np.array([10.0, 15.0, 20.0, 25.0])
    obs2 = np.array([9.5, 14.8, 19.5, 24.9])
    unc1 = np.array([1.0, 1.0, 1.0, 1.0])
    unc2 = np.array([1.0, 1.0, 1.0, 1.0])

    stats = compute_validation_statistics(obs1, obs2, uncertainties_1=unc1, uncertainties_2=unc2)
    assert stats.missing_uncertainty_flag is False
    # sqrt(1^2 + 1^2) = 1.414
    assert np.isclose(stats.propagated_measurement_sigma, 1.414, atol=0.01)


def test_missing_uncertainty_detection():
    obs1 = np.array([10.0, 15.0, 20.0, 25.0])
    obs2 = np.array([9.5, 14.8, 19.5, 24.9])
    stats = compute_validation_statistics(obs1, obs2, uncertainties_1=None, uncertainties_2=None)
    assert stats.missing_uncertainty_flag is True
    assert stats.propagated_measurement_sigma is None


def test_research_integrity_classification():
    # Comparing two satellite datasets without ground truth:
    # Must be categorized as INTER_MISSION_CONSISTENCY_CHECK, NEVER IN_SITU_GROUND_TRUTH_VALIDATION
    obs1 = np.array([10.0, 15.0, 20.0, 25.0])
    obs2 = np.array([10.0, 15.0, 20.0, 25.0])
    stats = compute_validation_statistics(obs1, obs2, has_independent_ground_truth=False)
    assert stats.validation_type == "INTER_MISSION_CONSISTENCY_CHECK"
    assert "relative" in stats.research_integrity_statement.lower()

    # When validated against ground truth (e.g. GNSS):
    stats_gt = compute_validation_statistics(obs1, obs2, has_independent_ground_truth=True)
    assert stats_gt.validation_type == "IN_SITU_GROUND_TRUTH_VALIDATION"


# ------------------------------------------------------------------------------
# 5. GNSS Ground Reference Validation Tests
# ------------------------------------------------------------------------------

def test_gnss_projection_to_los():
    # Pure vertical subsidence of -20 mm/yr at 39.2 deg incidence:
    # v_los = v_u * cos(theta) = -20 * cos(39.2 deg) = -15.50 mm/yr
    v_los, sigma_los = project_gnss_to_los(
        v_east=42.0, v_north=31.0, v_up=-20.0,
        sigma_east=0.8, sigma_north=0.8, sigma_up=1.5,
        incidence_angle_deg=39.2, heading_angle_deg=348.5,
        remove_tectonic_plate_motion=True,
        plate_v_east=42.0, plate_v_north=31.0
    )
    expected_los = -20.0 * np.cos(np.radians(39.2))
    assert np.isclose(v_los, expected_los, atol=0.05)
    assert sigma_los > 0.0


def test_gnss_validation_workflow():
    station = REFERENCE_GNSS_NETWORK[1] # OMR_VAL (-17.4 mm/yr vertical)
    # Simulate matching SAR measurement
    sar_v = -17.4 * np.cos(np.radians(39.2)) # approx -13.48 mm/yr
    res = validate_sar_against_gnss(
        sar_velocity_los_mm_year=sar_v,
        sar_uncertainty_mm_year=1.2,
        station=station,
        incidence_deg=39.2,
        heading_deg=348.5
    )
    assert res["is_consistent_with_gnss"] is True
    assert res["normalized_chi"] < 1.0
    assert res["validation_grade"] == "PASSED_95_CONFIDENCE"


# ------------------------------------------------------------------------------
# 6. Report Generation Tests
# ------------------------------------------------------------------------------

def test_generate_validation_report():
    stats_dict = {
        "valid_count": 150,
        "mean_difference_bias": 0.42,
        "median_difference": 0.38,
        "std_difference": 1.25,
        "rmse": 1.32,
        "mae": 0.95,
        "pearson_r": 0.965,
        "pearson_p_value": 1e-12,
        "spearman_rho": 0.958,
        "r_squared": 0.931,
        "confidence_tier": "MODERATE_CONSISTENCY",
        "missing_uncertainty_flag": False,
        "propagated_measurement_sigma": 1.41,
        "model_scatter_sigma": 0.10,
        "research_integrity_statement": "Never describe cross-mission agreement as proof of absolute accuracy."
    }

    report = generate_markdown_validation_report(
        report_title="Sentinel-1 vs NISAR Validation Report",
        mission_1="Sentinel-1",
        mission_2="NISAR L-band",
        product_type_1="SLC",
        product_type_2="RSLC",
        time_span_1="2023-01 to 2024-05",
        time_span_2="2023-01 to 2024-05",
        study_area="Chennai Coastal Corridor",
        spatial_overlap_km2=512.0,
        overlap_pct=85.0,
        temporal_sep_days=4.0,
        look_vector_divergence_deg=1.5,
        stats_dict=stats_dict,
        has_gnss=False
    )

    assert "# GROUNDSHIFT Scientific Validation" in report
    assert "Mean Difference (Bias)" in report
    assert "0.42 mm/yr" in report
    assert "Research Integrity Disclosures" in report
    assert "Relative Consistency vs. Absolute Truth" in report

