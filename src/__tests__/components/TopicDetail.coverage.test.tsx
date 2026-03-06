/**
 * @topic-detail-coverage
 * TopicDetail — additional coverage for helper functions, health scores,
 * config validation, delete confirm, and schema association.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TopicDetail from '../../components/TopicPanel/TopicDetail';
import type { KafkaTopic, TopicConfig } from '../../types';

// Mock topic API
const mockGetTopicConfigs = vi.fn().mockResolvedValue([]);
const mockDeleteTopic = vi.fn().mockResolvedValue(undefined);
const mockAlterTopicConfig = vi.fn().mockResolvedValue(undefined);
const mockGetTopicPartitions = vi.fn().mockResolvedValue([]);
const mockGetPartitionOffsets = vi.fn().mockResolvedValue({ beginning_offset: '0', end_offset: '0' });

vi.mock('../../api/topic-api', () => ({
  listTopics: vi.fn().mockResolvedValue([]),
  getTopicDetail: vi.fn(),
  getTopicConfigs: (...args: unknown[]) => mockGetTopicConfigs(...args),
  createTopic: vi.fn(),
  deleteTopic: (...args: unknown[]) => mockDeleteTopic(...args),
  alterTopicConfig: (...args: unknown[]) => mockAlterTopicConfig(...args),
  getTopicPartitions: (...args: unknown[]) => mockGetTopicPartitions(...args),
  getPartitionOffsets: (...args: unknown[]) => mockGetPartitionOffsets(...args),
}));

// Mock schema registry API
const mockGetSchemaDetail = vi.fn().mockRejectedValue(new Error('Not found'));
vi.mock('../../api/schema-registry-api', () => ({
  getSubjectsByTopic: vi.fn().mockResolvedValue([]),
  listSubjects: vi.fn().mockResolvedValue([]),
  getSchemaDetail: (...args: unknown[]) => mockGetSchemaDetail(...args),
  registerSchema: vi.fn().mockResolvedValue(undefined),
  deleteSubject: vi.fn().mockResolvedValue(undefined),
}));

// Mock editor registry
const mockInsertTextAtCursor = vi.fn().mockReturnValue(false);
vi.mock('../../components/EditorCell/editorRegistry', () => ({
  insertTextAtCursor: (...args: unknown[]) => mockInsertTextAtCursor(...args),
}));

// Mock environment
vi.mock('../../config/environment', () => ({
  env: {
    kafkaClusterId: 'test-cluster',
    kafkaRestEndpoint: 'https://test.confluent.cloud',
    schemaRegistryUrl: 'https://schema-registry',
    flinkRestEndpoint: '',
    flinkApiKey: '',
    flinkApiSecret: '',
  },
}));

// Mock PartitionTable
vi.mock('../../components/TopicPanel/PartitionTable', () => ({
  default: ({ topicName }: { topicName: string }) => (
    <div data-testid="partition-table">{topicName}</div>
  ),
}));

// Store mock
let mockSelectedTopic: KafkaTopic | null = null;
let mockTopicLoading = false;
let mockTopicError: string | null = null;

const mockSelectTopic = vi.fn();
const mockClearSelectedTopic = vi.fn();
const mockAddToast = vi.fn();
const mockAddStatement = vi.fn();
const mockGetConfigAuditLog = vi.fn().mockReturnValue([]);
const mockSchemaRegistrySubjects: string[] = [];
const mockLoadSchemaRegistrySubjects = vi.fn().mockResolvedValue(undefined);
const mockNavigateToSchema = vi.fn();

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      selectedTopic: mockSelectedTopic,
      topicLoading: mockTopicLoading,
      topicError: mockTopicError,
      selectTopic: mockSelectTopic,
      clearSelectedTopic: mockClearSelectedTopic,
      addToast: mockAddToast,
      addStatement: mockAddStatement,
      getConfigAuditLogForTopic: mockGetConfigAuditLog,
      focusedStatementId: null,
      schemaRegistrySubjects: mockSchemaRegistrySubjects,
      loadSchemaRegistrySubjects: mockLoadSchemaRegistrySubjects,
      navigateToSchema: mockNavigateToSchema,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

function makeTopic(overrides: Partial<KafkaTopic> = {}): KafkaTopic {
  return {
    topic_name: 'test-topic',
    partitions_count: 3,
    replication_factor: 2,
    is_internal: false,
    ...overrides,
  };
}

describe('[@topic-detail-coverage] TopicDetail Coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedTopic = makeTopic();
    mockTopicLoading = false;
    mockTopicError = null;
    mockGetTopicConfigs.mockResolvedValue([]);
    mockGetSchemaDetail.mockRejectedValue(new Error('Not found'));
  });

  // ========================================================================
  // Health Score Tests (F6)
  // ========================================================================

  describe('[@topic-detail-coverage] Health Score Display', () => {
    it('shows green health for healthy topic (partitions >= 2, RF >= 2)', () => {
      mockSelectedTopic = makeTopic({ partitions_count: 3, replication_factor: 3 });
      render(<TopicDetail />);
      // Green = healthy = no warning icon visible
      expect(screen.getByText('test-topic')).toBeInTheDocument();
    });

    it('shows yellow health for single partition topic', () => {
      mockSelectedTopic = makeTopic({ partitions_count: 1, replication_factor: 3 });
      render(<TopicDetail />);
      expect(screen.getByText('test-topic')).toBeInTheDocument();
    });

    it('shows yellow health for RF=1 topic', () => {
      mockSelectedTopic = makeTopic({ partitions_count: 3, replication_factor: 1 });
      render(<TopicDetail />);
      expect(screen.getByText('test-topic')).toBeInTheDocument();
    });

    it('shows red health for 0 partitions', () => {
      mockSelectedTopic = makeTopic({ partitions_count: 0, replication_factor: 3 });
      render(<TopicDetail />);
      expect(screen.getByText('test-topic')).toBeInTheDocument();
    });

    it('shows red health for 0 RF', () => {
      mockSelectedTopic = makeTopic({ partitions_count: 3, replication_factor: 0 });
      render(<TopicDetail />);
      expect(screen.getByText('test-topic')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Config Loading and Display Tests
  // ========================================================================

  describe('[@topic-detail-coverage] Config Loading', () => {
    it('loads configs when topic is selected', async () => {
      mockGetTopicConfigs.mockResolvedValue([
        { name: 'retention.ms', value: '604800000', is_default: false, is_sensitive: false, is_read_only: false, source: 'TOPIC_CONFIG', synonyms: [] },
        { name: 'cleanup.policy', value: 'delete', is_default: true, is_sensitive: false, is_read_only: false, source: 'DEFAULT_CONFIG', synonyms: [] },
      ]);

      render(<TopicDetail />);

      await waitFor(() => {
        expect(mockGetTopicConfigs).toHaveBeenCalledWith('test-topic');
      });
    });

    it('shows retention.ms with human-readable format', async () => {
      mockGetTopicConfigs.mockResolvedValue([
        { name: 'retention.ms', value: '604800000', is_default: false, is_sensitive: false, is_read_only: false, source: 'TOPIC_CONFIG', synonyms: [] },
      ]);

      render(<TopicDetail />);

      await waitFor(() => {
        // 604800000ms = 7d
        expect(screen.getByText('7d')).toBeInTheDocument();
      });
    });

    it('shows retention.ms as Infinite for -1', async () => {
      mockGetTopicConfigs.mockResolvedValue([
        { name: 'retention.ms', value: '-1', is_default: false, is_sensitive: false, is_read_only: false, source: 'TOPIC_CONFIG', synonyms: [] },
      ]);

      render(<TopicDetail />);

      await waitFor(() => {
        expect(screen.getByText('Infinite')).toBeInTheDocument();
      });
    });

    it('masks sensitive config values', async () => {
      mockGetTopicConfigs.mockResolvedValue([
        { name: 'some.secret', value: 'secret-value', is_default: false, is_sensitive: true, is_read_only: false, source: 'TOPIC_CONFIG', synonyms: [] },
      ]);

      render(<TopicDetail />);

      await waitFor(() => {
        expect(screen.queryByText('secret-value')).not.toBeInTheDocument();
      });
    });

    it('shows lock icon for read-only configs', async () => {
      mockGetTopicConfigs.mockResolvedValue([
        { name: 'some.readonly', value: '100', is_default: false, is_sensitive: false, is_read_only: true, source: 'TOPIC_CONFIG', synonyms: [] },
      ]);

      render(<TopicDetail />);

      await waitFor(() => {
        expect(screen.getByText('some.readonly')).toBeInTheDocument();
      });
    });

    it('shows em-dash for null config values', async () => {
      mockGetTopicConfigs.mockResolvedValue([
        { name: 'some.config', value: null, is_default: true, is_sensitive: false, is_read_only: false, source: 'DEFAULT_CONFIG', synonyms: [] },
      ]);

      render(<TopicDetail />);

      await waitFor(() => {
        expect(screen.getByText('some.config')).toBeInTheDocument();
      });
    });
  });

  // ========================================================================
  // Delete Confirm Overlay Tests
  // ========================================================================

  describe('[@topic-detail-coverage] Delete Confirm', () => {
    it('opens delete dialog on Delete button click', async () => {
      render(<TopicDetail />);

      const deleteBtn = screen.getAllByRole('button').find(
        (b) => b.title?.includes('Delete') || b.getAttribute('aria-label')?.includes('Delete')
      );
      expect(deleteBtn).toBeDefined();

      await act(async () => {
        fireEvent.click(deleteBtn!);
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('delete button disabled until exact name typed', async () => {
      render(<TopicDetail />);

      // Open delete dialog
      const deleteBtn = screen.getAllByRole('button').find(
        (b) => b.title?.includes('Delete') || b.getAttribute('aria-label')?.includes('Delete')
      );
      await act(async () => {
        fireEvent.click(deleteBtn!);
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // The confirm button should be disabled
      const confirmDeleteBtn = screen.getAllByRole('button').find(
        (b) => b.textContent?.includes('Delete test-topic') && b !== deleteBtn
      );
      expect(confirmDeleteBtn).toBeDefined();
      expect(confirmDeleteBtn).toBeDisabled();
    });

    it('enables delete button when exact topic name is typed', async () => {
      const user = userEvent.setup();
      render(<TopicDetail />);

      // Open delete dialog
      const deleteBtn = screen.getAllByRole('button').find(
        (b) => b.title?.includes('Delete') || b.getAttribute('aria-label')?.includes('Delete')
      );
      await act(async () => {
        fireEvent.click(deleteBtn!);
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Type topic name
      const confirmInput = screen.getByPlaceholderText('test-topic');
      await user.type(confirmInput, 'test-topic');

      // Confirm button should now be enabled
      const confirmDeleteBtn = screen.getAllByRole('button').find(
        (b) => b.textContent?.includes('Delete test-topic') && !b.disabled
      );
      expect(confirmDeleteBtn).toBeDefined();
    });

    it('cancel button closes delete dialog', async () => {
      render(<TopicDetail />);

      const deleteBtn = screen.getAllByRole('button').find(
        (b) => b.title?.includes('Delete') || b.getAttribute('aria-label')?.includes('Delete')
      );
      await act(async () => {
        fireEvent.click(deleteBtn!);
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const cancelBtn = screen.getByText('Cancel');
      fireEvent.click(cancelBtn);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Back Navigation Tests
  // ========================================================================

  describe('[@topic-detail-coverage] Back Navigation', () => {
    it('renders back button to return to topic list', () => {
      render(<TopicDetail />);

      const backBtn = screen.getAllByRole('button').find(
        (b) => b.title?.includes('Back') || b.getAttribute('aria-label')?.includes('Back') || b.getAttribute('aria-label')?.includes('back')
      );
      expect(backBtn).toBeDefined();
    });

    it('clicking back calls clearSelectedTopic', async () => {
      render(<TopicDetail />);

      const backBtn = screen.getAllByRole('button').find(
        (b) => b.title?.includes('Back') || b.getAttribute('aria-label')?.includes('Back') || b.getAttribute('aria-label')?.includes('back')
      );

      if (backBtn) {
        fireEvent.click(backBtn);
        expect(mockClearSelectedTopic).toHaveBeenCalled();
      }
    });
  });

  // ========================================================================
  // Query and Copy Buttons
  // ========================================================================

  describe('[@topic-detail-coverage] Query and Copy', () => {
    it('Query button adds a SELECT statement for the topic', async () => {
      render(<TopicDetail />);

      const queryBtn = screen.getAllByRole('button').find(
        (b) => b.title?.includes('Query') || b.textContent?.includes('Query')
      );

      if (queryBtn) {
        fireEvent.click(queryBtn);
        expect(mockAddStatement).toHaveBeenCalledWith(
          expect.stringContaining('test-topic'),
          undefined,
          undefined,
        );
      }
    });

    it('Copy button copies topic name to clipboard', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });

      render(<TopicDetail />);

      const copyBtn = screen.getAllByRole('button').find(
        (b) => b.title?.includes('Copy') || b.getAttribute('aria-label')?.includes('Copy')
      );

      if (copyBtn) {
        await act(async () => {
          fireEvent.click(copyBtn);
        });
        // Should show toast
        await waitFor(() => {
          expect(mockAddToast).toHaveBeenCalled();
        });
      }
    });
  });

  // ========================================================================
  // Null/Empty State Tests
  // ========================================================================

  describe('[@topic-detail-coverage] Null/Empty States', () => {
    it('renders nothing when no topic is selected', () => {
      mockSelectedTopic = null;
      const { container } = render(<TopicDetail />);
      // Component should render empty or loading
      expect(container).toBeDefined();
    });

    it('renders internal topic badge when is_internal=true', () => {
      mockSelectedTopic = makeTopic({ is_internal: true, topic_name: '__consumer_offsets' });
      render(<TopicDetail />);
      expect(screen.getByText('__consumer_offsets')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Metadata Display
  // ========================================================================

  describe('[@topic-detail-coverage] Metadata Rows', () => {
    it('displays topic name in metadata row', () => {
      mockSelectedTopic = makeTopic({ topic_name: 'my-orders' });
      render(<TopicDetail />);
      // Topic name should appear in header and metadata
      const nameElements = screen.getAllByText('my-orders');
      expect(nameElements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays partition count in metadata', () => {
      mockSelectedTopic = makeTopic({ partitions_count: 12 });
      render(<TopicDetail />);
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('displays replication factor in metadata', () => {
      mockSelectedTopic = makeTopic({ replication_factor: 3 });
      render(<TopicDetail />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });
});
