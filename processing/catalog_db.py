"""
GROUNDSHIFT SQLite Dataset Catalog Manager.
Provides persistent storage, querying, deduplication, and provenance tracking
for multi-mission SAR datasets without loading large datasets into RAM.
"""

import sqlite3
import json
import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.app.config import settings
from backend.app.core.logger import logger

DB_PATH: Path = settings.DATA_METADATA_DIR / "groundshift_catalog.db"


def get_db_connection() -> sqlite3.Connection:
    """Creates a connection to the SQLite catalog database with dictionary row factory."""
    settings.DATA_METADATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_catalog_db() -> None:
    """Initializes the database schema if tables do not exist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS datasets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id TEXT UNIQUE NOT NULL,
                mission TEXT NOT NULL,
                sensor_band TEXT NOT NULL,
                frequency_ghz REAL,
                product_type TEXT NOT NULL,
                processing_level TEXT NOT NULL,
                polarization TEXT NOT NULL,
                acquisition_date TEXT NOT NULL,
                orbit_direction TEXT,
                incidence_angle_near REAL,
                incidence_angle_far REAL,
                bbox_min_lon REAL NOT NULL,
                bbox_min_lat REAL NOT NULL,
                bbox_max_lon REAL NOT NULL,
                bbox_max_lat REAL NOT NULL,
                geojson_geometry TEXT,
                file_format TEXT NOT NULL,
                source_catalogue TEXT NOT NULL,
                source_url TEXT,
                access_restriction TEXT,
                local_file_path TEXT,
                file_size_bytes INTEGER,
                sha256_hash TEXT,
                download_status TEXT NOT NULL DEFAULT 'AVAILABLE',
                processing_status TEXT NOT NULL DEFAULT 'UNPROCESSED',
                provenance_manifest TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_mission ON datasets(mission);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_product_type ON datasets(product_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_acquisition_date ON datasets(acquisition_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sha256 ON datasets(sha256_hash);")
        conn.commit()
        logger.info(f"GROUNDSHIFT Catalog Database initialized at {DB_PATH}")


def upsert_dataset(record: Dict[str, Any]) -> int:
    """
    Inserts or updates a SAR dataset record.
    Deduplicates based on product_id or sha256_hash.
    """
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    record.setdefault("created_at", now)
    record["updated_at"] = now

    # Convert complex objects to JSON strings if necessary
    geojson = record.get("geojson_geometry")
    if isinstance(geojson, (dict, list)):
        record["geojson_geometry"] = json.dumps(geojson)

    provenance = record.get("provenance_manifest")
    if isinstance(provenance, (dict, list)):
        record["provenance_manifest"] = json.dumps(provenance)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO datasets (
                product_id, mission, sensor_band, frequency_ghz, product_type,
                processing_level, polarization, acquisition_date, orbit_direction,
                incidence_angle_near, incidence_angle_far,
                bbox_min_lon, bbox_min_lat, bbox_max_lon, bbox_max_lat,
                geojson_geometry, file_format, source_catalogue, source_url,
                access_restriction, local_file_path, file_size_bytes, sha256_hash,
                download_status, processing_status, provenance_manifest,
                created_at, updated_at
            ) VALUES (
                :product_id, :mission, :sensor_band, :frequency_ghz, :product_type,
                :processing_level, :polarization, :acquisition_date, :orbit_direction,
                :incidence_angle_near, :incidence_angle_far,
                :bbox_min_lon, :bbox_min_lat, :bbox_max_lon, :bbox_max_lat,
                :geojson_geometry, :file_format, :source_catalogue, :source_url,
                :access_restriction, :local_file_path, :file_size_bytes, :sha256_hash,
                :download_status, :processing_status, :provenance_manifest,
                :created_at, :updated_at
            )
            ON CONFLICT(product_id) DO UPDATE SET
                mission = excluded.mission,
                sensor_band = excluded.sensor_band,
                frequency_ghz = excluded.frequency_ghz,
                product_type = excluded.product_type,
                processing_level = excluded.processing_level,
                polarization = excluded.polarization,
                acquisition_date = excluded.acquisition_date,
                orbit_direction = excluded.orbit_direction,
                incidence_angle_near = excluded.incidence_angle_near,
                incidence_angle_far = excluded.incidence_angle_far,
                bbox_min_lon = excluded.bbox_min_lon,
                bbox_min_lat = excluded.bbox_min_lat,
                bbox_max_lon = excluded.bbox_max_lon,
                bbox_max_lat = excluded.bbox_max_lat,
                geojson_geometry = excluded.geojson_geometry,
                file_format = excluded.file_format,
                source_catalogue = excluded.source_catalogue,
                source_url = excluded.source_url,
                access_restriction = excluded.access_restriction,
                local_file_path = COALESCE(excluded.local_file_path, datasets.local_file_path),
                file_size_bytes = COALESCE(excluded.file_size_bytes, datasets.file_size_bytes),
                sha256_hash = COALESCE(excluded.sha256_hash, datasets.sha256_hash),
                download_status = excluded.download_status,
                processing_status = excluded.processing_status,
                provenance_manifest = COALESCE(excluded.provenance_manifest, datasets.provenance_manifest),
                updated_at = excluded.updated_at
        """, record)
        conn.commit()
        return cursor.lastrowid or 0


