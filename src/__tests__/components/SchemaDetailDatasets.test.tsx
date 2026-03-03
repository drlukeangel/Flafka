import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaDatasets } from '../../components/SchemaPanel/SchemaDatasets';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { SchemaDataset } from '../../types';

vi.mock('../../utils/synthetic-data', () => ({
  generateSyntheticRecord: vi.fn((_schema: string, _type: string, seed: number) => ({
    id: seed,
    name: `record-${seed}`,
  })),
}));

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

describe('[@schema-datasets] SchemaDatasets', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ schemaDatasets: [] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no datasets', () => {
    render(<SchemaDatasets {...defaultProps} />);
    expect(screen.getByText(/No test datasets yet/)).toBeTruthy();
  });

  it('renders list with name, count, date', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    expect(screen.getByText('Test Dataset')).toBeTruthy();
    expect(screen.getByText('2 records')).toBeTruthy();
  });

  it('upload button triggers file input', () => {
    render(<SchemaDatasets {...defaultProps} />);
    const uploadBtn = screen.getByText('Upload');
    const fileInput = screen.getByTestId('dataset-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');
    fireEvent.click(uploadBtn);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('generate button opens inline panel', () => {
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Generate'));
    expect(screen.getByLabelText('Number of records to generate')).toBeTruthy();
  });

  it('generate creates dataset in list', () => {
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Generate'));
    fireEvent.click(screen.getByText(/Generate 10 records/));
    const datasets = useWorkspaceStore.getState().schemaDatasets;
    expect(datasets).toHaveLength(1);
    expect(datasets[0].records.length).toBe(10);
  });

  it('click row enters detail mode with back button', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Test Dataset'));
    expect(screen.getByLabelText('Back to dataset list')).toBeTruthy();
    expect(screen.getByLabelText('Dataset name')).toBeTruthy();
  });

  it('edit name and save reflects in list', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Test Dataset'));
    const nameInput = screen.getByLabelText('Dataset name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByText('Save'));
    const updated = useWorkspaceStore.getState().schemaDatasets[0];
    expect(updated.name).toBe('Renamed');
  });

  it('invalid JSON in textarea shows inline error', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    fireEvent.click(screen.getByText('Test Dataset'));
    const textarea = screen.getByLabelText('Dataset records JSON') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'not valid json' } });
    fireEvent.click(screen.getByText('Save'));
    // Should show JSON parse error — the native V8 error starts with "Unexpected token"
    // or similar. Use queryAllByText to avoid "multiple elements" issue with broad regex.
    const errorNodes = screen.queryAllByText((content, element) => {
      return element?.tagName === 'DIV' && /Unexpected token|Invalid JSON|is not valid JSON/i.test(content);
    });
    expect(errorNodes.length).toBeGreaterThanOrEqual(1);
  });

  it('delete removes dataset from list', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    // Click delete button (first click = confirm prompt, we'll click twice)
    const deleteBtn = screen.getByLabelText('Delete Test Dataset');
    fireEvent.click(deleteBtn); // First click: sets confirmDelete
    fireEvent.click(deleteBtn); // Second click: actually deletes
    expect(useWorkspaceStore.getState().schemaDatasets).toHaveLength(0);
  });

  it('delete last dataset shows empty state', () => {
    const ds = makeDataset();
    useWorkspaceStore.setState({ schemaDatasets: [ds] });
    render(<SchemaDatasets {...defaultProps} />);
    const deleteBtn = screen.getByLabelText('Delete Test Dataset');
    fireEvent.click(deleteBtn);
    fireEvent.click(deleteBtn);
    expect(screen.getByText(/No test datasets yet/)).toBeTruthy();
  });

  it('only shows datasets for current subject', () => {
    const ds1 = makeDataset({ name: 'Orders DS', schemaSubject: 'orders-value' });
    const ds2 = makeDataset({ name: 'Payments DS', schemaSubject: 'payments-value' });
    useWorkspaceStore.setState({ schemaDatasets: [ds1, ds2] });
    render(<SchemaDatasets {...defaultProps} />);
    expect(screen.getByText('Orders DS')).toBeTruthy();
    expect(screen.queryByText('Payments DS')).toBeNull();
  });
});
