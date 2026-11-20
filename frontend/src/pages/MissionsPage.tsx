import React, { useEffect, useState } from 'react';
import { Satellite, Radio, Layers, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { Mission } from '../types';

export const MissionsPage: React.FC = () => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMissions() {
      try {
        const res = await api.getMissions();
        setMissions(res.missions);
      } catch (err) {
        console.error('Failed to load missions', err);
      } finally {
        setLoading(false);
      }
    }
    loadMissions();
  }, []);

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.4rem' }}>
          Multi-Mission SAR Platform Registry
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Standardized instrument profiles, radar bands, and analysis-ready product levels supported by GROUNDSHIFT.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {missions.map((mission) => (
          <div key={mission.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Mission Title & Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Satellite size={20} color="var(--accent-cyan)" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{mission.name}</h2>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  Operator: {mission.operator} | Orbit: {mission.orbit}
                </div>
              </div>

              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                fontFamily: 'var(--font-mono)', 
                padding: '0.25rem 0.65rem', 
                borderRadius: '6px',
                background: mission.status.includes('Active') || mission.status === 'Operational' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                color: mission.status.includes('Active') || mission.status === 'Operational' ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {mission.status}
              </span>
            </div>

            {/* Bands & Polarizations */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', background: 'rgba(7, 13, 23, 0.5)', padding: '1rem', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Radar Frequencies & Wavelengths
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {mission.bands.map((band, idx) => (
                    <span key={idx} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                      {band}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Polarimetric Modes
                </span>
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {mission.polarizations.map((pol, idx) => (
                    <span key={idx} style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                      {pol}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Primary Products */}
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                Supported Ingestion Products
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                {mission.primary_products.map((prod, idx) => (
                  <div key={idx} style={{ padding: '0.65rem 0.85rem', background: 'rgba(13, 23, 38, 0.8)', border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{prod.code}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{prod.type}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {prod.category}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Physical Role */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <ShieldCheck size={16} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
              <span>{mission.physics_role}</span>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
};

