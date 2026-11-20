# GROUNDSHIFT: System Architecture Specification
**Platform**: Multi-Mission SAR Validation and Earth Surface Change Intelligence Platform  
**Target Environment**: Windows 11 | Intel Core i5 | 16 GB RAM | Python 3.11 (Conda/Miniforge) | FastAPI | React + Vite  
**Document Version**: 1.0.0-PROPOSAL  
**Status**: Pending Architecture Review  

---

## 1. Executive Summary & Architectural Goals

GROUNDSHIFT is an open, reproducible, multi-mission Synthetic Aperture Radar (SAR) validation and surface change analytics platform. It bridges Earth Observation (EO) data streams across divergent radar frequencies (L-band, C-band, S-band), geometries (ascending/descending line-of-sight), and polarimetric modalities.

The primary architectural goal is to deliver an analysis-ready, scientifically rigorous workbench that runs reliably within a local resource profile of **16 GB RAM and an Intel i5 CPU**, while remaining modular enough to interface with cloud-native STAC catalogs and high-performance computing (HPC) workflows.

### Core Architectural Tenets
1. **Physical & Geometric Integrity**: Absolute separation of complex phase observables (InSAR displacement) from intensity observables (radiometric backscatter $\gamma^0 / \sigma^0$). Rigorous 3D vector decomposition for multi-track Line-of-Sight (LOS) observations.
2. **Deterministic Provenance**: Complete cryptographic hashing (SHA-256), STAC-compliant metadata lineage, and parameter snapshotting for every derived product.
3. **Out-of-Core Memory Safety**: Bounded memory footprint ($\le 6 \text{ GB}$ ceiling for processing sub-systems) through windowed raster I/O, lazy computation graphs (`Dask` / `Xarray`), and Cloud-Optimized GeoTIFF (COG) tiling.
4. **Epistemic Traceability**: Explicit categorisation of data layers into *Measured Observables*, *Derived/Inferred Geophysical Parameters*, and *Synthetic Calibration/Validation Benchmarks*. Simulated and real data are physically and logically segregated.

---

## 2. High-Level System Architecture

GROUNDSHIFT employs a decoupled four-tier architecture designed for local execution with cloud-readiness:

```
+-----------------------------------------------------------------------------------+
|                                PRESENTATION TIER                                  |
|  React 18 + Vite + TypeScript | MapLibre GL JS / Deck.gl | Recharts | TailwindCSS  |
|  - Multi-Sensor Split Viewer  - InSAR Profile & Vector Visualizer                 |
|  - Coherence & Scatterplot QA - Uncertainty Inspector - Provenance Audit Ledger    |
+-----------------------------------------+-----------------------------------------+
                                          | JSON REST / Server-Sent Events / GeoJSON
+-----------------------------------------v-----------------------------------------+
|                              APPLICATION SERVICE TIER                             |
|  FastAPI (Python 3.11 ASGI) + Uvicorn | Pydantic V2 Models | Background Task Broker|
|  - Ingestion & STAC Indexing API       - Decomposition & Cross-Comparison Engine   |
|  - On-the-fly Slippy Tile Server (COG) - Time-Series Query & Export Engine         |
|  - System Health & RAM Governor         - Provenance Ledger Service                 |
+-----------------------------------------+-----------------------------------------+
                                          | In-process IPC / Worker Pool (Bounded)
+-----------------------------------------v-----------------------------------------+
|                        SCIENTIFIC PROCESSING TIER (SAR CORE)                       |
|  Dask (Threaded/Local) | Xarray | Rasterio / GDAL | NumPy | SciPy | PyProj        |
|  - Multi-Mission Ingestion Adaptor (HDF5 / SAFE / GeoTIFF / NetCDF)               |
|  - Radiometric Inter-Calibration Normalizer ($\gamma^0_{naught}$, RTC)             |
|  - Dual-Geometry 2D/3D InSAR Vector Decomposer ($d_{up}, d_{east}$)               |
|  - Phase Unwrapping Error & Triplet Closure Verifier                              |
|  - Spatio-temporal Moving Window Statistics & Uncertainty Quantifier             |
+-----------------------------------------+-----------------------------------------+
                                          | File I/O (Chunked) & SQL
+-----------------------------------------v-----------------------------------------+
|                            STORAGE & PERSISTENCE TIER                             |
|  - Metadata DB: SQLite / SpatiaLite (or DuckDB with Spatial Extension)            |
|  - Data Lakehouse: Local Storage in COG / Zarr (Hierarchical STAC Layout)        |
|  - Ground Truth Cache: In-situ GNSS Station Baselines, CWC Hydrology Vectors      |
|  - Audit Log: JSON-LD Provenance Records                                         |
+-----------------------------------------------------------------------------------+
```

