# GROUNDSHIFT: Detailed Implementation Roadmap & Technical Plan

**Document Version**: 1.0.0-PROPOSAL  
**Target Environment**: Windows 11 | Intel Core i5 | 16 GB RAM | Python 3.11 | Conda/Miniforge  
**Status**: Pending Architecture Review  

---

## 1. Project Overview & Milestones

GROUNDSHIFT is implemented across six structured phases, moving from environment configuration and memory-safe SAR I/O to multi-mission scientific algorithms, in-situ geodetic validation, and an interactive full-stack geospatial platform.

```
+---------------------------------------------------------------------------------------------+
|                                    IMPLEMENTATION ROADMAP                                   |
+---------------------------------------------------------------------------------------------+
| Phase 0: Environment Setup, Dependencies & Project Scaffolding                              |
|   - Conda / Miniforge Environment with GDAL/PROJ binaries                                    |
|   - Workspace directory structure and configuration                                         |
+---------------------------------------------------------------------------------------------+
                                              |
                                              v
| Phase 1: Core SAR Engine, Ingestion Adaptors & Tile Server                                  |
|   - NISAR HDF5, Sentinel-1 SAFE/NetCDF, SAOCOM, UAVSAR readers                              |
|   - Memory-safe windowed COG generator and Slippy Map tile server                           |
+---------------------------------------------------------------------------------------------+
                                              |
                                              v
| Phase 2: Scientific Processing Engine & Multi-Mission InSAR Decomposition                   |
|   - Radiometric terrain-flattening ($\gamma^0_{RTC}$) normalizer                            |
|   - 2D LOS vector decomposition ($d_{east}, d_{up}$) with GDOP check                        |
|   - Phase triplet closure loop auditor & cycle slip detector                                |
+---------------------------------------------------------------------------------------------+
                                              |
                                              v
| Phase 3: In-Situ Geodetic Validation & Provenance Ledger                                    |
|   - Continuous GNSS 3D-to-LOS projection engine                                             |
|   - Cross-sensor statistical comparison ($r, RMSE, \text{MBE}, \chi^2$)                      |
|   - Cryptographic SHA-256 provenance ledger & STAC catalog integration                      |
+---------------------------------------------------------------------------------------------+
                                              |
                                              v
| Phase 4: Full-Stack Web Application (FastAPI + React 18 + MapLibre GL)                     |
|   - Asynchronous FastAPI backend with RAM Governor middleware                               |
|   - React frontend: Dual Split-Screen Map Viewer, Profile Charting, InSAR Vector Layers     |
+---------------------------------------------------------------------------------------------+
                                              |
                                              v
| Phase 5: Verification, Chennai & Cauvery Study Case Validations, Packaging                 |
|   - Synthetic ground-truth benchmark tests (forward and inverse validation)                 |
|   - Chennai subsidence & Cauvery delta coherence case workflows                             |
|   - Performance benchmarking & memory profiling under 16 GB RAM                             |
+---------------------------------------------------------------------------------------------+
```

---

## 2. Detailed Phase Breakdown

### Phase 0: Environment Setup, Dependencies & Scaffolding
- **Goal**: Establish a reproducible Windows 11 development environment with clean binary links for geospatial C-libraries (GDAL, GEOS, PROJ).
- **Tasks**:
  1. Define Conda `environment.yml` pinning Python 3.11, `gdal`, `rasterio`, `shapely`, `pyproj`, `geopandas`, `xarray`, `rioxarray`, `dask`, `h5py`, `fastapi`, `uvicorn`, `pydantic`.
  2. Setup frontend development workspace with Node.js, Vite, React, TypeScript, Tailwind CSS.
  3. Initialize directory layout (as defined in `ARCHITECTURE.md`).
  4. Implement memory profiling hooks (`psutil`, `tracemalloc`) for automated testing.
- **Deliverables**:
  - `environment.yml` and `package.json`.
  - Configured project directory structure.
  - Automated smoke test verifying GDAL and HDF5 driver compatibility on Windows 11.

