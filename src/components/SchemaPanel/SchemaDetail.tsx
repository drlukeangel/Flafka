/**
 * @schema-detail @schema-panel
 * SchemaDetail - Full detail view for a selected schema subject.
 *
 * Read mode:
 *   - Schema type badge + schema ID in header
 *   - Version selector (fetched via getSchemaVersions on mount)
 *   - Compatibility mode (fetched via getCompatibilityMode on mount)
 *   - Code view / Tree view toggle
 *   - Code view: formatted JSON in monospace pre block
 *   - Tree view: SchemaTreeView component (Avro only)
 *   - "Evolve" button → enters edit mode
 *   - "Delete" button → shows confirmation overlay
 *
 * Edit mode (evolve):
 *   - Textarea pre-filled with current schema JSON
 *   - Version selector disabled
 *   - Border accent on editor area
 *   - "Validate" → calls validateCompatibility
 *   - "Save" (disabled until validated) → calls registerSchema
 *   - "Cancel" → restores read mode
 *
 * Delete flow:
 *   - Confirmation overlay with warning text
 *   - On confirm: deleteSubject → clearSelectedSchema + toast success
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';
import type { CompatibilityLevel } from '../../types';
import SchemaTreeView from './SchemaTreeView';
import { SchemaDatasets } from './SchemaDatasets';
import {
  FiRefreshCw,
  FiX,
  FiCheck,
  FiAlertTriangle,
  FiEdit2,
  FiTrash2,
  FiCode,
  FiCopy,
  FiLoader,
  FiChevronDown,
} from 'react-icons/fi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSchemaTypeBadgeStyle(schemaType: string): { background: string; color: string } {
  switch (schemaType) {
    case 'AVRO':
      return { background: 'rgba(73,51,215,0.12)', color: 'var(--color-primary)' };
    case 'PROTOBUF':
      return { background: 'rgba(245,158,11,0.12)', color: 'var(--color-warning)' };
    case 'JSON':
      return { background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' };
    default:
      return { background: 'rgba(156,163,175,0.12)', color: 'var(--color-text-secondary)' };
  }
}

function formatSchemaJson(schema: string): string {
  try {
    return JSON.stringify(JSON.parse(schema), null, 2);
  } catch {
    return schema;
  }
}

/**
 * Item 11: Generate a Flink SQL SELECT statement from AVRO schema fields.
 * Returns null for non-AVRO or invalid schemas.
 */
function generateSelectFromSchema(schema: string, subject: string): string | null {
  try {
    const parsed = JSON.parse(schema) as { type?: string; fields?: Array<{ name: string }> };
    if (parsed.type !== 'record' || !Array.isArray(parsed.fields)) return null;
    const fields = parsed.fields.map((f) => `  \`${f.name}\``).join(',\n');
    // Derive table name from subject (strip -value/-key suffix if present)
    const tableName = subject.replace(/-(value|key)$/, '');
    return `SELECT\n${fields}\nFROM \`${tableName}\`;`;
  } catch {
    return null;
  }
}

const COMPATIBILITY_LABELS: Record<CompatibilityLevel, string> = {
  BACKWARD: 'Backward',
  FORWARD: 'Forward',
  FULL: 'Full',
  NONE: 'None',
  BACKWARD_TRANSITIVE: 'Backward Transitive',
  FORWARD_TRANSITIVE: 'Forward Transitive',
  FULL_TRANSITIVE: 'Full Transitive',
};

// ---------------------------------------------------------------------------
// Small sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        userSelect: 'none' as const,
      }}
    >
      {children}
    </span>
  );
}

interface ViewToggleProps {
  view: 'code' | 'tree';
  onChange: (view: 'code' | 'tree') => void;
  /** Item 3: Tree button disabled for non-Avro schemas */
  treeDisabled?: boolean;
}

