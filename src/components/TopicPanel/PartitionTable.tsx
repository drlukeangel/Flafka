/**
 * @partition-table @topic-panel
 * PartitionTable — Collapsible partition breakdown for a Kafka topic.
 *
 * - Collapsed by default; renders nothing until expanded
 * - Fetches partitions via getTopicPartitions() when expanded
 * - Fetches beginning/end offsets per partition via getPartitionOffsets()
 * - Displays: Partition ID, Leader broker ID, Replicas, ISR, Message count (end - beginning)
 * - Under-replicated partitions (isr.length < replicas.length): warning row style
 * - Leaderless partitions (leader === null): error row style
 * - Caps parallel offset fetches at 100 partitions
 * - Loading / error states with Retry
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as topicApi from '../../api/topic-api';
import type { KafkaPartition, PartitionOffsets } from '../../types';
import {
  FiChevronRight,
  FiChevronDown,
  FiLoader,
  FiAlertCircle,
  FiAlertTriangle,
} from 'react-icons/fi';

interface PartitionRow {
  partition: KafkaPartition;
  offsets: PartitionOffsets | null;
}

interface PartitionTableProps {
  topicName: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const PartitionTable: React.FC<PartitionTableProps> = ({ topicName, isExpanded, onToggle }) => {
  const [rows, setRows] = useState<PartitionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  // Track whether it's the initial mount so the reset effect doesn't clobber
  // a fetch that was triggered by the fetch effect on the same render cycle.
  const isFirstTopicRef = useRef(true);

  const fetchPartitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const partitions = await topicApi.getTopicPartitions(topicName);

      // Cap at 100 partitions to avoid excessive API calls
      const capped = partitions.slice(0, 100);

      // Parallel offset fetches via Promise.all
      const offsetResults = await Promise.all(
        capped.map((p) =>
          topicApi
            .getPartitionOffsets(topicName, p.partition_id)
            .then((offsets) => offsets)
            .catch(() => null)
        )
      );

      setRows(
        capped.map((partition, i) => ({
          partition,
          offsets: offsetResults[i],
        }))
      );
      setHasFetched(true);
      setLoading(false);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ||
        (err as { message?: string })?.message ||
        'Failed to load partitions';
      setError(msg);
      setLoading(false);
    }
  }, [topicName]);

  // Reset state when topicName changes (not on initial mount)
  useEffect(() => {
    if (isFirstTopicRef.current) {
      isFirstTopicRef.current = false;
      return;
    }
    setRows([]);
    setError(null);
    setHasFetched(false);
    setLoading(false);
  }, [topicName]);

  // Fetch when expanded for the first time (or after a topic reset)
  useEffect(() => {
    if (isExpanded && !hasFetched) {
      fetchPartitions();
    }
  }, [isExpanded, hasFetched, fetchPartitions]);

  const handleRetry = useCallback(() => {
    fetchPartitions();
  }, [fetchPartitions]);

  return (
    <div
      style={{
        borderTop: '1px solid var(--color-border)',
        marginTop: 8,
      }}
    >
      {/* Section header / toggle */}
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'Collapse partition table' : 'Expand partition table'}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-hover)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        {isExpanded
          ? <FiChevronDown size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} aria-hidden="true" />
          : <FiChevronRight size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} aria-hidden="true" />
        }
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Partitions
        </span>
        {rows.length > 0 && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              marginLeft: 2,
            }}
          >
            ({rows.length})
          </span>
        )}
      </button>

      {/* Partition content — only render when expanded */}
      {isExpanded && (
        <div style={{ paddingBottom: 8 }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 12px',
                color: 'var(--color-text-secondary)',
                fontSize: 12,
              }}
              aria-live="polite"
            >
              <FiLoader size={14} className="history-spin" aria-hidden="true" />
              <span>Loading partitions...</span>
            </div>
          ) : error ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 12px',
                color: 'var(--color-error)',
                fontSize: 12,
              }}
              role="alert"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FiAlertCircle size={13} aria-hidden="true" />
                <span>{error}</span>
              </div>
              <button
                className="history-retry-btn"
                onClick={handleRetry}
                aria-label="Retry loading partitions"
              >
                Retry
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div
              style={{
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--color-text-tertiary)',
              }}
            >
              No partitions found
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 11,
              }}
            >
              <thead>
                <tr>
                  {['ID', 'Leader', 'Replicas', 'ISR', 'Messages'].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '4px 12px',
                        textAlign: 'left',
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--color-text-tertiary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid var(--color-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ partition, offsets }) => {
                  const replicas = partition.replicas ?? [];
                  const isr = partition.isr ?? [];
                  const isUnderReplicated = replicas.length > 0 && isr.length < replicas.length;
                  const isLeaderless = partition.leader === null || partition.leader === undefined;
                  const messageCount =
                    offsets !== null
                      ? offsets.end_offset - offsets.beginning_offset
                      : null;

                  // Row styles based on health
                  const rowBg = isLeaderless
                    ? 'var(--color-error-badge-bg)'
                    : isUnderReplicated
                    ? 'var(--color-warning-badge-bg)'
                    : 'transparent';

                  const textColor = isLeaderless
                    ? 'var(--color-error)'
                    : isUnderReplicated
                    ? 'var(--color-warning)'
                    : 'var(--color-text-primary)';

                  return (
                    <tr
                      key={partition.partition_id}
                      style={{
                        background: rowBg,
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      {/* Partition ID */}
                      <td
                        style={{
                          padding: '5px 12px',
                          fontFamily: 'monospace',
                          color: textColor,
                          fontWeight: isLeaderless || isUnderReplicated ? 600 : 400,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isLeaderless && (
                            <FiAlertCircle
                              size={10}
                              aria-label="Leaderless partition"
                              style={{ color: 'var(--color-error)', flexShrink: 0 }}
                            />
                          )}
                          {!isLeaderless && isUnderReplicated && (
                            <FiAlertTriangle
                              size={10}
                              aria-label="Under-replicated partition"
                              style={{ color: 'var(--color-warning)', flexShrink: 0 }}
                            />
                          )}
                          {partition.partition_id}
                        </span>
                      </td>

                      {/* Leader broker ID */}
                      <td
                        style={{
                          padding: '5px 12px',
                          fontFamily: 'monospace',
                          color: isLeaderless ? 'var(--color-error)' : 'var(--color-text-primary)',
                        }}
                      >
                        {partition.leader !== null ? partition.leader.broker_id : (
                          <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>None</span>
                        )}
                      </td>

                      {/* Replicas */}
                      <td
                        style={{
                          padding: '5px 12px',
                          fontFamily: 'monospace',
                          color: 'var(--color-text-secondary)',
                          fontSize: 10,
                        }}
                      >
                        {replicas.length > 0 ? replicas.map((r) => r.broker_id).join(', ') : '—'}
                      </td>

                      {/* ISR */}
                      <td
                        style={{
                          padding: '5px 12px',
                          fontFamily: 'monospace',
                          color: isUnderReplicated
                            ? 'var(--color-warning)'
                            : 'var(--color-text-secondary)',
                          fontSize: 10,
                        }}
                      >
                        {isr.length > 0 ? isr.map((r) => r.broker_id).join(', ') : '—'}
                      </td>

                      {/* Messages (end - beginning offset) */}
                      <td
                        style={{
                          padding: '5px 12px',
                          fontFamily: 'monospace',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {messageCount !== null
                          ? messageCount.toLocaleString()
                          : <span style={{ color: 'var(--color-text-tertiary)' }}>&mdash;</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default PartitionTable;
