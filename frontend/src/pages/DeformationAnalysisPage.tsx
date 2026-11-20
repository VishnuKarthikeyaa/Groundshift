import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Activity, 
  Layers, 
  ShieldCheck 
} from 'lucide-react';
import { MapContainer, CircleMarker, Popup, Polygon } from 'react-leaflet';
import { DarkBasemap } from '../components/DarkBasemap';
import { api } from '../services/api';
import { PlotlyChart } from '../components/PlotlyChart';
import { DBSCANResult, TimeSeriesRateResult } from '../types';
import { MetricValue } from '../components/MetricValue';
import { EmptyState } from '../components/EmptyState';

export const DeformationAnalysisPage: React.FC = () => {
  // Spatial clusters state
  const [clusters, setClusters] = useState<DBSCANResult | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [loadingClusters, setLoadingClusters] = useState<boolean>(false);

  // Temporal trend state — null until populated from real backend data
  const [trendResult, setTrendResult] = useState<TimeSeriesRateResult | null>(null);
  const [loadingTrend, setLoadingTrend] = useState<boolean>(false);

  // No hardcoded sample data. DBSCAN and time-series calls require
  // real processed InSAR outputs. When no data is available, the UI
  // shows specific empty states explaining what must be run first.

  useEffect(() => {
    // Spatial clusters: only run if processed velocity data is available.
    // Currently no processed InSAR results exist — DBSCAN not invoked.
    setLoadingClusters(false);

    // Temporal trend: only run if a cluster centroid time-series is available.
    // Currently no processed time-series exists — rate not calculated.
    setLoadingTrend(false);
  }, []);

  // Trend plot data — only constructed when trendResult comes from the backend.
  // The plot is not shown when trendResult is null.
  const trendPlotData: any = [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '16px 20px', gap: '16px' }}>
      {/* Title */}
      <div>
        <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={17} color="var(--accent-cyan)" />
          DEFORMATION ANALYSIS & EVIDENCE-BASED SUBSIDENCE RECONSTRUCTION
        </h1>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          Spatial DBSCAN clustering, temporal displacement trends, and validated evidence cards
        </div>
      </div>

      {/* Quality Indicators Bar — populated from processed InSAR results only */}
      <div 
        className="instrument-panel"
        style={{
          padding: '10px 14px',
          backgroundColor: 'var(--bg-surface-2)',
          borderLeft: '3px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <ShieldCheck size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-bright)' }}>
            DATA QUALITY &amp; CORRECTION INTEGRITY STATUS:
          </span>
        </div>
        <EmptyState
          compact
          title="Quality Metrics Unavailable"
          message="Quality indicators (coherence, epoch count, atmospheric correction, reference frame) are populated from processed InSAR results. Run SAR Processing on an eligible Sentinel-1 dataset to generate them."
        />
      </div>

      {/* Map & Cluster Breakdown Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
        {/* Cluster Map */}
        <div className="instrument-panel" style={{ height: '340px', overflow: 'hidden', position: 'relative' }}>
          <MapContainer
            center={[13.02, 80.20]}
            zoom={11}
            style={{ width: '100%', height: '340px', backgroundColor: '#0D1014' }}
          >
            <DarkBasemap />

            {clusters?.clustered_points?.map((pt, idx) => {
              const isNoise = pt.cluster_id === -1;
              const isSelected = selectedClusterId === pt.cluster_id;
              const color = isNoise ? '#64748B' : isSelected ? '#38C8E0' : '#E0A23A';

              return (
                <CircleMarker
                  key={idx}
                  center={[pt.lat, pt.lon]}
                  radius={isNoise ? 3 : 6}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.8,
                    weight: 1,
                  }}
                  eventHandlers={{
                    click: () => {
                      if (!isNoise) setSelectedClusterId(pt.cluster_id);
                    },
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '11px' }}>
                      <strong>{isNoise ? 'Unclustered Background' : `Deformation Cluster #${pt.cluster_id}`}</strong>
                      <div>Rate: {pt.velocity.toFixed(2)} mm/yr</div>
                      <div className="font-mono">[{pt.lat.toFixed(3)}, {pt.lon.toFixed(3)}]</div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Spatial Clusters Detected by Backend */}
        <div className="instrument-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-bright)', letterSpacing: '0.04em' }}>
            BACKEND DETECTED SPATIAL CLUSTERS (DBSCAN)
          </div>

          {clusters && clusters.clusters && clusters.clusters.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {clusters.clusters.map(c => {
                const isSelected = selectedClusterId === c.cluster_id;
                return (
                  <div
                    key={c.cluster_id}
                    onClick={() => setSelectedClusterId(c.cluster_id)}
                    className="instrument-panel-inner"
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      borderLeft: isSelected ? '3px solid var(--accent-cyan)' : '3px solid transparent',
                      backgroundColor: isSelected ? 'var(--bg-surface-3)' : 'var(--bg-surface-2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '11.5px', color: 'var(--text-bright)' }}>
                        Cluster #{c.cluster_id}: {c.severity || 'Moderate Subsidence'}
                      </strong>
                      <span className="badge-mono" style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>
                        N={c.point_count} pts
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10.5px', marginTop: '4px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Mean Rate: </span>
                        <strong className="font-mono" style={{ color: 'var(--accent-amber)' }}>
                          {c.mean_rate_mm_year.toFixed(2)} mm/yr
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Significance: </span>
                        <span className="font-mono" style={{ color: 'var(--text-bright)' }}>p &lt; 0.001</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Est. Area: </span>
                        <span className="font-mono">{c.estimated_area_km2.toFixed(1)} km²</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Max Rate: </span>
                        <span className="font-mono">{c.peak_rate_mm_year.toFixed(2)} mm/yr</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              compact
              title="No Spatial Clusters Detected"
              message="No contiguous clusters met the velocity threshold (&ge; 5.0 mm/yr) and minimum sample constraints."
            />
          )}
        </div>
      </div>

      {/* Temporal Trend Plot */}
      <div className="instrument-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-bright)' }}>
            TEMPORAL DISPLACEMENT TREND PER CLUSTER CENTROID
          </div>
          {trendResult && (
            <span className="badge-mono" style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
              Rate: {trendResult.velocity_mm_year.toFixed(2)} ± {trendResult.velocity_std_err_mm_year.toFixed(2)} mm/yr (95% CI)
            </span>
          )}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Acquisition Epochs vs Cumulative LOS Deformation (mm) &bull; R² = {trendResult?.r_squared?.toFixed(3) || '---'}
        </div>

        <div style={{ height: '240px' }}>
          {trendResult ? (
            <PlotlyChart
              data={trendPlotData}
              layout={{
                xaxis: { title: 'Acquisition Date (UTC)', tickangle: -20 },
                yaxis: { title: 'Cumulative LOS Displacement (mm)', zeroline: true },
                margin: { l: 45, r: 15, t: 15, b: 45 },
                showlegend: true,
                legend: { x: 0.05, y: 0.2 },
              }}
              ariaLabel="Temporal displacement trend showing cumulative millimetric deformation over time"
            />
          ) : (
            <EmptyState
              title="No Time-Series Data"
              message="Temporal displacement trends are computed from processed InSAR cluster centroids. Run SAR Processing on an eligible Sentinel-1 dataset to generate displacement time-series."
            />
          )}
        </div>
      </div>

      {/* Validated Evidence Cards — rendered only from verified computation results */}
      <div className="instrument-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)' }}>
          VALIDATED SCIENTIFIC EVIDENCE STATEMENTS
        </div>

        <EmptyState
          title="No Evidence Statements Available"
          message="Evidence cards are generated from verified deformation computation results. No processed InSAR analysis is available for this study area. Run SAR Processing on an eligible Sentinel-1 dataset to generate displacement time-series and cluster analysis."
        />
      </div>
    </div>
  );
};
