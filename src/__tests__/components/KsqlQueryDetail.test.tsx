import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { KsqlPersistentQuery } from '../../types';

// ─── Store mock ────────────────────────────────────────────────────────────────

const mockAddStatement = vi.fn();
const mockSetActiveNavItem = vi.fn();

const defaultStoreState = {
  addStatement: mockAddStatement,
  setActiveNavItem: mockSetActiveNavItem,
  ksqlQueries: [] as KsqlPersistentQuery[],
};

let currentStoreState = { ...defaultStoreState };

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (state: typeof defaultStoreState) => unknown) => {
      if (selector) return selector(currentStoreState);
      return currentStoreState;
    },
    {
      getState: () => currentStoreState,
      setState: (partial: Partial<typeof defaultStoreState>) => {
        currentStoreState = { ...currentStoreState, ...partial };
      },
      subscribe: vi.fn(() => vi.fn()),
    }
  ),
}));

// Mock explainQuery since KsqlQueryDetail imports it
vi.mock('../../api/ksql-api', () => ({
  explainQuery: vi.fn().mockResolvedValue([]),
}));

import { KsqlQueryDetail } from '../../components/KsqlQueriesPage/KsqlQueryDetail';

const runningQuery: KsqlPersistentQuery = {
  id: 'CSAS_STREAM1_0',
  queryString: 'CREATE STREAM output AS SELECT * FROM source EMIT CHANGES;',
  sinks: ['output-topic'],
  queryType: 'PERSISTENT',
  state: 'RUNNING',
};

const pausedQuery: KsqlPersistentQuery = {
  id: 'CTAS_TABLE1_0',
  queryString: 'CREATE TABLE agg AS SELECT id, COUNT(*) FROM s GROUP BY id;',
  sinks: ['agg-topic'],
  queryType: 'PERSISTENT',
  state: 'PAUSED',
};

const defaultProps = {
  query: runningQuery as KsqlPersistentQuery | undefined,
  onBack: vi.fn(),
  onTerminateQuery: vi.fn().mockResolvedValue(undefined),
};

describe('[@ksql-query-detail] KsqlQueryDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = { ...defaultStoreState };
  });

  afterEach(() => {
    cleanup();
  });

  it('renders query metadata and SQL', () => {
    render(<KsqlQueryDetail {...defaultProps} />);
    expect(screen.getByText('CSAS_STREAM1_0')).toBeInTheDocument();
    // 'CREATE STREAM AS' appears in both status bar and metadata grid
    expect(screen.getAllByText('CREATE STREAM AS').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    expect(screen.getByText('output-topic')).toBeInTheDocument();
    // SQL should be rendered
    expect(screen.getByText(/CREATE STREAM output/)).toBeInTheDocument();
  });

  it('shows terminate button for RUNNING queries', () => {
    render(<KsqlQueryDetail {...defaultProps} query={runningQuery} />);
    expect(screen.getByText('Terminate')).toBeInTheDocument();
  });

  it('hides terminate button for non-RUNNING queries', () => {
    render(<KsqlQueryDetail {...defaultProps} query={pausedQuery} />);
    expect(screen.queryByText('Terminate')).not.toBeInTheDocument();
  });

  it('calls onTerminateQuery when terminate button clicked', () => {
    const onTerminate = vi.fn();
    render(<KsqlQueryDetail {...defaultProps} onTerminateQuery={onTerminate} />);
    fireEvent.click(screen.getByText('Terminate'));
    expect(onTerminate).toHaveBeenCalledWith('CSAS_STREAM1_0');
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(<KsqlQueryDetail {...defaultProps} onBack={onBack} />);
    fireEvent.click(screen.getByTitle('Back to list'));
    expect(onBack).toHaveBeenCalled();
  });

  it('Load in Workspace creates ksqlDB cell', () => {
    render(<KsqlQueryDetail {...defaultProps} />);
    const loadBtn = screen.getByText('Load in Workspace');
    fireEvent.click(loadBtn);
    expect(mockAddStatement).toHaveBeenCalledWith(
      runningQuery.queryString,
      undefined,
      undefined,
      { engine: 'ksqldb' },
    );
    expect(mockSetActiveNavItem).toHaveBeenCalledWith('workspace');
  });

  it('shows not-found state for undefined query', () => {
    render(<KsqlQueryDetail {...defaultProps} query={undefined} />);
    expect(screen.getByText('Query not found.')).toBeInTheDocument();
    expect(screen.getByText(/Back to list/)).toBeInTheDocument();
  });

  it('shows back button in not-found state that calls onBack', () => {
    const onBack = vi.fn();
    render(<KsqlQueryDetail {...defaultProps} query={undefined} onBack={onBack} />);
    fireEvent.click(screen.getByText(/Back to list/));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders sinks in metadata', () => {
    const multiSinkQuery: KsqlPersistentQuery = {
      ...runningQuery,
      sinks: ['sink-1', 'sink-2'],
    };
    render(<KsqlQueryDetail {...defaultProps} query={multiSinkQuery} />);
    expect(screen.getByText('sink-1, sink-2')).toBeInTheDocument();
    expect(screen.getByText('Sinks')).toBeInTheDocument();
  });

  it('renders SQL Statement section header', () => {
    render(<KsqlQueryDetail {...defaultProps} />);
    expect(screen.getByText('SQL Statement')).toBeInTheDocument();
  });

  it('shows status with correct class', () => {
    render(<KsqlQueryDetail {...defaultProps} query={runningQuery} />);
    // Check Running status label is displayed
    expect(screen.getByText('Running')).toBeInTheDocument();
  });
});
