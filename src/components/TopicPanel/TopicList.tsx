/**
 * @topic-list @topic-panel
 * TopicList — Searchable list of Kafka topics.
 *
 * Mirrors SchemaList.tsx pattern exactly:
 * - Debounced search (300ms)
 * - Keyboard navigation with focusedIndex state
 * - Loading / error / empty / no-results states
 * - Count bar: "N topics" or "N of M topics"
 * - Create button opens CreateTopic modal
 *
 * R2-VS: scrollToIndex called when focusedIndex changes (keyboard nav now scrolls item into view)
 * R2-DEB: focusedIndex reset synchronously on searchQuery change (not just debounced)
 * R2-COPY: hover state managed via React state (no DOM query flicker)
 * LOW-2: focus restored to lastFocusedTopicName row on back-nav (via Zustand store)
 * ENH-5: bulk delete mode — multi-select checkboxes, action bar, confirmation dialog
 * F6: composite health score dot (green/yellow/red) replaces single FiAlertTriangle badge
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  FiSearch,
  FiX,
  FiLoader,
  FiServer,
  FiChevronRight,
  FiAlertCircle,
  FiPlus,
  FiTrash2,
  FiCheckSquare,
  FiSquare,
  FiMinusSquare,
} from 'react-icons/fi';
import CreateTopic from './CreateTopic';
import type { KafkaTopic } from '../../types';

// MED-2: Row height for virtualizer
const ITEM_HEIGHT = 41; // 8px top + 8px bottom padding + ~25px content + 1px border

// ---------------------------------------------------------------------------
// F6: Composite topic health score
// ---------------------------------------------------------------------------

type HealthLevel = 'green' | 'yellow' | 'red';

interface HealthScore {
  level: HealthLevel;
  warnings: string[];
}

/**
 * F6: Compute a composite health score from available list-level topic data.
 * - green: all checks pass
 * - yellow: exactly one warning
 * - red: two or more warnings
 *
 * Checks (no extra API calls — uses existing list data):
 * 1. partition count < 2 → "Low partition count (no parallelism)"
 * 2. replication factor < 2 → "Low replication factor (no fault tolerance)"
 */
function computeHealthScore(topic: KafkaTopic): HealthScore {
  const warnings: string[] = [];
  if (topic.partitions_count < 2) {
    warnings.push('Low partition count — no parallelism');
  }
  if (topic.replication_factor < 2) {
    warnings.push('Low replication factor — no fault tolerance');
  }
  const level: HealthLevel =
    warnings.length === 0 ? 'green' : warnings.length === 1 ? 'yellow' : 'red';
  return { level, warnings };
}

const HEALTH_DOT_COLORS: Record<HealthLevel, string> = {
  green: 'var(--color-success)',
  yellow: 'var(--color-warning)',
  red: 'var(--color-error)',
};

