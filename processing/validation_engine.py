"""
GROUNDSHIFT Multi-Mission Statistical Validation & Comparison Engine.
Performs rigorous statistical comparison, uncertainty propagation,
confidence tiering, and research integrity checks.

Research Integrity Rules:
- Never describe cross-mission agreement as proof of absolute accuracy.
- Never claim validation when only two unverified satellite products are compared.
- Never invent validation statistics.
- Distinguish between INTER_MISSION_CONSISTENCY_CHECK and IN_SITU_GROUND_TRUTH_VALIDATION.
"""

import numpy as np
from scipy import stats
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class ValidationStatistics:
    valid_count: int
    mean_difference_bias: float
    median_difference: float
    std_difference: float
    rmse: float
    mae: float
    pearson_r: float
    pearson_p_value: float
    spearman_rho: float
    spearman_p_value: float
    r_squared: float
    propagated_measurement_sigma: Optional[float]
    model_scatter_sigma: float
    missing_uncertainty_flag: bool
    confidence_tier: str
    validation_type: str
    research_integrity_statement: str


def compute_validation_statistics(
    observations_1: np.ndarray,
    observations_2: np.ndarray,
    uncertainties_1: Optional[np.ndarray] = None,
    uncertainties_2: Optional[np.ndarray] = None,
    temporal_separation_days: float = 0.0,
    look_vector_divergence_deg: float = 0.0,
    spatial_overlap_pct: float = 100.0,
    has_independent_ground_truth: bool = False
) -> ValidationStatistics:
    """
    Computes rigorous statistical agreement metrics between two observation vectors.
    Evaluates Mean, Median, StdDev, RMSE, MAE, Pearson r, Spearman rho.
    Separates measurement uncertainty from model scatter.
    Assigns strict confidence categories and research integrity disclosures.
    """
    v1 = np.asarray(observations_1, dtype=np.float64)
    v2 = np.asarray(observations_2, dtype=np.float64)

    # Valid mutually finite elements
    valid = np.isfinite(v1) & np.isfinite(v2)
    v1_clean = v1[valid]
    v2_clean = v2[valid]
    n_pts = len(v1_clean)

    if n_pts < 3:
        raise ValueError(f"Insufficient overlapping valid observations (n={n_pts}). Minimum 3 required for statistical validation.")

    # Differences: delta = v1 - v2
    diffs = v1_clean - v2_clean

    mean_diff = float(np.mean(diffs))
    median_diff = float(np.median(diffs))
    std_diff = float(np.std(diffs, ddof=1)) if n_pts > 1 else 0.0
    rmse = float(np.sqrt(np.mean(diffs ** 2)))
    mae = float(np.mean(np.abs(diffs)))

    # Parametric & Non-Parametric Correlation
    if np.allclose(v1_clean, v1_clean[0]) or np.allclose(v2_clean, v2_clean[0]):
        pearson_r, pearson_p = 0.0, 1.0
        spearman_rho, spearman_p = 0.0, 1.0
    else:
        pearson_r, pearson_p = stats.pearsonr(v1_clean, v2_clean)
        spearman_rho, spearman_p = stats.spearmanr(v1_clean, v2_clean)

    r_squared = float(max(0.0, min(1.0, pearson_r ** 2)))

    # Uncertainty handling
    missing_unc = False
    if uncertainties_1 is not None and uncertainties_2 is not None:
        u1 = np.asarray(uncertainties_1, dtype=np.float64)[valid]
        u2 = np.asarray(uncertainties_2, dtype=np.float64)[valid]
        # Check if valid positive values exist
        if np.any(u1 > 0) and np.any(u2 > 0):
            meas_sigma = float(np.mean(np.sqrt(u1 ** 2 + u2 ** 2)))
        else:
            missing_unc = True
            meas_sigma = None
    else:
        missing_unc = True
        meas_sigma = None

    # Model scatter uncertainty (empirical standard error of residuals)
    model_sigma = std_diff / np.sqrt(n_pts) if n_pts > 0 else 0.0

    # Confidence Tiering Criteria
    if has_independent_ground_truth:
        val_type = "IN_SITU_GROUND_TRUTH_VALIDATION"
        if not missing_unc and temporal_separation_days <= 6.0 and look_vector_divergence_deg <= 5.0 and n_pts >= 20:
            confidence = "HIGH_CONFIDENCE"
        elif temporal_separation_days <= 24.0 and look_vector_divergence_deg <= 10.0:
            confidence = "MODERATE_CONFIDENCE"
        else:
            confidence = "LOW_CONFIDENCE"
    else:
        val_type = "INTER_MISSION_CONSISTENCY_CHECK"
        # Two satellite products alone can never be classified as High Confidence Validation
        if not missing_unc and temporal_separation_days <= 12.0 and look_vector_divergence_deg <= 8.0 and spatial_overlap_pct >= 50.0:
            confidence = "MODERATE_CONSISTENCY"
        else:
            confidence = "LOW_CONSISTENCY_OR_UNVALIDATED"

    # Strict Research Integrity Disclosure
    integrity_stmt = (
        "RESEARCH INTEGRITY NOTICE: Cross-mission agreement between satellite sensors demonstrates relative "
        "consistency under shared observation geometries, but does NOT constitute proof of absolute accuracy. "
        "Physical validation requires independent ground-truth geodetic benchmarks (e.g. continuous GNSS or geometric leveling). "
        "No validation metrics were fabricated or assumed."
    )

    return ValidationStatistics(
        valid_count=n_pts,
        mean_difference_bias=round(mean_diff, 3),
        median_difference=round(median_diff, 3),
        std_difference=round(std_diff, 3),
        rmse=round(rmse, 3),
        mae=round(mae, 3),
        pearson_r=round(float(pearson_r), 4),
        pearson_p_value=float(pearson_p),
        spearman_rho=round(float(spearman_rho), 4),
        spearman_p_value=float(spearman_p),
        r_squared=round(r_squared, 4),
        propagated_measurement_sigma=round(meas_sigma, 3) if meas_sigma is not None else None,
        model_scatter_sigma=round(model_sigma, 3),
        missing_uncertainty_flag=missing_unc,
        confidence_tier=confidence,
        validation_type=val_type,
        research_integrity_statement=integrity_stmt
    )

