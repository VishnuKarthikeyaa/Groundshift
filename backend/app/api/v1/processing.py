"""
GROUNDSHIFT Scientific SAR Processing Engine API Router.
Exposes endpoints for SAR product classification, displacement time-series analysis,
DBSCAN spatial clustering of deformation zones, and multi-mission intercomparisons.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
import numpy as np
import datetime

from processing.product_classifier import (
    classify_sar_product,
    SARProductCategory,
    ScientificWorkflow,
)
from processing.quality_assurance import (
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

router = APIRouter(prefix="/processing", tags=["Scientific SAR Processing Engine"])


# ------------------------------------------------------------------------------
# Pydantic Request Models
# ------------------------------------------------------------------------------

class ClassifyProductRequest(BaseModel):
    filename_or_path: str = Field(..., description="File name or full path of SAR product")
    metadata_tags: Optional[Dict[str, Any]] = Field(default_factory=dict)


class TimeSeriesRateRequest(BaseModel):
    epochs: List[str] = Field(..., description="Chronological ISO dates e.g. ['2023-01-01', '2023-01-13', ...]")
    displacement_series_mm: List[float] = Field(..., description="1D scalar LOS displacement values in mm")
    uncertainties_mm: Optional[List[float]] = None
    min_observations: int = 3


class DBSCANClusterRequest(BaseModel):
    lons: List[float]
    lats: List[float]
    velocities_mm_year: List[float]
    velocity_threshold_mm_year: float = 4.0
    eps_km: float = 1.5
    min_samples: int = 5


class CompareMissionsRequest(BaseModel):
    mission_1_name: str = "Sentinel-1"
    mission_2_name: str = "NISAR L-band"
    sensor_band_1: str = "C"
    sensor_band_2: str = "L"
    orbit_1: str = "ASCENDING"
    orbit_2: str = "ASCENDING"
    incidence_1_deg: float = 39.2
    incidence_2_deg: float = 38.5
    heading_1_deg: float = 348.5
    heading_2_deg: float = 350.0
    observations_1_mm_year: List[float]
    observations_2_mm_year: List[float]
    uncertainties_1: Optional[List[float]] = None
    uncertainties_2: Optional[List[float]] = None
    align_reference_frames: bool = True


# ------------------------------------------------------------------------------
# API Endpoints
# ------------------------------------------------------------------------------

@router.post("/classify-product")
async def api_classify_product(payload: ClassifyProductRequest):
    """
    Module 1: Product Classification & Workflow Selector.
    Identifies SLC, GRD, NISAR GUNW/GCOV, OPERA DISP, and MintPy products.
    Enforces scientific rules prohibiting invalid processing pipelines.
    """
    res = classify_sar_product(payload.filename_or_path, payload.metadata_tags)
    return res.to_dict()


@router.post("/time-series-rate")
async def api_time_series_rate(payload: TimeSeriesRateRequest):
    """
    Module 3: Displacement Analysis & Linear Trend Estimation.
    Estimates annual velocity (mm/year), analytical standard error, RMSE,
    residuals, and R^2 using weighted least squares (WLS).
    """
    parsed_epochs, t_years, errors = validate_acquisition_epochs(payload.epochs)
    if errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    d_arr = np.array(payload.displacement_series_mm, dtype=np.float64)
    unc_arr = np.array(payload.uncertainties_mm, dtype=np.float64) if payload.uncertainties_mm else None

    if len(d_arr) != len(t_years):
        raise HTTPException(
            status_code=400,
            detail=f"Mismatched lengths: {len(t_years)} epochs vs {len(d_arr)} displacement values."
        )

    res = estimate_linear_rate_1d(
        time_years=t_years,
        displacement_mm=d_arr,
        uncertainties_mm=unc_arr,
        min_observations=payload.min_observations
    )

    if res is None:
        raise HTTPException(status_code=400, detail="Insufficient valid epochs or singular matrix during trend estimation.")

    return {
        "velocity_mm_year": res.velocity_mm_year,
        "velocity_std_err_mm_year": res.velocity_std_err_mm_year,
        "intercept_mm": res.intercept_mm,
        "rmse_mm": res.rmse_mm,
        "r_squared": res.r_squared,
        "n_observations": res.n_observations,
        "residuals_mm": res.residuals_mm,
        "fitted_values_mm": res.fitted_values_mm,
        "is_statistically_significant": res.is_statistically_significant,
        "classification": "ESTIMATE_DERIVED"
    }


@router.post("/spatial-clusters")
async def api_spatial_clusters(payload: DBSCANClusterRequest):
    """
    Module 4: Spatial Analysis & DBSCAN Deformation Clustering.
    Delineates contiguous subsidence bowls and active deformation zones.
    Computes centroid, area (km^2), peak rate, and convex hull polygon for each cluster.
    """
    lons = np.array(payload.lons, dtype=np.float64)
    lats = np.array(payload.lats, dtype=np.float64)
    vals = np.array(payload.velocities_mm_year, dtype=np.float64)

    if not (len(lons) == len(lats) == len(vals)):
        raise HTTPException(status_code=400, detail="Length mismatch among lons, lats, and velocities.")

    res = cluster_deformation_zones_dbscan(
        lons=lons,
        lats=lats,
        velocities_mm_year=vals,
        velocity_threshold_mm_year=payload.velocity_threshold_mm_year,
        eps_km=payload.eps_km,
        min_samples=payload.min_samples
    )
    return res


@router.post("/compare-missions")
async def api_compare_missions(payload: CompareMissionsRequest):
    """
    Module 5: Multi-Mission Comparison.
    Compares co-located observations from different missions (e.g. S1 C-band vs NISAR L-band).
    Accounts for viewing geometry look vectors, removes datum bias, and evaluates consistency.
    """
    obs1 = np.array(payload.observations_1_mm_year, dtype=np.float64)
    obs2 = np.array(payload.observations_2_mm_year, dtype=np.float64)

    if len(obs1) != len(obs2):
        raise HTTPException(status_code=400, detail="Observation arrays must have identical length for co-located pixel comparison.")

    meta = ComparisonMetadata(
        mission_1=payload.mission_1_name,
        mission_2=payload.mission_2_name,
        sensor_band_1=payload.sensor_band_1,
        sensor_band_2=payload.sensor_band_2,
        wavelength_1_m=0.0555 if payload.sensor_band_1.upper() == "C" else 0.2384,
        wavelength_2_m=0.2384 if payload.sensor_band_2.upper() == "L" else 0.0555,
        orbit_direction_1=payload.orbit_1,
        orbit_direction_2=payload.orbit_2,
        incidence_angle_1_deg=payload.incidence_1_deg,
        incidence_angle_2_deg=payload.incidence_2_deg,
        heading_angle_1_deg=payload.heading_1_deg,
        heading_angle_2_deg=payload.heading_2_deg
    )

    sig1 = np.array(payload.uncertainties_1, dtype=np.float64) if payload.uncertainties_1 else None
    sig2 = np.array(payload.uncertainties_2, dtype=np.float64) if payload.uncertainties_2 else None

    result = compare_sar_point_series(
        obs_1=obs1,
        obs_2=obs2,
        sigma_1=sig1,
        sigma_2=sig2,
        meta=meta,
        align_reference_frames=payload.align_reference_frames
    )
    return result


@router.get("/benchmark-displacement")
async def api_benchmark_displacement():
    """
    Provides multi-epoch InSAR displacement datasets over Chennai study area for validation:
    - OMR IT Corridor Subsidence Bowl (subsidence rate ~ -18.5 mm/year)
    - Velachery Urban Basin (subsidence rate ~ -12.2 mm/year)
    - Guindy Bedrock Reference Anchor (stable ~ -0.4 mm/year)
    """
    epochs = [
        "2023-01-05", "2023-02-10", "2023-03-18", "2023-04-23", "2023-05-29",
        "2023-07-04", "2023-08-09", "2023-09-14", "2023-10-20", "2023-11-25",
        "2024-01-02", "2024-02-07", "2024-03-14", "2024-04-19", "2024-05-25"
    ]
    # Realistic time deltas in fractional years
    t_vals = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4]

    # Modeled with linear subsidence + realistic seasonal fluctuation + InSAR noise
    omr_disp = [-18.5 * t - 3.5 * np.sin(2 * np.pi * t) + np.random.normal(0, 1.2) for t in t_vals]
    velachery_disp = [-12.2 * t - 2.8 * np.sin(2 * np.pi * t) + np.random.normal(0, 1.4) for t in t_vals]
    guindy_disp = [-0.4 * t + np.random.normal(0, 0.8) for t in t_vals]

    # Point grid for DBSCAN demonstration
    np.random.seed(42)
    # Cluster 1: OMR subsidence bowl
    omr_lons = list(np.random.normal(80.22, 0.015, 25))
    omr_lats = list(np.random.normal(12.92, 0.015, 25))
    omr_vels = list(np.random.normal(-18.5, 2.5, 25))

    # Cluster 2: Velachery basin
    vel_lons = list(np.random.normal(80.20, 0.012, 18))
    vel_lats = list(np.random.normal(12.98, 0.012, 18))
    vel_vels = list(np.random.normal(-12.0, 1.8, 18))

    # Background stable points
    bg_lons = list(np.random.uniform(80.12, 80.28, 30))
    bg_lats = list(np.random.uniform(12.90, 13.08, 30))
    bg_vels = list(np.random.normal(-0.8, 1.1, 30))

    all_lons = omr_lons + vel_lons + bg_lons
    all_lats = omr_lats + vel_lats + bg_lats
    all_vels = omr_vels + vel_vels + bg_vels

    return {
        "study_area": "Chennai Coastal Urban Basin",
        "classification": "BENCHMARK_SYNTHETIC",
        "description": "Multi-epoch InSAR displacement time series calibrated against Chennai coastal subsidence observations.",
        "epochs": epochs,
        "time_series_sites": [
            {
                "site_name": "OMR IT Corridor Subsidence Bowl",
                "coordinates": [80.224, 12.921],
                "expected_rate_mm_year": -18.5,
                "displacement_mm": [round(float(v), 2) for v in omr_disp],
                "uncertainties_mm": [1.2] * len(epochs)
            },
            {
                "site_name": "Velachery Urban Marshland",
                "coordinates": [80.201, 12.982],
                "expected_rate_mm_year": -12.2,
                "displacement_mm": [round(float(v), 2) for v in velachery_disp],
                "uncertainties_mm": [1.4] * len(epochs)
            },
            {
                "site_name": "Guindy Hard Rock In-Situ Reference Anchor",
                "coordinates": [80.215, 13.008],
                "expected_rate_mm_year": -0.4,
                "displacement_mm": [round(float(v), 2) for v in guindy_disp],
                "uncertainties_mm": [0.8] * len(epochs)
            }
        ],
        "spatial_grid_sample": {
            "lons": [round(float(x), 5) for x in all_lons],
            "lats": [round(float(y), 5) for y in all_lats],
            "velocities_mm_year": [round(float(v), 2) for v in all_vels]
        }
    }

