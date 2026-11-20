# GROUNDSHIFT
**Multi-Mission SAR Validation and Earth Surface Change Intelligence Platform**

GROUNDSHIFT is an open, reproducible, multi-mission Synthetic Aperture Radar (SAR) validation and surface change analytics platform. It bridges Earth Observation (EO) data streams across divergent radar frequencies (L-band, C-band, S-band), geometries (ascending/descending line-of-sight), and polarimetric modalities, complementing NASA and ESA scientific workflows.

---

## 1. Supported Missions & Observables

| Mission | Operator | Radar Band | Primary Ingested Products | Physics Role |
| :--- | :--- | :--- | :--- | :--- |
| **NASA-ISRO NISAR** | NASA / ISRO | L-band (1.26 GHz) & S-band (3.2 GHz) | GCOV, GUNW, GSLC | High vegetation coherence, large deformation gradients |
| **Copernicus Sentinel-1** | ESA / Copernicus | C-band (5.405 GHz) | GRD, SLC, GUNW | Sub-centimeter displacement sensitivity, dense 6–12 day time-series |
| **SAOCOM-1A / 1B** | CONAE (Argentina) | L-band (1.275 GHz) | GTC, SLC (Quad-Pol) | L-band cross-validation partner for NISAR, soil moisture |
| **RADARSAT / RCM** | CSA (Canada) | C-band (5.405 GHz) | GRD, SLC, Compact Pol | High-revisit C-band verification, compact polarimetry |
| **NASA UAVSAR** | NASA JPL | L-band (Airborne) | RPI, POLSAR Stokes | Sub-meter airborne ground-truth validation |

---

## 2. Primary Study Areas

1. **Chennai Metropolitan Area, Tamil Nadu, India**:
   - Urban coastal subsidence monitoring along IT corridors (OMR) and Chennai Metro Rail Phase 2 tunneling.
   - Post-cyclone inundation mapping (Cyclone Michaung baseline) and coastal erosion.
   - Projected Coordinate System: `UTM Zone 44N (EPSG:32644)`.
2. **Cauvery Delta, Tamil Nadu, India**:
   - Alluvial agricultural basin (Thanjavur, Tiruvarur, Nagapattinam).
   - Comparative L-band vs. C-band temporal coherence analysis across paddy rice crop cycles (*Kuruvai* / *Samba*).
   - Soil moisture and deltaic ground stability dynamics.
3. **Expandable Extents**: Configurable bounding box specification for global study areas.

---

## 3. Physical & Architectural Principles

- **Strict Separation of Amplitude and Phase**: Intensity products (Sentinel-1 GRD, NISAR GCOV) are strictly segregated from interferometric phase displacement pipelines.
- **InSAR 2D Line-of-Sight (LOS) Vector Decomposition**: Scalar radar measurements from opposing tracks are never directly differenced without geometry projection. Observations are inverted into horizontal East-West ($d_{east}$) and Vertical ($d_{up}$) displacement vectors using weighted least squares:
  $$\begin{bmatrix} d_{LOS, asc} \\ d_{LOS, desc} \end{bmatrix} = \begin{bmatrix} -\sin\theta_{asc}\cos\alpha_{asc} & \cos\theta_{asc} \\ -\sin\theta_{desc}\cos\alpha_{desc} & \cos\theta_{desc} \end{bmatrix} \begin{bmatrix} d_{east} \\ d_{up} \end{bmatrix}$$
- **Cycle Slip Auditing**: Closed interferometric triplets audit phase unwrapping errors ($C_{123} = \mathcal{W}\{\Delta\phi_{12} + \Delta\phi_{23} - \Delta\phi_{13}\} \stackrel{?}{=} 0$).
- **16 GB RAM Out-of-Core Profile**: Memory Governor monitors available host RAM, bounding raster operations to $1024 \times 1024$ spatial windows.
- **Data Provenance**: Every generated asset is cryptographically tagged (`OBSERVABLE_MEASURED`, `DERIVED_GEOPHYSICAL_INFERRED`, or `BENCHMARK_SYNTHETIC`).

---

## 4. Quickstart Guide (Windows 11)