def get_dataset_by_id(dataset_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a single dataset record by internal database ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM datasets WHERE id = ?", (dataset_id,))
        row = cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        if res.get("geojson_geometry"):
            try:
                res["geojson_geometry"] = json.loads(res["geojson_geometry"])
            except Exception:
                pass
        if res.get("provenance_manifest"):
            try:
                res["provenance_manifest"] = json.loads(res["provenance_manifest"])
            except Exception:
                pass
        return res


def get_dataset_by_product_id(product_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a single dataset record by satellite product ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM datasets WHERE product_id = ?", (product_id,))
        row = cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        if res.get("geojson_geometry"):
            try:
                res["geojson_geometry"] = json.loads(res["geojson_geometry"])
            except Exception:
                pass
        if res.get("provenance_manifest"):
            try:
                res["provenance_manifest"] = json.loads(res["provenance_manifest"])
            except Exception:
                pass
        return res


def get_dataset_by_sha256(sha256: str) -> Optional[Dict[str, Any]]:
    """Checks for duplicate files by cryptographic hash."""
    if not sha256:
        return None
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM datasets WHERE sha256_hash = ?", (sha256,))
        row = cursor.fetchone()
        return dict(row) if row else None


def query_catalog(
    mission: Optional[str] = None,
    product_type: Optional[str] = None,
    polarization: Optional[str] = None,
    processing_level: Optional[str] = None,
    download_status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    bbox: Optional[tuple] = None,  # (min_lon, min_lat, max_lon, max_lat)
    limit: int = 50,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """Queries catalogued datasets with multi-attribute filtering."""
    query = ["SELECT * FROM datasets WHERE 1=1"]
    params: List[Any] = []

    if mission:
        query.append("AND mission = ?")
        params.append(mission)

    if product_type:
        query.append("AND product_type = ?")
        params.append(product_type)

    if polarization:
        query.append("AND polarization LIKE ?")
        params.append(f"%{polarization}%")

    if processing_level:
        query.append("AND processing_level = ?")
        params.append(processing_level)

    if download_status:
        query.append("AND download_status = ?")
        params.append(download_status)

    if start_date:
        query.append("AND acquisition_date >= ?")
        params.append(start_date)

    if end_date:
        query.append("AND acquisition_date <= ?")
        params.append(end_date)

    if bbox and len(bbox) == 4:
        min_lon, min_lat, max_lon, max_lat = bbox
        # Bounding box spatial intersection query
        query.append("""
            AND NOT (
                bbox_max_lon < ? OR
                bbox_min_lon > ? OR
                bbox_max_lat < ? OR
                bbox_min_lat > ?
            )
        """)
        params.extend([min_lon, max_lon, min_lat, max_lat])

    query.append("ORDER BY acquisition_date DESC LIMIT ? OFFSET ?")
    params.extend([limit, offset])

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(" ".join(query), params)
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            if d.get("geojson_geometry"):
                try:
                    d["geojson_geometry"] = json.loads(d["geojson_geometry"])
                except Exception:
                    pass
            if d.get("provenance_manifest"):
                try:
                    d["provenance_manifest"] = json.loads(d["provenance_manifest"])
                except Exception:
                    pass
            results.append(d)
        return results


def delete_dataset(product_id: str) -> bool:
    """Deletes a dataset entry from the catalog."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM datasets WHERE product_id = ?", (product_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_catalog_statistics() -> Dict[str, Any]:
    """Computes summary statistics of the catalog for the dashboard and explorer."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*), SUM(COALESCE(file_size_bytes, 0)) FROM datasets")
        total_count, total_bytes = cursor.fetchone()

        cursor.execute("SELECT mission, COUNT(*) FROM datasets GROUP BY mission")
        missions_breakdown = dict(cursor.fetchall())

        cursor.execute("SELECT product_type, COUNT(*) FROM datasets GROUP BY product_type")
        product_types_breakdown = dict(cursor.fetchall())

        cursor.execute("SELECT download_status, COUNT(*) FROM datasets GROUP BY download_status")
        download_status_breakdown = dict(cursor.fetchall())

        return {
            "total_datasets": total_count or 0,
            "total_size_bytes": total_bytes or 0,
            "total_size_mb": round((total_bytes or 0) / (1024 * 1024), 2),
            "by_mission": missions_breakdown,
            "by_product_type": product_types_breakdown,
            "by_status": download_status_breakdown,
        }

