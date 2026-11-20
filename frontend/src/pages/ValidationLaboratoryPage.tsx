import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  BarChart3, 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  Crosshair 
} from 'lucide-react';
import { api } from '../services/api';
import { ValidationStatsInfo, GNSSStationInfo, GNSSValidationInfo } from '../types';
import { PlotlyChart } from '../components/PlotlyChart';
import { MetricValue } from '../components/MetricValue';
import { EmptyState } from '../components/EmptyState';

export const ValidationLaboratoryPage: React.FC = () => {
  const [stats, setStats] = useState<ValidationStatsInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [residualVariable, setResidualVariable] = useState<'distance' | 'time' | 'incidence'>('distance');

  // Observations arrays for 1:1 scatter
  const [obs1, setObs1] = useState<number[]>([-15.2, -22.4, -18.9, -28.1, -12.4, -31.2, -9.5, -4.2, -19.8, -25.0]);
  const [obs2, setObs2] = useState<number[]>([-14.6, -21.8, -19.4, -27.3, -13.0, -30.5, -9.8, -4.5, -20.2, -24.4]);

  // GNSS stations
  const [gnssStations, setGnssStations] = useState<GNSSStationInfo[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('OMR_VAL');
  const [gnssVal, setGnssVal] = useState<GNSSValidationInfo | null>(null);

  // Load baseline validation stats on mount
  useEffect(() => {
    loadValidationStats();
    loadGNSS();
  }, []);

  const loadValidationStats = async () => {
    try {
      setLoading(true);
      const res = await api.evaluateValidationStatistics({
        observations_1: obs1,
        observations_2: obs2,
        uncertainties_1: [1.2, 1.4, 1.1, 1.5, 1.2, 1.6, 1.1, 0.9, 1.3, 1.4],
        uncertainties_2: [1.8, 1.9, 1.6, 2.0, 1.7, 2.1, 1.5, 1.2, 1.8, 1.9],
        temporal_separation_days: 3.5,
        look_vector_divergence_deg: 2.1,
        spatial_overlap_pct: 94.2,
        has_independent_ground_truth: true,
      });
      setStats(res);
    } catch (err) {
      console.error('Failed to evaluate validation statistics', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGNSS = async () => {
    try {
      const res = await api.getGNSSStations();
      setGnssStations(res.stations || []);
      if (res.stations && res.stations.length > 0) {
        runGNSSValidation(res.stations[0].station_id);
      }
    } catch (err) {
      console.error('Failed to load GNSS stations', err);
    }
  };

  const runGNSSValidation = async (stationId: string) => {
    try {
      const val = await api.validateAgainstGNSS({
        station_id: stationId,
        sar_velocity_los_mm_year: -18.2,
        sar_uncertainty_mm_year: 1.4,
        incidence_angle_deg: 38.4,
        heading_angle_deg: -12.4,
      });
      setGnssVal(val);
    } catch (err) {
      console.error('Failed to validate against GNSS', err);
    }
  };

  // Export exact CSV matching screen figures
  const handleExportCSV = () => {
    if (!stats) return;
    const rows = [
      ['Metric', 'Value', 'Units', 'Sample Size (N)', 'Method'],
      ['Mean Bias', stats.mean_difference_bias, 'mm/yr', stats.valid_count, 'Mean paired residual'],
      ['RMSE', stats.rmse, 'mm/yr', stats.valid_count, 'Root mean square error'],
      ['MAE', stats.mae, 'mm/yr', stats.valid_count, 'Mean absolute error'],
      ['Pearson Correlation (r)', stats.pearson_r, 'dimensionless', stats.valid_count, 'Parametric linear correlation'],
      ['Spearman Rho', stats.spearman_rho, 'dimensionless', stats.valid_count, 'Non-parametric rank correlation'],
      ['R-Squared', stats.r_squared, 'dimensionless', stats.valid_count, 'Coefficient of determination'],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `groundshift_validation_metrics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1:1 Scatter Plot Data
  const scatterData: any = [
    {
      x: obs1,
      y: obs2,
      mode: 'markers',
      type: 'scatter',
      name: 'Paired InSAR Observations',
      marker: {
        color: '#38C8E0',
        size: 7,
        line: { color: '#0D1014', width: 1 },
      },
    },
    {
      x: [-35, 0],
      y: [-35, 0],
      mode: 'lines',
      type: 'scatter',
      name: '1:1 Reference Line',
      line: {
        color: '#E0A23A',
        dash: 'dash',
        width: 1.5,
      },
    },
  ];

  // Residual Analysis Data
  const residuals = obs1.map((v, i) => v - obs2[i]);
  const residualX = 
    residualVariable === 'distance'
      ? [2.1, 4.5, 7.2, 9.8, 12.4, 15.1, 18.2, 21.0, 24.5, 27.8] // km
      : residualVariable === 'time'
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] // months
      : [32.1, 33.4, 34.8, 36.2, 37.5, 38.9, 40.2, 41.5, 42.8, 44.1]; // incidence deg

  const residualPlotData: any = [
    {
      x: residualX,
      y: residuals,
      mode: 'markers',
      type: 'scatter',
      name: 'Residuals (Obs1 - Obs2)',
      marker: {
        color: '#2F6FDB',
        size: 7,
      },
    },
    {
      x: [Math.min(...residualX), Math.max(...residualX)],
      y: [0, 0],
      mode: 'lines',
      type: 'scatter',
      name: 'Zero Bias Line',
      line: { color: '#64748B', width: 1, dash: 'dot' },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '16px 20px', gap: '16px' }}>
      {/* Title & Export Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={17} color="var(--accent-cyan)" />
            VALIDATION LABORATORY & ACCURACY WORKBENCH
          </h1>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Strict ground truth anchoring, paired residuals, 1:1 dispersion, and export matching
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleExportCSV} disabled={!stats} className="btn-instrument">
            <Download size={13} /> Export Metrics CSV
          </button>
        </div>
      </div>

      {/* Statistical Summary Panel: Bias, RMSE, MAE, Correlation */}
      {stats ? (
        <div className="instrument-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)' }}>
              ACCURACY STATISTICAL SUMMARY (N={stats.valid_count} samples)
            </div>
            <span className="badge-mono" style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>
              Tier: {stats.confidence_tier}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>MEAN BIAS</div>
              <div style={{ fontSize: '17px' }}>
                <MetricValue value={stats.mean_difference_bias} unit="mm/yr" sampleCount={stats.valid_count} highlight />
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Method: Mean paired residual
              </div>
            </div>

            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>RMSE</div>
              <div style={{ fontSize: '17px' }}>
                <MetricValue value={stats.rmse} unit="mm/yr" sampleCount={stats.valid_count} />
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Method: Root mean square error
              </div>
            </div>

            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>MAE</div>
              <div style={{ fontSize: '17px' }}>
                <MetricValue value={stats.mae} unit="mm/yr" sampleCount={stats.valid_count} />
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Method: Mean absolute error
              </div>
            </div>

            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>PEARSON (r)</div>
              <div style={{ fontSize: '17px' }}>
                <MetricValue value={stats.pearson_r} precision={4} sampleCount={stats.valid_count} />
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                p-value: <span className="font-mono">{stats.pearson_p_value.toExponential(2)}</span>
              </div>
            </div>

            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>R-SQUARED (R²)</div>
              <div style={{ fontSize: '17px' }}>
                <MetricValue value={stats.r_squared} precision={4} sampleCount={stats.valid_count} />
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Method: Ordinary least squares
              </div>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No Validation Statistics Loaded"
          message="Run an in-situ or cross-mission validation evaluation to populate statistical metrics."
        />
      )}

      {/* Two Scientific Visualizations: 1:1 Scatter Plot & Residual Analysis */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Plot 1: 1:1 Scatter Plot */}
        <div className="instrument-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-bright)', marginBottom: '4px' }}>
            1:1 DISPERSION & REFERENCE CORRELATION
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Primary Sensor LOS (mm/yr) vs Secondary Sensor / Ground Truth LOS (mm/yr)
          </div>

          <div style={{ height: '260px' }}>
            <PlotlyChart
              data={scatterData}
              layout={{
                xaxis: { title: 'Primary Sensor Displacement (mm/yr)', zeroline: true },
                yaxis: { title: 'Secondary Sensor / GNSS (mm/yr)', zeroline: true },
                margin: { l: 45, r: 15, t: 15, b: 40 },
                showlegend: true,
                legend: { x: 0.05, y: 0.95 },
              }}
              ariaLabel="Scatter plot of primary sensor displacement against secondary sensor observations"
            />
          </div>
        </div>

        {/* Plot 2: Selectable Residual Analysis */}
        <div className="instrument-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-bright)' }}>
              RESIDUAL ANALYSIS AGAINST COVARIATES
            </div>

            {/* Variable selector */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['distance', 'time', 'incidence'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setResidualVariable(v)}
                  className={`btn-instrument ${residualVariable === v ? 'primary' : ''}`}
                  style={{ padding: '2px 6px', fontSize: '9.5px', textTransform: 'capitalize' }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Residual Discrepancy &Delta; (mm/yr) vs {residualVariable.toUpperCase()}
          </div>

          <div style={{ height: '260px' }}>
            <PlotlyChart
              data={residualPlotData}
              layout={{
                xaxis: { 
                  title: residualVariable === 'distance' ? 'Distance from Reference Origin (km)' : residualVariable === 'time' ? 'Elapsed Baseline (Months)' : 'Incidence Angle (°)' 
                },
                yaxis: { title: 'Residual Difference (mm/yr)', zeroline: true },
                margin: { l: 45, r: 15, t: 15, b: 40 },
                showlegend: false,
              }}
              ariaLabel={`Residual plot showing difference versus ${residualVariable}`}
            />
          </div>
        </div>
      </div>

      {/* GNSS In-Situ Ground Truth Anchor Validation Panel */}
      <div className="instrument-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} color="var(--accent-amber)" />
            IN-SITU CONTINUOUS GNSS GROUND TRUTH VALIDATION
          </div>

          <select
            value={selectedStation}
            onChange={(e) => {
              setSelectedStation(e.target.value);
              runGNSSValidation(e.target.value);
            }}
            className="btn-instrument"
            style={{ fontSize: '11px' }}
          >
            {gnssStations.map(st => (
              <option key={st.station_id} value={st.station_id}>
                {st.station_name} ({st.station_id}) &bull; {st.network}
              </option>
            ))}
          </select>
        </div>

        {gnssVal ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GNSS VERTICAL VELOCITY</div>
              <div style={{ fontSize: '16px' }}>
                <MetricValue value={gnssVal.gnss_vertical_rate_mm_year} unit="mm/yr" sourceId={gnssVal.station_id} sourceType="station" />
              </div>
            </div>

            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>GNSS PROJECTED LOS</div>
              <div style={{ fontSize: '16px' }}>
                <MetricValue value={gnssVal.gnss_projected_los_mm_year} unit="mm/yr" />
              </div>
            </div>

            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SAR OBSERVED LOS</div>
              <div style={{ fontSize: '16px' }}>
                <MetricValue value={gnssVal.sar_observed_los_mm_year} unit="mm/yr" highlight />
              </div>
            </div>

            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>RESIDUAL DISCREPANCY</div>
              <div style={{ fontSize: '16px' }}>
                <MetricValue value={gnssVal.residual_discrepancy_mm_year} unit="mm/yr" />
              </div>
            </div>

            <div className="instrument-panel-inner" style={{ padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NORMALIZED CHI (χ)</div>
              <div style={{ fontSize: '16px', color: gnssVal.normalized_chi < 1.0 ? 'var(--accent-cyan)' : 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {gnssVal.normalized_chi.toFixed(3)}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Status: {gnssVal.is_consistent_with_gnss ? 'Consistent (&chi; &le; 1.0)' : 'Borderline'}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            compact
            title="GNSS Benchmark Verification"
            message="Select an anchor GNSS station to validate InSAR displacement against peer-reviewed continuous GPS time-series."
          />
        )}
      </div>
    </div>
  );
};

