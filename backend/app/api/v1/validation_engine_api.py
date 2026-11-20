"""
GROUNDSHIFT Multi-Mission Validation and Comparison Engine API Router.
Exposes endpoints for spatial alignment, temporal baseline verification,
statistical cross-mission agreement, GNSS in-situ ground-truth validation,
and exportable research reports.
"""

from typing import List, Optional, Dict, Any, Tuple
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
import numpy as np

from processing.spatial_alignment import compute_spatial_overlap
from processing.temporal_alignment import evaluate_temporal_alignment
from processing.validation_engine import compute_validation_statistics
from processing.gnss_benchmark_reference import (
    REFERENCE_GNSS_NETWORK,
    validate_sar_against_gnss,
    GNSSStationRecord
)
from processing.report_generator import generate_markdown_validation_report

router = APIRouter(prefix="/validation-engine", tags=["Multi-Mission Validation Engine"])


# ------------------------------------------------------------------------------
# Request Schemas
# ------------------------------------------------------------------------------

class SpatialAlignmentRequest(BaseModel):
    bbox_1: List[float] = Field(..., description="[min_lon, min_lat, max_lon, max_lat] for Dataset 1")
    bbox_2: List[float] = Field(..., description="[min_lon, min_lat, max_lon, max_lat] for Dataset 2")
    crs_1: str = "EPSG:4326"
    crs_2: str = "EPSG:4326"
    resolution_1_m: Tuple[float, float] = (30.0, 30.0)
    resolution_2_m: Tuple[float, float] = (30.0, 30.0)


class TemporalAlignmentRequest(BaseModel):
    epochs_1: List[str]
    epochs_2: List[str]
    max_pairwise_separation_days: float = 12.0


class StatisticalEvaluationRequest(BaseModel):
    observations_1: List[float]
    observations_2: List[float]
    uncertainties_1: Optional[List[float]] = None
    uncertainties_2: Optional[List[float]] = None
    temporal_separation_days: float = 0.0
    look_vector_divergence_deg: float = 0.0
    spatial_overlap_pct: float = 100.0
    has_independent_ground_truth: bool = False


class GNSSValidationRequest(BaseModel):
    station_id: str = "OMR_VAL"
    sar_velocity_los_mm_year: float = -18.2
    sar_uncertainty_mm_year: float = 1.4
    incidence_angle_deg: float = 39.2
    heading_angle_deg: float = 348.5


class GenerateReportRequest(BaseModel):
    report_title: str = "Cross-Mission InSAR Validation over Chennai Metropolitan Area"
    mission_1: str = "Sentinel-1 (C-band)"
    mission_2: str = "NISAR (L-band)"
    product_type_1: str = "SLC InSAR Unwrapped Phase"
    product_type_2: str = "RSLC InSAR Unwrapped Phase"
    time_span_1: str = "2023-01-05 to 2024-05-25"
    time_span_2: str = "2023-01-08 to 2024-05-20"
    study_area: str = "Chennai Urban Subsidence Corridor"
    spatial_overlap_km2: float = 480.5
    overlap_pct: float = 88.2
    temporal_sep_days: float = 3.0
    look_vector_divergence_deg: float = 1.8
    stats_payload: Dict[str, Any]
    has_gnss: bool = False
    gnss_station_id: Optional[str] = None


# ------------------------------------------------------------------------------
# API Endpoints
# ------------------------------------------------------------------------------

@router.post("/align-spatial")
async def api_align_spatial(payload: SpatialAlignmentRequest):
    """
    Evaluates spatial footprint overlap, coordinate reference system compatibility,
    and documents whether grid resampling is scientifically justified.
    """
    if len(payload.bbox_1) != 4 or len(payload.bbox_2) != 4:
        raise HTTPException(status_code=400, detail="Bounding boxes must contain 4 coordinates: [min_lon, min_lat, max_lon, max_lat]")

    res = compute_spatial_overlap(
        bbox_1=tuple(payload.bbox_1), # type: ignore
        bbox_2=tuple(payload.bbox_2), # type: ignore
        crs_1=payload.crs_1,
        crs_2=payload.crs_2,
        res_1_m=payload.resolution_1_m,
        res_2_m=payload.resolution_2_m
    )
    return res.to_dict()


@router.post("/align-temporal")
async def api_align_temporal(payload: TemporalAlignmentRequest):
    """
    Evaluates temporal proximity and baselines between observation epochs.
    Never assumes non-simultaneous observations represent identical ground conditions.
    """
    res = evaluate_temporal_alignment(
        epochs_1=payload.epochs_1,
        epochs_2=payload.epochs_2,
        max_pairwise_separation_days=payload.max_pairwise_separation_days
    )
    return res.to_dict()


