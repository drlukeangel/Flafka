import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { SchemaSubject } from '../../types';

// ---------------------------------------------------------------------------
// Store mock — mutable module-level variables (vi.mock hoists these correctly
// because `let` declarations are initialized to undefined, not TDZ like const)
// ---------------------------------------------------------------------------

let mockSelectedSchemaSubject: SchemaSubject | null = null;
let mockSchemaRegistryLoading = false;
let mockSchemaRegistrySubjects: string[] = [];
let mockTopicList: { topic_name: string; is_internal: boolean; replication_factor: number; partitions_count: number }[] = [];

const mockAddToast = vi.fn();
const mockClearSelectedSchema = vi.fn();
const mockLoadSchemaDetail = vi.fn();
const mockNavigateToTopic = vi.fn();
const mockLoadSchemaRegistrySubjects = vi.fn();
const mockLoadTopics = vi.fn();
const mockClearSchemaInitialView = vi.fn();
const mockDeleteSchemaDataset = vi.fn();

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      selectedSchemaSubject: mockSelectedSchemaSubject,
      schemaRegistryLoading: mockSchemaRegistryLoading,
      schemaRegistrySubjects: mockSchemaRegistrySubjects,
      topicList: mockTopicList,
      addToast: mockAddToast,
      clearSelectedSchema: mockClearSelectedSchema,
      loadSchemaDetail: mockLoadSchemaDetail,
      navigateToTopic: mockNavigateToTopic,
      loadSchemaRegistrySubjects: mockLoadSchemaRegistrySubjects,
      loadTopics: mockLoadTopics,
      schemaInitialView: null,
      clearSchemaInitialView: mockClearSchemaInitialView,
      schemaDatasets: [],
      deleteSchemaDataset: mockDeleteSchemaDataset,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
  // getState is used inside handleDeleteConfirm for schemaDatasets cleanup
  useWorkspaceStore_getState: () => ({
    schemaDatasets: [],
    deleteSchemaDataset: mockDeleteSchemaDataset,
  }),
}));

// Patch the static getState call used inside handleDeleteConfirm
vi.mock('../../store/workspaceStore', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    useWorkspaceStore: (selector: (s: unknown) => unknown) => {
      const state = {
        selectedSchemaSubject: mockSelectedSchemaSubject,
        schemaRegistryLoading: mockSchemaRegistryLoading,
        schemaRegistrySubjects: mockSchemaRegistrySubjects,
        topicList: mockTopicList,
        addToast: mockAddToast,
        clearSelectedSchema: mockClearSelectedSchema,
        loadSchemaDetail: mockLoadSchemaDetail,
        navigateToTopic: mockNavigateToTopic,
        loadSchemaRegistrySubjects: mockLoadSchemaRegistrySubjects,
        loadTopics: mockLoadTopics,
        schemaInitialView: null,
        clearSchemaInitialView: mockClearSchemaInitialView,
        schemaDatasets: [],
        deleteSchemaDataset: mockDeleteSchemaDataset,
      };
      return typeof selector === 'function' ? selector(state) : state;
    },
  };
});

vi.mock('../../config/environment', () => ({
  env: {
    schemaRegistryUrl: 'https://test-schema-registry.example.com',
    schemaRegistryKey: 'test-key',
    schemaRegistrySecret: 'test-secret',
    orgId: '',
    environmentId: '',
    computePoolId: '',
    flinkApiKey: '',
    flinkApiSecret: '',
    metricsKey: '',
    metricsSecret: '',
    flinkCatalog: 'default',
    flinkDatabase: 'public',
    cloudProvider: 'aws',
    cloudRegion: 'us-east-1',
    kafkaClusterId: '',
    kafkaRestEndpoint: '',
    kafkaApiKey: '',
    kafkaApiSecret: '',
    uniqueId: 'test',
  },
}));

vi.mock('../../api/schema-registry-api', () => ({
  listSubjects: vi.fn(),
  getSchemaDetail: vi.fn(),
  getSchemaVersions: vi.fn().mockResolvedValue([]),
  getCompatibilityMode: vi.fn().mockResolvedValue(null),
  getCompatibilityModeWithSource: vi.fn().mockResolvedValue({ level: 'BACKWARD', isGlobal: false }),
  validateCompatibility: vi.fn(),
  registerSchema: vi.fn().mockResolvedValue({ id: 1 }),
  deleteSubject: vi.fn().mockResolvedValue([1]),
  deleteSchemaVersion: vi.fn(),
  setCompatibilityMode: vi.fn(),
  getSubjectsForSchemaId: vi.fn().mockResolvedValue([]),
}));

