"""
GROUNDSHIFT SAR Product Classification & Workflow Selector.
Identifies SAR product families (SLC, GRD, NISAR GUNW, NISAR GCOV, OPERA DISP/CSLC/RTC)
and strictly routes them to scientifically valid processing pipelines.

Rules:
- Never feed GRD into interferometric displacement workflows.
- Differentiate complex phase data from geocoded covariance or detected amplitude.
- Enforce mission-specific metadata and wavelength preservation.
"""

import enum
from typing import Dict, Any, List, Optional
from pathlib import Path

class SARProductCategory(str, enum.Enum):
    SLC = "SLC"                       # Single Look Complex (InSAR / PolSAR capable)
    GRD = "GRD"                       # Ground Range Detected (Backscatter amplitude only)
    NISAR_GUNW = "NISAR_GUNW"         # NISAR Geocoded Unwrapped InSAR Phase
    NISAR_GCOV = "NISAR_GCOV"         # NISAR Geocoded Polarimetric Covariance
    OPERA_DISP = "OPERA_DISP"         # NASA/JPL OPERA Surface Displacement (L3)
    OPERA_CSLC = "OPERA_CSLC"         # NASA/JPL OPERA Coregistered SLC (L2)
    OPERA_RTC = "OPERA_RTC"           # NASA/JPL OPERA Radiometric Terrain-Corrected (L2)
    MINTPY_H5 = "MINTPY_H5"           # MintPy InSAR Velocity/Displacement HDF5
    GEOTIFF_DISPLACEMENT = "GEOTIFF_DISP" # Geocoded raster displacement (mm or m)
    UNKNOWN = "UNKNOWN"

class ScientificWorkflow(str, enum.Enum):
    INTERFEROMETRIC_TIME_SERIES = "INTERFEROMETRIC_TIME_SERIES"
    RADIOMETRIC_BACKSCATTER = "RADIOMETRIC_BACKSCATTER"
    POLARIMETRIC_DECOMPOSITION = "POLARIMETRIC_DECOMPOSITION"
    SURFACE_DEFORMATION_MAPPING = "SURFACE_DEFORMATION_MAPPING"
    CROSS_MISSION_INTERCOMPARISON = "CROSS_MISSION_INTERCOMPARISON"
    UNSUPPORTED = "UNSUPPORTED"


class ProductClassificationResult:
    """Encapsulates product classification and permitted scientific workflows."""
    def __init__(
        self,
        category: SARProductCategory,
        mission: str,
        sensor_band: str,
        frequency_ghz: float,
        wavelength_m: float,
        is_phase_preserved: bool,
        is_displacement_ready: bool,
        supported_workflows: List[ScientificWorkflow],
        rejection_reasons: List[str]
    ):
        self.category = category
        self.mission = mission
        self.sensor_band = sensor_band
        self.frequency_ghz = frequency_ghz
        self.wavelength_m = wavelength_m
        self.is_phase_preserved = is_phase_preserved
        self.is_displacement_ready = is_displacement_ready
        self.supported_workflows = supported_workflows
        self.rejection_reasons = rejection_reasons

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category.value,
            "mission": self.mission,
            "sensor_band": self.sensor_band,
            "frequency_ghz": self.frequency_ghz,
            "wavelength_m": round(self.wavelength_m, 4),
            "is_phase_preserved": self.is_phase_preserved,
            "is_displacement_ready": self.is_displacement_ready,
            "supported_workflows": [w.value for w in self.supported_workflows],
            "rejection_reasons": self.rejection_reasons,
        }