### Prerequisites
- Windows 11 (Intel Core i5, 16 GB RAM)
- Miniforge / Conda with Python 3.11 (`groundshift` environment)
- Node.js v20+ / npm v10+

### Option A: Using Startup Scripts
1. Start Backend:
   ```powershell
   .\scripts\start_backend.ps1
   ```
2. Start Frontend:
   ```powershell
   .\scripts\start_frontend.ps1
   ```

### Option B: Manual Startup

#### Backend
```powershell
$env:PYTHONPATH = "d:\groundshift"
C:\Users\jeyak\miniforge3\envs\groundshift\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Root: `http://127.0.0.1:8000`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`

#### Frontend
```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
- Dashboard: `http://127.0.0.1:5173`

---

## 5. Running Tests

Run the complete scientific physics and API test suite:
```powershell
$env:PYTHONPATH = "d:\groundshift"
C:\Users\jeyak\miniforge3\envs\groundshift\Scripts\pytest.exe tests/ -v
```

---

## 6. Project Layout

```
GROUNDSHIFT/
|-- backend/                 # FastAPI application
|   |-- app/
|   |   |-- api/v1/          # Endpoints (health, missions, study areas, validation, ingest, processing, validation-engine)
|   |   |-- core/            # Memory governor, logger, error handlers
|   |   |-- config.py        # Environment configuration
|   |   +-- main.py          # ASGI application entrypoint
|-- processing/              # Scientific SAR core
|   |-- product_classifier.py# Product classification & workflow selector
|   |-- quality_assurance.py # NoData, coherence masking, reference offset
|   |-- displacement_engine.py# WLS rate estimation (mm/yr), RMSE, residuals
|   |-- spatial_analysis.py  # Subsetting & Haversine DBSCAN clustering
|   |-- multi_mission_comparator.py# Look-vector geometry & cross-mission statistics
|   |-- spatial_alignment.py # Geographic intersection & CRS compatibility
|   |-- temporal_alignment.py# Temporal baseline & dynamic ground condition checks
|   |-- gnss_benchmark_reference.py# In-situ GNSS continuous 3D-to-LOS projection
|   |-- validation_engine.py # Statistical metrics, uncertainty budget & integrity
|   |-- report_generator.py  # Exportable Markdown & JSON-LD research reports
|   |-- raster_exporter.py   # Memory-efficient GeoTIFF and CSV exports
|   |-- decomposition.py     # InSAR 2D vector inversion
|   |-- closure_audit.py     # Phase triplet closure & cycle slip detector
|   |-- insitu_aligner.py    # GNSS 3D-to-LOS projection & validation metrics
|   |-- radiometric.py       # Terrain-flattening (gamma0_RTC) & ENL
|   |-- catalog_db.py        # Persistent SQLite dataset catalog
|   |-- sar_inspector.py     # Header-only GeoTIFF/HDF5/SAFE inspector
|   |-- discovery_clients.py # Multi-mission remote DAAC search
|   +-- provenance.py        # SHA-256 lineage manifests
|-- frontend/                # React 18 + Vite + TypeScript dashboard
|   |-- src/
|   |   |-- components/      # Leaflet maps, Plotly charts, scientific badges
|   |   |-- pages/           # Dashboard, Study Areas, Missions, Explorer, Processing, Validation, Inversion, Triplet Audit, Benchmarks
|   |   |-- services/        # API client
|   |   +-- types/           # TypeScript interfaces
|-- data/                    # Storage directories (excluded from Git)
|   |-- raw/                 # Ephemeral radar granules
|   |-- processed/           # ARD COGs and Zarr stores
|   +-- metadata/            # STAC catalog & database
|-- tests/                   # Pytest suite (48 automated tests)
|-- docs/                    # Technical documentation
|   |-- DATA_INGESTION_ENGINE.md
|   |-- SCIENTIFIC_PROCESSING_ENGINE.md
|   +-- VALIDATION_ENGINE.md
|-- scripts/                 # Windows startup scripts
|-- ARCHITECTURE.md          # System architecture specification
|-- DATA_REQUIREMENTS.md     # Multi-mission ingestion specification
|-- SCIENTIFIC_METHODOLOGY.md # Mathematical physics & geodesy foundation
+-- IMPLEMENTATION_PLAN.md   # Phased implementation roadmap
```

