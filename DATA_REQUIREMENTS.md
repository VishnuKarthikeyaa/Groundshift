# GROUNDSHIFT: Data Requirements & Multi-Mission Ingestion Specification

**Document Version**: 1.0.0-PROPOSAL  
**Target Environment**: Windows 11 | 16 GB RAM | Local / Hybrid Cloud File Store  
**Status**: Pending Architecture Review  

---

## 1. Multi-Mission SAR Product Landscape

GROUNDSHIFT ingests, standardizes, and cross-validates data products from disparate satellite and airborne SAR platforms. Because radar signals interact with the terrain according to their wavelength, polarization, and viewing geometry, each mission product serves specific physical applications.

### 1.1 Product Characteristic Matrix

| Mission / Platform | Operator | Radar Band | Center Freq (Wavelength) | Primary Products Ingested | Polarizations | Nominal Resolution | Ingestion Level | Primary Utility in GROUNDSHIFT |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **NISAR** | NASA / ISRO | L-band (and S-band) | 1.26 GHz ($\sim 23.8\text{ cm}$) / 3.2 GHz ($\sim 9.3\text{ cm}$) | **GCOV** (Geocoded Covariance), **GUNW** (Geocoded Unwrapped Phase), GSLC | Dual-pol (HH/HV, VV/VH), Quad-pol | $6 \text{ m} - 10 \text{ m}$ (GCOV), $30 \text{ m}$ (GUNW) | Level-2 / Level-3 (ARD) | High coherence over vegetation (Cauvery), L-band deep penetration, large deformation gradients |
| **Sentinel-1** | ESA / Copernicus | C-band | 5.405 GHz ($\sim 5.55\text{ cm}$) | **GRD** (Ground Range Detected), **SLC** (IW TOPSAR), **GUNW** (ASF HyP3 ARD) | Dual-pol (VV+VH, HH+HV) | $10 \text{ m}$ (GRD), $2.3\times 14 \text{ m}$ (SLC burst) | Level-1 (GRD/SLC) & Level-3 (GUNW) | Dense temporal baseline (6–12 days), urban PS-InSAR infrastructure monitoring (Chennai) |
| **SAOCOM-1A / 1B** | CONAE (Argentina) | L-band | 1.275 GHz ($\sim 23.5\text{ cm}$) | Level-1 **GEC** (Geocoded Ellipsoid Corrected), **GTC** (Terrain Corrected), SLC | Full Quad-pol (HH, HV, VH, VV), Dual-pol | $10 \text{ m} - 30 \text{ m}$ (Stripmap / TOPSAR) | Level-1 / Level-2 | L-band validation partner for NISAR; agricultural biomass and soil moisture consistency |
| **RADARSAT-2 / RCM** | CSA (Canada) | C-band | 5.405 GHz ($\sim 5.55\text{ cm}$) | **GRD**, **SLC**, Compact Polarimetry (CP) | Quad-pol, Dual-pol, Hybrid/Compact Polarimetry (RH, RV) | $3 \text{ m} - 50 \text{ m}$ | Level-1 / Level-2 | High-revisit C-band verification; Compact Polarimetry decomposition benchmarks |
| **NASA UAVSAR** | NASA JPL | L-band (Airborne) | 1.26 GHz ($\sim 23.8\text{ cm}$) | **RPI** (Repeat-Pass Interferometry), **POLSAR** (Stokes/Covariance) | Full Quad-pol (HH, HV, VH, VV) | $1.67 \text{ m} \text{ (slant)} \times 0.6 \text{ m}$ | Level-3 / Level-4 (Gridded) | High-resolution airborne ground truth; sub-centimeter validation for satellite footprints |
| **ALOS-1/2 PALSAR** | JAXA (Japan) | L-band | 1.27 GHz ($\sim 23.6\text{ cm}$) | Level-1.5 / Level-2.1 CEOS & GeoTIFF | Single/Dual/Quad | $6 \text{ m} - 25 \text{ m}$ | Level-1.5 / Level-2.1 | Multi-decadal historical baseline for Chennai subsidence and Cauvery dynamics |

---

## 2. Ingestion Rules & Physical Separations

To ensure scientific integrity, the ingestion engine enforces the following constraints:

```
                               RAW DATA INGESTION
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   v                                       v
         AMPLITUDE OBSERVABLE                     PHASE OBSERVABLE
     (Intensity / Cross-Section)              (Interferometric Cycle)
                   |                                       |
         +---------+---------+                             v
         |                   |                   [SLC / GUNW / RUNW]
         v                   v                             |
    Level-1 GRD         Level-2 GCOV                       v
 (Beta/Sigma Naught) (Covariance Matrix)       INTERFEROMETRIC DISPLACEMENT
         |                   |                             |
         v                   v                             |
  Radiometric Terrain Flattening                           v
   (Gamma Naught: $\gamma^0_{RTC}$)               Look-Vector Decomposition
         |                   |                  (Ascending + Descending LOS)
         +---------+---------+                             |
                   |                                       v
                   v                               2D Vector Field
      Surface Roughness, Biomass,                [$d_{east}, d_{up}$]
       Soil Moisture, Water Extent                         |
                   |                                       |
                   +-------------------+-------------------+
                                       |
                                       v
                         VALIDATION & CONSISTENCY QA
```

### 2.1 Critical Scientific Invariants
1. **Never conflate amplitude and phase**:
   - Products such as Sentinel-1 GRD and NISAR GCOV contain radar backscatter intensity ($|S|^2$ or covariance elements $\langle S_{pq} S_{rs}^* \rangle$). They lack phase information and **must never be queried or routed into interferometric displacement pipelines**.
   - Interferometric displacement requires Single Look Complex (SLC) pairs, unwrapped interferogram rasters (GUNW), or pre-computed repeat-pass vector products.
2. **Never combine line-of-sight (LOS) measurements without geometry projection**:
   - Radar displacement is a 1D scalar projection of true 3D surface motion onto the satellite-to-target LOS vector $\hat{u}_{LOS} = [-\sin\theta\cos\alpha, \sin\theta\sin\alpha, \cos\theta]^T$ (where $\theta$ is the local incidence angle and $\alpha$ is the satellite flight azimuth heading).
   - Direct arithmetic difference ($\Delta d = d_{LOS, S1} - d_{LOS, NISAR}$) between different tracks or missions without projecting into a common reference frame (e.g., Vertical $d_{up}$ and East-West $d_{east}$) is mathematically invalid and physically meaningless.
3. **Radiometric Reference Harmonization**:
   - Ingested radar cross-section must be explicitly tagged as $\beta^0$ (radar brightness), $\sigma^0$ (sigma naught relative to ellipsoid or flat terrain), or $\gamma^0_{RTC}$ (terrain-flattened gamma naught).
   - Cross-mission backscatter comparison requires all inputs to be converted to $\gamma^0$ using an identical digital elevation model (Copernicus GLO-30 or local high-resolution DEM).

---

## 3. Data File Formats & Hierarchical Schemas

### 3.1 NASA-ISRO NISAR Native HDF5 Specification
NISAR products follow the HDF5 hierarchical data format. GROUNDSHIFT accesses science datasets using lazy slice-readers (`h5py`) to avoid loading entire multi-gigabyte files into RAM:

- **GCOV (Geocoded Covariance - Backscatter)**:
  - Root: `//science/LSAR/GCOV/grids/frequencyA/`
  - Layers:
    - `covariance/HHHH` (Real Float32): $\sigma^0_{HH}$ or $\gamma^0_{HH}$
    - `covariance/HVHV` (Real Float32): $\sigma^0_{HV}$ or $\gamma^0_{HV}$
    - `covariance/VVVV` (Real Float32): $\sigma^0_{VV}$ or $\gamma^0_{VV}$
    - `covariance/HHHV` (Complex Float32): Off-diagonal cross-correlation
    - `xCoordinates`, `yCoordinates`: 1D coordinate vectors (EPSG projected)
    - `listOfPolarizations`: Metadata string array
- **GUNW (Geocoded Unwrapped Phase - InSAR)**:
  - Root: `//science/LSAR/GUNW/grids/frequencyA/`
  - Layers:
    - `interferogram/unwrappedPhase/unwrappedPhase` (Float32, radians)
    - `interferogram/coherence/coherence` (Float32, range $[0.0, 1.0]$)
    - `interferogram/connectedComponents/connectedComponents` (Int16)
    - `geometry/incidenceAngle` (Float32, degrees)
    - `geometry/losAzimuthAngle` (Float32, degrees)
    - `geometry/alongTrackPosition`, `geometry/slantRangeDistance`