---

## 3. Tier-by-Tier Component Specifications

### 3.1 Presentation Tier (Frontend)
- **Framework**: React 18, Vite, TypeScript.
- **Styling**: Tailwind CSS, Shadcn UI components.
- **Geospatial Mapping**:
  - `MapLibre GL JS` with WebGL rendering for high-performance raster/vector overlay.
  - Multi-view synchronization (split-screen / swipe tool) to compare co-registered NISAR L-band vs Sentinel-1 C-band backscatter or displacement.
  - Vector field rendering (`Deck.gl` `IconLayer` or directional arrow lines) showing horizontal displacement vectors ($d_{east}$) alongside vertical subsidence/uplift heatmaps ($d_{up}$).
- **Scientific Visualizations**:
  - Longitudinal displacement profile charts with $1\sigma / 2\sigma$ uncertainty envelopes (`Recharts`).
  - Polarimetric decomposition ternary plots (Freeman-Durden / Cloude-Pottier H-$\alpha$ spaces).
  - Coherence vs temporal baseline scatterplots.
  - Cross-sensor backscatter regression plots with regression statistics ($R^2$, RMSE, bias).

### 3.2 Application Service Tier (Backend API)
- **Framework**: `FastAPI` running on `Python 3.11` via `Uvicorn`.
- **Concurrency & Job Scheduling**: Asynchronous request handling with background execution managed by a thread-safe worker queue (`concurrent.futures.ThreadPoolExecutor` bounded to 2-3 workers to avoid RAM thrashing).
- **Dynamic Tile Server**: Local titiler-compatible or native `rio-tiler` endpoints dynamically serving Slippy Map tiles (`/tiles/{z}/{x}/{y}.png`) directly from local Cloud-Optimized GeoTIFFs (COGs) via HTTP range requests, streaming only visible overviews into client memory.
- **Memory Safety Governor**: Middleware intercepting processing requests; validates current free host memory via `psutil`. Rejects or queues operations if free RAM drops below 2.5 GB.
- **Validation Endpoints**:
  - `/api/v1/ingest`: Trigger parsing, validation, and COG indexing of satellite assets.
  - `/api/v1/validation/cross-compare`: Execute windowed radiometric or interferometric comparison.
  - `/api/v1/validation/decompose`: Execute ascending + descending LOS decomposition.
  - `/api/v1/validation/insitu-benchmark`: Compare SAR displacement time-series against GNSS stations.
  - `/api/v1/provenance/{asset_id}`: Retrieve cryptographic lineage and processing parameters.

### 3.3 Scientific Processing Tier (SAR Core Engine)
- **Memory Architecture**: Out-of-core streaming via `Dask.array` chunks wrapped in `xarray.DataArray`.
- **Ingestion Adaptors**:
  - *NISAR*: HDF5 reader (`h5py`) extracting L-SAR / S-SAR science datasets (`//science/LSAR/GCOV`, `//science/LSAR/GUNW`), reading radar geometry grids and bounding coordinates without loading full rasters.
  - *Sentinel-1*: SAFE format reader / parser extracting Level-1 GRD calibrated backscatter and Level-1 SLC / ASF HyP3 pre-computed GUNW products.
  - *SAOCOM-1A/1B*: XML / GeoTIFF parser for Level-1 Ground Range / SLC products.
  - *UAVSAR*: HDF5 / binary format reader handling repeat-pass interferometry products (RPI) and polarimetric matrices.
