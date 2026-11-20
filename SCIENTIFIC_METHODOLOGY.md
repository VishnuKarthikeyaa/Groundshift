# GROUNDSHIFT: Scientific Methodology & Mathematical Foundation

**Document Version**: 1.0.0-PROPOSAL  
**Discipline**: SAR Remote Sensing, Radar Polarimetry, Multi-Temporal InSAR, Geodesy  
**Status**: Pending Architecture Review  

---

## 1. SAR Physics & Measurement Principles

Synthetic Aperture Radar (SAR) is an active coherent microwave imaging system. By exploiting the Doppler shift induced by platform motion, SAR synthesizes an antenna aperture orders of magnitude larger than its physical antenna length, achieving fine along-track (azimuth) spatial resolution independent of platform altitude.

### 1.1 Radar Backscatter Mechanics

The complex radar return recorded for each resolution cell is represented by the complex scattering matrix $[S]$:

$$[S] = \begin{bmatrix} S_{hh} & S_{hv} \\ S_{vh} & S_{vv} \end{bmatrix}$$

where $S_{pq}$ represents the complex scattering amplitude for receive polarization $p$ and transmit polarization $q$ ($p, q \in \{h, v\}$).

#### Radiometric Conventions:
1. **Radar Brightness ($\beta^0$)**: Pure radar cross-section (RCS) per unit area in slant range coordinates ($m^2/m^2$, dimensionless).
2. **Sigma-Naught ($\sigma^0$)**: Radar cross-section projected onto the local ground surface relative to the WGS-84 reference ellipsoid or a flat earth model:
   $$\sigma^0 = \beta^0 \sin\theta_{inc}$$
   where $\theta_{inc}$ is the local incidence angle.
3. **Terrain-Flattened Gamma-Naught ($\gamma^0_{RTC}$)**: The true physical backscattering coefficient normalized by the true illuminated illuminated terrain surface area $\beta^0 \frac{A_\beta}{A_\gamma}$ calculated by integrating a high-resolution Digital Elevation Model (DEM) (Small, 2011):
   $$\gamma^0 = \frac{\sigma^0}{\cos\theta_{inc}}$$
   *GROUNDSHIFT mandates $\gamma^0_{RTC}$ as the canonical metric for multi-mission cross-comparison.*

#### Multi-Look Speckle Statistics:
Single-look intensity images exhibit fully developed speckle noise characterized by a multiplicative Rayleigh (amplitude) or exponential (intensity) distribution. GROUNDSHIFT models $L$-look intensity $I$ using the Gamma distribution:

$$P(I) = \frac{L^L I^{L-1}}{\Gamma(L) \langle I \rangle^L} \exp\left(-\frac{L I}{\langle I \rangle}\right)$$

where $L$ is the Equivalent Number of Looks (ENL). When cross-comparing multi-mission products, all backscatter metrics report both mean $\langle I \rangle$ and estimated ENL:
$$\text{ENL} = \frac{\langle I \rangle^2}{\text{Var}(I)}$$

---

## 2. InSAR Principles & Wavelength Dynamics

Interferometric SAR (InSAR) calculates the phase difference between two co-registered complex SAR acquisitions ($S_1, S_2$) captured from slightly separated orbital positions at times $t_1$ and $t_2$:

$$I = S_1 S_2^* = |S_1||S_2| e^{j \Delta\phi}$$

The measured interferometric phase $\Delta\phi$ decomposes into deterministic and stochastic physical components:

$$\Delta\phi = \phi_{flat} + \phi_{topo} + \phi_{def} + \phi_{atm} + \phi_{orb} + \phi_{noise}$$

Where:
- $\phi_{flat}$: Flat-earth phase resulting from the Earth's curvature.
- $\phi_{topo}$: Topographic phase proportional to the perpendicular baseline $B_\perp$ and target elevation $z$:
  $$\phi_{topo} = -\frac{4\pi}{\lambda} \frac{B_\perp}{R \sin\theta} z$$
- $\phi_{def}$: Surface displacement along the Line-of-Sight (LOS) occurring between $t_1$ and $t_2$:
  $$\phi_{def} = -\frac{4\pi}{\lambda} \Delta d_{LOS}$$
- $\phi_{atm}$: Atmospheric phase delay due to spatio-temporal variations in tropospheric water vapor, hydrostatic pressure, and ionospheric Total Electron Content (TEC).
- $\phi_{orb}$: Residual orbital phase errors caused by imprecise satellite ephemerides.
- $\phi_{noise}$: Decorrelation noise (thermal, spatial baseline, temporal, Doppler centroid mismatch).

### 2.2 Wavelength Comparison: L-Band vs C-Band

GROUNDSHIFT targets L-band (NISAR, SAOCOM, ALOS) and C-band (Sentinel-1, RADARSAT/RCM). Their differing physical behaviors dictate their scientific utility:

