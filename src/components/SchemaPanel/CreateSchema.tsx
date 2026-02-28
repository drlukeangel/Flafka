/**
 * @create-schema @schema-panel
 * CreateSchema - Modal dialog for registering a new schema subject.
 *
 * Props:
 *   isOpen: boolean
 *   onClose: () => void
 *   onCreated?: () => void  — called after successful registration to refresh list
 *
 * Form fields:
 *   - Subject name (required)
 *   - Schema type: AVRO | PROTOBUF | JSON (default AVRO)
 *   - Schema content textarea — pre-filled with type-specific template
 *
 * Flow:
 *   1. Fill in subject + schema content
 *   2. Click "Validate" → calls validateCompatibility
 *      - 404 on subject means new subject (no existing versions) → treated as valid
 *   3. "Create" button enabled after validation passes → calls registerSchema
 *   4. On success: toast, call onCreated(), close
 *
 * Keyboard:
 *   - Escape closes the dialog (unless creating is in progress)
 *   - Tab/Shift+Tab are trapped inside the modal
 *   - Subject input receives focus on open
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';
import { FiX, FiCheck, FiAlertTriangle } from 'react-icons/fi';

// ---------------------------------------------------------------------------
// Schema templates per type
// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, string> = {
  AVRO: `{
  "type": "record",
  "name": "Example",
  "namespace": "com.example",
  "fields": [
    { "name": "id", "type": "long" },
    { "name": "name", "type": "string" }
  ]
}`,
  PROTOBUF: `syntax = "proto3";

message Example {
  int64 id = 1;
  string name = 2;
}`,
  JSON: `{
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "name": { "type": "string" }
  },
  "required": ["id", "name"]
}`,
};

type SchemaType = 'AVRO' | 'PROTOBUF' | 'JSON';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CreateSchemaProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAxios404(err: unknown): boolean {
  const e = err as { response?: { status?: number } };
  return e?.response?.status === 404;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateSchema({ isOpen, onClose, onCreated }: CreateSchemaProps) {
  const addToast = useWorkspaceStore((s) => s.addToast);

  // Form state
  const [subject, setSubject] = useState('');
  const [schemaType, setSchemaType] = useState<SchemaType>('AVRO');
  const [schemaContent, setSchemaContent] = useState(TEMPLATES.AVRO);

  // Operation state
  const [isValidated, setIsValidated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Refs
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus subject input when modal opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => subjectInputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset all form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSubject('');
      setSchemaType('AVRO');
      setSchemaContent(TEMPLATES.AVRO);
      setIsValidated(false);
      setValidating(false);
      setValidationError(null);
      setCreating(false);
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

  // Switching schema type resets content to template and clears validation
  const handleSchemaTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as SchemaType;
    setSchemaType(type);
    setSchemaContent(TEMPLATES[type]);
    setIsValidated(false);
    setValidationError(null);
  }, []);

  // Content change resets validation
  const handleSchemaContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setSchemaContent(e.target.value);
      setIsValidated(false);
      setValidationError(null);
    },
    []
  );

  // Subject change resets validation
  const handleSubjectChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSubject(e.target.value);
    setIsValidated(false);
    setValidationError(null);
  }, []);

  const handleValidate = useCallback(async () => {
    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      setValidationError('Subject name is required.');
      return;
    }
    if (!schemaContent.trim()) {
      setValidationError('Schema content cannot be empty.');
      return;
    }

    setValidating(true);
    setIsValidated(false);
    setValidationError(null);

    try {
      // validateCompatibility against 'latest' — a 404 means the subject doesn't
      // exist yet, so any schema is valid (first version is always accepted).
      const result = await schemaRegistryApi.validateCompatibility(
        trimmedSubject,
        schemaContent,
        schemaType,
        'latest'
      );

      if (result.is_compatible) {
        setIsValidated(true);
        addToast({ type: 'success', message: 'Schema is valid and compatible', duration: 3000 });
      } else {
        setValidationError(
          'Schema is not compatible with existing versions of this subject.'
        );
        addToast({ type: 'error', message: 'Schema compatibility check failed' });
      }
    } catch (err) {
      if (isAxios404(err)) {
        // Subject doesn't exist yet — first registration, always valid
        setIsValidated(true);
        addToast({ type: 'success', message: 'New subject — schema is valid', duration: 3000 });
      } else {
        const msg = err instanceof Error ? err.message : 'Validation failed';
        setValidationError(msg);
        addToast({ type: 'error', message: `Validation error: ${msg}` });
      }
    } finally {
      setValidating(false);
    }
  }, [subject, schemaContent, schemaType, addToast]);

  const handleCreate = useCallback(async () => {
    const trimmedSubject = subject.trim();
    if (!trimmedSubject || !isValidated) return;
    setCreating(true);
    try {
      const result = await schemaRegistryApi.registerSchema(
        trimmedSubject,
        schemaContent,
        schemaType
      );
      addToast({
        type: 'success',
        message: `Schema registered — ID: ${result.id}`,
        duration: 4000,
      });
      onCreated?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to register schema';
      addToast({ type: 'error', message: msg });
      setCreating(false);
    }
  }, [subject, schemaContent, schemaType, isValidated, addToast, onCreated, onClose]);

  // -------------------------------------------------------------------------
  // Derived flags
  // -------------------------------------------------------------------------
  if (!isOpen) return null;

  const canValidate =
    subject.trim().length > 0 && schemaContent.trim().length > 0 && !validating && !creating;
  const canCreate = isValidated && !creating;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <>
      {/* Semi-transparent backdrop */}
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
        aria-labelledby="create-schema-title"
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
        {/* ── Header ──────────────────────────────────────────────────────── */}
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
            id="create-schema-title"
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            Create Schema
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

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Subject name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label
              htmlFor="create-schema-subject"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}
            >
              Subject Name{' '}
              <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              ref={subjectInputRef}
              id="create-schema-subject"
              type="text"
              value={subject}
              onChange={handleSubjectChange}
              placeholder="e.g. my-topic-value"
              disabled={creating}
              aria-required="true"
              aria-describedby="create-schema-subject-hint"
              style={{
                padding: '7px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: 13,
                fontFamily: "'SF Mono', Monaco, Consolas, monospace",
                outline: 'none',
                opacity: creating ? 0.6 : 1,
              }}
            />
            <span
              id="create-schema-subject-hint"
              style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}
            >
              Convention: &lt;topic-name&gt;-key or &lt;topic-name&gt;-value
            </span>
          </div>

          {/* Schema type selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label
              htmlFor="create-schema-type"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}
            >
              Schema Type
            </label>
            <select
              id="create-schema-type"
              value={schemaType}
              onChange={handleSchemaTypeChange}
              disabled={creating}
              style={{
                padding: '7px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: 13,
                cursor: creating ? 'not-allowed' : 'pointer',
                opacity: creating ? 0.6 : 1,
              }}
            >
              <option value="AVRO">AVRO</option>
              <option value="PROTOBUF">PROTOBUF</option>
              <option value="JSON">JSON</option>
            </select>
          </div>

          {/* Schema content textarea */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label
              htmlFor="create-schema-content"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}
            >
              Schema Definition{' '}
              <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <textarea
              id="create-schema-content"
              value={schemaContent}
              onChange={handleSchemaContentChange}
              spellCheck={false}
              disabled={creating}
              aria-required="true"
              rows={10}
              style={{
                padding: '8px 10px',
                borderRadius: 4,
                border: isValidated
                  ? '1px solid var(--color-success)'
                  : '1px solid var(--color-border)',
                background: 'var(--color-surface-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: 12,
                fontFamily: "'SF Mono', Monaco, Consolas, monospace",
                lineHeight: 1.55,
                resize: 'vertical',
                outline: 'none',
                opacity: creating ? 0.6 : 1,
                transition: 'border-color var(--transition-fast)',
                minHeight: 160,
              }}
            />
          </div>

          {/* Validation error */}
          {validationError && !validating && (
            <div
              role="alert"
              style={{
                padding: '8px 10px',
                background: 'var(--color-surface-error)',
                border: '1px solid var(--color-error)',
                borderRadius: 4,
                color: 'var(--color-error)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
              }}
            >
              <FiAlertTriangle
                size={13}
                style={{ marginTop: 1, flexShrink: 0 }}
                aria-hidden="true"
              />
              <span>{validationError}</span>
            </div>
          )}

          {/* Validation success */}
          {isValidated && !validationError && !validating && (
            <div
              role="status"
              style={{
                padding: '8px 10px',
                background: 'var(--color-surface-success)',
                border: '1px solid var(--color-success)',
                borderRadius: 4,
                color: 'var(--color-success)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FiCheck size={13} aria-hidden="true" />
              Schema validated — ready to create.
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
          }}
        >
          {/* Cancel */}
          <button
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 12,
              cursor: creating ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.6 : 1,
            }}
            onClick={() => {
              if (!creating) onClose();
            }}
            disabled={creating}
          >
            Cancel
          </button>

          {/* Validate */}
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color:
                isValidated && !validating
                  ? 'var(--color-success)'
                  : 'var(--color-text-secondary)',
              fontSize: 12,
              cursor: !canValidate ? 'not-allowed' : 'pointer',
              opacity: !canValidate ? 0.6 : 1,
            }}
            onClick={handleValidate}
            disabled={!canValidate}
            title="Validate schema compatibility"
          >
            {validating ? (
              <span
                className="spin"
                style={{ width: 12, height: 12, display: 'inline-block' }}
                aria-hidden="true"
              />
            ) : isValidated ? (
              <FiCheck size={12} aria-hidden="true" />
            ) : null}
            {validating ? 'Validating\u2026' : 'Validate'}
          </button>

          {/* Create */}
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: canCreate ? 'var(--color-primary)' : 'var(--color-text-disabled)',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 600,
              cursor: !canCreate ? 'not-allowed' : 'pointer',
              opacity: creating ? 0.75 : 1,
            }}
            onClick={handleCreate}
            disabled={!canCreate}
            title={isValidated ? 'Register new schema' : 'Validate first'}
            aria-label="Create schema"
          >
            {creating && (
              <span
                className="spin"
                style={{ width: 12, height: 12, display: 'inline-block' }}
                aria-hidden="true"
              />
            )}
            {creating ? 'Creating\u2026' : 'Create'}
          </button>
        </div>
      </div>
    </>
  );
}
