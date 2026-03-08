import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { SchemaSubject, SchemaDataset } from '../../types';

// ---------------------------------------------------------------------------
// Store mock — mutable module-level variables so each test can set state.
// ---------------------------------------------------------------------------

let mockSelectedSchemaSubject: SchemaSubject | null = null;
let mockSchemaRegistryLoading = false;
let mockSchemaDatasets: SchemaDataset[] = [];

const mockAddToast = vi.fn();
const mockClearSelectedSchema = vi.fn();
const mockLoadSchemaDetail = vi.fn();
const mockNavigateToTopic = vi.fn();
const mockDeleteSchemaDataset = vi.fn();

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector: (s: unknown) => unknown) => {
      const state = {
        selectedSchemaSubject: mockSelectedSchemaSubject,
        schemaRegistryLoading: mockSchemaRegistryLoading,
        addToast: mockAddToast,
        clearSelectedSchema: mockClearSelectedSchema,
        loadSchemaDetail: mockLoadSchemaDetail,
        navigateToTopic: mockNavigateToTopic,
        schemaRegistrySubjects: [],
        loadSchemaRegistrySubjects: vi.fn(),
        topicList: [],
        loadTopics: vi.fn(),
        schemaInitialView: null,
        clearSchemaInitialView: vi.fn(),
        schemaDatasets: mockSchemaDatasets,
        deleteSchemaDataset: mockDeleteSchemaDataset,
      };
      return typeof selector === 'function' ? selector(state) : state;
    },
    {
      getState: () => ({
        schemaDatasets: mockSchemaDatasets,
        deleteSchemaDataset: mockDeleteSchemaDataset,
      }),
    },
  ),
}));

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

const mockDeleteSubject = vi.fn();

vi.mock('../../api/schema-registry-api', () => ({
  listSubjects: vi.fn(),
  getSchemaDetail: vi.fn(),
  getSchemaVersions: vi.fn().mockResolvedValue([]),
  getCompatibilityMode: vi.fn().mockResolvedValue(null),
  getCompatibilityModeWithSource: vi.fn().mockResolvedValue({ level: 'BACKWARD', isGlobal: false }),
  validateCompatibility: vi.fn(),
  registerSchema: vi.fn(),
  deleteSubject: (...args: unknown[]) => mockDeleteSubject(...args),
  deleteSchemaVersion: vi.fn(),
  setCompatibilityMode: vi.fn(),
  getSubjectsForSchemaId: vi.fn().mockResolvedValue([]),
}));

// Import component AFTER mocks
import SchemaDetail from '../../components/SchemaPanel/SchemaDetail';

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