| Physical Parameter | L-Band ($\lambda \approx 23.5 - 24.0\text{ cm}$) | C-Band ($\lambda \approx 5.55\text{ cm}$) | Scientific Implication in GROUNDSHIFT |
| :--- | :--- | :--- | :--- |
| **Displacement Sensitivity** | $1 \text{ fringe } (2\pi) = 11.9\text{ cm} \text{ LOS}$ | $1 \text{ fringe } (2\pi) = 2.8\text{ cm} \text{ LOS}$ | C-band has higher sensitivity to sub-centimeter deformation; L-band is resistant to phase unwrapping saturation in high-strain gradients. |
| **Vegetation Penetration** | Canopy penetration to primary branches, trunks, and underlying soil. | Scatters primarily from upper leaves, twigs, and crop canopy. | L-band maintains coherence over agricultural fields (Cauvery Delta); C-band decorrelates rapidly over dense vegetation. |
| **Atmospheric Sensitivity** | Low tropospheric sensitivity; **High ionospheric sensitivity** (dispersive delay $\propto \frac{1}{f^2}$, TEC banding). | **High tropospheric water vapor delay**; Low ionospheric sensitivity. | L-band requires split-spectrum ionospheric phase correction; C-band requires GACOS / ERA5 tropospheric modeling. |
| **Critical Baseline** | Very large critical baseline ($B_{\perp, crit} \approx 2 - 5\text{ km}$). | Moderate critical baseline ($B_{\perp, crit} \approx 500\text{ m} - 1\text{ km}$). | L-band tolerates larger orbital separation before spatial decorrelation occurs. |

---

## 3. 3D Line-of-Sight (LOS) Geometry & Vector Decomposition

A scalar InSAR measurement represents the projection of the 3D surface displacement vector $\mathbf{d} = [d_{east}, d_{north}, d_{up}]^T$ onto the satellite-to-ground unit Line-of-Sight vector $\hat{u}_{LOS}$:

$$d_{LOS} = \mathbf{d} \cdot \hat{u}_{LOS} = e \cdot d_{east} + n \cdot d_{north} + u \cdot d_{up}$$

The directional unit vector components $[e, n, u]$ are parameterized by the local incidence angle $\theta$ and the radar flight azimuth heading angle $\alpha_h$ (measured clockwise from North):

$$\begin{aligned}
e &= -\sin\theta \cos\alpha_h \\
n &= \sin\theta \sin\alpha_h \\
u &= \cos\theta
\end{aligned}$$

```
                Zenith (Up)
                   ^
                   |         * Satellite Antenna
                   |        /
                   |       /
                   |      /
                   |     /  LOS Vector
                   |    /   (Incidence Angle \theta)
                   |   /
                   |  v
Ground Target (x,y,z) -----------------> East / North
```

### 3.1 Resolving Vertical and East-West Displacement (2D Inversion)

Because near-polar orbit satellites travel approximately North-South ($\alpha_{h, asc} \approx 348^\circ - 352^\circ$, $\alpha_{h, desc} \approx 188^\circ - 192^\circ$), the North-South coefficient $n$ is very small ($|n| \approx 0.08 - 0.12$). Near-polar InSAR has minimal sensitivity to North-South motion without Multiple Aperture Interferometry (MAI) or pixel offset tracking.

Therefore, for study areas without large along-track strike-slip faults, the displacement is inverted into Vertical ($d_{up}$) and East-West ($d_{east}$) components by combining ascending and descending geometry acquisitions:

$$\begin{bmatrix} d_{LOS, asc} \\ d_{LOS, desc} \end{bmatrix} = \begin{bmatrix} e_{asc} & u_{asc} \\ e_{desc} & u_{desc} \end{bmatrix} \begin{bmatrix} d_{east} \\ d_{up} \end{bmatrix}$$

Denoting the geometry matrix as $\mathbf{G}$:

$$\mathbf{G} = \begin{bmatrix} e_{asc} & u_{asc} \\ e_{desc} & u_{desc} \end{bmatrix}$$

The displacement vector $\mathbf{\hat{d}} = [d_{east}, d_{up}]^T$ is estimated via least squares inversion:

$$\mathbf{\hat{d}} = (\mathbf{G}^T \mathbf{W} \mathbf{G})^{-1} \mathbf{G}^T \mathbf{W} \mathbf{d}_{LOS}$$

where $\mathbf{W}$ is the diagonal weight matrix containing the inverse variance of the respective interferograms derived from their spatial coherence $\gamma$:

$$\mathbf{W} = \begin{bmatrix} 1/\sigma_{asc}^2 & 0 \\ 0 & 1/\sigma_{desc}^2 \end{bmatrix}$$

