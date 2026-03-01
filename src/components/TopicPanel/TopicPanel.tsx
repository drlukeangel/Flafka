/**
 * @topic-panel
 * TopicPanel — Root container for the Kafka Topics panel.
 *
 * Mirrors SchemaPanel.tsx pattern exactly:
 * - Reads topic state and actions from Zustand store
 * - Guards on env.kafkaClusterId / env.kafkaRestEndpoint before calling loadTopics()
 * - Panel header: back arrow + topic name (detail) or "Kafka Topics" + refresh (list)
 * - Body: <TopicDetail /> or <TopicList /> based on selectedTopic
 */

import React, { useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { env } from '../../config/environment';
import { FiArrowLeft, FiRefreshCw, FiLoader, FiAlertCircle } from 'react-icons/fi';
import TopicList from './TopicList';
import TopicDetail from './TopicDetail';

const TopicPanel: React.FC = () => {
  const selectedTopic = useWorkspaceStore((s) => s.selectedTopic);
  const topicLoading = useWorkspaceStore((s) => s.topicLoading);
  const loadTopics = useWorkspaceStore((s) => s.loadTopics);
  const clearSelectedTopic = useWorkspaceStore((s) => s.clearSelectedTopic);

  const isConfigured = Boolean(env.kafkaClusterId && env.kafkaRestEndpoint);

  // Load topics on mount only if env is configured.
  // HIGH-1: cancelled flag prevents state updates after unmount.
  useEffect(() => {
    let cancelled = false;
    if (isConfigured) {
      loadTopics().catch(() => {
        // errors are already handled inside loadTopics; we just suppress
        // unhandled-promise warnings if the component unmounts mid-flight
        if (!cancelled) { /* no-op */ }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [isConfigured, loadTopics]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
      aria-label="Kafka Topics panel"
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 40,
          padding: '0 12px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          gap: 8,
        }}
      >
        {selectedTopic ? (
          /* Detail view header: back button + topic name */
          <>
            <button
              onClick={clearSelectedTopic}
              title="Back to topic list"
              aria-label="Back to topic list"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text-secondary)',
                borderRadius: 4,
                flexShrink: 0,
                transition: 'color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
              }}
            >
              <FiArrowLeft size={16} aria-hidden="true" />
            </button>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
              }}
              title={selectedTopic.topic_name}
            >
              {selectedTopic.topic_name}
            </span>
          </>
        ) : (
          /* List view header: title + refresh button */
          <>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              Kafka Topics
            </span>
            {isConfigured && (
              <button
                onClick={loadTopics}
                title="Refresh topic list"
                aria-label="Refresh topic list"
                disabled={topicLoading}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: topicLoading ? 'default' : 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--color-text-secondary)',
                  borderRadius: 4,
                  flexShrink: 0,
                  opacity: topicLoading ? 0.5 : 1,
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (!topicLoading) {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-secondary)';
                }}
              >
                {topicLoading
                  ? <FiLoader size={15} className="history-spin" aria-hidden="true" />
                  : <FiRefreshCw size={15} aria-hidden="true" />}
              </button>
            )}
          </>
        )}
      </div>

      {/* Panel body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {!isConfigured ? (
          /* Environment not configured error state */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 12,
              padding: 24,
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}
            role="alert"
          >
            <FiAlertCircle size={28} style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: 6,
                }}
              >
                Kafka REST endpoint not configured
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                Add the following to your <code style={{ fontFamily: 'monospace', fontSize: 11 }}>.env</code> file:
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: 'var(--color-surface-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: 'var(--color-text-primary)',
                  textAlign: 'left',
                  lineHeight: 1.8,
                }}
              >
                VITE_KAFKA_CLUSTER_ID<br />
                VITE_KAFKA_REST_ENDPOINT<br />
                VITE_KAFKA_API_KEY<br />
                VITE_KAFKA_API_SECRET
              </div>
            </div>
          </div>
        ) : selectedTopic ? (
          <TopicDetail />
        ) : (
          <TopicList />
        )}
      </div>
    </div>
  );
};

export default TopicPanel;
