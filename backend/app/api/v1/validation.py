"""
GROUNDSHIFT Scientific Validation & Decomposition API Endpoints.
Provides endpoints for InSAR 2D vector decomposition, phase loop closure auditing,
and in-situ GNSS benchmarking.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from processing.decomposition import decompose_2d_los
from processing.closure_audit import audit_phase_triplet
from processing.insitu_aligner import evaluate_insitu_consistency

router = APIRouter(prefix="/validation", tags=["Scientific Validation"])


class DecompositionRequest(BaseModel):
    d_asc_mm: float = Field(..., description="Ascending LOS displacement in millimeters")
    d_desc_mm: float = Field(..., description="Descending LOS displacement in millimeters")
    inc_asc_deg: float = Field(39.2, description="Ascending local incidence angle in degrees")
    head_asc_deg: float = Field(348.5, description="Ascending flight heading in degrees (clockwise from North)")
    inc_desc_deg: float = Field(41.5, description="Descending local incidence angle in degrees")
    head_desc_deg: float = Field(192.1, description="Descending flight heading in degrees")
    sigma_asc: float = Field(1.5, description="Ascending measurement uncertainty (mm)")
    sigma_desc: float = Field(1.5, description="Descending measurement uncertainty (mm)")


class TripletClosureRequest(BaseModel):
    phi_12_rad: float = Field(..., description="Unwrapped phase between t1 and t2 (rad)")
    phi_23_rad: float = Field(..., description="Unwrapped phase between t2 and t3 (rad)")
    phi_13_rad: float = Field(..., description="Unwrapped phase between t1 and t3 (rad)")
    coherence_12: float = Field(0.75, ge=0.0, le=1.0)
    coherence_23: float = Field(0.70, ge=0.0, le=1.0)
    coherence_13: float = Field(0.65, ge=0.0, le=1.0)


class InsituBenchmarkRequest(BaseModel):
    station_id: str = Field("CHEN00IND", description="Target GNSS station identifier")
    sar_series: List[float] = Field(..., description="Extracted SAR LOS displacement values (mm)")
    gnss_series: List[float] = Field(..., description="Projected GNSS LOS displacement values (mm)")
    sar_uncertainties: Optional[List[float]] = None
    gnss_uncertainties: Optional[List[float]] = None


@router.post("/decompose")
async def execute_los_decomposition(req: DecompositionRequest):
    """
    Inverts paired ascending and descending Line-of-Sight measurements
    into true East-West (d_east) and Vertical (d_up) surface displacement vectors.
    """
    try:
        result = decompose_2d_los(
            d_asc=req.d_asc_mm,
            d_desc=req.d_desc_mm,
            inc_asc_deg=req.inc_asc_deg,
            head_asc_deg=req.head_asc_deg,
            inc_desc_deg=req.inc_desc_deg,
            head_desc_deg=req.head_desc_deg,
            sigma_asc=req.sigma_asc,
            sigma_desc=req.sigma_desc
        )
        return {
            "success": True,
            "inputs": req.model_dump(),
            "results": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/triplet-closure")
async def execute_triplet_audit(req: TripletClosureRequest):
    """
    Audits an interferometric phase loop closure (C_123) to detect
    phase unwrapping cycle slips and decorrelation errors.
    """
    try:
        result = audit_phase_triplet(
            phi_12=req.phi_12_rad,
            phi_23=req.phi_23_rad,
            phi_13=req.phi_13_rad,
            coherence_12=req.coherence_12,
            coherence_23=req.coherence_23,
            coherence_13=req.coherence_13
        )
        return {
            "success": True,
            "inputs": req.model_dump(),
            "results": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/insitu-benchmark")
async def execute_insitu_benchmark(req: InsituBenchmarkRequest):
    """
    Validates a SAR InSAR displacement time-series against an independent
    continuous GNSS geodetic station benchmark.
    """
    try:
        metrics = evaluate_insitu_consistency(
            sar_series=req.sar_series,
            gnss_series=req.gnss_series,
            sar_uncertainties=req.sar_uncertainties,
            gnss_uncertainties=req.gnss_uncertainties
        )
        return {
            "success": True,
            "station_id": req.station_id,
            "metrics": metrics
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/benchmarks/chennai-subsidence")
async def get_chennai_benchmark_data():
    """
    Provides a scientifically structured validation dataset demonstrating
    urban subsidence and vector decomposition along the Chennai OMR corridor.
    Labeled explicitly as BENCHMARK_SYNTHETIC for reproducibility.
    """
    epochs = [f"2026-0{m}-15" for m in range(1, 10)]
    # Simulated vertical subsidence trend (-18 mm/yr) with minor seasonal oscillation
    true_up = [-1.5 * i + 0.8 * (-1)**i for i in range(len(epochs))]
    # Minimal eastward creep
    true_east = [0.2 * i for i in range(len(epochs))]

    # Projected ascending (inc=39.2, head=348.5) and descending (inc=41.5, head=192.1)
    from processing.decomposition import calculate_look_vector
    u_asc = calculate_look_vector(39.2, 348.5)
    u_desc = calculate_look_vector(41.5, 192.1)

    sar_asc = [round(float(u_asc[0]*e + u_asc[2]*u + np.random.normal(0, 0.4)), 2) for e, u in zip(true_east, true_up)]
    sar_desc = [round(float(u_desc[0]*e + u_desc[2]*u + np.random.normal(0, 0.4)), 2) for e, u in zip(true_east, true_up)]
    gnss_up = [round(float(u + np.random.normal(0, 0.3)), 2) for u in true_up]

    return {
        "site": "Chennai OMR IT Corridor (12.95 N, 80.24 E)",
        "epochs": epochs,
        "classification": "BENCHMARK_SYNTHETIC",
        "description": "Standardized forward-modeled ground truth benchmark for verifying 2D InSAR inversion accuracy.",
        "data": {
            "sar_ascending_los_mm": sar_asc,
            "sar_descending_los_mm": sar_desc,
            "gnss_vertical_benchmark_mm": gnss_up,
            "true_vertical_mm": [round(v, 2) for v in true_up],
            "true_east_mm": [round(v, 2) for v in true_east]
        }
    }

