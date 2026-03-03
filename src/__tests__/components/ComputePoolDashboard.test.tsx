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

  it('should have role="region" and proper aria attributes', () => {
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
