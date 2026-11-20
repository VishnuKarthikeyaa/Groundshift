import {
  SystemHealth,
  ScienceEnvironment,
  Mission,
  StudyArea,
  DecompositionResult,
  TripletClosureResult,
  BenchmarkData,
  DatasetRecord,
  CatalogStats,
  InspectionResult,
  ClassificationCheck,
  TimeSeriesRateResult,
  DBSCANResult,
  MissionComparisonResult,
  BenchmarkDisplacementData,
  SpatialAlignmentInfo,
  TemporalAlignmentInfo,
  ValidationStatsInfo,
  GNSSStationInfo,
  GNSSValidationInfo,
  ResearchReportInfo,
} from '../types';

const API_BASE = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      // ignore
    }
    throw new Error(
      errorJson?.message || errorJson?.detail || `API Request Failed with status ${response.status}`
    );
  }

  return response.json();
}

export const api = {
  getHealth: () => fetchJson<{ status: string; service: string; version: string }>(`${API_BASE}/health`),
  getSystemHealth: () => fetchJson<SystemHealth>(`${API_BASE}/health/system`),
  getScienceEnv: () => fetchJson<ScienceEnvironment>(`${API_BASE}/health/science`),
  getMissions: () => fetchJson<{ count: number; missions: Mission[] }>(`${API_BASE}/missions`),
  getStudyAreas: () => fetchJson<{ count: number; study_areas: StudyArea[] }>(`${API_BASE}/study-areas`),
  
  decomposeLos: (payload: {
    d_asc_mm: number;
    d_desc_mm: number;
    inc_asc_deg: number;
    head_asc_deg: number;
    inc_desc_deg: number;
    head_desc_deg: number;
    sigma_asc?: number;
    sigma_desc?: number;
  }) => fetchJson<{ success: boolean; results: DecompositionResult }>(`${API_BASE}/validation/decompose`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  auditTriplet: (payload: {
    phi_12_rad: number;
    phi_23_rad: number;
    phi_13_rad: number;
    coherence_12?: number;
    coherence_23?: number;
    coherence_13?: number;
  }) => fetchJson<{ success: boolean; results: TripletClosureResult }>(`${API_BASE}/validation/triplet-closure`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getChennaiBenchmark: () => fetchJson<BenchmarkData>(`${API_BASE}/validation/benchmarks/chennai-subsidence`),

  // Ingestion & Discovery
  searchDatasets: (params: {
    min_lon: number;
    min_lat: number;
    max_lon: number;
    max_lat: number;
    mission?: string;
    product_type?: string;
    polarization?: string;
    processing_level?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    query.set('min_lon', params.min_lon.toString());
    query.set('min_lat', params.min_lat.toString());
    query.set('max_lon', params.max_lon.toString());
    query.set('max_lat', params.max_lat.toString());
    if (params.mission) query.set('mission', params.mission);
    if (params.product_type) query.set('product_type', params.product_type);
    if (params.polarization) query.set('polarization', params.polarization);
    if (params.processing_level) query.set('processing_level', params.processing_level);
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.limit) query.set('limit', params.limit.toString());
    return fetchJson<{
      total_found: number;
      live_queried: boolean;
      live_error: string | null;
      results: DatasetRecord[];
      supported_missions: string[];
    }>(`${API_BASE}/ingest/search?${query.toString()}`);
  },

  inspectLocalPath: (filePath: string) => fetchJson<InspectionResult>(`${API_BASE}/ingest/inspect`, {
    method: 'POST',
    body: JSON.stringify({ file_path: filePath }),
  }),

  importLocalFile: (filePath: string, customProductId?: string, customMission?: string) => fetchJson<{
    message: string;
    dataset: DatasetRecord;
    deduplicated: boolean;
  }>(`${API_BASE}/ingest/import-local`, {
    method: 'POST',
    body: JSON.stringify({
      file_path: filePath,
      custom_product_id: customProductId,
      custom_mission: customMission,
    }),
  }),

  registerRemoteDataset: (dataset: Partial<DatasetRecord>) => fetchJson<{
    message: string;
    dataset: DatasetRecord;
  }>(`${API_BASE}/ingest/register-remote`, {
    method: 'POST',
    body: JSON.stringify(dataset),
  }),

  getCatalog: (params?: { mission?: string; product_type?: string; download_status?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.mission) query.set('mission', params.mission);
    if (params?.product_type) query.set('product_type', params.product_type);
    if (params?.download_status) query.set('download_status', params.download_status);
    if (params?.limit) query.set('limit', params.limit.toString());
    return fetchJson<{ total: number; datasets: DatasetRecord[] }>(`${API_BASE}/ingest/catalog?${query.toString()}`);
  },

  getCatalogItem: (productId: string) => fetchJson<DatasetRecord>(`${API_BASE}/ingest/catalog/${encodeURIComponent(productId)}`),

  deleteCatalogItem: (productId: string) => fetchJson<{ message: string }>(`${API_BASE}/ingest/catalog/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
  }),

  getCatalogStats: () => fetchJson<CatalogStats>(`${API_BASE}/ingest/stats`),

  seedReferenceSamples: () => fetchJson<{ message: string; stats: CatalogStats }>(`${API_BASE}/ingest/seed-reference-samples`, {
    method: 'POST',
  }),

  // Scientific SAR Processing Engine
  classifyProduct: (filenameOrPath: string, metadataTags?: Record<string, any>) =>
    fetchJson<ClassificationCheck>(`${API_BASE}/processing/classify-product`, {
      method: 'POST',
      body: JSON.stringify({ filename_or_path: filenameOrPath, metadata_tags: metadataTags || {} }),
    }),

  calculateTimeSeriesRate: (payload: {
    epochs: string[];
    displacement_series_mm: number[];
    uncertainties_mm?: number[];
    min_observations?: number;
  }) =>
    fetchJson<TimeSeriesRateResult>(`${API_BASE}/processing/time-series-rate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  runDBSCANClustering: (payload: {
    lons: number[];
    lats: number[];
    velocities_mm_year: number[];
    velocity_threshold_mm_year?: number;
    eps_km?: number;
    min_samples?: number;
  }) =>
    fetchJson<DBSCANResult>(`${API_BASE}/processing/spatial-clusters`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  compareMissions: (payload: {
    mission_1_name: string;
    mission_2_name: string;
    sensor_band_1: string;
    sensor_band_2: string;
    orbit_1: string;
    orbit_2: string;
    incidence_1_deg: number;
    incidence_2_deg: number;
    heading_1_deg: number;
    heading_2_deg: number;
    observations_1_mm_year: number[];
    observations_2_mm_year: number[];
    uncertainties_1?: number[];
    uncertainties_2?: number[];
    align_reference_frames?: boolean;
  }) =>
    fetchJson<MissionComparisonResult>(`${API_BASE}/processing/compare-missions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getDisplacementBenchmarks: () =>
    fetchJson<BenchmarkDisplacementData>(`${API_BASE}/processing/benchmark-displacement`),

  // Multi-Mission Validation & Comparison Engine
  alignSpatial: (payload: {
    bbox_1: number[];
    bbox_2: number[];
    crs_1?: string;
    crs_2?: string;
    resolution_1_m?: [number, number];
    resolution_2_m?: [number, number];
  }) =>
    fetchJson<SpatialAlignmentInfo>(`${API_BASE}/validation-engine/align-spatial`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  alignTemporal: (payload: {
    epochs_1: string[];
    epochs_2: string[];
    max_pairwise_separation_days?: number;
  }) =>
    fetchJson<TemporalAlignmentInfo>(`${API_BASE}/validation-engine/align-temporal`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  evaluateValidationStatistics: (payload: {
    observations_1: number[];
    observations_2: number[];
    uncertainties_1?: number[];
    uncertainties_2?: number[];
    temporal_separation_days?: number;
    look_vector_divergence_deg?: number;
    spatial_overlap_pct?: number;
    has_independent_ground_truth?: boolean;
  }) =>
    fetchJson<ValidationStatsInfo>(`${API_BASE}/validation-engine/evaluate-statistics`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getGNSSStations: () =>
    fetchJson<{ count: number; stations: GNSSStationInfo[] }>(`${API_BASE}/validation-engine/gnss-stations`),

  validateAgainstGNSS: (payload: {
    station_id: string;
    sar_velocity_los_mm_year: number;
    sar_uncertainty_mm_year: number;
    incidence_angle_deg: number;
    heading_angle_deg: number;
  }) =>
    fetchJson<GNSSValidationInfo>(`${API_BASE}/validation-engine/validate-gnss`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateValidationReport: (payload: {
    report_title: string;
    mission_1: string;
    mission_2: string;
    product_type_1: string;
    product_type_2: string;
    time_span_1: string;
    time_span_2: string;
    study_area: string;
    spatial_overlap_km2: number;
    overlap_pct: number;
    temporal_sep_days: number;
    look_vector_divergence_deg: number;
    stats_payload: Record<string, any>;
    has_gnss?: boolean;
    gnss_station_id?: string;
  }) =>
    fetchJson<ResearchReportInfo>(`${API_BASE}/validation-engine/generate-report`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Telemetry & Job Management
  getPlatformOverview: () => fetchJson<{
    timestamp_utc: string;
    registered_datasets: number;
    supported_missions_count: number;
    supported_missions: string[];
    processed_datasets: number;
    validation_experiments_count: number;
    ground_coverage_km2: number;
    catalog_size_mb: number;
    missions_breakdown: Record<string, number>;
    product_types_breakdown: Record<string, number>;
    jobs_by_status: Record<string, number>;
    active_jobs_count: number;
    recent_activity: Array<{
      id: string;
      timestamp: string;
      category: string;
      source: string;
      title: string;
      status: string;
      detail: string;
    }>;
  }>(`${API_BASE}/overview`),

  listJobs: (status?: string, limit?: number) => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (limit) q.set('limit', limit.toString());
    return fetchJson<Array<{
      job_id: string;
      name: string;
      workflow_type: string;
      status: string;
      current_stage: string;
      percent_complete: number;
      elapsed_time_seconds: number;
      started_at: string | null;
      completed_at: string | null;
      parameters: Record<string, any>;
      results_summary?: Record<string, any>;
      error_message?: string;
      logs: Array<{ timestamp: string; level: string; message: string }>;
    }>>(`${API_BASE}/jobs?${q.toString()}`);
  },

  submitJob: (payload: { name: string; workflow_type: string; parameters: Record<string, any> }) =>
    fetchJson<{
      job_id: string;
      name: string;
      workflow_type: string;
      status: string;
      current_stage: string;
      percent_complete: number;
      elapsed_time_seconds: number;
      started_at: string;
      completed_at: string | null;
      parameters: Record<string, any>;
      results_summary?: Record<string, any>;
      error_message?: string;
      logs: Array<{ timestamp: string; level: string; message: string }>;
    }>(`${API_BASE}/jobs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getJobStatus: (jobId: string) => fetchJson<{
    job_id: string;
    name: string;
    workflow_type: string;
    status: string;
    current_stage: string;
    percent_complete: number;
    elapsed_time_seconds: number;
    started_at: string | null;
    completed_at: string | null;
    parameters: Record<string, any>;
    results_summary?: Record<string, any>;
    error_message?: string;
    logs: Array<{ timestamp: string; level: string; message: string }>;
  }>(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`),

  cancelJob: (jobId: string) => fetchJson<{ job_id: string; status: string; message: string }>(`${API_BASE}/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  }),

  deleteJob: (jobId: string) => fetchJson<{ job_id: string; status: string }>(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  }),
};

