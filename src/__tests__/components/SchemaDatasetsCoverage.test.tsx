/**
 * @schema-datasets-coverage
 * Additional coverage tests for SchemaDatasets.tsx
 *
 * Targets uncovered branches:
 *   - File upload: JSON array, JSONL format, too many records, parse error
 *   - Generate: select different count, records all error (returns empty)
 *   - Detail mode: download, save with non-array, save with too many records
 *   - Detail mode: delete from within detail mode resets selectedDatasetId
 *   - Detail mode: textarea onChange clears editError
 *   - Detail mode: back button exits detail
 *   - Dataset row hover styles (onMouseOver/onMouseOut)
 *   - Dataset row keyboard Enter navigates to detail
 *   - Confirm delete timeout reset
 *   - Dataset count badge shows when datasets > 0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { SchemaDatasets } from '../../components/SchemaPanel/SchemaDatasets';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { SchemaDataset } from '../../types';

vi.mock('../../utils/synthetic-data', () => ({
  generateSyntheticRecord: vi.fn((_schema: string, _type: string, seed: number) => ({
    id: seed,
    name: `record-${seed}`,
  })),
}));

import * as syntheticDataModule from '../../utils/synthetic-data';

function makeDataset(overrides: Partial<SchemaDataset> = {}): SchemaDataset {
  return {
    id: crypto.randomUUID(),
    name: 'Test Dataset',
    schemaSubject: 'orders-value',
    records: [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const defaultProps = {
  subject: 'orders-value',
  schemaText: '{"type":"record","name":"Order","fields":[{"name":"id","type":"int"},{"name":"name","type":"string"}]}',
  schemaType: 'AVRO',
};

// ---------------------------------------------------------------------------
// Upload flow
// ---------------------------------------------------------------------------

describe('[@schema-datasets-coverage] upload flow', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ schemaDatasets: [] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('handles valid JSON array file upload', async () => {
    render(<SchemaDatasets {...defaultProps} />);
    const fileInput = screen.getByTestId('dataset-file-input') as HTMLInputElement;

    const jsonContent = JSON.stringify([{ id: 1 }, { id: 2 }]);
    const file = new File([jsonContent], 'test-data.json', { type: 'application/json' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      // Wait for file.text() to resolve
      await new Promise((r) => setTimeout(r, 10));
    });

    const datasets = useWorkspaceStore.getState().schemaDatasets;
    expect(datasets).toHaveLength(1);
    expect(datasets[0].name).toBe('test-data');
    expect(datasets[0].records).toHaveLength(2);
  });

  it('handles JSONL file upload', async () => {
    render(<SchemaDatasets {...defaultProps} />);
    const fileInput = screen.getByTestId('dataset-file-input') as HTMLInputElement;

    const jsonlContent = '{"id":1}\n{"id":2}\n{"id":3}';
    const file = new File([jsonlContent], 'test-data.jsonl', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 10));
    });

    const datasets = useWorkspaceStore.getState().schemaDatasets;
    expect(datasets).toHaveLength(1);
    expect(datasets[0].records).toHaveLength(3);
  });

  it('shows error for too many records (>500)', async () => {
    render(<SchemaDatasets {...defaultProps} />);
    const fileInput = screen.getByTestId('dataset-file-input') as HTMLInputElement;

    const bigArray = Array.from({ length: 501 }, (_, i) => ({ id: i }));
    const file = new File([JSON.stringify(bigArray)], 'big.json', { type: 'application/json' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.getByText(/Too many records: 501/)).toBeInTheDocument();
    expect(useWorkspaceStore.getState().schemaDatasets).toHaveLength(0);
  });

  it('shows error when file content is not valid JSON', async () => {
    render(<SchemaDatasets {...defaultProps} />);
    const fileInput = screen.getByTestId('dataset-file-input') as HTMLInputElement;

    const file = new File(['not valid json at all'], 'bad.json', { type: 'application/json' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should show a parse error
    const errorElements = screen.queryAllByText((content) =>
      /Unexpected token|Failed to parse|is not valid/i.test(content)
    );
    expect(errorElements.length).toBeGreaterThanOrEqual(1);
  });

  it('strips .json extension from filename for dataset name', async () => {
    render(<SchemaDatasets {...defaultProps} />);
    const fileInput = screen.getByTestId('dataset-file-input') as HTMLInputElement;

    const file = new File([JSON.stringify([{ a: 1 }])], 'my-data.json', { type: 'application/json' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 10));
    });

    const datasets = useWorkspaceStore.getState().schemaDatasets;
    expect(datasets[0].name).toBe('my-data');
  });

  it('no-ops when no file is selected', async () => {
    render(<SchemaDatasets {...defaultProps} />);
    const fileInput = screen.getByTestId('dataset-file-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [] } });
    });

    expect(useWorkspaceStore.getState().schemaDatasets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Generate flow
// ---------------------------------------------------------------------------

describe('[@schema-datasets-coverage] generate flow', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ schemaDatasets: [] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('generates with different count (25)', () => {
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Generate'));

    const countSelect = screen.getByLabelText('Number of records to generate');
    fireEvent.change(countSelect, { target: { value: '25' } });
    fireEvent.click(screen.getByText(/Generate 25 records/));

    const datasets = useWorkspaceStore.getState().schemaDatasets;
    expect(datasets).toHaveLength(1);
    expect(datasets[0].records.length).toBe(25);
    expect(datasets[0].name).toBe('Generated 25');
  });

  it('does not create dataset when all records fail generation', () => {
    // Override the mock to return errors for all
    vi.mocked(syntheticDataModule.generateSyntheticRecord).mockImplementation(() => ({ error: 'parse fail' }));

    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Generate'));
    fireEvent.click(screen.getByText(/Generate 10 records/));

    expect(useWorkspaceStore.getState().schemaDatasets).toHaveLength(0);

    // Restore mock
    vi.mocked(syntheticDataModule.generateSyntheticRecord).mockImplementation(
      (_s: string, _t: string, seed: number) => ({ id: seed, name: `record-${seed}` }) as Record<string, unknown>
    );
  });

  it('toggles generate panel off when clicking Generate again', () => {
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Generate'));
    expect(screen.getByLabelText('Number of records to generate')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Generate'));
    expect(screen.queryByLabelText('Number of records to generate')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Detail mode — save validation
// ---------------------------------------------------------------------------

describe('[@schema-datasets-coverage] detail mode — save edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows error when records are not a JSON array (object instead)', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Test Dataset'));

    const textarea = screen.getByLabelText('Dataset records JSON') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{"notAnArray": true}' } });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Records must be a JSON array')).toBeInTheDocument();
  });

  it('shows error when records exceed MAX_RECORDS (500)', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Test Dataset'));

    const bigArray = Array.from({ length: 501 }, (_, i) => ({ id: i }));
    const textarea = screen.getByLabelText('Dataset records JSON') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: JSON.stringify(bigArray) } });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText(/Too many records: 501/)).toBeInTheDocument();
  });

  it('editing textarea clears previous edit error', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Test Dataset'));

    const textarea = screen.getByLabelText('Dataset records JSON') as HTMLTextAreaElement;
    // Trigger an error first
    fireEvent.change(textarea, { target: { value: 'invalid' } });
    fireEvent.click(screen.getByText('Save'));

    // Error should be visible
    const errorNodes = screen.queryAllByText((content) =>
      /Unexpected token|Invalid JSON|is not valid JSON/i.test(content)
    );
    expect(errorNodes.length).toBeGreaterThanOrEqual(1);

    // Now change textarea — error should clear
    fireEvent.change(textarea, { target: { value: '[{"id":1}]' } });

    // Old error messages should be gone (onChange sets editError to null)
    const errorNodesAfter = screen.queryAllByText((content) =>
      /Unexpected token|Invalid JSON|is not valid JSON|Records must be|Too many/i.test(content)
    );
    expect(errorNodesAfter).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Detail mode — download and delete
// ---------------------------------------------------------------------------

describe('[@schema-datasets-coverage] detail mode — download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('download button creates a blob URL and triggers a link click', () => {
    const ds = makeDataset({ name: 'MyDS' });
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('MyDS'));

    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const mockRevokeObjectURL = vi.fn();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        el.click = mockClick;
      }
      return el;
    });

    fireEvent.click(screen.getByText('Download'));

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');

    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });
});

describe('[@schema-datasets-coverage] detail mode — delete from detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('delete button in detail mode removes dataset and returns to list', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);

    // Enter detail mode
    fireEvent.click(screen.getByText('Test Dataset'));
    expect(screen.getByLabelText('Back to dataset list')).toBeInTheDocument();

    // Click Delete in detail mode (single click, no confirm needed)
    fireEvent.click(screen.getByText('Delete'));

    // Should be back to list (empty state)
    expect(screen.getByText(/No test datasets yet/)).toBeInTheDocument();
  });

  it('back button in detail mode returns to list without deleting', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);

    fireEvent.click(screen.getByText('Test Dataset'));
    expect(screen.getByLabelText('Dataset name')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Back to dataset list'));

    // Should be back on list with dataset still there
    expect(screen.getByText('Test Dataset')).toBeInTheDocument();
    expect(useWorkspaceStore.getState().schemaDatasets).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// List mode — row interactions
// ---------------------------------------------------------------------------

describe('[@schema-datasets-coverage] list mode — row interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('dataset row hover changes background', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);

    const row = screen.getByRole('button', { name: /Dataset: Test Dataset/i });
    fireEvent.mouseOver(row);
    expect(row.style.background).toBe('var(--color-bg-hover)');

    fireEvent.mouseOut(row);
    expect(row.style.background).toBe('');
  });

  it('pressing Enter on a dataset row enters detail mode', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);

    const row = screen.getByRole('button', { name: /Dataset: Test Dataset/i });
    fireEvent.keyDown(row, { key: 'Enter' });

    expect(screen.getByLabelText('Dataset name')).toBeInTheDocument();
  });

  it('shows dataset count badge when datasets exist', () => {
    const ds1 = makeDataset({ name: 'DS1' });
    const ds2 = makeDataset({ name: 'DS2' });
    useWorkspaceStore.setState({ schemaDatasets: [ds1, ds2] });
    render(<SchemaDatasets {...defaultProps} />);

    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('confirm delete resets after timeout', async () => {
    vi.useFakeTimers();
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);

    const deleteBtn = screen.getByLabelText('Delete Test Dataset');
    fireEvent.click(deleteBtn); // First click sets confirmDelete

    // Title should indicate "Click again to confirm delete"
    expect(deleteBtn).toHaveAttribute('title', 'Click again to confirm delete');

    // Advance 3 seconds — confirmDelete should reset
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(deleteBtn).toHaveAttribute('title', 'Delete dataset');
    vi.useRealTimers();
  });
});
