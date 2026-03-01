/**
 * @topic-detail @topic-panel
 * TopicDetail — Full detail view for a selected Kafka topic.
 *
 * Sections:
 * - Header bar: partition badge + RF badge + Refresh + Delete buttons
 * - Metadata rows: Topic Name (copy-on-click), Partitions, Replication Factor, Internal
 * - Config table: lazily loaded via getTopicConfigs()
 *   - retention.ms pinned to top with human-readable label
 *   - cleanup.policy pinned second with badge
 *   - remaining configs sorted alphabetically
 *   - is_default rows in muted color
 *   - is_sensitive values masked as bullets
 *   - null values shown as em-dash
 * - Delete overlay: name-confirmation gate (exact match required, no trim)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as topicApi from '../../api/topic-api';
import type { TopicConfig } from '../../types';
import {
  FiRefreshCw,
  FiTrash2,
  FiLoader,
  FiAlertCircle,
  FiAlertTriangle,
  FiCopy,
  FiSearch,
  FiX,
} from 'react-icons/fi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert retention.ms value to a human-readable string.
 * -1 => "Infinite"
 * Otherwise convert ms to most appropriate unit (days, hours, minutes, seconds)
 */
/**
 * MED-1: Convert retention.ms value to a full human-readable string that
 * preserves all significant time components (days, hours, minutes, seconds).
 * -1 => "Infinite", 0 => "0ms", otherwise e.g. "1d 2h 30m 15s"
 */
function formatRetentionMs(value: string | null): string {
  if (value === null) return '\u2014';
  const ms = parseInt(value, 10);
  if (isNaN(ms)) return value;
  if (ms === -1) return 'Infinite';
  if (ms === 0) return '0ms';

  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.length > 0 ? parts.join(' ') : '0ms';
}

/**
 * Sort configs: retention.ms first, cleanup.policy second, then alphabetically.
 */
