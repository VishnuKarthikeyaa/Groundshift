import React, { useState } from 'react';
import { Compass, Play, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { DecompositionResult } from '../types';
import { ClassificationBadge } from '../components/ClassificationBadge';
import { PlotlyChart } from '../components/PlotlyChart';

export const DecompositionPage: React.FC = () => {
  // Input parameters (Default realistic values for Chennai descending/ascending tracks)
  const [dAsc, setDAsc] = useState<number>(-12.4);
  const [dDesc, setDDesc] = useState<number>(-14.2);
  const [incAsc, setIncAsc] = useState<number>(39.2);
  const [headAsc, setHeadAsc] = useState<number>(348.5);
  const [incDesc, setIncDesc] = useState<number>(41.5);
  const [headDesc, setHeadDesc] = useState<number>(192.1);
  const [sigmaAsc, setSigmaAsc] = useState<number>(1.5);
  const [sigmaDesc, setSigmaDesc] = useState<number>(1.5);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<DecompositionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDecompose = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.decomposeLos({
        d_asc_mm: dAsc,
        d_desc_mm: dDesc,
        inc_asc_deg: incAsc,
        head_asc_deg: headAsc,
        inc_desc_deg: incDesc,
        head_desc_deg: headDesc,
        sigma_asc: sigmaAsc,
        sigma_desc: sigmaDesc,
      });
      setResult(res.results);
    } catch (err: any) {
      setError(err.message || 'Decomposition calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Build Plotly 2D vector plot data
  const plotData = result ? [
    // Origin marker
    {
      x: [0],
      y: [0],
      mode: 'markers',
      type: 'scatter',
      name: 'Origin (0,0)',
      marker: { size: 10, color: '#94a3b8' },
    },
    // Decomposed Vector Arrow
    {
      x: [0, result.d_east],
      y: [0, result.d_up],
      mode: 'lines+markers',
      type: 'scatter',
      name: `Displacement Vector (E: ${result.d_east.toFixed(1)}, Up: ${result.d_up.toFixed(1)} mm)`,
      line: { color: '#38bdf8', width: 4 },
      marker: { size: 8, color: '#38bdf8' },
    },
  ] : [];

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Compass size={24} color="var(--accent-cyan)" />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            InSAR Line-of-Sight (LOS) 2D Vector Decomposition
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '900px' }}>
          InSAR measures 1D scalar displacement projected onto the satellite Line-of-Sight. 
          To combine multi-track observations scientifically, GROUNDSHIFT inverts paired ascending and descending 
          observations into horizontal East-West (d_east) and vertical (d_up) displacement vectors via weighted least squares.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) 1.5fr', gap: '1.5rem' }}>
        
        {/* Controls Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
            Observation Geometry & LOS Inputs
          </h3>

          {/* Ascending Track */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
              ASCENDING TRACK (e.g. Sentinel-1 Path 12)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LOS Displacement (mm)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={dAsc} 
                  onChange={(e) => setDAsc(parseFloat(e.target.value) || 0)}
                  className="input-field" 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uncertainty &sigma; (mm)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={sigmaAsc} 
                  onChange={(e) => setSigmaAsc(parseFloat(e.target.value) || 1)}
                  className="input-field" 
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Incidence Angle &theta; (&deg;)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={incAsc} 
                  onChange={(e) => setIncAsc(parseFloat(e.target.value) || 0)}
                  className="input-field" 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Heading &alpha; (&deg; CW from N)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={headAsc} 
                  onChange={(e) => setHeadAsc(parseFloat(e.target.value) || 0)}
                  className="input-field" 
                />
              </div>
            </div>
          </div>

          {/* Descending Track */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
              DESCENDING TRACK (e.g. Sentinel-1 Path 85)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LOS Displacement (mm)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={dDesc} 
                  onChange={(e) => setDDesc(parseFloat(e.target.value) || 0)}
                  className="input-field" 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uncertainty &sigma; (mm)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={sigmaDesc} 
                  onChange={(e) => setSigmaDesc(parseFloat(e.target.value) || 1)}
                  className="input-field" 
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Incidence Angle &theta; (&deg;)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={incDesc} 
                  onChange={(e) => setIncDesc(parseFloat(e.target.value) || 0)}
                  className="input-field" 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Heading &alpha; (&deg; CW from N)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  value={headDesc} 
                  onChange={(e) => setHeadDesc(parseFloat(e.target.value) || 0)}
                  className="input-field" 
                />
              </div>
            </div>
          </div>

          <button 
            onClick={handleDecompose} 
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            <Play size={16} />
            {loading ? 'Inverting Normal Equations...' : 'Execute 2D Vector Inversion'}
          </button>

          {error && (
            <div style={{ padding: '0.65rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', color: '#fda4af', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Results & Visualizer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {result ? (
            <>
              {/* Numerical Metrics Card */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Inversion Solution</h3>
                  <ClassificationBadge classification={result.classification} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  
                  {/* Vertical Up */}
                  <div style={{ padding: '0.85rem', background: 'rgba(7, 13, 23, 0.6)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vertical Displacement (d_up)</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: result.d_up < 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                      {result.d_up.toFixed(2)} mm
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      &plusmn; {result.sigma_up.toFixed(2)} mm (1&sigma;)
                    </div>
                  </div>

                  {/* Horizontal East */}
                  <div style={{ padding: '0.85rem', background: 'rgba(7, 13, 23, 0.6)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Horizontal East (d_east)</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {result.d_east.toFixed(2)} mm
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      &plusmn; {result.sigma_east.toFixed(2)} mm (1&sigma;)
                    </div>
                  </div>

                  {/* Condition Number */}
                  <div style={{ padding: '0.85rem', background: 'rgba(7, 13, 23, 0.6)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Matrix Condition &kappa;(G)</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: result.is_well_conditioned ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                      {result.condition_number.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {result.is_well_conditioned ? 'Well Conditioned' : 'Ill-Conditioned GDOP'}
                    </div>
                  </div>

                </div>
              </div>

              {/* Vector Chart */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  2D Displacement Vector Trajectory (East vs Up)
                </h3>
                <PlotlyChart
                  data={plotData}
                  layout={{
                    title: 'Displacement Plane (Millimeters)',
                    xaxis: { title: 'East Displacement (mm)', zeroline: true },
                    yaxis: { title: 'Vertical Displacement (mm)', zeroline: true },
                  }}
                />
              </div>
            </>
          ) : (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Compass size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>Configure Line-of-Sight parameters on the left and click <strong>Execute 2D Vector Inversion</strong> to solve normal equations.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

