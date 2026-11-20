import React, { useEffect, useState } from 'react';
import { 
  Server, 
  Cpu, 
  HardDrive, 
  Terminal, 
  CheckCircle2, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight,
  Database,
  Layers,
  Compass
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { SystemHealth, ScienceEnvironment } from '../types';

export const DashboardPage: React.FC = () => {
  const [system, setSystem] = useState<SystemHealth | null>(null);
  const [science, setScience] = useState<ScienceEnvironment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [sysData, sciData] = await Promise.all([
          api.getSystemHealth(),
          api.getScienceEnv()
        ]);
        setSystem(sysData);
        setScience(sciData);
      } catch (err: any) {
        setError(err.message || 'Failed to connect to GROUNDSHIFT backend.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Hero Banner */}
      <div className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
        
        <div style={{ maxWidth: '850px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-cyan)', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '0.85rem' }}>
            <ShieldCheck size={14} /> ACTIVE RESEARCH FOUNDATION
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            GROUNDSHIFT Multi-Mission SAR Intelligence
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', lineHeight: 1.6 }}>
            A scientifically reliable, reproducible platform complementing existing NASA and ESA Earth Observation workflows. 
            Facilitates cross-mission radar validation across divergent frequencies (L-band, C-band, S-band), 
            rigorous InSAR Line-of-Sight 2D/3D vector decomposition, and geodetic in-situ benchmarking.
          </p>
        </div>

        {error && (
          <div style={{ marginTop: '1.25rem', padding: '0.85rem 1.25rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#fda4af', fontSize: '0.875rem' }}>
            <AlertTriangle size={18} />
            <span>{error} (Ensure backend server is running on http://127.0.0.1:8000)</span>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid-cols-auto">
        
        {/* Host OS & Hardware */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-cyan)', marginBottom: '1rem' }}>
            <Server size={20} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Host Environment</h3>
          </div>
          {system ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Platform</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{system.os.platform} {system.os.release}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Architecture</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{system.os.machine}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Python Runtime</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>3.11 (Conda Miniforge)</span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading system metrics...</div>
          )}
        </div>

        {/* Memory Governor */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-emerald)', marginBottom: '1rem' }}>
            <Cpu size={20} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Memory Governor (16 GB)</h3>
          </div>
          {system ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Available RAM</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                  {Math.round(system.memory.available_physical_mb)} MB
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Physical RAM</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round(system.memory.total_physical_mb)} MB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Safety Ceiling</span>
                <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                  {system.memory.max_threshold_mb} MB Max Load
                </span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Monitoring RAM status...</div>
          )}
        </div>

        {/* Scientific Stack */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-amber)', marginBottom: '1rem' }}>
            <Database size={20} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Scientific Verification</h3>
          </div>
          {science ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>GDAL Core</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>v{science.libraries.gdal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Rasterio & PROJ</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>v{science.libraries.rasterio}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>HDF5 / Xarray</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>v{science.libraries.h5py}</span>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading scientific libraries...</div>
          )}
        </div>

      </div>

      {/* Quick Launch Cards */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Terminal size={18} color="var(--accent-cyan)" />
          Operational Research Workbenches
        </h2>
        
        <div className="grid-cols-auto">
          
          <Link to="/explorer" style={{ textDecoration: 'none' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', height: '100%', cursor: 'pointer', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', color: 'var(--accent-cyan)' }}>
                  <Database size={22} />
                </div>
                <ArrowRight size={18} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                SAR Ingestion & Dataset Explorer
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Product-aware multi-mission discovery, memory-safe GeoTIFF/HDF5/SAFE inspection, and persistent cataloguing across NISAR, S1, SAOCOM, RCM, and UAVSAR.
              </p>
            </div>
          </Link>

          <Link to="/study-areas" style={{ textDecoration: 'none' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', height: '100%', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', color: 'var(--accent-cyan)' }}>
                  <HardDrive size={22} />
                </div>
                <ArrowRight size={18} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Study Areas & AOI Footprints
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Explore Chennai coastal urban subsidence and Cauvery Delta agricultural crop coherence study bounding boxes on an interactive Leaflet map.
              </p>
            </div>
          </Link>

          <Link to="/decomposition" style={{ textDecoration: 'none' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', height: '100%', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: 'var(--accent-blue)' }}>
                  <Compass size={22} />
                </div>
                <ArrowRight size={18} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                2D InSAR Vector Decomposition
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Invert multi-track ascending and descending Line-of-Sight radar observations into true East-West and Vertical displacement vectors.
              </p>
            </div>
          </Link>

          <Link to="/triplet-audit" style={{ textDecoration: 'none' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', height: '100%', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: 'var(--accent-emerald)' }}>
                  <Layers size={22} />
                </div>
                <ArrowRight size={18} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Phase Triplet Loop Closure QA
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Audit interferometric closed loops (C_123 = W&#123;phi_12 + phi_23 - phi_13&#125;) to detect phase unwrapping cycle slips and decorrelation errors.
              </p>
            </div>
          </Link>

        </div>
      </div>

    </div>
  );
};