### Phase 1: Core SAR Engine, Ingestion Adaptors & Tile Server
- **Goal**: Implement out-of-core, memory-safe data adaptors for all supported SAR missions and a streaming dynamic tile service.
- **Tasks**:
  1. Build `nisar_reader.py`: Slice-based HDF5 reader extracting GCOV backscatter grids and GUNW interferometric phase without loading entire datasets.
  2. Build `sentinel1_reader.py`: Parser for Level-1 GRD calibrated backscatter and Sentinel-1 GUNW NetCDF/COG files.
  3. Build `saocom_reader.py` and `uavsar_reader.py` for L-band validation pairs.
  4. Implement `cog_converter.py`: Transforms raw products into Cloud-Optimized GeoTIFFs (internal overviews, deflate compression, $256 \times 256$ block tiling).
  5. Implement `tile_server.py`: Local dynamic Slippy Map endpoint (`/tiles/{layer}/{z}/{x}/{y}.png`) using `rio-tiler` or windowed raster reads.
- **Deliverables**:
  - Validated reader suite with unit tests verifying memory footprint $\le 250 \text{ MB}$ per read operation.
  - Interactive tile generation API serving sub-second imagery tiles directly from local disk.

### Phase 2: Scientific Processing Engine & InSAR Decomposition
- **Goal**: Deliver the mathematical core for multi-mission radiometric normalization and geometric vector decomposition.
- **Tasks**:
  1. Build `radiometric.py`: Normalizes multi-mission SAR amplitude into terrain-flattened $\gamma^0_{RTC}$ with ENL estimation.
  2. Build `decomposition.py`: Inverts ascending and descending LOS displacement observations into horizontal East-West ($d_{east}$) and Vertical ($d_{up}$) vectors using weighted least squares, including condition number $\kappa(\mathbf{G})$ and GDOP computation.
  3. Build `closure_audit.py`: Triangular phase closure residual auditor for InSAR triplets ($C_{123} = \mathcal{W}\{\Delta\phi_{12} + \Delta\phi_{23} - \Delta\phi_{13}\}$) to detect and mask unwrapping cycle slips.
  4. Build `spatial_resampler.py`: Grid alignment engine matching multi-resolution rasters (e.g., $10\text{ m}$ C-band with $30\text{ m}$ L-band) with sub-pixel conservation.
- **Deliverables**:
  - Tested scientific modules with numerical unit tests.
  - Synthetic deformation field verification proving exact numerical recovery of simulated $d_{east}$ and $d_{up}$.

### Phase 3: In-Situ Geodetic Validation & Provenance Ledger
- **Goal**: Implement independent ground-truth anchoring and complete cryptographic traceability.
- **Tasks**:
  1. Build `insitu_aligner.py`: Ingests continuous GNSS 3D station baselines and projects them into the exact satellite Line-of-Sight vector ($d_{LOS, gnss} = \mathbf{d}_{gnss} \cdot \hat{u}_{LOS}$).
  2. Build `uncertainty.py`: Computes spatial-windowed statistics ($r, RMSE, \text{MBE}, \chi^2_{red}$) and propagates posterior variance matrices $\mathbf{\Sigma}_d$.
  3. Build `audit_service.py`: Generates immutable JSON-LD provenance manifests containing SHA-256 hashes of input rasters, algorithm IDs, and processing parameters.
  4. Build metadata database service (`sqlite_catalog.py`) for scene footprints and quality tags.
- **Deliverables**:
  - In-situ geodetic validation pipeline.
  - Provenance audit ledger with exportable JSON-LD verification certificates.

