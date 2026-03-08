import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { KsqlQueriesList } from '../../components/KsqlQueriesPage/KsqlQueriesList';
import type { KsqlPersistentQuery } from '../../types';

const mockQueries: KsqlPersistentQuery[] = [
  {
    id: 'CSAS_STREAM1_0',
    queryString: 'CREATE STREAM AS SELECT col1, col2 FROM source EMIT CHANGES;',
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

const defaultProps = {
  queries: mockQueries,
  loading: false,
  error: null as string | null,
  onSelectQuery: vi.fn(),
  onTerminateQuery: vi.fn().mockResolvedValue(undefined),
  onRefresh: vi.fn(),
};

describe('[@ksql-queries-list] KsqlQueriesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders query table with correct data', () => {
    render(<KsqlQueriesList {...defaultProps} />);
    expect(screen.getByText('CSAS_STREAM1_0')).toBeInTheDocument();
    expect(screen.getByText('CTAS_TABLE1_0')).toBeInTheDocument();
    expect(screen.getByText('output-topic')).toBeInTheDocument();
    expect(screen.getByText('table-topic')).toBeInTheDocument();
  });

  it('renders status labels', () => {
    render(<KsqlQueriesList {...defaultProps} />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('renders query type from ID prefix', () => {
    render(<KsqlQueriesList {...defaultProps} />);
    expect(screen.getByText('CREATE STREAM AS')).toBeInTheDocument();
    expect(screen.getByText('CREATE TABLE AS')).toBeInTheDocument();
  });

  it('search filters by ID', async () => {
    render(<KsqlQueriesList {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search by query ID or SQL...');
    fireEvent.change(searchInput, { target: { value: 'CSAS' } });
    // Wait for debounce
    await waitFor(() => {
      expect(screen.getByText('CSAS_STREAM1_0')).toBeInTheDocument();
      expect(screen.queryByText('CTAS_TABLE1_0')).not.toBeInTheDocument();
    });
  });

  it('search filters by SQL content', async () => {
    render(<KsqlQueriesList {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search by query ID or SQL...');
    fireEvent.change(searchInput, { target: { value: 'COUNT' } });
    // Wait for debounce
    await waitFor(() => {
      expect(screen.queryByText('CSAS_STREAM1_0')).not.toBeInTheDocument();
      expect(screen.getByText('CTAS_TABLE1_0')).toBeInTheDocument();
    });
  });

  it('shows empty state when no queries', () => {
    render(<KsqlQueriesList {...defaultProps} queries={[]} />);
    expect(screen.getByText('No persistent queries found.')).toBeInTheDocument();
  });

  it('shows no matching queries when search has no results', async () => {
    render(<KsqlQueriesList {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search by query ID or SQL...');
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });
    await waitFor(() => {
      expect(screen.getByText('No matching queries.')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    render(<KsqlQueriesList {...defaultProps} loading={true} queries={[]} />);
    expect(screen.getByText('Loading ksqlDB queries...')).toBeInTheDocument();
  });

  it('shows error state with retry', () => {
    const onRefresh = vi.fn();
    render(<KsqlQueriesList {...defaultProps} error="Connection refused" queries={[]} onRefresh={onRefresh} />);
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
    const retryBtn = screen.getByText('Retry');
    fireEvent.click(retryBtn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('calls onTerminateQuery when terminate clicked', () => {
    const onTerminate = vi.fn().mockResolvedValue(undefined);
    render(<KsqlQueriesList {...defaultProps} onTerminateQuery={onTerminate} />);
    // Only RUNNING queries have terminate button
    const terminateBtns = screen.getAllByTitle('Terminate');
    fireEvent.click(terminateBtns[0]);
    expect(onTerminate).toHaveBeenCalledWith('CSAS_STREAM1_0');
  });

  it('does not show terminate button for non-RUNNING queries', () => {
    const pausedOnly: KsqlPersistentQuery[] = [
      { ...mockQueries[1], state: 'PAUSED' },
    ];
    render(<KsqlQueriesList {...defaultProps} queries={pausedOnly} />);
    expect(screen.queryByTitle('Terminate')).not.toBeInTheDocument();
  });

  it('calls onSelectQuery when row clicked', () => {
    const onSelect = vi.fn();
    render(<KsqlQueriesList {...defaultProps} onSelectQuery={onSelect} />);
    const row = screen.getByText('CSAS_STREAM1_0').closest('tr');
    if (row) fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith('CSAS_STREAM1_0');
  });

  it('shows query count', () => {
    render(<KsqlQueriesList {...defaultProps} />);
    expect(screen.getByText(/2 queries shown/)).toBeInTheDocument();
  });

  it('singular "query" for single result', () => {
    render(<KsqlQueriesList {...defaultProps} queries={[mockQueries[0]]} />);
    expect(screen.getByText(/1 query shown/)).toBeInTheDocument();
  });

  it('bulk select and terminate works', async () => {
    vi.useFakeTimers();
    const onTerminate = vi.fn().mockResolvedValue(undefined);
    render(<KsqlQueriesList {...defaultProps} onTerminateQuery={onTerminate} />);

    // Select all via header checkbox
    const selectAllCheckbox = screen.getByRole('checkbox', { name: 'Select all' });
    fireEvent.click(selectAllCheckbox);

    // Bulk terminate button appears
    const bulkBtn = screen.getByText(/Terminate Selected/);
    fireEvent.click(bulkBtn);

    // Flush the first terminate (immediate)
    await vi.advanceTimersByTimeAsync(0);
    // Flush the backoff delay between terminations
    await vi.advanceTimersByTimeAsync(2000);

    expect(onTerminate).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('individual checkbox selection works', () => {
    render(<KsqlQueriesList {...defaultProps} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Select CSAS_STREAM1_0' });
    fireEvent.click(checkbox);

    // Bulk terminate button should appear with count 1
    expect(screen.getByText(/Terminate Selected \(1\)/)).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = vi.fn();
    render(<KsqlQueriesList {...defaultProps} onRefresh={onRefresh} />);
    const refreshBtn = screen.getByTitle('Refresh');
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('truncates long SQL in table', () => {
    const longSqlQuery: KsqlPersistentQuery[] = [{
      id: 'CSAS_LONG_0',
      queryString: 'CREATE STREAM AS SELECT a_very_long_column_name, another_long_column_name, yet_another_long_column_name FROM some_very_long_source_stream_name EMIT CHANGES;',
      sinks: ['out'],
      queryType: 'PERSISTENT',
      state: 'RUNNING',
    }];
    render(<KsqlQueriesList {...defaultProps} queries={longSqlQuery} />);
    // SQL should be truncated (> 60 chars)
    const sqlCell = screen.getByTitle(longSqlQuery[0].queryString);
    expect(sqlCell.textContent).toContain('\u2026');
  });
});
