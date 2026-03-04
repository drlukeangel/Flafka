/**
 * Phase 12.6 F2: Added Type and Compat filter dropdowns (AND logic with name search)
 * Phase 12.6 F3: Added loading skeleton on initial mount (not on subsequent re-fetches)
 * Bulk delete: Toggle button → bulk mode → action bar → modal confirmation (mirrors TopicList pattern)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';
import type { CompatibilityLevel } from '../../types';
import {
  FiSearch,
  FiX,
  FiLoader,
  FiFileText,
  FiChevronRight,
  FiAlertCircle,
  FiPlus,
  FiTrash2,
  FiCheckSquare,
  FiMinusSquare,
} from 'react-icons/fi';
import CreateSchema from './CreateSchema';

// ORIG-8: Schema type badge color helper (consistent with SchemaDetail type badge)
function getSchemaTypeBadgeStyle(schemaType: string): { background: string; color: string } {
  switch (schemaType) {
    case 'AVRO':
      return { background: 'var(--color-primary-badge-bg)', color: 'var(--color-primary)' };
    case 'PROTOBUF':
      return { background: 'var(--color-warning-badge-bg)', color: 'var(--color-warning)' };
    case 'JSON':
      return { background: 'var(--color-success-badge-bg)', color: 'var(--color-success)' };
    default:
      return { background: 'var(--color-bg-hover)', color: 'var(--color-text-secondary)' };
  }
}

// Phase 12.6 F2: Filter dropdown options
const TYPE_OPTIONS = ['All Types', 'AVRO', 'PROTOBUF', 'JSON'] as const;
const COMPAT_OPTIONS: Array<'All Compat Modes' | CompatibilityLevel> = [
  'All Compat Modes',
  'BACKWARD',
  'BACKWARD_TRANSITIVE',
  'FORWARD',
  'FORWARD_TRANSITIVE',
  'FULL',
  'FULL_TRANSITIVE',
  'NONE',
];

// Phase 12.6 F3: Skeleton shimmer rows for initial load
function SkeletonRows({ count }: { count: number }) {
  return (
    <div aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div
            className="shimmer"
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: 'var(--color-bg-skeleton, var(--color-border))',
            }}
          />
          <div
            className="shimmer"
            style={{
              flex: 1,
              height: 12,
              borderRadius: 3,
              background: 'var(--color-bg-skeleton, var(--color-border))',
              maxWidth: `${60 + (i * 17) % 40}%`,
            }}
          />
          <div
            className="shimmer"
            style={{
              width: 36,
              height: 16,
              borderRadius: 3,
              background: 'var(--color-bg-skeleton, var(--color-border))',
            }}
          />
        </div>
      ))}
    </div>
  );
}

const SchemaList: React.FC = () => {
  const subjects = useWorkspaceStore((s) => s.schemaRegistrySubjects);
  const loading = useWorkspaceStore((s) => s.schemaRegistryLoading);
  const error = useWorkspaceStore((s) => s.schemaRegistryError);
  const loadSchemaRegistrySubjects = useWorkspaceStore((s) => s.loadSchemaRegistrySubjects);
  const loadSchemaDetail = useWorkspaceStore((s) => s.loadSchemaDetail);
  const addToast = useWorkspaceStore((s) => s.addToast);
  // ORIG-8: Lazy cache of subject → schemaType (populated when subject is first clicked)
  const schemaTypeCache = useWorkspaceStore((s) => s.schemaTypeCache);
  // Phase 12.6 F2: Lazy cache of subject → compatibilityLevel
  const schemaCompatCache = useWorkspaceStore((s) => s.schemaCompatCache);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [createOpen, setCreateOpen] = useState(false);

  // Phase 12.6 F2: Type and Compat filter state (resets on panel mount — AC-2.10)
  const [typeFilter, setTypeFilter] = useState<string>('All Types');
  const [compatFilter, setCompatFilter] = useState<string>('All Compat Modes');

  // Bulk delete state — mirrors TopicList ENH-5 pattern
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Phase 12.6 F3: Track whether initial load has happened (skeleton vs spinner)
  const hasLoadedOnceRef = useRef(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Debounce the search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset focused index whenever filtered list changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [debouncedQuery, typeFilter, compatFilter]);

  // Phase 12.6 F3: Mark initial load complete once loading transitions from true to false
  useEffect(() => {
    if (!loading && !hasLoadedOnceRef.current) {
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    }
  }, [loading]);

  // Phase 12.6 F2: AND filtering: name search + type filter + compat filter
  const filteredSubjects = subjects.filter((s) => {
    if (debouncedQuery && !s.toLowerCase().includes(debouncedQuery.toLowerCase())) return false;
    if (typeFilter !== 'All Types') {
      const cachedType = schemaTypeCache[s];
      if (!cachedType) return false;
      if (cachedType !== typeFilter) return false;
    }
    if (compatFilter !== 'All Compat Modes') {
      const cachedCompat = schemaCompatCache[s];
      if (!cachedCompat) return false;
      if (cachedCompat !== compatFilter) return false;
    }
    return true;
  });

  const allSelected = filteredSubjects.length > 0 && bulkSelected.size === filteredSubjects.length;
  const someSelected = bulkSelected.size > 0 && !allSelected;

  const exitBulkMode = useCallback(() => {
    setIsBulkMode(false);
    setBulkSelected(new Set());
    setBulkConfirmOpen(false);
  }, []);

  const handleItemClick = useCallback((subject: string) => {
    if (isBulkMode) {
      setBulkSelected((prev) => {
        const next = new Set(prev);
        if (next.has(subject)) next.delete(subject);
        else next.add(subject);
        return next;
      });
      return;
    }
    loadSchemaDetail(subject);
  }, [isBulkMode, loadSchemaDetail]);

  const handleItemKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, subject: string, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isBulkMode) {
        setBulkSelected((prev) => {
          const next = new Set(prev);
          if (next.has(subject)) next.delete(subject);
          else next.add(subject);
          return next;
        });
      } else {
        loadSchemaDetail(subject);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(Math.min(index + 1, filteredSubjects.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(Math.max(index - 1, 0));
    } else if (e.key === 'Escape' && isBulkMode) {
      e.preventDefault();
      exitBulkMode();
    }
  }, [isBulkMode, loadSchemaDetail, filteredSubjects.length, exitBulkMode]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && filteredSubjects.length > 0) {
      e.preventDefault();
      setFocusedIndex(0);
    }
  };

  const handleBulkDeleteConfirm = useCallback(async () => {
    setBulkDeleting(true);
    setBulkConfirmOpen(false);
    const toDelete = Array.from(bulkSelected);
    try {
      await Promise.all(toDelete.map((s) => schemaRegistryApi.deleteSubject(s)));
      // Clean up local datasets for deleted subjects
      const { schemaDatasets, deleteSchemaDataset } = useWorkspaceStore.getState();
      for (const subject of toDelete) {
        for (const ds of schemaDatasets) {
          if (ds.schemaSubject === subject) deleteSchemaDataset(ds.id);
        }
      }
      addToast({ type: 'success', message: `Deleted ${toDelete.length} subject${toDelete.length !== 1 ? 's' : ''}` });
      exitBulkMode();
      await loadSchemaRegistrySubjects();
    } catch (err) {
      addToast({ type: 'error', message: `Delete failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkSelected, addToast, exitBulkMode, loadSchemaRegistrySubjects]);

  // Phase 12.6 F3: Show skeleton only on initial mount while loading
  if (loading && !hasLoadedOnce) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--color-surface-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '0 8px',
              height: 32,
              flex: 1,
              minWidth: 0,
            }}
          >
            <FiSearch size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} aria-hidden="true" />
            <input
              type="text"
              placeholder="Filter subjects..."
              disabled
              aria-label="Filter schema subjects"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--color-text-primary)', minWidth: 0 }}
            />
          </div>
        </div>
        <SkeletonRows count={5} />
      </div>
    );
  }

  // Active filter check — used to show "clear all" indicator
  const hasActiveFilters = typeFilter !== 'All Types' || compatFilter !== 'All Compat Modes' || debouncedQuery;

  return (
    <>
      <CreateSchema
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          loadSchemaRegistrySubjects();
        }}
      />

      {/* Bulk delete confirmation modal — mirrors TopicList ENH-5 dialog */}
      {bulkConfirmOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schema-bulk-delete-title"
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
              maxWidth: 440,
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <FiTrash2 size={16} style={{ color: 'var(--color-error)', flexShrink: 0 }} aria-hidden="true" />
              <h2 id="schema-bulk-delete-title" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Delete {bulkSelected.size} subject{bulkSelected.size !== 1 ? 's' : ''}?
              </h2>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                This action is permanent and cannot be undone. The following subjects will be deleted:
              </p>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--color-text-primary)', fontFamily: 'monospace', lineHeight: 1.8 }}>
                {Array.from(bulkSelected).slice(0, 5).map((name) => (
                  <li key={name}>{name}</li>
                ))}
                {bulkSelected.size > 5 && (
                  <li style={{ color: 'var(--color-text-tertiary)', fontFamily: 'inherit' }}>
                    …and {bulkSelected.size - 5} more
                  </li>
                )}
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setBulkConfirmOpen(false)}
                style={{ padding: '7px 16px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
                disabled={bulkDeleting}
                aria-label={`Confirm delete ${bulkSelected.size} subject${bulkSelected.size !== 1 ? 's' : ''}`}
                style={{ padding: '7px 16px', borderRadius: 4, border: 'none', background: 'var(--color-error)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: bulkDeleting ? 'not-allowed' : 'pointer', opacity: bulkDeleting ? 0.6 : 1 }}
              >
                Delete {bulkSelected.size} subject{bulkSelected.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Search input + bulk toggle + create button row */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {/* Search box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--color-surface-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '0 8px',
              height: 32,
              flex: 1,
              minWidth: 0,
            }}
          >
            <FiSearch size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} aria-hidden="true" />
            <input
              type="text"
              placeholder="Filter subjects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Filter schema subjects"
              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--color-text-primary)', minWidth: 0 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear filter"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'var(--color-text-tertiary)', borderRadius: 3, flexShrink: 0 }}
              >
                <FiX size={12} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Bulk mode toggle button */}
          {subjects.length > 0 && (
            <button
              onClick={() => isBulkMode ? exitBulkMode() : setIsBulkMode(true)}
              title={isBulkMode ? 'Exit bulk mode' : 'Select subjects for bulk delete'}
              aria-label={isBulkMode ? 'Exit bulk selection mode' : 'Enter bulk selection mode'}
              aria-pressed={isBulkMode}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                background: isBulkMode ? 'var(--color-primary-badge-bg)' : 'var(--color-surface)',
                color: isBulkMode ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'color var(--transition-fast), background var(--transition-fast)',
              }}
            >
              {isBulkMode ? <FiMinusSquare size={15} aria-hidden="true" /> : <FiCheckSquare size={15} aria-hidden="true" />}
            </button>
          )}

          {/* Create schema button — hidden in bulk mode */}
          {!isBulkMode && (
            <button
              onClick={() => setCreateOpen(true)}
              title="Create new schema subject"
              aria-label="Create new schema"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
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
              <FiPlus size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Bulk action bar — visible when isBulkMode */}
        {isBulkMode && (
          <div
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--color-surface-secondary)',
            }}
            role="toolbar"
            aria-label="Bulk selection actions"
          >
            {/* Select all toggle */}
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  setBulkSelected(new Set());
                } else {
                  setBulkSelected(new Set(filteredSubjects));
                }
              }}
              title={allSelected ? 'Clear all selections' : 'Select all subjects'}
              aria-label={allSelected ? 'Clear all selections' : 'Select all subjects'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: '3px 6px',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                borderRadius: 3,
              }}
            >
              <input
                type="checkbox"
                readOnly
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                style={{ cursor: 'pointer', margin: 0 }}
                aria-hidden="true"
              />
              <span>
                {allSelected ? 'Deselect all' : someSelected ? `${bulkSelected.size} selected` : 'Select all'}
              </span>
            </button>

            <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              {bulkSelected.size > 0 && !someSelected && !allSelected ? '' : ''}
            </span>

            {/* Delete button */}
            <button
              type="button"
              disabled={bulkSelected.size === 0 || bulkDeleting}
              onClick={() => setBulkConfirmOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 4,
                border: 'none',
                background: bulkSelected.size === 0 ? 'var(--color-border)' : 'var(--color-error)',
                color: bulkSelected.size === 0 ? 'var(--color-text-tertiary)' : 'var(--color-button-danger-text)',
                fontSize: 12,
                fontWeight: 500,
                cursor: bulkSelected.size === 0 ? 'not-allowed' : 'pointer',
                transition: 'background var(--transition-fast)',
              }}
              aria-label={`Delete ${bulkSelected.size} selected subject${bulkSelected.size !== 1 ? 's' : ''}`}
            >
              <FiTrash2 size={13} aria-hidden="true" />
              Delete{bulkSelected.size > 0 ? ` (${bulkSelected.size})` : ''}
            </button>
          </div>
        )}

        {/* Phase 12.6 F2: Type and Compat filter dropdowns */}
        <div
          style={{
            padding: '6px 12px',
            borderBottom: '1px solid var(--color-border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label htmlFor="schema-type-filter" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
              Type:
            </label>
            <select
              id="schema-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by schema type"
              style={{
                fontSize: 11,
                padding: '2px 4px',
                border: `1px solid ${typeFilter !== 'All Types' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 3,
                background: 'var(--color-surface)',
                color: typeFilter !== 'All Types' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label htmlFor="schema-compat-filter" style={{ fontSize: 11, color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
              Compat:
            </label>
            <select
              id="schema-compat-filter"
              value={compatFilter}
              onChange={(e) => setCompatFilter(e.target.value)}
              aria-label="Filter by compatibility mode"
              style={{
                fontSize: 11,
                padding: '2px 4px',
                border: `1px solid ${compatFilter !== 'All Compat Modes' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 3,
                background: 'var(--color-surface)',
                color: compatFilter !== 'All Compat Modes' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {COMPAT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Clear all filters shortcut */}
          {hasActiveFilters && (typeFilter !== 'All Types' || compatFilter !== 'All Compat Modes') && (
            <button
              onClick={() => { setTypeFilter('All Types'); setCompatFilter('All Compat Modes'); }}
              style={{ fontSize: 10, padding: '2px 6px', border: '1px solid var(--color-border)', borderRadius: 3, background: 'transparent', color: 'var(--color-text-tertiary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
              title="Clear type and compat filters"
            >
              Clear
            </button>
          )}

          {/* F3: Show loading spinner on re-fetch (not initial load) */}
          {loading && hasLoadedOnce && (
            <FiLoader size={12} className="history-spin" aria-hidden="true" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, marginLeft: 'auto' }} />
          )}
        </div>

        {/* Inline error banner */}
        {error && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
              backgroundColor: 'var(--color-error-badge-bg)',
              borderLeft: '3px solid var(--color-error)',
              fontSize: 12,
              color: 'var(--color-error)',
            }}
          >
            <FiAlertCircle size={13} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, lineHeight: 1.4 }}>{error}</span>
            <button className="history-retry-btn" onClick={loadSchemaRegistrySubjects} aria-label="Retry loading schemas" style={{ flexShrink: 0 }}>
              Retry
            </button>
          </div>
        )}

        {/* Subject count */}
        {subjects.length > 0 && (
          <div
            style={{
              padding: '4px 12px',
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
            }}
          >
            {(debouncedQuery || typeFilter !== 'All Types' || compatFilter !== 'All Compat Modes')
              ? `${filteredSubjects.length} of ${subjects.length} subjects`
              : `${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`}
          </div>
        )}

        {/* Subject list */}
        <div
          style={{ flex: 1, overflowY: 'auto' }}
          role="list"
          aria-label="Schema Registry subjects"
          aria-live="polite"
        >
          {filteredSubjects.length > 0 ? (
            filteredSubjects.map((subject, index) => (
              <div
                key={subject}
                role="listitem"
                tabIndex={0}
                onClick={() => handleItemClick(subject)}
                onKeyDown={(e) => handleItemKeyDown(e, subject, index)}
                ref={(el) => {
                  if (focusedIndex === index && el) el.focus();
                }}
                aria-label={`Schema subject: ${subject}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border)',
                  transition: 'background-color var(--transition-fast)',
                  outline: 'none',
                  background: isBulkMode && bulkSelected.has(subject) ? 'var(--color-primary-badge-bg)' : undefined,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = isBulkMode && bulkSelected.has(subject) ? 'var(--color-primary-badge-bg)' : ''; }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-bg-hover)';
                  (e.currentTarget as HTMLDivElement).style.outline = '2px solid var(--color-primary)';
                  (e.currentTarget as HTMLDivElement).style.outlineOffset = '-2px';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = isBulkMode && bulkSelected.has(subject) ? 'var(--color-primary-badge-bg)' : '';
                  (e.currentTarget as HTMLDivElement).style.outline = '';
                  (e.currentTarget as HTMLDivElement).style.outlineOffset = '';
                }}
              >
                {/* Checkbox — only visible in bulk mode */}
                {isBulkMode && (
                  <input
                    type="checkbox"
                    checked={bulkSelected.has(subject)}
                    readOnly
                    aria-label={`Select ${subject}`}
                    style={{ cursor: 'pointer', margin: 0, flexShrink: 0, pointerEvents: 'none' }}
                  />
                )}
                <FiFileText size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} aria-hidden="true" />
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                  }}
                  title={subject}
                >
                  {subject}
                </span>
                {/* ORIG-8: Type badge */}
                {schemaTypeCache[subject] && (
                  <span
                    style={{
                      ...getSchemaTypeBadgeStyle(schemaTypeCache[subject]),
                      padding: '1px 5px',
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                    }}
                    title={`Schema type: ${schemaTypeCache[subject]}`}
                    aria-label={`Type: ${schemaTypeCache[subject]}`}
                  >
                    {schemaTypeCache[subject]}
                  </span>
                )}
                {!isBulkMode && (
                  <FiChevronRight size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} aria-hidden="true" />
                )}
              </div>
            ))
          ) : subjects.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: 32,
                color: 'var(--color-text-tertiary)',
                textAlign: 'center',
              }}
            >
              <FiFileText size={28} aria-hidden="true" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, color: 'var(--color-text-secondary)' }}>
                  No schemas found
                </div>
                <div style={{ fontSize: 12 }}>
                  Schemas registered in Confluent Schema Registry will appear here.
                </div>
              </div>
              <button
                onClick={() => setCreateOpen(true)}
                title="Create a new schema subject"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 14px',
                  border: '1px solid var(--color-primary)',
                  background: 'transparent',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                }}
              >
                <FiPlus size={13} aria-hidden="true" />
                Create Schema
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 32,
                color: 'var(--color-text-tertiary)',
                textAlign: 'center',
              }}
            >
              <FiSearch size={22} aria-hidden="true" />
              <div style={{ fontSize: 13 }}>
                {(typeFilter !== 'All Types' || compatFilter !== 'All Compat Modes')
                  ? 'No subjects match the current filters.'
                  : <>No results for &ldquo;{debouncedQuery}&rdquo;</>}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SchemaList;