def classify_sar_product(
    filename_or_path: str,
    metadata_tags: Optional[Dict[str, Any]] = None,
    detected_format: Optional[str] = None
) -> ProductClassificationResult:
    """
    Analyzes file identifier, extension, and header metadata tags to classify the SAR product.
    Enforces strict scientific compatibility checks.
    """
    fn = Path(filename_or_path).name.upper()
    tags = {k.upper(): str(v).upper() for k, v in (metadata_tags or {}).items()}
    rejections = []

    # 1. NISAR GUNW (Geocoded Unwrapped Phase)
    if "GUNW" in fn or "GUNW" in tags.get("PRODUCT_TYPE", ""):
        band = "L" if "LSAR" in fn or "NISAR_L" in fn or "L_" in fn else "S"
        freq = 1.257 if band == "L" else 3.200
        wavelen = 0.2384 if band == "L" else 0.0937
        return ProductClassificationResult(
            category=SARProductCategory.NISAR_GUNW,
            mission=f"NISAR {band}-band",
            sensor_band=band,
            frequency_ghz=freq,
            wavelength_m=wavelen,
            is_phase_preserved=True,
            is_displacement_ready=True,
            supported_workflows=[
                ScientificWorkflow.SURFACE_DEFORMATION_MAPPING,
                ScientificWorkflow.INTERFEROMETRIC_TIME_SERIES,
                ScientificWorkflow.CROSS_MISSION_INTERCOMPARISON,
            ],
            rejection_reasons=[]
        )

    # 2. NISAR GCOV (Geocoded Covariance Matrix)
    if "GCOV" in fn or "GCOV" in tags.get("PRODUCT_TYPE", ""):
        band = "L" if "LSAR" in fn or "NISAR_L" in fn or "L_" in fn else "S"
        freq = 1.257 if band == "L" else 3.200
        wavelen = 0.2384 if band == "L" else 0.0937
        rejections.append("GCOV contains polarimetric covariance elements, not interferometric unwrapped displacement phase.")
        return ProductClassificationResult(
            category=SARProductCategory.NISAR_GCOV,
            mission=f"NISAR {band}-band",
            sensor_band=band,
            frequency_ghz=freq,
            wavelength_m=wavelen,
            is_phase_preserved=False,
            is_displacement_ready=False,
            supported_workflows=[
                ScientificWorkflow.POLARIMETRIC_DECOMPOSITION,
                ScientificWorkflow.RADIOMETRIC_BACKSCATTER
            ],
            rejection_reasons=rejections
        )

    # 3. OPERA DISP (Displacement Product)
    if "OPERA" in fn and ("DISP" in fn or "DISPLACEMENT" in tags.get("TITLE", "")):
        return ProductClassificationResult(
            category=SARProductCategory.OPERA_DISP,
            mission="Sentinel-1 / OPERA",
            sensor_band="C",
            frequency_ghz=5.405,
            wavelength_m=0.0555,
            is_phase_preserved=True,
            is_displacement_ready=True,
            supported_workflows=[
                ScientificWorkflow.SURFACE_DEFORMATION_MAPPING,
                ScientificWorkflow.INTERFEROMETRIC_TIME_SERIES,
                ScientificWorkflow.CROSS_MISSION_INTERCOMPARISON,
            ],
            rejection_reasons=[]
        )

    # 4. OPERA CSLC or Standard SLC
    if ("OPERA" in fn and "CSLC" in fn) or "SLC" in fn or "RSLC" in fn:
        is_opera = "OPERA" in fn
        mission = "Sentinel-1" if ("S1" in fn or is_opera) else ("NISAR L-band" if "NISAR" in fn else ("SAOCOM" if "SAO" in fn else "RADARSAT"))
        band = "L" if ("NISAR" in fn or "SAO" in fn) else "C"
        freq = 1.257 if band == "L" else 5.405
        wavelen = 0.2384 if band == "L" else 0.0555
        return ProductClassificationResult(
            category=SARProductCategory.OPERA_CSLC if is_opera else SARProductCategory.SLC,
            mission=mission,
            sensor_band=band,
            frequency_ghz=freq,
            wavelength_m=wavelen,
            is_phase_preserved=True,
            is_displacement_ready=False, # SLC requires interferometric formation and unwrapping first
            supported_workflows=[
                ScientificWorkflow.INTERFEROMETRIC_TIME_SERIES,
                ScientificWorkflow.POLARIMETRIC_DECOMPOSITION
            ],
            rejection_reasons=["Direct rate estimation requires unwrapped phase or displacement time-series; SLC must first undergo InSAR pair formation."]
        )

    # 5. GRD / OPERA RTC (Ground Range Detected / RTC Amplitude)
    if "GRD" in fn or "RTC" in fn or tags.get("PRODUCT_TYPE", "") in ["GRD", "RTC"]:
        mission = "Sentinel-1" if ("S1" in fn or "SENTINEL" in tags.get("SATELLITE", "")) else "RADARSAT"
        rejections.append("GRD/RTC data consists purely of detected backscatter intensity. Complex phase is discarded during range compression and multilooking. Cannot be used for surface deformation or InSAR inversion.")
        return ProductClassificationResult(
            category=SARProductCategory.OPERA_RTC if "RTC" in fn else SARProductCategory.GRD,
            mission=mission,
            sensor_band="C",
            frequency_ghz=5.405,
            wavelength_m=0.0555,
            is_phase_preserved=False,
            is_displacement_ready=False,
            supported_workflows=[
                ScientificWorkflow.RADIOMETRIC_BACKSCATTER
            ],
            rejection_reasons=rejections
        )

    # 6. MintPy HDF5 Velocity/Time-series File
    if fn.endswith(".H5") and any(term in fn for term in ["VELOCITY", "TIMESERIES", "GEO_VELOCITY"]):
        return ProductClassificationResult(
            category=SARProductCategory.MINTPY_H5,
            mission="Multi-Mission InSAR Time-Series",
            sensor_band="C/L",
            frequency_ghz=5.405,
            wavelength_m=0.0555,
            is_phase_preserved=True,
            is_displacement_ready=True,
            supported_workflows=[
                ScientificWorkflow.SURFACE_DEFORMATION_MAPPING,
                ScientificWorkflow.CROSS_MISSION_INTERCOMPARISON,
            ],
            rejection_reasons=[]
        )

    # 7. Generic Displacement GeoTIFF (e.g. InSAR LOS displacement in mm or velocity)
    if any(term in fn for term in ["DISP", "VEL", "DEF", "SUBSIDENCE", "LOS"]) and (fn.endswith(".TIF") or fn.endswith(".TIFF")):
        band = "L" if "L_" in fn or "L-BAND" in tags.get("BAND", "") else "C"
        freq = 1.257 if band == "L" else 5.405
        wavelen = 0.2384 if band == "L" else 0.0555
        return ProductClassificationResult(
            category=SARProductCategory.GEOTIFF_DISPLACEMENT,
            mission=tags.get("MISSION", "InSAR Geocoded Displacement"),
            sensor_band=band,
            frequency_ghz=freq,
            wavelength_m=wavelen,
            is_phase_preserved=True,
            is_displacement_ready=True,
            supported_workflows=[
                ScientificWorkflow.SURFACE_DEFORMATION_MAPPING,
                ScientificWorkflow.CROSS_MISSION_INTERCOMPARISON,
            ],
            rejection_reasons=[]
        )

    # Default fallback: Unknown
    return ProductClassificationResult(
        category=SARProductCategory.UNKNOWN,
        mission="UNKNOWN",
        sensor_band="UNKNOWN",
        frequency_ghz=0.0,
        wavelength_m=0.0,
        is_phase_preserved=False,
        is_displacement_ready=False,
        supported_workflows=[ScientificWorkflow.UNSUPPORTED],
        rejection_reasons=["Unrecognized SAR product signature or file naming convention."]
    )