### 3.2 Inversion Condition Number & GDOP

To prevent unstable inversions, GROUNDSHIFT calculates the Geometric Dilution of Precision (GDOP) and matrix condition number $\kappa(\mathbf{G}) = \|\mathbf{G}\| \|\mathbf{G}^{-1}\|$. If the difference between ascending and descending incidence angles is insufficient ($|\theta_{asc} - \theta_{desc}| < 3^\circ$), inversion uncertainty flags are raised.

---

## 4. InSAR Coherence, Triplet Closures & Phase Unwrapping QA

### 4.1 Coherence Formulation
Complex interferometric coherence $\gamma$ measures the cross-correlation between two coregistered SAR images:

$$\gamma = \frac{|\langle S_1 S_2^* \rangle|}{\sqrt{\langle |S_1|^2 \rangle \langle |S_2|^2 \rangle}}, \quad 0 \le \gamma \le 1$$

Coherence factors into four primary physical mechanisms:

$$\gamma = \gamma_{thermal} \cdot \gamma_{spatial} \cdot \gamma_{temporal} \cdot \gamma_{volumetric}$$

- $\gamma_{thermal} = \frac{1}{1 + \text{SNR}^{-1}}$
- $\gamma_{spatial} = 1 - \frac{2 B_\perp R_y \cos^2\theta}{\lambda R}$ (geometric decorrelation)
- $\gamma_{temporal} = \exp\left(-\frac{1}{2}\left(\frac{4\pi}{\lambda}\right)^2 \sigma_r^2(\Delta t)\right)$ (random motion of scatterers over time interval $\Delta t$)
- $\gamma_{volumetric}$: penetration into vegetation or snowpack.

The standard deviation of the interferometric phase $\sigma_\phi$ is a direct function of coherence $\gamma$ and the number of looks $L$:

$$\sigma_\phi = \frac{1}{\sqrt{2L}} \frac{\sqrt{1 - \gamma^2}}{\gamma}$$

### 4.2 Phase Triplet Closure Residuals (Cycle Slip Auditing)

Phase unwrapping algorithms (SNAPHU, Minimum Cost Flow) are prone to integer $2\pi$ ambiguities (cycle slips), especially across low-coherence vegetated regions like the Cauvery Delta.

GROUNDSHIFT detects unwrapping errors by auditing closed interferometric triplets. For three acquisitions at times $t_1, t_2, t_3$, the triangular phase closure residual $C_{123}$ is calculated:

$$C_{123} = \mathcal{W}\left\{ \Delta\phi_{12} + \Delta\phi_{23} - \Delta\phi_{13} \right\}$$

where $\mathcal{W}\{\cdot\}$ is the phase wrapping operator mapping values to $[-\pi, \pi)$.

- In the absence of phase unwrapping errors and severe non-linear moisture-induced phase bias, $C_{123} \equiv 0$.
- If $C_{123} \approx \pm 2k\pi$ ($k \in \{1, 2, \dots\}$), a phase unwrapping cycle slip has occurred.
- Unwrapping error masks are dynamically generated and used to mask unreliable pixels from displacement time-series.

---

## 5. Multi-Mission Cross-Sensor Backscatter Calibration

Comparing radar backscatter between different sensors (e.g., NISAR L-band vs SAOCOM L-band, or Sentinel-1 C-band vs RCM C-band) requires rigorous normalization:

### 5.1 Same-Frequency Cross-Validation (NISAR vs SAOCOM)
When both sensors operate at L-band ($\sim 1.26 - 1.275\text{ GHz}$):
1. Both products are terrain-flattened to $\gamma^0_{RTC}$ using identical digital elevation models (Copernicus 30m).
2. Radiometric cross-calibration is assessed over stable pseudo-invariant calibration sites (PICS):
   - Dense tropical forest or mature mangroves (azimuthally isotropic volume scatterers).
   - Calm, wind-sheltered inland water bodies (specular reflection / system noise floor verification).
   - Homogeneous bare soil / desert flats.
3. Linear regression across paired pixels evaluates relative radiometric calibration bias:
   $$\gamma^0_{NISAR} = \alpha \cdot \gamma^0_{SAOCOM} + \beta$$
   where ideal calibration satisfies $\alpha = 1.0, \beta = 0.0\text{ dB}$.

### 5.2 Cross-Frequency Inter-Comparison (L-Band vs C-Band)
L-band and C-band interact with different canopy and surface structures:
- In agricultural regions (Cauvery Delta), C-band backscatter saturates early in the crop cycle (leaf/stem scattering), whereas L-band backscatter continues to increase proportionally with total wet biomass up to higher vegetation water content (stem/ground double-bounce).
- GROUNDSHIFT quantifies the **Dual-Frequency Biomass & Moisture Index (DF-BMI)**:
  $$\text{DF-BMI} = \frac{\gamma^0_{L, cross} - \gamma^0_{C, cross}}{\gamma^0_{L, cross} + \gamma^0_{C, cross}}$$
  where cross represents cross-polarization (HV or VH), highlighting soil moisture variations beneath vegetation cover.

