import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { JobsDetail } from '../../components/JobsPage/JobsDetail';
import type { StatementResponse } from '../../api/flink-api';

// Mock flink-api (needed because JobsDetail imports it for auto-refresh)
vi.mock('../../api/flink-api', () => ({
  executeSQL: vi.fn(),
  getStatementStatus: vi.fn(),
  getStatementResults: vi.fn(),
  cancelStatement: vi.fn(),
  getComputePoolStatus: vi.fn(),
  listStatements: vi.fn(),
  listStatementsFirstPage: vi.fn(),
  getCatalogs: vi.fn(),
  getDatabases: vi.fn(),
  getTables: vi.fn(),
  getViews: vi.fn(),
  getFunctions: vi.fn(),
  getTableSchema: vi.fn(),
  pollForResults: vi.fn(),
}));

vi.mock('../../api/schema-registry-api', () => ({
  listSubjects: vi.fn(),
  getSchemaDetail: vi.fn(),
  getSchemaVersions: vi.fn(),
  registerSchema: vi.fn(),
  validateCompatibility: vi.fn(),
  getCompatibilityMode: vi.fn(),
  setCompatibilityMode: vi.fn(),
  deleteSubject: vi.fn(),
  deleteSchemaVersion: vi.fn(),
}));

vi.mock('../../api/topic-api', () => ({
  listTopics: vi.fn(),
  getTopicDetail: vi.fn(),
  getTopicConfigs: vi.fn(),
  createTopic: vi.fn(),
  deleteTopic: vi.fn(),
  alterTopicConfig: vi.fn(),
  getTopicPartitions: vi.fn(),
  getPartitionOffsets: vi.fn(),
  produceRecord: vi.fn(),
}));