- **Scientific Algorithms**:
  - *Radiometric Normalization*: Converts multi-mission amplitude to Terrain-flattened gamma-naught ($\gamma^0_{RTC}$) using Copernicus 30m DEM or local SRTM DEM.
  - *Geometric Alignment*: Raster re-projection and resampling using sub-pixel spline or cubic resampling via `GDAL` / `rasterio.warp` ensuring grid alignment with zero phase distortion.
  - *Vector Decomposition*: Inversion of multi-angle LOS observations to resolve 2-component ($d_{vertical}, d_{east}$) or 3-component displacement fields:
    $$\begin{bmatrix} d_{LOS, asc} \\ d_{LOS, desc} \end{bmatrix} = \begin{bmatrix} -\sin\theta_{asc}\cos\alpha_{asc} & \cos\theta_{asc} \\ -\sin\theta_{desc}\cos\alpha_{desc} & \cos\theta_{desc} \end{bmatrix} \begin{bmatrix} d_{east} \\ d_{up} \end{bmatrix}$$
  - *Phase Loop Closure Audit*: Detects phase unwrapping anomalies in closed interferometric triplets ($\Phi_{12} + \Phi_{23} - \Phi_{13} \stackrel{?}{=} 0$).

### 3.4 Storage & Persistence Tier
- **Relational / Geospatial Metadata**: SQLite + SpatiaLite extension (or embedded DuckDB with `spatial` extension). Stores scene footprints, acquisition parameters (wavelength, orbit direction, incidence angle, heading, polarization), temporal baselines, and quality metrics.
- **Analysis-Ready Data (ARD) Store**:
  - Master storage layout: Standardized directory tree structured by Mission / Track / Frame / Date.
  - Raster format: Cloud-Optimized GeoTIFF (deflate/zstd compression, internal overviews, $256\times 256$ tiling) or chunked Zarr arrays for multidimensional time series.
- **GNSS / Hydrological Reference Store**: Standard GeoJSON / Parquet formats storing validated station coordinates and benchmark velocity series (IGS stations, CWC stage data).
- **Provenance Ledger**: Append-only JSON-LD documents storing UUIDs, input SHA-256 hashes, processing timestamps, software environment hashes, and parameter configs.

---

## 4. Hardware Optimization Strategy (16 GB RAM Profile)

Working with multi-gigabyte SAR data on a 16 GB RAM Windows 11 workstation with an Intel i5 processor requires strict controls to eliminate memory exhaustion and paging:

```
+-----------------------------------------------------------------------------------+
|                         16 GB PHYSICAL RAM ALLOCATION PLAN                        |
+-----------------------------------------------------------------------------------+
|  [OS & System Services (Windows 11, Defender, Shell)]                : ~ 4.0 GB   |
|  [Frontend Dev Server & Chrome Browser (UI + WebGL Context)]         : ~ 2.5 GB   |
|  [FastAPI Backend, Uvicorn Server, DB Connection Pool]               : ~ 1.5 GB   |
|  [Dask Out-of-Core Processing Worker Pool (Hard-Limited Ceiling)]   : ~ 6.0 GB   |
|  [Emergency Headroom / OS Cache Safety Margin]                       : ~ 2.0 GB   |
+-----------------------------------------------------------------------------------+
```

### Key Memory-Safety Measures
1. **Windowed Chunk Processing**:
   No operation ever calls `read()` on an entire SAR scene. All spatial filters, radiometric conversions, and decomposition inversions operate on sliding spatial blocks (e.g., $1024 \times 1024$ pixels $\approx 8 \text{ MB}$ per channel in Float32).
2. **Dask Worker Configuration**:
   - Single process with 2-4 threads, avoiding multiprocessing overhead where memory is copied between worker processes.
   - Hard memory target: `memory_limit: 6GB` with aggressive spill-to-disk or temporary scratch caching on NVMe storage.
3. **Sparse Matrix & Multi-Temporal Compression**:
   Time-series SBAS / PS matrices are stored in compressed sparse formats or chunked Zarr stores along the spatial dimensions, loading single-pixel or localized bounding-box histories into RAM on demand.
4. **Decimated Pyramid Overviews for Visual Exploration**:
   The interactive map viewer only requests overview tiles (e.g., resolution levels $1/4, 1/8, 1/16$) during panning and zooming. Full-resolution arrays are accessed only when the user executes a localized scientific extraction or profile analysis.

---

## 5. Security, Provenance & Validation Design

### 5.1 Dataset Provenance Architecture
Every dataset imported or generated in GROUNDSHIFT receives a tamper-evident STAC-compliant manifest:

```json
{
  "id": "GROUNDSHIFT-GDEC-20261115-001",
  "type": "Feature",
  "provenance": {
    "source_datasets": [
      {
        "mission": "NISAR",
        "product_type": "GUNW",
        "granule": "NISAR_L2_PR_GUNW_001_002_003_20261101T003000.h5",
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      {
        "mission": "SENTINEL-1A",
        "product_type": "GUNW",
        "granule": "S1-GUNW-A-20261102T003500-track012.nc",
        "sha256": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
      }
    ],
    "algorithm": {
      "name": "groundshift.core.decomposition.los_inversion",
      "version": "1.0.0",
      "parameters": {
        "regularization": "tikhonov",
        "coherence_threshold": 0.4,
        "dem_source": "Copernicus_30m"
      }
    },
    "classification": "DERIVED_GEOPHYSICAL_INFERRED"
  }
}
```

### 5.2 Strict Scientific Data Stratification
To prevent data contamination, all platform interfaces, visual overlays, and API responses strictly classify layers:
1. **Class A: Measured Observables**: Unmodified, sensor-specific radar observables ($\sigma^0, \gamma^0, \text{LOS phase } \Delta\phi$).
2. **Class B: Derived Geophysical Estimates**: Spatio-temporally estimated products requiring physical modeling ($d_{vertical}, d_{east}$, soil moisture proxies, decomposition components). Must include uncertainty bounds ($\sigma, \gamma$).
3. **Class C: Synthetic & Reference Benchmarks**: Synthetic interferometric test ramps, simulated phase patterns, or forward-modeled ground truth used strictly to verify algorithm correctness. These are visually badged with high-contrast UI warnings to prevent accidental conflation with real satellite observations.

---

## 6. Target Directory Layout

```
d:/groundshift/
|-- .gitignore
|-- README.md
|-- ARCHITECTURE.md
|-- IMPLEMENTATION_PLAN.md
|-- DATA_REQUIREMENTS.md
|-- SCIENTIFIC_METHODOLOGY.md
|-- environment.yml
|-- pyproject.toml
|-- backend/
|   |-- app/
|   |   |-- __init__.py
|   |   |-- main.py
|   |   |-- config.py
|   |   |-- api/
|   |   |   |-- __init__.py
|   |   |   |-- v1/
|   |   |       |-- ingest.py
|   |   |       |-- comparison.py
|   |   |       |-- decomposition.py
|   |   |       |-- validation.py
|   |   |       |-- tiles.py
|   |   |       +-- provenance.py
|   |   |-- core/
|   |   |   |-- __init__.py
|   |   |   |-- memory_manager.py
|   |   |   |-- logging.py
|   |   +-- services/
|   |       |-- __init__.py
|   |       |-- stac_service.py
|   |       +-- audit_service.py
|   +-- sar_engine/
|       |-- __init__.py
|       |-- readers/
|       |   |-- nisar_reader.py
|       |   |-- sentinel1_reader.py
|       |   |-- saocom_reader.py
|       |   +-- uavsar_reader.py
|       |-- processing/
|       |   |-- radiometric.py
|       |   |-- decomposition.py
|       |   |-- filtering.py
|       |   +-- statistics.py
|       +-- validation/
|           |-- insitu_aligner.py
|           |-- closure_audit.py
|           +-- uncertainty.py
|-- frontend/
|   |-- index.html
|   |-- package.json
|   |-- tsconfig.json
|   |-- vite.config.ts
|   +-- src/
|       |-- App.tsx
|       |-- main.tsx
|       |-- components/
|       |   |-- map/
|       |   |   |-- MapContainer.tsx
|       |   |   |-- DualSplitViewer.tsx
|       |   |   +-- VectorOverlay.tsx
|       |   |-- charts/
|       |   |   |-- DisplacementProfile.tsx
|       |   |   |-- ScatterComparison.tsx
|       |   |   +-- CoherenceHistogram.tsx
|       |   |-- audit/
|       |   |   +-- ProvenanceInspector.tsx
|       |   +-- common/
|       |       |-- DataClassificationBadge.tsx
|       |       +-- MemoryIndicator.tsx
|       |-- hooks/
|       |-- services/
|       +-- types/
|-- data/
|   |-- raw/                 # Ignored from git, mounted local storage
|   |-- processed/           # COGs & Zarr ARD datasets
|   |-- ground_truth/        # GNSS coordinate baselines, CWC gauges
|   +-- metadata/            # SQLite / SpatiaLite catalog & provenance logs
+-- tests/
    |-- unit/
    |-- scientific/
    +-- integration/
```

---

## 7. Approval & Next Steps

This architecture delivers a defensible, memory-safe, and physically compliant baseline.  
Upon user approval, implementation proceeds systematically according to `IMPLEMENTATION_PLAN.md`.

