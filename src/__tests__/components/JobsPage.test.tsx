import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// Mock all APIs before store import
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
import { JobsPage } from '../../components/JobsPage/JobsPage';
import type { StatementResponse } from '../../api/flink-api';

const mockStatements: StatementResponse[] = [
  {
    name: 'stmt-running-1',
    metadata: { created_at: '2026-03-01T10:00:00Z' },
    spec: { statement: 'SELECT * FROM orders', statement_type: 'SELECT', compute_pool_id: 'pool-1', properties: {} },
    status: { phase: 'RUNNING' },
  },
  {
    name: 'stmt-completed-1',
    metadata: { created_at: '2026-03-01T09:00:00Z' },
    spec: { statement: 'SELECT 1', statement_type: 'SELECT', compute_pool_id: 'pool-1', properties: {} },
    status: { phase: 'COMPLETED' },
  },
];

describe('[@jobs-page] JobsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (flinkApi.listStatements as ReturnType<typeof vi.fn>).mockResolvedValue(mockStatements);
    useWorkspaceStore.setState({
      jobStatements: [],
      jobsLoading: false,
      jobsError: null,
      toasts: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('calls loadJobs on mount', async () => {
    render(<JobsPage />);
    await waitFor(() => {
      expect(flinkApi.listStatements).toHaveBeenCalledWith(200, expect.any(Function));
    });
  });

  it('shows list view initially (no selection)', async () => {
    useWorkspaceStore.setState({ jobStatements: mockStatements });
    render(<JobsPage />);
    expect(screen.getByText('stmt-running-1')).toBeTruthy();
    expect(screen.getByText('stmt-completed-1')).toBeTruthy();
  });

  it('navigates to detail view on row click', async () => {
    useWorkspaceStore.setState({ jobStatements: mockStatements });
    render(<JobsPage />);
    const row = screen.getByText('stmt-completed-1').closest('tr');
    if (row) fireEvent.click(row);
    // Should now show the detail view
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  it('navigates back to list from detail', async () => {
    useWorkspaceStore.setState({ jobStatements: mockStatements });
    render(<JobsPage />);
    // Click into detail
    const row = screen.getByText('stmt-completed-1').closest('tr');
    if (row) fireEvent.click(row);
    // Click back
    await waitFor(() => {
      const backBtn = screen.getByTitle('Back to list');
      fireEvent.click(backBtn);
    });
    // Should be back on list
    expect(screen.getByText('stmt-running-1')).toBeTruthy();
  });
});
