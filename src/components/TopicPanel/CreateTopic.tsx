/**
 * @create-topic @topic-panel
 * CreateTopic — Modal dialog for creating a new Kafka topic.
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   onCreated: () => void  — called after successful creation to refresh list
 *
 * Form fields:
 *   - Topic Name (required, monospace, autoFocus, validated)
 *   - Partitions (number, min 1, max 1000; default: 1 in dev, 6 in production)
 *   - Replication Factor (number, default 3, min 3)
 *   - Advanced section (collapsed by default):
 *     - Cleanup Policy (select: delete | compact, default delete)
 *     - Retention (ms) (dev: 3600000 = 1 hour; production: empty = broker default; -1 for infinite)
 *
 * Keyboard:
 *   - Escape closes the dialog (unless creating is in progress)
 *   - Tab/Shift+Tab trapped inside the modal
 *   - Topic name input receives focus on open
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { env } from '../../config/environment';
import { FiX, FiChevronDown, FiLoader } from 'react-icons/fi';

// Environment-aware defaults for topic creation
const isDev = env.environment === 'dev';
const DEFAULT_PARTITIONS = isDev ? 1 : 6;
const DEFAULT_RETENTION_MS = isDev ? '3600000' : '';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const TOPIC_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_TOPIC_NAME_LENGTH = 249;

function validateTopicName(name: string): string | null {
  if (!name) return 'Topic name is required.';
  // MED-3: reject space-only names explicitly
  if (!name.trim()) return 'Topic name cannot be blank or whitespace only.';
  if (name === '.' || name === '..') return 'Topic name cannot be "." or "..".';
  if (name.length > MAX_TOPIC_NAME_LENGTH)
    return `Topic name must be ${MAX_TOPIC_NAME_LENGTH} characters or fewer.`;
  if (!TOPIC_NAME_PATTERN.test(name))
    return 'Only letters, numbers, hyphens (-), underscores (_), and periods (.) are allowed.';
  return null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CreateTopicProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateTopic({ isOpen, onClose, onCreated }: CreateTopicProps) {
  const createTopic = useWorkspaceStore((s) => s.createTopic);
  const addToast = useWorkspaceStore((s) => s.addToast);

  // Form state
  const [topicName, setTopicName] = useState('');
  const [partitions, setPartitions] = useState(DEFAULT_PARTITIONS);
  const [replicationFactor, setReplicationFactor] = useState(3);
  const [cleanupPolicy, setCleanupPolicy] = useState<'delete' | 'compact'>('delete');
  const [retentionMs, setRetentionMs] = useState(DEFAULT_RETENTION_MS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // MED-4: track whether the user has attempted to submit (to show validation errors on the name)
  const [submitted, setSubmitted] = useState(false);
  // MED-5: separate validation for retention field
  const [retentionError, setRetentionError] = useState<string | null>(null);

  // Validation + error state
  const [apiError, setApiError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Refs
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // LOW-4: track the element that opened the dialog so we can return focus on close
  const triggerRef = useRef<Element | null>(null);

  // Focus topic name input when modal opens; capture trigger for LOW-4 focus return
  useEffect(() => {
    if (isOpen) {
      // LOW-4: remember what was focused before the dialog opened
      triggerRef.current = document.activeElement;
      const timer = setTimeout(() => nameInputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    } else {
      // Return focus to the element that opened the dialog
      const trigger = triggerRef.current as HTMLElement | null;
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
      triggerRef.current = null;
    }
  }, [isOpen]);

  // Reset all form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTopicName('');
      setPartitions(DEFAULT_PARTITIONS);
      setReplicationFactor(3);
      setCleanupPolicy('delete');
      setRetentionMs(DEFAULT_RETENTION_MS);
      setShowAdvanced(false);
      setApiError(null);
      setCreating(false);
      setSubmitted(false);
      setRetentionError(null);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, creating]);

  // Focus trap inside modal
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const el = dialogRef.current;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    el.addEventListener('keydown', handleTab);
    return () => el.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Validate topic name on change
  const handleTopicNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTopicName(value);
    setApiError(null);
  }, []);

  // MED-5: validate that retention is a whole integer
  const validateRetention = useCallback((value: string): string | null => {
    if (!value) return null; // optional field
    const num = Number(value);
    if (!Number.isInteger(num)) return 'Retention must be a whole number (no decimals).';
    if (num < -1) return 'Retention must be -1 (infinite) or a positive integer.';
    return null;
  }, []);

  const handleCreate = useCallback(async () => {
    // MED-4: mark as submitted so validation errors become visible
    setSubmitted(true);
    const error = validateTopicName(topicName);
    if (error) {
      return;
    }
    if (partitions < 1 || partitions > 1000) return;
    if (replicationFactor < 3) return;
    const retErr = validateRetention(retentionMs);
    if (retErr) {
      setRetentionError(retErr);
      return;
    }
    setRetentionError(null);

    setCreating(true);
    setApiError(null);

    try {
      await createTopic({
        topicName,
        partitionsCount: partitions,
        replicationFactor,
        cleanupPolicy,
        retentionMs: retentionMs ? parseInt(retentionMs, 10) : undefined,
      });
      addToast({ type: 'success', message: `Topic '${topicName}' created` });
      onCreated();
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string; error_code?: number } }; message?: string })
          ?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to create topic';
      setApiError(msg);
      setCreating(false);
    }
  }, [topicName, partitions, replicationFactor, cleanupPolicy, retentionMs, createTopic, addToast, onCreated, onClose, validateRetention]);

  if (!isOpen) return null;

  // MED-3+MED-4: show validation error if submitted or user has typed something
  const nameValidationError = (topicName || submitted) ? validateTopicName(topicName) : null;
  const canCreate =
    topicName.trim().length > 0 &&
    validateTopicName(topicName) === null &&
    partitions >= 1 &&
    partitions <= 1000 &&
    replicationFactor >= 3 &&
    !retentionError &&
    !creating;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    background: 'var(--color-surface-secondary)',
    color: 'var(--color-text-primary)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    display: 'block',
    marginBottom: 5,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
        }}
        onClick={() => {
          if (!creating) onClose();
        }}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-topic-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1001,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-lg)',
          width: '90%',
          maxWidth: 480,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <h2
            id="create-topic-title"
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            Create Topic
          </h2>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: creating ? 'not-allowed' : 'pointer',
              borderRadius: 4,
            }}
            onClick={() => {
              if (!creating) onClose();
            }}
            disabled={creating}
            title="Close (Esc)"
            aria-label="Close dialog"
          >
            <FiX size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Topic Name */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="create-topic-name" style={labelStyle}>
              Topic Name <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              ref={nameInputRef}
              id="create-topic-name"
              type="text"
              value={topicName}
              onChange={handleTopicNameChange}
              placeholder="e.g. orders-v1"
              disabled={creating}
              aria-required="true"
              aria-describedby={nameValidationError ? 'create-topic-name-error' : undefined}
              style={{
                ...inputStyle,
                fontFamily: 'monospace',
                borderColor: nameValidationError ? 'var(--color-error)' : 'var(--color-border)',
              }}
            />
            {nameValidationError && (
              <span
                id="create-topic-name-error"
                style={{
                  fontSize: 11,
                  color: 'var(--color-error)',
                  marginTop: 4,
                }}
                role="alert"
              >
                {nameValidationError}
              </span>
            )}
          </div>

          {/* Partitions */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="create-topic-partitions" style={labelStyle}>
              Partitions
            </label>
            <input
              id="create-topic-partitions"
              type="number"
              value={partitions}
              onChange={(e) => setPartitions(parseInt(e.target.value, 10) || 0)}
              min={1}
              max={1000}
              disabled={creating}
              style={inputStyle}
            />
            {(partitions < 1 || partitions > 1000) && (
              <span
                style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}
                role="alert"
              >
                Partitions must be between 1 and 1000.
              </span>
            )}
          </div>

          {/* Replication Factor */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="create-topic-rf" style={labelStyle}>
              Replication Factor
            </label>
            <input
              id="create-topic-rf"
              type="number"
              value={replicationFactor}
              onChange={(e) => setReplicationFactor(parseInt(e.target.value, 10) || 0)}
              min={3}
              disabled={creating}
              style={inputStyle}
            />
            {replicationFactor < 3 && (
              <span
                style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}
                role="alert"
              >
                Replication factor must be at least 3 (Confluent Cloud requirement).
              </span>
            )}
          </div>

          {/* Advanced toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              disabled={creating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: 'none',
                background: 'transparent',
                cursor: creating ? 'not-allowed' : 'pointer',
                padding: '4px 0',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
              }}
              aria-expanded={showAdvanced}
            >
              <FiChevronDown
                size={14}
                style={{
                  transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}
                aria-hidden="true"
              />
              Advanced Options
            </button>

            {showAdvanced && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  marginTop: 10,
                  padding: '12px 14px',
                  background: 'var(--color-surface-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                }}
              >
                {/* Cleanup Policy */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label htmlFor="create-topic-cleanup" style={labelStyle}>
                    Cleanup Policy
                  </label>
                  <select
                    id="create-topic-cleanup"
                    value={cleanupPolicy}
                    onChange={(e) => setCleanupPolicy(e.target.value as 'delete' | 'compact')}
                    disabled={creating}
                    style={{
                      ...inputStyle,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="delete">delete</option>
                    <option value="compact">compact</option>
                  </select>
                  {/* ENH-7: warn when compact is chosen */}
                  {cleanupPolicy === 'compact' && (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--color-warning)',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 4,
                      }}
                      role="note"
                    >
                      <span style={{ flexShrink: 0 }}>⚠</span>
                      Compact policy retains only the latest value per key. Flink streaming queries require{' '}
                      <code style={{ fontFamily: 'monospace', fontSize: 10 }}>delete</code> or{' '}
                      <code style={{ fontFamily: 'monospace', fontSize: 10 }}>delete,compact</code>{' '}
                      for correct changelog semantics.
                    </span>
                  )}
                </div>

                {/* Retention (ms) */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label htmlFor="create-topic-retention" style={labelStyle}>
                    Retention (ms)
                  </label>
                  <input
                    id="create-topic-retention"
                    type="number"
                    value={retentionMs}
                    onChange={(e) => {
                      setRetentionMs(e.target.value);
                      // MED-5: validate on change
                      setRetentionError(
                        e.target.value ? (() => {
                          const num = Number(e.target.value);
                          if (!Number.isInteger(num)) return 'Retention must be a whole number (no decimals).';
                          if (num < -1) return 'Retention must be -1 (infinite) or a positive integer.';
                          return null;
                        })() : null
                      );
                    }}
                    placeholder="604800000 = 7 days"
                    disabled={creating}
                    min={-1}
                    step={1}
                    style={{
                      ...inputStyle,
                      borderColor: retentionError ? 'var(--color-error)' : 'var(--color-border)',
                    }}
                  />
                  {retentionError ? (
                    <span
                      style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}
                      role="alert"
                    >
                      {retentionError}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-tertiary)',
                        marginTop: 4,
                      }}
                    >
                      {isDev
                        ? 'Default: 1 hour (3600000ms) in dev mode. Use -1 for infinite retention. Leave blank for broker default.'
                        : 'Use -1 for infinite retention. Leave blank for broker default (7 days).'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* API error */}
          {apiError && (
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--color-error-badge-bg)',
                border: '1px solid var(--color-error)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--color-error)',
              }}
              role="alert"
            >
              {apiError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!creating) onClose();
            }}
            disabled={creating}
            style={{
              padding: '7px 16px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 13,
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            style={{
              padding: '7px 16px',
              borderRadius: 4,
              border: 'none',
              background: canCreate ? 'var(--color-primary)' : 'var(--color-border)',
              color: canCreate ? '#ffffff' : 'var(--color-text-tertiary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: canCreate ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background var(--transition-fast)',
            }}
            aria-label={creating ? 'Creating topic…' : 'Create topic'}
          >
            {creating && (
              <FiLoader size={13} className="history-spin" aria-hidden="true" />
            )}
            {creating ? 'Creating…' : 'Create Topic'}
          </button>
        </div>
      </div>
    </>
  );
}