@router.post("/evaluate-statistics")
async def api_evaluate_statistics(payload: StatisticalEvaluationRequest):
    """
    Computes rigorous statistical agreement metrics: Mean diff, Median diff, StdDev,
    RMSE, MAE, Pearson r, Spearman rho, and propagated uncertainty.
    Assigns strict confidence categories and research integrity disclosures.
    """
    try:
        stats_res = compute_validation_statistics(
            observations_1=np.array(payload.observations_1),
            observations_2=np.array(payload.observations_2),
            uncertainties_1=np.array(payload.uncertainties_1) if payload.uncertainties_1 else None,
            uncertainties_2=np.array(payload.uncertainties_2) if payload.uncertainties_2 else None,
            temporal_separation_days=payload.temporal_separation_days,
            look_vector_divergence_deg=payload.look_vector_divergence_deg,
            spatial_overlap_pct=payload.spatial_overlap_pct,
            has_independent_ground_truth=payload.has_independent_ground_truth
        )
        return {
            "valid_count": stats_res.valid_count,
            "mean_difference_bias": stats_res.mean_difference_bias,
            "median_difference": stats_res.median_difference,
            "std_difference": stats_res.std_difference,
            "rmse": stats_res.rmse,
            "mae": stats_res.mae,
            "pearson_r": stats_res.pearson_r,
            "pearson_p_value": stats_res.pearson_p_value,
            "spearman_rho": stats_res.spearman_rho,
            "spearman_p_value": stats_res.spearman_p_value,
            "r_squared": stats_res.r_squared,
            "propagated_measurement_sigma": stats_res.propagated_measurement_sigma,
            "model_scatter_sigma": stats_res.model_scatter_sigma,
            "missing_uncertainty_flag": stats_res.missing_uncertainty_flag,
            "confidence_tier": stats_res.confidence_tier,
            "validation_type": stats_res.validation_type,
            "research_integrity_statement": stats_res.research_integrity_statement
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gnss-stations")
async def api_get_gnss_stations():
    """
    Returns available continuous in-situ GNSS geodetic reference stations
    with validated 3D velocity vectors and citations.
    """
    stations = []
    for s in REFERENCE_GNSS_NETWORK:
        stations.append({
            "station_id": s.station_id,
            "station_name": s.station_name,
            "network": s.network,
            "longitude": s.longitude,
            "latitude": s.latitude,
            "elevation_m": s.elevation_m,
            "v_east_mm_year": s.v_east_mm_year,
            "v_north_mm_year": s.v_north_mm_year,
            "v_up_mm_year": s.v_up_mm_year,
            "sigma_up_mm_year": s.sigma_up_mm_year,
            "time_span": s.time_span,
            "citation": s.citation
        })
    return {"count": len(stations), "stations": stations}


@router.post("/validate-gnss")
async def api_validate_gnss(payload: GNSSValidationRequest):
    """
    Validates a SAR LOS velocity against an independent physical continuous GNSS benchmark.
    Projects 3D GNSS vector into radar line-of-sight and evaluates consistency.
    """
    match = next((s for s in REFERENCE_GNSS_NETWORK if s.station_id == payload.station_id), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"GNSS station {payload.station_id} not found.")

    res = validate_sar_against_gnss(
        sar_velocity_los_mm_year=payload.sar_velocity_los_mm_year,
        sar_uncertainty_mm_year=payload.sar_uncertainty_mm_year,
        station=match,
        incidence_deg=payload.incidence_angle_deg,
        heading_deg=payload.heading_angle_deg
    )
    return res


@router.post("/generate-report")
async def api_generate_report(payload: GenerateReportRequest):
    """
    Generates a publication-grade Markdown research validation report with uncertainty
    disclosures and cryptographic provenance.
    """
    md_report = generate_markdown_validation_report(
        report_title=payload.report_title,
        mission_1=payload.mission_1,
        mission_2=payload.mission_2,
        product_type_1=payload.product_type_1,
        product_type_2=payload.product_type_2,
        time_span_1=payload.time_span_1,
        time_span_2=payload.time_span_2,
        study_area=payload.study_area,
        spatial_overlap_km2=payload.spatial_overlap_km2,
        overlap_pct=payload.overlap_pct,
        temporal_sep_days=payload.temporal_sep_days,
        look_vector_divergence_deg=payload.look_vector_divergence_deg,
        stats_dict=payload.stats_payload,
        has_gnss=payload.has_gnss,
        gnss_station_id=payload.gnss_station_id
    )
    return {
        "report_title": payload.report_title,
        "format": "markdown",
        "markdown_content": md_report
    }

