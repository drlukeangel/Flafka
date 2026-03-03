/**
 * @topic-detail @topic-panel
 * TopicDetail — Full detail view for a selected Kafka topic.
 *
 * Sections:
 * - Header bar: partition badge + RF badge + health warning + Query + Refresh + Delete buttons
 *   - F4: standalone copy button (backtick-quoted, always enabled, shows toast on success)
 * - Metadata rows: Topic Name (copy + insert at cursor), Partitions, Replication Factor, Internal
 * - Config table: lazily loaded via getTopicConfigs()
 *   - retention.ms pinned to top with human-readable label
 *   - cleanup.policy pinned second with badge
 *   - remaining configs sorted alphabetically
 *   - is_default rows in muted color
 *   - is_sensitive values masked as bullets
 *   - null values shown as em-dash
 *   - non-read-only rows: hover-revealed edit pencil with inline edit mode
 *   - read-only rows: lock icon
 *   - F5: pre-save client-side validation for known numeric config keys
 * - Schema Association section: cross-link to Schema Registry subjects
 * - PartitionTable: collapsible partition breakdown
 * - Delete overlay: name-confirmation gate (exact match required, no trim)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as topicApi from '../../api/topic-api';
import * as schemaRegistryApi from '../../api/schema-registry-api';
import { insertTextAtCursor } from '../EditorCell/editorRegistry';
import { env } from '../../config/environment';
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
  FiPlay,
  FiCode,
  FiEdit2,
  FiLock,
  FiCheck,
  FiExternalLink,
} from 'react-icons/fi';
import PartitionTable from './PartitionTable';

// ---------------------------------------------------------------------------
// BadgeTooltip — portal-based tooltip that escapes overflow:hidden containers
// ---------------------------------------------------------------------------

function BadgeTooltip({
  text,
  children,
  style,
}: {
  text: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        style={{ cursor: 'help', ...style }}
      >
        {children}
      </span>
      {pos &&
        ReactDOM.createPortal(
          <div
            className="badge-tooltip-popup"
            style={{ left: pos.x, top: pos.y, transform: 'translateX(-50%)' }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Kafka config descriptions — hardcoded from Apache Kafka documentation
// ---------------------------------------------------------------------------

const KAFKA_CONFIG_DESCRIPTIONS: Record<string, string> = {
  'cleanup.policy': 'How old log segments are discarded. "delete" removes by time/size; "compact" keeps latest value per key.',
  'compression.type': 'Compression codec for the topic: uncompressed, zstd, lz4, snappy, gzip, or producer (use producer\'s setting).',
  'compression.gzip.level': 'Gzip compression level (1\u20139). Higher = better compression, more CPU.',
  'compression.lz4.level': 'LZ4 compression level (1\u201317). Higher = better ratio, slower.',
  'compression.zstd.level': 'Zstandard compression level (1\u201322). Higher = better ratio, slower.',
  'delete.retention.ms': 'How long tombstone markers are kept for compacted topics before deletion.',
  'file.delete.delay.ms': 'Delay before a log segment file is deleted from the filesystem.',
  'flush.messages': 'Number of messages written before forcing an fsync to disk. Use OS defaults for best performance.',
  'flush.ms': 'Maximum time before forcing an fsync to disk. Use OS defaults for best performance.',
  'follower.replication.throttled.replicas': 'Replicas throttled for log replication on the follower side.',
  'index.interval.bytes': 'How often a new index entry is added to the offset index. Smaller = larger index, more precise seeks.',
  'leader.replication.throttled.replicas': 'Replicas throttled for log replication on the leader side.',
  'local.retention.bytes': 'Max local log size before segments are moved to remote storage (tiered storage).',
  'local.retention.ms': 'Max time segments stay in local storage before moving to remote (tiered storage).',
  'max.compaction.lag.ms': 'Maximum time a message stays uncompacted in a compacted topic.',
  'max.message.bytes': 'Largest record batch size the broker will accept. Must align with consumer fetch size.',
  'message.downconversion.enable': 'Whether down-conversion of message formats is enabled for older consumer compatibility.',
  'message.format.version': 'Message format version the broker uses. Usually managed automatically.',
  'message.timestamp.after.max.ms': 'Maximum allowed difference when a message timestamp is after the broker time.',
  'message.timestamp.before.max.ms': 'Maximum allowed difference when a message timestamp is before the broker time.',
  'message.timestamp.difference.max.ms': 'Maximum allowed time difference between broker time and message timestamp.',
  'message.timestamp.type': 'Whether the timestamp is set at message creation ("CreateTime") or log append ("LogAppendTime").',
  'min.cleanable.dirty.ratio': 'Ratio of dirty log to total log size before compaction runs. Lower = more frequent compaction.',
  'min.compaction.lag.ms': 'Minimum time a message must stay uncompacted. Prevents compaction of very recent data.',
  'min.insync.replicas': 'Minimum replicas that must acknowledge a write when producer uses acks=all. Critical for durability.',
  'preallocate': 'Whether to preallocate log segment files on disk before writing.',
  'remote.storage.enable': 'Whether tiered (remote) storage is enabled for this topic.',
  'retention.bytes': 'Maximum total size of the log before old segments are deleted. -1 = no size limit.',
  'retention.ms': 'How long messages are retained before deletion. -1 = infinite retention.',
  'segment.bytes': 'Maximum size of a single log segment file before a new one is rolled.',
  'segment.index.bytes': 'Maximum size of the offset index for a segment. Controls memory usage per segment.',
  'segment.jitter.ms': 'Random jitter added to segment roll time to avoid all partitions rolling simultaneously.',
  'segment.ms': 'Maximum time before a log segment is rolled, even if not full.',
  'unclean.leader.election.enable': 'Whether out-of-sync replicas can become leader. Enabling risks data loss but improves availability.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * ENH-4: Format an ISO 8601 timestamp as a relative human-readable string.
 * Shows absolute time in tooltip; relative here (e.g. "3 days ago").
 */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return iso; // future date — just show as-is
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
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
// F6: Composite health score indicator — green/yellow/red based on partitions + RF
// ---------------------------------------------------------------------------

