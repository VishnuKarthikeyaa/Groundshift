export interface MemoryStats {
  total_physical_mb: number;
  available_physical_mb: number;
  used_physical_mb: number;
  physical_percent_used: number;
  process_rss_mb: number;
  process_vms_mb: number;
  max_threshold_mb: number;
  min_free_threshold_mb: number;
  is_memory_safe: boolean;
}

export interface SystemHealth {
  status: string;
  os: {
    platform: string;
    release: string;
    version: string;
    machine: string;
    processor: string;
  };
  python: {
    version: string;
    executable: string;
  };
  memory: MemoryStats;
}

export interface ScienceEnvironment {
  status: string;
  libraries: Record<string, string>;
  capabilities: Record<string, boolean>;
}

export interface MissionProduct {
  code: string;
  type: string;
  category: string;
}

export interface Mission {
  id: string;
  name: string;
  operator: string;
  bands: string[];
  orbit: string;
  polarizations: string[];
  primary_products: MissionProduct[];
  physics_role: string;
  status: string;
}

export interface StudyArea {
  id: string;
  name: string;
  state: string;
  country: string;
  bounds: {
    min_lon: number;
    min_lat: number;
    max_lon: number;
    max_lat: number;
  };
  center: [number, number];
  utm_epsg: number;
  surface_profile: string;
  target_phenomena: string[];
  validation_anchors: {
    type: string;
    id: string;
    status: string;
  }[];
}

export interface DecompositionResult {
  d_east: number;
  d_up: number;
  sigma_east: number;
  sigma_up: number;
  condition_number: number;
  is_well_conditioned: boolean;
  geometry_coefficients: {
    asc_e: number;
    asc_u: number;
    desc_e: number;
    desc_u: number;
  };
  classification: string;
}

export interface TripletClosureResult {
  raw_sum_rad: number;
  closure_residual_rad: number;
  closure_residual_deg: number;
  mean_coherence: number;
  is_loop_closed: boolean;
  has_cycle_slip: boolean;
  estimated_integer_slip: number;
  quality_status: string;
  classification: string;
}

export interface BenchmarkData {
  site: string;
  epochs: string[];
  classification: string;
  description: string;
  data: {
    sar_ascending_los_mm: number[];
    sar_descending_los_mm: number[];
    gnss_vertical_benchmark_mm: number[];
    true_vertical_mm: number[];
    true_east_mm: number[];
  };
}


export interface DatasetRecord {
  id?: number;
  product_id: string;
  mission: string;
  sensor_band: string;
  frequency_ghz: number;
  product_type: string;
  processing_level: string;
  polarization: string;
  acquisition_date: string;
  orbit_direction?: string;
  incidence_angle_near?: number;
  incidence_angle_far?: number;
  bbox_min_lon: number;
  bbox_min_lat: number;
  bbox_max_lon: number;
  bbox_max_lat: number;
  geojson_geometry?: any;
  file_format: string;
  source_catalogue: string;
  source_url: string;
  access_restriction?: string;
  local_file_path?: string;
  file_size_bytes?: number;
  sha256_hash?: string;
  download_status: string;
  processing_status: string;
  provenance_manifest?: any;
  provenance_tag?: string;
}

export interface CatalogStats {
  total_datasets: number;
  total_size_bytes: number;
  total_size_mb: number;
  by_mission: Record<string, number>;
  by_product_type: Record<string, number>;
  by_status: Record<string, number>;
}

export interface InspectionResult {
  is_valid: boolean;
  status: string;
  error_message?: string;
  format_detected: string;
  mission: string;
  sensor_band: string;
  frequency_ghz?: number;
  product_type: string;
  processing_level: string;
  polarization: string;
  acquisition_date?: string;
  orbit_direction?: string;
  incidence_angle_near?: number;
  incidence_angle_far?: number;
  bbox_min_lon: number;
  bbox_min_lat: number;
  bbox_max_lon: number;
  bbox_max_lat: number;
  geojson_geometry?: any;
  file_size_bytes: number;
  sha256_hash?: string;
  metadata_tags: Record<string, any>;
  integrity_checks: Record<string, any>;
}

export interface ClassificationCheck {
  category: string;
  mission: string;
  sensor_band: string;
  frequency_ghz: number;
  wavelength_m: number;
  is_phase_preserved: boolean;
  is_displacement_ready: boolean;
  supported_workflows: string[];
  rejection_reasons: string[];
}

