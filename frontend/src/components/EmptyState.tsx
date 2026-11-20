import React from 'react';
import { AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  message: string;
  suggestedAction?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  suggestedAction,
  compact = false,
}) => {
  return (
    <div
      role="region"
      aria-label={title}
      className="instrument-panel-inner"
      style={{
        padding: compact ? '1rem 1.25rem' : '2.5rem 2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 2,
          backgroundColor: 'rgba(224, 162, 58, 0.1)',
          border: '1px solid var(--accent-amber)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-amber)',
        }}
      >
        <AlertCircle size={18} aria-hidden="true" />
      </div>

      <div>
        <div
          style={{
            fontWeight: 600,
            fontSize: '13px',
            color: 'var(--text-bright)',
            marginBottom: '4px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '11.5px',
            color: 'var(--text-secondary)',
            maxWidth: '520px',
            lineHeight: 1.5,
          }}
        >
          {message}
        </div>
      </div>

      {suggestedAction && (
        <button
          type="button"
          onClick={suggestedAction.onClick}
          className="btn-instrument primary"
          style={{ marginTop: '0.5rem' }}
        >
          {suggestedAction.label}
        </button>
      )}
    </div>
  );
};

