import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Activity,
  Compass,
  Database,
  Cpu,
  Layers,
  Sliders,
  MapPin,
  FileText,
  Settings,
  Search,
  Wifi,
  WifiOff,
  Menu,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { CommandPalette } from './CommandPalette';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [utcTime, setUtcTime] = useState<string>('');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [runningJobCount, setRunningJobCount] = useState<number>(0);
  const [activeStudyArea, setActiveStudyArea] = useState<string>('chennai');
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // UTC clock (seconds precision, tabular)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    };
    updateTime();
    const clockTimer = setInterval(updateTime, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Backend telemetry & jobs
  const fetchTelemetry = async () => {
    try {
      const health = await api.getHealth();
      setBackendOnline(health.status === 'healthy');
      const overview = await api.getPlatformOverview();
      setRunningJobCount(overview.active_jobs_count || 0);
    } catch {
      setBackendOnline(false);
      setRunningJobCount(0);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for Command Palette (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Navigation Items
  const navItems = [
    { name: 'Overview', path: '/', icon: Activity, status: 'idle' },
    { name: 'Global Explorer', path: '/global-explorer', icon: Compass, status: 'idle' },
    { name: 'Dataset Explorer', path: '/datasets', icon: Database, status: 'idle' },
    { 
      name: 'SAR Processing', 
      path: '/processing', 
      icon: Cpu, 
      status: runningJobCount > 0 ? 'running' : 'idle' 
    },
    { name: 'Mission Comparison', path: '/mission-comparison', icon: Layers, status: 'idle' },
    { name: 'Validation Laboratory', path: '/validation-lab', icon: Sliders, status: 'idle' },
    { name: 'Deformation Analysis', path: '/deformation', icon: MapPin, status: 'idle' },
    { name: 'Research Reports', path: '/reports', icon: FileText, status: 'idle' },
    { name: 'Settings', path: '/settings', icon: Settings, status: 'idle' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* 1. Thin Top Status Bar */}
      <header
        role="banner"
        style={{
          height: '36px',
          backgroundColor: 'var(--bg-surface-1)',
          borderBottom: '1px solid var(--border-hairline)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          fontSize: '11px',
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            className="mobile-only-btn btn-instrument"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label="Toggle menu"
            style={{ display: 'none', padding: '2px 4px' }}
          >
            {mobileMenuOpen ? <X size={14} /> : <Menu size={14} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-cyan)' }}>
              GROUNDSHIFT
            </span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: 'var(--text-secondary)' }}>Instrument Station</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Study Area:</span>
            <button
              onClick={() => {
                const nextArea = activeStudyArea === 'chennai' ? 'cauvery_delta' : 'chennai';
                setActiveStudyArea(nextArea);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-bright)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                padding: 0,
              }}
            >
              {activeStudyArea === 'chennai' ? 'Chennai Coastal Basin (IND-TN-CHE)' : 'Cauvery Delta Subsidence (IND-TN-CAU)'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Quick command palette trigger */}
          <button
            onClick={() => setIsCommandOpen(true)}
            className="btn-instrument"
            style={{ padding: '2px 8px', fontSize: '10.5px' }}
            title="Open Command Palette (Ctrl+K / ⌘K)"
          >
            <Search size={12} color="var(--accent-cyan)" />
            <span>Search</span>
            <kbd className="badge-mono" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>⌘K</kbd>
          </button>

          {/* Running Jobs Telemetry */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={`status-dot ${runningJobCount > 0 ? 'running' : 'idle'}`} />
            <span style={{ color: 'var(--text-muted)' }}>Active Jobs:</span>
            <span className="num-tabular" style={{ color: runningJobCount > 0 ? 'var(--accent-cyan)' : 'var(--text-main)', fontWeight: 600 }}>
              {runningJobCount}
            </span>
          </div>

          {/* UTC Clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>UTC:</span>
            <span className="num-tabular" style={{ color: 'var(--text-bright)' }}>
              {utcTime || '---'}
            </span>
          </div>

          {/* Backend Connection State */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {backendOnline ? (
              <>
                <Wifi size={12} color="var(--accent-cyan)" aria-label="Backend Connected" />
                <span style={{ color: 'var(--text-secondary)' }}>ONLINE</span>
              </>
            ) : backendOnline === false ? (
              <>
                <WifiOff size={12} color="var(--accent-red)" aria-label="Backend Unreachable" />
                <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>DISCONNECTED</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>CONNECTING</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* 2. Persistent Left Rail */}
        <aside
          role="navigation"
          aria-label="Instrument Navigation"
          className="left-rail"
          style={{
            width: railCollapsed ? '52px' : '204px',
            backgroundColor: 'var(--bg-surface-1)',
            borderRight: '1px solid var(--border-hairline)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '8px 0',
            transition: 'width var(--trans-smooth)',
            flexShrink: 0,
            zIndex: 90,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={item.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: railCollapsed ? 'center' : 'space-between',
                    padding: '8px 12px',
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'var(--bg-surface-2)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                    textDecoration: 'none',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all var(--trans-instant)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-main)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <Icon size={15} color={isActive ? 'var(--accent-cyan)' : 'currentColor'} />
                    {!railCollapsed && <span>{item.name}</span>}
                  </div>

                  {!railCollapsed && (
                    <span
                      className={`status-dot ${item.status}`}
                      title={`Status: ${item.status}`}
                    />
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Rail Collapse Toggle */}
          <div style={{ padding: '0 8px', borderTop: '1px solid var(--border-hairline)', paddingTop: '8px' }}>
            <button
              onClick={() => setRailCollapsed(prev => !prev)}
              className="btn-instrument"
              style={{ width: '100%', justifyContent: 'center', fontSize: '10px' }}
              title={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {railCollapsed ? '→' : '← Collapse'}
            </button>
          </div>
        </aside>

        {/* 3. Main Workspace Area */}
        <main
          role="main"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            height: 'calc(100vh - 36px)',
            minHeight: 0,
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </main>
      </div>

      {/* 4. Responsive Bottom Navigation for Mobile (< 768px) */}
      <nav
        className="bottom-nav-mobile"
        aria-label="Mobile Navigation"
        style={{
          display: 'none',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '48px',
          backgroundColor: 'var(--bg-surface-1)',
          borderTop: '1px solid var(--border-hairline)',
          zIndex: 100,
          justifyContent: 'space-around',
          alignItems: 'center',
        }}
      >
        {navItems.slice(0, 5).map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: '9.5px',
              }}
            >
              <Icon size={16} />
              <span>{item.name.split(' ')[0]}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        activeStudyArea={activeStudyArea}
        onSelectStudyArea={setActiveStudyArea}
      />
    </div>
  );
};