function sortConfigs(configs: TopicConfig[]): TopicConfig[] {
  const pinned = ['retention.ms', 'cleanup.policy'];
  const pinnedConfigs = pinned
    .map((name) => configs.find((c) => c.name === name))
    .filter(Boolean) as TopicConfig[];
  const rest = configs
    .filter((c) => !pinned.includes(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...pinnedConfigs, ...rest];
}

// ---------------------------------------------------------------------------
// DeleteConfirm overlay — requires user to type exact topic name
// ---------------------------------------------------------------------------

interface DeleteConfirmProps {
  topicName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

function DeleteConfirm({ topicName, onConfirm, onCancel, isLoading, error }: DeleteConfirmProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const [confirmInput, setConfirmInput] = useState('');

  const canDelete = confirmInput === topicName;

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
      aria-labelledby="delete-topic-dialog-title"
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
        {/* Title — LOW-3: overflow protection for very long topic names */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <FiAlertTriangle
            size={16}
            style={{ color: 'var(--color-error)', flexShrink: 0 }}
            aria-hidden="true"
          />
          <h3
            id="delete-topic-dialog-title"
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
            title={`Delete ${topicName}?`}
          >
            Delete{' '}
            <span style={{ fontFamily: 'monospace' }}>{topicName}</span>?
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
          This action is <strong>irreversible</strong>. All messages in this topic will be
          permanently deleted.
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
          Active Flink queries referencing this topic may fail.
        </p>

        {/* Name confirmation input */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="delete-topic-confirm"
            style={{
              display: 'block',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              marginBottom: 6,
            }}
          >
            Type <strong style={{ fontFamily: 'monospace' }}>{topicName}</strong> to confirm:
          </label>
          <input
            id="delete-topic-confirm"
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            disabled={isLoading}
            placeholder={topicName}
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

        {/* Error message */}
        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 10px',
              background: 'var(--color-error-badge-bg)',
              border: '1px solid var(--color-error)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--color-error)',
            }}
            role="alert"
          >
            {error}
          </div>
        )}

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
              color: canDelete ? '#ffffff' : 'var(--color-text-tertiary)',
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
            aria-label={isLoading ? 'Deleting topic…' : `Delete ${topicName}`}
          >
            {isLoading && (
              <FiLoader
                size={12}
                className="history-spin"
                aria-hidden="true"
              />
            )}
            {isLoading ? 'Deleting…' : `Delete ${topicName}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopicDetail main component
// ---------------------------------------------------------------------------

const TopicDetail: React.FC = () => {
  const selectedTopic = useWorkspaceStore((s) => s.selectedTopic);
  const loadTopics = useWorkspaceStore((s) => s.loadTopics);
  const clearSelectedTopic = useWorkspaceStore((s) => s.clearSelectedTopic);
  const deleteTopic = useWorkspaceStore((s) => s.deleteTopic);
  const addToast = useWorkspaceStore((s) => s.addToast);

  // Local config state (component-scoped, not store-level)
  const [configs, setConfigs] = useState<TopicConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [configsError, setConfigsError] = useState<string | null>(null);

  // Delete overlay state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Copy-to-clipboard state (topic name)
  const [copied, setCopied] = useState(false);

  // ENH-3: Config search
  const [configSearch, setConfigSearch] = useState('');

  // ENH-6: Track which config row is being copied
  const [copiedConfigName, setCopiedConfigName] = useState<string | null>(null);

  // Stale-response guard + HIGH-5: AbortController cancels in-flight requests when topic changes.
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchConfigs = useCallback(async () => {
    if (!selectedTopic) return;
    // Cancel any previous in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const myRequestId = ++requestIdRef.current;
    setConfigsLoading(true);
    setConfigsError(null);
    try {
      const data = await topicApi.getTopicConfigs(selectedTopic.topic_name);
      if (controller.signal.aborted || myRequestId !== requestIdRef.current) return; // stale
      setConfigs(sortConfigs(data));
    } catch (err) {
      if (controller.signal.aborted || myRequestId !== requestIdRef.current) return;
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to load configs';
      setConfigsError(msg);
    } finally {
      if (!controller.signal.aborted && myRequestId === requestIdRef.current) {
        setConfigsLoading(false);
      }
    }
  }, [selectedTopic]);

  // Load configs on mount / topic change
  useEffect(() => {
    setConfigs([]);
    setConfigsError(null);
    fetchConfigs();
    return () => {
      // Cancel any in-flight request when topic changes or component unmounts
      abortControllerRef.current?.abort();
    };
  }, [fetchConfigs]);

  const handleCopyTopicName = useCallback(async () => {
    if (!selectedTopic) return;
    try {
      await navigator.clipboard.writeText(selectedTopic.topic_name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silently fail
    }
  }, [selectedTopic]);

  // ENH-6: copy config value on row hover click
  const handleCopyConfigValue = useCallback(async (config: TopicConfig) => {
    const textToCopy = config.value ?? '';
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedConfigName(config.name);
      setTimeout(() => setCopiedConfigName(null), 1500);
    } catch {
      // silently fail
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedTopic) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      // CRIT-3: Store.deleteTopic only does the API call + optimistic list removal.
      // Component orchestrates post-delete navigation to avoid double-loadTopics race.
      await deleteTopic(selectedTopic.topic_name);
      addToast({ type: 'success', message: `Topic '${selectedTopic.topic_name}' deleted` });
      setShowDeleteConfirm(false);
      clearSelectedTopic();
      // Single authoritative loadTopics call — no duplicate from the store
      await loadTopics();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to delete topic';
      setDeleteError(msg);
    } finally {
      setDeleteLoading(false);
    }
  }, [selectedTopic, deleteTopic, addToast, clearSelectedTopic, loadTopics]);

  if (!selectedTopic) return null;

  // ENH-3: apply search filter (name OR value substring match, case-insensitive)
  const sortedConfigs = configSearch
    ? configs.filter(
        (c) =>
          c.name.toLowerCase().includes(configSearch.toLowerCase()) ||
          (c.value ?? '').toLowerCase().includes(configSearch.toLowerCase())
      )
    : configs;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <DeleteConfirm
          topicName={selectedTopic.topic_name}
          onConfirm={handleDelete}
          onCancel={() => {
            if (!deleteLoading) {
              setShowDeleteConfirm(false);
              setDeleteError(null);
            }
          }}
          isLoading={deleteLoading}
          error={deleteError}
        />
      )}

      {/* Header bar: badges + action buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {/* Partition badge — LOW-6: use CSS vars */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 7px',
            borderRadius: 10,
            background: 'var(--color-primary-badge-bg)',
            color: 'var(--color-primary)',
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {selectedTopic.partitions_count}P
        </span>
        {/* ENH-2: health warning when partition count < 2 */}
        {selectedTopic.partitions_count < 2 && (
          <span
            title="Single-partition topics have no parallelism — performance may be limited"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 10,
              background: 'var(--color-warning-badge-bg)',
              color: 'var(--color-warning)',
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'help',
            }}
            aria-label="Warning: single partition — no parallelism"
          >
            <FiAlertTriangle size={10} aria-hidden="true" />
            Low parallelism
          </span>
        )}
        {/* Replication factor badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 7px',
            borderRadius: 10,
            background: 'var(--color-success-badge-bg)',
            color: 'var(--color-success)',
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          RF:{selectedTopic.replication_factor}
        </span>

        <div style={{ flex: 1 }} />

        {/* Refresh button */}
        <button
          onClick={fetchConfigs}
          title="Refresh configs"
          aria-label="Refresh topic configs"
          disabled={configsLoading}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: configsLoading ? 'default' : 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            color: 'var(--color-text-secondary)',
            borderRadius: 4,
            opacity: configsLoading ? 0.5 : 1,
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            if (!configsLoading)
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
          }}
        >
          {configsLoading
            ? <FiLoader size={14} className="history-spin" aria-hidden="true" />
            : <FiRefreshCw size={14} aria-hidden="true" />}
        </button>

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          title="Delete topic"
          aria-label="Delete topic"
          style={{
            border: '1px solid var(--color-error)',
            background: 'transparent',
            cursor: 'pointer',
            padding: '3px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--color-error)',
            borderRadius: 4,
            fontSize: 11,
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-badge-bg)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <FiTrash2 size={12} aria-hidden="true" />
          Delete
        </button>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 0',
        }}
      >
        {/* Metadata rows */}
        <div style={{ padding: '0 12px', marginBottom: 16 }}>
          {/* Topic Name row (click to copy) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                minWidth: 90,
                paddingTop: 2,
                flexShrink: 0,
              }}
            >
              Topic Name
            </span>
            <button
              onClick={handleCopyTopicName}
              title="Click to copy topic name"
              aria-label="Copy topic name to clipboard"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                textAlign: 'left',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={selectedTopic.topic_name}
              >
                {selectedTopic.topic_name}
              </span>
              <FiCopy
                size={11}
                style={{ color: copied ? 'var(--color-success)' : 'var(--color-text-tertiary)', flexShrink: 0 }}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Partitions row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                minWidth: 90,
                flexShrink: 0,
              }}
            >
              Partitions
            </span>
            <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
              {selectedTopic.partitions_count}
            </span>
          </div>

          {/* Replication Factor row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                minWidth: 90,
                flexShrink: 0,
              }}
            >
              Replication
            </span>
            <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
              {selectedTopic.replication_factor}
            </span>
          </div>

          {/* Internal row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                minWidth: 90,
                flexShrink: 0,
              }}
            >
              Internal
            </span>
            <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>
              {selectedTopic.is_internal ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {/* Divider + Configuration section header + ENH-3 search */}
        <div
          style={{
            padding: '0 12px 8px',
            borderTop: '1px solid var(--color-border)',
            paddingTop: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: configs.length > 0 ? 6 : 0 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                flex: 1,
              }}
            >
              Configuration
            </span>
          </div>
          {/* ENH-3: filter input shown when configs are loaded */}
          {configs.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'var(--color-surface-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: '0 7px',
                height: 28,
              }}
            >
              <FiSearch size={11} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} aria-hidden="true" />
              <input
                type="text"
                placeholder="Filter configs..."
                value={configSearch}
                onChange={(e) => setConfigSearch(e.target.value)}
                aria-label="Filter configurations"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 12,
                  color: 'var(--color-text-primary)',
                  minWidth: 0,
                }}
              />
              {configSearch && (
                <button
                  onClick={() => setConfigSearch('')}
                  aria-label="Clear config filter"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 1,
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--color-text-tertiary)',
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                >
                  <FiX size={10} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Config table content */}
        {configsLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '20px 12px',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
            }}
            aria-live="polite"
          >
            <FiLoader size={16} className="history-spin" aria-hidden="true" />
            <span>Loading configs...</span>
          </div>
        ) : configsError ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 8,
              padding: '12px 12px',
              color: 'var(--color-error)',
              fontSize: 12,
            }}
            role="alert"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiAlertCircle size={13} aria-hidden="true" />
              <span>{configsError}</span>
            </div>
            <button
              className="history-retry-btn"
              onClick={fetchConfigs}
              aria-label="Retry loading configs"
            >
              Retry
            </button>
          </div>
        ) : sortedConfigs.length === 0 ? (
          <div
            style={{
              padding: '16px 12px',
              fontSize: 13,
              color: 'var(--color-text-tertiary)',
              textAlign: 'center',
            }}
          >
            {configSearch ? `No configs matching "${configSearch}"` : 'No configurations found'}
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
            }}
          >
            <tbody>
              {sortedConfigs.map((config) => {
                const isDefault = config.is_default;
                const isSensitive = config.is_sensitive;
                const isNull = config.value === null;

                let displayValue: string | React.ReactNode = isNull
                  ? '\u2014'
                  : isSensitive
                  ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'
                  : config.value ?? '\u2014';

                // Special rendering for retention.ms
                if (config.name === 'retention.ms' && config.value !== null && !isSensitive) {
                  const readable = formatRetentionMs(config.value);
                  displayValue = (
                    <span>
                      <span style={{ fontFamily: 'monospace' }}>{config.value}</span>
                      {readable !== config.value && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 11,
                            color: isDefault
                              ? 'var(--color-text-tertiary)'
                              : 'var(--color-text-secondary)',
                            background: 'var(--color-surface-secondary)',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}
                        >
                          {readable}
                        </span>
                      )}
                    </span>
                  );
                }

                // Special rendering for cleanup.policy badge.
                // HIGH-4: split on comma to support "delete,compact" dual-policy values.
                if (config.name === 'cleanup.policy' && config.value && !isSensitive) {
                  const policies = config.value.split(',').map((p) => p.trim());
                  displayValue = (
                    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
                      {policies.map((policy) => {
                        const isDelete = policy === 'delete';
                        return (
                          <span
                            key={policy}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 7px',
                              borderRadius: 10,
                              background: isDelete
                                ? 'var(--color-primary-badge-bg)'
                                : 'var(--color-warning-badge-bg)',
                              color: isDelete ? 'var(--color-primary)' : 'var(--color-warning)',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {policy}
                          </span>
                        );
                      })}
                    </span>
                  );
                }

                // MED-7: build a human-readable tooltip for ms-suffix config values
                const tooltipValue = (() => {
                  if (typeof displayValue === 'string') return displayValue;
                  if (config.name.endsWith('.ms') && config.value !== null && !isSensitive) {
                    const readable = formatRetentionMs(config.value);
                    return readable !== config.value
                      ? `${config.value} (${readable})`
                      : (config.value ?? '');
                  }
                  return config.value ?? '';
                })();

                const isCopied = copiedConfigName === config.name;

                return (
                  <tr
                    key={config.name}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      // ENH-6: reveal copy button on hover
                      const btn = (e.currentTarget as HTMLTableRowElement).querySelector<HTMLButtonElement>('[data-copy-btn]');
                      if (btn && !isSensitive && config.value !== null) btn.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      const btn = (e.currentTarget as HTMLTableRowElement).querySelector<HTMLButtonElement>('[data-copy-btn]');
                      if (btn) btn.style.opacity = '0';
                    }}
                  >
                    <td
                      style={{
                        padding: '6px 12px',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: isDefault
                          ? 'var(--color-text-tertiary)'
                          : 'var(--color-text-primary)',
                        verticalAlign: 'top',
                        width: '45%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 130,
                      }}
                      title={config.name}
                    >
                      {config.name}
                    </td>
                    <td
                      style={{
                        padding: '6px 12px 6px 0',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: isDefault
                          ? 'var(--color-text-tertiary)'
                          : 'var(--color-text-primary)',
                        verticalAlign: 'top',
                        overflow: 'hidden',
                        maxWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          minWidth: 0,
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={tooltipValue}
                        >
                          {displayValue}
                        </span>
                        {/* ENH-6: copy config value button (visible on row hover) */}
                        {!isSensitive && config.value !== null && (
                          <button
                            data-copy-btn
                            onClick={() => handleCopyConfigValue(config)}
                            title={`Copy value: ${config.value}`}
                            aria-label={`Copy value of ${config.name}`}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              alignItems: 'center',
                              color: isCopied ? 'var(--color-success)' : 'var(--color-text-tertiary)',
                              borderRadius: 3,
                              flexShrink: 0,
                              opacity: 0,
                              transition: 'opacity var(--transition-fast), color var(--transition-fast)',
                            }}
                          >
                            <FiCopy size={10} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TopicDetail;
