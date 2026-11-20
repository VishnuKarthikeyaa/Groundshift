"""
GROUNDSHIFT Radiometric Calibration & Terrain Flattening Module.
Converts radar cross-section observables into terrain-flattened gamma naught (gamma0_RTC)
and calculates Equivalent Number of Looks (ENL) speckle statistics.
"""

import numpy as np
from typing import Dict, Any, Union

def sigma0_to_gamma0(
    sigma0_linear: Union[float, np.ndarray],
    local_incidence_deg: Union[float, np.ndarray]
) -> Union[float, np.ndarray]:
    """
    Normalizes ground-projected sigma0 to terrain-flattened gamma0:
      gamma0 = sigma0 / cos(theta_local)
    """
    theta_rad = np.radians(local_incidence_deg)
    cos_theta = np.maximum(np.cos(theta_rad), 1e-4)
    return sigma0_linear / cos_theta

def linear_to_db(val_linear: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """Converts linear radar backscatter to decibels (dB)."""
    return 10.0 * np.log10(np.maximum(val_linear, 1e-12))

def db_to_linear(val_db: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """Converts decibels (dB) back to linear scale."""
    return 10.0 ** (val_db / 10.0)

def calculate_enl(intensity_array: np.ndarray) -> float:
    """
    Estimates Equivalent Number of Looks (ENL) over a homogeneous target:
      ENL = mean(I)^2 / var(I)
    """
    arr = np.asarray(intensity_array, dtype=np.float64)
    mean_val = np.mean(arr)
    var_val = np.var(arr)
    if var_val < 1e-12:
        return 1.0
    return float((mean_val**2) / var_val)

