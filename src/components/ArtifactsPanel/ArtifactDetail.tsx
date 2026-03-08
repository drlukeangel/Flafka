/**
 * @artifact-detail @artifacts-panel
 * ArtifactDetail — Full detail view for a selected Flink artifact.
 *
 * Features:
 * - SQL snippet section: generates CREATE FUNCTION template with version dropdown
 * - Copy and Insert at Cursor buttons for SQL snippet
 * - Metadata rows: Display Name, ID, Entry Class, Environment, Cloud/Region, etc.
 * - Version list
 * - Delete with name-confirm gate
 */

import { useState, useMemo } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { insertTextAtCursor } from '../EditorCell/editorRegistry';
import {
  FiCopy,
  FiCode,
  FiTrash2,
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
} from 'react-icons/fi';

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '\u2014';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

const ArtifactDetail: React.FC = () => {
  const selectedArtifact = useWorkspaceStore((s) => s.selectedArtifact);
  const deleteArtifact = useWorkspaceStore((s) => s.deleteArtifact);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const [selectedVersion, setSelectedVersion] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!selectedArtifact) return null;

  const isPlatformExample = selectedArtifact.display_name?.startsWith('platform-examples-');
  const versions = selectedArtifact.versions || [];
  const currentVersion = versions[selectedVersion] || versions[0];

  const sqlSnippet = useMemo(() => {
    const cls = selectedArtifact.class;
    const resolvedClass = (!cls || cls === '' || cls === 'default') ? '<entry-class>' : cls;
    const versionId = currentVersion?.version || '<version-id>';
    return `CREATE FUNCTION <function_name>\n  AS '${resolvedClass}'\n  USING JAR 'confluent-artifact://${selectedArtifact.id}/${versionId}';`;
  }, [selectedArtifact, currentVersion]);

  const handleCopy = async (text: string, field: string) => {
    await copyToClipboard(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleInsertAtCursor = () => {
    const ok = insertTextAtCursor(sqlSnippet);
    if (ok) {
      addToast({ type: 'success', message: 'Inserted SQL at cursor' });
    } else {
      addToast({ type: 'warning', message: 'No focused editor — click into an editor cell first' });
    }
  };

  const handleDelete = async () => {
    await deleteArtifact(selectedArtifact.id);
    setShowDelete(false);
    setDeleteConfirmName('');
  };

  const metadataRows: Array<{ label: string; value: string; copyable?: boolean; mono?: boolean; badge?: boolean }> = [
    { label: 'Display Name', value: selectedArtifact.display_name },
    { label: 'ID', value: selectedArtifact.id, copyable: true, mono: true },
    { label: 'Entry Class', value: selectedArtifact.class, copyable: true, mono: true },
    { label: 'Environment', value: selectedArtifact.environment, mono: true },
    { label: 'Cloud / Region', value: `${selectedArtifact.cloud} / ${selectedArtifact.region}` },
    { label: 'Content Format', value: selectedArtifact.content_format, badge: true },
    { label: 'Runtime Language', value: selectedArtifact.runtime_language || '\u2014', badge: true },
    { label: 'Description', value: selectedArtifact.description || '\u2014' },
    { label: 'Doc Link', value: selectedArtifact.documentation_link || '\u2014' },
    { label: 'Created', value: formatDate(selectedArtifact.metadata?.created_at) },
    { label: 'Updated', value: formatDate(selectedArtifact.metadata?.updated_at) },
  ];

  return (
    <div style={{ padding: '0 0 20px', fontSize: 13 }}>
      {/* ── SQL Snippet Section ── */}
      <div
        style={{
          margin: '12px 12px 0',
          border: '1px solid var(--color-primary)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            background: 'rgba(73,51,215,0.06)',
            borderBottom: '1px solid var(--color-primary)',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-primary)' }}>
            <FiCode size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            SQL
          </span>
          {versions.length > 1 && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(Number(e.target.value))}
                style={{
                  appearance: 'none',
                  background: 'var(--color-input-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 3,
                  padding: '2px 20px 2px 6px',
                  fontSize: 11,
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                }}
                aria-label="Select artifact version"
              >
                {versions.map((v, i) => (
                  <option key={v.version} value={i}>
                    {v.version}
                  </option>
                ))}
              </select>
              <FiChevronDown
                size={11}
                style={{
                  position: 'absolute',
                  right: 5,
                  pointerEvents: 'none',
                  color: 'var(--color-text-secondary)',
                }}
              />
            </div>
          )}
        </div>
        <pre
          style={{
            margin: 0,
            padding: '10px 12px',
            fontSize: 12,
            fontFamily: 'monospace',
            lineHeight: 1.5,
            background: 'var(--color-input-bg)',
            color: 'var(--color-text-primary)',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {sqlSnippet}
        </pre>
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '6px 10px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <button
            onClick={() => handleCopy(sqlSnippet, 'sql')}
            style={{
              border: '1px solid var(--color-border)',
              background: 'var(--color-input-bg)',
              cursor: 'pointer',
              padding: '3px 8px',
              borderRadius: 3,
              fontSize: 11,
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Copy SQL to clipboard"
          >
            {copiedField === 'sql' ? <FiCheck size={12} /> : <FiCopy size={12} />}
            {copiedField === 'sql' ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleInsertAtCursor}
            style={{
              border: '1px solid var(--color-border)',
              background: 'var(--color-input-bg)',
              cursor: 'pointer',
              padding: '3px 8px',
              borderRadius: 3,
              fontSize: 11,
              color: 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Insert SQL at editor cursor"
          >
            <FiCode size={12} />
            Insert at cursor
          </button>
        </div>
      </div>

      {/* ── Metadata Section ── */}
      <div style={{ margin: '16px 12px 0' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Metadata
        </div>
        {metadataRows.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              padding: '5px 0',
              borderBottom: '1px solid var(--color-border)',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 110,
                flexShrink: 0,
                fontSize: 12,
                color: 'var(--color-text-secondary)',
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 12,
                color: 'var(--color-text-primary)',
                fontFamily: row.mono ? 'monospace' : 'inherit',
                wordBreak: 'break-all',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {row.label === 'Doc Link' && row.value !== '\u2014' ? (
                <a
                  href={row.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
                >
                  {row.value}
                </a>
              ) : row.badge && row.value !== '\u2014' ? (
                <span
                  style={{
                    background: 'rgba(73,51,215,0.1)',
                    color: 'var(--color-primary)',
                    borderRadius: 3,
                    padding: '1px 6px',
                    fontSize: 11,
                    fontWeight: 500,
                    fontFamily: 'monospace',
                  }}
                  data-testid={`badge-${row.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {row.value}
                </span>
              ) : (
                row.value
              )}
              {row.copyable && row.value !== '\u2014' && (
                <button
                  onClick={() => handleCopy(row.value, row.label)}
                  title={`Copy ${row.label}`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 2,
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {copiedField === row.label ? (
                    <FiCheck size={12} style={{ color: 'var(--color-success)' }} />
                  ) : (
                    <FiCopy size={12} />
                  )}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* ── Versions Section ── */}
      {versions.length > 0 && (
        <div style={{ margin: '16px 12px 0' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Versions ({versions.length})
          </div>
          {versions.map((v, i) => (
            <div
              key={v.version}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                borderBottom: '1px solid var(--color-border)',
                fontSize: 12,
              }}
            >
              <span
                style={{
                  fontFamily: 'monospace',
                  color:
                    i === selectedVersion
                      ? 'var(--color-primary)'
                      : 'var(--color-text-primary)',
                  fontWeight: i === selectedVersion ? 600 : 400,
                }}
              >
                {v.version}
              </span>
              {v.is_draft && (
                <span
                  style={{
                    background: 'rgba(245,158,11,0.12)',
                    color: 'var(--color-warning)',
                    borderRadius: 3,
                    padding: '1px 5px',
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  draft
                </span>
              )}
              {v.created_at && (
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>
                  {formatDate(v.created_at)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Section ── */}
      <div style={{ margin: '20px 12px 0' }}>
        {isPlatformExample ? (
          <div
            style={{
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-hover)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FiTrash2 size={13} style={{ flexShrink: 0, opacity: 0.4 }} />
            Platform examples are managed by Flafka and cannot be deleted.
          </div>
        ) : (
          <button
            onClick={() => setShowDelete(true)}
            style={{
              border: '1px solid var(--color-error)',
              background: 'transparent',
              color: 'var(--color-error)',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: 4,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              width: '100%',
              justifyContent: 'center',
            }}
          >
            <FiTrash2 size={13} />
            Delete Artifact
          </button>
        )}
      </div>

      {/* ── Delete Confirmation Overlay ── */}
      {showDelete && !isPlatformExample && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => {
            setShowDelete(false);
            setDeleteConfirmName('');
          }}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              borderRadius: 8,
              padding: 20,
              maxWidth: 360,
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
                color: 'var(--color-error)',
              }}
            >
              <FiAlertTriangle size={18} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Delete Artifact</span>
            </div>
            <p
              style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                margin: '0 0 12px',
                lineHeight: 1.5,
              }}
            >
              Deleting this artifact will invalidate all functions that reference it.
              Affected functions will fail at runtime.
            </p>
            <p
              style={{
                fontSize: 12,
                color: 'var(--color-text-primary)',
                margin: '0 0 8px',
              }}
            >
              Type <strong>{selectedArtifact.display_name}</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={selectedArtifact.display_name}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                fontSize: 12,
                background: 'var(--color-input-bg)',
                color: 'var(--color-text-primary)',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
              autoFocus
              aria-label="Confirm artifact name"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDelete(false);
                  setDeleteConfirmName('');
                }}
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-input-bg)',
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmName !== selectedArtifact.display_name}
                style={{
                  border: 'none',
                  background:
                    deleteConfirmName === selectedArtifact.display_name
                      ? 'var(--color-error)'
                      : 'var(--color-border)',
                  color: '#fff',
                  cursor:
                    deleteConfirmName === selectedArtifact.display_name
                      ? 'pointer'
                      : 'not-allowed',
                  padding: '6px 12px',
                  borderRadius: 4,
                  fontSize: 12,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtifactDetail;
