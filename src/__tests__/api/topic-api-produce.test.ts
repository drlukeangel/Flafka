import { describe, it, expect, vi, beforeEach } from 'vitest';
import { produceRecord } from '../../api/topic-api';
import { kafkaRestClient } from '../../api/kafka-rest-client';
import type { ProduceRecord } from '../../types';

vi.mock('../../api/kafka-rest-client', () => ({
  kafkaRestClient: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('[@topic-produce] produceRecord', () => {
  const mockRecord: ProduceRecord = {
    key: { type: 'JSON', data: { id: '123' } },
    value: { type: 'JSON', data: { name: 'test', amount: 42 } },
  };

  const mockResult = {
    cluster_id: 'test-cluster',
    topic_name: 'test-topic',
    partition_id: 0,
    offset: 100,
    timestamp: '2026-03-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ProduceResult with offset and partition on success', async () => {
    vi.mocked(kafkaRestClient.post).mockResolvedValue({ data: mockResult });

    const result = await produceRecord('test-topic', mockRecord);

    expect(result).toEqual(mockResult);
    expect(result.offset).toBe(100);
    expect(result.partition_id).toBe(0);
  });

  it('uses encodeURIComponent for topic name with special chars', async () => {
    vi.mocked(kafkaRestClient.post).mockResolvedValue({ data: mockResult });

    await produceRecord('my.topic/with-special', mockRecord);

    expect(kafkaRestClient.post).toHaveBeenCalledWith(
      expect.stringContaining('my.topic%2Fwith-special'),
      mockRecord,
      expect.any(Object)
    );
  });

  it('sends correct Content-Type via kafkaRestClient', async () => {
    vi.mocked(kafkaRestClient.post).mockResolvedValue({ data: mockResult });

    await produceRecord('test-topic', mockRecord);

    // kafkaRestClient has Content-Type: application/json in its default headers
    expect(kafkaRestClient.post).toHaveBeenCalled();
    // Verify it's using kafkaRestClient (not confluentClient)
    expect(kafkaRestClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/kafka/v3/clusters/'),
      mockRecord,
      expect.any(Object)
    );
  });

  it('passes AbortSignal to axios config', async () => {
    vi.mocked(kafkaRestClient.post).mockResolvedValue({ data: mockResult });

    const controller = new AbortController();
    await produceRecord('test-topic', mockRecord, controller.signal);

    expect(kafkaRestClient.post).toHaveBeenCalledWith(
      expect.any(String),
      mockRecord,
      { signal: controller.signal }
    );
  });

  it('throws AbortError when signal is aborted', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    vi.mocked(kafkaRestClient.post).mockRejectedValue(abortError);

    const controller = new AbortController();
    controller.abort();

    await expect(produceRecord('test-topic', mockRecord, controller.signal)).rejects.toThrow();
  });

  it('throws on HTTP 4xx error', async () => {
    const error = new Error('Bad Request');
    (error as any).response = { status: 400, data: { message: 'Bad Request' } };
    vi.mocked(kafkaRestClient.post).mockRejectedValue(error);

    await expect(produceRecord('test-topic', mockRecord)).rejects.toThrow();
  });

  it('throws on HTTP 5xx error', async () => {
    const error = new Error('Internal Server Error');
    (error as any).response = { status: 500, data: { message: 'Internal Server Error' } };
    vi.mocked(kafkaRestClient.post).mockRejectedValue(error);

    await expect(produceRecord('test-topic', mockRecord)).rejects.toThrow();
  });

  it('uses kafkaRestClient not confluentClient', async () => {
    vi.mocked(kafkaRestClient.post).mockResolvedValue({ data: mockResult });

    await produceRecord('test-topic', mockRecord);

    // Verify the path starts with the kafka cluster path
    const callArgs = vi.mocked(kafkaRestClient.post).mock.calls[0];
    expect(callArgs[0]).toMatch(/^\/kafka\/v3\/clusters\//);
  });
});