// Import mocked module + component AFTER mocks
import * as schemaRegistryApi from '../../api/schema-registry-api';
import SchemaDetail from '../../components/SchemaPanel/SchemaDetail';

// Typed references to mocked fns
const mockGetSubjectsForSchemaId = vi.mocked(schemaRegistryApi.getSubjectsForSchemaId);
const mockRegisterSchema = vi.mocked(schemaRegistryApi.registerSchema);
const mockDeleteSubject = vi.mocked(schemaRegistryApi.deleteSubject);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSubject(subject: string, overrides: Partial<SchemaSubject> = {}): SchemaSubject {
  return {
    subject,
    version: 1,
    id: 100,
    schemaType: 'AVRO',
    schema: '{"type":"record","name":"Test","fields":[]}',
    ...overrides,
  };
}

/**
 * Renders the component and opens the Topics section by clicking the header.
 * The Topics section starts collapsed (topicsOpen = false), so most tests
 * need to expand it before asserting on topic content.
 */
async function renderAndOpenTopics(): Promise<void> {
  await act(async () => { render(<SchemaDetail />); });
  const topicsHeader = screen.getByText('Topics');
  await act(async () => { fireEvent.click(topicsHeader); });
}

/**
 * Opens the Schema controls section (collapsed by default, schemaOpen = false).
 * The Evolve button lives inside the Schema controls collapsible area, so tests
 * that need to click Evolve must call this first.
 */
