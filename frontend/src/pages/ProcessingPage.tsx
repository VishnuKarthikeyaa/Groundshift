import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Layers, 
  Activity, 
  GitCompare, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  TrendingDown, 
  Crosshair, 
  Search, 
  ArrowRight,
  Database,
  BarChart2,
  FileCheck
} from 'lucide-react';
import { MapContainer, Polygon, CircleMarker, Popup } from 'react-leaflet';
import { DarkBasemap } from '../components/DarkBasemap';
import { api } from '../services/api';
import { PlotlyChart } from '../components/PlotlyChart';
import { 
  ClassificationCheck, 
  TimeSeriesRateResult, 
  DBSCANResult, 
  MissionComparisonResult,
  BenchmarkDisplacementData 
} from '../types';

export const ProcessingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'classification' | 'displacement' | 'dbscan' | 'comparison'>('displacement');

  // Benchmark data state
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkDisplacementData | null>(null);
  const [selectedSiteIndex, setSelectedSiteIndex] = useState<number>(0);

  // Module 1: Classification state
  const [testProductInput, setTestProductInput] = useState<string>('NISAR_L_PR_GUNW_001_005_A_089_20240915T004210.h5');
  const [classificationResult, setClassificationResult] = useState<ClassificationCheck | null>(null);
  const [isClassifying, setIsClassifying] = useState<boolean>(false);

  // Module 3: Time Series Displacement state
  const [timeSeriesResult, setTimeSeriesResult] = useState<TimeSeriesRateResult | null>(null);
  const [isEstimatingRate, setIsEstimatingRate] = useState<boolean>(false);

  // Module 4: DBSCAN state
  const [dbscanThreshold, setDbscanThreshold] = useState<number>(5.0);
  const [dbscanEpsKm, setDbscanEpsKm] = useState<number>(1.8);
  const [dbscanMinSamples, setDbscanMinSamples] = useState<number>(4);
  const [dbscanResult, setDbscanResult] = useState<DBSCANResult | null>(null);
  const [isClustering, setIsClustering] = useState<boolean>(false);

  // Module 5: Comparison state
  const [comparisonResult, setComparisonResult] = useState<MissionComparisonResult | null>(null);
  const [compOrbit1, setCompOrbit1] = useState<string>('ASCENDING');
  const [compOrbit2, setCompOrbit2] = useState<string>('ASCENDING');
  const [compInc1, setCompInc1] = useState<number>(39.2);
  const [compInc2, setCompInc2] = useState<number>(38.5);
  const [compHead1, setCompHead1] = useState<number>(348.5);
  const [compHead2, setCompHead2] = useState<number>(350.0);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Load benchmark dataset on mount
  useEffect(() => {
    loadBenchmarks();
    handleClassify();
  }, []);

  const loadBenchmarks = async () => {
    try {
      const data = await api.getDisplacementBenchmarks();
      setBenchmarkData(data);
      if (data.time_series_sites.length > 0) {
        computeRateForSite(data, 0);
      }
      runClusteringWithData(data, dbscanThreshold, dbscanEpsKm, dbscanMinSamples);
      runComparisonDemo(data);
    } catch (err: any) {
      console.error('Failed to load benchmarks', err);
    }
  };

  const handleClassify = async (overrideFilename?: string) => {
    const fn = overrideFilename || testProductInput;
    setIsClassifying(true);
    try {
      const res = await api.classifyProduct(fn);
      setClassificationResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsClassifying(false);
    }
  };

  const computeRateForSite = async (data: BenchmarkDisplacementData, siteIdx: number) => {
    const site = data.time_series_sites[siteIdx];
    if (!site) return;
    setIsEstimatingRate(true);
    try {
      const res = await api.calculateTimeSeriesRate({
        epochs: data.epochs,
        displacement_series_mm: site.displacement_mm,
        uncertainties_mm: site.uncertainties_mm,
      });
      setTimeSeriesResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsEstimatingRate(false);
    }
  };

  const runClusteringWithData = async (
    data: BenchmarkDisplacementData,
    thresh: number,
    eps: number,
    minPts: number
  ) => {
    setIsClustering(true);
    try {
      const grid = data.spatial_grid_sample;
      const res = await api.runDBSCANClustering({
        lons: grid.lons,
        lats: grid.lats,
        velocities_mm_year: grid.velocities_mm_year,
        velocity_threshold_mm_year: thresh,
        eps_km: eps,
        min_samples: minPts
      });
      setDbscanResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsClustering(false);
    }
  };

  const runComparisonDemo = async (data: BenchmarkDisplacementData) => {
    setIsComparing(true);
    try {
      // Create co-located observations with realistic cross-sensor noise
      const baseVels = data.spatial_grid_sample.velocities_mm_year;
      const s1_vels = baseVels;
      const nisar_vels = baseVels.map(v => v + (Math.random() * 1.8 - 0.9) - 1.2); // slight datum offset + noise

      const res = await api.compareMissions({
        mission_1_name: 'Sentinel-1 (C-band)',
        mission_2_name: 'NISAR (L-band)',
        sensor_band_1: 'C',
        sensor_band_2: 'L',
        orbit_1: compOrbit1,
        orbit_2: compOrbit2,
        incidence_1_deg: compInc1,
        incidence_2_deg: compInc2,
        heading_1_deg: compHead1,
        heading_2_deg: compHead2,
        observations_1_mm_year: s1_vels,
        observations_2_mm_year: nisar_vels,
        align_reference_frames: true
      });
      setComparisonResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsComparing(false);
    }
  };

  // Plotly data for time series
  const activeSite = benchmarkData?.time_series_sites[selectedSiteIndex];
  const timeSeriesPlotData = (benchmarkData && activeSite && timeSeriesResult) ? [
    {
      x: benchmarkData.epochs,
      y: activeSite.displacement_mm,
      error_y: {
        type: 'data',
        array: activeSite.uncertainties_mm,
        visible: true,
        color: 'rgba(56, 189, 248, 0.4)'
      },
      mode: 'markers',
      type: 'scatter',
      name: 'Measured LOS Displacement (mm)',
      marker: { color: '#38bdf8', size: 8 }
    },
    {
      x: benchmarkData.epochs,
      y: timeSeriesResult.fitted_values_mm,
      mode: 'lines',
      type: 'scatter',
      name: `WLS Linear Trend (${timeSeriesResult.velocity_mm_year} ± ${timeSeriesResult.velocity_std_err_mm_year} mm/yr)`,
      line: { color: '#f97316', width: 3, dash: 'solid' }
    }
  ] : [];

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Scientific SAR Processing Engine</h1>
          <span style={{ 
            fontSize: '0.75rem', 
            fontFamily: 'var(--font-mono)', 
            background: 'rgba(56, 189, 248, 0.15)', 
            color: 'var(--accent-cyan)', 
            padding: '0.2rem 0.5rem', 
            borderRadius: '4px',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            Physical Geodesy Core
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '850px' }}>
          Rigorously processes compatible SAR observables into surface-change measurements. 
          Enforces product segregation (GRD vs SLC vs GUNW), weighted least-squares temporal trends, 
          DBSCAN spatial clustering of subsidence bowls, and geometric multi-mission intercomparisons.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('displacement')}
          className={`nav-btn ${activeTab === 'displacement' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', padding: '0.55rem 1rem' }}
        >
          <TrendingDown size={15} /> 1. Displacement Trend Analysis
        </button>

        <button
          onClick={() => setActiveTab('dbscan')}
          className={`nav-btn ${activeTab === 'dbscan' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', padding: '0.55rem 1rem' }}
        >
          <Crosshair size={15} /> 2. DBSCAN Deformation Clustering
        </button>

        <button
          onClick={() => setActiveTab('comparison')}
          className={`nav-btn ${activeTab === 'comparison' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', padding: '0.55rem 1rem' }}
        >
          <GitCompare size={15} /> 3. Multi-Mission Intercomparison
        </button>

        <button
          onClick={() => setActiveTab('classification')}
          className={`nav-btn ${activeTab === 'classification' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', padding: '0.55rem 1rem' }}
        >
          <FileCheck size={15} /> 4. Product Classifier & Workflow QA
        </button>
      </div>

      {/* TAB 1: DISPLACEMENT TIME SERIES & TREND */}
      {activeTab === 'displacement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Scientific Caution Banner */}
          <div style={{ 
            background: 'rgba(234, 179, 8, 0.08)', 
            border: '1px solid rgba(234, 179, 8, 0.3)', 
            borderRadius: '8px', 
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem'
          }}>
            <AlertTriangle size={20} color="#eab308" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: '#fef08a', lineHeight: 1.5 }}>
              <strong>Mathematical Viewing Geometry Rule:</strong> Line-of-Sight (LOS) displacement is a 1D scalar vector projection:
              <br />
              <code>d_los = -d_east * sin(&theta;) * cos(&alpha;) + d_north * sin(&theta;) * sin(&alpha;) + d_up * cos(&theta;)</code>.
              <br />
              Do NOT interpret LOS displacement as pure vertical subsidence without opposing Ascending/Descending tracks or independent in-situ GNSS constraints.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2fr', gap: '1.25rem' }}>
            
            {/* Site Picker & Metrics Card */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} color="var(--accent-cyan)" /> Observational Study Sites (Chennai)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {benchmarkData?.time_series_sites.map((s, idx) => (
                  <button
                    key={s.site_name}
                    onClick={() => {
                      setSelectedSiteIndex(idx);
                      computeRateForSite(benchmarkData, idx);
                    }}
                    style={{
                      background: selectedSiteIndex === idx ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${selectedSiteIndex === idx ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: '6px',
                      padding: '0.75rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.site_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Coord: [{s.coordinates[0].toFixed(3)}&deg;E, {s.coordinates[1].toFixed(3)}&deg;N] &bull; Expected: {s.expected_rate_mm_year} mm/yr
                    </div>
                  </button>
                ))}
              </div>

              {/* Inversion Results Panel */}
              {timeSeriesResult && (
                <div style={{ marginTop: '0.5rem', background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                    Weighted Least Squares Result
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Linear Rate (v):</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: timeSeriesResult.velocity_mm_year < -5 ? 'var(--accent-rose)' : 'var(--accent-cyan)' }}>
                      {timeSeriesResult.velocity_mm_year} mm/yr
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>1-&sigma; Uncertainty:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>&plusmn; {timeSeriesResult.velocity_std_err_mm_year} mm/yr</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Residual RMSE:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{timeSeriesResult.rmse_mm} mm</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Goodness of Fit (R&sup2;):</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)' }}>{timeSeriesResult.r_squared}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Statistical Significance:</span>
                    <span style={{ 
                      color: timeSeriesResult.is_statistically_significant ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                      fontWeight: 700
                    }}>
                      {timeSeriesResult.is_statistically_significant ? 'Significant (>2&sigma;)' : 'Within Noise'}
                    </span>
                  </div>
                </div>
              )}

            </div>

            {/* Plotly Chart Card */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                Multi-Epoch Displacement Time-Series & WLS Trend
              </div>

              <div style={{ flex: 1, minHeight: '380px' }}>
                <PlotlyChart
                  data={timeSeriesPlotData}
                  layout={{
                    title: activeSite ? `${activeSite.site_name} (LOS Trend)` : 'InSAR Time-Series',
                    xaxis: { title: 'Acquisition Date', color: '#94a3b8', showgrid: true, gridcolor: 'rgba(255,255,255,0.06)' },
                    yaxis: { title: 'Displacement (mm)', color: '#94a3b8', showgrid: true, gridcolor: 'rgba(255,255,255,0.06)' },
                    legend: { orientation: 'h', y: -0.25 }
                  }}
                  style={{ height: '380px' }}
                />
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: DBSCAN DEFORMATION CLUSTERING */}
      {activeTab === 'dbscan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Controls Bar */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>DBSCAN Spatial Subsidence Cluster Delineation</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Groups spatially contiguous, high-rate deformation pixels into delineated subsidence bowls using Haversine spherical metrics.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Velocity Cutoff (|v| &ge; mm/yr):</label>
                <input 
                  type="number" 
                  step="0.5" 
                  value={dbscanThreshold} 
                  onChange={(e) => setDbscanThreshold(parseFloat(e.target.value) || 0)}
                  className="input-field" 
                  style={{ width: '85px', padding: '0.35rem 0.5rem', display: 'block' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Neighborhood &epsilon; (km):</label>
                <input 
                  type="number" 
                  step="0.2" 
                  value={dbscanEpsKm} 
                  onChange={(e) => setDbscanEpsKm(parseFloat(e.target.value) || 1)}
                  className="input-field" 
                  style={{ width: '85px', padding: '0.35rem 0.5rem', display: 'block' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Min Points (MinPts):</label>
                <input 
                  type="number" 
                  value={dbscanMinSamples} 
                  onChange={(e) => setDbscanMinSamples(parseInt(e.target.value) || 3)}
                  className="input-field" 
                  style={{ width: '75px', padding: '0.35rem 0.5rem', display: 'block' }}
                />
              </div>

              <button 
                onClick={() => benchmarkData && runClusteringWithData(benchmarkData, dbscanThreshold, dbscanEpsKm, dbscanMinSamples)}
                disabled={isClustering}
                className="btn btn-primary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', marginTop: '1rem' }}
              >
                {isClustering ? 'Clustering...' : 'Execute DBSCAN'}
              </button>
            </div>
          </div>

          {/* Map & Cluster Table Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.25rem' }}>
            
            {/* Map */}
            <div className="glass-panel" style={{ padding: '1rem', height: '420px', overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Spatial Distribution & Cluster Convex Hulls ({dbscanResult?.n_clusters ?? 0} Clusters Found)
              </div>

              <div style={{ height: '360px', borderRadius: '6px', overflow: 'hidden' }}>
                <MapContainer center={[12.98, 80.22]} zoom={11} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                  <DarkBasemap />

                  {/* Render Cluster Hulls */}
                  {dbscanResult?.clusters.map((c) => {
                    const poly = c.boundary_polygon.map(pt => [pt[1], pt[0]] as [number, number]);
                    return (
                      <Polygon
                        key={`hull-${c.cluster_id}`}
                        positions={poly}
                        pathOptions={{
                          color: c.severity === 'CRITICAL' ? '#f43f5e' : '#f97316',
                          fillOpacity: 0.25,
                          weight: 2
                        }}
                      >
                        <Popup>
                          <div style={{ fontSize: '0.8rem', color: '#0f172a' }}>
                            <strong>Cluster #{c.cluster_id} ({c.severity})</strong><br />
                            Peak Rate: {c.peak_rate_mm_year} mm/yr<br />
                            Area: ~{c.estimated_area_km2} km&sup2;<br />
                            Points: {c.point_count}
                          </div>
                        </Popup>
                      </Polygon>
                    );
                  })}

                  {/* Render Points */}
                  {dbscanResult?.clustered_points.map((pt, idx) => (
                    <CircleMarker
                      key={`pt-${idx}`}
                      center={[pt.lat, pt.lon]}
                      radius={pt.cluster_id >= 0 ? 5 : 3}
                      pathOptions={{
                        color: pt.cluster_id >= 0 ? (pt.velocity < -15 ? '#f43f5e' : '#f97316') : '#64748b',
                        fillColor: pt.cluster_id >= 0 ? (pt.velocity < -15 ? '#f43f5e' : '#f97316') : '#64748b',
                        fillOpacity: 0.8
                      }}
                    >
                      <Popup>
                        <div style={{ fontSize: '0.78rem', color: '#0f172a' }}>
                          Rate: {pt.velocity} mm/yr<br />
                          Cluster: {pt.cluster_id >= 0 ? `#${pt.cluster_id}` : 'Noise'}
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            </div>

            {/* Clusters Table */}
            <div className="glass-panel" style={{ padding: '1rem', overflowY: 'auto', maxHeight: '420px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                Delineated Subsidence Zones
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {dbscanResult?.clusters.map((c) => (
                  <div 
                    key={c.cluster_id} 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.03)', 
                      borderLeft: `4px solid ${c.severity === 'CRITICAL' ? 'var(--accent-rose)' : 'var(--accent-amber)'}`,
                      padding: '0.75rem',
                      borderRadius: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Deformation Zone #{c.cluster_id}</span>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '0.15rem 0.45rem', 
                        borderRadius: '3px',
                        background: c.severity === 'CRITICAL' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                        color: c.severity === 'CRITICAL' ? 'var(--accent-rose)' : 'var(--accent-amber)',
                        fontWeight: 700
                      }}>
                        {c.severity}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div>Peak Velocity: <strong style={{ color: 'var(--text-primary)' }}>{c.peak_rate_mm_year} mm/yr</strong></div>
                      <div>Mean Velocity: <strong style={{ color: 'var(--text-primary)' }}>{c.mean_rate_mm_year} mm/yr</strong></div>
                      <div>Area: <strong style={{ color: 'var(--text-primary)' }}>{c.estimated_area_km2} km&sup2;</strong></div>
                      <div>Valid Pixels: <strong style={{ color: 'var(--text-primary)' }}>{c.point_count}</strong></div>
                    </div>
                  </div>
                ))}

                {(!dbscanResult || dbscanResult.clusters.length === 0) && (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No contiguous deformation clusters detected with current threshold parameters.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 3: MULTI-MISSION COMPARISON */}
      {activeTab === 'comparison' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Geometry Verification Controls */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>
              Multi-Mission Geometric Compatibility & Agreement Evaluator
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.82rem' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>Mission 1: Sentinel-1 (C-band)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Orbit Direction:</label>
                    <select value={compOrbit1} onChange={(e) => setCompOrbit1(e.target.value)} className="input-field" style={{ width: '100%', padding: '0.35rem' }}>
                      <option value="ASCENDING">ASCENDING</option>
                      <option value="DESCENDING">DESCENDING</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Incidence Angle (&deg;):</label>
                    <input type="number" step="0.5" value={compInc1} onChange={(e) => setCompInc1(parseFloat(e.target.value))} className="input-field" style={{ width: '100%', padding: '0.35rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Heading Angle (&deg;):</label>
                    <input type="number" step="1.0" value={compHead1} onChange={(e) => setCompHead1(parseFloat(e.target.value))} className="input-field" style={{ width: '100%', padding: '0.35rem' }} />
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(249, 115, 22, 0.05)', padding: '0.85rem', borderRadius: '6px', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
                <div style={{ fontWeight: 700, color: 'var(--accent-orange)', marginBottom: '0.5rem' }}>Mission 2: NISAR L-band</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Orbit Direction:</label>
                    <select value={compOrbit2} onChange={(e) => setCompOrbit2(e.target.value)} className="input-field" style={{ width: '100%', padding: '0.35rem' }}>
                      <option value="ASCENDING">ASCENDING</option>
                      <option value="DESCENDING">DESCENDING</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Incidence Angle (&deg;):</label>
                    <input type="number" step="0.5" value={compInc2} onChange={(e) => setCompInc2(parseFloat(e.target.value))} className="input-field" style={{ width: '100%', padding: '0.35rem' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Heading Angle (&deg;):</label>
                    <input type="number" step="1.0" value={compHead2} onChange={(e) => setCompHead2(parseFloat(e.target.value))} className="input-field" style={{ width: '100%', padding: '0.35rem' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <button 
                  onClick={() => benchmarkData && runComparisonDemo(benchmarkData)}
                  disabled={isComparing}
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.25rem', width: '100%' }}
                >
                  {isComparing ? 'Evaluating...' : 'Re-Evaluate Compatibility'}
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary & Error Warning */}
          {comparisonResult && (
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                  Cross-Mission Scientific Verdict
                </div>
                <span style={{ 
                  padding: '0.25rem 0.65rem', 
                  borderRadius: '4px', 
                  fontSize: '0.75rem', 
                  fontWeight: 800,
                  background: comparisonResult.is_statistically_consistent && comparisonResult.is_geometrically_compatible ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                  color: comparisonResult.is_statistically_consistent && comparisonResult.is_geometrically_compatible ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                }}>
                  {comparisonResult.scientific_verdict}
                </span>
              </div>

              {comparisonResult.geometry_warning && (
                <div style={{ padding: '0.85rem', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', borderRadius: '6px', border: '1px solid rgba(244, 63, 94, 0.3)', fontSize: '0.82rem' }}>
                  <strong>Geometric Incompatibility Warning:</strong> {comparisonResult.geometry_warning}
                </div>
              )}

              {/* Statistics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Look Vector Divergence</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.15rem' }}>
                    {comparisonResult.los_angular_difference_deg}&deg;
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Mean Bias (Diff)</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.15rem' }}>
                    {comparisonResult.mean_bias_mm} mm/yr
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Cross-Sensor RMSE</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.15rem', color: comparisonResult.rmse_mm < 3.0 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                    {comparisonResult.rmse_mm} mm/yr
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Pearson Correlation (r)</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.15rem', color: 'var(--accent-cyan)' }}>
                    {comparisonResult.pearson_r}
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Datum Offset Removed</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.15rem' }}>
                    {comparisonResult.datum_offset_removed_mm} mm/yr
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '0.75rem' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Propagated Error (&sigma;&Delta;)</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.15rem' }}>
                    &plusmn; {comparisonResult.propagated_uncertainty_mm} mm/yr
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 4: PRODUCT CLASSIFICATION & WORKFLOW QA */}
      {activeTab === 'classification' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.3rem' }}>
                SAR Product Classification & Permitted Workflows
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Test product headers against GROUNDSHIFT's strict scientific rules to verify allowed pipelines.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                value={testProductInput}
                onChange={(e) => setTestProductInput(e.target.value)}
                className="input-field"
                style={{ flex: 1, minWidth: '300px', padding: '0.65rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
              />
              <button onClick={() => handleClassify()} disabled={isClassifying} className="btn btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
                {isClassifying ? 'Classifying...' : 'Classify Product'}
              </button>
            </div>

            {/* Quick Test Chips */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Test Presets:</span>
              <button 
                onClick={() => { setTestProductInput('NISAR_L_PR_GUNW_001_005_A_089_20240915T004210.h5'); handleClassify('NISAR_L_PR_GUNW_001_005_A_089_20240915T004210.h5'); }}
                className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
              >
                NISAR GUNW (InSAR)
              </button>
              <button 
                onClick={() => { setTestProductInput('NISAR_L_PR_GCOV_001_005_A_089_20240915T004210.h5'); handleClassify('NISAR_L_PR_GCOV_001_005_A_089_20240915T004210.h5'); }}
                className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
              >
                NISAR GCOV (Covariance)
              </button>
              <button 
                onClick={() => { setTestProductInput('S1A_IW_GRDH_1SDV_20240112T124530.SAFE'); handleClassify('S1A_IW_GRDH_1SDV_20240112T124530.SAFE'); }}
                className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
              >
                Sentinel-1 GRD (Intensity)
              </button>
              <button 
                onClick={() => { setTestProductInput('OPERA_L3_DISP-S1_20230101_20230113.nc'); handleClassify('OPERA_L3_DISP-S1_20230101_20230113.nc'); }}
                className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
              >
                OPERA L3 DISP
              </button>
            </div>

            {/* Classification Output Details */}
            {classificationResult && (
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Classified Category:</span>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>{classificationResult.category}</h4>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Displacement Pipeline Ready:</div>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 800,
                      color: classificationResult.is_displacement_ready ? 'var(--accent-emerald)' : 'var(--accent-rose)'
                    }}>
                      {classificationResult.is_displacement_ready ? 'YES (Valid)' : 'NO (Rejected)'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', fontSize: '0.82rem' }}>
                  <div><strong>Satellite Mission:</strong> {classificationResult.mission}</div>
                  <div><strong>Sensor Band:</strong> {classificationResult.sensor_band}-band ({classificationResult.frequency_ghz} GHz)</div>
                  <div><strong>Wavelength (&lambda;):</strong> {classificationResult.wavelength_m} m</div>
                  <div><strong>Complex Phase Preserved:</strong> {classificationResult.is_phase_preserved ? 'Yes' : 'No'}</div>
                </div>

                <div>
                  <strong style={{ fontSize: '0.82rem' }}>Permitted Scientific Workflows:</strong>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    {classificationResult.supported_workflows.map((w) => (
                      <span key={w} style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-cyan)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        {w}
                      </span>
                    ))}
                  </div>
                </div>

                {classificationResult.rejection_reasons.length > 0 && (
                  <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', padding: '0.75rem', fontSize: '0.8rem', color: 'var(--accent-rose)' }}>
                    <strong>Scientific Pipeline Restrictions:</strong>
                    <ul style={{ margin: '0.3rem 0 0 1.25rem', padding: 0 }}>
                      {classificationResult.rejection_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};