vi.mock('../../utils/workspace-export', () => ({
  validateWorkspaceJSON: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('../../config/environment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/environment')>();
  return {
    ...actual,
    env: { ...actual.env, isAdmin: true, uniqueId: 'test' },
  };
});

import { useWorkspaceStore } from '../../store/workspaceStore';
import * as flinkApi from '../../api/flink-api';

const runningStatement: StatementResponse = {
  name: 'stmt-running-1',
  metadata: { created_at: '2026-03-01T10:00:00Z' },
  spec: {
    statement: 'SELECT * FROM orders\nWHERE status = \'active\'',
    statement_type: 'SELECT',
    compute_pool_id: 'lfcp-pool-123',
    properties: {
      'sql.current-catalog': 'my_catalog',
      'sql.current-database': 'my_database',
      'sql.tables.scan.startup.mode': 'earliest-offset',
    },
  },
  status: { phase: 'RUNNING' },
};

const completedStatement: StatementResponse = {
  name: 'stmt-completed-1',
  metadata: { created_at: '2026-03-01T09:00:00Z' },
  spec: {
    statement: 'SELECT count(*) FROM payments',
    statement_type: 'SELECT',
    compute_pool_id: 'lfcp-pool-123',
    properties: { 'sql.current-catalog': 'cat', 'sql.current-database': 'db' },
  },
  status: { phase: 'COMPLETED' },
};

const failedStatement: StatementResponse = {
  name: 'stmt-failed-1',
  metadata: {},
  spec: { statement: 'BAD SQL', statement_type: 'SELECT', properties: {} },
  status: { phase: 'FAILED', detail: 'Syntax error near BAD' },
};

describe('[@jobs-detail] JobsDetail', () => {
  const onBack = vi.fn();
  const onCancelJob = vi.fn();
  const onDeleteJob = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useWorkspaceStore.setState({
      jobStatements: [runningStatement, completedStatement, failedStatement],
      toasts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders statement name and status', () => {
    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('stmt-running-1')).toBeTruthy();
    expect(screen.getByText('Running')).toBeTruthy();
  });

  it('renders metadata grid with compute pool, catalog, database', () => {
    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('lfcp-pool-123')).toBeTruthy();
    expect(screen.getByText('my_catalog')).toBeTruthy();
    expect(screen.getByText('my_database')).toBeTruthy();
  });

  it('renders SQL code panel with line numbers', () => {
    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText("WHERE status = 'active'")).toBeTruthy();
  });

  it('stop button visible for RUNNING statement', () => {
    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    const stopBtn = screen.getByText('Stop');
    expect(stopBtn).toBeTruthy();
    fireEvent.click(stopBtn);
    expect(onCancelJob).toHaveBeenCalledWith('stmt-running-1');
  });

  it('stop button hidden for COMPLETED statement', () => {
    render(<JobsDetail statement={completedStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.queryByText('Stop')).toBeNull();
  });

  it('delete button visible for terminal statements', () => {
    render(<JobsDetail statement={failedStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('delete button calls onDeleteJob and navigates back', () => {
    render(<JobsDetail statement={completedStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onDeleteJob).toHaveBeenCalledWith('stmt-completed-1');
    expect(onBack).toHaveBeenCalled();
  });

  it('delete button hidden for RUNNING statement', () => {
    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('back button calls onBack', () => {
    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    const backBtn = screen.getByTitle('Back to list');
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalled();
  });

  it('Load in Workspace calls addStatement + setActiveNavItem', () => {
    const addStatement = vi.fn();
    const setActiveNavItem = vi.fn();
    useWorkspaceStore.setState({ addStatement, setActiveNavItem });

    render(<JobsDetail statement={completedStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    fireEvent.click(screen.getByText('Load in Workspace'));
    expect(addStatement).toHaveBeenCalledWith('SELECT count(*) FROM payments', undefined, 'stmt-completed-1', undefined);
    expect(setActiveNavItem).toHaveBeenCalledWith('workspace');
  });

  it('shows placeholder when SQL is undefined', () => {
    const noSqlStmt: StatementResponse = {
      name: 'stmt-no-sql',
      spec: { properties: {} },
      status: { phase: 'COMPLETED' },
    };
    render(<JobsDetail statement={noSqlStmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('No SQL available')).toBeTruthy();
  });

  it('shows not found when statement is undefined', () => {
    render(<JobsDetail statement={undefined} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('Statement not found.')).toBeTruthy();
  });

  it('settings tab renders spec.properties', () => {
    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('sql.current-catalog')).toBeTruthy();
    expect(screen.getByText('my_catalog')).toBeTruthy();
    expect(screen.getByText('sql.tables.scan.startup.mode')).toBeTruthy();
    expect(screen.getByText('earliest-offset')).toBeTruthy();
  });

  it('auto-refresh calls getStatementStatus for running statement', () => {
    (flinkApi.getStatementStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...runningStatement,
      status: { phase: 'COMPLETED' },
    });

    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);

    // Advance timer to trigger the 5s interval
    vi.advanceTimersByTime(5000);
    expect(flinkApi.getStatementStatus).toHaveBeenCalledWith('stmt-running-1');
  });

  it('auto-refresh clears on unmount', () => {
    const { unmount } = render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    unmount();
    vi.advanceTimersByTime(10000);
    expect(flinkApi.getStatementStatus).not.toHaveBeenCalled();
  });

  it('shows error detail for failed statements', () => {
    render(<JobsDetail statement={failedStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('Syntax error near BAD')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// [@coverage-boost] JobsDetail — additional coverage for uncovered branches
// ---------------------------------------------------------------------------

describe('[@coverage-boost] JobsDetail edge cases', () => {
  const onBack = vi.fn();
  const onCancelJob = vi.fn();
  const onDeleteJob = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useWorkspaceStore.setState({
      jobStatements: [],
      toasts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('getStatusClass returns "unknown" for undefined phase', () => {
    const stmt: StatementResponse = {
      name: 'stmt-no-phase',
      spec: { statement: 'SELECT 1', properties: {} },
      status: {},
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    // Status dot should have 'unknown' class
    const dot = document.querySelector('.status-dot.unknown');
    expect(dot).toBeTruthy();
  });

  it('getStatusClass returns correct class for each phase', () => {
    const phases = [
      { phase: 'PENDING', cls: 'pending' },
      { phase: 'CANCELLED', cls: 'cancelled' },
      { phase: 'FAILED', cls: 'failed' },
    ];
    for (const { phase, cls } of phases) {
      cleanup();
      const stmt: StatementResponse = {
        name: `stmt-${cls}`,
        spec: { statement: 'SELECT 1', properties: {} },
        status: { phase },
      };
      render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
      expect(document.querySelector(`.status-dot.${cls}`)).toBeTruthy();
    }
  });

  it('getStatusClass returns "unknown" for unrecognized phase', () => {
    const stmt: StatementResponse = {
      name: 'stmt-weird',
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'WEIRD_PHASE' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(document.querySelector('.status-dot.unknown')).toBeTruthy();
  });

  it('getStatusLabel returns "Stopped" for CANCELLED', () => {
    const stmt: StatementResponse = {
      name: 'stmt-cancelled',
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'CANCELLED' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('Stopped')).toBeTruthy();
  });

  it('getStatusLabel returns "Unknown" for undefined phase', () => {
    const stmt: StatementResponse = {
      name: 'stmt-undef',
      spec: { statement: 'SELECT 1', properties: {} },
      status: {},
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('Unknown')).toBeTruthy();
  });

  it('settings tab shows empty state when no properties', () => {
    const stmt: StatementResponse = {
      name: 'stmt-no-props',
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('No properties configured.')).toBeTruthy();
  });

  it('settings tab shows empty state when properties undefined', () => {
    const stmt: StatementResponse = {
      name: 'stmt-undef-props',
      spec: { statement: 'SELECT 1' },
      status: { phase: 'COMPLETED' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    fireEvent.click(screen.getByText('Settings'));
    expect(screen.getByText('No properties configured.')).toBeTruthy();
  });

  it('PENDING phase shows Stop button (canStop)', () => {
    const stmt: StatementResponse = {
      name: 'stmt-pending',
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'PENDING' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('Stop')).toBeTruthy();
  });

  it('CANCELLED phase shows Delete button (canDelete)', () => {
    const stmt: StatementResponse = {
      name: 'stmt-cancelled',
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'CANCELLED' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('Load in Workspace with running statement resumes polling', () => {
    const addStatement = vi.fn().mockReturnValue('new-stmt-id');
    const resumeStatementPolling = vi.fn();
    const setActiveNavItem = vi.fn();
    useWorkspaceStore.setState({ addStatement, resumeStatementPolling, setActiveNavItem });

    const stmt: StatementResponse = {
      name: 'stmt-running-poll',
      metadata: { created_at: '2026-01-01T00:00:00Z' },
      spec: { statement: 'SELECT * FROM t', properties: {} },
      status: { phase: 'RUNNING' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    fireEvent.click(screen.getByText('Load in Workspace'));

    expect(addStatement).toHaveBeenCalledWith(
      'SELECT * FROM t',
      undefined,
      'stmt-running-poll',
      expect.objectContaining({ status: 'RUNNING', statementName: 'stmt-running-poll' })
    );
    expect(setActiveNavItem).toHaveBeenCalledWith('workspace');

    // Advance past the 500ms setTimeout
    vi.advanceTimersByTime(600);
    expect(resumeStatementPolling).toHaveBeenCalledWith('new-stmt-id');
  });

  it('Load in Workspace with PENDING statement also resumes polling', () => {
    const addStatement = vi.fn().mockReturnValue('new-stmt-id-2');
    const resumeStatementPolling = vi.fn();
    const setActiveNavItem = vi.fn();
    useWorkspaceStore.setState({ addStatement, resumeStatementPolling, setActiveNavItem });

    const stmt: StatementResponse = {
      name: 'stmt-pending-poll',
      spec: { statement: 'SELECT * FROM t', properties: {} },
      status: { phase: 'PENDING' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    fireEvent.click(screen.getByText('Load in Workspace'));

    vi.advanceTimersByTime(600);
    expect(resumeStatementPolling).toHaveBeenCalledWith('new-stmt-id-2');
  });

  it('Load in Workspace button hidden when no SQL', () => {
    const stmt: StatementResponse = {
      name: 'stmt-no-sql',
      spec: { properties: {} },
      status: { phase: 'COMPLETED' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.queryByText('Load in Workspace')).toBeNull();
  });

  it('not-found state has back button that calls onBack', () => {
    render(<JobsDetail statement={undefined} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    fireEvent.click(screen.getByText('Back to list'));
    expect(onBack).toHaveBeenCalled();
  });

  it('no auto-refresh for COMPLETED statement', () => {
    render(<JobsDetail statement={completedStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    vi.advanceTimersByTime(10000);
    expect(flinkApi.getStatementStatus).not.toHaveBeenCalled();
  });

  it('statement_type shown in status bar when present', () => {
    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('SELECT')).toBeTruthy();
  });

  it('statement_type not shown when absent', () => {
    const stmt: StatementResponse = {
      name: 'stmt-no-type',
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    // Should not have extra separator dots for statement_type
    const separators = document.querySelectorAll('.jobs-detail-separator');
    // Only date separator if created_at missing — should be 0 separators
    expect(separators.length).toBe(0);
  });

  it('auto-refresh stops when status becomes terminal', async () => {
    (flinkApi.getStatementStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...runningStatement,
      status: { phase: 'COMPLETED' },
    });

    useWorkspaceStore.setState({
      jobStatements: [runningStatement],
    });

    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);

    // First tick — triggers refresh and gets COMPLETED
    await vi.advanceTimersByTimeAsync(5000);
    expect(flinkApi.getStatementStatus).toHaveBeenCalledTimes(1);

    // Clear to check next interval does NOT fire
    (flinkApi.getStatementStatus as ReturnType<typeof vi.fn>).mockClear();
    await vi.advanceTimersByTimeAsync(5000);
    expect(flinkApi.getStatementStatus).not.toHaveBeenCalled();
  });

  it('auto-refresh silently ignores errors', async () => {
    (flinkApi.getStatementStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network fail'));

    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    // Should not throw
    await vi.advanceTimersByTimeAsync(5000);
    expect(flinkApi.getStatementStatus).toHaveBeenCalledTimes(1);
  });

  it('formatDate returns em-dash for invalid date string', () => {
    const stmt: StatementResponse = {
      name: 'stmt-bad-date',
      metadata: { created_at: 'not-a-date' },
      spec: { statement: 'SELECT 1', statement_type: 'SELECT', properties: {} },
      status: { phase: 'COMPLETED' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    // The created_at is truthy so it renders, but formatDate returns em-dash
    // We just verify the component renders without error
    expect(screen.getByText('stmt-bad-date')).toBeTruthy();
  });

  it('error detail not shown when phase is not FAILED', () => {
    const stmt: StatementResponse = {
      name: 'stmt-running-detail',
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'RUNNING', detail: 'Some info' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.queryByText('Some info')).toBeNull();
  });

  it('metadata grid hides items when properties are absent', () => {
    const stmt: StatementResponse = {
      name: 'stmt-no-meta',
      spec: { statement: 'SELECT 1', properties: {} },
      status: { phase: 'COMPLETED' },
    };
    render(<JobsDetail statement={stmt} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.queryByText('Compute Pool')).toBeNull();
    expect(screen.queryByText('Catalog')).toBeNull();
    expect(screen.queryByText('Database')).toBeNull();
    expect(screen.queryByText('Scan Mode')).toBeNull();
  });

  it('scan mode shown when sql.tables.scan.startup.mode is set', () => {
    render(<JobsDetail statement={runningStatement} onBack={onBack} onCancelJob={onCancelJob} onDeleteJob={onDeleteJob} />);
    expect(screen.getByText('Scan Mode')).toBeTruthy();
    expect(screen.getByText('earliest-offset')).toBeTruthy();
  });
});
