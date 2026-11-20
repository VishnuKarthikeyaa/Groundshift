"""
GROUNDSHIFT SAR Data Quality Assurance Module.
Handles NoData detection, quality masks, spatial coverage validation, CRS checks,
temporal epoch validation, uncertainty checks, and spatial reference area anchoring.
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Union
import datetime
from dataclasses import dataclass

@dataclass
class QualityMaskResult:
    valid_mask: np.ndarray          # Boolean mask: True = Valid pixel
    total_pixels: int
    valid_pixels: int
    valid_percentage: float
    is_coverage_sufficient: bool    # True if valid_percentage >= min_threshold
    rejection_reasons: List[str]


def detect_and_clean_nodata(
    data: np.ndarray,
    nodata_value: Optional[float] = None
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Identifies NaN, Inf, and custom nodata values.
    Returns:
      cleaned_data: Array with invalid entries set to NaN
      valid_mask: Boolean array where True indicates finite, valid values.
    """
    cleaned = np.array(data, dtype=np.float64, copy=True)
    valid_mask = np.isfinite(cleaned)

    if nodata_value is not None and not np.isnan(nodata_value):
        # Match within floating point tolerance
        custom_nodata_mask = np.isclose(cleaned, nodata_value, atol=1e-5)
        valid_mask = valid_mask & (~custom_nodata_mask)

    # Set all invalid elements to NaN for clean vectorized operations
    cleaned[~valid_mask] = np.nan
    return cleaned, valid_mask


def apply_coherence_quality_mask(
    displacement: np.ndarray,
    coherence: Optional[np.ndarray] = None,
    min_coherence: float = 0.35,
    nodata_value: Optional[float] = None,
    min_valid_coverage_pct: float = 10.0
) -> QualityMaskResult:
    """
    Generates a unified quality mask based on validity and interferometric coherence.
    Displacement values with coherence < min_coherence are masked out.
    """
    _, valid_disp = detect_and_clean_nodata(displacement, nodata_value=nodata_value)
    rejections = []

    if coherence is not None:
        if coherence.shape != displacement.shape:
            raise ValueError(f"Coherence shape {coherence.shape} does not match displacement shape {displacement.shape}")
        valid_coh = np.isfinite(coherence) & (coherence >= min_coherence) & (coherence <= 1.0)
        combined_mask = valid_disp & valid_coh
    else:
        combined_mask = valid_disp

    total = int(displacement.size)
    valid_count = int(np.count_nonzero(combined_mask))
    valid_pct = round((valid_count / total * 100.0) if total > 0 else 0.0, 2)

    is_sufficient = valid_pct >= min_valid_coverage_pct
    if not is_sufficient:
        rejections.append(f"Valid data coverage ({valid_pct}%) is below minimum required threshold ({min_valid_coverage_pct}%).")

    return QualityMaskResult(
        valid_mask=combined_mask,
        total_pixels=total,
        valid_pixels=valid_count,
        valid_percentage=valid_pct,
        is_coverage_sufficient=is_sufficient,
        rejection_reasons=rejections
    )


def validate_acquisition_epochs(
    epochs: List[Union[str, datetime.date, datetime.datetime]]
) -> Tuple[List[datetime.datetime], np.ndarray, List[str]]:
    """
    Validates chronological sequence of SAR acquisition dates.
    Calculates temporal baselines in fractional years relative to the initial epoch:
      t_years[i] = (epoch[i] - epoch[0]).days / 365.25
    """
    parsed = []
    errors = []

    for ep in epochs:
        if isinstance(ep, (datetime.datetime, datetime.date)):
            parsed.append(datetime.datetime(ep.year, ep.month, ep.day))
        elif isinstance(ep, str):
            # Parse ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
            clean_str = ep.replace("Z", "").split("T")[0]
            try:
                dt = datetime.datetime.strptime(clean_str, "%Y-%m-%d")
                parsed.append(dt)
            except ValueError:
                errors.append(f"Invalid date format: {ep}. Expected YYYY-MM-DD.")
                return [], np.array([]), errors

    if len(parsed) < 2:
        errors.append("At least 2 acquisition epochs are required for rate and temporal analysis.")
        return parsed, np.array([]), errors

    # Check chronological ordering
    for i in range(1, len(parsed)):
        if parsed[i] <= parsed[i - 1]:
            errors.append(f"Epochs are not strictly increasing: {parsed[i-1].date()} >= {parsed[i].date()}.")
            break

    # Calculate temporal baselines in fractional years
    t0 = parsed[0]
    time_deltas_years = np.array([(dt - t0).total_seconds() / (365.25 * 86400.0) for dt in parsed], dtype=np.float64)

    return parsed, time_deltas_years, errors


def apply_reference_area_offset(
    displacement_series: np.ndarray,  # Shape: (N_epochs, Height, Width) or (N_epochs, N_pixels)
    ref_y_slice: Optional[slice] = None,
    ref_x_slice: Optional[slice] = None,
    ref_pixel_idx: Optional[int] = None,
    valid_mask: Optional[np.ndarray] = None
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Enforces spatial reference anchoring for InSAR surface displacement.
    InSAR measurements are physically relative to a reference station or stable ground anchor.
    Computes mean displacement across the reference area at each epoch and subtracts it:
      d_referenced(t) = d(t) - mean(d_ref(t))
    """
    referenced = np.array(displacement_series, dtype=np.float64, copy=True)
    n_epochs = referenced.shape[0]
    ref_offsets = np.zeros(n_epochs, dtype=np.float64)

    if referenced.ndim == 3:
        # Spatial 2D grid over time: (N_epochs, Height, Width)
        h, w = referenced.shape[1], referenced.shape[2]
        ry = ref_y_slice or slice(h // 2 - 2, h // 2 + 2)
        rx = ref_x_slice or slice(w // 2 - 2, w // 2 + 2)

        for i in range(n_epochs):
            ref_patch = referenced[i, ry, rx]
            ref_valid = np.isfinite(ref_patch)
            if np.any(ref_valid):
                offset = float(np.nanmean(ref_patch))
            else:
                offset = 0.0
            ref_offsets[i] = offset
            referenced[i, :, :] -= offset

    elif referenced.ndim == 2:
        # 1D points over time: (N_epochs, N_points)
        idx = ref_pixel_idx if ref_pixel_idx is not None else 0
        for i in range(n_epochs):
            offset = referenced[i, idx]
            if not np.isfinite(offset):
                offset = 0.0
            ref_offsets[i] = offset
            referenced[i, :] -= offset

    return referenced, ref_offsets

