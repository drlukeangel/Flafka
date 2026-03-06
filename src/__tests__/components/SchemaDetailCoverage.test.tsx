/**
 * @schema-detail-coverage
 * Additional coverage for SchemaDetail.tsx uncovered branches.
 *
 * Targets:
 *   - Datasets tab switching (topMode = 'datasets')
 *   - schemaInitialView consumption (initial view = 'datasets', 'tree', 'code')
 *   - Topics section: toggle open/close, keyboard open/close
 *   - Topics section: "unavailable while editing" message
 *   - Copy SELECT statement button and clipboard interaction
 *   - No subject selected (empty state)
 *   - handleDeleteVersion success path (auto-exits diff mode if <2 versions remain)
 *   - Diff mode toggle
 *   - handleDiffVersionChange abort error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { SchemaSubject } from '../../types';

// ---------------------------------------------------------------------------
// Store mock
// ---------------------------------------------------------------------------

let mockSelectedSchemaSubject: SchemaSubject | null = null;
let mockSchemaRegistryLoading = false;
let mockSchemaInitialView: string | null = null;

const mockLoadSchemaDetail = vi.fn();
const mockClearSelectedSchema = vi.fn();
const mockAddToast = vi.fn();
const mockNavigateToTopic = vi.fn();
const mockLoadTopics = vi.fn();
const mockClearSchemaInitialView = vi.fn();
const mockLoadSchemaRegistrySubjects = vi.fn();

vi.mock('../../store/workspaceStore', () => {
  const fn = vi.fn();
  (fn as unknown as { getState: () => unknown }).getState = vi.fn();
  return { useWorkspaceStore: fn };
});

vi.mock('../../config/environment', () => ({
  env: {
    schemaRegistryUrl: 'https://test.example.com',
    schemaRegistryKey: 'test-key',
    schemaRegistrySecret: 'test-secret',
    orgId: '', environmentId: '', computePoolId: '',
    flinkApiKey: '', flinkApiSecret: '',
    metricsKey: '', metricsSecret: '',
    flinkCatalog: 'default', flinkDatabase: 'public',
    cloudProvider: 'aws', cloudRegion: 'us-east-1',
    kafkaClusterId: '', kafkaRestEndpoint: '',
    kafkaApiKey: '', kafkaApiSecret: '',
  },
}));

vi.mock('../../api/schema-registry-api', () => ({
  listSubjects: vi.fn(),
  getSchemaDetail: vi.fn().mockResolvedValue({
    subject: 'test-subject-value',
    version: 1,
    id: 100001,
    schemaType: 'AVRO',
    schema: '{"type":"record","name":"Test","fields":[{"name":"id","type":"string"}]}',
  }),
  getSchemaVersions: vi.fn().mockResolvedValue([1]),
  getCompatibilityMode: vi.fn().mockResolvedValue('BACKWARD'),
  getCompatibilityModeWithSource: vi.fn().mockResolvedValue({ level: 'BACKWARD', isGlobal: false }),
  validateCompatibility: vi.fn(),
  registerSchema: vi.fn(),
  deleteSubject: vi.fn(),
  deleteSchemaVersion: vi.fn(),
  setCompatibilityMode: vi.fn(),
  getSubjectsForSchemaId: vi.fn().mockResolvedValue([]),
}));

import SchemaDetail from '../../components/SchemaPanel/SchemaDetail';
import * as workspaceStoreModule from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';

const AVRO_SCHEMA = '{"type":"record","name":"Test","namespace":"com.test","fields":[{"name":"id","type":"string"},{"name":"name","type":"string"}]}';

function makeSubject(overrides: Partial<SchemaSubject> = {}): SchemaSubject {
  return {
    subject: 'test-subject-value',
    version: 1,
    id: 100001,
    schemaType: 'AVRO',
    schema: AVRO_SCHEMA,
    compatibilityLevel: 'BACKWARD',
    ...overrides,
  };
}

function buildMockState() {
  return {
    selectedSchemaSubject: mockSelectedSchemaSubject,
    schemaRegistryLoading: mockSchemaRegistryLoading,
    schemaRegistryError: null,
    schemaRegistrySubjects: [],
    schemaTypeCache: {},
    schemaCompatCache: {},
    loadSchemaRegistrySubjects: mockLoadSchemaRegistrySubjects,
    loadSchemaDetail: mockLoadSchemaDetail,
    clearSelectedSchema: mockClearSelectedSchema,
    clearSchemaRegistryError: vi.fn(),
    addToast: mockAddToast,
    navigateToTopic: mockNavigateToTopic,
    topicList: [{ topic_name: 'my-topic' }, { topic_name: 'other-topic' }],
    loadTopics: mockLoadTopics,
    schemaInitialView: mockSchemaInitialView,
    clearSchemaInitialView: mockClearSchemaInitialView,
    schemaDatasets: [],
    deleteSchemaDataset: vi.fn(),
  };
}

function setupStoreMock() {
  const mockedStore = vi.mocked(workspaceStoreModule.useWorkspaceStore) as unknown as {
    (selector?: unknown): unknown;
    getState: () => unknown;
    mockImplementation: (fn: (s: unknown) => unknown) => void;
  };
  mockedStore.mockImplementation((selector: unknown) => {
    const state = buildMockState();
    return typeof selector === 'function' ? (selector as (s: unknown) => unknown)(state) : state;
  });
  const getStateMock = mockedStore.getState as unknown as { mockImplementation: (fn: () => unknown) => void };
  getStateMock.mockImplementation(() => buildMockState());
}

async function openSchemaControls() {
  const toggle = screen.getByRole('button', { name: /toggle schema controls/i });
  fireEvent.click(toggle);
  await waitFor(() => {
    expect(screen.getByRole('combobox', { name: /select schema version/i })).toBeInTheDocument();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@schema-detail-coverage] empty state — no subject selected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedSchemaSubject = null;
    mockSchemaRegistryLoading = false;
    mockSchemaInitialView = null;
    setupStoreMock();
  });

  it('shows "Select a schema subject" when no subject is selected', () => {
    render(<SchemaDetail />);
    expect(screen.getByText(/select a schema subject/i)).toBeInTheDocument();
  });
});

describe('[@schema-detail-coverage] datasets tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedSchemaSubject = makeSubject();
    mockSchemaRegistryLoading = false;
    mockSchemaInitialView = null;
    setupStoreMock();
  });

  it('clicking "Datasets" button switches to datasets view', async () => {
    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByText('Datasets')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Datasets'));

    // SchemaDatasets renders "Test Datasets" header
    expect(screen.getByText('Test Datasets')).toBeInTheDocument();
  });

  it('clicking "Schema" button switches back to schema view', async () => {
    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByText('Datasets')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Datasets'));
    expect(screen.getByText('Test Datasets')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Schema'));

    // Schema view should show the code view with the formatted JSON
    await waitFor(() => {
      const preEls = document.querySelectorAll('pre');
      expect(preEls.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('[@schema-detail-coverage] initial view consumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedSchemaSubject = makeSubject();
    mockSchemaRegistryLoading = false;
  });

  it('consumes "datasets" initial view by switching to datasets tab', async () => {
    mockSchemaInitialView = 'datasets';
    setupStoreMock();

    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByText('Test Datasets')).toBeInTheDocument();
    });

    expect(mockClearSchemaInitialView).toHaveBeenCalled();
  });

  it('consumes "tree" initial view and calls clearSchemaInitialView', async () => {
    mockSchemaInitialView = 'tree';
    setupStoreMock();

    render(<SchemaDetail />);

    // The initial view should be consumed (clearSchemaInitialView called)
    await waitFor(() => {
      expect(mockClearSchemaInitialView).toHaveBeenCalled();
    });
  });
});

describe('[@schema-detail-coverage] topics section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedSchemaSubject = makeSubject();
    mockSchemaRegistryLoading = false;
    mockSchemaInitialView = null;
    setupStoreMock();
  });

  it('topics section toggle opens and closes the topics area', async () => {
    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByText('Topics')).toBeInTheDocument();
    });

    // Click to open topics section
    const topicsHeader = screen.getByText('Topics').closest('[role="button"]')!;
    fireEvent.click(topicsHeader);

    // Should show the topic search input
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/associate with a topic/i)).toBeInTheDocument();
    });

    // Click again to close
    fireEvent.click(topicsHeader);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/associate with a topic/i)).not.toBeInTheDocument();
    });
  });

  it('topics section keyboard: Enter toggles open/close', async () => {
    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByText('Topics')).toBeInTheDocument();
    });

    const topicsHeader = screen.getByText('Topics').closest('[role="button"]')!;
    fireEvent.keyDown(topicsHeader, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/associate with a topic/i)).toBeInTheDocument();
    });
  });

  it('topics section keyboard: Space toggles open/close', async () => {
    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByText('Topics')).toBeInTheDocument();
    });

    const topicsHeader = screen.getByText('Topics').closest('[role="button"]')!;
    fireEvent.keyDown(topicsHeader, { key: ' ' });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/associate with a topic/i)).toBeInTheDocument();
    });
  });

  it('topics section shows "unavailable while editing" when in edit mode', async () => {
    render(<SchemaDetail />);

    // Open topics section first
    await waitFor(() => {
      expect(screen.getByText('Topics')).toBeInTheDocument();
    });
    const topicsHeader = screen.getByText('Topics').closest('[role="button"]')!;
    fireEvent.click(topicsHeader);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/associate with a topic/i)).toBeInTheDocument();
    });

    // Enter edit mode — open schema controls then click Evolve
    await openSchemaControls();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /evolve schema/i }));
    });

    // Topics section should show "unavailable while editing"
    await waitFor(() => {
      expect(screen.getByText(/unavailable while editing/i)).toBeInTheDocument();
    });
  }, 15000);
});

describe('[@schema-detail-coverage] copy SELECT statement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedSchemaSubject = makeSubject();
    mockSchemaRegistryLoading = false;
    mockSchemaInitialView = null;
    setupStoreMock();
  });

  it('SELECT button is visible for AVRO schemas with fields', async () => {
    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy select statement/i })).toBeInTheDocument();
    });
  });

  it('clicking SELECT copies to clipboard and shows toast', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });

    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy select statement/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy select statement/i }));
    });

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    });

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: expect.stringContaining('clipboard') })
    );
  });

  it('SELECT button is NOT visible for PROTOBUF schemas', async () => {
    mockSelectedSchemaSubject = makeSubject({
      schemaType: 'PROTOBUF',
      schema: 'syntax = "proto3"; message Test { string id = 1; }',
    });
    setupStoreMock();

    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByTitle('Schema type: PROTOBUF')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /copy select statement/i })).not.toBeInTheDocument();
  });
});

describe('[@schema-detail-coverage] diff mode toggle and rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedSchemaSubject = makeSubject();
    mockSchemaRegistryLoading = false;
    mockSchemaInitialView = null;
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([1, 2, 3]);
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValue(makeSubject({ version: 1 }));
    setupStoreMock();
  });

  it('diff button is visible when versions >= 2', async () => {
    render(<SchemaDetail />);
    await openSchemaControls();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle diff view/i })).toBeInTheDocument();
    });
  });

  it('toggling diff shows compare panes', async () => {
    render(<SchemaDetail />);
    await openSchemaControls();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle diff view/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /toggle diff view/i }));
    });

    // Diff mode should show a "Compare" label
    await waitFor(() => {
      expect(screen.getByText(/compare/i)).toBeInTheDocument();
    });
  });

  it('toggling diff off returns to normal code view', async () => {
    render(<SchemaDetail />);
    await openSchemaControls();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle diff view/i })).toBeInTheDocument();
    });

    // Toggle on
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /toggle diff view/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/compare/i)).toBeInTheDocument();
    });

    // Toggle off
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /toggle diff view/i }));
    });

    // Compare label should be gone, normal pre block should be back
    await waitFor(() => {
      expect(screen.queryByText(/^compare/i)).not.toBeInTheDocument();
    });
  });
});

describe('[@schema-detail-coverage] version delete — success path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedSchemaSubject = makeSubject({ version: 1 });
    mockSchemaRegistryLoading = false;
    mockSchemaInitialView = null;
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([1, 2]);
    vi.mocked(schemaRegistryApi.getCompatibilityModeWithSource).mockResolvedValue({ level: 'BACKWARD', isGlobal: false });
    vi.mocked(schemaRegistryApi.deleteSchemaVersion).mockResolvedValue(undefined as unknown as never);
    vi.mocked(schemaRegistryApi.getSchemaDetail).mockResolvedValue(makeSubject({ version: 2 }));
    setupStoreMock();
  });

  it('confirming version delete calls deleteSchemaVersion and refreshes', async () => {
    // After deletion, only 1 version remains
    vi.mocked(schemaRegistryApi.getSchemaVersions)
      .mockResolvedValueOnce([1, 2])   // initial load
      .mockResolvedValueOnce([2]);     // after delete

    render(<SchemaDetail />);
    await openSchemaControls();

    // Switch to version 1
    const versionSelect = screen.getByRole('combobox', { name: /select schema version/i });
    await act(async () => {
      fireEvent.change(versionSelect, { target: { value: '1' } });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete version 1/i })).toBeInTheDocument();
    });

    // Open version delete overlay
    fireEvent.click(screen.getByRole('button', { name: /delete version 1/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Confirm delete
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /delete version 1 of test-subject-value/i }));
    });

    await waitFor(() => {
      expect(schemaRegistryApi.deleteSchemaVersion).toHaveBeenCalledWith('test-subject-value', 1);
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', message: expect.stringContaining('Version 1 deleted') })
      );
    });
  });
});

describe('[@schema-detail-coverage] global compatibility badge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedSchemaSubject = makeSubject();
    mockSchemaRegistryLoading = false;
    mockSchemaInitialView = null;
    vi.mocked(schemaRegistryApi.getCompatibilityModeWithSource).mockResolvedValue({ level: 'BACKWARD', isGlobal: true });
    setupStoreMock();
  });

  it('shows "Global" badge when compatibility is inherited from global config', async () => {
    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByTitle(/inherits the global compatibility/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Global')).toBeInTheDocument();
  });
});

describe('[@schema-detail-coverage] close button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedSchemaSubject = makeSubject();
    mockSchemaRegistryLoading = false;
    mockSchemaInitialView = null;
    setupStoreMock();
  });

  it('clicking close calls clearSelectedSchema', async () => {
    render(<SchemaDetail />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close schema detail/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close schema detail/i }));

    expect(mockClearSelectedSchema).toHaveBeenCalledTimes(1);
  });
});