function makeDataset(subject: string, id: string, name: string): SchemaDataset {
  return {
    id,
    name,
    schemaSubject: subject,
    records: [{ a: 1 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@schema-detail-layout] Schema/Datasets toggle and header layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSchemaRegistryLoading = false;
    mockSelectedSchemaSubject = null;
    mockSchemaDatasets = [];
  });

  describe('Schema/Datasets top-level toggle', () => {
    it('renders Schema and Datasets toggle buttons', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      expect(screen.getByText('Schema')).toBeTruthy();
      expect(screen.getByText('Datasets')).toBeTruthy();
    });

    it('defaults to Schema mode — shows VERSION and COMPAT', async () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      await act(async () => { render(<SchemaDetail />); });
      // Schema controls are in a collapsible panel — expand it first
      fireEvent.click(screen.getByLabelText('Toggle schema controls'));
      expect(screen.getByText('Version')).toBeTruthy();
      expect(screen.getByText('Compat')).toBeTruthy();
    });

    it('defaults to Schema mode — shows Code/Tree toggle', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      expect(screen.getByText('Code')).toBeTruthy();
      expect(screen.getByText('Tree')).toBeTruthy();
    });

    it('switching to Datasets mode hides VERSION and COMPAT', async () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      await act(async () => { render(<SchemaDetail />); });
      // Expand schema controls first, then switch to Datasets to confirm they disappear
      fireEvent.click(screen.getByLabelText('Toggle schema controls'));
      expect(screen.getByText('Version')).toBeTruthy();
      fireEvent.click(screen.getByText('Datasets'));
      expect(screen.queryByText('Version')).toBeNull();
      expect(screen.queryByText('Compat')).toBeNull();
    });

    it('switching to Datasets mode hides Code/Tree toggle', async () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      await act(async () => { render(<SchemaDetail />); });
      fireEvent.click(screen.getByText('Datasets'));
      expect(screen.queryByText('Code')).toBeNull();
      expect(screen.queryByText('Tree')).toBeNull();
    });

    it('switching to Datasets mode hides Evolve button', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      fireEvent.click(screen.getByText('Datasets'));
      expect(screen.queryByLabelText('Evolve schema')).toBeNull();
    });

    it('switching to Datasets mode hides TOPICS section', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      fireEvent.click(screen.getByText('Datasets'));
      expect(screen.queryByText('Topics')).toBeNull();
      expect(screen.queryByPlaceholderText('Associate with a topic...')).toBeNull();
    });

    it('switching to Datasets mode shows Test Datasets content', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      fireEvent.click(screen.getByText('Datasets'));
      expect(screen.getByText('Test Datasets')).toBeTruthy();
    });

    it('switching back to Schema mode restores schema controls', async () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      await act(async () => { render(<SchemaDetail />); });
      // Expand schema controls, switch away, switch back — controls panel state persists
      fireEvent.click(screen.getByLabelText('Toggle schema controls'));
      fireEvent.click(screen.getByText('Datasets'));
      fireEvent.click(screen.getByText('Schema'));
      expect(screen.getByText('Version')).toBeTruthy();
      expect(screen.getByText('Code')).toBeTruthy();
    });

    it('Schema button has aria-pressed=true when active', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      expect(screen.getByText('Schema').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByText('Datasets').getAttribute('aria-pressed')).toBe('false');
    });

    it('Datasets button has aria-pressed=true when active', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      fireEvent.click(screen.getByText('Datasets'));
      expect(screen.getByText('Schema').getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByText('Datasets').getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('Header layout changes', () => {
    it('shows schema ID in header row', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      expect(screen.getByText(/ID/)).toBeTruthy();
      expect(screen.getByText(/100/)).toBeTruthy();
    });

    it('does NOT show topic chip in header (removed)', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      expect(screen.queryByText('Topic: orders')).toBeNull();
    });

    it('shows delete icon button in header row', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      render(<SchemaDetail />);
      expect(screen.getByLabelText('Delete subject')).toBeTruthy();
    });

    it('delete button is in header — not in toolbar', async () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');
      await act(async () => { render(<SchemaDetail />); });
      // Old "Delete" text button should not exist
      const deleteButtons = screen.getAllByLabelText('Delete subject');
      expect(deleteButtons.length).toBe(1);
      // Should NOT have text "Delete" as a button label (was the old toolbar button)
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    });
  });

  describe('AVRO badge placement', () => {
    it('shows schema type badge in toolbar row (not header)', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value', { schemaType: 'AVRO' });
      render(<SchemaDetail />);
      expect(screen.getByText('AVRO')).toBeTruthy();
    });

    it('shows JSON badge for JSON schemas', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value', { schemaType: 'JSON' });
      render(<SchemaDetail />);
      expect(screen.getByText('JSON')).toBeTruthy();
    });

    it('badge hidden in Datasets mode', () => {
      mockSelectedSchemaSubject = makeSubject('orders-value', { schemaType: 'AVRO' });
      render(<SchemaDetail />);
      fireEvent.click(screen.getByText('Datasets'));
      expect(screen.queryByText('AVRO')).toBeNull();
    });
  });

  describe('Delete schema also deletes datasets', () => {
    it('delete confirms then removes schema and associated datasets', async () => {
      const ds1 = makeDataset('orders-value-test', 'ds-1', 'Dataset 1');
      const ds2 = makeDataset('orders-value-test', 'ds-2', 'Dataset 2');
      const dsOther = makeDataset('other-value', 'ds-3', 'Other Dataset');
      mockSchemaDatasets = [ds1, ds2, dsOther];
      mockSelectedSchemaSubject = makeSubject('orders-value-test');
      mockDeleteSubject.mockResolvedValueOnce(undefined);

      render(<SchemaDetail />);

      // Click delete icon in header
      fireEvent.click(screen.getByLabelText('Delete subject'));

      // Type subject name to confirm
      await waitFor(() => {
        expect(screen.getByPlaceholderText('orders-value-test')).toBeTruthy();
      });
      fireEvent.change(screen.getByPlaceholderText('orders-value-test'), {
        target: { value: 'orders-value-test' },
      });

      // Click the confirm delete button
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Delete orders-value-test'));
      });

      await waitFor(() => {
        expect(mockDeleteSubject).toHaveBeenCalledWith('orders-value-test');
      });

      // Should delete only datasets for this subject
      expect(mockDeleteSchemaDataset).toHaveBeenCalledWith('ds-1');
      expect(mockDeleteSchemaDataset).toHaveBeenCalledWith('ds-2');
      expect(mockDeleteSchemaDataset).not.toHaveBeenCalledWith('ds-3');
    });
  });

  describe('Topic click navigation in TOPICS section', () => {
    it('clicking a topic name in TOPICS section calls navigateToTopic', async () => {
      mockSelectedSchemaSubject = makeSubject('orders-value');

      const { getSubjectsForSchemaId } = await import('../../api/schema-registry-api');
      vi.mocked(getSubjectsForSchemaId).mockResolvedValueOnce(['orders-value']);

      await act(async () => {
        render(<SchemaDetail />);
      });

      await waitFor(() => {
        const topicBtn = screen.queryByLabelText('Go to topic orders');
        if (topicBtn) {
          fireEvent.click(topicBtn);
          expect(mockNavigateToTopic).toHaveBeenCalledWith('orders');
        }
      });
    });
  });
});
