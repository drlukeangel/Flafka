import { kafkaRestClient } from './kafka-rest-client';
import { env } from '../config/environment';
import type { KafkaTopic, TopicConfig } from '../types';

// Convenience helper — avoids repeating cluster path in every call
const clusterPath = () => `/kafka/v3/clusters/${env.kafkaClusterId}`;

// Pattern for Confluent system topics that should be hidden from the UI.
// CRIT-2: includes both `__confluent.` (dot) and `__confluent-` (dash) variants.
const SYSTEM_TOPIC_PATTERN = /^(_schemas.*|_confluent-.*|__confluent[-.].*)/ ;

export async function listTopics(): Promise<KafkaTopic[]> {
  const response = await kafkaRestClient.get<{ data: KafkaTopic[] }>(
    `${clusterPath()}/topics`
  );
  return response.data.data.filter(
    topic => !topic.is_internal && !SYSTEM_TOPIC_PATTERN.test(topic.topic_name)
  );
}

/**
 * Fetch a single topic by name.
 * @reserved Phase 12.4 — reserved for per-topic detail refresh; not yet called from UI.
 */
export async function getTopicDetail(topicName: string): Promise<KafkaTopic> {
  const response = await kafkaRestClient.get<KafkaTopic>(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}`
  );
  return response.data;
}

export async function getTopicConfigs(topicName: string): Promise<TopicConfig[]> {
  const response = await kafkaRestClient.get<{ data: TopicConfig[] }>(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}/configs`
  );
  return response.data.data;
}

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

export async function deleteTopic(topicName: string): Promise<void> {
  await kafkaRestClient.delete(
    `${clusterPath()}/topics/${encodeURIComponent(topicName)}`
  );
}
