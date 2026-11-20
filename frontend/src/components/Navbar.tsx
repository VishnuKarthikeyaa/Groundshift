import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Radar, 
  Activity, 
  MapPin, 
  Satellite, 
  Compass, 
  Layers, 
  TrendingDown, 
  CheckCircle2, 
  AlertCircle,
  Database,
  Cpu,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';
import { MemoryStats } from '../types';

export const Navbar: React.FC = () => {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [memStats, setMemStats] = useState<MemoryStats | null>(null);

  const checkStatus = async () => {
    try {
      const health = await api.getHealth();
      setBackendOnline(health.status === 'healthy');
      const sys = await api.getSystemHealth();
      setMemStats(sys.memory);
    } catch {
      setBackendOnline(false);
      setMemStats(null);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', position: 'sticky', top: 0, zIndex: 1000 }}>
      <div className="container" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #0284c7, #2563eb)', 
            padding: '0.55rem', 
            borderRadius: '10px', 
            display: 'flex', 
            alignItems: 'center', 
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)' 
          }}>
            <Radar size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #38bdf8, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              GROUNDSHIFT
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              SAR Validation & Earth Surface Intelligence
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <NavLink to="/" end className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Activity size={16} /> Overview
          </NavLink>
          <NavLink to="/study-areas" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <MapPin size={16} /> Study Areas
          </NavLink>
          <NavLink to="/missions" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Satellite size={16} /> Missions
          </NavLink>
          <NavLink to="/explorer" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Database size={16} /> Dataset Explorer
          </NavLink>
          <NavLink to="/processing" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Cpu size={16} /> SAR Processing
          </NavLink>
          <NavLink to="/validation-workbench" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <ShieldCheck size={16} /> Validation Engine
          </NavLink>
          <NavLink to="/decomposition" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Compass size={16} /> InSAR Inversion
          </NavLink>
          <NavLink to="/triplet-audit" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Layers size={16} /> Triplet Audit
          </NavLink>
          <NavLink to="/benchmarks" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <TrendingDown size={16} /> Chennai Subsidence
          </NavLink>
        </nav>

        {/* Telemetry & Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {memStats && (
            <div style={{ 
              fontSize: '0.75rem', 
              fontFamily: 'var(--font-mono)', 
              background: 'rgba(56, 189, 248, 0.08)', 
              padding: '0.35rem 0.65rem', 
              borderRadius: '6px', 
              border: '1px solid rgba(56, 189, 248, 0.2)',
              color: memStats.is_memory_safe ? 'var(--accent-cyan)' : 'var(--accent-amber)'
            }}>
              RAM: {Math.round(memStats.available_physical_mb / 1024 * 10) / 10}GB Free
            </div>
          )}

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            fontSize: '0.78rem', 
            fontWeight: 600,
            padding: '0.35rem 0.65rem',
            borderRadius: '6px',
            background: backendOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            color: backendOnline ? 'var(--accent-emerald)' : 'var(--accent-rose)',
            border: `1px solid ${backendOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
          }}>
            {backendOnline ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {backendOnline ? 'API Connected' : 'API Offline'}
          </div>
        </div>

      </div>
    </header>
  );
};

