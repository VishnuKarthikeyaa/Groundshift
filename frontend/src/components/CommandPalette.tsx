import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Cpu, 
  Database, 
  Sliders, 
  Layers, 
  Activity, 
  Compass, 
  FileText 
} from 'lucide-react';
import { api } from '../services/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  activeStudyArea: string;
  onSelectStudyArea: (id: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  activeStudyArea,
  onSelectStudyArea,
}) => {
  const [query, setQuery] = useState('');
  const [datasets, setDatasets] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [studyAreas, setStudyAreas] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');

    // Fetch navigation targets
    Promise.all([
      api.getCatalog({ limit: 20 }).catch(() => ({ datasets: [] })),
      api.listJobs ? api.listJobs(undefined, 20).catch(() => []) : Promise.resolve([]),
      api.getStudyAreas().catch(() => ({ study_areas: [] })),
    ]).then(([catRes, jobsRes, studyRes]) => {
      setDatasets(catRes.datasets || []);
      setJobs(jobsRes || []);
      setStudyAreas(studyRes.study_areas || []);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredSections = [
    { name: 'Overview', path: '/', icon: Activity },
    { name: 'Global Explorer', path: '/global-explorer', icon: Compass },
    { name: 'Dataset Explorer', path: '/datasets', icon: Database },
    { name: 'SAR Processing', path: '/processing', icon: Cpu },
    { name: 'Mission Comparison', path: '/mission-comparison', icon: Layers },
    { name: 'Validation Laboratory', path: '/validation-lab', icon: Sliders },
    { name: 'Deformation Analysis', path: '/deformation', icon: MapPin },
    { name: 'Research Reports', path: '/reports', icon: FileText },
    { name: 'Settings', path: '/settings', icon: Sliders },
  ].filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  const filteredAreas = studyAreas.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase()) || 
    a.id.toLowerCase().includes(query.toLowerCase())
  );

  const filteredDatasets = datasets.filter(d => 
    d.product_id?.toLowerCase().includes(query.toLowerCase()) ||
    d.mission?.toLowerCase().includes(query.toLowerCase())
  );

  const filteredJobs = jobs.filter(j => 
    j.job_id?.toLowerCase().includes(query.toLowerCase()) ||
    j.name?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.75)',
        backdropFilter: 'blur(2px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={onClose}
    >
      <div
        className="instrument-panel"
        style={{
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface-1)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-hairline)',
          }}
        >
          <Search size={16} color="var(--accent-cyan)" />
          <input
            type="text"
            placeholder="Type a section, study area, dataset, or job ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-bright)',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '2px 5px',
              backgroundColor: 'var(--bg-surface-3)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 2,
              color: 'var(--text-muted)',
            }}
          >
            ESC
          </kbd>
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Sections */}
          {filteredSections.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.05em' }}>
                Navigation Sections
              </div>
              {filteredSections.map(s => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.path}
                    onClick={() => { navigate(s.path); onClose(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-main)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Icon size={14} color="var(--accent-cyan)" />
                    <span style={{ fontSize: '12px' }}>{s.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Study Areas */}
          {filteredAreas.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.05em' }}>
                Study Areas
              </div>
              {filteredAreas.map(a => (
                <div
                  key={a.id}
                  onClick={() => { onSelectStudyArea(a.id); navigate('/global-explorer'); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-xs)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={13} color="var(--accent-amber)" />
                    <span style={{ fontSize: '12px', color: 'var(--text-bright)' }}>{a.name}</span>
                  </div>
                  <span className="badge-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {a.state}, {a.country}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Datasets */}
          {filteredDatasets.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.05em' }}>
                Datasets ({filteredDatasets.length})
              </div>
              {filteredDatasets.slice(0, 6).map(d => (
                <div
                  key={d.product_id}
                  onClick={() => { navigate('/datasets'); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-xs)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={13} color="var(--accent-blue)" />
                    <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-bright)' }}>
                      {d.product_id}
                    </span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{d.mission}</span>
                </div>
              ))}
            </div>
          )}

          {/* Jobs */}
          {filteredJobs.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.05em' }}>
                Processing Jobs ({filteredJobs.length})
              </div>
              {filteredJobs.slice(0, 5).map(j => (
                <div
                  key={j.job_id}
                  onClick={() => { navigate('/processing'); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-xs)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cpu size={13} color="var(--accent-cyan)" />
                    <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-bright)' }}>
                      {j.name || j.job_id}
                    </span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{j.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

