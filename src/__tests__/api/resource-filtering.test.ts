import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listStatements, executeSQL } from '../../api/flink-api';
import { listTopics } from '../../api/topic-api';
import { listSubjects, registerSchema } from '../../api/schema-registry-api';
import { confluentClient } from '../../api/confluent-client';
import { kafkaRestClient } from '../../api/kafka-rest-client';
import { schemaRegistryClient } from '../../api/schema-registry-client';
import { env } from '../../config/environment';

vi.mock('../../api/confluent-client', () => ({
  confluentClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  handleApiError: (err: any) => err,
}));

vi.mock('../../api/kafka-rest-client', () => ({
  kafkaRestClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../api/schema-registry-client', () => ({
  schemaRegistryClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('[@api] [@filtering] Resource Filtering & Tagging', () => {
  const TEST_ID = env.uniqueId;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Flink Jobs (Statements) Filtering', () => {
    it('listStatements filters by uniqueId when provided', async () => {
      const allStmts = [
        { name: `job-1-${TEST_ID}` },
        { name: 'job-2-other' },
        { name: `job-3-${TEST_ID}` },
      ];
      
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { data: allStmts, metadata: {} }
      });

      const filtered = await listStatements(100, undefined, undefined, TEST_ID);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.name.includes(TEST_ID))).toBe(true);
    });

    it('listStatements returns all when no filter provided', async () => {
      const allStmts = [
        { name: `job-1-${TEST_ID}` },
        { name: 'job-2-other' },
      ];
      
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { data: allStmts, metadata: {} }
      });

      const result = await listStatements();
      expect(result).toHaveLength(2);
    });
  });

  describe('Topics Filtering & Tagging', () => {
    it('listTopics filters out topics not matching uniqueId', async () => {
      const allTopics = [
        { topic_name: `topic-1-${TEST_ID}`, is_internal: false },
        { topic_name: 'topic-2-other', is_internal: false },
        { topic_name: `topic-3-${TEST_ID}`, is_internal: false },
      ];

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: allTopics }
      });

      const filtered = await listTopics(TEST_ID);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(t => t.topic_name.includes(TEST_ID))).toBe(true);
    });

    it('listTopics still filters out internal topics even with ID match', async () => {
      const allTopics = [
        { topic_name: `topic-1-${TEST_ID}`, is_internal: false },
        { topic_name: `__internal-${TEST_ID}`, is_internal: true },
      ];

      vi.mocked(kafkaRestClient.get).mockResolvedValueOnce({
        data: { data: allTopics }
      });

      const filtered = await listTopics(TEST_ID);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].topic_name).toBe(`topic-1-${TEST_ID}`);
    });
  });

  describe('Schemas (Subjects) Filtering & Tagging', () => {
    it('listSubjects filters by uniqueId', async () => {
      const allSubjects = [
        `subject-1-${TEST_ID}`,
        'subject-2-other',
        `subject-3-${TEST_ID}`,
      ];

      vi.mocked(schemaRegistryClient.get).mockResolvedValueOnce({
        data: allSubjects
      });

      const filtered = await listSubjects(TEST_ID);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.includes(TEST_ID))).toBe(true);
    });

    it('registerSchema appends uniqueId to subject', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { id: 123 } });

      await registerSchema('my-schema', '{}', 'AVRO');

      const call = vi.mocked(schemaRegistryClient.post).mock.calls[0];
      const url = call[0];
      // getSessionTag() lowercases the uniqueId
      const sessionTag = TEST_ID.toLowerCase().replace(/[^a-z0-9-]/g, '');
      expect(url).toContain(`my-schema-${sessionTag}`);
    });

    it('registerSchema does not double-append uniqueId', async () => {
      vi.mocked(schemaRegistryClient.post).mockResolvedValueOnce({ data: { id: 124 } });

      await registerSchema(`my-schema-${TEST_ID}`, '{}', 'AVRO');

      const call = vi.mocked(schemaRegistryClient.post).mock.calls[0];
      const url = call[0];
      // Should not be my-schema-F69696-F69696
      expect(url.split(TEST_ID)).toHaveLength(2); 
    });
  });
});