### Phase 4: Full-Stack Web Application
- **Goal**: Develop the unified user interface and responsive backend API.
- **Tasks**:
  1. Build FastAPI application endpoints:
     - `/api/v1/ingest`: Trigger product parsing and COG indexing.
     - `/api/v1/validation/cross-compare`: Execute windowed radiometric or interferometric comparison.
     - `/api/v1/validation/decompose`: Execute ascending + descending LOS decomposition.
     - `/api/v1/validation/insitu-benchmark`: Compare SAR displacement time-series against GNSS stations.
     - `/api/v1/tiles/{dataset_id}/{z}/{x}/{y}.png`: Raster tile rendering.
     - `/api/v1/system/memory`: Real-time host RAM monitoring and process throttling.
  2. Build React 18 frontend:
     - `MapContainer.tsx`: MapLibre GL JS integration with custom WebGL layers.
     - `DualSplitViewer.tsx`: Synchronized split-screen swipe tool for cross-mission comparison.
     - `VectorOverlay.tsx`: Directional arrow field visualizing $d_{east}$ horizontal displacement.
     - `DisplacementProfile.tsx`: Interactive cross-sectional profile chart with $\pm 1\sigma$ envelopes.
     - `ProvenanceInspector.tsx`: Visual audit trail modal showing complete processing lineage.
     - `DataClassificationBadge.tsx`: Visual color-coded warning banners distinguishing *Measured*, *Derived*, and *Synthetic* data.
- **Deliverables**:
  - Fully integrated, responsive web application running smoothly on the host machine.

### Phase 5: Verification, Case Studies, Packaging & Documentation
- **Goal**: Execute real-world regional demonstrations for Chennai and the Cauvery Delta, benchmark performance, and deliver complete documentation.
- **Tasks**:
  1. **Chennai Urban Case Study**:
     - Pipeline execution over the Chennai metropolitan bounding box (`80.05° - 80.35° E`, `12.85° - 13.30° N`).
     - Urban PS-InSAR subsidence mapping along the OMR corridor and Metro Rail alignment.
  2. **Cauvery Delta Agricultural Case Study**:
     - Pipeline execution over the Cauvery Delta bounding box (`78.90° - 79.95° E`, `10.25° - 11.45° N`).
     - L-band vs C-band temporal coherence analysis over seasonal paddy crop cycles.
  3. **Performance Profiling**:
     - End-to-end stress testing under 16 GB RAM constraint; verify zero OOM errors.
  4. **Documentation**:
     - Complete API reference, user guides, and reproducible execution scripts.
- **Deliverables**:
  - Validated study area datasets and analysis reports.
  - End-to-end test suite passing with $> 85\%$ coverage.

---

## 3. Technical Risks & Mitigation Strategies

| Risk ID | Technical Risk Description | Severity | Impact | Mitigation Strategy in GROUNDSHIFT |
| :--- | :--- | :--- | :--- | :--- |
| **TR-01** | **Memory Exhaustion (OOM) on 16 GB RAM** during multi-temporal InSAR or large-scene processing. | Critical | Process crash / OS paging freeze. | 1. Strict chunked windowing ($1024 \times 1024$ pixels) via `Rasterio` and `Dask`.<br>2. Hard Dask RAM limit ceiling of 6.0 GB.<br>3. Background Memory Governor middleware blocking requests when free RAM $< 2.5\text{ GB}$. |
| **TR-02** | **Phase Unwrapping Ambiguities** causing $2\pi$ integer cycle slips in high-strain or agricultural areas. | High | Fictitious displacement steps ($\sim 2.8\text{ cm}$ C-band, $\sim 12\text{ cm}$ L-band). | 1. Implement closed-loop interferometric triplet auditing ($C_{123} = \mathcal{W}\{\Delta\phi_{12} + \Delta\phi_{23} - \Delta\phi_{13}\}$).<br>2. Dynamic masking of unwrapping error pixels.<br>3. Exclusion of low-coherence pixels ($\gamma < 0.35$). |
| **TR-03** | **LOS Vector Inversion Instability** when ascending and descending incidence angles are nearly parallel ($|\theta_{asc} - \theta_{desc}| < 3^\circ$). | High | Extreme amplification of noise in decomposed $d_{east}$ and $d_{up}$. | 1. Calculate the condition number $\kappa(\mathbf{G})$ and GDOP prior to inversion.<br>2. Implement Tikhonov regularization when condition number exceeds threshold ($\kappa > 10$).<br>3. Provide uncertainty raster maps ($\sigma_{east}, \sigma_{up}$) with every decomposed product. |
| **TR-04** | **Incompatible Multi-Mission Grids & Resolutions** (e.g., $10\text{ m}$ Sentinel-1 vs $30\text{ m}$ NISAR). | Medium | Spatial aliasing and false correlation artifacts. | 1. Establish common projected UTM grids (e.g., EPSG:32644 for Tamil Nadu).<br>2. Area-weighted average downsampling for intensity/coherence.<br>3. Sub-pixel spline resampling for continuous phase/displacement surfaces. |
| **TR-05** | **Atmospheric Phase Contamination** (Tropospheric water vapor in C-band, Ionospheric TEC in L-band). | High | Long-wavelength phase ramps mistaken for ground subsidence/uplift. | 1. Ingest GACOS or ERA5 atmospheric delay models for Sentinel-1.<br>2. Ingest split-spectrum ionospheric phase screens for NISAR/SAOCOM.<br>3. Spatial high-pass / temporal low-pass filtering in multi-temporal stacks. |
| **TR-06** | **Windows 11 Native C-Library Binding Conflicts** (GDAL, PROJ, HDF5 DLLs in Python). | Medium | Import errors and runtime DLL crashes on Windows. | 1. Use pure Miniforge / Conda-Forge channel for strict ABI compatibility.<br>2. Automated pre-flight environment check validating GDAL/PROJ DLL paths before application boot. |