function ViewToggle({ view, onChange, treeDisabled }: ViewToggleProps) {
  const base: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid var(--color-border)',
    cursor: 'pointer',
    lineHeight: 1.4,
    transition: `background var(--transition-fast), color var(--transition-fast)`,
  };
  return (
    <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden' }} role="group" aria-label="Schema view mode">
      <button
        style={{
          ...base,
          borderRight: 'none',
          borderRadius: '4px 0 0 4px',
          background: view === 'code' ? 'var(--color-primary)' : 'var(--color-surface)',
          color: view === 'code' ? '#fff' : 'var(--color-text-secondary)',
        }}
        onClick={() => onChange('code')}
        aria-pressed={view === 'code'}
        title="View formatted JSON"
      >
        Code
      </button>
      <button
        style={{
          ...base,
          borderRadius: '0 4px 4px 0',
          background: view === 'tree' ? 'var(--color-primary)' : 'var(--color-surface)',
          color: view === 'tree'
            ? '#fff'
            : treeDisabled
            ? 'var(--color-text-disabled)'
            : 'var(--color-text-secondary)',
          cursor: treeDisabled ? 'not-allowed' : 'pointer',
          opacity: treeDisabled ? 0.6 : 1,
        }}
        onClick={() => onChange('tree')}
        aria-pressed={view === 'tree'}
        aria-disabled={treeDisabled}
        title="View field tree"
      >
        Tree
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation overlay
// ---------------------------------------------------------------------------

interface DeleteConfirmProps {
  subject: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function DeleteConfirm({ subject, onConfirm, onCancel, isLoading }: DeleteConfirmProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  // Feature 1: Typed name confirmation — user must type exact subject name to enable delete
  const [confirmInput, setConfirmInput] = useState('');
  const canDelete = confirmInput === subject;

  // Focus cancel button on mount
  useEffect(() => {
    cancelBtnRef.current?.focus();
  }, []);

  // Escape to cancel
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel, isLoading]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current && !isLoading) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          padding: 24,
          maxWidth: 340,
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <FiAlertTriangle
            size={16}
            style={{ color: 'var(--color-error)', flexShrink: 0 }}
            aria-hidden="true"
          />
          <h3
            id="delete-dialog-title"
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            Delete {subject}?
          </h3>
        </div>

        {/* Warning body */}
        <p
          style={{
            margin: '0 0 10px',
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.55,
          }}
        >
          This will soft-delete all versions of this subject. Schemas remain recoverable via
          the Schema Registry API using a permanent delete.
        </p>
        <p
          style={{
            margin: '0 0 16px',
            fontSize: 13,
            color: 'var(--color-warning)',
            lineHeight: 1.55,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }}
        >
          <FiAlertTriangle size={13} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
          Any Flink SQL tables referencing this schema subject may be affected.
        </p>

        {/* Feature 1: Name confirmation input */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="delete-schema-confirm"
            style={{
              display: 'block',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              marginBottom: 6,
            }}
          >
            Type <strong style={{ fontFamily: 'monospace' }}>{subject}</strong> to confirm:
          </label>
          <input
            id="delete-schema-confirm"
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            disabled={isLoading}
            placeholder={subject}
            aria-label="Type subject name to confirm deletion"
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              background: 'var(--color-surface-secondary)',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              fontFamily: 'monospace',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            ref={cancelBtnRef}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 12,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: canDelete ? 'var(--color-error)' : 'var(--color-border)',
              color: canDelete ? 'var(--color-button-danger-text)' : 'var(--color-text-tertiary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: canDelete && !isLoading ? 'pointer' : 'not-allowed',
              opacity: isLoading ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background var(--transition-fast)',
            }}
            onClick={canDelete ? onConfirm : undefined}
            disabled={!canDelete || isLoading}
            aria-label={isLoading ? 'Deleting subject…' : `Delete ${subject}`}
          >
            {isLoading && (
              <span
                className="spin"
                style={{ width: 12, height: 12, display: 'inline-block' }}
                aria-hidden="true"
              />
            )}
            {isLoading ? 'Deleting…' : `Delete ${subject}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// R2-4: Version delete confirmation overlay
// ---------------------------------------------------------------------------

interface VersionDeleteConfirmProps {
  subject: string;
  version: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function VersionDeleteConfirm({ subject, version, onConfirm, onCancel }: VersionDeleteConfirmProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-version-dialog-title"
    >
      <div
        style={{
          background: 'var(--color-surface)',
          borderRadius: 8,
          padding: 24,
          maxWidth: 340,
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <FiAlertTriangle size={16} style={{ color: 'var(--color-error)', flexShrink: 0 }} aria-hidden="true" />
          <h3
            id="delete-version-dialog-title"
            style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}
          >
            Delete v{version} of "{subject}"?
          </h3>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>
          This will permanently delete version {version}. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            ref={cancelBtnRef}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: 'var(--color-error)',
              color: 'var(--color-button-danger-text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onClick={onConfirm}
            aria-label={`Delete version ${version} of ${subject}`}
          >
            Delete v{version}
          </button>
        </div>
      </div>
    </div>
  );
}

// SchemaDetail — main exported component
// ---------------------------------------------------------------------------

export default function SchemaDetail() {
  const selectedSchemaSubject = useWorkspaceStore((s) => s.selectedSchemaSubject);
  const schemaRegistryLoading = useWorkspaceStore((s) => s.schemaRegistryLoading);
  const addToast = useWorkspaceStore((s) => s.addToast);
  const clearSelectedSchema = useWorkspaceStore((s) => s.clearSelectedSchema);
  const loadSchemaDetail = useWorkspaceStore((s) => s.loadSchemaDetail);
  const navigateToTopic = useWorkspaceStore((s) => s.navigateToTopic);
  const loadSchemaRegistrySubjects = useWorkspaceStore((s) => s.loadSchemaRegistrySubjects);
  const topicList = useWorkspaceStore((s) => s.topicList);
  const loadTopics = useWorkspaceStore((s) => s.loadTopics);
  const schemaInitialView = useWorkspaceStore((s) => s.schemaInitialView);
  const clearSchemaInitialView = useWorkspaceStore((s) => s.clearSchemaInitialView);

  // Top-level mode: schema vs datasets
  const [topMode, setTopMode] = useState<'schema' | 'datasets'>('schema');

  // Read-mode view (within schema mode)
  const [view, setView] = useState<'code' | 'tree'>('code');

  // Consume schemaInitialView on mount (one-shot)
  const initialViewConsumed = useRef(false);
  useEffect(() => {
    if (schemaInitialView && !initialViewConsumed.current) {
      initialViewConsumed.current = true;
      if (schemaInitialView === 'datasets') {
        setTopMode('datasets');
      } else {
        setView(schemaInitialView as 'code' | 'tree');
      }
      clearSchemaInitialView();
    }
  }, [schemaInitialView, clearSchemaInitialView]);

  // Version list
  const [versions, setVersions] = useState<number[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | 'latest'>('latest');

  // Compatibility
  const [compatibility, setCompatibility] = useState<CompatibilityLevel | null>(null);
  const [compatIsGlobal, setCompatIsGlobal] = useState(false); // Item 4: track if inherited from global
  const [compatLoading, setCompatLoading] = useState(false);
  const [compatSaving, setCompatSaving] = useState(false);

  // Edit / evolve mode
  const [isEditing, setIsEditing] = useState(false);
  const [editSchema, setEditSchema] = useState('');
  const [isValidated, setIsValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Item 11: Generate SELECT statement
  const [copiedSelect, setCopiedSelect] = useState(false);

  // Item 12: Per-version delete
  const [deletingVersion, setDeletingVersion] = useState(false);
  // R2-4: Replace window.confirm with proper overlay for version delete
  const [showDeleteVersionConfirm, setShowDeleteVersionConfirm] = useState(false);

  // Item 6: Schema diff — compare two versions
  const [diffMode, setDiffMode] = useState(false);
  const [diffVersion, setDiffVersion] = useState<number | 'latest'>('latest');
  const [diffSchema, setDiffSchema] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  // Phase 12.6 F5: AbortController ref for diff version fetch cancellation
  const diffFetchAbortRef = useRef<AbortController | null>(null);

  // F8: Topic associations state
  const [associatedTopics, setAssociatedTopics] = useState<string[]>([]);
  const [associatedSubjects, setAssociatedSubjects] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const [topicDropdownFocusIdx, setTopicDropdownFocusIdx] = useState(-1);
  const [topicAdding, setTopicAdding] = useState(false);
  const [topicRemoving, setTopicRemoving] = useState<string | null>(null);
  const [topicAddError, setTopicAddError] = useState<string | null>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);

  const subject = selectedSchemaSubject?.subject ?? null;

  // Load versions list whenever subject changes
  useEffect(() => {
    if (!subject) return;
    setVersionsLoading(true);
    setVersions([]);
    schemaRegistryApi
      .getSchemaVersions(subject)
      .then((v) => setVersions(v))
      .catch((err) => console.error('Failed to load versions:', err))
      .finally(() => setVersionsLoading(false));
  }, [subject]);

  // Load compatibility mode whenever subject changes.
  // Item 4: getCompatibilityModeWithSource indicates if the mode is inherited from global config.
  useEffect(() => {
    if (!subject) return;
    setCompatLoading(true);
    setCompatibility(null);
    setCompatIsGlobal(false);
    (async () => {
      try {
        const { level, isGlobal } = await schemaRegistryApi.getCompatibilityModeWithSource(subject);
        setCompatibility(level);
        setCompatIsGlobal(isGlobal);
      } catch (err) {
        console.error('Failed to load compatibility mode:', err);
        // Fallback to plain helper
        try {
          const level = await schemaRegistryApi.getCompatibilityMode(subject);
          setCompatibility(level);
        } catch {
          // ignore
        }
      } finally {
        setCompatLoading(false);
      }
    })();
  }, [subject]);

  // Reset UI state when subject changes
  useEffect(() => {
    setIsEditing(false);
    setIsValidated(false);
    setValidationError(null);
    setView('code');
    setSelectedVersion('latest');
    setShowDeleteConfirm(false);
    setDeleting(false);
    setDiffMode(false);
    setDiffSchema(null);
    setDiffVersion('latest');
    // Phase 12.6 F5: Abort any in-flight diff fetch when subject changes
    diffFetchAbortRef.current?.abort();
    diffFetchAbortRef.current = null;
  }, [subject]);

  // Phase 12.6 F5: Abort in-flight diff fetch on component unmount
  useEffect(() => {
    return () => {
      diffFetchAbortRef.current?.abort();
    };
  }, []);

  // Item 6: Load diff schema when diffVersion changes
  // R2-3: Guard against self-compare — skip if same as selectedVersion
  // Phase 12.6 F5: Uses AbortController to cancel in-flight requests on rapid version changes
  // Phase 12.6 F7: Accepts optional currentPrimary param to avoid stale closure on self-compare guard
  // Declared before handleVersionChange so R2-1 can reference it
  const handleDiffVersionChange = useCallback(async (
    version: number | 'latest',
    currentPrimary?: number | 'latest'
  ) => {
    if (!subject) return;
    // Use explicit currentPrimary if provided (F7 stale closure fix), else fall back to state
    const primaryToCompare = currentPrimary !== undefined ? currentPrimary : selectedVersion;
    // Resolve both versions to numbers for comparison (latest = last in versions array)
    const resolvedDiff = version === 'latest' ? null : version;
    const resolvedSelected = primaryToCompare === 'latest' ? null : primaryToCompare;
    if (resolvedDiff !== null && resolvedSelected !== null && resolvedDiff === resolvedSelected) {
      return; // same version — no-op (R2-3 self-compare guard)
    }
    setDiffVersion(version);
    setDiffLoading(true);
    // Phase 12.6 F5: Cancel any in-flight diff fetch before starting a new one
    diffFetchAbortRef.current?.abort();
    const controller = new AbortController();
    diffFetchAbortRef.current = controller;
    try {
      const detail = await schemaRegistryApi.getSchemaDetail(subject, version, { signal: controller.signal });
      setDiffSchema(formatSchemaJson(detail.schema));
    } catch (err) {
      // F5: Silently ignore abort errors — they are expected on rapid version switching
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        return;
      }
      console.error('Failed to load diff schema:', err);
      setDiffSchema(null);
    } finally {
      setDiffLoading(false);
    }
  }, [subject, selectedVersion]);

  const handleVersionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const raw = e.target.value;
      const version = raw === 'latest' ? 'latest' : parseInt(raw, 10);
      setSelectedVersion(version);
      if (subject) {
        loadSchemaDetail(subject, version);
        // R2-1: Reload diffSchema when primary version changes while diff mode is active
        // Phase 12.6 F7: Fix stale closure — pass new primary version explicitly so the
        // self-compare guard operates on the updated value, not the stale closure.
        if (diffMode) {
          // Check if current diffVersion would self-compare with the NEW primary
          const resolvedNewPrimary = version === 'latest' ? null : version;
          const resolvedCurrentDiff = diffVersion === 'latest' ? null : diffVersion;
          if (resolvedNewPrimary !== null && resolvedCurrentDiff !== null && resolvedNewPrimary === resolvedCurrentDiff) {
            // Self-compare would occur: auto-select a different diff version
            const alternative = versions.find((v) => v !== resolvedNewPrimary);
            if (alternative !== undefined) {
              handleDiffVersionChange(alternative, version);
            } else {
              // No alternative version exists — exit diff mode
              setDiffMode(false);
              setDiffSchema(null);
              setDiffVersion('latest');
            }
          } else {
            handleDiffVersionChange(diffVersion, version);
          }
        }
      }
    },
    [subject, loadSchemaDetail, diffMode, diffVersion, versions, handleDiffVersionChange]
  );

  const handleEvolveClick = useCallback(() => {
    if (!selectedSchemaSubject) return;
    setEditSchema(formatSchemaJson(selectedSchemaSubject.schema));
    setIsValidated(false);
    setValidationError(null);
    setView('code');
    setIsEditing(true);
  }, [selectedSchemaSubject]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setIsValidated(false);
    setValidationError(null);
  }, []);

  const handleValidate = useCallback(async () => {
    if (!selectedSchemaSubject) return;
    setValidating(true);
    setIsValidated(false);
    setValidationError(null);
    try {
      const result = await schemaRegistryApi.validateCompatibility(
        selectedSchemaSubject.subject,
        editSchema,
        selectedSchemaSubject.schemaType
      );
      if (result.is_compatible) {
        setIsValidated(true);
        addToast({ type: 'success', message: 'Schema is compatible', duration: 3000 });
      } else {
        setValidationError('Schema is not compatible with the existing versions.');
        addToast({ type: 'error', message: 'Schema compatibility check failed' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Validation failed';
      setValidationError(msg);
      addToast({ type: 'error', message: `Validation error: ${msg}` });
    } finally {
      setValidating(false);
    }
  }, [selectedSchemaSubject, editSchema, addToast]);

  const handleSave = useCallback(async () => {
    if (!selectedSchemaSubject || !isValidated) return;
    setSaving(true);
    try {
      const result = await schemaRegistryApi.registerSchema(
        selectedSchemaSubject.subject,
        editSchema,
        selectedSchemaSubject.schemaType
      );
      addToast({
        type: 'success',
        message: `New version registered — ID: ${result.id}`,
        duration: 4000,
      });
      setIsEditing(false);
      setIsValidated(false);
      // Reload detail to show the new version
      await loadSchemaDetail(selectedSchemaSubject.subject, 'latest');
      // Refresh version list
      const v = await schemaRegistryApi.getSchemaVersions(selectedSchemaSubject.subject);
      setVersions(v);
      setSelectedVersion('latest');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register schema';
      addToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  }, [selectedSchemaSubject, editSchema, isValidated, addToast, loadSchemaDetail]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedSchemaSubject) return;
    setDeleting(true);
    try {
      await schemaRegistryApi.deleteSubject(selectedSchemaSubject.subject);
      // Also delete all datasets associated with this schema subject
      const { schemaDatasets, deleteSchemaDataset } = useWorkspaceStore.getState();
      schemaDatasets
        .filter((ds) => ds.schemaSubject === selectedSchemaSubject.subject)
        .forEach((ds) => deleteSchemaDataset(ds.id));
      addToast({
        type: 'success',
        message: `"${selectedSchemaSubject.subject}" and its datasets deleted`,
        duration: 4000,
      });
      clearSelectedSchema();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete subject';
      addToast({ type: 'error', message: msg });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [selectedSchemaSubject, addToast, clearSelectedSchema]);

  const handleCompatibilityChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!subject) return;
      const newLevel = e.target.value as CompatibilityLevel;
      setCompatSaving(true);
      try {
        await schemaRegistryApi.setCompatibilityMode(subject, newLevel);
        setCompatibility(newLevel);
        addToast({ type: 'success', message: `Compatibility set to ${COMPATIBILITY_LABELS[newLevel]}`, duration: 3000 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update compatibility';
        addToast({ type: 'error', message: msg });
      } finally {
        setCompatSaving(false);
      }
    },
    [subject, addToast]
  );

  const handleRefresh = useCallback(() => {
    if (!subject) return;
    loadSchemaDetail(subject, selectedVersion);
  }, [subject, selectedVersion, loadSchemaDetail]);

  // Item 11: Generate and copy SELECT statement
  const handleGenerateSelect = useCallback(async () => {
    if (!selectedSchemaSubject) return;
    const sql = generateSelectFromSchema(selectedSchemaSubject.schema, selectedSchemaSubject.subject);
    if (!sql) return;
    try {
      await navigator.clipboard.writeText(sql);
      setCopiedSelect(true);
      setTimeout(() => setCopiedSelect(false), 2000);
      addToast({ type: 'success', message: 'SELECT statement copied to clipboard', duration: 3000 });
    } catch {
      // silently fail
    }
  }, [selectedSchemaSubject, addToast]);

  const handleToggleDiff = useCallback(() => {
    if (!diffMode && versions.length > 0) {
      // Default to the previous version for diff
      const prevVersion = versions.length >= 2 ? versions[versions.length - 2] : versions[0];
      handleDiffVersionChange(prevVersion);
    }
    setDiffMode((v) => !v);
  }, [diffMode, versions, handleDiffVersionChange]);

  // Item 12 + R2-4: Delete a specific schema version — uses overlay instead of window.confirm
  // Phase 12.6 F9: Auto-exit diff mode when deletion reduces subject to fewer than 2 versions
  const handleDeleteVersion = useCallback(async () => {
    if (!subject || selectedVersion === 'latest') return;
    setShowDeleteVersionConfirm(false);
    setDeletingVersion(true);
    try {
      await schemaRegistryApi.deleteSchemaVersion(subject, selectedVersion as number);
      addToast({ type: 'success', message: `Version ${selectedVersion} deleted` });
      // Reload versions and jump to latest
      const updatedVersions = await schemaRegistryApi.getSchemaVersions(subject);
      setVersions(updatedVersions);
      setSelectedVersion('latest');
      // F9: If fewer than 2 versions remain, diff mode is no longer possible — exit it
      if (diffMode && updatedVersions.length < 2) {
        setDiffMode(false);
        setDiffSchema(null);
        setDiffVersion('latest');
      }
      await loadSchemaDetail(subject, 'latest');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete version';
      addToast({ type: 'error', message: msg });
    } finally {
      setDeletingVersion(false);
    }
  }, [subject, selectedVersion, diffMode, addToast, loadSchemaDetail]);

  // -------------------------------------------------------------------------
  // F8: Topic associations — load, add, remove
  // -------------------------------------------------------------------------

  const loadAssociatedTopics = useCallback(async (signal?: AbortSignal) => {
    if (!selectedSchemaSubject?.id) return;
    setTopicsLoading(true);
    try {
      const subjects = await schemaRegistryApi.getSubjectsForSchemaId(
        selectedSchemaSubject.id, { signal }
      );
      if (signal?.aborted) return;
      const relevantSubjects = subjects.filter((s) => /-(value|key)$/.test(s));
      const topics = relevantSubjects
        .map((s) => s.replace(/-(value|key)$/, ''))
        .filter((v) => v.length > 0)
        .filter((v, i, a) => a.indexOf(v) === i);
      setAssociatedSubjects(relevantSubjects);
      setAssociatedTopics(topics);
    } catch {
      if (signal?.aborted) return;
      setAssociatedTopics([]);
      setAssociatedSubjects([]);
    } finally {
      if (!signal?.aborted) setTopicsLoading(false);
    }
  }, [selectedSchemaSubject?.id]);

  useEffect(() => {
    const controller = new AbortController();
    loadAssociatedTopics(controller.signal);
    return () => controller.abort();
  }, [loadAssociatedTopics]);

  const topicSearchResults = topicSearch.trim()
    ? topicList
        .map((t) => t.topic_name)
        .filter((name) =>
          name.toLowerCase().includes(topicSearch.toLowerCase()) &&
          !associatedTopics.includes(name)
        ).slice(0, 20)
    : [];

  const handleSearchFocus = useCallback(() => {
    if (topicList.length === 0) loadTopics();
  }, [topicList.length, loadTopics]);

  const handleAddTopic = useCallback(async (topicName: string) => {
    if (!selectedSchemaSubject) return;
    setTopicAdding(true);
    setTopicAddError(null);
    setTopicDropdownFocusIdx(-1);
    try {
      await schemaRegistryApi.registerSchema(
        `${topicName}-value`,
        selectedSchemaSubject.schema,
        selectedSchemaSubject.schemaType ?? 'AVRO'
      );
      addToast({ type: 'success', message: `Associated with ${topicName}` });
      setTopicSearch('');
      await loadAssociatedTopics();
      await loadSchemaRegistrySubjects();
    } catch (err) {
      setTopicAddError(err instanceof Error ? err.message : 'Failed to associate');
    } finally {
      setTopicAdding(false);
    }
  }, [selectedSchemaSubject, addToast, loadAssociatedTopics, loadSchemaRegistrySubjects]);

  const handleRemoveTopic = useCallback(async (topicName: string) => {
    const subjectsToDelete = associatedSubjects.filter(
      (s) => s === `${topicName}-value` || s === `${topicName}-key`
    );
    setTopicRemoving(topicName);
    try {
      await Promise.all(subjectsToDelete.map((s) => schemaRegistryApi.deleteSubject(s)));
      const deletedList = subjectsToDelete.join(', ');
      addToast({ type: 'success', message: `Removed: ${deletedList}` });
      await loadAssociatedTopics();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to remove' });
    } finally {
      setTopicRemoving(null);
    }
  }, [associatedSubjects, addToast, loadAssociatedTopics]);

  const handleTopicSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (topicSearchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setTopicDropdownFocusIdx((i) => Math.min(i + 1, topicSearchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTopicDropdownFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && topicDropdownFocusIdx >= 0) {
      e.preventDefault();
      handleAddTopic(topicSearchResults[topicDropdownFocusIdx]);
    } else if (e.key === 'Escape') {
      setTopicSearch('');
      setTopicDropdownFocusIdx(-1);
    }
  }, [topicSearchResults, topicDropdownFocusIdx, handleAddTopic]);

  // -------------------------------------------------------------------------
  // Empty state — no subject selected
  // -------------------------------------------------------------------------
  if (!selectedSchemaSubject) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--color-text-tertiary)',
          fontSize: 13,
          padding: 24,
          textAlign: 'center',
        }}
      >
        Select a schema subject to view its details.
      </div>
    );
  }

  const { schemaType, id, schema } = selectedSchemaSubject;
  const typeBadgeStyle = getSchemaTypeBadgeStyle(schemaType);
  const formattedSchema = formatSchemaJson(schema);
  const isProtobuf = schemaType === 'PROTOBUF';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-surface)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <DeleteConfirm
          subject={selectedSchemaSubject.subject}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            if (!deleting) setShowDeleteConfirm(false);
          }}
          isLoading={deleting}
        />
      )}

      {/* R2-4: Version delete confirmation overlay */}
      {showDeleteVersionConfirm && selectedVersion !== 'latest' && (
        <VersionDeleteConfirm
          subject={selectedSchemaSubject.subject}
          version={selectedVersion as number}
          onConfirm={handleDeleteVersion}
          onCancel={() => setShowDeleteVersionConfirm(false)}
        />
      )}

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          flexWrap: 'wrap',
          rowGap: 6,
        }}
      >
        {/* Schema ID */}
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            fontFamily: "'SF Mono', Monaco, Consolas, monospace",
            flexShrink: 0,
          }}
          title="Schema ID"
        >
          ID&nbsp;{id}
        </span>

        <div style={{ flex: 1 }} />

        {/* Schema / Datasets toggle (centered) */}
        <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden' }} role="group" aria-label="Detail mode">
          <button
            style={{
              padding: '3px 10px',
              fontSize: 12,
              border: '1px solid var(--color-border)',
              borderRight: 'none',
              borderRadius: '4px 0 0 4px',
              background: topMode === 'schema' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: topMode === 'schema' ? '#fff' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
            onClick={() => setTopMode('schema')}
            aria-pressed={topMode === 'schema'}
          >
            Schema
          </button>
          <button
            style={{
              padding: '3px 10px',
              fontSize: 12,
              border: '1px solid var(--color-border)',
              borderRadius: '0 4px 4px 0',
              background: topMode === 'datasets' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: topMode === 'datasets' ? '#fff' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
            onClick={() => setTopMode('datasets')}
            aria-pressed={topMode === 'datasets'}
          >
            Datasets
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Delete (header-level — deletes schema + datasets) */}
        {!isEditing && (
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 5,
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
            onClick={() => setShowDeleteConfirm(true)}
            title="Delete schema subject and all datasets"
            aria-label="Delete subject"
          >
            <FiTrash2 size={13} aria-hidden="true" />
          </button>
        )}

        {/* Separator */}
        {!isEditing && (
          <div style={{ width: 1, height: 18, background: 'var(--color-border)', flexShrink: 0 }} />
        )}

        {/* Refresh */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 5,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            cursor: schemaRegistryLoading || isEditing ? 'not-allowed' : 'pointer',
            opacity: isEditing ? 0.5 : 1,
          }}
          onClick={handleRefresh}
          disabled={schemaRegistryLoading || isEditing}
          title="Refresh schema"
          aria-label="Refresh schema"
        >
          <FiRefreshCw
            size={13}
            className={schemaRegistryLoading ? 'spin' : ''}
            aria-hidden="true"
          />
        </button>

        {/* Close */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 5,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
          onClick={clearSelectedSchema}
          title="Close detail panel"
          aria-label="Close schema detail"
        >
          <FiX size={13} aria-hidden="true" />
        </button>
      </div>

      {/* ── Topics section ───────────────────────────────────────────────── */}
      {topMode === 'schema' && selectedSchemaSubject && (
        <div style={{ borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setTopicsOpen((o) => !o)}
            role="button"
            aria-expanded={topicsOpen}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTopicsOpen((o) => !o); } }}
          >
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Topics</span>
            {!isEditing && !diffMode && associatedTopics.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 5 }}>({associatedTopics.length})</span>
            )}
            <div style={{ flex: 1 }} />
            <FiChevronDown size={13} style={{ transform: topicsOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
          </div>
          {topicsOpen && (isEditing || diffMode) && (
            <div style={{ padding: '0 12px 8px', fontSize: 10, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
              Topics ({associatedTopics.length}) — unavailable while editing
            </div>
          )}
          {topicsOpen && !isEditing && !diffMode && (
            <div style={{ padding: '0 12px 10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {topicsLoading && <FiLoader size={11} className="history-spin" aria-hidden="true" />}
                {associatedTopics.map((name) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => navigateToTopic(name)} title={`Open topic ${name}`} aria-label={`Go to topic ${name}`} style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>{name}</button>
                    <button onClick={() => handleRemoveTopic(name)} disabled={!!topicRemoving} title={`Remove association with ${name}`} aria-label={`Remove topic ${name}`} style={{ display: 'flex', alignItems: 'center', padding: 3, border: '1px solid var(--color-border)', borderRadius: 4, background: 'transparent', color: 'var(--color-text-tertiary)', cursor: topicRemoving === name ? 'wait' : 'pointer', opacity: topicRemoving === name ? 0.5 : 1, flexShrink: 0 }} onMouseEnter={(e) => { if (!topicRemoving) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-tertiary)'; }}>
                      {topicRemoving === name ? <FiLoader size={10} className="history-spin" aria-hidden="true" /> : <FiX size={10} aria-hidden="true" />}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ position: 'relative', marginTop: associatedTopics.length > 0 ? 8 : 0 }}>
                <input type="text" value={topicSearch} role="combobox" aria-expanded={topicSearchResults.length > 0 && !topicAdding} aria-autocomplete="list" aria-controls="topic-associate-listbox" onChange={(e) => { setTopicSearch(e.target.value); setTopicAddError(null); setTopicDropdownFocusIdx(-1); }} onKeyDown={handleTopicSearchKeyDown} onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; handleSearchFocus(); }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }} placeholder="Associate with a topic..." disabled={topicAdding} style={{ width: '100%', padding: '4px 8px', fontSize: 11, fontFamily: 'monospace', border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-surface)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box', opacity: topicAdding ? 0.6 : 1 }} />
                {topicSearchResults.length > 0 && !topicAdding && (
                  <div role="listbox" id="topic-associate-listbox" aria-label="Available topics" style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 140, overflowY: 'auto', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 4px 4px', zIndex: 20, boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }}>
                    {topicSearchResults.map((name, idx) => (
                      <button key={name} role="option" aria-selected={false} tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); handleAddTopic(name); }} style={{ display: 'block', width: '100%', padding: '5px 8px', fontSize: 11, fontFamily: 'monospace', textAlign: 'left', border: 'none', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: idx === topicDropdownFocusIdx ? 'var(--color-bg-hover)' : 'transparent', color: 'var(--color-text-primary)' }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)'; }} onMouseLeave={(e) => { if (idx !== topicDropdownFocusIdx) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>{name}</button>
                    ))}
                  </div>
                )}
                {topicAdding && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 11, color: 'var(--color-text-tertiary)' }}><FiLoader size={11} className="history-spin" aria-hidden="true" /> Associating...</div>}
                {topicAddError && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-error)' }}>{topicAddError}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Schema section header: Left (badges) | Center (Code/Tree) | Right (Evolve + collapse) ─ */}
      {topMode === 'schema' && <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {/* Left: Schema type + Global badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {!isEditing && (
            <span style={{ ...typeBadgeStyle, padding: '2px 7px', borderRadius: 3, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }} title={`Schema type: ${schemaType}`}>{schemaType}</span>
          )}
          {!isEditing && compatIsGlobal && (
            <span title="This subject inherits the global compatibility setting" style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', background: 'var(--color-surface-secondary)', border: '1px solid var(--color-border)', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Global</span>
          )}
        </div>

        {/* Center: Code/Tree (positioned in middle of full width) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {!isEditing && <ViewToggle view={view} onChange={setView} treeDisabled={schemaType !== 'AVRO'} />}
        </div>

        {/* Right: SELECT + collapse arrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {!isEditing && schemaType === 'AVRO' && generateSelectFromSchema(schema, selectedSchemaSubject.subject) && (
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: copiedSelect ? 'var(--color-success)' : 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer', transition: 'color var(--transition-fast)' }} onClick={handleGenerateSelect} title="Copy SELECT statement with all fields" aria-label="Copy SELECT statement">
              {copiedSelect ? <FiCheck size={12} aria-hidden="true" /> : <FiCode size={12} aria-hidden="true" />}
              SELECT
            </button>
          )}
          {isEditing && (
            <>
              <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: isValidated ? 'var(--color-success)' : 'var(--color-text-secondary)', fontSize: 12, cursor: validating || saving ? 'not-allowed' : 'pointer', opacity: validating || saving ? 0.7 : 1 }} onClick={handleValidate} disabled={validating || saving} title="Check compatibility against existing versions">
                {validating ? <span className="spin" style={{ width: 12, height: 12, display: 'inline-block' }} aria-hidden="true" /> : isValidated ? <FiCheck size={12} aria-hidden="true" /> : null}
                {validating ? 'Checking…' : 'Validate'}
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 4, border: 'none', background: isValidated ? 'var(--color-primary)' : 'var(--color-text-disabled)', color: '#ffffff', fontSize: 12, fontWeight: 600, cursor: !isValidated || saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.75 : 1 }} onClick={handleSave} disabled={!isValidated || saving} title={isValidated ? 'Save new schema version' : 'Validate before saving'} aria-label="Save new schema version">
                {saving && <span className="spin" style={{ width: 12, height: 12, display: 'inline-block' }} aria-hidden="true" />}
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }} onClick={handleCancelEdit} disabled={saving} title="Cancel editing">Cancel</button>
            </>
          )}
          <button style={{ display: 'flex', alignItems: 'center', padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-tertiary)' }} onClick={() => setSchemaOpen((o) => !o)} title={schemaOpen ? 'Collapse schema controls' : 'Expand schema controls'} aria-expanded={schemaOpen} aria-label="Toggle schema controls">
            <FiChevronDown size={14} style={{ transform: schemaOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} aria-hidden="true" />
          </button>
        </div>
      </div>}

      {/* ── Schema controls (collapsible): VERSION + COMPAT + Diff + Evolve ── */}
      {topMode === 'schema' && schemaOpen && <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 40,
          padding: '7px 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {/* Version selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SectionLabel>Version</SectionLabel>
          <select
            value={selectedVersion === 'latest' ? 'latest' : String(selectedVersion)}
            onChange={handleVersionChange}
            disabled={versionsLoading || isEditing}
            aria-label="Select schema version"
            style={{
              padding: '3px 6px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 12,
              cursor: versionsLoading || isEditing ? 'not-allowed' : 'pointer',
              opacity: isEditing ? 0.55 : 1,
            }}
          >
            <option value="latest">Latest</option>
            {versions.map((v) => (
              <option key={v} value={String(v)}>
                v{v}
              </option>
            ))}
          </select>
          {versionsLoading && (
            <span
              className="spin"
              style={{ width: 12, height: 12, display: 'inline-block' }}
              aria-label="Loading versions"
            />
          )}
          {/* Item 12 + R2-4: Delete specific version (opens confirm overlay, disabled for latest) */}
          {selectedVersion !== 'latest' && versions.length > 1 && !isEditing && (
            <button
              onClick={() => setShowDeleteVersionConfirm(true)}
              disabled={deletingVersion}
              title={`Delete version ${selectedVersion}`}
              aria-label={`Delete version ${selectedVersion}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '2px 5px',
                border: '1px solid var(--color-error)',
                borderRadius: 3,
                background: 'transparent',
                color: 'var(--color-error)',
                fontSize: 11,
                cursor: deletingVersion ? 'not-allowed' : 'pointer',
                opacity: deletingVersion ? 0.6 : 1,
              }}
            >
              {deletingVersion
                ? <span className="spin" style={{ width: 10, height: 10, display: 'inline-block' }} />
                : <FiTrash2 size={10} aria-hidden="true" />}
            </button>
          )}
        </div>

        {/* Compatibility */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SectionLabel>Compat</SectionLabel>
          {compatLoading ? (
            <span
              className="spin"
              style={{ width: 12, height: 12, display: 'inline-block' }}
              aria-label="Loading compatibility"
            />
          ) : (
            <>
              <select
                value={compatibility ?? ''}
                onChange={handleCompatibilityChange}
                disabled={isEditing || compatSaving || !compatibility}
                aria-label="Compatibility mode"
                style={{
                  padding: '3px 6px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 12,
                  cursor: isEditing || compatSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {(Object.keys(COMPATIBILITY_LABELS) as CompatibilityLevel[]).map((level) => (
                  <option key={level} value={level}>
                    {COMPATIBILITY_LABELS[level]}
                  </option>
                ))}
              </select>
              {compatSaving && (
                <span
                  className="spin"
                  style={{ width: 12, height: 12, display: 'inline-block' }}
                  aria-label="Saving compatibility"
                />
              )}
            </>
          )}
          {/* Item 6: Diff button (only when multiple versions exist, read mode) */}
          {!isEditing && versions.length >= 2 && (
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 4, border: `1px solid ${diffMode ? 'var(--color-primary)' : 'var(--color-border)'}`, background: diffMode ? 'var(--color-primary-badge-bg)' : 'var(--color-surface)', color: diffMode ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer', transition: 'background var(--transition-fast)' }} onClick={handleToggleDiff} title="Compare two schema versions" aria-label="Toggle diff view" aria-pressed={diffMode}>
              <FiCopy size={12} aria-hidden="true" />
              Diff
            </button>
          )}
          <div style={{ flex: 1 }} />
          {!isEditing && (
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: 12, cursor: 'pointer' }} onClick={handleEvolveClick} title="Register a new version of this schema" aria-label="Evolve schema">
              <FiEdit2 size={12} aria-hidden="true" />
              Evolve
            </button>
          )}
        </div>
      </div>}

      {/* ── Validation feedback banner ──────────────────────────────────────── */}
      {isEditing && validationError && !validating && (
        <div
          role="alert"
          style={{
            padding: '7px 12px',
            background: 'var(--color-surface-error)',
            borderBottom: '1px solid var(--color-border)',
            color: 'var(--color-error)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <FiAlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} aria-hidden="true" />
          <span>{validationError}</span>
        </div>
      )}
      {isEditing && isValidated && !validationError && !validating && (
        <div
          role="status"
          style={{
            padding: '7px 12px',
            background: 'var(--color-surface-success)',
            borderBottom: '1px solid var(--color-border)',
            color: 'var(--color-success)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <FiCheck size={13} aria-hidden="true" />
          Schema is compatible — ready to save.
        </div>
      )}


      {/* ── Content area ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {topMode === 'datasets' ? (
          /* Datasets view (top-level mode) */
          <SchemaDatasets subject={selectedSchemaSubject.subject} schemaText={schema} schemaType={schemaType} />
        ) : isEditing ? (
          /* Edit mode: schema editor textarea */
          <textarea
            value={editSchema}
            onChange={(e) => {
              setEditSchema(e.target.value);
              // Invalidate when schema changes after validation
              if (isValidated) {
                setIsValidated(false);
                setValidationError(null);
              }
            }}
            onKeyDown={(e) => {
              // Item 1: Tab inserts 2 spaces instead of escaping focus
              if (e.key === 'Tab') {
                e.preventDefault();
                const el = e.currentTarget;
                const start = el.selectionStart;
                const end = el.selectionEnd;
                const newValue = editSchema.substring(0, start) + '  ' + editSchema.substring(end);
                setEditSchema(newValue);
                // Restore cursor after the inserted spaces (React batches state, so use requestAnimationFrame)
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = start + 2;
                });
              }
            }}
            spellCheck={false}
            aria-label="Edit schema JSON"
            style={{
              flex: 1,
              width: '100%',
              padding: 12,
              fontFamily: "'SF Mono', Monaco, Consolas, monospace",
              fontSize: 12,
              lineHeight: 1.6,
              background: 'var(--color-surface-secondary)',
              color: 'var(--color-text-primary)',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              outline: 'none',
              resize: 'none',
              boxSizing: 'border-box',
              boxShadow: 'inset 0 0 0 2px var(--color-primary)',
            }}
          />
        ) : view === 'code' && diffMode ? (
          /* Item 6: Diff view — before/after version comparison */
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Diff version picker */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0,
                fontSize: 12,
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>Compare v{selectedVersion === 'latest' ? versions[versions.length - 1] : selectedVersion} against:</span>
              <select
                value={diffVersion === 'latest' ? 'latest' : String(diffVersion)}
                onChange={(e) => {
                  const v = e.target.value === 'latest' ? 'latest' : parseInt(e.target.value, 10);
                  handleDiffVersionChange(v);
                }}
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 12,
                }}
              >
                {/* R2-3: Hide "Latest" if selectedVersion is already latest (would self-compare) */}
                {selectedVersion !== 'latest' && (
                  <option value="latest">Latest</option>
                )}
                {/* R2-3: Omit the currently selected primary version to prevent self-compare */}
                {versions
                  .filter((v) => {
                    const resolvedSelected = selectedVersion === 'latest' ? versions[versions.length - 1] : selectedVersion;
                    return v !== resolvedSelected;
                  })
                  .map((v) => (
                    <option key={v} value={String(v)}>v{v}</option>
                  ))}
              </select>
              {diffLoading && (
                <span className="spin" style={{ width: 12, height: 12, display: 'inline-block' }} aria-hidden="true" />
              )}
            </div>
            {/* Diff content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', gap: 8 }}>
              {/* Left pane: diff schema */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  v{diffVersion === 'latest' ? 'latest' : diffVersion}
                </div>
                <pre
                  style={{
                    margin: 0, padding: 12,
                    fontFamily: "'SF Mono', Monaco, Consolas, monospace",
                    fontSize: 11, lineHeight: 1.6,
                    background: 'var(--color-surface-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    color: 'var(--color-text-primary)',
                    overflowX: 'auto', whiteSpace: 'pre', minHeight: 60,
                  }}
                >
                  {diffSchema ?? (diffLoading ? 'Loading…' : 'No schema')}
                </pre>
              </div>
              {/* Right pane: current schema */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  v{selectedVersion === 'latest' ? (versions[versions.length - 1] ?? 'latest') : selectedVersion} (current)
                </div>
                <pre
                  style={{
                    margin: 0, padding: 12,
                    fontFamily: "'SF Mono', Monaco, Consolas, monospace",
                    fontSize: 11, lineHeight: 1.6,
                    background: 'var(--color-surface-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    color: 'var(--color-text-primary)',
                    overflowX: 'auto', whiteSpace: 'pre', minHeight: 60,
                  }}
                >
                  {formattedSchema}
                </pre>
              </div>
            </div>
          </div>
        ) : view === 'code' ? (
          /* Read mode: formatted code */
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <pre
              style={{
                margin: 0,
                padding: 12,
                fontFamily: "'SF Mono', Monaco, Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.6,
                background: 'var(--color-surface-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                color: 'var(--color-text-primary)',
                overflowX: 'auto',
                whiteSpace: 'pre',
              }}
            >
              {formattedSchema}
            </pre>
          </div>
        ) : (
          /* Read mode: tree view */
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {isProtobuf ? (
              <div
                style={{
                  padding: '16px 12px',
                  color: 'var(--color-text-secondary)',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                Tree view is not available for Protobuf schemas. Switch to Code view to inspect
                the raw schema definition.
              </div>
            ) : (
              <SchemaTreeView schema={schema} />
            )}
          </div>
        )}
      </div>

      {/* Item 7: Loading shimmer for version switch */}
      {schemaRegistryLoading && !isEditing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--color-surface)',
            zIndex: 5,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 16,
            overflow: 'hidden',
          }}
          aria-live="polite"
          aria-label="Loading schema"
        >
          {/* Shimmer rows to suggest code content is loading */}
          {[80, 60, 90, 50, 75, 40, 65].map((w, i) => (
            <div
              key={i}
              style={{
                height: 14,
                width: `${w}%`,
                borderRadius: 4,
                background: 'var(--color-border)',
                animation: 'shimmer 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
