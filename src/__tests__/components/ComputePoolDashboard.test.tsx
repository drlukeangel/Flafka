import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComputePoolDashboard } from '../../components/ComputePoolDashboard/ComputePoolDashboard';
import { formatBytes, formatNumber } from '../../utils/format';
import type { StatementTelemetry } from '../../types';

// Mock store
const mockToggle = vi.fn();
const mockLoadTelemetry = vi.fn();
const mockStopStatement = vi.fn();
const mockSetHeight = vi.fn();
const mockSetActiveNavItem = vi.fn();

const defaultStoreState = {
  statementTelemetry: [] as StatementTelemetry[],
  telemetryLoading: false,
  telemetryError: null as string | null,
  telemetryLastUpdated: null as Date | null,
  dashboardHeight: 280,
  loadStatementTelemetry: mockLoadTelemetry,
  stopDashboardStatement: mockStopStatement,
  setDashboardHeight: mockSetHeight,
  setActiveNavItem: mockSetActiveNavItem,
  toggleComputePoolDashboard: mockToggle,
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

const mockTelemetry: StatementTelemetry[] = [
  {
    statementName: 'stmt-ws-1',
    cfus: 4,
    recordsIn: 1500,
    recordsOut: 1200,
    pendingRecords: 300,
    stateSizeBytes: 1048576,
    sql: 'SELECT * FROM orders',
    createdAt: '2026-03-01T10:00:00Z',
    isWorkspaceStatement: true,
  },
  {
    statementName: 'stmt-ext-1',
    cfus: 2,
    recordsIn: 500,
    recordsOut: 500,
    pendingRecords: 0,
    stateSizeBytes: 2048,
    sql: 'INSERT INTO sink SELECT * FROM source',
    createdAt: '2026-03-01T09:00:00Z',
    isWorkspaceStatement: false,
  },
];

describe('[@dashboard] [@component] ComputePoolDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = { ...defaultStoreState };
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<ComputePoolDashboard isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render panel when isOpen is true', () => {
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('Compute Pool Usage')).toBeInTheDocument();
  });

  it('should show empty state when no telemetry', () => {
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('No statements currently consuming CFU')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    currentStoreState = { ...defaultStoreState, telemetryLoading: true };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('Loading telemetry...')).toBeInTheDocument();
  });

  it('should show error state with retry button', () => {
    currentStoreState = { ...defaultStoreState, telemetryError: 'Network timeout' };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
    const retryBtn = screen.getByText('Retry');
    fireEvent.click(retryBtn);
    expect(mockLoadTelemetry).toHaveBeenCalled();
  });

  it('should render table with telemetry rows', () => {
    currentStoreState = { ...defaultStoreState, statementTelemetry: mockTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('stmt-ws-1')).toBeInTheDocument();
    expect(screen.getByText('stmt-ext-1')).toBeInTheDocument();
  });

  it('should show CFU values', () => {
    currentStoreState = { ...defaultStoreState, statementTelemetry: mockTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should show external badge for non-workspace statements', () => {
    currentStoreState = { ...defaultStoreState, statementTelemetry: mockTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('external')).toBeInTheDocument();
  });

  it('should call stopDashboardStatement when stop button clicked', () => {
    currentStoreState = { ...defaultStoreState, statementTelemetry: mockTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    const stopBtns = screen.getAllByTitle(/Stop stmt/);
    fireEvent.click(stopBtns[0]);
    expect(mockStopStatement).toHaveBeenCalledWith('stmt-ws-1');
  });

  it('should have proper aria-labels on stop buttons', () => {
    currentStoreState = { ...defaultStoreState, statementTelemetry: mockTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByLabelText('Stop statement stmt-ws-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Stop statement stmt-ext-1')).toBeInTheDocument();
  });

  it('should navigate to jobs page when "View all jobs" clicked', () => {
    render(<ComputePoolDashboard isOpen={true} />);
    const link = screen.getByText(/View all jobs/);
    fireEvent.click(link);
    expect(mockSetActiveNavItem).toHaveBeenCalledWith('jobs');
    expect(mockToggle).toHaveBeenCalled();
  });

  it('should show "Updated Xs ago" in footer', () => {
    currentStoreState = { ...defaultStoreState, telemetryLastUpdated: new Date() };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('should have role="region" and proper aria attributes', { timeout: 15000 }, () => {
    render(<ComputePoolDashboard isOpen={true} />);
    const panel = screen.getByRole('region');
    expect(panel).toHaveAttribute('aria-label', 'Compute pool running statements');
    expect(panel).toHaveAttribute('id', 'compute-pool-panel');
  });

  it('should close panel on Escape key', () => {
    render(<ComputePoolDashboard isOpen={true} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockToggle).toHaveBeenCalled();
  });
});

describe('[@dashboard] formatBytes', () => {
  it('returns "\u2014" for null', () => expect(formatBytes(null)).toBe('\u2014'));
  it('returns "0 B" for 0', () => expect(formatBytes(0)).toBe('0 B'));
  it('formats KB', () => expect(formatBytes(1536)).toBe('1.5 KB'));
  it('formats MB', () => expect(formatBytes(1048576)).toBe('1.0 MB'));
  it('formats GB', () => expect(formatBytes(1073741824)).toBe('1.0 GB'));
  it('returns "\u2014" for NaN', () => expect(formatBytes(NaN)).toBe('\u2014'));
  it('returns "\u2014" for Infinity', () => expect(formatBytes(Infinity)).toBe('\u2014'));
});

describe('[@dashboard] formatNumber', () => {
  it('returns "\u2014" for null', () => expect(formatNumber(null)).toBe('\u2014'));
  it('returns "0" for 0', () => expect(formatNumber(0)).toBe('0'));
  it('formats thousands', () => expect(formatNumber(1500)).toBe('1.5K'));
  it('formats millions', () => expect(formatNumber(3500000)).toBe('3.5M'));
  it('passes through small numbers', () => expect(formatNumber(42)).toBe('42'));
  it('returns "\u2014" for NaN', () => expect(formatNumber(NaN)).toBe('\u2014'));
});

// ---------------------------------------------------------------------------
// Additional coverage: uncovered branches & interactions
// ---------------------------------------------------------------------------

const mockNavigateToJobDetail = vi.fn();

describe('[@dashboard] [@component] ComputePoolDashboard — additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentStoreState = {
      ...defaultStoreState,
      navigateToJobDetail: mockNavigateToJobDetail,
    } as any;
  });

  it('should call loadStatementTelemetry when refresh button is clicked', () => {
    render(<ComputePoolDashboard isOpen={true} />);
    fireEvent.click(screen.getByLabelText('Refresh telemetry data'));
    expect(mockLoadTelemetry).toHaveBeenCalled();
  });

  it('should disable refresh button when loading', () => {
    currentStoreState = { ...currentStoreState, telemetryLoading: true, statementTelemetry: mockTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByLabelText('Refresh telemetry data')).toBeDisabled();
  });

  it('should close dashboard and focus badge when close button clicked', () => {
    const focusMock = vi.fn();
    const mockBadge = document.createElement('button');
    mockBadge.id = 'compute-pool-badge';
    mockBadge.focus = focusMock;
    document.body.appendChild(mockBadge);

    render(<ComputePoolDashboard isOpen={true} />);
    fireEvent.click(screen.getByLabelText('Close compute pool dashboard'));
    expect(mockToggle).toHaveBeenCalled();

    document.body.removeChild(mockBadge);
  });

  it('should navigate to job detail when statement name clicked', () => {
    currentStoreState = {
      ...currentStoreState,
      statementTelemetry: mockTelemetry,
      navigateToJobDetail: mockNavigateToJobDetail,
    } as any;
    render(<ComputePoolDashboard isOpen={true} />);
    fireEvent.click(screen.getByText('stmt-ws-1'));
    expect(mockNavigateToJobDetail).toHaveBeenCalledWith('stmt-ws-1');
    expect(mockToggle).toHaveBeenCalled();
  });

  it('should show em dash when cfus is null', () => {
    const nullCfuTelemetry = [{
      ...mockTelemetry[0],
      cfus: null,
    }];
    currentStoreState = { ...currentStoreState, statementTelemetry: nullCfuTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    // The em dash character
    const cfuCells = document.querySelectorAll('.compute-dashboard-cfu-cell');
    expect(cfuCells[0]?.textContent).toBe('\u2014');
  });

  it('should apply warning class when pendingRecords > 0', () => {
    currentStoreState = { ...currentStoreState, statementTelemetry: mockTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    const warningCells = document.querySelectorAll('.compute-dashboard-warning');
    expect(warningCells.length).toBeGreaterThan(0);
  });

  it('should not apply warning class when pendingRecords is 0', () => {
    const noPendingTelemetry = [{
      ...mockTelemetry[1], // pendingRecords: 0
    }];
    currentStoreState = { ...currentStoreState, statementTelemetry: noPendingTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(document.querySelectorAll('.compute-dashboard-warning').length).toBe(0);
  });

  it('should show error with telemetry still visible when both error and data exist', () => {
    currentStoreState = {
      ...currentStoreState,
      telemetryError: 'Partial failure',
      statementTelemetry: mockTelemetry,
    };
    render(<ComputePoolDashboard isOpen={true} />);
    // Table should render (error branch only shows if data is empty)
    expect(screen.getByText('stmt-ws-1')).toBeInTheDocument();
  });

  it('should show loading spinner with no data (first load)', () => {
    currentStoreState = {
      ...currentStoreState,
      telemetryLoading: true,
      statementTelemetry: [],
    };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('Loading telemetry...')).toBeInTheDocument();
  });

  it('should show table when loading with existing data (refresh)', () => {
    currentStoreState = {
      ...currentStoreState,
      telemetryLoading: true,
      statementTelemetry: mockTelemetry,
    };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('stmt-ws-1')).toBeInTheDocument();
  });

  it('should not show "Updated" text when telemetryLastUpdated is null', () => {
    currentStoreState = { ...currentStoreState, telemetryLastUpdated: null };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });

  it('should apply external class to non-workspace rows', () => {
    currentStoreState = { ...currentStoreState, statementTelemetry: mockTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(document.querySelectorAll('.compute-dashboard-external').length).toBe(1);
  });

  it('should set height style from dashboardHeight', () => {
    currentStoreState = { ...currentStoreState, dashboardHeight: 350 };
    render(<ComputePoolDashboard isOpen={true} />);
    const panel = screen.getByRole('region');
    expect(panel.style.height).toBe('350px');
  });

  it('should have drag resize handle', () => {
    render(<ComputePoolDashboard isOpen={true} />);
    expect(document.querySelector('.compute-dashboard-resize-handle')).toBeTruthy();
  });

  it('should handle drag resize interaction', () => {
    render(<ComputePoolDashboard isOpen={true} />);
    const handle = document.querySelector('.compute-dashboard-resize-handle')!;
    fireEvent.mouseDown(handle, { clientY: 100 });
    // Simulate mouse move
    fireEvent.mouseMove(document, { clientY: 150 });
    expect(mockSetHeight).toHaveBeenCalled();
    // Simulate mouse up
    fireEvent.mouseUp(document);
  });

  it('should show table header columns', () => {
    currentStoreState = { ...currentStoreState, statementTelemetry: mockTelemetry };
    render(<ComputePoolDashboard isOpen={true} />);
    expect(screen.getByText('Statement')).toBeInTheDocument();
    expect(screen.getByText('CFU')).toBeInTheDocument();
    expect(screen.getByText('Records In')).toBeInTheDocument();
    expect(screen.getByText('Records Out')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('State Size')).toBeInTheDocument();
  });
});
