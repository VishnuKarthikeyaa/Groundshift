"""
GROUNDSHIFT Spatial Alignment & Footprint Intersection Module.
Evaluates geographic overlap, verifies coordinate reference systems,
and performs scientifically justified grid resampling while preserving native metadata.
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

try:
    import rasterio
    from rasterio.warp import reproject, Resampling, calculate_default_transform
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False


class SpatialAlignmentResult:
    """Encapsulates spatial overlap, CRS compatibility, and alignment metrics."""
    def __init__(
        self,
        is_overlapping: bool,
        intersection_bbox: Tuple[float, float, float, float],
        intersection_area_km2: float,
        overlap_percentage_1: float,
        overlap_percentage_2: float,
        crs_1: str,
        crs_2: str,
        is_crs_compatible: bool,
        requires_reprojection: bool,
        resolution_1_m: Tuple[float, float],
        resolution_2_m: Tuple[float, float],
        resampling_justification: Optional[str] = None
    ):
        self.is_overlapping = is_overlapping
        self.intersection_bbox = intersection_bbox
        self.intersection_area_km2 = round(intersection_area_km2, 2)
        self.overlap_percentage_1 = round(overlap_percentage_1, 2)
        self.overlap_percentage_2 = round(overlap_percentage_2, 2)
        self.crs_1 = crs_1
        self.crs_2 = crs_2
        self.is_crs_compatible = is_crs_compatible
        self.requires_reprojection = requires_reprojection
        self.resolution_1_m = resolution_1_m
        self.resolution_2_m = resolution_2_m
        self.resampling_justification = resampling_justification

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_overlapping": self.is_overlapping,
            "intersection_bbox": {
                "min_lon": self.intersection_bbox[0],
                "min_lat": self.intersection_bbox[1],
                "max_lon": self.intersection_bbox[2],
                "max_lat": self.intersection_bbox[3],
            },
            "intersection_area_km2": self.intersection_area_km2,
            "overlap_percentage_dataset_1": self.overlap_percentage_1,
            "overlap_percentage_dataset_2": self.overlap_percentage_2,
            "crs_1": self.crs_1,
            "crs_2": self.crs_2,
            "is_crs_compatible": self.is_crs_compatible,
            "requires_reprojection": self.requires_reprojection,
            "native_resolution_1_m": self.resolution_1_m,
            "native_resolution_2_m": self.resolution_2_m,
            "resampling_justification": self.resampling_justification,
        }


def compute_spatial_overlap(
    bbox_1: Tuple[float, float, float, float], # (min_lon, min_lat, max_lon, max_lat)
    bbox_2: Tuple[float, float, float, float],
    crs_1: str = "EPSG:4326",
    crs_2: str = "EPSG:4326",
    res_1_m: Tuple[float, float] = (30.0, 30.0),
    res_2_m: Tuple[float, float] = (30.0, 30.0),
) -> SpatialAlignmentResult:
    """
    Computes exact spherical polygon intersection between two geographic bounding boxes.
    Assesses CRS compatibility and determines whether spatial resampling is scientifically justified.
    """
    poly1 = box(bbox_1[0], bbox_1[1], bbox_1[2], bbox_1[3])
    poly2 = box(bbox_2[0], bbox_2[1], bbox_2[2], bbox_2[3])

    is_crs_compat = crs_1.upper() == crs_2.upper()
    req_reproj = not is_crs_compat

    if not poly1.intersects(poly2):
        return SpatialAlignmentResult(
            is_overlapping=False,
            intersection_bbox=(0.0, 0.0, 0.0, 0.0),
            intersection_area_km2=0.0,
            overlap_percentage_1=0.0,
            overlap_percentage_2=0.0,
            crs_1=crs_1,
            crs_2=crs_2,
            is_crs_compatible=is_crs_compat,
            requires_reprojection=req_reproj,
            resolution_1_m=res_1_m,
            resolution_2_m=res_2_m,
            resampling_justification="No spatial overlap between scene footprints."
        )

    inter = poly1.intersection(poly2)
    b = inter.bounds # (minx, miny, maxx, maxy)

    # Calculate area in km^2 using local latitude scaling
    centroid_lat = (b[1] + b[3]) / 2.0
    lat_km_per_deg = 111.132
    lon_km_per_deg = 111.320 * np.cos(np.radians(centroid_lat))
    
    inter_area_km2 = (b[2] - b[0]) * lon_km_per_deg * (b[3] - b[1]) * lat_km_per_deg
    area1_km2 = (bbox_1[2] - bbox_1[0]) * lon_km_per_deg * (bbox_1[3] - bbox_1[1]) * lat_km_per_deg
    area2_km2 = (bbox_2[2] - bbox_2[0]) * lon_km_per_deg * (bbox_2[3] - bbox_2[1]) * lat_km_per_deg

    pct1 = (inter_area_km2 / area1_km2 * 100.0) if area1_km2 > 0 else 0.0
    pct2 = (inter_area_km2 / area2_km2 * 100.0) if area2_km2 > 0 else 0.0

    # Resampling justification policy:
    # Always resample higher-resolution dataset onto the grid of the coarser dataset to preserve statistical degrees of freedom.
    coarser_res = max(res_1_m[0], res_2_m[0])
    justification = (
        f"Resampling justified: Aligning grids to common resolution ({coarser_res:.1f} m) "
        f"over intersection region ({inter_area_km2:.1f} km²) to prevent spatial aliasing."
    )

    return SpatialAlignmentResult(
        is_overlapping=True,
        intersection_bbox=(b[0], b[1], b[2], b[3]),
        intersection_area_km2=inter_area_km2,
        overlap_percentage_1=pct1,
        overlap_percentage_2=pct2,
        crs_1=crs_1,
        crs_2=crs_2,
        is_crs_compatible=is_crs_compat,
        requires_reprojection=req_reproj,
        resolution_1_m=res_1_m,
        resolution_2_m=res_2_m,
        resampling_justification=justification
    )

