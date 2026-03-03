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
    expect(addStatement).toHaveBeenCalledWith('SELECT count(*) FROM payments', undefined, 'stmt-completed-1-copy');
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
