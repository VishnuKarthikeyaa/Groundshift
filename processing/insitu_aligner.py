"""
GROUNDSHIFT In-Situ Geodetic Validation Engine.
Projects GNSS 3D position time-series into satellite Line-of-Sight (LOS)
and evaluates statistical validation metrics against SAR InSAR observations.
"""

import numpy as np
from typing import Dict, Any, List
from processing.decomposition import calculate_look_vector

def project_gnss_to_los(
    d_east: float,
    d_north: float,
    d_up: float,
    incidence_deg: float,
    azimuth_heading_deg: float
) -> float:
    """
    Projects 3D GNSS displacement vector into scalar Line-of-Sight:
      d_LOS = e * d_east + n * d_north + u * d_up
    """
    look_vector = calculate_look_vector(incidence_deg, azimuth_heading_deg)
    d_gnss = np.array([d_east, d_north, d_up])
    return float(np.dot(look_vector, d_gnss))


def evaluate_insitu_consistency(
    sar_series: List[float],
    gnss_series: List[float],
    sar_uncertainties: List[float] = None,
    gnss_uncertainties: List[float] = None
) -> Dict[str, Any]:
    """
    Computes statistical consistency metrics between SAR and projected GNSS time-series:
    - Root Mean Square Error (RMSE)
    - Mean Bias Error (MBE)
    - Pearson Correlation Coefficient (r)
    - Reduced Chi-Squared Statistic (chi2_red)
    """
    s = np.array(sar_series, dtype=np.float64)
    g = np.array(gnss_series, dtype=np.float64)

    if len(s) != len(g) or len(s) < 2:
        raise ValueError("SAR and GNSS series must have identical length >= 2.")

    diff = s - g
    rmse = float(np.sqrt(np.mean(diff**2)))
    mbe = float(np.mean(diff))

    # Pearson correlation
    s_std = np.std(s)
    g_std = np.std(g)
    if s_std > 1e-9 and g_std > 1e-9:
        r = float(np.corrcoef(s, g)[0, 1])
    else:
        r = 1.0 if np.allclose(s, g) else 0.0

    # Reduced Chi-Squared if uncertainties are supplied
    if sar_uncertainties and gnss_uncertainties:
        sig_s = np.array(sar_uncertainties, dtype=np.float64)
        sig_g = np.array(gnss_uncertainties, dtype=np.float64)
        var_total = sig_s**2 + sig_g**2
        chi2_red = float(np.mean((diff**2) / np.maximum(var_total, 1e-8)))
    else:
        chi2_red = None

    return {
        "sample_count": len(s),
        "rmse_mm": round(rmse, 2),
        "mean_bias_error_mm": round(mbe, 2),
        "pearson_r": round(r, 4),
        "reduced_chi2": round(chi2_red, 3) if chi2_red is not None else "N/A",
        "validation_grade": "EXCELLENT" if (rmse < 5.0 and r > 0.85) else ("GOOD" if rmse < 10.0 else "INVESTIGATION_REQUIRED"),
        "classification": "DERIVED_GEOPHYSICAL_INFERRED"
    }

