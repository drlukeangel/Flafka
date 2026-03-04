/**
 * @artifact-list @artifacts-panel
 * ArtifactList — Searchable list of Flink artifacts with upload button.
 *
 * Features:
 * - Debounced search (300ms)
 * - Keyboard navigation (ArrowUp/Down/Enter)
 * - Each row: FiPackage icon, display_name, region badge, date
 * - Upload button disabled during active upload
 * - Count bar showing total artifacts
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FiPackage, FiSearch, FiUpload, FiLoader, FiAlertCircle } from 'react-icons/fi';
import UploadArtifact from './UploadArtifact';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const ArtifactList: React.FC = () => {
  const artifactList = useWorkspaceStore((s) => s.artifactList ?? []);
  const artifactLoading = useWorkspaceStore((s) => s.artifactLoading);
  const artifactUploading = useWorkspaceStore((s) => s.artifactUploading);
  const artifactError = useWorkspaceStore((s) => s.artifactError);
  const selectArtifact = useWorkspaceStore((s) => s.selectArtifact);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showUpload, setShowUpload] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filtered = debouncedQuery
    ? artifactList.filter(
        (a) =>
          a.display_name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
          a.class.toLowerCase().includes(debouncedQuery.toLowerCase())
      )
    : artifactList;

  // Reset focused index on filter change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [debouncedQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filtered.length) {
        e.preventDefault();
        selectArtifact(filtered[focusedIndex]);
      }
    },
    [filtered, focusedIndex, selectArtifact]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-artifact-item]');
      items[focusedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      onKeyDown={handleKeyDown}
    >
      {/* Search bar */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-input-bg)',
            borderRadius: 4,
            padding: '4px 8px',
            border: '1px solid var(--color-border)',
          }}
        >
          <FiSearch size={13} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 12,
              color: 'var(--color-text-primary)',
              width: '100%',
            }}
            aria-label="Search artifacts"
          />
        </div>
        <button
          onClick={() => setShowUpload(true)}
          disabled={artifactUploading}
          title="Upload new artifact"
          aria-label="Upload new artifact"
          style={{
            border: 'none',
            background: 'var(--color-primary)',
            color: '#fff',
            cursor: artifactUploading ? 'default' : 'pointer',
            padding: '4px 8px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            opacity: artifactUploading ? 0.5 : 1,
          }}
        >
          {artifactUploading ? <FiLoader size={13} className="spin" /> : <FiUpload size={13} />}
          Upload
        </button>
      </div>

      {/* Count bar */}
      <div
        style={{
          padding: '4px 12px',
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {filtered.length} artifact{filtered.length !== 1 ? 's' : ''}
        {debouncedQuery && ` matching "${debouncedQuery}"`}
      </div>

      {/* Error banner */}
      {artifactError && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: 12,
            color: 'var(--color-error)',
            background: 'var(--color-error-badge-bg)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FiAlertCircle size={14} />
          {artifactError}
        </div>
      )}

      {/* List */}
      <div ref={listRef} style={{ flex: 1, overflow: 'auto' }}>
        {artifactLoading && artifactList.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
            }}
          >
            <FiLoader size={20} className="spin" />
            <p style={{ marginTop: 8 }}>Loading artifacts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
            }}
          >
            {debouncedQuery
              ? 'No artifacts match your search.'
              : 'No artifacts found. Upload a JAR or ZIP to get started.'}
          </div>
        ) : (
          filtered.map((artifact, index) => (
            <button
              key={artifact.id}
              data-artifact-item
              onClick={() => selectArtifact(artifact)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                border: 'none',
                background:
                  focusedIndex === index
                    ? 'var(--color-bg-hover)'
                    : 'transparent',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                borderBottom: '1px solid var(--color-border)',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={() => setFocusedIndex(index)}
              aria-label={`Artifact: ${artifact.display_name}`}
            >
              <FiPackage
                size={16}
                style={{ color: 'var(--color-primary)', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {artifact.display_name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 2,
                  }}
                >
                  <span
                    style={{
                      background: 'var(--color-bg-hover)',
                      borderRadius: 3,
                      padding: '1px 5px',
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    {artifact.region}
                  </span>
                  <span>{formatDate(artifact.metadata?.created_at)}</span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Upload modal */}
      {showUpload && <UploadArtifact onClose={() => setShowUpload(false)} />}
    </div>
  );
};

export default ArtifactList;
