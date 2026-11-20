import React from 'react';

interface MetricValueProps {
  value: number | string | null | undefined;
  unit?: string;
  sampleCount?: number;
  sourceId?: string;
  sourceType?: 'dataset' | 'job' | 'station' | 'model';
  timestamp?: string;
  precision?: number;
  highlight?: boolean;
}

export const MetricValue: React.FC<MetricValueProps> = ({
  value,
  unit,
  sampleCount,
  sourceId,
  sourceType = 'dataset',
  timestamp,
  precision = 2,
  highlight = false,
}) => {
  if (value === null || value === undefined) {
    return <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>;
  }

  const formattedValue =
    typeof value === 'number'
      ? Number.isInteger(value)
        ? value.toLocaleString()
        : value.toFixed(precision)
      : value;

  return (
    <span
      className="metric-readout"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '4px',
        flexWrap: 'wrap',
      }}
    >
      <span
        className="num-tabular"
        style={{
          fontWeight: 600,
          color: highlight ? 'var(--accent-cyan)' : 'var(--text-bright)',
        }}
      >
        {formattedValue}
      </span>

      {unit && (
        <span
          style={{
            fontSize: '10.5px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {unit}
        </span>
      )}

      {sampleCount !== undefined && (
        <span
          title={`Sample size N=${sampleCount}`}
          style={{
            fontSize: '9.5px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'var(--bg-surface-3)',
            padding: '1px 4px',
            borderRadius: 2,
            border: '1px solid var(--border-hairline)',
          }}
        >
          N={sampleCount}
        </span>
      )}

      {sourceId && (
        <span
          title={`Source ${sourceType}: ${sourceId}`}
          style={{
            fontSize: '9.5px',
            color: 'var(--accent-blue)',
            fontFamily: 'var(--font-mono)',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          [{sourceId.length > 14 ? `${sourceId.slice(0, 12)}…` : sourceId}]
        </span>
      )}

      {timestamp && (
        <span
          title={`Acquisition epoch: ${timestamp}`}
          style={{
            fontSize: '9.5px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          @{timestamp.slice(0, 10)}
        </span>
      )}
    </span>
  );
};

