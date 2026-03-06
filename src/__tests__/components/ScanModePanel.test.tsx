/**
 * @scan-mode-panel
 * ScanModePanel — dropdown selector for table scan startup mode
 *
 * Covers:
 *   - Renders trigger button with current mode short label
 *   - Opens menu on click, shows all 5 scan modes
 *   - Selects a mode and calls setStatementScanMode
 *   - Shows extra input for timestamp/group/offsets modes
 *   - Closes menu on outside click
 *   - Default mode is 'earliest-offset'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

// Mock createPortal to render inline (avoids jsdom portal cleanup issues)
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom');
  return {
    ...actual,
    createPortal: (children: ReactNode) => children,
  };
});

// Store mock
const mockSetStatementScanMode = vi.fn();

let mockStatement: any = {
  id: 'stmt-1',
  scanMode: undefined,
  scanTimestampMillis: '',
  scanSpecificOffsets: '',
  scanGroupId: '',
};

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: any) => {
    const state = {
      statements: [mockStatement],
      setStatementScanMode: mockSetStatementScanMode,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../components/ScanModePanel/ScanModePanel.css', () => ({}));

import { ScanModePanel } from '../../components/ScanModePanel/ScanModePanel';

describe('[@scan-mode-panel] ScanModePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatement = {
      id: 'stmt-1',
      scanMode: undefined,
      scanTimestampMillis: '',
      scanSpecificOffsets: '',
      scanGroupId: '',
    };
  });

  it('renders trigger button with default mode label "Earliest"', () => {
    render(<ScanModePanel statementId="stmt-1" />);
    expect(screen.getByText('Earliest')).toBeTruthy();
  });

  it('renders trigger button with "Latest" when mode is latest-offset', () => {
    mockStatement = { ...mockStatement, scanMode: 'latest-offset' };
    render(<ScanModePanel statementId="stmt-1" />);
    expect(screen.getByText('Latest')).toBeTruthy();
  });

  it('renders trigger with "Timestamp" for timestamp mode', () => {
    mockStatement = { ...mockStatement, scanMode: 'timestamp' };
    render(<ScanModePanel statementId="stmt-1" />);
    expect(screen.getByText('Timestamp')).toBeTruthy();
  });

  it('renders trigger with "Group" for group-offsets mode', () => {
    mockStatement = { ...mockStatement, scanMode: 'group-offsets' };
    render(<ScanModePanel statementId="stmt-1" />);
    expect(screen.getByText('Group')).toBeTruthy();
  });

  it('renders trigger with "Offsets" for specific-offsets mode', () => {
    mockStatement = { ...mockStatement, scanMode: 'specific-offsets' };
    render(<ScanModePanel statementId="stmt-1" />);
    expect(screen.getByText('Offsets')).toBeTruthy();
  });

  it('opens dropdown menu on trigger click', { timeout: 15000 }, async () => {
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    expect(document.querySelector('.scan-mode-menu')).toBeTruthy();
    expect(screen.getByText('Read from Beginning')).toBeTruthy();
    expect(screen.getByText('Read from End (Latest)')).toBeTruthy();
    expect(screen.getByText('Resume from Group Offsets')).toBeTruthy();
    expect(screen.getByText('Read from Timestamp')).toBeTruthy();
    expect(screen.getByText('Read from Specific Offsets')).toBeTruthy();
  });

  it('closes dropdown on second trigger click (toggle)', { timeout: 15000 }, async () => {
    render(<ScanModePanel statementId="stmt-1" />);
    const trigger = screen.getByTitle('Table scan startup mode');
    await userEvent.click(trigger);
    expect(document.querySelector('.scan-mode-menu')).toBeTruthy();
    await userEvent.click(trigger);
    expect(document.querySelector('.scan-mode-menu')).toBeNull();
  });

  it('calls setStatementScanMode when a mode is selected', async () => {
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    await userEvent.click(screen.getByText('Read from End (Latest)'));
    expect(mockSetStatementScanMode).toHaveBeenCalledWith(
      'stmt-1',
      'latest-offset',
      expect.objectContaining({ timestampMillis: undefined, specificOffsets: undefined, groupId: undefined })
    );
  });

  it('shows extra input when timestamp mode is selected and active', async () => {
    mockStatement = { ...mockStatement, scanMode: 'timestamp' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    const input = screen.getByPlaceholderText('e.g. 1609459200000');
    expect(input).toBeTruthy();
  });

  it('shows extra input for group-offsets mode', async () => {
    mockStatement = { ...mockStatement, scanMode: 'group-offsets' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    expect(screen.getByPlaceholderText('Consumer group ID')).toBeTruthy();
  });

  it('shows extra input for specific-offsets mode', async () => {
    mockStatement = { ...mockStatement, scanMode: 'specific-offsets' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    expect(screen.getByPlaceholderText('e.g. partition:0,offset:42;...')).toBeTruthy();
  });

  it('calls setStatementScanMode when extra input changes', async () => {
    mockStatement = { ...mockStatement, scanMode: 'timestamp', scanTimestampMillis: '' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    const input = screen.getByPlaceholderText('e.g. 1609459200000');
    await userEvent.type(input, '123');
    expect(mockSetStatementScanMode).toHaveBeenCalled();
    const lastCall = mockSetStatementScanMode.mock.calls[mockSetStatementScanMode.mock.calls.length - 1];
    expect(lastCall[0]).toBe('stmt-1');
    expect(lastCall[1]).toBe('timestamp');
  });

  it('closes menu on outside mousedown', async () => {
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    expect(document.querySelector('.scan-mode-menu')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(document.querySelector('.scan-mode-menu')).toBeNull();
  });

  it('has .open class on trigger when menu is open', async () => {
    render(<ScanModePanel statementId="stmt-1" />);
    const trigger = screen.getByTitle('Table scan startup mode');
    expect(trigger.classList.contains('open')).toBe(false);
    await userEvent.click(trigger);
    expect(trigger.classList.contains('open')).toBe(true);
  });

  it('does not show extra input for earliest-offset (no extraField)', async () => {
    mockStatement = { ...mockStatement, scanMode: 'earliest-offset' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    expect(document.querySelector('.scan-mode-extra-input')).toBeNull();
  });

  it('shows selected radio state for current mode', async () => {
    mockStatement = { ...mockStatement, scanMode: 'latest-offset' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    const selectedOption = document.querySelector('.scan-mode-option.selected');
    expect(selectedOption).toBeTruthy();
    expect(selectedOption?.textContent).toContain('Read from End');
  });

  it('shows checked radio dot for selected mode', async () => {
    mockStatement = { ...mockStatement, scanMode: 'earliest-offset' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    const checkedRadio = document.querySelector('.scan-mode-radio.checked');
    expect(checkedRadio).toBeTruthy();
  });

  it('renders with groupId extra field value', async () => {
    mockStatement = { ...mockStatement, scanMode: 'group-offsets', scanGroupId: 'my-group' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    const input = screen.getByPlaceholderText('Consumer group ID') as HTMLInputElement;
    expect(input.value).toBe('my-group');
  });

  it('renders with specificOffsets extra field value', async () => {
    mockStatement = { ...mockStatement, scanMode: 'specific-offsets', scanSpecificOffsets: 'partition:0,offset:10' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    const input = screen.getByPlaceholderText('e.g. partition:0,offset:42;...') as HTMLInputElement;
    expect(input.value).toBe('partition:0,offset:10');
  });

  it('renders with timestamp extra field value', async () => {
    mockStatement = { ...mockStatement, scanMode: 'timestamp', scanTimestampMillis: '1609459200000' };
    render(<ScanModePanel statementId="stmt-1" />);
    await userEvent.click(screen.getByTitle('Table scan startup mode'));
    const input = screen.getByPlaceholderText('e.g. 1609459200000') as HTMLInputElement;
    expect(input.value).toBe('1609459200000');
  });
});
