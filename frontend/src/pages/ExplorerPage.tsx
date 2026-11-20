import React, { useState, useEffect } from 'react';
import { MapContainer, Rectangle, Popup } from 'react-leaflet';
import { DarkBasemap } from '../components/DarkBasemap';
import { 
  Search, 
  Database, 
  FileUp, 
  DownloadCloud, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  Info, 
  Trash2, 
  ExternalLink,
  Satellite,
  Compass,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { DatasetRecord, CatalogStats, InspectionResult } from '../types';

// Mission Color Palette
const MISSION_COLORS: Record<string, string> = {
  'NISAR L-band': '#f97316', // Orange
  'NISAR S-band': '#fb923c', // Amber-Orange
  'Sentinel-1': '#38bdf8',   // Sky Cyan
  'SAOCOM': '#a855f7',       // Purple
  'RADARSAT-1': '#10b981',   // Emerald
  'RADARSAT Constellation Mission': '#34d399', // Mint
  'UAVSAR': '#eab308',       // Yellow
};

export const ExplorerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'discovery' | 'catalog' | 'inspector'>('discovery');
  
  // Catalog metrics
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Discovery Filters
  const [minLon, setMinLon] = useState<number>(79.8);
  const [minLat, setMinLat] = useState<number>(12.6);
  const [maxLon, setMaxLon] = useState<number>(80.6);
  const [maxLat, setMaxLat] = useState<number>(13.5);
  const [selectedMission, setSelectedMission] = useState<string>('ALL');
  const [selectedProductType, setSelectedProductType] = useState<string>('ALL');
  const [selectedPolarization, setSelectedPolarization] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Search state
  const [searchResults, setSearchResults] = useState<DatasetRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Catalog state
  const [catalogItems, setCatalogItems] = useState<DatasetRecord[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogMissionFilter, setCatalogMissionFilter] = useState<string>('ALL');

  // Inspector state
  const [inspectPath, setInspectPath] = useState<string>('');
  const [inspectResult, setInspectResult] = useState<InspectionResult | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Modal / Detail view
  const [activeDetailDataset, setActiveDetailDataset] = useState<DatasetRecord | null>(null);
  const [showProvenanceModal, setShowProvenanceModal] = useState(false);

  // Load stats and catalog on mount
  useEffect(() => {
    loadStats();
    loadCatalog();
    handleSearch();
  }, []);

  const loadStats = async () => {
    try {
      setLoadingStats(true);
      const res = await api.getCatalogStats();
      setStats(res);
    } catch (err: any) {
      console.error('Failed to load stats', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadCatalog = async () => {
    try {
      setLoadingCatalog(true);
      const params = catalogMissionFilter !== 'ALL' ? { mission: catalogMissionFilter } : undefined;
      const res = await api.getCatalog(params);
      setCatalogItems(res.datasets);
    } catch (err: any) {
      console.error('Failed to load catalog', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setSearchError(null);
    setLiveError(null);
    try {
      const res = await api.searchDatasets({
        min_lon: minLon,
        min_lat: minLat,
        max_lon: maxLon,
        max_lat: maxLat,
        mission: selectedMission !== 'ALL' ? selectedMission : undefined,
        product_type: selectedProductType !== 'ALL' ? selectedProductType : undefined,
        polarization: selectedPolarization !== 'ALL' ? selectedPolarization : undefined,
        processing_level: selectedLevel !== 'ALL' ? selectedLevel : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 40
      });
      setSearchResults(res.results);
      if (res.live_error) {
        setLiveError(res.live_error);
      }
    } catch (err: any) {
      setSearchError(err.message || 'Discovery search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleInspect = async () => {
    if (!inspectPath.trim()) return;
    setIsInspecting(true);
    setInspectError(null);
    setInspectResult(null);
    setImportSuccessMessage(null);
    try {
      const res = await api.inspectLocalPath(inspectPath.trim());
      setInspectResult(res);
      if (!res.is_valid) {
        setInspectError(`${res.status}: ${res.error_message}`);
      }
    } catch (err: any) {
      setInspectError(err.message || 'Inspection failed');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleImportInspected = async () => {
    if (!inspectPath.trim()) return;
    try {
      const res = await api.importLocalFile(inspectPath.trim());
      setImportSuccessMessage(`Successfully ingested ${res.dataset.product_id} into catalog.`);
      loadStats();
      loadCatalog();
    } catch (err: any) {
      setInspectError(err.message || 'Import failed');
    }
  };

  const handleRegisterRemote = async (item: DatasetRecord) => {
    try {
      await api.registerRemoteDataset(item);
      loadStats();
      loadCatalog();
      alert(`Registered ${item.product_id} into GROUNDSHIFT catalog.`);
    } catch (err: any) {
      alert(`Registration failed: ${err.message}`);
    }
  };

  const handleDeleteItem = async (productId: string) => {
    if (!confirm(`Delete dataset ${productId} from catalog?`)) return;
    try {
      await api.deleteCatalogItem(productId);
      loadStats();
      loadCatalog();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleSeedSamples = async () => {
    try {
      const res = await api.seedReferenceSamples();
      setStats(res.stats);
      loadCatalog();
      alert(res.message);
    } catch (err: any) {
      alert(`Seeding failed: ${err.message}`);
    }
  };

  // Preset AOIs
  const setChennaiAOI = () => {
    setMinLon(79.8); setMinLat(12.6); setMaxLon(80.6); setMaxLat(13.5);
  };
  const setCauveryAOI = () => {
    setMinLon(79.0); setMinLat(10.3); setMaxLon(80.1); setMaxLat(11.4);
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Multi-Mission SAR Data Ingestion Engine</h1>
            <span style={{ 
              fontSize: '0.75rem', 
              fontFamily: 'var(--font-mono)', 
              background: 'rgba(56, 189, 248, 0.15)', 
              color: 'var(--accent-cyan)', 
              padding: '0.2rem 0.5rem', 
              borderRadius: '4px',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              Product-Aware
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '850px' }}>
            Discover, inspect, and catalogue SAR assets from NASA-ISRO NISAR (L & S band), Sentinel-1, SAOCOM, RADARSAT, and UAVSAR.
            Guarantees memory-safe ingestion, cryptographic lineage, and strict separation between SLC phase, GRD backscatter, and InSAR displacement.
          </p>
        </div>

        <button 
          onClick={handleSeedSamples}
          className="btn btn-secondary"
          style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          title="Seed verified multi-mission datasets for Chennai & Cauvery study areas"
        >
          <RefreshCw size={15} /> Seed Mission Samples
        </button>
      </div>

      {/* Metric Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Catalogued Scenes
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.2rem' }}>
            {stats?.total_datasets ?? 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Tracked in SQLite Catalog
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-indigo)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Storage Footprint
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.2rem' }}>
            {stats ? `${(stats.total_size_mb / 1024).toFixed(2)} GB` : '0 GB'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Managed SAR Products
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-emerald)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Active Missions
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.2rem' }}>
            {stats ? Object.keys(stats.by_mission).length : 7} / 7
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            NISAR (L/S), S1, SAOCOM, RCM, UAVSAR
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-amber)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Memory Safety Bound
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--accent-amber)' }}>
            64 KB Chunks
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Zero Full-Raster RAM Load
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('discovery')}
          className={`nav-btn ${activeTab === 'discovery' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', padding: '0.6rem 1.1rem' }}
        >
          <Search size={16} /> 1. Mission Discovery ({searchResults.length})
        </button>

        <button
          onClick={() => { setActiveTab('catalog'); loadCatalog(); }}
          className={`nav-btn ${activeTab === 'catalog' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', padding: '0.6rem 1.1rem' }}
        >
          <Database size={16} /> 2. Local Catalog Inventory ({catalogItems.length})
        </button>

        <button
          onClick={() => setActiveTab('inspector')}
          className={`nav-btn ${activeTab === 'inspector' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', padding: '0.6rem 1.1rem' }}
        >
          <FileUp size={16} /> 3. Local File Inspector & Importer
        </button>
      </div>

      {/* TAB 1: DISCOVERY */}
      {activeTab === 'discovery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Scientific Compliance Alert */}
          <div style={{ 
            background: 'rgba(234, 179, 8, 0.08)', 
            border: '1px solid rgba(234, 179, 8, 0.3)', 
            borderRadius: '8px', 
            padding: '0.85rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem'
          }}>
            <AlertTriangle size={20} color="#eab308" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: '#fef08a', lineHeight: 1.5 }}>
              <strong>Scientific Rule:</strong> GRD (amplitude), SLC (complex phase), GUNW (unwrapped InSAR phase), and GCOV (geocoded covariance) 
              serve distinct mathematical roles and are <em>never</em> treated as interchangeable. Measured satellite observations are strictly segregated from synthetic test models.
            </div>
          </div>

          {/* Search Controls Panel */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Search size={18} color="var(--accent-cyan)" /> Spatio-Temporal & Multi-Mission Filters
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={setChennaiAOI} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
                  Chennai AOI
                </button>
                <button onClick={setCauveryAOI} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
                  Cauvery Delta AOI
                </button>
              </div>
            </div>

            {/* Filter Grids */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Satellite Mission
                </label>
                <select 
                  value={selectedMission} 
                  onChange={(e) => setSelectedMission(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="ALL">All Missions (7)</option>
                  <option value="NISAR L-band">NISAR L-band (1.25 GHz)</option>
                  <option value="NISAR S-band">NISAR S-band (3.20 GHz)</option>
                  <option value="Sentinel-1">Sentinel-1 (C-band 5.4 GHz)</option>
                  <option value="SAOCOM">SAOCOM 1A/1B (L-band 1.27 GHz)</option>
                  <option value="RADARSAT-1">RADARSAT-1 (C-band 5.3 GHz)</option>
                  <option value="RADARSAT Constellation Mission">RADARSAT Constellation (RCM)</option>
                  <option value="UAVSAR">UAVSAR (L-band Airborne)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Product Type
                </label>
                <select 
                  value={selectedProductType} 
                  onChange={(e) => setSelectedProductType(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="ALL">All Types</option>
                  <option value="SLC">SLC (Single Look Complex)</option>
                  <option value="RSLC">RSLC (NISAR Range-Doppler SLC)</option>
                  <option value="GRD">GRD (Ground Range Detected)</option>
                  <option value="GCOV">GCOV (Geocoded Covariance)</option>
                  <option value="GUNW">GUNW (Geocoded Unwrapped InSAR)</option>
                  <option value="L1A">L1A (SAOCOM Complex)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Polarization
                </label>
                <select 
                  value={selectedPolarization} 
                  onChange={(e) => setSelectedPolarization(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="ALL">All Polarizations</option>
                  <option value="VV">VV (Co-polar)</option>
                  <option value="HH">HH (Co-polar)</option>
                  <option value="VV+VH">VV+VH (Dual-pol)</option>
                  <option value="HH+HV">HH+HV (Dual-pol)</option>
                  <option value="QUAD">QUAD (Full polarimetric)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Processing Level
                </label>
                <select 
                  value={selectedLevel} 
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="ALL">All Levels</option>
                  <option value="L0">Level-0 (Raw)</option>
                  <option value="L1">Level-1 (SLC / GRD)</option>
                  <option value="L2">Level-2 (GCOV / Coherence)</option>
                  <option value="L3">Level-3 (GUNW InSAR Displacement)</option>
                </select>
              </div>
            </div>

            {/* Bounding Box Coordinates */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Min Longitude (&deg;E)</label>
                <input type="number" step="0.05" value={minLon} onChange={(e) => setMinLon(parseFloat(e.target.value))} className="input-field" style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Min Latitude (&deg;N)</label>
                <input type="number" step="0.05" value={minLat} onChange={(e) => setMinLat(parseFloat(e.target.value))} className="input-field" style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Max Longitude (&deg;E)</label>
                <input type="number" step="0.05" value={maxLon} onChange={(e) => setMaxLon(parseFloat(e.target.value))} className="input-field" style={{ width: '100%', padding: '0.45rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Max Latitude (&deg;N)</label>
                <input type="number" step="0.05" value={maxLat} onChange={(e) => setMaxLat(parseFloat(e.target.value))} className="input-field" style={{ width: '100%', padding: '0.45rem' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button 
                  onClick={handleSearch} 
                  disabled={isSearching}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.55rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Search size={16} /> {isSearching ? 'Querying DAACs...' : 'Discover Scenes'}
                </button>
              </div>
            </div>

          </div>

          {/* Interactive Footprints Map */}
          <div className="glass-panel" style={{ padding: '1rem', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Geographic Bounding Box & Scene Footprints ({searchResults.length} matched)</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Center: {((minLat + maxLat) / 2).toFixed(2)}&deg;N, {((minLon + maxLon) / 2).toFixed(2)}&deg;E
              </span>
            </div>
            
            <div style={{ height: '340px', borderRadius: '8px', overflow: 'hidden' }}>
              <MapContainer 
                center={[(minLat + maxLat) / 2, (minLon + maxLon) / 2]} 
                zoom={8} 
                scrollWheelZoom={true} 
                style={{ height: '100%', width: '100%' }}
              >
                <DarkBasemap />

                {/* Search Bounding Box */}
                <Rectangle 
                  bounds={[[minLat, minLon], [maxLat, maxLon]]}
                  pathOptions={{ color: '#38bdf8', weight: 2, fillOpacity: 0.05, dashArray: '4, 4' }}
                >
                  <Popup>Search Region Bounding Box</Popup>
                </Rectangle>

                {/* Product Footprints */}
                {searchResults.map((item, idx) => {
                  const b = item.bbox_min_lon !== undefined ? [
                    [item.bbox_min_lat, item.bbox_min_lon],
                    [item.bbox_max_lat, item.bbox_max_lon]
                  ] : null;
                  if (!b) return null;

                  const color = MISSION_COLORS[item.mission] || '#ffffff';
                  return (
                    <Rectangle
                      key={`${item.product_id}-${idx}`}
                      bounds={b as any}
                      pathOptions={{ color, weight: 1.5, fillOpacity: 0.18 }}
                    >
                      <Popup>
                        <div style={{ fontSize: '0.8rem', color: '#0f172a' }}>
                          <strong>{item.mission}</strong> ({item.product_type})<br />
                          <code>{item.product_id}</code><br />
                          Band: {item.sensor_band} ({item.frequency_ghz} GHz) | Pol: {item.polarization}<br />
                          Acquired: {item.acquisition_date}
                        </div>
                      </Popup>
                    </Rectangle>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          {/* Results Table */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                Discovered Remote SAR Datasets ({searchResults.length})
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.75rem' }}>
                {Object.entries(MISSION_COLORS).map(([mName, mCol]) => (
                  <span key={mName} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: mCol }} />
                    {mName.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>

            {searchError && (
              <div style={{ padding: '0.8rem', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', borderRadius: '6px', marginBottom: '1rem' }}>
                {searchError}
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Mission</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Product ID</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Band / Freq</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Type</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Pol</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Acquired</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Geometry</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Catalogue Source</th>
                    <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((item) => {
                    const mColor = MISSION_COLORS[item.mission] || 'var(--accent-cyan)';
                    return (
                      <tr key={item.product_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '0.65rem 0.5rem' }}>
                          <span style={{ 
                            display: 'inline-block',
                            background: `${mColor}22`,
                            color: mColor,
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            border: `1px solid ${mColor}44`
                          }}>
                            {item.mission}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.product_id}>
                          {item.product_id}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem' }}>
                          <strong>{item.sensor_band}-band</strong> ({item.frequency_ghz} GHz)
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem' }}>
                          <span style={{ 
                            fontFamily: 'var(--font-mono)', 
                            fontWeight: 700, 
                            color: item.product_type === 'SLC' || item.product_type === 'RSLC' ? 'var(--accent-indigo)' : (item.product_type === 'GUNW' ? 'var(--accent-emerald)' : 'var(--text-primary)') 
                          }}>
                            {item.product_type}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)' }}>
                          {item.polarization}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {item.acquisition_date?.split('T')[0]}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.75rem' }}>
                          {item.orbit_direction} ({item.incidence_angle_near ? `${item.incidence_angle_near}°-${item.incidence_angle_far}°` : '—'})
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {item.source_catalogue}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                            <button
                              onClick={() => setActiveDetailDataset(item)}
                              className="btn btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                            >
                              Inspect
                            </button>
                            <button
                              onClick={() => handleRegisterRemote(item)}
                              className="btn btn-primary"
                              style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                              title="Register in local catalog inventory"
                            >
                              + Catalog
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {searchResults.length === 0 && !isSearching && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No datasets matched the selected spatial, mission, or polarimetric criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: LOCAL CATALOG INVENTORY */}
      {activeTab === 'catalog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tracked Catalog Inventory ({catalogItems.length})</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Persistent SQLite repository storing SHA-256 cryptographic hashes, storage provenance, and processing states.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select 
                  value={catalogMissionFilter}
                  onChange={(e) => { setCatalogMissionFilter(e.target.value); }}
                  className="input-field"
                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                >
                  <option value="ALL">All Missions</option>
                  <option value="NISAR L-band">NISAR L-band</option>
                  <option value="NISAR S-band">NISAR S-band</option>
                  <option value="Sentinel-1">Sentinel-1</option>
                  <option value="SAOCOM">SAOCOM</option>
                  <option value="RADARSAT-1">RADARSAT-1</option>
                  <option value="RADARSAT Constellation Mission">RADARSAT Constellation</option>
                  <option value="UAVSAR">UAVSAR</option>
                </select>

                <button onClick={loadCatalog} className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Mission</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Product ID</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Type</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Pol</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Format</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>SHA-256 Hash</th>
                    <th style={{ padding: '0.65rem 0.5rem' }}>Storage</th>
                    <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogItems.map((item) => (
                    <tr key={item.product_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <span style={{ 
                          padding: '0.2rem 0.45rem', 
                          borderRadius: '4px', 
                          fontSize: '0.72rem', 
                          fontWeight: 700,
                          background: item.download_status === 'INGESTED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: item.download_status === 'INGESTED' ? 'var(--accent-emerald)' : 'var(--accent-cyan)'
                        }}>
                          {item.download_status}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>{item.mission}</td>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.product_id}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)' }}>{item.product_type}</td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>{item.polarization}</td>
                      <td style={{ padding: '0.65rem 0.5rem' }}>{item.file_format}</td>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {item.sha256_hash ? `${item.sha256_hash.substring(0, 12)}...` : 'Uncomputed'}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.75rem' }}>
                        {item.file_size_bytes ? `${Math.round(item.file_size_bytes / (1024 * 1024))} MB` : 'Remote Link'}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          <button
                            onClick={() => { setActiveDetailDataset(item); setShowProvenanceModal(true); }}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                            title="Inspect JSON-LD Provenance Manifest"
                          >
                            <FileText size={13} /> Provenance
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.product_id)}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', color: 'var(--accent-rose)' }}
                            title="Remove from Catalog"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {catalogItems.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No datasets registered in catalog yet. Click "Seed Mission Samples" or inspect a local file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

      {/* TAB 3: LOCAL FILE INSPECTOR & IMPORTER */}
      {activeTab === 'inspector' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.3rem' }}>
                Product-Aware Local File & Directory Inspector
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Inspects GeoTIFF, HDF5 (NISAR/UAVSAR), or Sentinel-1 <code>.SAFE</code> packages without loading full pixel matrices into RAM.
                Extracts coordinate reference systems, radar polarizations, and validates format integrity.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                placeholder="Enter absolute path e.g. D:\groundshift\data\raw\S1A_IW_GRDH_...tif or .SAFE directory"
                value={inspectPath}
                onChange={(e) => setInspectPath(e.target.value)}
                className="input-field"
                style={{ flex: 1, minWidth: '320px', padding: '0.65rem 0.85rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
              />
              <button 
                onClick={handleInspect}
                disabled={isInspecting}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
              >
                <Search size={16} /> {isInspecting ? 'Inspecting Headers...' : 'Inspect File'}
              </button>
            </div>

            {inspectError && (
              <div style={{ padding: '0.85rem', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent-rose)', borderRadius: '6px', marginBottom: '1rem', border: '1px solid rgba(244, 63, 94, 0.25)' }}>
                <strong>Inspection Alert:</strong> {inspectError}
              </div>
            )}

            {importSuccessMessage && (
              <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', borderRadius: '6px', marginBottom: '1rem', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                {importSuccessMessage}
              </div>
            )}

            {/* Inspection Results Card */}
            {inspectResult && inspectResult.is_valid && (
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.03)', 
                border: '1px solid rgba(255, 255, 255, 0.1)', 
                borderRadius: '8px', 
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={20} color="var(--accent-emerald)" />
                    <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Valid SAR Product Header Detected</span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      background: 'rgba(56, 189, 248, 0.15)', 
                      color: 'var(--accent-cyan)', 
                      padding: '0.15rem 0.5rem', 
                      borderRadius: '4px' 
                    }}>
                      {inspectResult.format_detected}
                    </span>
                  </div>

                  <button
                    onClick={handleImportInspected}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.5rem 1rem' }}
                  >
                    <Database size={15} /> Catalogue into GROUNDSHIFT
                  </button>
                </div>

                {/* Metadata Properties Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.82rem' }}>
                  <div className="glass-panel" style={{ padding: '0.75rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Satellite Mission</div>
                    <div style={{ fontWeight: 700, marginTop: '0.15rem' }}>{inspectResult.mission}</div>
                  </div>

                  <div className="glass-panel" style={{ padding: '0.75rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Radar Band & Frequency</div>
                    <div style={{ fontWeight: 700, marginTop: '0.15rem' }}>
                      {inspectResult.sensor_band}-band ({inspectResult.frequency_ghz} GHz)
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '0.75rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Product Type</div>
                    <div style={{ fontWeight: 700, marginTop: '0.15rem', color: 'var(--accent-cyan)' }}>
                      {inspectResult.product_type} ({inspectResult.processing_level})
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '0.75rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Polarization</div>
                    <div style={{ fontWeight: 700, marginTop: '0.15rem' }}>{inspectResult.polarization}</div>
                  </div>

                  <div className="glass-panel" style={{ padding: '0.75rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Acquisition Timestamp</div>
                    <div style={{ fontWeight: 700, marginTop: '0.15rem' }}>{inspectResult.acquisition_date}</div>
                  </div>

                  <div className="glass-panel" style={{ padding: '0.75rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>File Size On Disk</div>
                    <div style={{ fontWeight: 700, marginTop: '0.15rem' }}>
                      {(inspectResult.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                </div>

                {/* Cryptographic SHA-256 Provenance Fingerprint */}
                <div style={{ 
                  background: 'rgba(0, 0, 0, 0.35)', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '6px', 
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem'
                }}>
                  <ShieldCheck size={16} color="var(--accent-emerald)" />
                  <span style={{ color: 'var(--text-muted)' }}>SHA-256 Checksum:</span>
                  <code style={{ color: 'var(--accent-emerald)', wordBreak: 'break-all' }}>
                    {inspectResult.sha256_hash}
                  </code>
                </div>

                {/* Bounding Box Extent */}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <strong>Coverage Bounds:</strong> WGS84 [{inspectResult.bbox_min_lon.toFixed(4)}&deg;E, {inspectResult.bbox_min_lat.toFixed(4)}&deg;N] to [{inspectResult.bbox_max_lon.toFixed(4)}&deg;E, {inspectResult.bbox_max_lat.toFixed(4)}&deg;N]
                </div>

              </div>
            )}

          </div>

        </div>
      )}

      {/* DETAIL & PROVENANCE MODAL */}
      {activeDetailDataset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000,
          padding: '1.5rem'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '750px',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  {activeDetailDataset.mission} &bull; {activeDetailDataset.product_type}
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.15rem' }}>
                  {activeDetailDataset.product_id}
                </h3>
              </div>
              <button 
                onClick={() => { setActiveDetailDataset(null); setShowProvenanceModal(false); }}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>

            {/* Metadata Table */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.82rem' }}>
              <div><strong>Radar Frequency:</strong> {activeDetailDataset.sensor_band}-band ({activeDetailDataset.frequency_ghz} GHz)</div>
              <div><strong>Polarization:</strong> {activeDetailDataset.polarization}</div>
              <div><strong>Processing Level:</strong> {activeDetailDataset.processing_level}</div>
              <div><strong>Container Format:</strong> {activeDetailDataset.file_format}</div>
              <div><strong>Acquisition Epoch:</strong> {activeDetailDataset.acquisition_date}</div>
              <div><strong>Orbit Direction:</strong> {activeDetailDataset.orbit_direction || 'Ascending'}</div>
              <div><strong>Incidence Angle:</strong> {activeDetailDataset.incidence_angle_near ? `${activeDetailDataset.incidence_angle_near}° - ${activeDetailDataset.incidence_angle_far}°` : 'Nominal'}</div>
              <div><strong>DAAC Source:</strong> {activeDetailDataset.source_catalogue}</div>
            </div>

            <div style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem', borderRadius: '6px' }}>
              <strong>Access Restriction:</strong> {activeDetailDataset.access_restriction || 'Open Access'}<br />
              <strong>Source URL:</strong> <a href={activeDetailDataset.source_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>{activeDetailDataset.source_url}</a>
            </div>

            {/* Provenance Manifest JSON */}
            {activeDetailDataset.provenance_manifest && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={15} color="var(--accent-emerald)" /> Immutable Cryptographic Provenance Manifest (JSON-LD)
                </div>
                <pre style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  padding: '0.85rem',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: 'var(--accent-emerald)',
                  overflowX: 'auto',
                  maxHeight: '220px'
                }}>
                  {JSON.stringify(activeDetailDataset.provenance_manifest, null, 2)}
                </pre>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                onClick={() => { setActiveDetailDataset(null); setShowProvenanceModal(false); }}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

