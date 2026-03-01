import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AxiosError } from 'axios'
import {
  listTopics,
  getTopicDetail,
  getTopicConfigs,
  createTopic,
  deleteTopic,
} from '../../api/topic-api'
import { kafkaRestClient } from '../../api/kafka-rest-client'
import type { KafkaTopic, TopicConfig } from '../../types'

vi.mock('../../api/kafka-rest-client', () => ({
  kafkaRestClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeKafkaTopic(overrides: Partial<KafkaTopic> = {}): KafkaTopic {
  return {
    topic_name: overrides.topic_name ?? 'test-topic',
    is_internal: overrides.is_internal ?? false,
    replication_factor: overrides.replication_factor ?? 3,
    partitions_count: overrides.partitions_count ?? 6,
  }
}

function makeTopicConfig(overrides: Partial<TopicConfig> = {}): TopicConfig {
  return {
    name: overrides.name ?? 'retention.ms',
    value: overrides.value !== undefined ? overrides.value : '604800000',
    is_default: overrides.is_default ?? false,
    is_read_only: overrides.is_read_only ?? false,
    is_sensitive: overrides.is_sensitive ?? false,
  }
}

function makeAxiosError(status: number, message: string): AxiosError {
  const error = new AxiosError(message)
  error.response = {
    status,
    data: { message },
    statusText: String(status),
    headers: {},
    config: {} as AxiosError['config'],
  } as AxiosError['response']
  return error
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@topic-api] topic-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // listTopics
  // ==========================================================================

  describe('[@topic-api] listTopics', () => {
    it('returns mapped array and filters internal topics', async () => {
      const userTopic = makeKafkaTopic({ topic_name: 'orders', is_internal: false })
      const internalTopic = makeKafkaTopic({ topic_name: '__consumer_offsets', is_internal: true })

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: [userTopic, internalTopic] },
      })

      const result = await listTopics()

      expect(kafkaRestClient.get).toHaveBeenCalledOnce()
      expect(result).toHaveLength(1)
      expect(result[0].topic_name).toBe('orders')
      expect(result.some(t => t.topic_name === '__consumer_offsets')).toBe(false)
    })

    it('returns all user topics when none are internal', async () => {
      const topics = [
        makeKafkaTopic({ topic_name: 'orders' }),
        makeKafkaTopic({ topic_name: 'payments' }),
        makeKafkaTopic({ topic_name: 'shipments' }),
      ]

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: topics },
      })

      const result = await listTopics()

      expect(result).toHaveLength(3)
      expect(result.map(t => t.topic_name)).toEqual(['orders', 'payments', 'shipments'])
    })

    it('filters topics matching ^(_schemas|_confluent-.*) pattern', async () => {
      const userTopic = makeKafkaTopic({ topic_name: 'orders' })
      const schemasTopic = makeKafkaTopic({ topic_name: '_schemas', is_internal: false })
      const confluentMetrics = makeKafkaTopic({ topic_name: '_confluent-metrics', is_internal: false })
      const confluentCommand = makeKafkaTopic({ topic_name: '_confluent-command', is_internal: false })
      const confluentAudit = makeKafkaTopic({ topic_name: '_confluent-audit-log', is_internal: false })

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: {
          data: [userTopic, schemasTopic, confluentMetrics, confluentCommand, confluentAudit],
        },
      })

      const result = await listTopics()

      expect(result).toHaveLength(1)
      expect(result[0].topic_name).toBe('orders')
      expect(result.some(t => t.topic_name === '_schemas')).toBe(false)
      expect(result.some(t => t.topic_name === '_confluent-metrics')).toBe(false)
      expect(result.some(t => t.topic_name === '_confluent-command')).toBe(false)
      expect(result.some(t => t.topic_name === '_confluent-audit-log')).toBe(false)
    })

    it('CRIT-2: filters __confluent-* (double-underscore + hyphen) Confluent Control Center topics', async () => {
      const userTopic = makeKafkaTopic({ topic_name: 'orders' })
      const controlCenter = makeKafkaTopic({ topic_name: '__confluent-controlcenter-0', is_internal: false })
      const monitoring = makeKafkaTopic({ topic_name: '__confluent-monitoring-stats', is_internal: false })
      const ccInterceptors = makeKafkaTopic({ topic_name: '__confluent-controlcenter-command-interceptor-0', is_internal: false })

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: {
          data: [userTopic, controlCenter, monitoring, ccInterceptors],
        },
      })

      const result = await listTopics()

      expect(result).toHaveLength(1)
      expect(result[0].topic_name).toBe('orders')
      expect(result.some(t => t.topic_name === '__confluent-controlcenter-0')).toBe(false)
      expect(result.some(t => t.topic_name === '__confluent-monitoring-stats')).toBe(false)
      expect(result.some(t => t.topic_name === '__confluent-controlcenter-command-interceptor-0')).toBe(false)
    })

    it('CRIT-2: filters __confluent.* (double-underscore + dot) Confluent internal topics', async () => {
      const userTopic = makeKafkaTopic({ topic_name: 'payments' })
      const dotVariant = makeKafkaTopic({ topic_name: '__confluent.something', is_internal: false })

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: [userTopic, dotVariant] },
      })

      const result = await listTopics()

      expect(result).toHaveLength(1)
      expect(result[0].topic_name).toBe('payments')
      expect(result.some(t => t.topic_name === '__confluent.something')).toBe(false)
    })

    it('CRIT-2: user topics starting with "confluent" (no underscore prefix) are NOT filtered', async () => {
      const userTopic1 = makeKafkaTopic({ topic_name: 'confluent-events' })
      const userTopic2 = makeKafkaTopic({ topic_name: 'my-confluent-topic' })

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: [userTopic1, userTopic2] },
      })

      const result = await listTopics()

      expect(result).toHaveLength(2)
      expect(result.some(t => t.topic_name === 'confluent-events')).toBe(true)
      expect(result.some(t => t.topic_name === 'my-confluent-topic')).toBe(true)
    })

    it('filters both is_internal and system-topic-pattern topics in the same call', async () => {
      const topics = [
        makeKafkaTopic({ topic_name: 'user-events', is_internal: false }),
        makeKafkaTopic({ topic_name: '__consumer_offsets', is_internal: true }),
        makeKafkaTopic({ topic_name: '_schemas', is_internal: false }),
        makeKafkaTopic({ topic_name: '_confluent-metrics', is_internal: false }),
        makeKafkaTopic({ topic_name: 'product-catalog', is_internal: false }),
      ]

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: topics },
      })

      const result = await listTopics()

      expect(result).toHaveLength(2)
      expect(result.map(t => t.topic_name)).toEqual(['user-events', 'product-catalog'])
    })

    it('returns an empty array when all topics are filtered out', async () => {
      const topics = [
        makeKafkaTopic({ topic_name: '__consumer_offsets', is_internal: true }),
        makeKafkaTopic({ topic_name: '_schemas', is_internal: false }),
        makeKafkaTopic({ topic_name: '_confluent-metrics', is_internal: false }),
      ]

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: topics },
      })

      const result = await listTopics()

      expect(result).toHaveLength(0)
      expect(result).toEqual([])
    })

    it('returns an empty array when the cluster has no topics', async () => {
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      const result = await listTopics()

      expect(result).toEqual([])
    })

    it('handles topic names with dots', async () => {
      const topics = [
        makeKafkaTopic({ topic_name: 'my.topic.v1' }),
        makeKafkaTopic({ topic_name: 'data.events.raw' }),
      ]

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: topics },
      })

      const result = await listTopics()

      expect(result).toHaveLength(2)
      expect(result[0].topic_name).toBe('my.topic.v1')
      expect(result[1].topic_name).toBe('data.events.raw')
    })

    it('throws on 401 Unauthorized', async () => {
      const error = makeAxiosError(401, 'Unauthorized')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(listTopics()).rejects.toMatchObject({ response: { status: 401 } })
    })

    it('throws on 403 Forbidden', async () => {
      const error = makeAxiosError(403, 'Forbidden')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(listTopics()).rejects.toMatchObject({ response: { status: 403 } })
    })

    it('throws on 503 Service Unavailable', async () => {
      const error = makeAxiosError(503, 'Service Unavailable')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(listTopics()).rejects.toMatchObject({ response: { status: 503 } })
    })

    it('throws on network error (no response)', async () => {
      const error = new Error('Network Error')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(listTopics()).rejects.toThrow('Network Error')
    })
  })

  // ==========================================================================
  // getTopicDetail
  // ==========================================================================

  describe('[@topic-api] getTopicDetail', () => {
    it('returns a single topic', async () => {
      const topic = makeKafkaTopic({ topic_name: 'orders', partitions_count: 12, replication_factor: 3 })
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({ data: topic })

      const result = await getTopicDetail('orders')

      expect(result.topic_name).toBe('orders')
      expect(result.partitions_count).toBe(12)
      expect(result.replication_factor).toBe(3)
    })

    it('calls GET with the correct cluster path', async () => {
      const topic = makeKafkaTopic({ topic_name: 'orders' })
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({ data: topic })

      await getTopicDetail('orders')

      const calledUrl = vi.mocked(kafkaRestClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain('/topics/orders')
    })

    it('URL-encodes topic name with dots', async () => {
      const topic = makeKafkaTopic({ topic_name: 'my.topic.v1' })
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({ data: topic })

      await getTopicDetail('my.topic.v1')

      const calledUrl = vi.mocked(kafkaRestClient.get).mock.calls[0][0] as string
      // encodeURIComponent('my.topic.v1') === 'my.topic.v1' (dots are not encoded)
      // but it must be passed through encodeURIComponent safely — verify the segment is present
      expect(calledUrl).toContain(encodeURIComponent('my.topic.v1'))
    })

    it('URL-encodes topic name with special characters', async () => {
      const topicName = 'topic/with spaces+special'
      const topic = makeKafkaTopic({ topic_name: topicName })
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({ data: topic })

      await getTopicDetail(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent(topicName))
      // The raw unencoded name must NOT appear as a literal path segment
      expect(calledUrl).not.toContain('topic/with spaces')
    })

    it('throws on 404 Not Found', async () => {
      const error = makeAxiosError(404, 'Topic not found')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(getTopicDetail('missing-topic')).rejects.toMatchObject({
        response: { status: 404 },
      })
    })

    it('throws on network error', async () => {
      const error = new Error('Network Error')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(getTopicDetail('some-topic')).rejects.toThrow('Network Error')
    })

    it('throws on 401 Unauthorized', async () => {
      const error = makeAxiosError(401, 'Unauthorized')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(getTopicDetail('some-topic')).rejects.toMatchObject({
        response: { status: 401 },
      })
    })

    it('throws on 503 Service Unavailable', async () => {
      const error = makeAxiosError(503, 'Service Unavailable')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(getTopicDetail('some-topic')).rejects.toMatchObject({
        response: { status: 503 },
      })
    })
  })

  // ==========================================================================
  // getTopicConfigs
  // ==========================================================================

  describe('[@topic-api] getTopicConfigs', () => {
    it('returns configs array', async () => {
      const configs = [
        makeTopicConfig({ name: 'retention.ms', value: '604800000', is_default: false }),
        makeTopicConfig({ name: 'cleanup.policy', value: 'delete', is_default: true }),
      ]

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: configs },
      })

      const result = await getTopicConfigs('orders')

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('retention.ms')
      expect(result[0].value).toBe('604800000')
      expect(result[1].name).toBe('cleanup.policy')
      expect(result[1].is_default).toBe(true)
    })

    it('returns an empty array when topic has no configs', async () => {
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      const result = await getTopicConfigs('orders')

      expect(result).toEqual([])
    })

    it('calls GET with path ending in /configs', async () => {
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      await getTopicConfigs('orders')

      const calledUrl = vi.mocked(kafkaRestClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain('/topics/orders/configs')
    })

    it('URL-encodes topic name with special chars', async () => {
      const topicName = 'my.topic/v2+special'
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      await getTopicConfigs(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent(topicName))
      expect(calledUrl).toContain('/configs')
    })

    it('URL-encodes topic name with dots and hyphens', async () => {
      const topicName = 'my.topic-name_v1'
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      await getTopicConfigs(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent(topicName))
    })

    it('preserves null config values', async () => {
      const configs = [
        makeTopicConfig({ name: 'some.config', value: null }),
      ]

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: configs },
      })

      const result = await getTopicConfigs('orders')

      expect(result[0].value).toBeNull()
    })

    it('correctly maps is_sensitive flag', async () => {
      const configs = [
        makeTopicConfig({ name: 'ssl.keystore.password', value: null, is_sensitive: true }),
      ]

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: configs },
      })

      const result = await getTopicConfigs('orders')

      expect(result[0].is_sensitive).toBe(true)
    })

    it('throws on 403 Forbidden', async () => {
      const error = makeAxiosError(403, 'Forbidden — insufficient permissions')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(getTopicConfigs('orders')).rejects.toMatchObject({
        response: { status: 403 },
      })
    })

    it('throws on 503 Service Unavailable', async () => {
      const error = makeAxiosError(503, 'Service Unavailable')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(getTopicConfigs('orders')).rejects.toMatchObject({
        response: { status: 503 },
      })
    })

    it('throws on network error', async () => {
      const error = new Error('Network Error')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(getTopicConfigs('orders')).rejects.toThrow('Network Error')
    })

    it('throws on 404 when topic does not exist', async () => {
      const error = makeAxiosError(404, 'Topic not found')
      vi.mocked(kafkaRestClient.get).mockRejectedValueOnce(error)

      await expect(getTopicConfigs('missing-topic')).rejects.toMatchObject({
        response: { status: 404 },
      })
    })
  })

  // ==========================================================================
  // createTopic
  // ==========================================================================

  describe('[@topic-api] createTopic', () => {
    it('sends correct POST body and returns created topic', async () => {
      const created = makeKafkaTopic({
        topic_name: 'new-topic',
        partitions_count: 6,
        replication_factor: 3,
      })

      vi.mocked(kafkaRestClient.post).mockResolvedValueOnce({ data: created })

      const request = {
        topic_name: 'new-topic',
        partitions_count: 6,
        replication_factor: 3,
      }
      const result = await createTopic(request)

      expect(kafkaRestClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/topics'),
        request
      )
      expect(result.topic_name).toBe('new-topic')
      expect(result.partitions_count).toBe(6)
      expect(result.replication_factor).toBe(3)
    })

    it('sends configs array when provided', async () => {
      const created = makeKafkaTopic({ topic_name: 'retention-topic' })
      vi.mocked(kafkaRestClient.post).mockResolvedValueOnce({ data: created })

      const request = {
        topic_name: 'retention-topic',
        partitions_count: 3,
        replication_factor: 3,
        configs: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '604800000' },
        ],
      }
      await createTopic(request)

      const [, payload] = vi.mocked(kafkaRestClient.post).mock.calls[0] as [string, typeof request]
      expect(payload.configs).toHaveLength(2)
      expect(payload.configs![0]).toEqual({ name: 'cleanup.policy', value: 'delete' })
      expect(payload.configs![1]).toEqual({ name: 'retention.ms', value: '604800000' })
    })

    it('sends request without configs when configs not provided', async () => {
      const created = makeKafkaTopic({ topic_name: 'basic-topic' })
      vi.mocked(kafkaRestClient.post).mockResolvedValueOnce({ data: created })

      const request = {
        topic_name: 'basic-topic',
        partitions_count: 6,
        replication_factor: 3,
      }
      await createTopic(request)

      const [, payload] = vi.mocked(kafkaRestClient.post).mock.calls[0] as [string, typeof request]
      expect(payload.configs).toBeUndefined()
    })

    it('handles special chars in topic name (name is in JSON body, not URL path)', async () => {
      // topic_name in the POST body is NOT URL-encoded — it is a JSON string value
      const topicName = 'my-topic_v1.0'
      const created = makeKafkaTopic({ topic_name: topicName })
      vi.mocked(kafkaRestClient.post).mockResolvedValueOnce({ data: created })

      const request = {
        topic_name: topicName,
        partitions_count: 6,
        replication_factor: 3,
      }
      await createTopic(request)

      const [, payload] = vi.mocked(kafkaRestClient.post).mock.calls[0] as [string, typeof request]
      // Name must be preserved exactly as-is in the JSON body (no encoding)
      expect(payload.topic_name).toBe(topicName)
    })

    it('sends POST to the correct cluster topics endpoint', async () => {
      const created = makeKafkaTopic({ topic_name: 'new-topic' })
      vi.mocked(kafkaRestClient.post).mockResolvedValueOnce({ data: created })

      await createTopic({ topic_name: 'new-topic', partitions_count: 6, replication_factor: 3 })

      const [calledUrl] = vi.mocked(kafkaRestClient.post).mock.calls[0] as [string, unknown]
      expect(calledUrl).toContain('/topics')
    })

    it('throws on 409 Conflict (topic already exists)', async () => {
      const error = makeAxiosError(409, 'Topic "orders" already exists')
      vi.mocked(kafkaRestClient.post).mockRejectedValueOnce(error)

      await expect(
        createTopic({ topic_name: 'orders', partitions_count: 6, replication_factor: 3 })
      ).rejects.toMatchObject({ response: { status: 409 } })
    })

    it('throws on 422 Unprocessable Entity (invalid request)', async () => {
      const error = makeAxiosError(422, 'Unprocessable Entity — replication factor too low')
      vi.mocked(kafkaRestClient.post).mockRejectedValueOnce(error)

      await expect(
        createTopic({ topic_name: 'bad-topic', partitions_count: 0, replication_factor: 1 })
      ).rejects.toMatchObject({ response: { status: 422 } })
    })

    it('throws on 403 Forbidden', async () => {
      const error = makeAxiosError(403, 'Forbidden — insufficient permissions')
      vi.mocked(kafkaRestClient.post).mockRejectedValueOnce(error)

      await expect(
        createTopic({ topic_name: 'new-topic', partitions_count: 6, replication_factor: 3 })
      ).rejects.toMatchObject({ response: { status: 403 } })
    })

    it('throws on network error', async () => {
      const error = new Error('Network Error')
      vi.mocked(kafkaRestClient.post).mockRejectedValueOnce(error)

      await expect(
        createTopic({ topic_name: 'new-topic', partitions_count: 6, replication_factor: 3 })
      ).rejects.toThrow('Network Error')
    })
  })

  // ==========================================================================
  // deleteTopic
  // ==========================================================================

  describe('[@topic-api] deleteTopic', () => {
    it('calls DELETE and resolves (204 No Content)', async () => {
      vi.mocked(kafkaRestClient.delete).mockResolvedValueOnce({ status: 204, data: undefined })

      await expect(deleteTopic('orders')).resolves.toBeUndefined()
      expect(kafkaRestClient.delete).toHaveBeenCalledOnce()
    })

    it('calls DELETE with path containing the topic name', async () => {
      vi.mocked(kafkaRestClient.delete).mockResolvedValueOnce({ status: 204, data: undefined })

      await deleteTopic('orders')

      const calledUrl = vi.mocked(kafkaRestClient.delete).mock.calls[0][0] as string
      expect(calledUrl).toContain('/topics/orders')
    })

    it('URL-encodes topic name', async () => {
      const topicName = 'my.topic/v2+special'
      vi.mocked(kafkaRestClient.delete).mockResolvedValueOnce({ status: 204, data: undefined })

      await deleteTopic(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.delete).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent(topicName))
      expect(calledUrl).not.toContain('my.topic/v2+special')
    })

    it('URL-encodes topic name with dots', async () => {
      const topicName = 'my.topic.v1'
      vi.mocked(kafkaRestClient.delete).mockResolvedValueOnce({ status: 204, data: undefined })

      await deleteTopic(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.delete).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent(topicName))
    })

    it('URL-encodes topic name with hyphens and underscores', async () => {
      const topicName = 'my-topic_v1'
      vi.mocked(kafkaRestClient.delete).mockResolvedValueOnce({ status: 204, data: undefined })

      await deleteTopic(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.delete).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent(topicName))
    })

    it('throws on 404 Not Found (topic does not exist)', async () => {
      const error = makeAxiosError(404, 'Topic not found')
      vi.mocked(kafkaRestClient.delete).mockRejectedValueOnce(error)

      await expect(deleteTopic('missing-topic')).rejects.toMatchObject({
        response: { status: 404 },
      })
    })

    it('throws on 403 Forbidden', async () => {
      const error = makeAxiosError(403, 'Forbidden — insufficient permissions to delete topic')
      vi.mocked(kafkaRestClient.delete).mockRejectedValueOnce(error)

      await expect(deleteTopic('orders')).rejects.toMatchObject({
        response: { status: 403 },
      })
    })

    it('throws on 401 Unauthorized', async () => {
      const error = makeAxiosError(401, 'Unauthorized')
      vi.mocked(kafkaRestClient.delete).mockRejectedValueOnce(error)

      await expect(deleteTopic('orders')).rejects.toMatchObject({
        response: { status: 401 },
      })
    })

    it('throws on network error', async () => {
      const error = new Error('Network Error')
      vi.mocked(kafkaRestClient.delete).mockRejectedValueOnce(error)

      await expect(deleteTopic('orders')).rejects.toThrow('Network Error')
    })

    it('throws on 503 Service Unavailable', async () => {
      const error = makeAxiosError(503, 'Service Unavailable')
      vi.mocked(kafkaRestClient.delete).mockRejectedValueOnce(error)

      await expect(deleteTopic('orders')).rejects.toMatchObject({
        response: { status: 503 },
      })
    })
  })

  // ==========================================================================
  // URL encoding — special character topic names across all functions
  // ==========================================================================

  describe('[@topic-api] URL encoding — special character topic names', () => {
    it('getTopicDetail encodes topic names with forward slashes', async () => {
      const topicName = 'namespace/topic-v1'
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: makeKafkaTopic({ topic_name: topicName }),
      })

      await getTopicDetail(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent(topicName))
      // Raw slash must not appear as a path separator after /topics/
      expect(calledUrl).not.toContain('/topics/namespace/topic-v1')
    })

    it('getTopicConfigs encodes topic names with colons (Confluent fully-qualified names)', async () => {
      const topicName = 'lkc-abc123:my-topic'
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      await getTopicConfigs(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent(topicName))
    })

    it('deleteTopic encodes topic names with percent signs', async () => {
      const topicName = 'topic%20name'
      vi.mocked(kafkaRestClient.delete).mockResolvedValueOnce({ status: 204, data: undefined })

      await deleteTopic(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.delete).mock.calls[0][0] as string
      // encodeURIComponent('topic%20name') encodes the % sign itself
      expect(calledUrl).toContain(encodeURIComponent(topicName))
    })

    it('getTopicDetail encodes topic names with spaces', async () => {
      const topicName = 'my topic name'
      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: makeKafkaTopic({ topic_name: topicName }),
      })

      await getTopicDetail(topicName)

      const calledUrl = vi.mocked(kafkaRestClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain(encodeURIComponent(topicName))
      expect(calledUrl).not.toContain('my topic name')
    })

    it('createTopic topic name in POST body is not URL-encoded (JSON string, not path segment)', async () => {
      const topicName = 'my/topic+name'
      const created = makeKafkaTopic({ topic_name: topicName })
      vi.mocked(kafkaRestClient.post).mockResolvedValueOnce({ data: created })

      const request = {
        topic_name: topicName,
        partitions_count: 6,
        replication_factor: 3,
      }
      await createTopic(request)

      const [, payload] = vi.mocked(kafkaRestClient.post).mock.calls[0] as [string, typeof request]
      // JSON body carries the raw name — encodeURIComponent is for URL path segments only
      expect(payload.topic_name).toBe(topicName)
    })
  })
})
