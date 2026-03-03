/**
 * @artifacts-panel
 * ArtifactsPanel — Root container for the Flink Artifacts panel.
 *
 * - Env guard on cloudApiKey: shows warning if not configured
 * - Loads artifacts on mount
 * - Toggles between ArtifactList and ArtifactDetail based on selectedArtifact
 */

import { useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { env } from '../../config/environment';
import { FiArrowLeft, FiRefreshCw, FiLoader, FiAlertCircle } from 'react-icons/fi';
import ArtifactList from './ArtifactList';
import ArtifactDetail from './ArtifactDetail';

const ArtifactsPanel: React.FC = () => {
  const selectedArtifact = useWorkspaceStore((s) => s.selectedArtifact);
  const artifactLoading = useWorkspaceStore((s) => s.artifactLoading);
  const loadArtifacts = useWorkspaceStore((s) => s.loadArtifacts);
  const clearSelectedArtifact = useWorkspaceStore((s) => s.clearSelectedArtifact);
  const setArtifactError = useWorkspaceStore((s) => s.setArtifactError);

  const isConfigured = Boolean(env.cloudApiKey && env.cloudApiSecret);

  useEffect(() => {
    if (isConfigured) {
      loadArtifacts();
    }
  }, [isConfigured, loadArtifacts]);

  // Clear errors on unmount
  useEffect(() => {
    return () => {
      setArtifactError(null);
    };
  }, [setArtifactError]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
      aria-label="Flink Artifacts panel"
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 40,
          padding: '0 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          gap: 8,
        }}
      >
        {selectedArtifact ? (
          <>
            <button
              onClick={clearSelectedArtifact}
              title="Back to artifact list"
              aria-label="Back to artifact list"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text-secondary)',
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              <FiArrowLeft size={16} />
            </button>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
              }}
              title={selectedArtifact.display_name}
            >
              {selectedArtifact.display_name}
            </span>
          </>
        ) : (
          <>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Artifacts
            </span>
            {isConfigured && (
              <button
                onClick={loadArtifacts}
                disabled={artifactLoading}
                title="Refresh artifacts"
                aria-label="Refresh artifacts"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: artifactLoading ? 'default' : 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--color-text-secondary)',
                  borderRadius: 4,
                  opacity: artifactLoading ? 0.5 : 1,
                }}
              >
                {artifactLoading ? (
                  <FiLoader size={14} className="spin" />
                ) : (
                  <FiRefreshCw size={14} />
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Panel body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!isConfigured ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
            }}
          >
            <FiAlertCircle
              size={32}
              style={{ marginBottom: 8, color: 'var(--color-warning)' }}
            />
            <p style={{ fontWeight: 600, margin: '8px 0 4px' }}>
              Cloud API keys not configured
            </p>
            <p style={{ fontSize: 12 }}>
              Set <code>VITE_CLOUD_API_KEY</code> and{' '}
              <code>VITE_CLOUD_API_SECRET</code> in your <code>.env</code> file
              to browse and manage Flink artifacts.
            </p>
          </div>
        ) : selectedArtifact ? (
          <ArtifactDetail />
        ) : (
          <ArtifactList />
        )}
      </div>
    </div>
  );
};

export default ArtifactsPanel;
