/**
 * Kafka REST Proxy Client — Topic Management
 *
 * Provides CRUD operations for Kafka topics, partition inspection, config
 * management, and record production via the Confluent Kafka REST Proxy v3 API.
 * All requests go through `kafkaRestClient` which handles auth and base URL.
 *
 * Topics are scoped to a single Kafka cluster identified by `env.kafkaClusterId`.
 */
import { kafkaRestClient } from './kafka-rest-client';
import { env } from '../config/environment';
import type { KafkaTopic, TopicConfig, KafkaPartition, PartitionOffsets, ProduceRecord, ProduceResult } from '../types';

// Convenience helper — avoids repeating cluster path in every call
const clusterPath = () => `/kafka/v3/clusters/${env.kafkaClusterId}`;

/**
 * Regex to identify Confluent-internal system topics that should be hidden from the UI.
 *
 * Matches three families of internal topic names:
 * - `_schemas*`       — Schema Registry's internal storage topic (e.g. `_schemas`).
 * - `_confluent-*`    — Confluent Platform internal topics (e.g. `_confluent-metrics`,
 *                        `_confluent-command`).
 * - `__confluent.*`   — Confluent Cloud internal topics using either dot or dash as
 *   / `__confluent-*`   separator (e.g. `__confluent.telemetry`, `__confluent-balancer`).
 */
const SYSTEM_TOPIC_PATTERN = /^(_schemas.*|_confluent-.*|__confluent[-.].*)/ ;

/**
 * List all user-facing Kafka topics, filtering out system/internal topics.
 *
 * Excludes topics that are either flagged `is_internal` by the broker or match
 * the {@link SYSTEM_TOPIC_PATTERN} regex. Optionally narrows results to topics
 * whose name contains `filterUniqueId` (used for multi-user session isolation).
 *
 * @param filterUniqueId - If provided, only return topics whose name includes this string.
 * @returns Array of KafkaTopic objects for user-visible topics.
 */
export async function listTopics(filterUniqueId?: string): Promise<KafkaTopic[]> {
  const response = await kafkaRestClient.get<{ data: KafkaTopic[] }>(
    `${clusterPath()}/topics`
  );
  return response.data.data.filter(
    topic => {
      const isSystem = topic.is_internal || SYSTEM_TOPIC_PATTERN.test(topic.topic_name);
      if (isSystem) return false;
      if (filterUniqueId && !topic.topic_name.includes(filterUniqueId)) return false;
      return true;
    }
  );
}

/**
 * Fetch a single topic's metadata by name.
 *
 * Currently reserved for future per-topic detail refresh (Phase 12.4) and is not
 * yet called from the UI. Available for use when individual topic reload is needed
 * without re-fetching the full topic list.
 *
 * @param topicName - The Kafka topic name to fetch.
 * @returns The KafkaTopic object with full metadata.
 */
export async function getTopicDetail(topicName: string): Promise<KafkaTopic> {
  const response = await kafkaRestClient.get<KafkaTopic>(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}`
  );
  return response.data;
}

/**
 * Fetch configuration entries for a specific topic (e.g. retention.ms, cleanup.policy).
 *
 * Accepts an optional `AbortSignal` so callers can cancel in-flight HTTP requests
 * when the user navigates away or selects a different topic. This prevents stale
 * responses from overwriting the UI. Axios forwards the signal natively to the
 * underlying XHR/fetch layer.
 *
 * @param topicName - The Kafka topic name.
 * @param signal - Optional AbortSignal for request cancellation (e.g. from an AbortController
 *                 in a React useEffect cleanup).
 * @returns Array of TopicConfig objects (name, value, is_default, etc.).
 */
export async function getTopicConfigs(topicName: string, signal?: AbortSignal): Promise<TopicConfig[]> {
  const response = await kafkaRestClient.get<{ data: TopicConfig[] }>(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}/configs`,
    { signal }
  );
  return response.data.data;
}

/**
 * Create a new Kafka topic.
 *
 * @param request - Topic creation parameters: name, partition count, replication
 *                  factor, and optional config overrides.
 * @returns The newly created KafkaTopic object.
 */
export async function createTopic(request: {
  topic_name: string;
  partitions_count: number;
  replication_factor: number;
  configs?: Array<{ name: string; value: string }>;
}): Promise<KafkaTopic> {
  const response = await kafkaRestClient.post<KafkaTopic>(
    `${clusterPath()}/topics`,
    request
  );
  return response.data;
}

/** Delete a Kafka topic by name. This is irreversible. */
export async function deleteTopic(topicName: string): Promise<void> {
  await kafkaRestClient.delete(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}`
  );
}

/**
 * Update a single topic-level configuration entry (e.g. set retention.ms to "86400000").
 * Uses the `:alter` batch endpoint with a single-item payload.
 */
export async function alterTopicConfig(topicName: string, configName: string, value: string): Promise<void> {
  await kafkaRestClient.post(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}/configs:alter`,
    { data: [{ name: configName, value }] }
  );
}

/** List all partitions for a topic, including leader/replica assignment info. */
export async function getTopicPartitions(topicName: string): Promise<KafkaPartition[]> {
  const response = await kafkaRestClient.get<{ data: KafkaPartition[] }>(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}/partitions`
  );
  return response.data.data;
}

/** Get earliest and latest offsets for a specific partition (useful for lag calculation). */
export async function getPartitionOffsets(topicName: string, partitionId: number): Promise<PartitionOffsets> {
  const response = await kafkaRestClient.get<PartitionOffsets>(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}/partitions/${partitionId}/offsets`
  );
  return response.data;
}

/**
 * Produce a single record to a Kafka topic via the REST Proxy.
 *
 * The `record` object follows the Kafka REST Proxy v3 format:
 * - `key`: optional record key (object with `type` and `data` fields).
 * - `value`: record value (object with `type` and `data` fields).
 * - `partition_id`: optional target partition (omit to let the partitioner decide).
 *
 * @param topicName - The target Kafka topic name.
 * @param record - The record payload conforming to ProduceRecord type.
 * @param signal - Optional AbortSignal for request cancellation.
 * @returns ProduceResult with offset, partition, and timestamp of the produced record.
 */
export async function produceRecord(
  topicName: string,
  record: ProduceRecord,
  signal?: AbortSignal
): Promise<ProduceResult> {
  const response = await kafkaRestClient.post<ProduceResult>(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}/records`,
    record,
    { signal }
  );
  return response.data;
}