const TopicList: React.FC = () => {
  const topics = useWorkspaceStore((s) => s.topicList);
  const loading = useWorkspaceStore((s) => s.topicLoading);
  const error = useWorkspaceStore((s) => s.topicError);
  const loadTopics = useWorkspaceStore((s) => s.loadTopics);
  const selectTopic = useWorkspaceStore((s) => s.selectTopic);
  const addToast = useWorkspaceStore((s) => s.addToast);
  // LOW-2: read lastFocusedTopicName from store for back-nav restore
  const lastFocusedTopicName = useWorkspaceStore((s) => s.lastFocusedTopicName);
  const setLastFocusedTopicName = useWorkspaceStore((s) => s.setLastFocusedTopicName);
  // ENH-5: bulk delete state
  const isBulkMode = useWorkspaceStore((s) => s.isBulkMode);
  const bulkSelectedTopics = useWorkspaceStore((s) => s.bulkSelectedTopics);
  const enterBulkMode = useWorkspaceStore((s) => s.enterBulkMode);
  const exitBulkMode = useWorkspaceStore((s) => s.exitBulkMode);
  const toggleBulkTopicSelection = useWorkspaceStore((s) => s.toggleBulkTopicSelection);
  const selectAllBulkTopics = useWorkspaceStore((s) => s.selectAllBulkTopics);
  const clearBulkSelection = useWorkspaceStore((s) => s.clearBulkSelection);
  const deleteTopicsBulk = useWorkspaceStore((s) => s.deleteTopicsBulk);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [createOpen, setCreateOpen] = useState(false);
  // ENH-5: confirmation dialog state
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // MED-2: scrollable container ref for virtualizer
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // R2-DEB: reset focusedIndex whenever debounced filter changes (secondary safety net)
  useEffect(() => {
    setFocusedIndex(-1);
  }, [debouncedQuery]);

  const filteredTopics = topics.filter((t) =>
    t.topic_name.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  // MED-2: @tanstack/react-virtual for 1000+ topic lists
  const rowVirtualizer = useVirtualizer({
    count: filteredTopics.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  // LOW-2: restore focus to previously selected topic when list mounts (back-nav)
  useEffect(() => {
    if (!lastFocusedTopicName || filteredTopics.length === 0) return;
    const idx = filteredTopics.findIndex((t) => t.topic_name === lastFocusedTopicName);
    if (idx === -1) return;
    // Scroll into view then focus — optional chaining guards jsdom test environment
    rowVirtualizer.scrollToIndex?.(idx, { align: 'auto' });
    // Use a rAF to allow the scroll and virtual render to settle before focusing
    const rafId = requestAnimationFrame(() => {
      const el = listContainerRef.current?.querySelector<HTMLElement>(
        `[data-topic-name="${CSS.escape(lastFocusedTopicName)}"]`
      );
      if (el) {
        el.focus();
      }
      // Clear the stored name so it doesn't re-trigger on next render
      setLastFocusedTopicName(null);
    });
    return () => cancelAnimationFrame(rafId);
  // Only run once when this component first mounts (back-nav)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // R2-VS: scroll focused item into view when focusedIndex changes via keyboard nav
  // Optional chaining guards jsdom test environment where scrollToIndex may be absent.
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < filteredTopics.length) {
      rowVirtualizer.scrollToIndex?.(focusedIndex, { align: 'auto' });
    }
  }, [focusedIndex, filteredTopics.length, rowVirtualizer]);

  const handleItemClick = useCallback((topic: KafkaTopic) => {
    if (isBulkMode) {
      toggleBulkTopicSelection(topic.topic_name);
      return;
    }
    selectTopic(topic);
  }, [isBulkMode, selectTopic, toggleBulkTopicSelection]);

  const handleItemKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLDivElement>,
    topic: KafkaTopic,
    index: number
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isBulkMode) {
        toggleBulkTopicSelection(topic.topic_name);
      } else {
        selectTopic(topic);
      }
    } else if (e.key === ' ') {
      e.preventDefault();
      if (isBulkMode) {
        toggleBulkTopicSelection(topic.topic_name);
      } else {
        selectTopic(topic);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(Math.min(index + 1, filteredTopics.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(Math.max(index - 1, 0));
    } else if (e.key === 'Escape' && isBulkMode) {
      e.preventDefault();
      exitBulkMode();
    }
  }, [isBulkMode, selectTopic, toggleBulkTopicSelection, exitBulkMode, filteredTopics.length]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && filteredTopics.length > 0) {
      e.preventDefault();
      setFocusedIndex(0);
    }
  };

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    // R2-DEB: synchronous reset prevents stale index on fast Enter after typing
    setFocusedIndex(-1);
  }, []);

  // ENH-5: bulk delete confirm handler
  const handleBulkDeleteConfirm = useCallback(async () => {
    setBulkDeleting(true);
    setBulkConfirmOpen(false);
    const names = [...bulkSelectedTopics];
    try {
      const { deleted, failed } = await deleteTopicsBulk(names);
      if (failed.length === 0) {
        addToast({ type: 'success', message: `Deleted ${deleted.length} topic${deleted.length !== 1 ? 's' : ''}` });
      } else {
        addToast({
          type: 'error',
          message: `Deleted ${deleted.length} topic${deleted.length !== 1 ? 's' : ''}; ${failed.length} failed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`,
        });
      }
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkSelectedTopics, deleteTopicsBulk, addToast]);

  const allSelected = topics.length > 0 && bulkSelectedTopics.length === topics.length;
  const someSelected = bulkSelectedTopics.length > 0 && !allSelected;

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: 10,
          padding: 24,
          color: 'var(--color-text-secondary)',
          fontSize: 13,
        }}
        aria-live="polite"
        aria-label="Loading topics"
      >
        <FiLoader size={20} className="history-spin" aria-hidden="true" />
        <span>Loading topics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 10,
          padding: 16,
          color: 'var(--color-error)',
          fontSize: 13,
        }}
        role="alert"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiAlertCircle size={14} aria-hidden="true" />
          <span>{error}</span>
        </div>
        <button
          className="history-retry-btn"
          onClick={loadTopics}
          aria-label="Retry loading topics"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <CreateTopic
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          loadTopics();
        }}
      />

      {/* ENH-5: Bulk delete confirmation dialog */}
      {bulkConfirmOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1000,
            }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-title"
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0,
              }}
            >
              <FiTrash2 size={16} style={{ color: 'var(--color-error)', flexShrink: 0 }} aria-hidden="true" />
              <h2
                id="bulk-delete-title"
                style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}
              >
                Delete {bulkSelectedTopics.length} topic{bulkSelectedTopics.length !== 1 ? 's' : ''}?
              </h2>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
              }}
            >
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 13,
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                This action is permanent and cannot be undone. The following topics will be deleted:
              </p>
              <ul
                style={{
                  margin: 0,
                  padding: '0 0 0 16px',
                  fontSize: 12,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'monospace',
                  lineHeight: 1.8,
                }}
              >
                {bulkSelectedTopics.slice(0, 5).map((name) => (
                  <li key={name}>{name}</li>
                ))}
                {bulkSelectedTopics.length > 5 && (
                  <li style={{ color: 'var(--color-text-tertiary)', fontFamily: 'inherit' }}>
                    …and {bulkSelectedTopics.length - 5} more
                  </li>
                )}
              </ul>
            </div>
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
                onClick={() => setBulkConfirmOpen(false)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
                style={{
                  padding: '7px 16px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'var(--color-error)',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                aria-label={`Confirm delete ${bulkSelectedTopics.length} topic${bulkSelectedTopics.length !== 1 ? 's' : ''}`}
              >
                Delete {bulkSelectedTopics.length} topic{bulkSelectedTopics.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Search input + create button row */}
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
            <FiSearch
              size={13}
              style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Filter topics..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              aria-label="Filter topics"
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: 13,
                color: 'var(--color-text-primary)',
                minWidth: 0,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFocusedIndex(-1);
                }}
                aria-label="Clear filter"
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
                }}
              >
                <FiX size={12} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* ENH-5: bulk mode toggle button */}
          {topics.length > 0 && (
            <button
              onClick={() => {
                if (isBulkMode) {
                  exitBulkMode();
                } else {
                  enterBulkMode();
                }
              }}
              title={isBulkMode ? 'Exit bulk mode' : 'Select topics for bulk delete'}
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

          {/* Create topic button — hidden in bulk mode */}
          {!isBulkMode && (
            <button
              onClick={() => setCreateOpen(true)}
              title="Create new topic"
              aria-label="Create new topic"
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

        {/* ENH-5: Bulk action bar — visible when isBulkMode */}
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
            {/* Select all / indeterminate toggle */}
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  clearBulkSelection();
                } else {
                  selectAllBulkTopics();
                }
              }}
              title={allSelected ? 'Clear all selections' : 'Select all topics'}
              aria-label={allSelected ? 'Clear all selections' : 'Select all topics'}
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
              {allSelected ? (
                <FiCheckSquare size={14} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
              ) : someSelected ? (
                <FiMinusSquare size={14} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
              ) : (
                <FiSquare size={14} aria-hidden="true" />
              )}
              <span>
                {bulkSelectedTopics.length === 0
                  ? 'Select all'
                  : allSelected
                  ? 'Clear all'
                  : `${bulkSelectedTopics.length} selected`}
              </span>
            </button>

            <div style={{ flex: 1 }} />

            {/* Delete selected button — title provides accessible hint; text is the accessible name */}
            <button
              type="button"
              onClick={() => setBulkConfirmOpen(true)}
              disabled={bulkSelectedTopics.length === 0 || bulkDeleting}
              title={`Delete ${bulkSelectedTopics.length} selected topic${bulkSelectedTopics.length !== 1 ? 's' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-error)',
                background: 'transparent',
                color: bulkSelectedTopics.length === 0 ? 'var(--color-text-tertiary)' : 'var(--color-error)',
                fontSize: 12,
                fontWeight: 500,
                cursor: bulkSelectedTopics.length === 0 || bulkDeleting ? 'not-allowed' : 'pointer',
                opacity: bulkSelectedTopics.length === 0 || bulkDeleting ? 0.5 : 1,
                borderColor: bulkSelectedTopics.length === 0 ? 'var(--color-border)' : 'var(--color-error)',
              }}
            >
              {bulkDeleting
                ? <FiLoader size={12} className="history-spin" aria-hidden="true" />
                : <FiTrash2 size={12} aria-hidden="true" />}
              Delete{bulkSelectedTopics.length > 0 ? ` (${bulkSelectedTopics.length})` : ''}
            </button>

            {/* Cancel bulk mode */}
            <button
              type="button"
              onClick={exitBulkMode}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
              aria-label="Cancel bulk selection"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Topic count bar */}
        {topics.length > 0 && (
          <div
            style={{
              padding: '4px 12px',
              fontSize: 11,
              color: 'var(--color-text-tertiary)',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
            }}
          >
            {debouncedQuery
              ? `${filteredTopics.length} of ${topics.length} topics`
              : `${topics.length} topic${topics.length !== 1 ? 's' : ''}`}
          </div>
        )}

        {/* Topic list — MED-2: virtualized for 1000+ topics */}
        <div
          ref={listContainerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
          }}
          role="list"
          aria-label="Kafka topics"
        >
          {filteredTopics.length > 0 ? (
            /* Virtual scroll container */
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const topic = filteredTopics[virtualRow.index];
                const index = virtualRow.index;
                const isChecked = isBulkMode && bulkSelectedTopics.includes(topic.topic_name);
                return (
              <div
                key={topic.topic_name}
                role="listitem"
                tabIndex={0}
                onClick={() => handleItemClick(topic)}
                onKeyDown={(e) => handleItemKeyDown(e, topic, index)}
                ref={(el) => {
                  if (focusedIndex === index && el) {
                    el.focus();
                  }
                }}
                aria-label={isBulkMode ? `${isChecked ? 'Deselect' : 'Select'} topic: ${topic.topic_name}` : `Topic: ${topic.topic_name}`}
                aria-checked={isBulkMode ? isChecked : undefined}
                data-index={virtualRow.index}
                data-topic-name={topic.topic_name}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border)',
                  transition: 'background-color var(--transition-fast)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: isChecked ? 'var(--color-primary-badge-bg)' : undefined,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = isChecked
                    ? 'var(--color-primary-badge-bg)'
                    : 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = isChecked
                    ? 'var(--color-primary-badge-bg)'
                    : '';
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-bg-hover)';
                  (e.currentTarget as HTMLDivElement).style.outline = '2px solid var(--color-primary)';
                  (e.currentTarget as HTMLDivElement).style.outlineOffset = '-2px';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = isChecked
                    ? 'var(--color-primary-badge-bg)'
                    : '';
                  (e.currentTarget as HTMLDivElement).style.outline = '';
                  (e.currentTarget as HTMLDivElement).style.outlineOffset = '';
                }}
              >
                {/* ENH-5: checkbox in bulk mode, server icon otherwise */}
                {isBulkMode ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: isChecked ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    {isChecked ? <FiCheckSquare size={15} /> : <FiSquare size={15} />}
                  </span>
                ) : (
                  <FiServer
                    size={14}
                    style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}
                    aria-hidden="true"
                  />
                )}
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                    minWidth: 0,
                  }}
                  title={topic.topic_name}
                >
                  {topic.topic_name}
                </span>
                {!isBulkMode && (
                  <>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-tertiary)',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {topic.partitions_count}p · RF:{topic.replication_factor}
                      {/* F6: composite health dot — green/yellow/red (hidden for healthy topics) */}
                      {(() => {
                        const health = computeHealthScore(topic);
                        // Only show dot if there are warnings (yellow or red) — zero visual noise for healthy topics
                        if (health.level === 'green') {
                          return null;
                        }
                        const tooltipText = health.warnings.join('; ');
                        return (
                          <span
                            role="img"
                            data-testid={`health-score-${topic.topic_name}`}
                            aria-label={`Health: ${health.level} — ${tooltipText}`}
                            title={tooltipText}
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: HEALTH_DOT_COLORS[health.level],
                              flexShrink: 0,
                            }}
                          />
                        );
                      })()}
                    </span>
                    <FiChevronRight
                      size={13}
                      style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
                      aria-hidden="true"
                    />
                  </>
                )}
              </div>
                );
              })}
            </div>
          ) : topics.length === 0 ? (
            /* Empty state — no topics exist */
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
              <FiServer size={28} aria-hidden="true" />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 4,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  No topics found
                </div>
                <div style={{ fontSize: 12 }}>
                  Kafka topics in your cluster will appear here.
                </div>
              </div>
              <button
                onClick={() => setCreateOpen(true)}
                title="Create a new topic"
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
                Create Topic
              </button>
            </div>
          ) : (
            /* No filter results */
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
                No results for &ldquo;{debouncedQuery}&rdquo;
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TopicList;
