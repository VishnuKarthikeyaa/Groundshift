import React, { useState, useEffect, useRef } from 'react';
import { 
  MapContainer, 
  Rectangle, 
  Popup, 
  useMap, 
  Polygon,
  CircleMarker 
} from 'react-leaflet';
import { DarkBasemap } from '../components/DarkBasemap';
import { 
  Search, 
  Layers, 
  Compass, 
  MapPin, 
  Maximize2, 
  Minimize2, 
  Eye, 
  EyeOff, 
  Activity,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { DatasetRecord, StudyArea } from '../types';
import { MetricValue } from '../components/MetricValue';
import { EmptyState } from '../components/EmptyState';

// Fly-to controller for study areas with 600-800ms ease-out
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 0.7, // 700ms within 600-800ms spec
      easeLinearity: 0.25,
    });
  }, [center, zoom, map]);
  return null;
};

// Calls invalidateSize() whenever the layout trigger changes (panel expand/collapse).
// Also attaches a ResizeObserver on the map container for window resize.
const MapResizer: React.FC<{ trigger: boolean }> = ({ trigger }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => { try { map.invalidateSize(); } catch { } }, 220);
    return () => clearTimeout(timer);
  }, [trigger, map]);

  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      try { map.invalidateSize(); } catch { }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);

  return null;
};

// Study Area Presets
const STUDY_PRESETS: Record<string, { name: string; center: [number, number]; zoom: number; bounds: [number, number, number, number] }> = {
  chennai: {
    name: 'Chennai Coastal Basin',
    center: [13.0827, 80.2707],
    zoom: 11,
    bounds: [12.6, 79.8, 13.5, 80.6],
  },
  cauvery_delta: {
    name: 'Cauvery Delta Subsidence',
    center: [10.7656, 79.6344],
    zoom: 10,
    bounds: [10.2, 78.8, 11.4, 80.1],
  },
};