interface HealthScore {
  level: 'green' | 'yellow' | 'red';
  warnings: string[];
}

/**
 * F6: Compute health score as green/yellow/red based on partition count + replication factor.
 * Rules:
 * - RED: partitions < 1 OR replication_factor < 1
 * - YELLOW: partitions < 2 OR replication_factor < 2
 * - GREEN: otherwise
 */
// Phase 12.6 F10: Refactored to use early-return pattern (matching TopicList.tsx) to prevent
// duplicate warnings — critical conditions return immediately without falling through to yellow.
function computeHealthScore(topic: { partitions_count: number; replication_factor: number }): HealthScore {
  // RED: critical conditions — early return before yellow checks
  if (topic.partitions_count < 1 || topic.replication_factor < 1) {
    const warnings: string[] = [];
    if (topic.partitions_count < 1) {
      warnings.push('Topic has no partitions');
    }
    if (topic.replication_factor < 1) {
      warnings.push('Replication factor is too low');
    }
    return { level: 'red', warnings };
  }

  // YELLOW: degraded conditions
  if (topic.partitions_count < 2 || topic.replication_factor < 2) {
    const warnings: string[] = [];
    if (topic.partitions_count < 2) {
      warnings.push('Single-partition topics have no parallelism — performance may be limited');
    }
    if (topic.replication_factor < 2) {
      warnings.push('Low replication factor — data loss risk if a broker fails');
    }
    return { level: 'yellow', warnings };
  }

  // GREEN: healthy
  return { level: 'green', warnings: [] };
}

// ---------------------------------------------------------------------------
// F5: Client-side validation for known numeric config keys
// ---------------------------------------------------------------------------

/**
 * Known numeric config rules: [min, max] (inclusive, null = no bound).
 * Values must be integers > 0 (or -1 where noted).
 */
const NUMERIC_CONFIG_RULES: Record<string, { min: number; max: number | null; allowNegativeOne?: boolean; label: string }> = {
  'retention.ms': { min: -1, max: null, allowNegativeOne: true, label: 'Retention (ms)' },
  'replication.factor': { min: 1, max: 32767, label: 'Replication factor' },
  'min.insync.replicas': { min: 1, max: 32767, label: 'Min in-sync replicas' },
  'log.segment.bytes': { min: 1, max: null, label: 'Log segment bytes' },
  'log.retention.bytes': { min: -1, max: null, allowNegativeOne: true, label: 'Log retention bytes' },
  'log.retention.ms': { min: -1, max: null, allowNegativeOne: true, label: 'Log retention (ms)' },
  'message.max.bytes': { min: 0, max: 1073741824, label: 'Max message bytes' },
  'max.message.bytes': { min: 0, max: 1073741824, label: 'Max message bytes' },
  'log.segment.ms': { min: 1, max: null, label: 'Log segment (ms)' },
  'flush.messages': { min: 1, max: null, label: 'Flush messages' },
  'flush.ms': { min: 1, max: null, label: 'Flush (ms)' },
  'min.cleanable.dirty.ratio': { min: 0, max: 1, label: 'Min cleanable dirty ratio' },
};

/**
 * F5: Validate an edit value for a given config name.
 * Returns an error string if invalid, or null if valid.
 */