### 3.2 ESA Sentinel-1 Formats
- **Level-1 GRD (Ground Range Detected)**:
  - Format: SAFE package containing measurement GeoTIFFs (`measurement/s1a-iw-grd-vv-*.tiff`) and calibration metadata XML (`annotation/calibration/calibration-*.xml`).
  - Radiometric LUT: Ingests digital numbers ($DN$) and applies pixel-wise calibration:
    $$\sigma^0 = \frac{DN^2}{A_\sigma^2}, \quad \gamma^0 = \frac{DN^2}{A_\gamma^2}$$
- **ASF HyP3 GUNW (Analysis-Ready Geocoded InSAR)**:
  - Format: NetCDF4 / Cloud-Optimized GeoTIFF.
  - Layers: Unwrapped phase, spatial coherence, perpendicular baseline ($B_\perp$), temporal baseline ($B_t$), look vector components ($e, n, u$).

### 3.3 Argentina SAOCOM-1A / 1B Formats
- Format: Multi-file directory containing binary or raster GeoTIFF files accompanied by structural XML files (`xar_saocom.xml`).
- Calibration: Applies radiometric calibration factors (G0 gain, polynomial incidence angle correction) stored in calibration annotations.

### 3.4 NASA UAVSAR Formats
- Format: HDF5 / PolSAR compressed Stokes matrices / Flat binary rasters with accompanying `.ann` (annotation) text files.
- Grid: High-resolution ground-projected grid (`.grd`) or radar slant-range coordinates (`.slc`).

---

## 4. Study Areas: Geographic & Scientific Profile

### 4.1 Study Area 1: Chennai Metropolitan Area, Tamil Nadu, India
- **Geographic Bounding Box (WGS 84 / EPSG:4326)**:
  - Min Longitude: `80.05° E`, Max Longitude: `80.35° E`
  - Min Latitude: `12.85° N`, Max Latitude: `13.30° N`
  - Projected Coordinate System: `UTM Zone 44N (EPSG:32644)`
- **Key Terrain & Physical Features**:
  - Dense urban fabric, port infrastructure (Chennai Port, Ennore Port), wetlands (Pallikaranai Marsh), river basins (Adyar, Cooum).
  - High density of permanent artificial structures providing excellent Persistent Scatterers (PS).
- **Core Research Objectives**:
  - Detection of urban land subsidence caused by excessive groundwater pumping along the Old Mahabalipuram Road (OMR) IT corridor and industrial zones (Ambattur, Sriperumbudur).
  - Infrastructure deformation monitoring (Chennai Metro Rail Phase 2 underground tunneling corridor).
  - Post-cyclone inundation mapping and coastal erosion analysis (Cyclone Michaung baseline comparison).

### 4.2 Study Area 2: Cauvery Delta, Tamil Nadu, India
- **Geographic Bounding Box (WGS 84 / EPSG:4326)**:
  - Min Longitude: `78.90° E`, Max Longitude: `79.95° E`
  - Min Latitude: `10.25° N`, Max Latitude: `11.45° N`
  - Projected Coordinate System: `UTM Zone 44N (EPSG:32644)`
- **Key Terrain & Physical Features**:
  - Alluvial agricultural floodplains encompassing Thanjavur, Tiruvarur, Nagapattinam, and Mayiladuthurai districts.
  - Intensive paddy rice cultivation with distinct cropping seasons: *Kuruvai* (short-duration, June–Sept), *Samba* (medium-duration, Aug–Jan), *Thaladi* (late season).
  - Complex network of irrigation canals, river distributaries, and low-lying coastal estuaries vulnerable to saltwater intrusion.
- **Core Research Objectives**:
  - Cross-frequency temporal coherence analysis: Quantifying C-band (Sentinel-1) decorrelation over rapidly growing paddy canopies versus L-band (NISAR, SAOCOM) signal penetration and coherence retention.
  - Multi-temporal soil moisture and inundation dynamics during monsoon transitions.
  - Deltaic ground stability and consolidation assessment in sensitive coastal agrarian ecosystems.

