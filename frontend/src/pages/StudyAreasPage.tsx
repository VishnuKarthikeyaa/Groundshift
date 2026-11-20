import React, { useEffect, useState } from 'react';
import { MapContainer, Rectangle, Marker, Popup } from 'react-leaflet';
import { DarkBasemap } from '../components/DarkBasemap';
import L from 'leaflet';
import { MapPin, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
import { api } from '../services/api';
import { StudyArea } from '../types';

// Custom dark marker icon
const customIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="background: #38bdf8; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 8px #38bdf8;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

export const StudyAreasPage: React.FC = () => {
  const [studyAreas, setStudyAreas] = useState<StudyArea[]>([]);
  const [selectedArea, setSelectedArea] = useState<StudyArea | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAreas() {
      try {
        const res = await api.getStudyAreas();
        setStudyAreas(res.study_areas);
        if (res.study_areas.length > 0) {
          setSelectedArea(res.study_areas[0]);
        }
      } catch (err) {
        console.error('Failed to load study areas', err);
      } finally {
        setLoading(false);
      }
    }
    loadAreas();
  }, []);

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.4rem' }}>
          Geographic Study Areas & Target Phenomena
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Configured observational areas for multi-frequency SAR analysis (L-band NISAR & SAOCOM vs C-band Sentinel-1 & RCM).
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2fr', gap: '1.5rem' }}>
        
        {/* Sidebar Selector & Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--accent-cyan)' }}>
              Select Active Region
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {studyAreas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => setSelectedArea(area)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: selectedArea?.id === area.id ? '1px solid var(--border-highlight)' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: selectedArea?.id === area.id ? 'rgba(56, 189, 248, 0.12)' : 'rgba(13, 23, 38, 0.6)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: selectedArea?.id === area.id ? 'var(--accent-cyan)' : 'inherit' }}>
                    {area.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {area.state}, {area.country} | EPSG:{area.utm_epsg}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedArea && (
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
                {selectedArea.name} Profile
              </h3>
              
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Surface Characteristics
                </span>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {selectedArea.surface_profile}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Target Scientific Phenomena
                </span>
                <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {selectedArea.target_phenomena.map((phenomenon, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <CheckCircle2 size={13} color="var(--accent-cyan)" style={{ marginTop: '0.2rem', flexShrink: 0 }} />
                      <span>{phenomenon}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  Validation Anchors
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {selectedArea.validation_anchors.map((anchor, idx) => (
                    <span key={idx} style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', padding: '0.2rem 0.5rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '4px', color: 'var(--accent-cyan)' }}>
                      {anchor.type}: {anchor.id} ({anchor.status})
                    </span>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Leaflet Map */}
        <div className="glass-panel" style={{ height: '620px', padding: '0.5rem', overflow: 'hidden' }}>
          <MapContainer
            center={[12.0, 79.5]}
            zoom={7}
            style={{ height: '100%', width: '100%', borderRadius: '8px' }}
          >
            {/* CartoDB Dark Matter Tile Layer */}
            <DarkBasemap />

            {studyAreas.map((area) => {
              const bounds: [[number, number], [number, number]] = [
                [area.bounds.min_lat, area.bounds.min_lon],
                [area.bounds.max_lat, area.bounds.max_lon]
              ];
              const isSelected = selectedArea?.id === area.id;

              return (
                <React.Fragment key={area.id}>
                  <Rectangle
                    bounds={bounds}
                    pathOptions={{
                      color: isSelected ? '#38bdf8' : '#3b82f6',
                      weight: isSelected ? 2 : 1,
                      fillColor: isSelected ? '#38bdf8' : '#3b82f6',
                      fillOpacity: isSelected ? 0.18 : 0.08
                    }}
                    eventHandlers={{
                      click: () => setSelectedArea(area)
                    }}
                  />
                  <Marker position={area.center} icon={customIcon}>
                    <Popup className="dark-popup">
                      <div style={{ color: '#070d17', fontWeight: 700 }}>{area.name}</div>
                      <div style={{ color: '#334155', fontSize: '0.75rem' }}>EPSG: {area.utm_epsg}</div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>

      </div>

    </div>
  );
};