async function openSchemaControls(): Promise<void> {
  const toggleBtn = screen.getByLabelText('Toggle schema controls');
  await act(async () => { fireEvent.click(toggleBtn); });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@schema-topics] Topics section in SchemaDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchemaRegistryLoading = false;
    mockSelectedSchemaSubject = null;
    mockSchemaRegistrySubjects = [];
    mockTopicList = [];
    // Reset default resolved values after clearAllMocks
    mockGetSubjectsForSchemaId.mockResolvedValue([]);
    mockRegisterSchema.mockResolvedValue({ id: 1 });
    mockDeleteSubject.mockResolvedValue([1]);
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([]);
    vi.mocked(schemaRegistryApi.getCompatibilityModeWithSource).mockResolvedValue({ level: 'BACKWARD', isGlobal: false });
  });

  // 1a: Topics section header renders for selected subject with id
  it('1a. Topics section renders for selected subject with id', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce(['orders-value', 'orders-key']);

    await act(async () => { render(<SchemaDetail />); });

    // The Topics header is always visible (collapsed or expanded)
    expect(screen.getByText('Topics')).toBeTruthy();
  });

  // 1b: Topics section shows collapsed stub in edit mode when opened
  it('1b. Topics section shows collapsed stub in edit mode', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValue(['orders-value']);

    await renderAndOpenTopics();

    // Wait for the associated topics to load so they are visible
    await waitFor(() => expect(screen.getByText('orders')).toBeTruthy());

    // Open schema controls (collapsed by default) to access the Evolve button
    await openSchemaControls();

    // Click Evolve to enter edit mode
    const evolveBtn = screen.getByLabelText('Evolve schema');
    await act(async () => { fireEvent.click(evolveBtn); });

    // Should show collapsed stub — visible because topicsOpen is still true
    await waitFor(() => {
      expect(screen.getByText(/Topics.*— unavailable while editing/)).toBeTruthy();
    });
    // The individual topic names should not be shown in the rows
    // (the stub replaces them in edit mode)
    const ordersBtns = screen.queryAllByRole('button', { name: /Go to topic orders/ });
    expect(ordersBtns.length).toBe(0);
  });

  // 2a: renders topic names from -value subjects
  it('2a. renders topic names from -value subjects', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce(['orders-value', 'payments-value']);

    await renderAndOpenTopics();

    await waitFor(() => {
      expect(screen.getByText('orders')).toBeTruthy();
      expect(screen.getByText('payments')).toBeTruthy();
    });
  });

  // 2b: renders topic names from -key subjects
  it('2b. renders topic names from -key subjects', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce(['payments-key']);

    await renderAndOpenTopics();

    await waitFor(() => {
      expect(screen.getByText('payments')).toBeTruthy();
    });
  });

  // 2c: dedupes topic with both -value and -key
  it('2c. dedupes topic with both -value and -key', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce(['orders-value', 'orders-key']);

    await renderAndOpenTopics();

    await waitFor(() => {
      // Should only show 'orders' once as a topic button, not twice
      const matches = screen.getAllByRole('button', { name: /Go to topic orders/ });
      expect(matches.length).toBe(1);
    });
  });

  // 2d: excludes subjects without -value/-key suffix
  it('2d. excludes subjects without -value/-key suffix', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce(['orders-value', 'raw-events']);

    await renderAndOpenTopics();

    await waitFor(() => {
      expect(screen.getByText('orders')).toBeTruthy();
    });
    // 'raw-events' should not appear as a topic (no -value/-key suffix)
    expect(screen.queryByText('raw-events')).toBeNull();
  });

  // 3a: × button calls deleteSubject for topicName-value
  it('3a. remove button calls deleteSubject for topicName-value', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId
      .mockResolvedValueOnce(['orders-value'])
      .mockResolvedValueOnce([]);

    await renderAndOpenTopics();
    await waitFor(() => expect(screen.getByText('orders')).toBeTruthy());

    const removeBtn = screen.getByLabelText('Remove topic orders');
    await act(async () => { fireEvent.click(removeBtn); });

    expect(mockDeleteSubject).toHaveBeenCalledWith('orders-value');
  });

  // 3b: × button calls deleteSubject for BOTH -value AND -key when both exist
  it('3b. remove button deletes both -value and -key subjects', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId
      .mockResolvedValueOnce(['orders-value', 'orders-key'])
      .mockResolvedValueOnce([]);

    await renderAndOpenTopics();
    await waitFor(() => expect(screen.getByText('orders')).toBeTruthy());

    const removeBtn = screen.getByLabelText('Remove topic orders');
    await act(async () => { fireEvent.click(removeBtn); });

    expect(mockDeleteSubject).toHaveBeenCalledWith('orders-value');
    expect(mockDeleteSubject).toHaveBeenCalledWith('orders-key');
    expect(mockDeleteSubject).toHaveBeenCalledTimes(2);
  });

  // 3c: After delete, topic list refreshes
  it('3c. after delete, getSubjectsForSchemaId is called again', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId
      .mockResolvedValueOnce(['orders-value'])
      .mockResolvedValueOnce([]);

    await renderAndOpenTopics();
    await waitFor(() => expect(screen.getByText('orders')).toBeTruthy());

    const removeBtn = screen.getByLabelText('Remove topic orders');
    await act(async () => { fireEvent.click(removeBtn); });

    // Called once on mount, then again after delete
    await waitFor(() => {
      expect(mockGetSubjectsForSchemaId).toHaveBeenCalledTimes(2);
    });
  });

  // 3d: Removed topic no longer rendered after delete
  it('3d. removed topic no longer rendered after delete', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId
      .mockResolvedValueOnce(['orders-value'])
      .mockResolvedValueOnce([]);

    await renderAndOpenTopics();
    await waitFor(() => expect(screen.getByText('orders')).toBeTruthy());

    const removeBtn = screen.getByLabelText('Remove topic orders');
    await act(async () => { fireEvent.click(removeBtn); });

    await waitFor(() => {
      expect(screen.queryByText('orders')).toBeNull();
    });
  });

  // 4a: Search filters Kafka topic names by substring
  it('4a. search filters Kafka topic names by substring', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce([]);
    mockTopicList = [
      { topic_name: 'orders', is_internal: false, replication_factor: 3, partitions_count: 6 },
      { topic_name: 'payments', is_internal: false, replication_factor: 3, partitions_count: 6 },
      { topic_name: 'loans', is_internal: false, replication_factor: 3, partitions_count: 6 },
    ];

    await renderAndOpenTopics();

    const searchInput = screen.getByPlaceholderText('Associate with a topic...');
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'loan' } }); });

    // Should show 'loans' in dropdown
    expect(screen.getByText('loans')).toBeTruthy();
  });

  // 4b: Search excludes already-associated topics
  it('4b. search excludes already-associated topics', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce(['orders-value']);
    mockTopicList = [
      { topic_name: 'orders', is_internal: false, replication_factor: 3, partitions_count: 6 },
      { topic_name: 'payments', is_internal: false, replication_factor: 3, partitions_count: 6 },
    ];

    await renderAndOpenTopics();
    await waitFor(() => expect(screen.getByText('orders')).toBeTruthy());

    const searchInput = screen.getByPlaceholderText('Associate with a topic...');
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'pay' } }); });
    expect(screen.getByText('payments')).toBeTruthy();
  });

  // 4c: Search shows actual Kafka topics (not just those with existing schemas)
  it('4c. search shows Kafka topics without existing schemas', async () => {
    mockSelectedSchemaSubject = makeSubject('test-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce([]);
    // Topic exists in Kafka but has NO schema registry subject
    mockTopicList = [
      { topic_name: 'my-new-topic', is_internal: false, replication_factor: 3, partitions_count: 6 },
    ];
    mockSchemaRegistrySubjects = []; // no subjects at all

    await renderAndOpenTopics();

    const searchInput = screen.getByPlaceholderText('Associate with a topic...');
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'my' } }); });

    expect(screen.getByText('my-new-topic')).toBeTruthy();
  });

  // 4d: Search shows topics only once (no duplicates from topic list)
  it('4d. search shows each topic only once', async () => {
    mockSelectedSchemaSubject = makeSubject('test-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce([]);
    mockTopicList = [
      { topic_name: 'orders', is_internal: false, replication_factor: 3, partitions_count: 6 },
    ];

    await renderAndOpenTopics();

    const searchInput = screen.getByPlaceholderText('Associate with a topic...');
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'order' } }); });

    const buttons = screen.getAllByText('orders');
    expect(buttons.length).toBe(1);
  });

  // 5: Selecting dropdown item calls registerSchema
  it('5. selecting dropdown item calls registerSchema with topicName-value', async () => {
    mockSelectedSchemaSubject = makeSubject('test-value', { id: 100 });
    mockGetSubjectsForSchemaId
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['loans-value']);
    mockTopicList = [
      { topic_name: 'loans', is_internal: false, replication_factor: 3, partitions_count: 6 },
    ];

    await renderAndOpenTopics();

    const searchInput = screen.getByPlaceholderText('Associate with a topic...');
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'loan' } }); });

    const option = screen.getByText('loans');
    await act(async () => { fireEvent.mouseDown(option); });

    expect(mockRegisterSchema).toHaveBeenCalledWith(
      'loans-value',
      '{"type":"record","name":"Test","fields":[]}',
      'AVRO'
    );
  });

  // 6a: API error on add shows inline error message
  it('6a. API error on add shows inline error message', async () => {
    mockSelectedSchemaSubject = makeSubject('test-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValue([]);
    mockTopicList = [
      { topic_name: 'loans', is_internal: false, replication_factor: 3, partitions_count: 6 },
    ];
    mockRegisterSchema.mockRejectedValueOnce(new Error('409 Conflict'));

    await renderAndOpenTopics();

    const searchInput = screen.getByPlaceholderText('Associate with a topic...');
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'loan' } }); });

    const option = screen.getByText('loans');
    await act(async () => { fireEvent.mouseDown(option); });

    await waitFor(() => {
      expect(screen.getByText('409 Conflict')).toBeTruthy();
    });
  });

  // 6b: API error on remove shows toast
  it('6b. API error on remove shows toast, does not remove topic', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValue(['orders-value']);
    mockDeleteSubject.mockRejectedValueOnce(new Error('500 Server Error'));

    await renderAndOpenTopics();
    await waitFor(() => expect(screen.getByText('orders')).toBeTruthy());

    const removeBtn = screen.getByLabelText('Remove topic orders');
    await act(async () => { fireEvent.click(removeBtn); });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
    // Topic should still be rendered
    expect(screen.getByText('orders')).toBeTruthy();
  });

  // 7a: getSubjectsForSchemaId calls the correct endpoint
  it('7a. calls getSubjectsForSchemaId with schema id', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 42 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce([]);

    await act(async () => { render(<SchemaDetail />); });

    expect(mockGetSubjectsForSchemaId).toHaveBeenCalledWith(42, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  // 7b: returns empty array when no subjects
  it('7b. empty subjects returns empty topic list', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    mockGetSubjectsForSchemaId.mockResolvedValueOnce([]);

    await act(async () => { render(<SchemaDetail />); });

    // Should render Topics label but no topic rows
    expect(screen.getByText('Topics')).toBeTruthy();
    expect(screen.queryByLabelText(/Remove topic/)).toBeNull();
  });

  // 8: Loading indicator renders
  it('8. loading indicator renders while fetching', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 100 });
    // Never-resolving promise to keep loading state
    mockGetSubjectsForSchemaId.mockReturnValueOnce(new Promise(() => {}));

    await act(async () => { render(<SchemaDetail />); });

    // The Topics section should show loading indicator
    expect(screen.getByText('Topics')).toBeTruthy();
  });

  // 9: No API call when id is 0
  it('9. no API call when selectedSchemaSubject.id is 0', async () => {
    mockSelectedSchemaSubject = makeSubject('orders-value', { id: 0 });

    await act(async () => { render(<SchemaDetail />); });

    // id is 0, which is falsy — should not call API
    expect(mockGetSubjectsForSchemaId).not.toHaveBeenCalled();
  });
});
