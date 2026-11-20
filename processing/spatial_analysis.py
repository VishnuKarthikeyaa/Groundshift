"""
GROUNDSHIFT Spatial Analysis & DBSCAN Deformation Clustering Engine.
Performs raster subsetting, spatial masking, geographic reprojection,
and DBSCAN clustering to delineate localized subsidence bowls and fault creep zones.
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from sklearn.cluster import DBSCAN
from shapely.geometry import Point, MultiPoint, Polygon

try:
    import rasterio
    from rasterio.warp import reproject, Resampling, calculate_default_transform
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False


def extract_valid_pixel_table(
    lons: np.ndarray,                  # 1D or 2D array of longitudes
    lats: np.ndarray,                  # 1D or 2D array of latitudes
    values: np.ndarray,                # 1D or 2D array of values (e.g. velocity in mm/yr)
    uncertainties: Optional[np.ndarray] = None,
    threshold_abs_val: Optional[float] = None
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, Optional[np.ndarray]]:
    """
    Extracts flat 1D coordinates and values for all non-NaN valid pixels.
    Optionally filters by magnitude |value| >= threshold_abs_val.
    """
    # Ensure all inputs are flattened
    flat_lons = np.asarray(lons, dtype=np.float64).flatten()
    flat_lats = np.asarray(lats, dtype=np.float64).flatten()
    flat_vals = np.asarray(values, dtype=np.float64).flatten()
    flat_unc = np.asarray(uncertainties, dtype=np.float64).flatten() if uncertainties is not None else None

    valid = np.isfinite(flat_vals) & np.isfinite(flat_lons) & np.isfinite(flat_lats)
    if threshold_abs_val is not None:
        valid = valid & (np.abs(flat_vals) >= threshold_abs_val)

    sel_lons = flat_lons[valid]
    sel_lats = flat_lats[valid]
    sel_vals = flat_vals[valid]
    sel_unc = flat_unc[valid] if flat_unc is not None else None

    return sel_lons, sel_lats, sel_vals, sel_unc


def cluster_deformation_zones_dbscan(
    lons: np.ndarray,
    lats: np.ndarray,
    velocities_mm_year: np.ndarray,
    velocity_threshold_mm_year: float = 4.0,  # Cluster only significant deformation (|v| >= threshold)
    eps_km: float = 1.5,                     # Neighborhood radius in kilometers
    min_samples: int = 5                     # Minimum points to form a cluster
) -> Dict[str, Any]:
    """
    Executes DBSCAN spatial clustering on active deformation pixels.
    Uses Haversine metric (great-circle distance on sphere) for geographic coordinates.
    Returns delineated deformation zones with area, peak rate, and convex hull boundaries.
    """
    # Extract significant deformation pixels
    sub_lons, sub_lats, sub_vals, _ = extract_valid_pixel_table(
        lons, lats, velocities_mm_year, threshold_abs_val=velocity_threshold_mm_year
    )

    n_points = len(sub_vals)
    if n_points < min_samples:
        return {
            "total_deformation_points": n_points,
            "n_clusters": 0,
            "clusters": [],
            "noise_points_count": n_points,
            "clustered_points": []
        }

    # Convert coordinates to radians for Haversine metric: [lat, lon]
    EARTH_RADIUS_KM = 6371.0088
    eps_rad = eps_km / EARTH_RADIUS_KM
    coords_rad = np.radians(np.column_stack([sub_lats, sub_lons]))

    # Run DBSCAN
    db = DBSCAN(eps=eps_rad, min_samples=min_samples, metric="haversine")
    labels = db.fit_predict(coords_rad)

    unique_labels = set(labels)
    clusters_info = []

    for cluster_id in sorted(unique_labels):
        if cluster_id == -1:
            # Noise
            continue

        c_mask = (labels == cluster_id)
        c_lons = sub_lons[c_mask]
        c_lats = sub_lats[c_mask]
        c_vals = sub_vals[c_mask]
        count = int(np.sum(c_mask))

        # Centroid
        centroid_lon = float(np.mean(c_lons))
        centroid_lat = float(np.mean(c_lats))

        # Peak and mean velocities
        peak_rate = float(c_vals[np.argmax(np.abs(c_vals))])
        mean_rate = float(np.mean(c_vals))

        # Convex Hull polygon
        pts = [Point(x, y) for x, y in zip(c_lons, c_lats)]
        mp = MultiPoint(pts)
        hull = mp.convex_hull

        # Approximate surface area in km^2
        # Convert bounding box to metric
        lat_scale = 111.132  # km per degree lat
        lon_scale = 111.320 * np.cos(np.radians(centroid_lat))  # km per degree lon
        area_km2 = float(hull.area * lat_scale * lon_scale) if isinstance(hull, Polygon) else 0.0

        # Boundary coordinates
        if isinstance(hull, Polygon):
            hull_coords = [[float(x), float(y)] for x, y in hull.exterior.coords]
        else:
            hull_coords = [[float(centroid_lon), float(centroid_lat)]]

        # Severity
        abs_peak = abs(peak_rate)
        severity = "CRITICAL" if abs_peak > 20.0 else ("HIGH" if abs_peak > 10.0 else "MODERATE")

        clusters_info.append({
            "cluster_id": int(cluster_id),
            "point_count": count,
            "centroid": [round(centroid_lon, 5), round(centroid_lat, 5)],
            "peak_rate_mm_year": round(peak_rate, 2),
            "mean_rate_mm_year": round(mean_rate, 2),
            "estimated_area_km2": round(area_km2, 2),
            "severity": severity,
            "boundary_polygon": hull_coords
        })

    # Pack points for visualization
    clustered_points = []
    for i in range(n_points):
        clustered_points.append({
            "lon": round(float(sub_lons[i]), 5),
            "lat": round(float(sub_lats[i]), 5),
            "velocity": round(float(sub_vals[i]), 2),
            "cluster_id": int(labels[i])
        })

    return {
        "total_deformation_points": n_points,
        "n_clusters": len(clusters_info),
        "clusters": clusters_info,
        "noise_points_count": int(np.sum(labels == -1)),
        "clustered_points": clustered_points
    }

