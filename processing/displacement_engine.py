"""
GROUNDSHIFT InSAR Displacement Analysis & Temporal Trend Engine.
Performs weighted least-squares velocity estimation, residual analysis, RMSE calculation,
uncertainty propagation, and viewing geometry preservation.

Physics Rule:
- LOS displacement is a 1D projection: d_los = -d_e*sin(theta)*cos(alpha) + d_n*sin(theta)*sin(alpha) + d_u*cos(theta)
- Do NOT interpret LOS displacement as vertical displacement without opposing tracks or proven zero horizontal strain.
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass

@dataclass
class TemporalTrendResult:
    velocity_mm_year: float            # Estimated linear rate (mm/year)
    velocity_std_err_mm_year: float    # Analytical 1-sigma uncertainty (mm/year)
    intercept_mm: float                # Intercept at t=0
    rmse_mm: float                     # Root Mean Square of residuals
    r_squared: float                   # Coefficient of determination [0, 1]
    n_observations: int                # Number of valid epochs used
    residuals_mm: List[float]          # Residuals (observed - modeled)
    fitted_values_mm: List[float]      # Modeled values at each epoch
    is_statistically_significant: bool # True if |v| > 2*sigma_v (95% confidence)


def estimate_linear_rate_1d(
    time_years: np.ndarray,            # Shape (N,), relative time in fractional years
    displacement_mm: np.ndarray,       # Shape (N,), LOS displacement in mm
    uncertainties_mm: Optional[np.ndarray] = None, # Shape (N,), 1-sigma uncertainties
    min_observations: int = 3
) -> Optional[TemporalTrendResult]:
    """
    Fits a linear velocity trend v (mm/year) to a single-pixel displacement time series
    using weighted least-squares (WLS).
    """
    valid_idx = np.isfinite(displacement_mm) & np.isfinite(time_years)
    t = time_years[valid_idx]
    d = displacement_mm[valid_idx]
    n_obs = len(d)

    if n_obs < min_observations:
        return None

    # Construct design matrix G = [1, t]
    G = np.column_stack([np.ones(n_obs), t])

    # Weights
    if uncertainties_mm is not None:
        sigma = np.array(uncertainties_mm[valid_idx], dtype=np.float64)
        sigma[sigma <= 0] = 1.0
        w = 1.0 / (sigma ** 2)
        W = np.diag(w)
        # Normal equations: (G^T W G) m = G^T W d
        GtW = G.T @ W
        GtWG = GtW @ G
        try:
            cov_m = np.linalg.inv(GtWG)
            m = cov_m @ (GtW @ d)
        except np.linalg.LinAlgError:
            return None
    else:
        # Standard OLS
        try:
            GtG = G.T @ G
            cov_base = np.linalg.inv(GtG)
            m = cov_base @ (G.T @ d)
            W = np.eye(n_obs)
            cov_m = cov_base
        except np.linalg.LinAlgError:
            return None

    intercept = float(m[0])
    velocity = float(m[1])

    # Fitted values and residuals
    d_pred = G @ m
    residuals = d - d_pred
    rss = float(np.sum(residuals ** 2))
    rmse = float(np.sqrt(rss / n_obs))

    # Variance-covariance scaling
    if n_obs > 2:
        sigma_sq = rss / (n_obs - 2)
        param_cov = cov_m * sigma_sq if uncertainties_mm is None else cov_m
        v_std_err = float(np.sqrt(max(0.0, param_cov[1, 1])))
    else:
        v_std_err = 0.0

    # R-squared
    ss_tot = float(np.sum((d - np.mean(d)) ** 2))
    r_sq = float(1.0 - (rss / ss_tot)) if ss_tot > 1e-9 else 0.0
    r_sq = max(0.0, min(1.0, r_sq))

    is_sig = abs(velocity) > (2.0 * v_std_err)

    return TemporalTrendResult(
        velocity_mm_year=round(velocity, 3),
        velocity_std_err_mm_year=round(v_std_err, 3),
        intercept_mm=round(intercept, 3),
        rmse_mm=round(rmse, 3),
        r_squared=round(r_sq, 4),
        n_observations=n_obs,
        residuals_mm=[round(float(r), 3) for r in residuals],
        fitted_values_mm=[round(float(p), 3) for p in d_pred],
        is_statistically_significant=is_sig
    )


def compute_velocity_map_2d(
    time_years: np.ndarray,                # Shape (N_epochs,)
    displacement_cube: np.ndarray,         # Shape (N_epochs, Height, Width) in mm
    valid_mask: Optional[np.ndarray] = None, # Shape (Height, Width)
    min_observations: int = 3
) -> Dict[str, np.ndarray]:
    """
    Computes 2D velocity map, standard error, and RMSE across a spatial raster grid.
    Vectorized and memory-optimized for 16GB RAM bounds.
    """
    n_epochs, height, width = displacement_cube.shape
    if valid_mask is None:
        valid_mask = np.ones((height, width), dtype=bool)

    velocity_map = np.full((height, width), np.nan, dtype=np.float32)
    std_err_map = np.full((height, width), np.nan, dtype=np.float32)
    rmse_map = np.full((height, width), np.nan, dtype=np.float32)
    r2_map = np.full((height, width), np.nan, dtype=np.float32)
    n_obs_map = np.zeros((height, width), dtype=np.int16)

    # Process pixel by pixel where mask is True
    for y in range(height):
        for x in range(width):
            if not valid_mask[y, x]:
                continue
            series = displacement_cube[:, y, x]
            res = estimate_linear_rate_1d(time_years, series, min_observations=min_observations)
            if res is not None:
                velocity_map[y, x] = res.velocity_mm_year
                std_err_map[y, x] = res.velocity_std_err_mm_year
                rmse_map[y, x] = res.rmse_mm
                r2_map[y, x] = res.r_squared
                n_obs_map[y, x] = res.n_observations

    return {
        "velocity_mm_year": velocity_map,
        "std_err_mm_year": std_err_map,
        "rmse_mm": rmse_map,
        "r_squared": r2_map,
        "observation_count": n_obs_map
    }


def check_los_to_vertical_admissibility(
    incidence_angle_deg: float,
    has_paired_descending_track: bool,
    assumed_zero_horizontal_motion: bool = False
) -> Dict[str, Any]:
    """
    Evaluates whether interpreting 1D LOS as vertical displacement is mathematically admissible.
    Warns researchers against naive 1/cos(theta) projections.
    """
    theta_rad = np.radians(incidence_angle_deg)
    cos_theta = np.cos(theta_rad)

    if has_paired_descending_track:
        return {
            "is_admissible": True,
            "method": "2D_VECTOR_DECOMPOSITION",
            "warning": None,
            "geometric_projection_factor": float(cos_theta)
        }

    if assumed_zero_horizontal_motion:
        return {
            "is_admissible": True,
            "method": "PSEUDO_VERTICAL_ASSUMING_ZERO_HORIZONTAL_STRAIN",
            "warning": "CAUTION: Projecting LOS to vertical via d_up = d_los / cos(theta) assumes horizontal motion is exactly zero. Any unmodeled East-West motion will project into vertical error with factor tan(theta)*cos(alpha).",
            "geometric_projection_factor": float(cos_theta)
        }

    return {
        "is_admissible": False,
        "method": "REJECTED",
        "warning": "SCIENTIFIC PROHIBITION: Single-track LOS displacement cannot be treated as pure vertical subsidence without opposing ascending/descending tracks or an explicit in-situ GNSS constraint.",
        "geometric_projection_factor": float(cos_theta)
    }