---

## 4. Rigorous Scientific Testing Strategy

To adhere strictly to the rule: **Never generate fake satellite observations, and keep measured, simulated, and inferred values separated**, the testing architecture is segmented:

```
+-----------------------------------------------------------------------------+
|                             TESTING ARCHITECTURE                            |
+-----------------------------------------------------------------------------+
| 1. Pure Unit Tests:                                                         |
|    - Mathematical correctness of vector geometry formulas.                 |
|    - Phase wrapping operator $\mathcal{W}\{\cdot\}$ boundary conditions.   |
|    - HDF5 slice reader index calculation.                                   |
+-----------------------------------------------------------------------------+
                                      |
                                      v
| 2. Controlled Forward-Inverse Benchmark Tests (Synthetic Physics):          |
|    - Synthesize known 3D surface displacement field $\mathbf{d}_{true}$.    |
|    - Forward-project onto ascending & descending LOS: $d_{LOS} = \mathbf{d} \cdot \hat{u}$.|
|    - Inject Gaussian noise and run 2D InSAR inversion.                      |
|    - Verify recovered $[\hat{d}_{east}, \hat{d}_{up}]$ matches true field   |
|      within analytical error bounds.                                        |
|    - Explicitly labeled: `BENCHMARK_SYNTHETIC`.                             |
+-----------------------------------------------------------------------------+
                                      |
                                      v
| 3. Real Observational Regression Tests:                                     |
|    - Real sample granules (NISAR sample HDF5, Sentinel-1 SAFE, IGS GNSS).   |
|    - Verified end-to-end checksum and provenance consistency.              |
|    - Explicitly labeled: `OBSERVABLE_MEASURED`.                             |
+-----------------------------------------------------------------------------+
                                      |
                                      v
| 4. Memory Profiling & Stress Tests:                                         |
|    - Execute chunked raster pipelines while tracking peak RSS memory via    |
|      `tracemalloc` and `psutil`.                                            |
|    - Guarantee peak RAM does not exceed 6.0 GB under multi-scene processing.|
+-----------------------------------------------------------------------------+
```

---

## 5. Definition of Done & Success Criteria

GROUNDSHIFT achieves production-grade completion when:
1. **Physical Accuracy**: InSAR 2D vector decomposition reproduces independent GNSS vertical and east velocities within $\le 3\text{ mm/yr}$ over stable benchmark stations.
2. **Memory Compliance**: End-to-end ingestion, decomposition, and tile generation run continuously on the Windows 11 / 16 GB RAM machine without crashing or triggering OS disk swap thrashing.
3. **Cross-Mission Consistency**: Backscatter comparisons between same-frequency platforms (e.g. SAOCOM vs NISAR L-band) demonstrate radiometric slope $\alpha \in [0.95, 1.05]$ over calibrated PICS targets.
4. **Data Integrity**: 100% of generated scientific assets include verifiable SHA-256 provenance manifests, uncertainty rasters, and unambiguous data classification badges.