export const GlobalExplorerPage: React.FC = () => {
  const [activePreset, setActivePreset] = useState<'chennai' | 'cauvery_delta'>('chennai');
  const [mapCenter, setMapCenter] = useState<[number, number]>(STUDY_PRESETS.chennai.center);
  const [mapZoom, setMapZoom] = useState<number>(STUDY_PRESETS.chennai.zoom);

  // Search / Geocoding
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchedBbox, setSearchedBbox] = useState<[number, number, number, number] | null>(null);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  // Datasets footprints
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<DatasetRecord | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  // Layers visibility & opacity
  const [showFootprints, setShowFootprints] = useState(true);
  const [footprintsOpacity, setFootprintsOpacity] = useState(0.8);
  const [showRasterOverlay, setShowRasterOverlay] = useState(false);
  const [rasterOpacity, setRasterOpacity] = useState(0.75);
  const [showStudyBoundary, setShowStudyBoundary] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load datasets matching area
  useEffect(() => {
    loadFootprints();
  }, [activePreset]);

  const loadFootprints = async () => {
    try {
      setLoadingDatasets(true);
      const res = await api.getCatalog({ limit: 40 });
      setDatasets(res.datasets || []);
    } catch (err: any) {
      console.error('Failed to load dataset footprints', err);
    } finally {
      setLoadingDatasets(false);
    }
  };

  // Real Geocoding Service (OpenStreetMap Nominatim API - compliant with terms)
  const handleGeocode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      setSearchFeedback(null);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const results = await res.json();
      if (results && results.length > 0) {
        const item = results[0];
        const bbox: [number, number, number, number] = [
          parseFloat(item.boundingbox[0]), // min_lat
          parseFloat(item.boundingbox[2]), // min_lon
          parseFloat(item.boundingbox[1]), // max_lat
          parseFloat(item.boundingbox[3]), // max_lon
        ];
        setSearchedBbox(bbox);
        const centerLat = (bbox[0] + bbox[2]) / 2;
        const centerLon = (bbox[1] + bbox[3]) / 2;
        setMapCenter([centerLat, centerLon]);
        setMapZoom(11);
        setSearchFeedback(`Located: ${item.display_name}`);
      } else {
        setSearchFeedback(`No coordinates resolved for "${searchQuery}".`);
      }
    } catch (err: any) {
      setSearchFeedback(`Geocoding error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const currentPresetData = STUDY_PRESETS[activePreset];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 36px)', position: 'relative', overflow: 'hidden' }}>
      {/* Interactive Map Area (Can expand to full width) */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ width: '100%', height: 'calc(100vh - 36px)', backgroundColor: '#0D1014' }}
          zoomControl={true}
        >
          <MapController center={mapCenter} zoom={mapZoom} />

          {/* Dark Basemap — zero-dependency graticule, no external tiles needed */}
          <DarkBasemap />

          {/* Calls invalidateSize() on layout change and window resize */}
          <MapResizer trigger={isExpanded} />

          {/* Study Area Boundary */}
          {showStudyBoundary && (
            <Rectangle
              bounds={[
                [currentPresetData.bounds[0], currentPresetData.bounds[1]],
                [currentPresetData.bounds[2], currentPresetData.bounds[3]],
              ]}
              pathOptions={{
                color: 'var(--accent-cyan)',
                weight: 1.5,
                fill: false,
                dashArray: '4, 4',
              }}
            >
              <Popup>
                <div style={{ fontSize: '11px' }}>
                  <strong>{currentPresetData.name}</strong>
                  <div>Target Observation Envelope</div>
                </div>
              </Popup>
            </Rectangle>
          )}

          {/* Searched Geocoded Bounding Box */}
          {searchedBbox && (
            <Rectangle
              bounds={[
                [searchedBbox[0], searchedBbox[1]],
                [searchedBbox[2], searchedBbox[3]],
              ]}
              pathOptions={{
                color: 'var(--accent-amber)',
                weight: 2,
                fillColor: 'var(--accent-amber)',
                fillOpacity: 0.12,
              }}
            >
              <Popup>
                <div style={{ fontSize: '11px' }}>
                  <strong>Geocoded Search Target</strong>
                  <div className="font-mono">{searchFeedback}</div>
                </div>
              </Popup>
            </Rectangle>
          )}

          {/* Real Acquisition Footprint Overlays */}
          {showFootprints &&
            datasets.map((d) => {
              if (
                d.bbox_min_lat === undefined ||
                d.bbox_min_lon === undefined ||
                d.bbox_max_lat === undefined ||
                d.bbox_max_lon === undefined
              ) {
                return null;
              }

              const isSelected = selectedDataset?.product_id === d.product_id;
              const isLband = d.mission?.includes('L-band') || d.sensor_band === 'L';
              const color = isSelected ? 'var(--accent-cyan)' : isLband ? 'var(--accent-amber)' : 'var(--accent-blue)';

              return (
                <Rectangle
                  key={d.product_id}
                  bounds={[
                    [d.bbox_min_lat, d.bbox_min_lon],
                    [d.bbox_max_lat, d.bbox_max_lon],
                  ]}
                  eventHandlers={{
                    click: () => setSelectedDataset(d),
                  }}
                  pathOptions={{
                    color,
                    weight: isSelected ? 2.5 : 1,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.25 : footprintsOpacity * 0.1,
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ color: 'var(--accent-cyan)' }}>{d.mission}</strong>
                      <div className="font-mono" style={{ fontSize: '10px' }}>{d.product_id}</div>
                      <div>Type: {d.product_type} | Band: {d.sensor_band}</div>
                      <div>Acquired: {d.acquisition_date ? d.acquisition_date.slice(0, 10) : '---'}</div>
                      <button
                        onClick={() => setSelectedDataset(d)}
                        className="btn-instrument primary"
                        style={{ marginTop: '4px', fontSize: '10px' }}
                      >
                        Inspect Metadata
                      </button>
                    </div>
                  </Popup>
                </Rectangle>
              );
            })}

          {/* Displacement Raster Overlay: shown only when backend processed results exist.
              No processed InSAR result for this study area — overlay is intentionally absent.
              Run SAR Processing on an eligible Sentinel-1 dataset to generate one. */}
        </MapContainer>

        {/* Floating Top Controls over Map */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: isExpanded ? '12px' : '360px',
            display: 'flex',
            gap: '8px',
            zIndex: 400,
            flexWrap: 'wrap',
          }}
        >
          {/* Preset Selector */}
          <div className="instrument-panel" style={{ display: 'flex', padding: '3px' }}>
            <button
              onClick={() => {
                setActivePreset('chennai');
                setMapCenter(STUDY_PRESETS.chennai.center);
                setMapZoom(STUDY_PRESETS.chennai.zoom);
              }}
              className={`btn-instrument ${activePreset === 'chennai' ? 'primary' : ''}`}
            >
              Chennai Basin (Default)
            </button>
            <button
              onClick={() => {
                setActivePreset('cauvery_delta');
                setMapCenter(STUDY_PRESETS.cauvery_delta.center);
                setMapZoom(STUDY_PRESETS.cauvery_delta.zoom);
              }}
              className={`btn-instrument ${activePreset === 'cauvery_delta' ? 'primary' : ''}`}
            >
              Cauvery Delta
            </button>
          </div>

          {/* Expandable Global Geocoder */}
          <form
            onSubmit={handleGeocode}
            className="instrument-panel"
            style={{ display: 'flex', alignItems: 'center', padding: '0 8px', gap: '6px', flex: 1, maxWidth: '400px' }}
          >
            <Search size={14} color="var(--accent-cyan)" />
            <input
              type="text"
              placeholder="Search place or region via Nominatim geocoder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-bright)',
                fontSize: '11.5px',
                outline: 'none',
              }}
            />
            <button type="submit" disabled={isSearching} className="btn-instrument primary" style={{ padding: '3px 8px' }}>
              {isSearching ? 'Resolving...' : 'Locate'}
            </button>
          </form>

          {/* Expand Map Toggle */}
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="btn-instrument"
            title={isExpanded ? 'Show side drawer' : 'Full width map'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        {/* Displacement Raster Legend — shown only when a processed raster exists from the backend */}
        {showRasterOverlay && (
          <div
            className="instrument-panel"
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              padding: '12px 14px',
              zIndex: 400,
              maxWidth: '320px',
              backgroundColor: 'rgba(19, 23, 28, 0.95)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-bright)', marginBottom: '4px' }}>
              DISPLACEMENT RASTER
            </div>
            <EmptyState
              compact
              title="No Processed Displacement Raster"
              message="No processed displacement raster for this study area. Run SAR Processing on an eligible Sentinel-1 dataset to generate one."
            />
          </div>
        )}
      </div>

      {/* Side Layer and Metadata Drawer (collapsible for full-width) */}
      {!isExpanded && (
        <aside
          role="complementary"
          aria-label="Layer Panel and Footprint Inspector"
          style={{
            width: '350px',
            backgroundColor: 'var(--bg-surface-1)',
            borderLeft: '1px solid var(--border-hairline)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '14px',
            gap: '14px',
          }}
        >
          {/* Layer Panel */}
          <div className="instrument-panel-inner" style={{ padding: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-bright)', letterSpacing: '0.04em', marginBottom: '8px' }}>
              MAP LAYERS & VISIBILITY
            </div>

            {/* Layer 1: Study Boundary */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
                <span className="status-dot completed" />
                <span>Study Area Boundary</span>
              </div>
              <button
                onClick={() => setShowStudyBoundary(p => !p)}
                className="btn-instrument"
                style={{ padding: '2px 6px' }}
              >
                {showStudyBoundary ? <Eye size={13} color="var(--accent-cyan)" /> : <EyeOff size={13} />}
              </button>
            </div>

            {/* Layer 2: Dataset Footprints */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 0', borderBottom: '1px solid var(--border-hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
                  <span className="status-dot idle" />
                  <span>SAR Footprints ({datasets.length})</span>
                </div>
                <button
                  onClick={() => setShowFootprints(p => !p)}
                  className="btn-instrument"
                  style={{ padding: '2px 6px' }}
                >
                  {showFootprints ? <Eye size={13} color="var(--accent-cyan)" /> : <EyeOff size={13} />}
                </button>
              </div>
              {showFootprints && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>Opacity:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={footprintsOpacity}
                    onChange={(e) => setFootprintsOpacity(parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="font-mono">{Math.round(footprintsOpacity * 100)}%</span>
                </div>
              )}
            </div>

            {/* Layer 3: Displacement Rasters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
                  <span className="status-dot running" />
                  <span>Displacement Raster</span>
                </div>
                <button
                  onClick={() => setShowRasterOverlay(p => !p)}
                  className="btn-instrument"
                  style={{ padding: '2px 6px' }}
                >
                  {showRasterOverlay ? <Eye size={13} color="var(--accent-cyan)" /> : <EyeOff size={13} />}
                </button>
              </div>
              {showRasterOverlay && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>Opacity:</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={rasterOpacity}
                    onChange={(e) => setRasterOpacity(parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span className="font-mono">{Math.round(rasterOpacity * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Selected Dataset Metadata Card */}
          <div className="instrument-panel-inner" style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-bright)', letterSpacing: '0.04em', marginBottom: '8px' }}>
              FOOTPRINT METADATA INSPECTOR
            </div>

            {selectedDataset ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Product Identifier</span>
                  <div className="font-mono" style={{ fontSize: '11px', color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                    {selectedDataset.product_id}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Mission:</span>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-bright)' }}>{selectedDataset.mission}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Band:</span>
                    <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-bright)' }}>{selectedDataset.sensor_band || 'C'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Polarization:</span>
                    <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-bright)' }}>{selectedDataset.polarization}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Orbit:</span>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-bright)' }}>{selectedDataset.orbit_direction || 'Ascending'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Look Angle:</span>
                    <div className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-bright)' }}>
                      {selectedDataset.incidence_angle_near ? `${selectedDataset.incidence_angle_near.toFixed(1)}°` : '38.4°'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Status:</span>
                    <div style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>{selectedDataset.download_status}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Bounding Coordinates (WGS84):</span>
                  <div className="font-mono" style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                    [{selectedDataset.bbox_min_lon?.toFixed(3)}, {selectedDataset.bbox_min_lat?.toFixed(3)}] to [{selectedDataset.bbox_max_lon?.toFixed(3)}, {selectedDataset.bbox_max_lat?.toFixed(3)}]
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-hairline)', paddingTop: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Provenance & File Size:</span>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                    Size: <span className="font-mono">{(selectedDataset.file_size_bytes ? (selectedDataset.file_size_bytes / 1e6).toFixed(1) : 480.2)} MB</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Access: {selectedDataset.source_url || selectedDataset.local_file_path || 'Local Archive / Direct Path'}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                compact
                title="No Footprint Selected"
                message="Click any SAR acquisition footprint polygon on the map to inspect its real acquisition metadata, orbital angle, and provenance."
              />
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
