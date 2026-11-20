"""
GROUNDSHIFT Target Study Areas Registry.
Provides geographical bounds, target phenomena, and validation anchor configurations.
"""

from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/study-areas", tags=["Study Areas"])

STUDY_AREAS: List[Dict[str, Any]] = [
    {
        "id": "chennai",
        "name": "Chennai Metropolitan Area",
        "state": "Tamil Nadu",
        "country": "India",
        "bounds": {
            "min_lon": 80.05,
            "min_lat": 12.85,
            "max_lon": 80.35,
            "max_lat": 13.30
        },
        "center": [13.0827, 80.2707],
        "utm_epsg": 32644,
        "surface_profile": "Urban coastal metropolis, port infrastructure, wetlands, and industrial corridors.",
        "target_phenomena": [
            "Urban ground subsidence along IT corridors (OMR) and industrial belts",
            "Infrastructure displacement monitoring (Chennai Metro Rail Phase 2)",
            "Monsoon and cyclone inundation mapping (Cyclone Michaung baseline)",
            "Coastal erosion along Chennai and Ennore ports"
        ],
        "validation_anchors": [
            {"type": "GNSS", "id": "CHEN00IND", "status": "Active Benchmark"},
            {"type": "TideGauge", "id": "CHENNAI_PORT", "status": "Continuous"}
        ]
    },
    {
        "id": "cauvery_delta",
        "name": "Cauvery Delta Agricultural Basin",
        "state": "Tamil Nadu",
        "country": "India",
        "bounds": {
            "min_lon": 78.90,
            "min_lat": 10.25,
            "max_lon": 79.95,
            "max_lat": 11.45
        },
        "center": [10.7870, 79.1378],
        "utm_epsg": 32644,
        "surface_profile": "Intensive alluvial agrarian delta, dense canal network, coastal estuaries.",
        "target_phenomena": [
            "L-band vs C-band temporal coherence evolution across paddy cropping cycles (Kuruvai / Samba)",
            "Soil moisture and flood recession dynamics across deltaic distributaries",
            "Deltaic soil consolidation and stability in low-lying coastal tracts"
        ],
        "validation_anchors": [
            {"type": "CWC_GAUGE", "id": "GRAND_ANICUT", "status": "Operational"},
            {"type": "ISMN_SOIL", "id": "TN_AGRI_DELTA", "status": "Field Benchmark"}
        ]
    }
]

@router.get("")
async def list_study_areas():
    """Lists configured primary and experimental study areas."""
    return {
        "count": len(STUDY_AREAS),
        "study_areas": STUDY_AREAS
    }

@router.get("/geocode/lookup")
async def geocode_location(q: str):
    """
    Open geocoding lookup for study areas and locations.
    Resolves location queries to center coordinate and bounding box.
    """
    query_lower = q.strip().lower()
    
    # Check known study areas & key monitoring points
    known_locations = {
        "chennai": {
            "name": "Chennai Metropolitan Area, Tamil Nadu",
            "lat": 13.0827, "lon": 80.2707,
            "bbox": [80.05, 12.85, 80.35, 13.30]
        },
        "cauvery": {
            "name": "Cauvery Delta Agricultural Basin, Tamil Nadu",
            "lat": 10.7870, "lon": 79.1378,
            "bbox": [78.90, 10.25, 79.95, 11.45]
        },
        "delta": {
            "name": "Cauvery Delta Agricultural Basin, Tamil Nadu",
            "lat": 10.7870, "lon": 79.1378,
            "bbox": [78.90, 10.25, 79.95, 11.45]
        },
        "omr": {
            "name": "Old Mahabalipuram Road (OMR) IT Corridor, Chennai",
            "lat": 12.8942, "lon": 80.2289,
            "bbox": [80.18, 12.80, 80.26, 12.98]
        },
        "ennore": {
            "name": "Ennore Port & Thermal Cluster, North Chennai",
            "lat": 13.2341, "lon": 80.3289,
            "bbox": [80.28, 13.18, 80.36, 13.29]
        },
        "thanjavur": {
            "name": "Thanjavur, Cauvery Delta",
            "lat": 10.7870, "lon": 79.1378,
            "bbox": [79.05, 10.70, 79.25, 10.88]
        },
        "nagapattinam": {
            "name": "Nagapattinam Coastal Zone, Cauvery Delta",
            "lat": 10.7656, "lon": 79.8424,
            "bbox": [79.75, 10.65, 79.92, 10.88]
        }
    }

    for key, loc in known_locations.items():
        if key in query_lower:
            return {
                "query": q,
                "found": True,
                "name": loc["name"],
                "center": [loc["lat"], loc["lon"]],
                "bbox": loc["bbox"]
            }

    # If coordinates format like "13.08, 80.27" or "13.08 80.27"
    import re
    coord_match = re.search(r"([-+]?\d*\.?\d+)[,\s]+([-+]?\d*\.?\d+)", q)
    if coord_match:
        lat = float(coord_match.group(1))
        lon = float(coord_match.group(2))
        delta = 0.15
        return {
            "query": q,
            "found": True,
            "name": f"Coordinate Location ({lat:.4f}, {lon:.4f})",
            "center": [lat, lon],
            "bbox": [lon - delta, lat - delta, lon + delta, lat + delta]
        }

    # Default fallback: Chennai study area
    return {
        "query": q,
        "found": False,
        "name": f"Unrecognized query: '{q}'. Defaulted to Chennai baseline.",
        "center": [13.0827, 80.2707],
        "bbox": [80.05, 12.85, 80.35, 13.30]
    }


@router.get("/{area_id}")
async def get_study_area(area_id: str):
    """Retrieves bounding coordinates and scientific profile for a specific study area."""
    if area_id.lower() == "geocode":
        return await geocode_location("chennai")
    area = next((a for a in STUDY_AREAS if a["id"].lower() == area_id.lower()), None)
    if not area:
        return {"error": f"Study area '{area_id}' not found."}
    return area

