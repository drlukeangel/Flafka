import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { JobsList } from '../../components/JobsPage/JobsList';
import type { StatementResponse } from '../../api/flink-api';

vi.mock('../../config/environment', () => ({
  env: {
    cloudProvider: 'aws',
    cloudRegion: 'us-east-1',
    uniqueId: 'test',
    isAdmin: true,
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

  // --- Filter flyout ---

  it('filter flyout shows status options when opened', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Filter'));
    expect(screen.getByText('Statement Status')).toBeTruthy();
    expect(screen.getByLabelText('Running')).toBeTruthy();
    expect(screen.getByLabelText('Completed')).toBeTruthy();
    expect(screen.getByLabelText('Stopped')).toBeTruthy();
    expect(screen.getByLabelText('Failed')).toBeTruthy();
  });

  it('filter flyout filters by checked status', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Filter'));
    fireEvent.click(screen.getByLabelText('Running'));
    expect(screen.getByText('stmt-running-1')).toBeTruthy();
    expect(screen.queryByText('stmt-completed-1')).toBeNull();
  });

  it('CANCELLED maps to Stopped filter checkbox', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Filter'));
    fireEvent.click(screen.getByLabelText('Stopped'));
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
    fireEvent.click(screen.getByLabelText('Filter'));
    fireEvent.click(screen.getByLabelText('Running'));
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

// ---------------------------------------------------------------------------
// [@coverage-boost] JobsList — additional coverage for uncovered branches
// ---------------------------------------------------------------------------

describe('[@coverage-boost] JobsList edge cases', () => {
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

  it('getStatusClass returns "unknown" for undefined phase', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-no-phase',
      spec: { statement: 'SELECT 1', properties: {} },
      status: {},
    }];
    renderList({ statements: stmts });
    expect(document.querySelector('.status-dot.unknown')).toBeTruthy();
  });

  it('getStatusClass returns "unknown" for unrecognized phase string', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-weird',
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'BIZARRE' },
    }];
    renderList({ statements: stmts });
    expect(document.querySelector('.status-dot.unknown')).toBeTruthy();
  });

  it('getStatusLabel returns "Unknown" for undefined phase', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-undef-phase',
      spec: { statement: 'SELECT 1', properties: {} },
      status: {},
    }];
    renderList({ statements: stmts });
    expect(screen.getByText('Unknown')).toBeTruthy();
  });

  it('formatRelativeTime shows "just now" for very recent date', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-just-now',
      metadata: { created_at: new Date().toISOString() },
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    expect(screen.getByText('just now')).toBeTruthy();
  });

  it('formatRelativeTime shows em-dash for undefined date', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-no-date',
      metadata: {},
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    // The created_at cell should show em-dash
    const createdCells = document.querySelectorAll('.jobs-cell-created');
    expect(Array.from(createdCells).some(c => c.textContent === '\u2014')).toBe(true);
  });

  it('formatRelativeTime shows em-dash for invalid date string', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-bad-date',
      metadata: { created_at: 'not-a-date' },
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    const createdCells = document.querySelectorAll('.jobs-cell-created');
    expect(Array.from(createdCells).some(c => c.textContent === '\u2014')).toBe(true);
  });

  it('formatRelativeTime shows hours for hour-old date', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-hours',
      metadata: { created_at: new Date(Date.now() - 7200000).toISOString() },
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    expect(screen.getByText('2h ago')).toBeTruthy();
  });

  it('formatRelativeTime shows days for day-old date', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-days',
      metadata: { created_at: new Date(Date.now() - 172800000).toISOString() },
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    expect(screen.getByText('2d ago')).toBeTruthy();
  });

  it('SQL truncated at 80 chars with ellipsis', () => {
    const longSql = 'SELECT ' + 'a'.repeat(100) + ' FROM table_name';
    const stmts: StatementResponse[] = [{
      name: 'stmt-long-sql',
      metadata: {},
      spec: { statement: longSql, statement_type: 'SELECT', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    const sqlCell = document.querySelector('.jobs-cell-sql');
    expect(sqlCell?.textContent?.endsWith('\u2026')).toBe(true);
    expect(sqlCell?.textContent?.length).toBeLessThanOrEqual(81); // 80 + ellipsis
  });

  it('SQL shown in full when <= 80 chars', () => {
    const shortSql = 'SELECT 1';
    const stmts: StatementResponse[] = [{
      name: 'stmt-short-sql',
      metadata: {},
      spec: { statement: shortSql, statement_type: 'SELECT', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    const sqlCell = document.querySelector('.jobs-cell-sql');
    expect(sqlCell?.textContent).toBe('SELECT 1');
  });

  it('SQL shows em-dash when statement is undefined', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-no-sql',
      metadata: {},
      spec: { properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    const sqlCell = document.querySelector('.jobs-cell-sql');
    expect(sqlCell?.textContent).toBe('\u2014');
  });

  it('statement_type shows em-dash when undefined', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-no-type',
      metadata: {},
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    const typeCell = document.querySelector('.jobs-cell-type');
    expect(typeCell?.textContent).toBe('\u2014');
  });

  it('region subtitle not shown when compute_pool_id is null', () => {
    const stmts: StatementResponse[] = [{
      name: 'stmt-no-pool',
      metadata: {},
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: stmts });
    expect(document.querySelector('.jobs-cell-name-region')).toBeNull();
  });

  it('shows "Loading more..." when loading with existing statements', () => {
    renderList({ loading: true });
    expect(screen.getByText(/Loading more\.\.\./)).toBeTruthy();
  });

  it('singular "1 statement shown" for single statement', () => {
    const singleStmt: StatementResponse[] = [{
      name: 'only-one',
      metadata: {},
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    }];
    renderList({ statements: singleStmt });
    expect(screen.getByText(/1 statement shown\./)).toBeTruthy();
  });

  it('stale selections cleaned when filter changes', () => {
    renderList();
    // Select a running statement
    fireEvent.click(screen.getByLabelText('Select stmt-running-1'));
    expect((screen.getByLabelText('Select stmt-running-1') as HTMLInputElement).checked).toBe(true);

    // Filter to completed only — running selection should be cleared
    fireEvent.click(screen.getByLabelText('Filter'));
    fireEvent.click(screen.getByLabelText('Completed'));
    // The running row is no longer visible
    expect(screen.queryByLabelText('Select stmt-running-1')).toBeNull();
  });

  it('actions dropdown closes on outside click', () => {
    renderList();
    // Select a statement to enable actions
    fireEvent.click(screen.getByLabelText('Select stmt-running-1'));
    const actionsBtn = document.querySelector('.jobs-actions-btn') as HTMLButtonElement;
    fireEvent.click(actionsBtn);
    expect(screen.getByText('Stop statement')).toBeTruthy();

    // Simulate click outside the actions menu
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Stop statement')).toBeNull();
  });

  it('bulk stop clears selection after execution', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Select stmt-running-1'));
    const actionsBtn = document.querySelector('.jobs-actions-btn') as HTMLButtonElement;
    fireEvent.click(actionsBtn);
    fireEvent.click(screen.getByText('Stop statement'));
    // After bulk stop, actions button should be disabled (no selection)
    expect(actionsBtn.disabled).toBe(true);
  });

  it('no filters selected shows all statements', () => {
    renderList();
    expect(screen.getByText(/5 statements shown\./)).toBeTruthy();
  });

  it('failed filter shows only failed statements', () => {
    renderList();
    fireEvent.click(screen.getByLabelText('Filter'));
    fireEvent.click(screen.getByLabelText('Failed'));
    expect(screen.getByText('stmt-failed-1')).toBeTruthy();
    expect(screen.queryByText('stmt-running-1')).toBeNull();
  });
});
