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
  FiAlertTriangle,
  FiPlus,
} from 'react-icons/fi';
import CreateTopic from './CreateTopic';
import type { KafkaTopic } from '../../types';

// MED-2: Row height for virtualizer
const ITEM_HEIGHT = 41; // 8px top + 8px bottom padding + ~25px content + 1px border

const TopicList: React.FC = () => {
  const topics = useWorkspaceStore((s) => s.topicList);
  const loading = useWorkspaceStore((s) => s.topicLoading);
  const error = useWorkspaceStore((s) => s.topicError);
  const loadTopics = useWorkspaceStore((s) => s.loadTopics);
  const selectTopic = useWorkspaceStore((s) => s.selectTopic);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [createOpen, setCreateOpen] = useState(false);

  // MED-2: scrollable container ref for virtualizer
  const listContainerRef = useRef<HTMLDivElement>(null);
  // LOW-2: track last focused item ref for back-nav focus restore
  const lastFocusedTopicRef = useRef<string | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset focused index whenever filtered list changes
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

  const handleItemClick = useCallback((topic: KafkaTopic) => {
    // LOW-2: remember which topic was clicked for back-nav focus restore
    lastFocusedTopicRef.current = topic.topic_name;
    selectTopic(topic);
  }, [selectTopic]);

  const handleItemKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLDivElement>,
    topic: KafkaTopic,
    index: number
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      lastFocusedTopicRef.current = topic.topic_name;
      selectTopic(topic);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(Math.min(index + 1, filteredTopics.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(Math.max(index - 1, 0));
    }
  }, [selectTopic, filteredTopics.length]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && filteredTopics.length > 0) {
      e.preventDefault();
      setFocusedIndex(0);
    }
  };

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
              onChange={(e) => setSearchQuery(e.target.value)}
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
                onClick={() => setSearchQuery('')}
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

          {/* Create topic button */}
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
        </div>

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
                aria-label={`Topic: ${topic.topic_name}`}
                data-index={virtualRow.index}
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
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = '';
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--color-bg-hover)';
                  (e.currentTarget as HTMLDivElement).style.outline = '2px solid var(--color-primary)';
                  (e.currentTarget as HTMLDivElement).style.outlineOffset = '-2px';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = '';
                  (e.currentTarget as HTMLDivElement).style.outline = '';
                  (e.currentTarget as HTMLDivElement).style.outlineOffset = '';
                }}
              >
                <FiServer
                  size={14}
                  style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}
                  aria-hidden="true"
                />
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
                  {topic.partitions_count < 2 && (
                    <FiAlertTriangle
                      size={11}
                      style={{ color: 'var(--color-warning)', flexShrink: 0 }}
                      aria-label="Low partition count warning"
                      title="Single-partition topic — no parallelism"
                    />
                  )}
                </span>
                <FiChevronRight
                  size={13}
                  style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
                  aria-hidden="true"
                />
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
