import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { JobsList } from '../../components/JobsPage/JobsList';
import type { StatementResponse } from '../../api/flink-api';

vi.mock('../../config/environment', () => ({
  env: {
    cloudProvider: 'aws',
    cloudRegion: 'us-east-1',
  },
}));

const mockStatements: StatementResponse[] = [
  {
    name: 'stmt-running-1',
    metadata: { created_at: new Date(Date.now() - 60000).toISOString() },
    spec: { statement: 'SELECT * FROM orders', statement_type: 'SELECT', compute_pool_id: 'pool-1', properties: {} },
    status: { phase: 'RUNNING' },
  },
  {
    name: 'stmt-pending-1',
    metadata: { created_at: new Date(Date.now() - 120000).toISOString() },
    spec: { statement: 'SELECT * FROM users', statement_type: 'SELECT', compute_pool_id: 'pool-1', properties: {} },
    status: { phase: 'PENDING' },
  },
  {
    name: 'stmt-completed-1',
    metadata: { created_at: new Date(Date.now() - 3600000).toISOString() },
    spec: { statement: 'SELECT count(*) FROM payments', statement_type: 'SELECT', compute_pool_id: 'pool-1', properties: {} },
    status: { phase: 'COMPLETED' },
  },
  {
    name: 'stmt-cancelled-1',
    metadata: {},
    spec: { statement: 'INSERT INTO sink SELECT * FROM source', statement_type: 'INSERT', properties: {} },
    status: { phase: 'CANCELLED' },
  },
  {
    name: 'stmt-failed-1',
    metadata: { created_at: new Date(Date.now() - 86400000).toISOString() },
    spec: { statement: 'BAD SQL QUERY', statement_type: 'SELECT', properties: {} },
    status: { phase: 'FAILED', detail: 'Syntax error' },
  },
];

