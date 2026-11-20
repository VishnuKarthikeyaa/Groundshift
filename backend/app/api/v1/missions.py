"""
GROUNDSHIFT Multi-Mission Registry Endpoints.
Defines satellite mission specifications, frequencies, and product levels.
"""

from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/missions", tags=["Multi-Mission Registry"])

MISSIONS_DATABASE: List[Dict[str, Any]] = [
    {
        "id": "nisar",
        "name": "NASA-ISRO SAR (NISAR)",
        "operator": "NASA / ISRO",
        "bands": ["L-band (1.26 GHz, ~23.8 cm)", "S-band (3.2 GHz, ~9.3 cm)"],
        "orbit": "Sun-synchronous polar (747 km altitude, 12-day repeat)",
        "polarizations": ["HH", "HV", "VH", "VV", "Compact Pol"],
        "primary_products": [
            {"code": "GCOV", "type": "Geocoded Covariance", "category": "Amplitude / Polarimetric Backscatter"},
            {"code": "GUNW", "type": "Geocoded Unwrapped Phase", "category": "Interferometric Displacement"},
            {"code": "GSLC", "type": "Geocoded Single Look Complex", "category": "Complex Radar Base Observable"}
        ],
        "physics_role": "High coherence over vegetated areas, deep canopy penetration, large displacement gradient tracking.",
        "status": "Active / Target Specification"
    },
    {
        "id": "sentinel1",
        "name": "Copernicus Sentinel-1 (S1A / S1C)",
        "operator": "ESA / Copernicus",
        "bands": ["C-band (5.405 GHz, ~5.55 cm)"],
        "orbit": "Near-polar sun-synchronous (693 km, 12-day / 6-day constellation repeat)",
        "polarizations": ["VV+VH", "HH+HV"],
        "primary_products": [
            {"code": "GRD", "type": "Ground Range Detected", "category": "Calibrated Radiometric Backscatter (Sigma0/Gamma0)"},
            {"code": "SLC", "type": "Single Look Complex", "category": "Phase + Amplitude (TOPSAR bursts)"},
            {"code": "GUNW", "type": "HyP3 Geocoded Unwrapped Interferogram", "category": "Interferometric Displacement"}
        ],
        "physics_role": "Sub-centimeter surface deformation sensitivity; dense temporal baseline for urban Persistent Scatterer InSAR.",
        "status": "Operational"
    },
    {
        "id": "saocom",
        "name": "SAOCOM-1A / 1B",
        "operator": "CONAE (Argentina)",
        "bands": ["L-band (1.275 GHz, ~23.5 cm)"],
        "orbit": "Sun-synchronous polar (620 km, 16-day / 8-day repeat)",
        "polarizations": ["Full Quad-Pol (HH, HV, VH, VV)", "Dual-Pol"],
        "primary_products": [
            {"code": "GTC", "type": "Geocoded Terrain Corrected", "category": "Radiometric Backscatter"},
            {"code": "SLC", "type": "Single Look Complex", "category": "Complex Radar Observable"}
        ],
        "physics_role": "L-band cross-sensor validation partner for NISAR; soil moisture and agricultural flood monitoring.",
        "status": "Operational"
    },
    {
        "id": "radarsat_rcm",
        "name": "RADARSAT Constellation Mission (RCM)",
        "operator": "Canadian Space Agency (CSA)",
        "bands": ["C-band (5.405 GHz, ~5.55 cm)"],
        "orbit": "Sun-synchronous constellation (3 spacecraft, 4-day revisit)",
        "polarizations": ["Compact Polarimetry (Circular-Transmit Dual-Linear)", "Full Quad-Pol", "Dual-Pol"],
        "primary_products": [
            {"code": "GRD", "type": "Ground Range Detected", "category": "Radiometric Amplitude"},
            {"code": "SLC", "type": "Single Look Complex", "category": "Complex Observable"}
        ],
        "physics_role": "High-revisit C-band verification and compact polarimetry Stokes decomposition benchmarks.",
        "status": "Operational"
    },
    {
        "id": "uavsar",
        "name": "NASA Airborne UAVSAR",
        "operator": "NASA JPL",
        "bands": ["L-band (1.26 GHz, ~23.8 cm)"],
        "orbit": "Airborne (Gulfstream III aircraft, repeat-track flight lines)",
        "polarizations": ["Full Quad-Pol (HH, HV, VH, VV)"],
        "primary_products": [
            {"code": "RPI", "type": "Repeat-Pass Interferometry", "category": "High-Resolution InSAR Displacement"},
            {"code": "POLSAR", "type": "Fully Polarimetric Stokes Matrix", "category": "Polarimetric Scattering Elements"}
        ],
        "physics_role": "Sub-meter airborne ground truth calibration for satellite SAR footprints.",
        "status": "Operational Research"
    }
]

@router.get("")
async def list_missions():
    """Returns the full catalog of supported multi-mission radar satellites and product specifications."""
    return {
        "count": len(MISSIONS_DATABASE),
        "missions": MISSIONS_DATABASE
    }

@router.get("/{mission_id}")
async def get_mission(mission_id: str):
    """Retrieves detailed instrument parameters for a specific SAR mission."""
    mission = next((m for m in MISSIONS_DATABASE if m["id"].lower() == mission_id.lower()), None)
    if not mission:
        return {"error": f"Mission '{mission_id}' not found in registry."}
    return mission

