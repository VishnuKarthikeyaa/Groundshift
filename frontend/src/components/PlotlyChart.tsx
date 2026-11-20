import React from 'react';
import Plot from 'react-plotly.js';

interface Props {
  data: any[];
  layout?: Record<string, any>;
  config?: Record<string, any>;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

export const PlotlyChart: React.FC<Props> = ({ data, layout = {}, config = {}, style = {}, ariaLabel }) => {
  const defaultLayout = {
    paper_bgcolor: '#13171C',
    plot_bgcolor: '#0D1014',
    font: {
      color: '#94A3B8',
      family: 'IBM Plex Mono, monospace',
      size: 11,
    },
    margin: { l: 45, r: 20, t: 25, b: 45 },
    xaxis: {
      gridcolor: '#252B33',
      zerolinecolor: '#2F3742',
    },
    yaxis: {
      gridcolor: '#252B33',
      zerolinecolor: '#2F3742',
    },
    autosize: true,
    ...layout,
  };

  const defaultConfig = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    ...config,
  };

  return (
    <div 
      role="img"
      aria-label={ariaLabel || 'Scientific Plot'}
      style={{ width: '100%', height: '100%', minHeight: '220px', ...style }}
    >
      <Plot
        data={data}
        layout={defaultLayout}
        config={defaultConfig}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

