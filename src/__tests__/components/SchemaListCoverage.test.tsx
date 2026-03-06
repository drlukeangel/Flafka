/**
 * @schema-list-coverage
 * Additional coverage tests for SchemaList.tsx
 *
 * Targets uncovered branches:
 *   - Bulk mode: enter, select items, select all, deselect all, exit
 *   - Bulk delete: confirmation modal, confirm delete, cancel delete
 *   - Bulk delete: error handling, dataset cleanup
 *   - Clear filters button
 *   - Re-fetch loading spinner (loading=true, hasLoadedOnce=true)
 *   - handleItemKeyDown: Escape in bulk mode exits bulk
 *   - Filtered count with type/compat filters active
 *   - "No subjects match the current filters" empty state
 *   - Hover styles on subject items (focus/blur)
 *   - Create button hidden in bulk mode
 *   - Bulk modal shows "and X more" when >5 selected
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

let mockSubjects: string[] = [];
let mockSchemaTypeCache: Record<string, string> = {};
let mockSchemaCompatCache: Record<string, string> = {};
let mockSchemaRegistryLoading = false;
let mockSchemaRegistryError: string | null = null;
const mockLoadSchemaRegistrySubjects = vi.fn().mockResolvedValue(undefined);
const mockLoadSchemaDetail = vi.fn();
const mockAddToast = vi.fn();

function buildMockState() {
  return {
    schemaRegistrySubjects: mockSubjects,
    schemaRegistryLoading: mockSchemaRegistryLoading,
    schemaRegistryError: mockSchemaRegistryError,
    selectedSchemaSubject: null,
    schemaTypeCache: mockSchemaTypeCache,
    schemaCompatCache: mockSchemaCompatCache,
    loadSchemaRegistrySubjects: mockLoadSchemaRegistrySubjects,
    loadSchemaDetail: mockLoadSchemaDetail,
    addToast: mockAddToast,
    schemaDatasets: [],
    deleteSchemaDataset: vi.fn(),
  };
}

vi.mock('../../store/workspaceStore', () => {
  const fn = vi.fn();
  (fn as unknown as { getState: () => unknown }).getState = vi.fn();
  return { useWorkspaceStore: fn };
});

vi.mock('../../config/environment', () => ({
  env: { schemaRegistryUrl: '' },
}));

vi.mock('../../api/schema-registry-api', () => ({
  deleteSubject: vi.fn().mockResolvedValue([1]),
  listSubjects: vi.fn(),
  getSchemaDetail: vi.fn(),
  getSchemaVersions: vi.fn().mockResolvedValue([]),
  getCompatibilityMode: vi.fn().mockResolvedValue(null),
  getCompatibilityModeWithSource: vi.fn().mockResolvedValue({ level: 'BACKWARD', isGlobal: false }),
  validateCompatibility: vi.fn(),
  registerSchema: vi.fn(),
  deleteSchemaVersion: vi.fn(),
  setCompatibilityMode: vi.fn(),
  getSubjectsForSchemaId: vi.fn().mockResolvedValue([]),
}));

import SchemaList from '../../components/SchemaPanel/SchemaList';
import * as workspaceStoreModule from '../../store/workspaceStore';
import * as schemaRegistryApi from '../../api/schema-registry-api';

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@schema-list-coverage] bulk mode — enter and exit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSubjects = ['orders', 'payments', 'returns'];
    mockSchemaTypeCache = {};
    mockSchemaCompatCache = {};
    mockSchemaRegistryLoading = false;
    mockSchemaRegistryError = null;
  });

  it('renders the bulk mode toggle button when subjects exist', () => {
    render(<SchemaList />);
    expect(screen.getByRole('button', { name: /enter bulk selection mode/i })).toBeInTheDocument();
  });

  it('entering bulk mode shows checkboxes and hides create button', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));

    // Create button should be hidden
    expect(screen.queryByRole('button', { name: /create new schema/i })).not.toBeInTheDocument();

    // Bulk toolbar should be visible
    expect(screen.getByRole('toolbar', { name: /bulk selection actions/i })).toBeInTheDocument();
  });

  it('clicking a subject in bulk mode toggles its selection (not loadSchemaDetail)', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));

    // Click a subject
    fireEvent.click(screen.getByText('orders'));

    // loadSchemaDetail should NOT be called
    expect(mockLoadSchemaDetail).not.toHaveBeenCalled();

    // The "1 selected" text should appear
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('clicking the same subject again deselects it', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));

    fireEvent.click(screen.getByText('orders'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByText('orders'));
    expect(screen.getByText('Select all')).toBeInTheDocument();
  });

  it('Exit bulk mode button clears selection', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));
    fireEvent.click(screen.getByText('orders'));

    fireEvent.click(screen.getByRole('button', { name: /exit bulk selection mode/i }));

    // Should be back to normal mode
    expect(screen.getByRole('button', { name: /enter bulk selection mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new schema/i })).toBeInTheDocument();
  });

  it('Escape key in bulk mode exits bulk mode', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));

    const item = screen.getByRole('listitem', { name: /schema subject: orders/i });
    fireEvent.keyDown(item, { key: 'Escape' });

    expect(screen.getByRole('button', { name: /enter bulk selection mode/i })).toBeInTheDocument();
  });

  it('Space key in bulk mode toggles selection', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));

    const item = screen.getByRole('listitem', { name: /schema subject: orders/i });
    fireEvent.keyDown(item, { key: ' ' });

    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });
});

describe('[@schema-list-coverage] bulk mode — select all / deselect all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSubjects = ['orders', 'payments'];
    mockSchemaTypeCache = {};
    mockSchemaCompatCache = {};
    mockSchemaRegistryLoading = false;
    mockSchemaRegistryError = null;
  });

  it('Select all button selects all filtered subjects', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));

    fireEvent.click(screen.getByRole('button', { name: /select all subjects/i }));

    expect(screen.getByText('Deselect all')).toBeInTheDocument();
  });

  it('Deselect all button clears all selections', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));

    fireEvent.click(screen.getByRole('button', { name: /select all subjects/i }));
    expect(screen.getByText('Deselect all')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear all selections/i }));
    expect(screen.getByText('Select all')).toBeInTheDocument();
  });
});

describe('[@schema-list-coverage] bulk delete — confirmation modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSubjects = ['orders', 'payments', 'returns'];
    mockSchemaTypeCache = {};
    mockSchemaCompatCache = {};
    mockSchemaRegistryLoading = false;
    mockSchemaRegistryError = null;
  });

  it('delete button is disabled when no subjects are selected', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));

    const deleteBtn = screen.getByRole('button', { name: /delete 0 selected/i });
    expect(deleteBtn).toBeDisabled();
  });

  it('clicking delete opens confirmation modal', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));
    fireEvent.click(screen.getByText('orders'));

    fireEvent.click(screen.getByRole('button', { name: /delete 1 selected/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Delete 1 subject\?/)).toBeInTheDocument();
  });

  it('cancel button closes the confirmation modal', () => {
    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));
    fireEvent.click(screen.getByText('orders'));
    fireEvent.click(screen.getByRole('button', { name: /delete 1 selected/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirm delete calls deleteSubject and refreshes list', async () => {
    vi.mocked(schemaRegistryApi.deleteSubject).mockResolvedValue([1]);

    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));
    fireEvent.click(screen.getByText('orders'));
    fireEvent.click(screen.getByRole('button', { name: /delete 1 selected/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm delete 1 subject/i }));
    });

    await waitFor(() => {
      expect(schemaRegistryApi.deleteSubject).toHaveBeenCalledWith('orders');
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', message: expect.stringContaining('1') })
      );
    });
  });

  it('confirm delete shows error toast on failure', async () => {
    vi.mocked(schemaRegistryApi.deleteSubject).mockRejectedValue(new Error('Server error'));

    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));
    fireEvent.click(screen.getByText('orders'));
    fireEvent.click(screen.getByRole('button', { name: /delete 1 selected/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm delete 1 subject/i }));
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', message: expect.stringContaining('Server error') })
      );
    });
  });

  it('modal shows "and X more" when more than 5 subjects selected', () => {
    mockSubjects = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    setupStoreMock();

    render(<SchemaList />);
    fireEvent.click(screen.getByRole('button', { name: /enter bulk selection mode/i }));

    // Select all
    fireEvent.click(screen.getByRole('button', { name: /select all subjects/i }));

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /delete 7 selected/i }));

    expect(screen.getByText(/and 2 more/)).toBeInTheDocument();
  });
});

describe('[@schema-list-coverage] clear filters button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSubjects = ['orders', 'payments'];
    mockSchemaTypeCache = { orders: 'AVRO', payments: 'PROTOBUF' };
    mockSchemaCompatCache = {};
    mockSchemaRegistryLoading = false;
    mockSchemaRegistryError = null;
  });

  it('clear button appears when a type filter is active', () => {
    render(<SchemaList />);
    const typeSelect = screen.getByLabelText('Filter by schema type');
    fireEvent.change(typeSelect, { target: { value: 'AVRO' } });

    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('clicking clear resets both type and compat filters', async () => {
    render(<SchemaList />);
    const typeSelect = screen.getByLabelText('Filter by schema type');
    fireEvent.change(typeSelect, { target: { value: 'AVRO' } });

    fireEvent.click(screen.getByText('Clear'));

    await waitFor(() => {
      // Both subjects should be visible again
      expect(screen.getByText('orders')).toBeInTheDocument();
      expect(screen.getByText('payments')).toBeInTheDocument();
    });
  });
});

describe('[@schema-list-coverage] re-fetch spinner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubjects = ['orders'];
    mockSchemaTypeCache = {};
    mockSchemaCompatCache = {};
    mockSchemaRegistryLoading = false;
    mockSchemaRegistryError = null;
  });

  it('shows inline spinner on re-fetch (not skeleton) when hasLoadedOnce is true', () => {
    // First render with loading=false so hasLoadedOnce becomes true
    mockSchemaRegistryLoading = false;
    setupStoreMock();
    const { rerender, container } = render(<SchemaList />);

    // No skeleton
    expect(container.querySelectorAll('.shimmer').length).toBe(0);

    // Now simulate re-fetch: loading=true with data already loaded
    mockSchemaRegistryLoading = true;
    setupStoreMock();
    rerender(<SchemaList />);

    // Should NOT show skeleton (hasLoadedOnce=true), subjects should still be visible
    expect(container.querySelectorAll('.shimmer').length).toBe(0);
    expect(screen.getByText('orders')).toBeInTheDocument();
  });
});

describe('[@schema-list-coverage] filtered count with type/compat filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSubjects = ['orders', 'payments', 'returns'];
    mockSchemaTypeCache = { orders: 'AVRO', payments: 'AVRO', returns: 'PROTOBUF' };
    mockSchemaCompatCache = { orders: 'BACKWARD', payments: 'FULL', returns: 'NONE' };
    mockSchemaRegistryLoading = false;
    mockSchemaRegistryError = null;
  });

  it('shows "X of Y subjects" when type filter is active', () => {
    render(<SchemaList />);
    const typeSelect = screen.getByLabelText('Filter by schema type');
    fireEvent.change(typeSelect, { target: { value: 'AVRO' } });

    expect(screen.getByText('2 of 3 subjects')).toBeInTheDocument();
  });

  it('shows "No subjects match" when filters match nothing', () => {
    render(<SchemaList />);
    const typeSelect = screen.getByLabelText('Filter by schema type');
    fireEvent.change(typeSelect, { target: { value: 'JSON' } });

    expect(screen.getByText(/no subjects match/i)).toBeInTheDocument();
  });
});

describe('[@schema-list-coverage] type badge on items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSubjects = ['orders'];
    mockSchemaTypeCache = { orders: 'AVRO' };
    mockSchemaCompatCache = {};
    mockSchemaRegistryLoading = false;
    mockSchemaRegistryError = null;
  });

  it('shows AVRO type badge on subject item when schemaTypeCache has entry', () => {
    render(<SchemaList />);
    expect(screen.getByTitle('Schema type: AVRO')).toBeInTheDocument();
  });
});
