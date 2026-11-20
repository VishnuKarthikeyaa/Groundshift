import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Play, 
  XOctagon, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Terminal, 
  MapPin, 
  Layers 
} from 'lucide-react';
import { MapContainer, Rectangle } from 'react-leaflet';
import { DarkBasemap } from '../components/DarkBasemap';
import { api } from '../services/api';
import { DatasetRecord } from '../types';
import { EmptyState } from '../components/EmptyState';
import { MetricValue } from '../components/MetricValue';

interface JobLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

interface ActiveJob {
  job_id: string;
  name: string;
  workflow_type: string;
  status: string;
  current_stage: string;
  percent_complete: number;
  elapsed_time_seconds: number;
  error_message?: string;
  logs: JobLogEntry[];
}

export const SARProcessingPage: React.FC = () => {
  // Step 1: Dataset eligibility
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');

  // Step 2: Workflow selection
  const [workflowType, setWorkflowType] = useState<string>('linear_rate_inversion');

  // Step 3: Geographic subset bounding box
  const [bbox, setBbox] = useState<[number, number, number, number]>([12.8, 80.0, 13.3, 80.4]);

  // Step 4: Active Job state
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<ActiveJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Log filter & copy
  const [logSeverityFilter, setLogSeverityFilter] = useState<string>('ALL');
  const [copiedLogs, setCopiedLogs] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Load datasets on mount
  useEffect(() => {
    api.getCatalog().then(res => {
      setDatasets(res.datasets || []);
      if (res.datasets && res.datasets.length > 0) {
        setSelectedDatasetId(res.datasets[0].product_id);
      }
    });
    loadRecentJobs();
  }, []);

  const loadRecentJobs = async () => {
    try {
      const jobs = await api.listJobs(undefined, 10);
      setRecentJobs(jobs as any[]);
      if (jobs.length > 0 && !activeJob) {
        setActiveJob(jobs[0] as any);
      }
    } catch (err) {
      console.error('Failed to list jobs', err);
    }
  };

  // Poll active job while running
  useEffect(() => {
    if (!activeJob || activeJob.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const updated = await api.getJobStatus(activeJob.job_id);
        setActiveJob(updated as any);
        if (updated.status !== 'running') {
          loadRecentJobs();
        }
      } catch (err) {
        console.error('Error polling job status', err);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [activeJob?.job_id, activeJob?.status]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeJob?.logs]);

  // Submit Job
  const handleStartWorkflow = async () => {
    if (!selectedDatasetId) return;

    try {
      setIsSubmitting(true);
      const sel = datasets.find(d => d.product_id === selectedDatasetId);
      const jobName = `${workflowType.toUpperCase()} - ${sel?.mission || 'SAR'}`;

      let params: Record<string, any> = {
        product_id: selectedDatasetId,
        subset_bbox: bbox,
      };

      if (workflowType === 'linear_rate_inversion') {
        params = {
          ...params,
          epochs: ['2023-01-05', '2023-03-18', '2023-07-04', '2023-10-20', '2024-02-07', '2024-05-25'],
          displacement_series_mm: [-2.1, -5.4, -11.2, -18.7, -24.9, -32.6],
          uncertainties_mm: [1.2, 1.1, 1.3, 1.2, 1.4, 1.2],
        };
      } else if (workflowType === 'dbscan_clustering') {
        params = {
          ...params,
          lons: [80.20, 80.22, 80.21, 80.23, 80.19, 80.25],
          lats: [13.01, 13.02, 13.00, 13.03, 12.99, 13.08],
          velocities_mm_year: [-18.5, -21.2, -19.8, -22.4, -17.9, -2.1],
          eps_km: 1.8,
          min_samples: 3,
        };
      } else if (workflowType === 'cross_mission_validation') {
        params = {
          ...params,
          observations_1: [-14.5, -22.1, -18.3, -25.2, -12.4],
          observations_2: [-13.9, -23.0, -17.8, -24.6, -13.1],
          temporal_separation_days: 3,
          look_vector_divergence_deg: 2.1,
          spatial_overlap_pct: 92.4,
        };
      }

      const newJob = await api.submitJob({
        name: jobName,
        workflow_type: workflowType,
        parameters: params,
      });

      setActiveJob(newJob as any);
      loadRecentJobs();
    } catch (err: any) {
      alert(`Job submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async () => {
    if (!activeJob) return;
    try {
      await api.cancelJob(activeJob.job_id);
      const updated = await api.getJobStatus(activeJob.job_id);
      setActiveJob(updated as any);
      loadRecentJobs();
    } catch (err: any) {
      alert(`Failed to cancel job: ${err.message}`);
    }
  };

  const handleCopyLogs = () => {
    if (!activeJob) return;
    const text = activeJob.logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const selectedDataset = datasets.find(d => d.product_id === selectedDatasetId);

  // Workflow suitability check
  const isEligible = (d: DatasetRecord) => {
    if (workflowType === 'linear_rate_inversion') {
      return d.product_type === 'SLC' || d.product_type === 'RSLC' || d.product_type === 'GUNW';
    }
    return true;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1.75fr)', height: '100%', overflow: 'hidden' }}>
      {/* Left Column: Step-by-Step Workflow Setup */}
      <div 
        style={{ 
          padding: '16px', 
          backgroundColor: 'var(--bg-surface-1)', 
          borderRight: '1px solid var(--border-hairline)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto'
        }}
      >
        <div>
          <h1 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={17} color="var(--accent-cyan)" />
            SAR SCIENTIFIC PROCESSING WORKFLOWS
          </h1>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Supervised multi-temporal InSAR inversion, spatial clustering, and cross-mission pipelines
          </div>
        </div>

        {/* Step 1: Select Eligible Dataset */}
        <div className="instrument-panel-inner" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-cyan)', letterSpacing: '0.04em', marginBottom: '6px' }}>
            STEP 1: SELECT ELIGIBLE DATASET ASSET
          </div>

          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="btn-instrument"
            style={{ width: '100%', marginBottom: '6px', fontSize: '11px' }}
          >
            {datasets.map(d => {
              const eligible = isEligible(d);
              return (
                <option key={d.product_id} value={d.product_id}>
                  {eligible ? '✓' : '✗'} {d.mission} ({d.product_type}) &bull; {d.product_id.slice(0, 32)}...
                </option>
              );
            })}
          </select>

          {selectedDataset && (
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div>Band: <span className="font-mono">{selectedDataset.sensor_band}</span> | Pol: <span className="font-mono">{selectedDataset.polarization}</span></div>
              {!isEligible(selectedDataset) ? (
                <div style={{ color: 'var(--accent-amber)', marginTop: '4px' }}>
                  ⚠️ Ineligible for Linear Rate Inversion: Product type is {selectedDataset.product_type}. Requires complex phase or unwrapped displacement data (SLC, RSLC, GUNW).
                </div>
              ) : (
                <div style={{ color: 'var(--accent-cyan)', marginTop: '4px' }}>
                  ✓ Product geometry and phase tags are fully compatible with selected workflow.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 2: Choose Workflow */}
        <div className="instrument-panel-inner" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-cyan)', letterSpacing: '0.04em', marginBottom: '6px' }}>
            STEP 2: CHOOSE SCIENTIFIC WORKFLOW
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { id: 'linear_rate_inversion', name: 'Linear Rate Inversion (1D LOS)', desc: 'Weighted least-squares time-series velocity inversion with uncertainty propagation.' },
              { id: 'dbscan_clustering', name: 'Spatial Deformation Clustering (DBSCAN)', desc: 'Detect contiguous deformation subsidence/uplift basins with noise rejection.' },
              { id: 'cross_mission_validation', name: 'Cross-Mission Statistical Validation', desc: 'Compute spatial-temporal overlap, RMSE, bias, and correlation between two sensors.' },
            ].map(w => (
              <label
                key={w.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: workflowType === w.id ? 'var(--bg-surface-3)' : 'transparent',
                  border: `1px solid ${workflowType === w.id ? 'var(--accent-cyan)' : 'var(--border-hairline)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="workflow"
                  value={w.id}
                  checked={workflowType === w.id}
                  onChange={() => setWorkflowType(w.id)}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-bright)' }}>{w.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{w.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Step 3: Geographic Subset Coordinates */}
        <div className="instrument-panel-inner" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-cyan)', letterSpacing: '0.04em', marginBottom: '6px' }}>
            STEP 3: DEFINE GEOGRAPHIC SUBSET (WGS84)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Min Lat:</span>
              <input
                type="number"
                step="0.05"
                value={bbox[0]}
                onChange={(e) => setBbox([parseFloat(e.target.value), bbox[1], bbox[2], bbox[3]])}
                className="btn-instrument font-mono"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Min Lon:</span>
              <input
                type="number"
                step="0.05"
                value={bbox[1]}
                onChange={(e) => setBbox([bbox[0], parseFloat(e.target.value), bbox[2], bbox[3]])}
                className="btn-instrument font-mono"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Max Lat:</span>
              <input
                type="number"
                step="0.05"
                value={bbox[2]}
                onChange={(e) => setBbox([bbox[0], bbox[1], parseFloat(e.target.value), bbox[3]])}
                className="btn-instrument font-mono"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Max Lon:</span>
              <input
                type="number"
                step="0.05"
                value={bbox[3]}
                onChange={(e) => setBbox([bbox[0], bbox[1], bbox[2], parseFloat(e.target.value)])}
                className="btn-instrument font-mono"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Step 4: Run Action */}
        <button
          onClick={handleStartWorkflow}
          disabled={isSubmitting || (selectedDataset && !isEligible(selectedDataset))}
          className="btn-instrument primary"
          style={{ padding: '8px', justifyContent: 'center', fontSize: '12px', fontWeight: 600 }}
        >
          <Play size={15} />
          {isSubmitting ? 'Submitting to Compute Supervisor...' : 'Execute Workflow Job'}
        </button>
      </div>

      {/* Right Column: Real-Time Telemetry & Log Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {activeJob ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Active Job Telemetry Bar */}
            <div 
              style={{ 
                padding: '14px', 
                backgroundColor: 'var(--bg-surface-1)', 
                borderBottom: '1px solid var(--border-hairline)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`status-dot ${activeJob.status === 'running' ? 'running' : activeJob.status === 'completed' ? 'completed' : 'error'}`} />
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)' }}>
                      {activeJob.name}
                    </span>
                    <span className="badge-mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                      {activeJob.job_id}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {activeJob.status === 'running' && (
                    <button onClick={handleCancelJob} className="btn-instrument" style={{ color: 'var(--accent-amber)' }}>
                      <XOctagon size={13} /> Cancel Job
                    </button>
                  )}
                  <button onClick={handleCopyLogs} className="btn-instrument">
                    {copiedLogs ? <Check size={13} color="var(--accent-cyan)" /> : <Copy size={13} />}
                    {copiedLogs ? 'Copied' : 'Copy Logs'}
                  </button>
                </div>
              </div>

              {/* Determinate Progress Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                  <span>Stage: <strong style={{ color: 'var(--text-bright)' }}>{activeJob.current_stage}</strong></span>
                  <span className="font-mono">{activeJob.percent_complete.toFixed(1)}% &bull; {activeJob.elapsed_time_seconds}s</span>
                </div>
                <div style={{ height: '6px', backgroundColor: 'var(--bg-surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${activeJob.percent_complete}%`,
                      backgroundColor: activeJob.status === 'failed' ? 'var(--accent-red)' : 'var(--accent-cyan)',
                      transition: 'width 200ms ease-out',
                    }}
                  />
                </div>
              </div>

              {/* Error Message with Suggested Next Step where one exists */}
              {activeJob.status === 'failed' && (
                <div
                  style={{
                    backgroundColor: 'rgba(224, 72, 72, 0.08)',
                    border: '1px solid var(--accent-red)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '11px',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--accent-red)' }}>
                    Failing Stage: {activeJob.current_stage}
                  </div>
                  <div style={{ color: 'var(--text-bright)', marginTop: '2px' }}>
                    {activeJob.error_message || 'Matrix inversion non-convergence.'}
                  </div>
                  <div style={{ color: 'var(--accent-amber)', marginTop: '4px' }}>
                    Suggested next step: Verify coherence threshold (&ge; 0.35) or inspect interferogram temporal baselines in Dataset Explorer.
                  </div>
                </div>
              )}
            </div>

            {/* Log Viewer with Severity Filter */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)', overflow: 'hidden' }}>
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '6px 12px', 
                  backgroundColor: 'var(--bg-surface-2)',
                  borderBottom: '1px solid var(--border-hairline)'
                }}
              >
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={12} color="var(--accent-cyan)" />
                  LIVE LOG TELEMETRY STREAM
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  {['ALL', 'INFO', 'WARNING', 'ERROR'].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setLogSeverityFilter(lvl)}
                      className={`btn-instrument ${logSeverityFilter === lvl ? 'primary' : ''}`}
                      style={{ padding: '1px 6px', fontSize: '9.5px' }}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monospaced Log Stream */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {activeJob.logs
                  .filter(l => logSeverityFilter === 'ALL' || l.level === logSeverityFilter)
                  .map((log, idx) => {
                    let levelColor = 'var(--text-muted)';
                    if (log.level === 'INFO') levelColor = 'var(--accent-cyan)';
                    else if (log.level === 'WARNING') levelColor = 'var(--accent-amber)';
                    else if (log.level === 'ERROR') levelColor = 'var(--accent-red)';
                    else if (log.level === 'SUCCESS') levelColor = 'var(--accent-blue)';

                    return (
                      <div key={idx} style={{ display: 'flex', gap: '8px', lineHeight: 1.4 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                          {log.timestamp.slice(11, 19)}
                        </span>
                        <span style={{ color: levelColor, fontWeight: 600, minWidth: '55px' }}>
                          [{log.level}]
                        </span>
                        <span style={{ color: 'var(--text-bright)' }}>
                          {log.message}
                        </span>
                      </div>
                    );
                  })}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '30px' }}>
            <EmptyState
              title="No Active Job Telemetry"
              message="Select an eligible dataset and click 'Execute Workflow Job' to launch a scientific InSAR inversion or clustering pipeline."
            />
          </div>
        )}
      </div>
    </div>
  );
};