describe('[@jobs-list] JobsList', () => {
  const onSelectJob = vi.fn();
  const onCancelJob = vi.fn();
  const onDeleteJob = vi.fn();
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  const renderList = (overrides: Partial<Parameters<typeof JobsList>[0]> = {}) =>
    render(
      <JobsList
        statements={mockStatements}
        loading={false}
        error={null}
        onSelectJob={onSelectJob}
        onCancelJob={onCancelJob}
        onDeleteJob={onDeleteJob}
        onRefresh={onRefresh}
        {...overrides}
      />
    );

  it('renders loading state when loading with no statements', () => {
    renderList({ loading: true, statements: [] });
    expect(screen.getByText('Loading statements...')).toBeTruthy();
  });

  it('renders error state with retry button', () => {
    renderList({ error: 'Network error', statements: [] });
    expect(screen.getByText('Network error')).toBeTruthy();
    fireEvent.click(screen.getByText('Retry'));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('renders empty state when no matches', () => {
    renderList({ statements: [] });
    expect(screen.getByText('No statements match your filters.')).toBeTruthy();
  });

  it('renders all columns (checkbox, name, status, type, SQL, created, actions)', () => {
    renderList();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Type')).toBeTruthy();
    expect(screen.getByText('SQL')).toBeTruthy();
    expect(screen.getByText('Created')).toBeTruthy();
    const ths = document.querySelectorAll('.jobs-table th');
    expect(Array.from(ths).some((th) => th.textContent === 'Actions')).toBe(true);
    expect(screen.getByLabelText('Select all')).toBeTruthy();
    expect(screen.getByText('stmt-running-1')).toBeTruthy();
  });

  it('renders status dots with correct labels', () => {
    renderList();
    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Stopped')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
  });

  it('search filters by name', () => {
    renderList();
    const input = screen.getByPlaceholderText('Search by name or SQL...');
    fireEvent.change(input, { target: { value: 'running' } });
    expect(screen.getByText('stmt-running-1')).toBeTruthy();
    expect(screen.queryByText('stmt-completed-1')).toBeNull();
  });

  it('search filters by SQL content', () => {
    renderList();
    const input = screen.getByPlaceholderText('Search by name or SQL...');
    fireEvent.change(input, { target: { value: 'payments' } });
    expect(screen.getByText('stmt-completed-1')).toBeTruthy();
    expect(screen.queryByText('stmt-running-1')).toBeNull();
  });

  // --- Filter dropdown ---

  it('filter dropdown options show correct counts', () => {
    renderList();
    const dropdown = screen.getByLabelText('Filter statements') as HTMLSelectElement;
    const options = Array.from(dropdown.options);
    expect(options.find((o) => o.value === 'all')?.textContent).toBe('All (5)');
    expect(options.find((o) => o.value === 'running')?.textContent).toBe('Running (2)');
    expect(options.find((o) => o.value === 'completed')?.textContent).toBe('Completed (1)');
    expect(options.find((o) => o.value === 'stopped')?.textContent).toBe('Stopped (1)');
    expect(options.find((o) => o.value === 'failed')?.textContent).toBe('Failed (1)');
  });

  it('filter dropdown filters correctly', () => {
    renderList();
    const dropdown = screen.getByLabelText('Filter statements');
    fireEvent.change(dropdown, { target: { value: 'running' } });
    expect(screen.getByText('stmt-running-1')).toBeTruthy();
    expect(screen.getByText('stmt-pending-1')).toBeTruthy();
    expect(screen.queryByText('stmt-completed-1')).toBeNull();
  });

  it('CANCELLED maps to stopped filter option', () => {
    renderList();
    const dropdown = screen.getByLabelText('Filter statements');
    fireEvent.change(dropdown, { target: { value: 'stopped' } });
    expect(screen.getByText('stmt-cancelled-1')).toBeTruthy();
    expect(screen.queryByText('stmt-running-1')).toBeNull();
  });

  // --- Checkbox ---

  it('checkbox toggles individual row selection', () => {
    renderList();
    const checkbox = screen.getByLabelText('Select stmt-running-1') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('header checkbox selects and deselects all', () => {
    renderList();
    const selectAll = screen.getByLabelText('Select all') as HTMLInputElement;
    fireEvent.click(selectAll);
    for (const s of mockStatements) {
      expect((screen.getByLabelText(`Select ${s.name}`) as HTMLInputElement).checked).toBe(true);
    }
    fireEvent.click(selectAll);
    for (const s of mockStatements) {
      expect((screen.getByLabelText(`Select ${s.name}`) as HTMLInputElement).checked).toBe(false);
    }
  });

  it('checkbox click does not propagate to row', () => {
    renderList();
    const checkbox = screen.getByLabelText('Select stmt-running-1');
    fireEvent.click(checkbox);
    expect(onSelectJob).not.toHaveBeenCalled();
  });

  // --- Actions menu ---

  it('actions button disabled when nothing selected', () => {
    renderList();
    const actionsBtn = document.querySelector('.jobs-actions-btn') as HTMLButtonElement;
    expect(actionsBtn.disabled).toBe(true);
  });

  it('shows Stop action when all selected are RUNNING/PENDING', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Select stmt-running-1'));
    fireEvent.click(screen.getByLabelText('Select stmt-pending-1'));
    const actionsBtn = document.querySelector('.jobs-actions-btn') as HTMLButtonElement;
    fireEvent.click(actionsBtn);
    expect(screen.getByText('Stop statement')).toBeTruthy();
    expect(screen.queryByText('Delete statement')).toBeNull();
  });

  it('shows Delete action when all selected are terminal', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Select stmt-completed-1'));
    fireEvent.click(screen.getByLabelText('Select stmt-failed-1'));
    const actionsBtn = document.querySelector('.jobs-actions-btn') as HTMLButtonElement;
    fireEvent.click(actionsBtn);
    expect(screen.getByText('Delete statement')).toBeTruthy();
    expect(screen.queryByText('Stop statement')).toBeNull();
  });

  it('shows no actions when mixed selection', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Select stmt-running-1'));
    fireEvent.click(screen.getByLabelText('Select stmt-completed-1'));
    const actionsBtn = document.querySelector('.jobs-actions-btn') as HTMLButtonElement;
    fireEvent.click(actionsBtn);
    expect(screen.getByText('No actions available')).toBeTruthy();
  });

  it('bulk stop calls onCancelJob for all selected', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Select stmt-running-1'));
    fireEvent.click(screen.getByLabelText('Select stmt-pending-1'));
    const actionsBtn = document.querySelector('.jobs-actions-btn') as HTMLButtonElement;
    fireEvent.click(actionsBtn);
    fireEvent.click(screen.getByText('Stop statement'));
    expect(onCancelJob).toHaveBeenCalledTimes(2);
    expect(onCancelJob).toHaveBeenCalledWith('stmt-running-1');
    expect(onCancelJob).toHaveBeenCalledWith('stmt-pending-1');
  });

  it('bulk delete calls onDeleteJob for all selected', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Select stmt-cancelled-1'));
    fireEvent.click(screen.getByLabelText('Select stmt-failed-1'));
    const actionsBtn = document.querySelector('.jobs-actions-btn') as HTMLButtonElement;
    fireEvent.click(actionsBtn);
    fireEvent.click(screen.getByText('Delete statement'));
    expect(onDeleteJob).toHaveBeenCalledTimes(2);
    expect(onDeleteJob).toHaveBeenCalledWith('stmt-cancelled-1');
    expect(onDeleteJob).toHaveBeenCalledWith('stmt-failed-1');
  });

  // --- Region subtitle ---

  it('region subtitle shown when compute_pool_id present', () => {
    renderList();
    const regionSubtitles = document.querySelectorAll('.jobs-cell-name-region');
    expect(regionSubtitles.length).toBe(3);
    expect(regionSubtitles[0].textContent).toBe('AWS.us-east-1.pool-1');
  });

  it('region subtitle not shown when compute_pool_id missing', () => {
    renderList();
    const cancelledRow = screen.getByText('stmt-cancelled-1').closest('tr')!;
    expect(cancelledRow.querySelector('.jobs-cell-name-region')).toBeNull();
  });

  // --- Page loaded timestamp ---

  it('page loaded timestamp shown', () => {
    renderList();
    expect(screen.getByText(/Page loaded/)).toBeTruthy();
  });

  // --- Count message ---

  it('shows updated count message text', () => {
    renderList();
    expect(screen.getByText(/5 statements shown\./)).toBeTruthy();
  });

  it('shows fetch more hint when filtered < total', () => {
    renderList();
    const dropdown = screen.getByLabelText('Filter statements');
    fireEvent.change(dropdown, { target: { value: 'running' } });
    expect(screen.getByText(/Scroll or use search to fetch more\./)).toBeTruthy();
  });

  // --- Existing behavior ---

  it('stop button visible only for RUNNING/PENDING', () => {
    renderList();
    const stopButtons = screen.getAllByTitle('Stop');
    expect(stopButtons).toHaveLength(2);
  });

  it('stop button click calls onCancelJob', () => {
    renderList();
    const stopButtons = screen.getAllByTitle('Stop');
    fireEvent.click(stopButtons[0]);
    expect(onCancelJob).toHaveBeenCalledWith('stmt-running-1');
  });

  it('stop button click does not propagate to row', () => {
    renderList();
    const stopButtons = screen.getAllByTitle('Stop');
    fireEvent.click(stopButtons[0]);
    expect(onSelectJob).not.toHaveBeenCalled();
  });

  it('row click calls onSelectJob', () => {
    renderList();
    const row = screen.getByText('stmt-completed-1').closest('tr');
    if (row) fireEvent.click(row);
    expect(onSelectJob).toHaveBeenCalledWith('stmt-completed-1');
  });

  it('refresh button calls onRefresh', () => {
    renderList();
    fireEvent.click(screen.getByTitle('Refresh'));
    expect(onRefresh).toHaveBeenCalled();
  });
});
