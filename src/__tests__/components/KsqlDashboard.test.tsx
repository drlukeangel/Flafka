import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { KsqlPersistentQuery } from '../../types';

// ─── Store mock ────────────────────────────────────────────────────────────────

const mockToggleKsqlDashboard = vi.fn();
const mockLoadKsqlDashboardQueries = vi.fn();
const mockTerminateKsqlDashboardQuery = vi.fn();
const mockSetKsqlDashboardHeight = vi.fn();
const mockSetActiveNavItem = vi.fn();
const mockNavigateToKsqlQueryDetail = vi.fn();

const defaultStoreState = {
  ksqlDashboardQueries: [] as KsqlPersistentQuery[],
  ksqlDashboardLoading: false,
  ksqlDashboardError: null as string | null,
  ksqlDashboardLastUpdated: null as Date | null,
  ksqlDashboardHeight: 300,
  loadKsqlDashboardQueries: mockLoadKsqlDashboardQueries,
  terminateKsqlDashboardQuery: mockTerminateKsqlDashboardQuery,
  setKsqlDashboardHeight: mockSetKsqlDashboardHeight,
  setActiveNavItem: mockSetActiveNavItem,
  toggleKsqlDashboard: mockToggleKsqlDashboard,
  navigateToKsqlQueryDetail: mockNavigateToKsqlQueryDetail,
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

import { KsqlDashboard } from '../../components/KsqlDashboard/KsqlDashboard';

const mockQueries: KsqlPersistentQuery[] = [
  {
    id: 'CSAS_STREAM1_0',
    queryString: 'CREATE STREAM output AS SELECT * FROM source EMIT CHANGES;',
    sinks: ['output-topic'],
    queryType: 'PERSISTENT',
    state: 'RUNNING',
  },
  {
    id: 'CTAS_TABLE1_0',
    queryString: 'CREATE TABLE agg AS SELECT id, COUNT(*) FROM s GROUP BY id;',
    sinks: ['agg-topic'],
    queryType: 'PERSISTENT',
    state: 'PAUSED',
  },
];

describe('[@ksql-dashboard] [@component] KsqlDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = { ...defaultStoreState };
  });

  afterEach(() => {
    cleanup();
  });

  it('returns null when not open', () => {
    const { container } = render(<KsqlDashboard isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders panel when isOpen is true', () => {
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByText('ksqlDB Queries')).toBeInTheDocument();
  });

  it('renders table with queries when open', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardQueries: mockQueries };
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByText('CSAS_STREAM1_0')).toBeInTheDocument();
    expect(screen.getByText('CTAS_TABLE1_0')).toBeInTheDocument();
  });

  it('shows empty state when no queries', () => {
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByText('No persistent queries running')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardLoading: true };
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByText('Loading queries...')).toBeInTheDocument();
  });

  it('shows error state with retry button', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardError: 'Connection refused' };
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
    const retryBtn = screen.getByText('Retry');
    fireEvent.click(retryBtn);
    expect(mockLoadKsqlDashboardQueries).toHaveBeenCalled();
  });

  it('terminate button calls terminateKsqlDashboardQuery', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardQueries: mockQueries };
    render(<KsqlDashboard isOpen={true} />);
    const terminateBtns = screen.getAllByTitle(/Terminate/);
    fireEvent.click(terminateBtns[0]);
    expect(mockTerminateKsqlDashboardQuery).toHaveBeenCalledWith('CSAS_STREAM1_0');
  });

  it('View all queries navigates to ksql-queries page', () => {
    render(<KsqlDashboard isOpen={true} />);
    const link = screen.getByText(/View all queries/);
    fireEvent.click(link);
    expect(mockSetActiveNavItem).toHaveBeenCalledWith('ksql-queries');
    expect(mockToggleKsqlDashboard).toHaveBeenCalled();
  });

  it('Escape key closes dashboard', () => {
    render(<KsqlDashboard isOpen={true} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockToggleKsqlDashboard).toHaveBeenCalled();
  });

  it('has role="region" and proper aria attributes', () => {
    render(<KsqlDashboard isOpen={true} />);
    const panel = screen.getByRole('region');
    expect(panel).toHaveAttribute('aria-label', 'ksqlDB persistent queries');
    expect(panel).toHaveAttribute('id', 'ksql-dashboard-panel');
  });

  it('sets height style from ksqlDashboardHeight', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardHeight: 400 };
    render(<KsqlDashboard isOpen={true} />);
    const panel = screen.getByRole('region');
    expect(panel.style.height).toBe('400px');
  });

  it('shows "Updated" text when lastUpdated is set', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardLastUpdated: new Date() };
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('does not show "Updated" text when lastUpdated is null', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardLastUpdated: null };
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });

  it('close button calls toggleKsqlDashboard', () => {
    render(<KsqlDashboard isOpen={true} />);
    fireEvent.click(screen.getByLabelText('Close ksqlDB dashboard'));
    expect(mockToggleKsqlDashboard).toHaveBeenCalled();
  });

  it('refresh button calls loadKsqlDashboardQueries', () => {
    render(<KsqlDashboard isOpen={true} />);
    fireEvent.click(screen.getByLabelText('Refresh ksqlDB queries'));
    expect(mockLoadKsqlDashboardQueries).toHaveBeenCalled();
  });

  it('disables refresh button when loading', () => {
    currentStoreState = {
      ...defaultStoreState,
      ksqlDashboardLoading: true,
      ksqlDashboardQueries: mockQueries,
    };
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByLabelText('Refresh ksqlDB queries')).toBeDisabled();
  });

  it('clicking query name navigates to query detail', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardQueries: mockQueries };
    render(<KsqlDashboard isOpen={true} />);
    fireEvent.click(screen.getByText('CSAS_STREAM1_0'));
    expect(mockNavigateToKsqlQueryDetail).toHaveBeenCalledWith('CSAS_STREAM1_0');
    expect(mockToggleKsqlDashboard).toHaveBeenCalled();
  });

  it('renders table headers', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardQueries: mockQueries };
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByText('Query ID')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('SQL')).toBeInTheDocument();
    expect(screen.getByText('Sink')).toBeInTheDocument();
  });

  it('has drag resize handle', () => {
    render(<KsqlDashboard isOpen={true} />);
    expect(document.querySelector('.ksql-dashboard-resize-handle')).toBeTruthy();
  });

  it('handles drag resize interaction', () => {
    render(<KsqlDashboard isOpen={true} />);
    const handle = document.querySelector('.ksql-dashboard-resize-handle')!;
    fireEvent.mouseDown(handle, { clientY: 100 });
    fireEvent.mouseMove(document, { clientY: 150 });
    expect(mockSetKsqlDashboardHeight).toHaveBeenCalled();
    fireEvent.mouseUp(document);
  });

  it('terminate buttons have proper aria-labels', () => {
    currentStoreState = { ...defaultStoreState, ksqlDashboardQueries: mockQueries };
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByLabelText('Terminate query CSAS_STREAM1_0')).toBeInTheDocument();
    expect(screen.getByLabelText('Terminate query CTAS_TABLE1_0')).toBeInTheDocument();
  });

  it('shows table with data when loading with existing data (refresh)', () => {
    currentStoreState = {
      ...defaultStoreState,
      ksqlDashboardLoading: true,
      ksqlDashboardQueries: mockQueries,
    };
    render(<KsqlDashboard isOpen={true} />);
    expect(screen.getByText('CSAS_STREAM1_0')).toBeInTheDocument();
  });
});
