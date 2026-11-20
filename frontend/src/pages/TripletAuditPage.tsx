import React, { useState } from 'react';
import { Layers, Play, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { TripletClosureResult } from '../types';
import { ClassificationBadge } from '../components/ClassificationBadge';
import { PlotlyChart } from '../components/PlotlyChart';

export const TripletAuditPage: React.FC = () => {
  const [phi12, setPhi12] = useState<number>(1.25);
  const [phi23, setPhi23] = useState<number>(-0.45);
  const [phi13, setPhi13] = useState<number>(0.80);
  const [coh12, setCoh12] = useState<number>(0.75);
  const [coh23, setCoh23] = useState<number>(0.70);
  const [coh13, setCoh13] = useState<number>(0.65);

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TripletClosureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAudit = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.auditTriplet({
        phi_12_rad: phi12,
        phi_23_rad: phi23,
        phi_13_rad: phi13,
        coherence_12: coh12,
        coherence_23: coh23,
        coherence_13: coh13,
      });
      setResult(res.results);
    } catch (err: any) {
      setError(err.message || 'Audit execution failed.');
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (type: 'ideal' | 'cycleslip') => {
    if (type === 'ideal') {
      setPhi12(1.25);
      setPhi23(-0.45);
      setPhi13(0.80); // exact sum
    } else {
      setPhi12(1.25);
      setPhi23(-0.45);
      setPhi13(0.80 + 2 * Math.PI); // Injected 2pi cycle slip
    }
    setResult(null);
  };

  // Plotly chart showing phase breakdown
  const plotData = [
    {
      x: ['Pair t1-t2', 'Pair t2-t3', 'Direct t1-t3', 'Closure Residual'],
      y: [phi12, phi23, phi13, result ? result.closure_residual_rad : 0],
      type: 'bar',
      marker: {
        color: ['#38bdf8', '#3b82f6', '#a855f7', result?.has_cycle_slip ? '#f43f5e' : '#10b981'],
      },
    },
  ];

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Layers size={24} color="var(--accent-emerald)" />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
            Interferometric Triplet Phase Closure & Cycle Slip QA
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '900px' }}>
          Auditing phase closure around closed interferometric triangles (C_123 = W&#123;&Delta;&phi;_12 + &Delta;&phi;_23 - &Delta;&phi;_13&#125;) 
          verifies phase unwrapping consistency. Non-zero multiples of 2&pi; expose unwrapping cycle slips, 
          crucial for preventing artificial deformation jumps in agricultural or wetlands InSAR time-series.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) 1.5fr', gap: '1.5rem' }}>
        
        {/* Controls Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Triplet Phase Observables</h3>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => loadPreset('ideal')} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                Ideal
              </button>
              <button onClick={() => loadPreset('cycleslip')} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--accent-rose)' }}>
                +2&pi; Slip
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phase &phi;_12 (rad) between t1 and t2</label>
              <input 
                type="number" 
                step="0.01" 
                value={phi12} 
                onChange={(e) => setPhi12(parseFloat(e.target.value) || 0)}
                className="input-field" 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phase &phi;_23 (rad) between t2 and t3</label>
              <input 
                type="number" 
                step="0.01" 
                value={phi23} 
                onChange={(e) => setPhi23(parseFloat(e.target.value) || 0)}
                className="input-field" 
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phase &phi;_13 (rad) between t1 and t3</label>
              <input 
                type="number" 
                step="0.01" 
                value={phi13} 
                onChange={(e) => setPhi13(parseFloat(e.target.value) || 0)}
                className="input-field" 
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>&gamma;_12</label>
              <input type="number" step="0.05" min="0" max="1" value={coh12} onChange={(e) => setCoh12(parseFloat(e.target.value) || 0)} className="input-field" />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>&gamma;_23</label>
              <input type="number" step="0.05" min="0" max="1" value={coh23} onChange={(e) => setCoh23(parseFloat(e.target.value) || 0)} className="input-field" />
            </div>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>&gamma;_13</label>
              <input type="number" step="0.05" min="0" max="1" value={coh13} onChange={(e) => setCoh13(parseFloat(e.target.value) || 0)} className="input-field" />
            </div>
          </div>

          <button 
            onClick={handleAudit} 
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            <Play size={16} />
            {loading ? 'Evaluating Phase Closure...' : 'Audit Triplet Closure'}
          </button>

          {error && (
            <div style={{ padding: '0.65rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '6px', color: '#fda4af', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

        </div>

        {/* Results Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {result ? (
            <>
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Loop Closure Audit Result</h3>
                  <ClassificationBadge classification={result.classification} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  
                  {/* Closure Residual */}
                  <div style={{ padding: '0.85rem', background: 'rgba(7, 13, 23, 0.6)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Closure Residual C_123</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: result.has_cycle_slip ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                      {result.closure_residual_rad.toFixed(4)} rad
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ({result.closure_residual_deg.toFixed(1)}&deg;)
                    </div>
                  </div>

                  {/* Integer Slip */}
                  <div style={{ padding: '0.85rem', background: 'rgba(7, 13, 23, 0.6)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cycle Slip Integer Ambiguity</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: result.estimated_integer_slip !== 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                      {result.estimated_integer_slip} &times; 2&pi;
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {result.has_cycle_slip ? 'Unwrapping Error Flagged' : 'Consistent Zero Closure'}
                    </div>
                  </div>

                  {/* Mean Coherence */}
                  <div style={{ padding: '0.85rem', background: 'rgba(7, 13, 23, 0.6)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mean Triplet Coherence</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {result.mean_coherence.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Spatial Quality Metric
                    </div>
                  </div>

                </div>
              </div>

              {/* Chart */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Phase Breakdown Across Interferometric Triplet
                </h3>
                <PlotlyChart
                  data={plotData}
                  layout={{
                    title: 'Interferometric Phase (Radians)',
                    yaxis: { title: 'Phase (rad)' },
                  }}
                />
              </div>
            </>
          ) : (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Layers size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>Configure triplet phase values or click <strong>Ideal</strong> / <strong>+2&pi; Slip</strong> to audit phase closure consistency.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