function validateConfigValue(name: string, value: string): string | null {
  const rule = NUMERIC_CONFIG_RULES[name];
  if (!rule) return null; // Unknown config — no client-side validation

  const trimmed = value.trim();
  if (trimmed === '') return `${rule.label} cannot be empty`;

  const num = Number(trimmed);
  if (!Number.isInteger(num) && !trimmed.includes('.')) {
    // allow floats only for ratio config
    if (name !== 'min.cleanable.dirty.ratio') {
      if (!Number.isInteger(num)) return `${rule.label} must be an integer`;
    }
  }
  if (isNaN(num)) return `${rule.label} must be a number`;

  if (rule.allowNegativeOne && num === -1) return null; // -1 means unlimited

  if (name === 'min.cleanable.dirty.ratio') {
    // float 0–1 range
    if (num < 0 || num > 1) return `${rule.label} must be between 0 and 1`;
    return null;
  }

  if (!Number.isInteger(num)) return `${rule.label} must be an integer`;

  if (num < rule.min) {
    return rule.allowNegativeOne
      ? `${rule.label} must be ≥ ${rule.min} or -1 (unlimited)`
      : `${rule.label} must be ≥ ${rule.min}`;
  }
  if (rule.max !== null && num > rule.max) {
    return `${rule.label} must be ≤ ${rule.max}`;
  }
  return null;
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

  // Escape to cancel + focus trap (WCAG 2.1 AA — modal dialogs must trap Tab)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
        return;
      }
      if (e.key === 'Tab' && overlayRef.current) {
        const focusable = Array.from(
          overlayRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
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
// SchemaAssociation section — cross-link to Schema Registry subjects
// ---------------------------------------------------------------------------

interface SchemaAssociationProps {
  topicName: string;
  onNavigate: (subject: string) => void;
}

function SchemaAssociation({ topicName, onNavigate }: SchemaAssociationProps) {
  const [loading, setLoading] = useState(true);
  const [foundSubjects, setFoundSubjects] = useState<string[]>([]);
  const [foundSchemaDetails, setFoundSchemaDetails] = useState<Record<string, { version: number; schemaType: string }>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const allSubjects = useWorkspaceStore((s) => s.schemaRegistrySubjects);
  const loadSubjects = useWorkspaceStore((s) => s.loadSchemaRegistrySubjects);
  const addToast = useWorkspaceStore((s) => s.addToast);

  // Track a refresh counter to re-trigger lookup after registering
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const candidates = [`${topicName}-value`, `${topicName}-key`, topicName];
    const lookupAll = async () => {
      setLoading(true);
      const results = await Promise.allSettled(
        candidates.map((subject) => schemaRegistryApi.getSchemaDetail(subject))
      );
      if (cancelled) return;
      const found: string[] = [];
      const details: Record<string, { version: number; schemaType: string }> = {};
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          found.push(candidates[i]);
          details[candidates[i]] = {
            version: result.value.version,
            schemaType: result.value.schemaType ?? 'AVRO',
          };
        }
      });
      setFoundSubjects(found);
      setFoundSchemaDetails(details);
      setLoading(false);
    };
    lookupAll();
    return () => { cancelled = true; };
  }, [topicName, refreshKey]);

  const handleStartEdit = async () => {
    setIsEditing(true);
    setSearch('');
    setRegisterError(null);
    if (allSubjects.length === 0) await loadSubjects();
  };

  // Real API call: fetch schema from source subject, register it under {topicName}-{value|key}
  const handleRegisterFromSubject = async (sourceSubject: string) => {
    const targetSubject = `${topicName}-value`;

    setRegistering(true);
    setRegisterError(null);
    try {
      // Fetch the schema content from the source subject
      const detail = await schemaRegistryApi.getSchemaDetail(sourceSubject);
      // Register it under the new topic-derived subject name
      await schemaRegistryApi.registerSchema(targetSubject, detail.schema, detail.schemaType);
      const verb = foundSubjects.includes(targetSubject) ? 'Updated' : 'Registered';
      addToast({ type: 'success', message: `${verb} schema under ${targetSubject}` });
      setSearch('');
      setIsEditing(false);
      // Refresh the lookup to pick up the new subject
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register schema';
      setRegisterError(msg);
    } finally {
      setRegistering(false);
    }
  };

  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeleteSubject = async (subject: string) => {
    setDeleting(subject);
    try {
      await schemaRegistryApi.deleteSubject(subject);
      addToast({ type: 'success', message: `Deleted subject ${subject}` });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete subject';
      addToast({ type: 'error', message: msg });
    } finally {
      setDeleting(null);
    }
  };

  const filteredSubjects = search.trim()
    ? allSubjects.filter(
        (s) =>
          s.toLowerCase().includes(search.toLowerCase()) &&
          !foundSubjects.includes(s)
      )
    : [];

  return (
    <div
      style={{
        padding: '12px 12px 0',
        borderTop: '1px solid var(--color-border)',
        marginTop: 8,
      }}
    >
      {/* Section header with edit button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Schema Association
        </span>
        <div style={{ flex: 1 }} />
        {!isEditing ? (
          <button
            onClick={handleStartEdit}
            title="Register a schema for this topic"
            aria-label="Register a schema for this topic"
            style={{
              border: '1px solid var(--color-border)',
              background: 'transparent',
              cursor: 'pointer',
              padding: 3,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--color-text-tertiary)',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-tertiary)';
            }}
          >
            <FiEdit2 size={11} aria-hidden="true" />
          </button>
        ) : (
          <button
            onClick={() => { setIsEditing(false); setRegisterError(null); }}
            title="Cancel"
            aria-label="Cancel"
            style={{
              border: '1px solid var(--color-border)',
              background: 'transparent',
              cursor: 'pointer',
              padding: 3,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--color-text-tertiary)',
            }}
          >
            <FiX size={11} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Edit mode: pick source schema to register under topic subject */}
      {isEditing && (
        <div style={{ marginBottom: 8 }}>
          {/* Search existing subjects to copy schema from */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setRegisterError(null); }}
              placeholder="Search existing subjects to copy schema from..."
              autoFocus
              disabled={registering}
              style={{
                width: '100%',
                padding: '5px 8px',
                fontSize: 11,
                fontFamily: 'monospace',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
                opacity: registering ? 0.6 : 1,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
            />
            {filteredSubjects.length > 0 && !registering && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: 150,
                  overflowY: 'auto',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderTop: 'none',
                  borderRadius: '0 0 4px 4px',
                  zIndex: 20,
                  boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                }}
              >
                {filteredSubjects.slice(0, 20).map((subject) => (
                  <button
                    key={subject}
                    onMouseDown={(e) => { e.preventDefault(); handleRegisterFromSubject(subject); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '5px 8px',
                      fontSize: 11,
                      fontFamily: 'monospace',
                      textAlign: 'left',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            )}
          </div>

          {registering && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              <FiLoader size={11} className="history-spin" aria-hidden="true" />
              Registering schema under {topicName}-value...
            </div>
          )}

          {registerError && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-error)' }}>
              {registerError}
            </div>
          )}
        </div>
      )}

      {/* Display found subjects */}
      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--color-text-tertiary)',
            padding: '4px 0 8px',
          }}
        >
          <FiLoader size={12} className="history-spin" aria-hidden="true" />
          <span>Looking up schemas...</span>
        </div>
      ) : foundSubjects.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8 }}>
          {foundSubjects.map((subject) => (
            <div
              key={subject}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 0',
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
                title={subject}
              >
                {subject}
              </span>
              {foundSchemaDetails[subject] && (
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3,
                  background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)', fontFamily: 'monospace', flexShrink: 0 }}>
                  v{foundSchemaDetails[subject].version}
                </span>
              )}
              {foundSchemaDetails[subject] && (
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3,
                  background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)', flexShrink: 0 }}>
                  {foundSchemaDetails[subject].schemaType}
                </span>
              )}
              <button
                onClick={() => handleDeleteSubject(subject)}
                disabled={deleting === subject}
                title={`Delete subject ${subject}`}
                aria-label={`Delete subject ${subject}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: 3,
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  background: 'transparent',
                  color: 'var(--color-text-tertiary)',
                  cursor: deleting === subject ? 'wait' : 'pointer',
                  flexShrink: 0,
                  opacity: deleting === subject ? 0.5 : 1,
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (deleting !== subject) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-tertiary)';
                }}
              >
                {deleting === subject ? <FiLoader size={10} className="history-spin" aria-hidden="true" /> : <FiTrash2 size={10} aria-hidden="true" />}
              </button>
              <button
                onClick={() => onNavigate(subject)}
                title="View in Schema Registry"
                aria-label={`View ${subject} in Schema Registry`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 7px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'color var(--transition-fast), background var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)';
                }}
              >
                <FiExternalLink size={10} aria-hidden="true" />
                View
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-tertiary)',
            padding: '4px 0 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>No schema registered</span>
          <button
            onClick={() => onNavigate('')}
            title="Open Schema Registry panel"
            aria-label="Open Schema Registry panel"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              color: 'var(--color-primary)',
              fontSize: 11,
            }}
          >
            <FiExternalLink size={10} aria-hidden="true" />
            Schemas
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopicDetail main component
// ---------------------------------------------------------------------------

// Phase 12.6 F4: sessionStorage key for config table sort persistence
const CONFIG_SORT_KEY = 'flink-ui.configTableSort';

type ConfigSortColumn = 'key' | 'value' | 'default' | 'readOnly';
interface ConfigSortState {
  column: ConfigSortColumn;
  direction: 'asc' | 'desc';
}

function readConfigSortFromSession(): ConfigSortState {
  try {
    const raw = sessionStorage.getItem(CONFIG_SORT_KEY);
    if (!raw) return { column: 'key', direction: 'asc' };
    const parsed = JSON.parse(raw) as ConfigSortState;
    if (!parsed.column || !parsed.direction) return { column: 'key', direction: 'asc' };
    return parsed;
  } catch {
    return { column: 'key', direction: 'asc' };
  }
}

const TopicDetail: React.FC = () => {
  const selectedTopic = useWorkspaceStore((s) => s.selectedTopic);
  const loadTopics = useWorkspaceStore((s) => s.loadTopics);
  const clearSelectedTopic = useWorkspaceStore((s) => s.clearSelectedTopic);
  const deleteTopic = useWorkspaceStore((s) => s.deleteTopic);
  const addToast = useWorkspaceStore((s) => s.addToast);
  const addStatement = useWorkspaceStore((s) => s.addStatement);
  const setActiveNavItem = useWorkspaceStore((s) => s.setActiveNavItem);
  const navigateToSchemaSubject = useWorkspaceStore((s) => s.navigateToSchemaSubject);
  const focusedStatementId = useWorkspaceStore((s) => s.focusedStatementId);
  // Phase 12.6 F1: Config audit log actions from store
  const addConfigAuditEntry = useWorkspaceStore((s) => s.addConfigAuditEntry);
  const getConfigAuditLogForTopic = useWorkspaceStore((s) => s.getConfigAuditLogForTopic);

  // Local config state (component-scoped, not store-level)
  const [configs, setConfigs] = useState<TopicConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [configsError, setConfigsError] = useState<string | null>(null);

  // Delete overlay state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Copy-to-clipboard state (topic name — metadata row)
  const [copied, setCopied] = useState(false);
  // F4: header copy button (backtick-quoted, always enabled)
  const [headerCopied, setHeaderCopied] = useState(false);

  // ENH-3: Config search
  const [configSearch, setConfigSearch] = useState('');

  // ENH-6: Track which config row is being copied
  const [copiedConfigName, setCopiedConfigName] = useState<string | null>(null);

  // Inline config editing state
  const [editingConfigName, setEditingConfigName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  // F5: client-side validation error (blocks Save until cleared)
  const [configValidationError, setConfigValidationError] = useState<string | null>(null);

  // Partition table collapse state
  const [partitionExpanded, setPartitionExpanded] = useState(false);

  // Phase 12.6 F4: Config table sort state (persisted to sessionStorage)
  const [configSort, setConfigSort] = useState<ConfigSortState>(readConfigSortFromSession);

  // Phase 12.6 F1: Config History section state
  const [configHistoryExpanded, setConfigHistoryExpanded] = useState(false);

  // Stale-response guard + HIGH-5: AbortController cancels in-flight requests when topic changes.
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const saveRequestIdRef = useRef(0);

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
      // R2-ABT: pass signal to Axios so the HTTP request is cancelled (not just React state)
      const data = await topicApi.getTopicConfigs(selectedTopic.topic_name, controller.signal);
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
    setEditingConfigName(null);
    setEditError(null);
    setPartitionExpanded(false);
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

  // F4: header copy — backtick-quoted, always enabled, shows toast
  const handleHeaderCopyTopicName = useCallback(async () => {
    if (!selectedTopic) return;
    const backtickName = `\`${selectedTopic.topic_name}\``;
    try {
      await navigator.clipboard.writeText(backtickName);
      setHeaderCopied(true);
      addToast({ type: 'success', message: `Copied: ${backtickName}` });
      setTimeout(() => setHeaderCopied(false), 1500);
    } catch {
      addToast({ type: 'error', message: 'Copy failed — clipboard not available' });
    }
  }, [selectedTopic, addToast]);

  const handleInsertTopicName = useCallback(() => {
    if (!selectedTopic) return;
    const backtickName = `\`${selectedTopic.topic_name}\``;
    const success = insertTextAtCursor(backtickName);
    if (!success) {
      addToast({ type: 'warning', message: 'No SQL editor focused — click into an editor first' });
    }
  }, [selectedTopic, addToast]);

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

  // Inline config edit: start editing
  const handleStartEdit = useCallback((config: TopicConfig) => {
    setEditingConfigName(config.name);
    setEditingValue(config.value ?? '');
    setEditError(null);
    // F5: validate initial value on start (may be invalid already)
    setConfigValidationError(validateConfigValue(config.name, config.value ?? ''));
  }, []);

  // Inline config edit: cancel (F1: no audit entry on cancel — AC-1.8)
  const handleCancelEdit = useCallback(() => {
    setEditingConfigName(null);
    setEditingValue('');
    setEditError(null);
    setConfigValidationError(null);
  }, []);

  // Phase 12.6 F4: Handle config table column sort click — persist to sessionStorage
  const handleConfigSort = useCallback((column: ConfigSortColumn) => {
    setConfigSort((prev) => {
      const next: ConfigSortState = prev.column === column
        ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column, direction: 'asc' };
      try {
        sessionStorage.setItem(CONFIG_SORT_KEY, JSON.stringify(next));
      } catch {
        // sessionStorage may be unavailable in some environments; silently ignore
      }
      return next;
    });
  }, []);

  // Phase 12.6 F1: Toggle Config History section
  const handleConfigHistoryToggle = useCallback(() => {
    setConfigHistoryExpanded((v) => !v);
  }, []);

  // Inline config edit: save
  // Phase 12.6 F1: Captures oldValue before API call and writes audit entry on confirmed success
  const handleSaveEdit = useCallback(async () => {
    if (!selectedTopic || !editingConfigName) return;
    // F5: block save if client-side validation fails
    const validationErr = validateConfigValue(editingConfigName, editingValue);
    if (validationErr) {
      setConfigValidationError(validationErr);
      return;
    }
    // F1: Capture oldValue now (before API call) — current value in the configs array
    const existingConfig = configs.find((c) => c.name === editingConfigName);
    const oldValue = existingConfig?.value ?? '';
    const mySaveId = ++saveRequestIdRef.current;
    setEditSaving(true);
    setEditError(null);
    try {
      await topicApi.alterTopicConfig(selectedTopic.topic_name, editingConfigName, editingValue);
      if (mySaveId !== saveRequestIdRef.current) return; // stale
      // F1: Write audit log entry only on confirmed success (AC-1.1, AC-1.9)
      addConfigAuditEntry({
        topicName: selectedTopic.topic_name,
        configKey: editingConfigName,
        oldValue,
        newValue: editingValue,
      });
      setEditingConfigName(null);
      setEditingValue('');
      setConfigValidationError(null);
      // Re-fetch configs to get updated values
      await fetchConfigs();
    } catch (err) {
      if (mySaveId !== saveRequestIdRef.current) return;
      // F1: No audit entry on API error (AC-1.9)
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to save config';
      setEditError(msg);
    } finally {
      if (mySaveId === saveRequestIdRef.current) {
        setEditSaving(false);
      }
    }
  }, [selectedTopic, editingConfigName, editingValue, configs, fetchConfigs, addConfigAuditEntry]);

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

  const handleQueryWithFlink = useCallback(() => {
    if (!selectedTopic) return;
    addStatement(`SELECT * FROM \`${selectedTopic.topic_name}\`;`);
    setActiveNavItem('workspace');
  }, [selectedTopic, addStatement, setActiveNavItem]);

  const handleSchemaNavigate = useCallback((subject: string) => {
    if (subject) {
      navigateToSchemaSubject(subject);
    } else {
      setActiveNavItem('schemas');
    }
  }, [navigateToSchemaSubject, setActiveNavItem]);

  if (!selectedTopic) return null;

  // ENH-3: apply search filter (name OR value substring match, case-insensitive)
  // Phase 12.6 F4: Apply user-controlled column sort on top of filtered list
  const filteredConfigs = configSearch
    ? configs.filter(
        (c) =>
          c.name.toLowerCase().includes(configSearch.toLowerCase()) ||
          (c.value ?? '').toLowerCase().includes(configSearch.toLowerCase())
      )
    : configs;

  const sortedConfigs = [...filteredConfigs].sort((a, b) => {
    let aVal = '';
    let bVal = '';
    switch (configSort.column) {
      case 'key':
        aVal = a.name;
        bVal = b.name;
        break;
      case 'value':
        aVal = a.value ?? '';
        bVal = b.value ?? '';
        break;
      case 'default':
        aVal = a.is_default ? '1' : '0';
        bVal = b.is_default ? '1' : '0';
        break;
      case 'readOnly':
        aVal = a.is_read_only ? '1' : '0';
        bVal = b.is_read_only ? '1' : '0';
        break;
    }
    const cmp = aVal.localeCompare(bVal);
    return configSort.direction === 'asc' ? cmp : -cmp;
  });

  // Phase 12.6 F1: Audit log entries for current topic (most recent first)
  const auditLogEntries = getConfigAuditLogForTopic(selectedTopic.topic_name);

  const schemaRegistryConfigured = !!env.schemaRegistryUrl;

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
        <BadgeTooltip
          text={`${selectedTopic.partitions_count} partitions \u2014 data is split across this many parallel segments for throughput`}
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
        </BadgeTooltip>

        {/* Phase 12.6 F8: Composite health score indicator — colored dot with tooltip.
            Green (healthy) topics show NO dot — consistent with TopicList.tsx behavior. */}
        {(() => {
          const health = computeHealthScore(selectedTopic);
          // F8: Hide dot for healthy (green) topics — same guard as TopicList.tsx (AC-8.1)
          if (health.level === 'green') return null;
          const colorMap = {
            green: 'var(--color-success)',
            yellow: 'var(--color-warning)',
            red: 'var(--color-error)',
          };
          const tooltipText = health.warnings.length > 0
            ? health.warnings.join('\n')
            : 'Healthy topic';

          return (
            <span
              title={tooltipText}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'help',
              }}
              aria-label={`Health: ${health.level} — ${tooltipText}`}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: colorMap[health.level],
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
            </span>
          );
        })()}

        {/* Replication factor badge */}
        <BadgeTooltip
          text={`Replication factor ${selectedTopic.replication_factor} \u2014 each message is copied to ${selectedTopic.replication_factor} brokers for durability`}
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
        </BadgeTooltip>

        <div style={{ flex: 1 }} />

        {/* F4: copy topic name button — backtick-quoted, always enabled */}
        <button
          onClick={handleHeaderCopyTopicName}
          title="Copy topic name (backtick-quoted)"
          aria-label="Copy topic name (backtick-quoted)"
          style={{
            border: '1px solid var(--color-border)',
            background: 'transparent',
            cursor: 'pointer',
            padding: '3px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: headerCopied ? 'var(--color-success)' : 'var(--color-text-secondary)',
            borderRadius: 4,
            fontSize: 11,
            transition: 'color var(--transition-fast), background var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            if (!headerCopied) {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = headerCopied
              ? 'var(--color-success)'
              : 'var(--color-text-secondary)';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {headerCopied ? <FiCheck size={12} aria-hidden="true" /> : <FiCopy size={12} aria-hidden="true" />}
          Copy
        </button>

        {/* Query with Flink button */}
        <button
          onClick={handleQueryWithFlink}
          title="Query this topic with Flink SQL"
          aria-label="Query with Flink"
          style={{
            border: '1px solid var(--color-border)',
            background: 'transparent',
            cursor: 'pointer',
            padding: '3px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--color-text-secondary)',
            borderRadius: 4,
            fontSize: 11,
            transition: 'color var(--transition-fast), background var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <FiPlay size={12} aria-hidden="true" />
          Query
        </button>

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
            padding: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-error)',
            borderRadius: 4,
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-error-badge-bg)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          <FiTrash2 size={14} aria-hidden="true" />
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
          {/* Topic Name row: copy + insert at cursor */}
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
            {/* Copy button */}
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
            {/* Insert at cursor button */}
            <button
              onClick={handleInsertTopicName}
              title={focusedStatementId ? 'Insert topic name at cursor' : 'No SQL editor focused'}
              aria-label={focusedStatementId ? 'Insert topic name at cursor' : 'Insert topic name at cursor — no SQL editor is focused'}
              disabled={focusedStatementId === null}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: focusedStatementId ? 'pointer' : 'not-allowed',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                color: focusedStatementId ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
                borderRadius: 3,
                flexShrink: 0,
                opacity: focusedStatementId ? 1 : 0.4,
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                if (focusedStatementId)
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = focusedStatementId
                  ? 'var(--color-text-secondary)'
                  : 'var(--color-text-tertiary)';
              }}
            >
              <FiCode size={12} aria-hidden="true" />
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

          {/* ENH-4: created_at — shown only when API provides the field */}
          {selectedTopic.created_at && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                borderTop: '1px solid var(--color-border)',
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
                Created
              </span>
              <span
                style={{ fontSize: 12, color: 'var(--color-text-primary)' }}
                title={selectedTopic.created_at}
              >
                {formatRelativeTime(selectedTopic.created_at)}
              </span>
            </div>
          )}

          {/* ENH-4: last_modified_at — shown only when API provides the field */}
          {selectedTopic.last_modified_at && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                borderTop: '1px solid var(--color-border)',
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
                Modified
              </span>
              <span
                style={{ fontSize: 12, color: 'var(--color-text-primary)' }}
                title={selectedTopic.last_modified_at}
              >
                {formatRelativeTime(selectedTopic.last_modified_at)}
              </span>
            </div>
          )}
        </div>

        {/* Schema Association section — only render if Schema Registry is configured */}
        {schemaRegistryConfigured && (
          <SchemaAssociation
            topicName={selectedTopic.topic_name}
            onNavigate={handleSchemaNavigate}
          />
        )}

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
            {/* Phase 12.6 F4: Sortable column headers with aria-sort */}
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {(['key', 'value'] as ConfigSortColumn[]).map((col) => (
                  <th
                    key={col}
                    onClick={() => handleConfigSort(col)}
                    aria-sort={
                      configSort.column === col
                        ? configSort.direction === 'asc' ? 'ascending' : 'descending'
                        : 'none'
                    }
                    style={{
                      textAlign: 'left',
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                    title={`Sort by ${col}`}
                  >
                    {col === 'key' ? 'Key' : 'Value'}
                    {configSort.column === col && (
                      <span aria-hidden="true" style={{ marginLeft: 4 }}>
                        {configSort.direction === 'asc' ? '\u2191' : '\u2193'}
                      </span>
                    )}
                  </th>
                ))}
                <th
                  onClick={() => handleConfigSort('default')}
                  aria-sort={
                    configSort.column === 'default'
                      ? configSort.direction === 'asc' ? 'ascending' : 'descending'
                      : 'none'
                  }
                  style={{
                    textAlign: 'center',
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  title="Sort by default"
                >
                  Default
                  {configSort.column === 'default' && (
                    <span aria-hidden="true" style={{ marginLeft: 4 }}>
                      {configSort.direction === 'asc' ? '\u2191' : '\u2193'}
                    </span>
                  )}
                </th>
                <th
                  onClick={() => handleConfigSort('readOnly')}
                  aria-sort={
                    configSort.column === 'readOnly'
                      ? configSort.direction === 'asc' ? 'ascending' : 'descending'
                      : 'none'
                  }
                  style={{
                    textAlign: 'center',
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  title="Sort by read-only"
                >
                  R/O
                  {configSort.column === 'readOnly' && (
                    <span aria-hidden="true" style={{ marginLeft: 4 }}>
                      {configSort.direction === 'asc' ? '\u2191' : '\u2193'}
                    </span>
                  )}
                </th>
                <th style={{ padding: '4px 8px', width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {sortedConfigs.map((config) => {
                const isDefault = config.is_default;
                const isSensitive = config.is_sensitive;
                const isReadOnly = config.is_read_only;
                const isNull = config.value === null;
                const isEditing = editingConfigName === config.name;
                const canEdit = !isReadOnly && !isSensitive;

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
                      const copyBtn = (e.currentTarget as HTMLTableRowElement).querySelector<HTMLButtonElement>('[data-copy-btn]');
                      if (copyBtn && !isSensitive && config.value !== null) copyBtn.style.opacity = '1';
                      // reveal edit button on hover
                      const editBtn = (e.currentTarget as HTMLTableRowElement).querySelector<HTMLButtonElement>('[data-edit-btn]');
                      if (editBtn && canEdit && !isEditing) editBtn.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      const copyBtn = (e.currentTarget as HTMLTableRowElement).querySelector<HTMLButtonElement>('[data-copy-btn]');
                      if (copyBtn) copyBtn.style.opacity = '0';
                      const editBtn = (e.currentTarget as HTMLTableRowElement).querySelector<HTMLButtonElement>('[data-edit-btn]');
                      if (editBtn) editBtn.style.opacity = '0';
                    }}
                  >
                    {/* Config name column */}
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
                    >
                      {KAFKA_CONFIG_DESCRIPTIONS[config.name] ? (
                        <BadgeTooltip text={KAFKA_CONFIG_DESCRIPTIONS[config.name]}>
                          {config.name}
                        </BadgeTooltip>
                      ) : (
                        <span title={config.name}>{config.name}</span>
                      )}
                    </td>

                    {/* Config value column */}
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
                      {isEditing ? (
                        // Inline edit mode
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditingValue(val);
                              // F5: live validation on change
                              setConfigValidationError(validateConfigValue(config.name, val));
                            }}
                            aria-label={`Edit value for ${config.name}`}
                            aria-describedby={configValidationError ? `config-validation-${config.name}` : undefined}
                            aria-invalid={configValidationError ? 'true' : undefined}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            style={{
                              width: '100%',
                              padding: '3px 5px',
                              border: `1px solid ${configValidationError ? 'var(--color-error)' : 'var(--color-primary)'}`,
                              borderRadius: 3,
                              background: 'var(--color-surface-secondary)',
                              color: 'var(--color-text-primary)',
                              fontSize: 12,
                              fontFamily: 'monospace',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                          {/* F5: inline validation error */}
                          {configValidationError && (
                            <span
                              id={`config-validation-${config.name}`}
                              style={{
                                fontSize: 11,
                                color: 'var(--color-error)',
                              }}
                              role="alert"
                            >
                              {configValidationError}
                            </span>
                          )}
                          {editError && (
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--color-error)',
                              }}
                              role="alert"
                            >
                              {editError}
                            </span>
                          )}
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={handleSaveEdit}
                              disabled={editSaving || !!configValidationError}
                              aria-label={`Save ${config.name}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '2px 7px',
                                border: 'none',
                                borderRadius: 3,
                                // F5: gray out Save button when validation error present
                                background: configValidationError ? 'var(--color-border)' : 'var(--color-primary)',
                                color: configValidationError ? 'var(--color-text-tertiary)' : '#ffffff',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: (editSaving || !!configValidationError) ? 'not-allowed' : 'pointer',
                                opacity: editSaving ? 0.7 : 1,
                              }}
                            >
                              {editSaving
                                ? <FiLoader size={10} className="history-spin" aria-hidden="true" />
                                : <FiCheck size={10} aria-hidden="true" />}
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={editSaving}
                              aria-label={`Cancel editing ${config.name}`}
                              style={{
                                padding: '2px 7px',
                                border: '1px solid var(--color-border)',
                                borderRadius: 3,
                                background: 'var(--color-surface)',
                                color: 'var(--color-text-secondary)',
                                fontSize: 11,
                                cursor: editSaving ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
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
                      )}
                    </td>

                    {/* Edit / lock column */}
                    <td
                      style={{
                        padding: '6px 8px 6px 0',
                        verticalAlign: 'top',
                        width: 24,
                        flexShrink: 0,
                      }}
                    >
                      {isReadOnly ? (
                        <span
                          title="Read-only configuration"
                          aria-label="Read-only"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--color-text-tertiary)',
                            padding: 2,
                          }}
                        >
                          <FiLock size={10} aria-hidden="true" />
                        </span>
                      ) : canEdit && !isEditing ? (
                        <button
                          data-edit-btn
                          onClick={() => handleStartEdit(config)}
                          title={`Edit ${config.name}`}
                          aria-label={`Edit ${config.name}`}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--color-text-tertiary)',
                            borderRadius: 3,
                            flexShrink: 0,
                            opacity: 0,
                            transition: 'opacity var(--transition-fast), color var(--transition-fast)',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-tertiary)';
                          }}
                        >
                          <FiEdit2 size={10} aria-hidden="true" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Phase 12.6 F1: Config History section — session-scoped audit log of config changes */}
        <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 0 }}>
          <button
            id="config-history-toggle"
            aria-expanded={configHistoryExpanded}
            aria-controls="config-history-content"
            onClick={handleConfigHistoryToggle}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleConfigHistoryToggle(); } }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span>Config History</span>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                transform: configHistoryExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s',
                fontSize: 10,
              }}
            >
              &#9660;
            </span>
          </button>
          {configHistoryExpanded && (
            <div
              id="config-history-content"
              role="region"
              aria-label="Config history"
              style={{ padding: '4px 12px 12px' }}
            >
              {auditLogEntries.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                  No config changes this session.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {auditLogEntries.map((entry, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: 'var(--color-text-secondary)',
                        padding: '2px 0',
                        borderBottom: i < auditLogEntries.length - 1 ? '1px solid var(--color-border)' : 'none',
                      }}
                    >
                      <span style={{ color: 'var(--color-text-tertiary)', marginRight: 8 }}>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <span style={{ color: 'var(--color-text-primary)', fontWeight: 600, marginRight: 8 }}>
                        {entry.configKey}
                      </span>
                      <span style={{ color: 'var(--color-text-tertiary)' }}>{entry.oldValue}</span>
                      <span style={{ color: 'var(--color-text-secondary)', margin: '0 6px' }}>{'\u2192'}</span>
                      <span style={{ color: 'var(--color-success)' }}>{entry.newValue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Partition Table — collapsible */}
        <PartitionTable
          topicName={selectedTopic.topic_name}
          isExpanded={partitionExpanded}
          onToggle={() => setPartitionExpanded((v) => !v)}
        />
      </div>
    </div>
  );
};

export default TopicDetail;