### 4.3 Expansion Framework for International Locations
GROUNDSHIFT defines an open geographic extent schema:
```json
{
  "site_id": "STRING_IDENTIFIER",
  "name": "HUMAN_READABLE_NAME",
  "bbox": [min_lon, min_lat, max_lon, max_lat],
  "epsg": 32600,
  "surface_characteristics": "URBAN | AGRICULTURAL | PERMAFROST | VOLCANIC",
  "target_phenomena": ["SUBSIDENCE", "SOIL_MOISTURE", "FLOODING", "INFRASTRUCTURE"],
  "validation_anchors": [
    {
      "source": "GNSS_NETWORK",
      "station_ids": ["STN1", "STN2"],
      "data_url": "HTTPS_OR_LOCAL_PATH"
    }
  ]
}
```

---

## 5. Ground Truth & Validation Datasets

To validate satellite radar observations against independent physical measurements, GROUNDSHIFT integrates the following external reference datasets:

### 5.1 Continuous GNSS Geodetic Stations
- **Sources**: IGS (International GNSS Service), UNAVCO / EarthScope, and published regional geodetic networks.
- **Observables**: 3D daily position time-series ($X_t, Y_t, Z_t$ or $E_t, N_t, U_t$) in ITRF2014/ITRF2020 reference frames, with formal positioning uncertainties ($\sigma_E, \sigma_N, \sigma_U$).
- **Function**: Projecting GNSS 3D displacement vectors into the respective satellite Line-of-Sight ($d_{LOS, gnss} = \mathbf{d}_{gnss} \cdot \hat{u}_{LOS}$) to serve as the ground truth benchmark for InSAR time-series.

### 5.2 Hydrological & Meteorological Records
- **Sources**: Central Water Commission (CWC) river gauge stations, India Meteorological Department (IMD) gridded precipitation data, and ISMN (International Soil Moisture Network) in-situ probes.
- **Function**: Cross-correlating seasonal radar backscatter fluctuations ($\Delta \gamma^0$) and soil moisture variations against measured rainfall events and canal discharge rates in the Cauvery Delta.

---

## 6. Storage Tiering & Analysis-Ready Data (ARD) Strategy

Because SAR datasets are voluminous (a single dual-pol SLC frame is $4 - 8\text{ GB}$), GROUNDSHIFT implements a strict storage tiering hierarchy:

```
[Local / Cloud Object Store]
   |
   +-- Tier 0: Raw Ingestion Cache (Ephemeral / Read-Only)
   |     - SAFE packages, native NISAR .h5, SAOCOM archives.
   |     - Stored on secondary cold storage or queried via virtual file systems (`/vsicurl/`).
   |
   +-- Tier 1: Analysis-Ready Data (ARD) Store (Local NVMe / SSD)
   |     - Standardized Cloud-Optimized GeoTIFFs (COGs).
   |     - Tiled at $256 \times 256$ pixels with DEFLATE / ZSTD predictor-2 compression.
   |     - Pre-computed internal overviews (2x, 4x, 8x, 16x decimation levels).
   |     - Re-projected to local UTM grid (e.g., EPSG:32644) with shared pixel alignment.
   |
   +-- Tier 2: Multidimensional Time-Series Store (Zarr)
   |     - Multi-temporal coherence, backscatter, and displacement cubes.
   |     - Chunked along spatial dimensions: `chunks=(1, 512, 512)` (Time, Y, X).
   |     - Enables sub-second 1D time-series extraction at any arbitrary point.
   |
   +-- Tier 3: Metadata & Provenance Catalog (SQLite / SpatiaLite)
         - Spatial footprints, bounding geometry, sensor parameters, processing histories.
         - File pointers to Tier 1 and Tier 2 assets.
```

---

## 7. Quality Assurance & Rejection Criteria

Every candidate product must pass automated validation checks before being committed to Tier 1 ARD:

1. **Spatial Footprint Verification**: Scene geometry must intersect the designated study area bounding box by at least $10\%$.
2. **Missing Band / Polarization Check**: Multi-mission polarimetric routines require all required channels (e.g., both VV and VH for dual-pol; full quad-pol for polarimetric decomposition).
3. **Data Completeness & Zero-Value Threshold**: Scenes with $> 35\%$ missing data / corrupted swaths across the target AOI are flagged and rejected from automated processing pipelines.
4. **Coherence Sanity Gate**: Unwrapped InSAR products with average spatial coherence $\bar{\gamma} < 0.25$ over the target AOI are flagged as decorrelated and restricted from automatic displacement inversion.
5. **Cryptographic Integrity**: SHA-256 checksum calculated upon initial ingestion must match across all subsequent processing stages.