---

## 6. In-Situ Geodetic Validation Framework

To anchor satellite InSAR measurements in absolute real-world coordinates and evaluate measurement accuracy, InSAR time-series are validated against continuous GNSS geodetic stations.

```
       GNSS 3D Displacement (ITRF)               Satellite Acquisition Geometry
         [d_east, d_north, d_up]                    Look Vector [e, n, u]
                    |                                         |
                    +--------------------+--------------------+
                                         |
                                         v
                         Projected GNSS LOS Displacement:
                         d_{LOS, gnss} = e*d_E + n*d_N + u*d_U
                                         |
                                         v
                      SAR InSAR Extracted LOS Time Series:
                       (Spatial Windowed Mean / Median)
                                         |
                                         v
                         STATISTICAL VALIDATION ENGINE
                        - Pearson Correlation (r)
                        - Root Mean Square Error (RMSE)
                        - Mean Bias Error (MBE)
                        - Chi-Squared Consistency Ratio (\chi^2)
```

### 6.1 Spatial Co-Location & Extraction
Because a GNSS receiver represents an exact pinpoint location while SAR pixels represent areal averages ($10\text{ m} - 30\text{ m}$), spatial co-location uses coherence-weighted spatial averaging:

$$d_{SAR}(x_{gnss}, y_{gnss}) = \frac{\sum_{p \in \mathcal{N}} \gamma_p \cdot d_{LOS, p}}{\sum_{p \in \mathcal{N}} \gamma_p}$$

where $\mathcal{N}$ represents a spatial window ($3 \times 3$ or $5 \times 5$ pixels) centered on the GNSS coordinates, and pixels with coherence $\gamma_p < \gamma_{min}$ (e.g., $0.4$) are excluded.

### 6.2 Statistical Consistency Metrics
The agreement between InSAR displacement series $d_{SAR}(t)$ and projected GNSS series $d_{GNSS}(t)$ across $N$ observation epochs is evaluated via:

1. **Root Mean Square Error (RMSE)**:
   $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N \left(d_{SAR}(t_i) - d_{GNSS}(t_i)\right)^2}$$
2. **Mean Bias Error (MBE)**:
   $$\text{MBE} = \frac{1}{N} \sum_{i=1}^N \left(d_{SAR}(t_i) - d_{GNSS}(t_i)\right)$$
3. **Pearson Correlation Coefficient ($r$)**:
   $$r = \frac{\sum_{i=1}^N (d_{SAR, i} - \bar{d}_{SAR})(d_{GNSS, i} - \bar{d}_{GNSS})}{\sqrt{\sum_{i=1}^N (d_{SAR, i} - \bar{d}_{SAR})^2 \sum_{i=1}^N (d_{GNSS, i} - \bar{d}_{GNSS})^2}}$$
4. **Normalized Chi-Squared Uncertainty Test**:
   $$\chi^2_{red} = \frac{1}{N} \sum_{i=1}^N \frac{(d_{SAR, i} - d_{GNSS, i})^2}{\sigma_{SAR, i}^2 + \sigma_{GNSS, i}^2}$$
   where $\chi^2_{red} \approx 1$ confirms that observed differences are fully explained by the formal measurement uncertainties of both systems.

---

## 7. Strict Provenance & Uncertainty Propagation

Every derived scientific result generated by GROUNDSHIFT is accompanied by an uncertainty raster ($\sigma$) and an immutable JSON-LD provenance graph:

1. **Uncertainty Propagation**:
   For 2D vector decomposition $\mathbf{\hat{d}} = \mathbf{G}^{-1} \mathbf{d}_{LOS}$, the posterior covariance matrix $\mathbf{\Sigma}_d$ is calculated:
   $$\mathbf{\Sigma}_d = \begin{bmatrix} \sigma_{east}^2 & \sigma_{east, up} \\ \sigma_{east, up} & \sigma_{up}^2 \end{bmatrix} = (\mathbf{G}^T \mathbf{W} \mathbf{G})^{-1}$$
   The resulting standard error maps $\sigma_{east}(x, y)$ and $\sigma_{up}(x, y)$ are generated alongside $d_{east}$ and $d_{up}$.

2. **Categorical Lineage Guarantee**:
   All outputs carry explicit classification labels:
   - `OBSERVABLE_MEASURED`: Raw radar measurement.
   - `ESTIMATE_DERIVED`: Processed geophysical inversion with attached uncertainty.
   - `BENCHMARK_SYNTHETIC`: Forward-modeled synthetic validation test ramp.

