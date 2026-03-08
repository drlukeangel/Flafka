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

vi.mock('../../api/ksql-api', () => ({
  listQueries: vi.fn(),
  terminateQuery: vi.fn(),
  explainQuery: vi.fn().mockResolvedValue([]),
  executeKsql: vi.fn(),
  handleKsqlError: vi.fn(),
  parseKsqlSchema: vi.fn(),
  executeKsqlQuery: vi.fn(),
}));

import { useWorkspaceStore } from '../../store/workspaceStore';
import * as ksqlApi from '../../api/ksql-api';
import { KsqlQueriesPage } from '../../components/KsqlQueriesPage/KsqlQueriesPage';
import type { KsqlPersistentQuery } from '../../types';

const mockQueriesData: KsqlPersistentQuery[] = [
  {
    id: 'CSAS_STREAM1_0',
    queryString: 'CREATE STREAM AS SELECT * FROM source EMIT CHANGES;',
    sinks: ['output-topic'],
    queryType: 'PERSISTENT',
    state: 'RUNNING',
  },
  {
    id: 'CTAS_TABLE1_0',
    queryString: 'CREATE TABLE AS SELECT id, COUNT(*) FROM s GROUP BY id;',
    sinks: ['table-topic'],
    queryType: 'PERSISTENT',
    state: 'PAUSED',
  },
];

// API response shape matching what listQueries returns
const mockApiResponse = [
  {
    queries: mockQueriesData.map((q) => ({
      id: q.id,
      queryString: q.queryString,
      sinks: q.sinks,
      queryType: q.queryType,
      state: q.state,
    })),
  },
];

describe('[@ksql-queries] KsqlQueriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      ksqlQueries: [],
      ksqlQueriesLoading: false,
      ksqlQueriesError: null,
      selectedKsqlQueryId: null,
      toasts: [],
    });
    // Default: listQueries returns the mock queries so the component loads data on mount
    vi.mocked(ksqlApi.listQueries).mockResolvedValue(mockApiResponse as ksqlApi.KsqlStatementResponse[]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders list by default when no query is selected', async () => {
    render(<KsqlQueriesPage />);
    await waitFor(() => {
      expect(screen.getByText('CSAS_STREAM1_0')).toBeTruthy();
      expect(screen.getByText('CTAS_TABLE1_0')).toBeTruthy();
    });
  });

  it('renders detail when selectedKsqlQueryId is set and queries loaded', async () => {
    useWorkspaceStore.setState({
      selectedKsqlQueryId: 'CSAS_STREAM1_0',
    });
    render(<KsqlQueriesPage />);
    // Wait for queries to load, then detail should show via the selectedKsqlQueryId effect
    await waitFor(() => {
      expect(screen.getByTitle('Back to list')).toBeTruthy();
    });
  });

  it('navigates to detail view on row click', async () => {
    render(<KsqlQueriesPage />);
    await waitFor(() => {
      expect(screen.getByText('CSAS_STREAM1_0')).toBeTruthy();
    });
    const row = screen.getByText('CSAS_STREAM1_0').closest('tr');
    if (row) fireEvent.click(row);
    // Should now show detail view with back button
    await waitFor(() => {
      expect(screen.getByTitle('Back to list')).toBeTruthy();
    });
  });

  it('navigates back to list from detail', async () => {
    render(<KsqlQueriesPage />);
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('CSAS_STREAM1_0')).toBeTruthy();
    });
    // Click into detail
    const row = screen.getByText('CSAS_STREAM1_0').closest('tr');
    if (row) fireEvent.click(row);
    // Click back
    await waitFor(() => {
      const backBtn = screen.getByTitle('Back to list');
      fireEvent.click(backBtn);
    });
    // Should be back on list
    await waitFor(() => {
      expect(screen.getByText('CTAS_TABLE1_0')).toBeTruthy();
    });
  });

  it('shows loading state on mount', () => {
    // Make listQueries never resolve so we stay in loading state
    vi.mocked(ksqlApi.listQueries).mockReturnValue(new Promise(() => {}));
    render(<KsqlQueriesPage />);
    expect(screen.getByText('Loading ksqlDB queries...')).toBeTruthy();
  });

  it('shows error state when API fails', async () => {
    vi.mocked(ksqlApi.listQueries).mockRejectedValue(new Error('Network error'));
    render(<KsqlQueriesPage />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('calls loadKsqlQueries on mount', async () => {
    render(<KsqlQueriesPage />);
    await waitFor(() => {
      expect(ksqlApi.listQueries).toHaveBeenCalled();
    });
  });
});
