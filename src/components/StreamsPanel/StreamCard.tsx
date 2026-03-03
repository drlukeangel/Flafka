import { useState, useRef, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';
import * as topicApi from '../../api/topic-api';
import * as flinkApi from '../../api/flink-api';
import { generateSyntheticRecord } from '../../utils/synthetic-data';
import { serializeToConfluentBinary } from '../../utils/confluent-serializer';
import { StreamCardTable } from './StreamCardTable';
import { FiPlay, FiSquare, FiChevronDown, FiChevronUp, FiX, FiRefreshCw, FiCopy } from 'react-icons/fi';
import type { BackgroundStatement, ProduceRecord } from '../../types';
import './StreamCard.css';

/** Generate a simple random value for a Flink SQL column type */
function generateValueForType(type: string): unknown {
  const t = type.toUpperCase();
  if (t.includes('INT') || t === 'BIGINT' || t === 'SMALLINT' || t === 'TINYINT')
    return Math.floor(Math.random() * 10000);
  if (t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL'))
    return +(Math.random() * 1000).toFixed(2);
  if (t.includes('BOOLEAN') || t === 'BOOL')
    return Math.random() > 0.5;
  if (t.includes('TIMESTAMP'))
    return new Date().toISOString();
  if (t.includes('DATE'))
    return new Date().toISOString().slice(0, 10);
  // Default: STRING / VARCHAR / CHAR / BYTES
  const prefixes = ['alpha', 'beta', 'gamma', 'delta', 'echo', 'foxtrot'];
  return prefixes[Math.floor(Math.random() * prefixes.length)] + '-' + Math.random().toString(36).slice(2, 7);
}

interface StreamCardProps {
  cardId: string;
  topicName: string;
  onRemove: () => void;
  onDuplicate: () => void;
}

export function StreamCard({ cardId, topicName, onRemove, onDuplicate }: StreamCardProps) {
  const catalog = useWorkspaceStore((s) => s.catalog);
  const database = useWorkspaceStore((s) => s.database);
  const executeBackgroundStatement = useWorkspaceStore((s) => s.executeBackgroundStatement);
  const cancelBackgroundStatement = useWorkspaceStore((s) => s.cancelBackgroundStatement);
  const backgroundStatements = useWorkspaceStore((s) => s.backgroundStatements);
  const schemaDatasets = useWorkspaceStore((s) => s.schemaDatasets);
  const navigateToSchemaDatasets = useWorkspaceStore((s) => s.navigateToSchemaDatasets);

  const [mode, setMode] = useState<'consume' | 'produce-consume'>('consume');
  const [dataSource, setDataSource] = useState<'synthetic' | 'dataset'>('synthetic');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [burstMode, setBurstMode] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [datasetProgress, setDatasetProgress] = useState<{ sent: number; total: number } | null>(null);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProducing, setIsProducing] = useState(false);
  const [produceCount, setProduceCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [scanMode, setScanMode] = useState<'earliest-offset' | 'latest-offset'>('earliest-offset');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleFetchRef = useRef<() => void>(() => {});
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const contextId = cardId; // Each card gets its own background statement

  // Find the background statement for this card
  const bgStatement: BackgroundStatement | undefined = backgroundStatements.find(
    (s) => s.contextId === contextId
  );

  // Build SQL query - simple SELECT * (partition filtering done client-side)
  const buildFetchSQL = useCallback(() => {
    return `SELECT * FROM \`${catalog}\`.\`${database}\`.\`${topicName}\` LIMIT ${limit}`;
  }, [catalog, database, topicName, limit]);

  // Fetch messages
  const handleFetch = async () => {
    setError(null);
    try {
      await executeBackgroundStatement(contextId, buildFetchSQL(), scanMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch messages');
    }
  };

  // Keep ref in sync so interval always calls latest handleFetch (avoids stale closure)
  handleFetchRef.current = handleFetch;

  // Auto-refresh (live consume) — re-fetches when previous query completes
  const handleStartAutoRefresh = () => {
    setIsAutoRefreshing(true);
    handleFetch(); // Initial fetch
    autoRefreshRef.current = setInterval(() => {
      // Read latest store state directly — avoids stale closure from setInterval
      const currentBg = useWorkspaceStore.getState().backgroundStatements.find(
        (s) => s.contextId === contextId
      );
      // Stop auto-refresh on error — don't hide errors by immediately retrying
      if (currentBg?.status === 'ERROR') {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current);
          autoRefreshRef.current = null;
        }
        setIsAutoRefreshing(false);
        return;
      }
      if (!currentBg || currentBg.status === 'COMPLETED' || currentBg.status === 'CANCELLED' || currentBg.status === 'IDLE') {
        handleFetchRef.current();
      }
    }, 3000);
  };

  const handleStopAutoRefresh = () => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    setIsAutoRefreshing(false);
  };

  // Clean up auto-refresh on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, []);

  // Producer - stop (defined before start so it can be referenced)
  const handleStopProduce = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsProducing(false);
    setDatasetProgress(null);
  };

  // Producer - start (schema-aware: tries Schema Registry first, falls back to Flink DESCRIBE)
  const handleStartProduce = async () => {
    setError(null);
    try {
      // Try Schema Registry first — topics with Avro/Protobuf need proper serialization
      let schemaDetail: { schema: string; schemaType: string; id: number } | null = null;
      try {
        schemaDetail = await schemaRegistryApi.getSchemaDetail(`${topicName}-value`, 'latest');
      } catch {
        // No schema registered — will fall back to Flink DESCRIBE
      }

      let produceOne: () => Promise<void>;

      if (schemaDetail) {
        // Schema found — generate data matching the schema and serialize to Confluent wire format
        produceOne = async () => {
          const data = generateSyntheticRecord(schemaDetail!.schema, schemaDetail!.schemaType) as Record<string, unknown>;
          if ('error' in data) {
            throw new Error(`Schema generation failed: ${(data as any).error}`);
          }
          const binaryData = serializeToConfluentBinary(
            data, schemaDetail!.schema, schemaDetail!.schemaType, schemaDetail!.id
          );
          const record: ProduceRecord = {
            key: { type: 'JSON', data: { key: `${Date.now()}-${Math.random()}` } },
            value: binaryData
              ? { type: 'BINARY', data: binaryData }
              : { type: 'JSON', data },
          };
          const result = await topicApi.produceRecord(topicName, record);
          if (result.error_code && result.error_code >= 400) {
            throw new Error((result as any).message || `Produce error ${result.error_code}`);
          }
        };
      } else {
        // No schema — fall back to Flink DESCRIBE columns + raw JSON
        const columns = await flinkApi.getTableSchema(catalog, database, topicName);
        if (columns.length === 0) {
          setError('Could not get table schema. Check that the table exists.');
          return;
        }
        produceOne = async () => {
          const data: Record<string, unknown> = {};
          for (const col of columns) {
            data[col.name] = generateValueForType(col.type);
          }
          const record: ProduceRecord = {
            key: { type: 'JSON', data: { key: `${Date.now()}-${Math.random()}` } },
            value: { type: 'JSON', data },
          };
          const result = await topicApi.produceRecord(topicName, record);
          if (result.error_code && result.error_code >= 400) {
            throw new Error((result as any).message || `Produce error ${result.error_code}`);
          }
        };
      }

      setIsProducing(true);
      setProduceCount(0);

      intervalRef.current = setInterval(async () => {
        try {
          await produceOne();
          setProduceCount((prev) => prev + 1);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Produce failed');
          handleStopProduce();
        }
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start producer');
    }
  };

  // Auto-stop on unmount (handles React strict mode + card removal)
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Handle card removal
  const handleRemove = () => {
    handleStopProduce();
    cancelBackgroundStatement(contextId);
    onRemove();
  };

  // Datasets that match this topic's schema subject
  const schemaSubject = `${topicName}-value`;
  const topicDatasets = schemaDatasets.filter((ds) => ds.schemaSubject === schemaSubject);
  const selectedDataset = topicDatasets.find((ds) => ds.id === selectedDatasetId);

  // Dataset produce handler
  const handleStartDatasetProduce = async () => {
    if (!selectedDataset) return;
    setError(null);

    // Look up schema for serialization
    let schemaDetail;
    try {
      schemaDetail = await schemaRegistryApi.getSchemaDetail(schemaSubject, 'latest');
    } catch {
      setError(`No schema found for ${schemaSubject}. Check if the subject uses a different naming strategy.`);
      return;
    }

    setIsProducing(true);
    setDatasetProgress({ sent: 0, total: selectedDataset.records.length });

    if (burstMode) {
      // Burst: produce all at once
      try {
        await Promise.all(
          selectedDataset.records.map(async (rec) => {
            const binaryData = serializeToConfluentBinary(
              rec,
              schemaDetail.schema,
              schemaDetail.schemaType,
              schemaDetail.id
            );
            const record: ProduceRecord = {
              key: { type: 'JSON', data: { key: `${Date.now()}-${Math.random()}` } },
              value: binaryData
                ? { type: 'BINARY', data: binaryData }
                : { type: 'JSON', data: rec },
            };
            const result = await topicApi.produceRecord(topicName, record);
            if (result.error_code && result.error_code >= 400) {
              throw new Error((result as any).message || `Produce error ${result.error_code}`);
            }
          })
        );
        setDatasetProgress({ sent: selectedDataset.records.length, total: selectedDataset.records.length });
        setIsProducing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Dataset produce failed');
        setIsProducing(false);
      }
    } else {
      // Paced: 1/sec
      let idx = 0;
      intervalRef.current = setInterval(async () => {
        if (!selectedDataset) {
          handleStopProduce();
          return;
        }
        if (idx >= selectedDataset.records.length) {
          if (loopEnabled) {
            idx = 0;
          } else {
            handleStopProduce();
            setDatasetProgress({ sent: selectedDataset.records.length, total: selectedDataset.records.length });
            return;
          }
        }
        try {
          const rec = selectedDataset.records[idx];
          const binaryData = serializeToConfluentBinary(
            rec,
            schemaDetail.schema,
            schemaDetail.schemaType,
            schemaDetail.id
          );
          const record: ProduceRecord = {
            key: { type: 'JSON', data: { key: `${Date.now()}-${Math.random()}` } },
            value: binaryData
              ? { type: 'BINARY', data: binaryData }
              : { type: 'JSON', data: rec },
          };
          const result = await topicApi.produceRecord(topicName, record);
          if (result.error_code && result.error_code >= 400) {
            throw new Error((result as any).message || `Produce error ${result.error_code}`);
          }
          idx++;
          setDatasetProgress({ sent: idx, total: selectedDataset.records.length });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Dataset produce failed');
          handleStopProduce();
        }
      }, 1000);
    }
  };

  // Mode switch safety — stop producing/auto-refresh when switching modes
  const handleModeChange = (newMode: 'consume' | 'produce-consume') => {
    if (mode === 'produce-consume' && newMode === 'consume' && isProducing) {
      handleStopProduce();
    }
    if (isAutoRefreshing) {
      handleStopAutoRefresh();
    }
    setMode(newMode);
    setDatasetProgress(null);
  };

  // Navigate to schema datasets panel
  const handleAddDataset = () => {
    navigateToSchemaDatasets(schemaSubject);
  };

  // Results + message count
  const resultRows = bgStatement?.results ?? [];
  const resultCount = resultRows.length;

  return (
    <div className="stream-card">
      <div className="stream-card-header">
        <span className="stream-card-topic-name" title={topicName}>{topicName}</span>
        <div className="stream-card-actions">
          {/* Mode selector */}
          <div className="stream-card-mode-selector" role="group" aria-label="Stream mode">
            <button
              className={`stream-card-mode-btn${mode === 'consume' ? ' stream-card-mode-btn--active' : ''}`}
              onClick={() => handleModeChange('consume')}
              title="Consume only"
            >
              Consume
            </button>
            <button
              className={`stream-card-mode-btn${mode === 'produce-consume' ? ' stream-card-mode-btn--active' : ''}`}
              onClick={() => handleModeChange('produce-consume')}
              title="Produce & Consume"
            >
              Produce
            </button>
          </div>
          {/* Duplicate */}
          <button
            className="stream-card-btn"
            onClick={onDuplicate}
            aria-label="Duplicate card"
            title="Duplicate"
          >
            <FiCopy size={14} />
          </button>
          {/* Collapse toggle */}
          <button
            className="stream-card-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand card' : 'Collapse card'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <FiChevronDown size={14} /> : <FiChevronUp size={14} />}
          </button>
          {/* Remove */}
          <button
            className="stream-card-btn stream-card-btn--remove"
            onClick={handleRemove}
            aria-label="Remove card"
            title="Remove"
          >
            <FiX size={14} />
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="stream-card-error">{error}</div>
      )}

      {/* Produce controls section (only in produce-consume mode) */}
      {mode === 'produce-consume' && !isCollapsed && (
        <div className="stream-card-produce-controls">
          {/* Source selector */}
          <div className="stream-card-source-row">
            <select
              className="stream-card-select"
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value as 'synthetic' | 'dataset')}
              aria-label="Data source"
            >
              <option value="synthetic">Synthetic</option>
              <option value="dataset">Dataset</option>
            </select>

            {dataSource === 'dataset' && (
              <>
                <select
                  className="stream-card-select"
                  value={selectedDatasetId ?? ''}
                  onChange={(e) => setSelectedDatasetId(e.target.value || null)}
                  aria-label="Select dataset"
                  disabled={topicDatasets.length === 0}
                >
                  {topicDatasets.length === 0 ? (
                    <option value="">No datasets — add one first</option>
                  ) : (
                    <>
                      <option value="">Select dataset...</option>
                      {topicDatasets.map((ds) => (
                        <option key={ds.id} value={ds.id}>{ds.name} ({ds.records.length})</option>
                      ))}
                    </>
                  )}
                </select>
                <button
                  className="stream-card-btn stream-card-btn--add-dataset"
                  onClick={handleAddDataset}
                  disabled={!schemaSubject}
                  title="Add test datasets for this topic"
                  aria-label={`Open schema datasets for ${topicName}`}
                >
                  +
                </button>
              </>
            )}
          </div>

          {dataSource === 'dataset' && selectedDataset && (
            <div className="stream-card-dataset-options">
              <label className="stream-card-checkbox-label">
                <input
                  type="checkbox"
                  checked={burstMode}
                  onChange={(e) => setBurstMode(e.target.checked)}
                />
                Burst
              </label>
              {!burstMode && (
                <label className="stream-card-checkbox-label">
                  <input
                    type="checkbox"
                    checked={loopEnabled}
                    onChange={(e) => setLoopEnabled(e.target.checked)}
                  />
                  Loop
                </label>
              )}
            </div>
          )}

          {/* Play/Stop + progress */}
          <div className="stream-card-produce-actions">
            <button
              className={`stream-card-btn${isProducing ? ' stream-card-btn--active' : ''}`}
              onClick={isProducing ? handleStopProduce : (dataSource === 'dataset' ? handleStartDatasetProduce : handleStartProduce)}
              aria-label={isProducing ? 'Stop producer' : 'Start producer'}
              title={isProducing ? 'Stop' : 'Start'}
              disabled={dataSource === 'dataset' && !selectedDataset}
            >
              {isProducing ? <FiSquare size={14} /> : <FiPlay size={14} />}
            </button>
            {isProducing && dataSource === 'synthetic' && (
              <span className="stream-card-progress" aria-live="polite">{produceCount} sent</span>
            )}
            {datasetProgress && (
              <span className="stream-card-progress" aria-live="polite">
                {datasetProgress.sent}/{datasetProgress.total} {datasetProgress.sent === datasetProgress.total ? 'complete' : 'sent'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Card body */}
      {!isCollapsed && (
        <div className="stream-card-body">
          <div className="stream-card-controls">
            {mode === 'consume' && (
              <select
                value={scanMode}
                onChange={(e) => setScanMode(e.target.value as 'earliest-offset' | 'latest-offset')}
                className="stream-card-select"
                aria-label="Scan mode"
              >
                <option value="earliest-offset">Earliest</option>
                <option value="latest-offset">Latest</option>
              </select>
            )}
            <span className="stream-card-msg-count" aria-live="polite">
              {resultCount} msgs
            </span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="stream-card-select"
              aria-label="Row limit"
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
            <button
              className="stream-card-fetch-btn"
              onClick={handleFetch}
              disabled={isAutoRefreshing}
              title="Fetch messages"
            >
              <FiRefreshCw size={12} />
              <span>{bgStatement ? 'Refresh' : 'Fetch'}</span>
            </button>
            <button
              className={`stream-card-btn stream-card-live-btn${isAutoRefreshing ? ' stream-card-btn--active' : ''}`}
              onClick={isAutoRefreshing ? handleStopAutoRefresh : handleStartAutoRefresh}
              aria-label={isAutoRefreshing ? 'Stop live stream' : 'Start live stream'}
              title={isAutoRefreshing ? 'Stop live' : 'Live'}
            >
              {isAutoRefreshing ? <FiSquare size={12} /> : <FiPlay size={12} />}
              <span>{isAutoRefreshing ? 'Stop' : 'Live'}</span>
            </button>
          </div>

          {/* Results Table */}
          {resultRows.length > 0 && bgStatement?.columns && (
            <StreamCardTable
              data={resultRows}
              columns={bgStatement.columns}
            />
          )}

          {bgStatement && resultRows.length === 0 && bgStatement.status !== 'PENDING' && bgStatement.status !== 'RUNNING' && (
            <div className="stream-card-no-data">No messages</div>
          )}

          {bgStatement && (bgStatement.status === 'PENDING' || bgStatement.status === 'RUNNING') && resultRows.length === 0 && (
            <div className="stream-card-loading">Fetching messages...</div>
          )}
        </div>
      )}
    </div>
  );
}
