import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Database, 
  Satellite, 
  CheckCircle2, 
  Sliders, 
  Map, 
  Cpu, 
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { MetricValue } from '../components/MetricValue';
import { EmptyState } from '../components/EmptyState';

export const OverviewPage: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const overview = await api.getPlatformOverview();
      setData(overview);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to GROUNDSHIFT Telemetry API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="skeleton-box" style={{ height: '40px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-box" style={{ height: '80px' }} />
          ))}
        </div>
        <div className="skeleton-box" style={{ height: '220px' }} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: '24px' }}>
        <EmptyState
          title="Telemetry Feed Offline"
          message={`Unable to retrieve authentic telemetry from the GROUNDSHIFT backend: ${error}`}
          suggestedAction={{
            label: 'Retry Telemetry Connection',
            onClick: loadData,
          }}
        />
      </div>
    );
  }

  const jobsByStatus = data?.jobs_by_status || { running: 0, completed: 0, failed: 0, idle: 0 };
  const recentActivity = data?.recent_activity || [];

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Instrument Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-bright)', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="var(--accent-cyan)" />
            MISSION TELEMETRY & SYSTEM OVERVIEW
          </h1>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            System state synchronized with active SQLite catalog and computation supervisor
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={loadData} className="btn-instrument">
            Sync Telemetry
          </button>
        </div>
      </div>

      {/* Six Primary Instrument Counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
        {/* 1. Registered Datasets */}
        <Link to="/datasets" style={{ textDecoration: 'none' }}>
          <div className="instrument-panel" style={{ padding: '12px 14px', borderLeft: '3px solid var(--accent-cyan)', cursor: 'pointer' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Registered Datasets
            </div>
            <div style={{ fontSize: '20px', lineHeight: 1.1 }}>
              <MetricValue 
                value={data.registered_datasets} 
                unit="assets" 
                sourceId="catalog.db"
                sourceType="dataset"
                highlight 
              />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Source: SQLite Metadata Store
            </div>
          </div>
        </Link>

        {/* 2. Supported Missions */}
        <Link to="/mission-comparison" style={{ textDecoration: 'none' }}>
          <div className="instrument-panel" style={{ padding: '12px 14px', borderLeft: '3px solid var(--accent-blue)', cursor: 'pointer' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Supported Missions
            </div>
            <div style={{ fontSize: '20px', lineHeight: 1.1 }}>
              <MetricValue 
                value={data.supported_missions_count} 
                unit="constellations" 
                sourceId="spec.missions" 
              />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              L-band, C-band, X-band
            </div>
          </div>
        </Link>

        {/* 3. Successfully Processed Datasets */}
        <Link to="/processing" style={{ textDecoration: 'none' }}>
          <div className="instrument-panel" style={{ padding: '12px 14px', borderLeft: '3px solid var(--accent-cyan)', cursor: 'pointer' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Processed Datasets
            </div>
            <div style={{ fontSize: '20px', lineHeight: 1.1 }}>
              <MetricValue 
                value={data.processed_datasets} 
                unit="products" 
                sourceId="sar.pipeline" 
              />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Interferometric & Displacements
            </div>
          </div>
        </Link>

        {/* 4. Validation Experiments */}
        <Link to="/validation-lab" style={{ textDecoration: 'none' }}>
          <div className="instrument-panel" style={{ padding: '12px 14px', borderLeft: '3px solid var(--accent-amber)', cursor: 'pointer' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Validation Anchors
            </div>
            <div style={{ fontSize: '20px', lineHeight: 1.1 }}>
              <MetricValue 
                value={data.validation_experiments_count} 
                unit="GNSS stns" 
                sourceId="gnss.network" 
              />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Independent In-Situ Baselines
            </div>
          </div>
        </Link>

        {/* 5. Geographic Coverage (km²) */}
        <Link to="/global-explorer" style={{ textDecoration: 'none' }}>
          <div className="instrument-panel" style={{ padding: '12px 14px', borderLeft: '3px solid var(--accent-blue)', cursor: 'pointer' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Geographic Coverage
            </div>
            <div style={{ fontSize: '20px', lineHeight: 1.1 }}>
              <MetricValue 
                value={data.ground_coverage_km2} 
                unit="km²" 
                sourceId="bbox.union" 
              />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Chennai & Cauvery Basins
            </div>
          </div>
        </Link>

        {/* 6. Processing Jobs by Status */}
        <Link to="/processing" style={{ textDecoration: 'none' }}>
          <div className="instrument-panel" style={{ padding: '12px 14px', borderLeft: '3px solid var(--accent-cyan)', cursor: 'pointer' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Jobs Distribution
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '13px' }}>
              <span title="Running" style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                R:<strong>{jobsByStatus.running || 0}</strong>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span title="Completed" style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                C:<strong>{jobsByStatus.completed || 0}</strong>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span title="Failed" style={{ color: jobsByStatus.failed > 0 ? 'var(--accent-red)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                F:<strong>{jobsByStatus.failed || 0}</strong>
              </span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Current Supervisor State
            </div>
          </div>
        </Link>
      </div>

      {/* Two Column Layout: Activity Feed & Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '14px' }}>
        {/* Recent Operational Activity Feed */}
        <div className="instrument-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)', letterSpacing: '0.02em' }}>
              RECENT OPERATIONAL & PROCESSING ACTIVITY
            </div>
            <span className="badge-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              N={recentActivity.length} events
            </span>
          </div>

          {recentActivity.length === 0 ? (
            <EmptyState
              compact
              title="No Activity Events Logged"
              message="The supervisor event journal is currently empty. Run a SAR processing job or register new dataset assets to record activity."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="instrument-table">
                <thead>
                  <tr>
                    <th>Timestamp (UTC)</th>
                    <th>Category</th>
                    <th>Target / Source</th>
                    <th>Status</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((act: any, idx: number) => {
                    let statusClass = 'idle';
                    if (act.status === 'running') statusClass = 'running';
                    else if (act.status === 'completed' || act.status === 'AVAILABLE') statusClass = 'completed';
                    else if (act.status === 'failed') statusClass = 'error';

                    return (
                      <tr key={act.id || idx}>
                        <td className="font-mono" style={{ whiteSpace: 'nowrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {act.timestamp ? act.timestamp.replace('T', ' ').slice(0, 19) : '---'}
                        </td>
                        <td>
                          <span className="badge-mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {act.category}
                          </span>
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--text-bright)', fontSize: '11.5px' }}>
                          <Link 
                            to={act.category === 'WORKFLOW_JOB' ? '/processing' : '/datasets'}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {act.title}
                          </Link>
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                            <span className={`status-dot ${statusClass}`} />
                            <span style={{ textTransform: 'capitalize' }}>{act.status}</span>
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '280px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={act.detail}>
                          {act.detail}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mission Inventory & Storage Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Mission Breakdown */}
          <div className="instrument-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)' }}>
              MISSION DISTRIBUTION IN CATALOG
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Object.entries(data?.missions_breakdown || {}).map(([mission, count]) => (
                <div key={mission} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-hairline)' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-main)' }}>{mission}</span>
                  <span className="badge-mono" style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
                    {count as number} datasets
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Product Types */}
          <div className="instrument-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)' }}>
              PRODUCT TYPES IN REPOSITORY
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {Object.entries(data?.product_types_breakdown || {}).map(([ptype, count]) => (
                <div key={ptype} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-hairline)' }}>
                  <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-main)' }}>{ptype}</span>
                  <span className="badge-mono" style={{ fontSize: '11px', color: 'var(--accent-blue)' }}>
                    {count as number} products
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

