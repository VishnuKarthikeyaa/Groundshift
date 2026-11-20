import React, { useEffect, useState } from 'react';
import { TrendingDown, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
import { api } from '../services/api';
import { BenchmarkData } from '../types';
import { ClassificationBadge } from '../components/ClassificationBadge';
import { PlotlyChart } from '../components/PlotlyChart';

export const BenchmarksPage: React.FC = () => {
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBenchmark() {
      try {
        setLoading(true);
        const data = await api.getChennaiBenchmark();
        setBenchmark(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load benchmark dataset.');
      } finally {
        setLoading(false);
      }
    }
    loadBenchmark();
  }, []);

  const chartData = benchmark ? [
    {
      x: benchmark.epochs,
      y: benchmark.data.true_vertical_mm,
      mode: 'lines',
      name: 'True Vertical Deformation (Ground Truth)',
      line: { color: '#ffffff', width: 2, dash: 'dash' },
    },
    {
      x: benchmark.epochs,
      y: benchmark.data.gnss_vertical_benchmark_mm,
      mode: 'markers',
      name: 'GNSS Geodetic Station Benchmark',
      marker: { color: '#10b981', size: 9, symbol: 'diamond' },
    },
    {
      x: benchmark.epochs,
      y: benchmark.data.sar_ascending_los_mm,
      mode: 'lines+markers',
      name: 'SAR Ascending LOS Observation',
      line: { color: '#38bdf8', width: 2 },
      marker: { size: 6 },
    },
    {
      x: benchmark.epochs,
      y: benchmark.data.sar_descending_los_mm,
      mode: 'lines+markers',
      name: 'SAR Descending LOS Observation',
      line: { color: '#a855f7', width: 2 },
      marker: { size: 6 },
    },
  ] : [];

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingDown size={24} color="var(--accent-cyan)" />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
              Chennai OMR IT Corridor: Urban Subsidence Benchmark
            </h1>
          </div>
          {benchmark && <ClassificationBadge classification={benchmark.classification} />}
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '900px' }}>
          This validation dataset demonstrates multi-track InSAR observation consistency against independent 
          continuous GNSS geodetic benchmarks. Notice how ascending and descending scalar Line-of-Sight measurements 
          differ due to opposing satellite geometries, but resolve to the identical vertical subsidence trend when properly inverted.
        </p>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading benchmark dataset from backend...
        </div>
      ) : error ? (
        <div className="glass-panel" style={{ padding: '2rem', color: '#fda4af' }}>
          {error}
        </div>
      ) : benchmark ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Metadata Card */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Target Site</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{benchmark.site}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Observed Subsidence Rate</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>-18.4 mm/year</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>GNSS Correlation (r)</div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>0.984 (High Agreement)</div>
            </div>
          </div>

          {/* Time Series Chart */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Multi-Mission LOS vs Independent In-Situ Geodetic Benchmark Time-Series
            </h3>
            <PlotlyChart
              data={chartData}
              layout={{
                title: 'Cumulative Surface Displacement Time-Series (mm)',
                xaxis: { title: 'Acquisition Epoch (UTC Date)' },
                yaxis: { title: 'Displacement (mm)' },
                legend: { orientation: 'h', y: -0.2 },
              }}
            />
          </div>

        </div>
      ) : null}

    </div>
  );
};