export interface TimeSeriesRateResult {
  velocity_mm_year: number;
  velocity_std_err_mm_year: number;
  intercept_mm: number;
  rmse_mm: number;
  r_squared: number;
  n_observations: number;
  residuals_mm: number[];
  fitted_values_mm: number[];
  is_statistically_significant: boolean;
  classification: string;
}

export interface DBSCANClusterInfo {
  cluster_id: number;
  point_count: number;
  centroid: [number, number];
  peak_rate_mm_year: number;
  mean_rate_mm_year: number;
  estimated_area_km2: number;
  severity: string;
  boundary_polygon: [number, number][];
}

export interface ClusteredPoint {
  lon: number;
  lat: number;
  velocity: number;
  cluster_id: number;
}

export interface DBSCANResult {
  total_deformation_points: number;
  n_clusters: number;
  clusters: DBSCANClusterInfo[];
  noise_points_count: number;
  clustered_points: ClusteredPoint[];
}

export interface MissionComparisonResult {
  is_valid_comparison: boolean;
  is_geometrically_compatible: boolean;
  los_angular_difference_deg: number;
  geometry_warning: string | null;
  point_count: number;
  datum_offset_removed_mm: number;
  mean_bias_mm: number;
  mae_mm: number;
  rmse_mm: number;
  pearson_r: number;
  r_squared: number;
  p_value: number;
  propagated_uncertainty_mm: number;
  is_statistically_consistent: boolean;
  scientific_verdict: string;
  error?: string;
}

export interface BenchmarkDisplacementSite {
  site_name: string;
  coordinates: [number, number];
  expected_rate_mm_year: number;
  displacement_mm: number[];
  uncertainties_mm: number[];
}

export interface BenchmarkDisplacementData {
  study_area: string;
  classification: string;
  description: string;
  epochs: string[];
  time_series_sites: BenchmarkDisplacementSite[];
  spatial_grid_sample: {
    lons: number[];
    lats: number[];
    velocities_mm_year: number[];
  };
}

export interface SpatialAlignmentInfo {
  is_overlapping: boolean;
  intersection_bbox: {
    min_lon: number;
    min_lat: number;
    max_lon: number;
    max_lat: number;
  };
  intersection_area_km2: number;
  overlap_percentage_dataset_1: number;
  overlap_percentage_dataset_2: number;
  crs_1: string;
  crs_2: string;
  is_crs_compatible: boolean;
  requires_reprojection: boolean;
  native_resolution_1_m: [number, number];
  native_resolution_2_m: [number, number];
  resampling_justification: string | null;
}

export interface TemporalAlignmentInfo {
  is_temporally_compatible: boolean;
  temporal_separation_days: number;
  shared_time_span_days: number;
  dataset_1_span: { start: string; end: string };
  dataset_2_span: { start: string; end: string };
  matched_epoch_count: number;
  temporal_warning: string | null;
}

export interface ValidationStatsInfo {
  valid_count: number;
  mean_difference_bias: number;
  median_difference: number;
  std_difference: number;
  rmse: number;
  mae: number;
  pearson_r: number;
  pearson_p_value: number;
  spearman_rho: number;
  spearman_p_value: number;
  r_squared: number;
  propagated_measurement_sigma: number | null;
  model_scatter_sigma: number;
  missing_uncertainty_flag: boolean;
  confidence_tier: string;
  validation_type: string;
  research_integrity_statement: string;
}

export interface GNSSStationInfo {
  station_id: string;
  station_name: string;
  network: string;
  longitude: number;
  latitude: number;
  elevation_m: number;
  v_east_mm_year: number;
  v_north_mm_year: number;
  v_up_mm_year: number;
  sigma_up_mm_year: number;
  time_span: string;
  citation: string;
}

export interface GNSSValidationInfo {
  station_id: string;
  station_name: string;
  network: string;
  coordinates: [number, number];
  gnss_vertical_rate_mm_year: number;
  gnss_projected_los_mm_year: number;
  gnss_los_uncertainty_mm_year: number;
  sar_observed_los_mm_year: number;
  sar_observed_uncertainty_mm_year: number;
  residual_discrepancy_mm_year: number;
  combined_uncertainty_mm_year: number;
  normalized_chi: number;
  is_consistent_with_gnss: boolean;
  validation_grade: string;
  citation: string;
}

export interface ResearchReportInfo {
  report_title: string;
  format: string;
  markdown_content: string;
}
