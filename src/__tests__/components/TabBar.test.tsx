import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TabState } from '../../types';

// Store mock values
const mockSwitchTab = vi.fn();
const mockAddTab = vi.fn();
const mockCloseTab = vi.fn();
const mockRenameTab = vi.fn();
const mockReorderTabs = vi.fn();
const mockSaveCurrentWorkspace = vi.fn();
const mockToggleWorkspaceNotes = vi.fn();
const mockSetWorkspaceNotes = vi.fn();
const mockUpdateSavedWorkspaceNotes = vi.fn();

const defaultTab: TabState = {
  statements: [],
  focusedStatementId: null,
  workspaceName: 'Workspace 1',
  workspaceNotes: null,
  workspaceNotesOpen: false,
  lastSavedAt: null,
  streamCards: [],
  backgroundStatements: [],
  treeNodes: [],
  selectedNodeId: null,
  treeLoading: false,
  selectedTableSchema: [],
  selectedTableName: null,
  schemaLoading: false,
};

let mockTabs: Record<string, TabState> = { 'tab-1': defaultTab };
let mockActiveTabId = 'tab-1';
let mockTabOrder = ['tab-1'];
let mockSavedWorkspaces: any[] = [];

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: any) => {
    const state = {
      tabs: mockTabs,
      activeTabId: mockActiveTabId,
      tabOrder: mockTabOrder,
      switchTab: mockSwitchTab,
      addTab: mockAddTab,
      closeTab: mockCloseTab,
      renameTab: mockRenameTab,
      reorderTabs: mockReorderTabs,
      saveCurrentWorkspace: mockSaveCurrentWorkspace,
      toggleWorkspaceNotes: mockToggleWorkspaceNotes,
      setWorkspaceNotes: mockSetWorkspaceNotes,
      savedWorkspaces: mockSavedWorkspaces,
      updateSavedWorkspaceNotes: mockUpdateSavedWorkspaceNotes,
    };
    return selector(state);
  },
}));

// Mock CSS import
vi.mock('../../components/TabBar/TabBar.css', () => ({}));

import { TabBar } from '../../components/TabBar/TabBar';

describe('[@tab-bar] TabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTabs = { 'tab-1': { ...defaultTab } };
    mockActiveTabId = 'tab-1';
    mockTabOrder = ['tab-1'];
    mockSavedWorkspaces = [];
  });

  it('renders tab with workspace name', () => {
    render(<TabBar />);
    expect(screen.getByText('Workspace 1')).toBeInTheDocument();
  });

  it('renders add tab button', () => {
    render(<TabBar />);
    expect(screen.getByLabelText('Add new tab')).toBeInTheDocument();
  });

  it('calls addTab when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.click(screen.getByLabelText('Add new tab'));
    expect(mockAddTab).toHaveBeenCalled();
  });

  it('disables add button when MAX_TABS (8) reached', () => {
    mockTabOrder = Array.from({ length: 8 }, (_, i) => `tab-${i}`);
    const tabs: Record<string, TabState> = {};
    mockTabOrder.forEach((id, i) => {
      tabs[id] = { ...defaultTab, workspaceName: `WS ${i}` };
    });
    mockTabs = tabs;

    render(<TabBar />);
    const addBtn = screen.getByLabelText('Add new tab');
    expect(addBtn).toBeDisabled();
  });

  it('calls closeTab when close button is clicked on idle tab', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.click(screen.getByLabelText('Close Workspace 1'));
    expect(mockCloseTab).toHaveBeenCalledWith('tab-1');
  });

  it('shows warning dialog when closing tab with running statements', async () => {
    const user = userEvent.setup();
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        statements: [{ id: 's1', code: '', status: 'RUNNING' } as any],
      },
    };

    render(<TabBar />);
    await user.click(screen.getByLabelText('Close Workspace 1'));

    // Warning dialog should appear
    expect(screen.getByText('Close tab?')).toBeInTheDocument();
    expect(screen.getByText(/running statements/)).toBeInTheDocument();
  });

  it('confirms close from warning dialog', async () => {
    const user = userEvent.setup();
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        statements: [{ id: 's1', code: '', status: 'RUNNING' } as any],
      },
    };

    render(<TabBar />);
    await user.click(screen.getByLabelText('Close Workspace 1'));
    await user.click(screen.getByText('Close Tab'));
    expect(mockCloseTab).toHaveBeenCalledWith('tab-1');
  });

  it('cancels close from warning dialog', async () => {
    const user = userEvent.setup();
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        statements: [{ id: 's1', code: '', status: 'RUNNING' } as any],
      },
    };

    render(<TabBar />);
    await user.click(screen.getByLabelText('Close Workspace 1'));
    await user.click(screen.getByText('Cancel'));
    expect(mockCloseTab).not.toHaveBeenCalled();
  });

  it('shows cell position counter for active tab', () => {
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        statements: [
          { id: 's1', code: '' } as any,
          { id: 's2', code: '' } as any,
        ],
        focusedStatementId: 's2',
      },
    };

    render(<TabBar />);
    expect(screen.getByText('Cell 2 of 2')).toBeInTheDocument();
  });

  it('shows statement count when no cell is focused', () => {
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        statements: [{ id: 's1', code: '' } as any, { id: 's2', code: '' } as any],
      },
    };

    render(<TabBar />);
    expect(screen.getByText('2 statement(s)')).toBeInTheDocument();
  });

  it('enters rename mode on double click', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.dblClick(screen.getByText('Workspace 1'));

    const input = screen.getByDisplayValue('Workspace 1');
    expect(input).toBeInTheDocument();
  });

  it('commits rename on blur', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.dblClick(screen.getByText('Workspace 1'));

    const input = screen.getByDisplayValue('Workspace 1');
    await user.clear(input);
    await user.type(input, 'New Name');
    fireEvent.blur(input);

    expect(mockRenameTab).toHaveBeenCalledWith('tab-1', 'New Name');
  });

  it('commits rename on Enter key', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.dblClick(screen.getByText('Workspace 1'));

    const input = screen.getByDisplayValue('Workspace 1');
    await user.clear(input);
    await user.type(input, 'Renamed');
    await user.keyboard('{Enter}');

    expect(mockRenameTab).toHaveBeenCalledWith('tab-1', 'Renamed');
  });

  it('cancels rename on Escape key', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.dblClick(screen.getByText('Workspace 1'));

    await user.keyboard('{Escape}');
    // Should exit rename mode without calling renameTab
    expect(mockRenameTab).not.toHaveBeenCalled();
  });

  it('renders save button for active tab', () => {
    render(<TabBar />);
    expect(screen.getByLabelText('Save workspace')).toBeInTheDocument();
  });

  it('calls saveCurrentWorkspace when save button is clicked', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.click(screen.getByLabelText('Save workspace'));
    expect(mockSaveCurrentWorkspace).toHaveBeenCalledWith('Workspace 1');
  });

  it('renders notes button for active tab', () => {
    render(<TabBar />);
    expect(screen.getByLabelText('Open notes')).toBeInTheDocument();
  });

  it('shows notes panel when workspaceNotesOpen is true', () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceNotesOpen: true },
    };
    render(<TabBar />);
    expect(screen.getByLabelText('Workspace notes')).toBeInTheDocument();
  });

  it('renders running dot for tab with running statements', () => {
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        statements: [{ id: 's1', code: '', status: 'RUNNING' } as any],
      },
    };
    const { container } = render(<TabBar />);
    expect(container.querySelector('.tab-bar__running-dot')).toBeInTheDocument();
  });

  it('renders notes dot when tab has notes', () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceNotes: 'Some notes' },
    };
    const { container } = render(<TabBar />);
    expect(container.querySelector('.tab-bar__notes-dot')).toBeInTheDocument();
  });

  it('renders last saved time when available', () => {
    const savedAt = new Date('2026-03-06T10:30:00').toISOString();
    mockTabs = {
      'tab-1': { ...defaultTab, lastSavedAt: savedAt },
    };
    render(<TabBar />);
    expect(screen.getByText(/Last saved at/)).toBeInTheDocument();
  });

  it('renders multiple tabs', () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];

    render(<TabBar />);
    expect(screen.getByText('WS 1')).toBeInTheDocument();
    expect(screen.getByText('WS 2')).toBeInTheDocument();
  });

  it('marks active tab with aria-selected=true', () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];

    render(<TabBar />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('switches tab on click', async () => {
    const user = userEvent.setup();
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];

    render(<TabBar />);
    await user.click(screen.getByText('WS 2'));
    expect(mockSwitchTab).toHaveBeenCalledWith('tab-2');
  });

  it('has tablist role on container', () => {
    render(<TabBar />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('shows warning dialog for tab with live background streams', async () => {
    const user = userEvent.setup();
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        backgroundStatements: [{ id: 'bg1', status: 'RUNNING' } as any],
      },
    };

    render(<TabBar />);
    await user.click(screen.getByLabelText('Close Workspace 1'));
    expect(screen.getByText('Close tab?')).toBeInTheDocument();
  });

  it('dismisses close warning on overlay click', async () => {
    const user = userEvent.setup();
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        statements: [{ id: 's1', code: '', status: 'RUNNING' } as any],
      },
    };

    render(<TabBar />);
    await user.click(screen.getByLabelText('Close Workspace 1'));
    expect(screen.getByText('Close tab?')).toBeInTheDocument();

    // Click overlay
    const overlay = document.querySelector('.tab-close-warning-overlay')!;
    fireEvent.click(overlay);
    expect(screen.queryByText('Close tab?')).not.toBeInTheDocument();
  });

  it('does not switch tab when clicking during rename', async () => {
    const user = userEvent.setup();
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];

    render(<TabBar />);
    // Enter rename mode on tab-1
    await user.dblClick(screen.getByText('WS 1'));
    // Clear calls from the dblClick (which includes click events)
    mockSwitchTab.mockClear();
    // Click tab-1 area (should not switchTab since renaming)
    const tab1 = screen.getAllByRole('tab')[0];
    await user.click(tab1);
    expect(mockSwitchTab).not.toHaveBeenCalled();
  });

  it('does not rename with empty value on blur', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.dblClick(screen.getByText('Workspace 1'));
    const input = screen.getByDisplayValue('Workspace 1');
    await user.clear(input);
    fireEvent.blur(input);
    expect(mockRenameTab).not.toHaveBeenCalled();
  });

  it('navigates with ArrowRight key', async () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];

    render(<TabBar />);
    const tab1 = screen.getAllByRole('tab')[0];
    fireEvent.keyDown(tab1, { key: 'ArrowRight' });
    expect(mockSwitchTab).toHaveBeenCalledWith('tab-2');
  });

  it('navigates with ArrowLeft key (wraps around)', async () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];

    render(<TabBar />);
    const tab1 = screen.getAllByRole('tab')[0];
    fireEvent.keyDown(tab1, { key: 'ArrowLeft' });
    expect(mockSwitchTab).toHaveBeenCalledWith('tab-2');
  });

  it('navigates to first tab on Home key', () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];
    mockActiveTabId = 'tab-2';

    render(<TabBar />);
    const tab2 = screen.getAllByRole('tab')[1];
    fireEvent.keyDown(tab2, { key: 'Home' });
    expect(mockSwitchTab).toHaveBeenCalledWith('tab-1');
  });

  it('navigates to last tab on End key', () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];

    render(<TabBar />);
    const tab1 = screen.getAllByRole('tab')[0];
    fireEvent.keyDown(tab1, { key: 'End' });
    expect(mockSwitchTab).toHaveBeenCalledWith('tab-2');
  });

  it('calls toggleWorkspaceNotes when notes button clicked', async () => {
    const user = userEvent.setup();
    render(<TabBar />);
    await user.click(screen.getByLabelText('Open notes'));
    expect(mockToggleWorkspaceNotes).toHaveBeenCalled();
  });

  it('shows "Close notes" label on notes button when notes are open', () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceNotesOpen: true },
    };
    render(<TabBar />);
    // Both the notes panel close button and the tab notes toggle have "Close notes"
    const closeButtons = screen.getAllByLabelText('Close notes');
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('saves notes on textarea blur', async () => {
    const user = userEvent.setup();
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceNotesOpen: true, workspaceNotes: '' },
    };
    render(<TabBar />);
    const textarea = screen.getByLabelText('Workspace notes');
    await user.type(textarea, 'Hello notes');
    fireEvent.blur(textarea);
    expect(mockSetWorkspaceNotes).toHaveBeenCalled();
  });

  it('closes notes panel on Escape key in textarea', async () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceNotesOpen: true },
    };
    render(<TabBar />);
    const textarea = screen.getByLabelText('Workspace notes');
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(mockSetWorkspaceNotes).toHaveBeenCalled();
    expect(mockToggleWorkspaceNotes).toHaveBeenCalled();
  });

  it('closes notes panel when close button in notes header is clicked', async () => {
    const user = userEvent.setup();
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceNotesOpen: true },
    };
    render(<TabBar />);
    await user.click(screen.getByLabelText('Close notes'));
    expect(mockToggleWorkspaceNotes).toHaveBeenCalled();
  });

  it('updates saved workspace notes when workspace is saved', async () => {
    const user = userEvent.setup();
    mockSavedWorkspaces = [{ id: 'sw-1', name: 'Workspace 1' }];
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceNotesOpen: true, workspaceNotes: '' },
    };
    render(<TabBar />);
    const textarea = screen.getByLabelText('Workspace notes');
    await user.type(textarea, 'Updated');
    fireEvent.blur(textarea);
    expect(mockUpdateSavedWorkspaceNotes).toHaveBeenCalledWith('sw-1', 'Updated');
  });

  it('does not call updateSavedWorkspaceNotes when workspace is not saved', async () => {
    const user = userEvent.setup();
    mockSavedWorkspaces = [];
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceNotesOpen: true, workspaceNotes: '' },
    };
    render(<TabBar />);
    const textarea = screen.getByLabelText('Workspace notes');
    await user.type(textarea, 'Note');
    fireEvent.blur(textarea);
    expect(mockUpdateSavedWorkspaceNotes).not.toHaveBeenCalled();
  });

  it('drag reorder calls reorderTabs', () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];

    render(<TabBar />);
    const tabs = screen.getAllByRole('tab');

    fireEvent.dragStart(tabs[0], { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragOver(tabs[1], { dataTransfer: { dropEffect: '' }, preventDefault: vi.fn() });
    fireEvent.drop(tabs[1], { dataTransfer: {}, preventDefault: vi.fn() });

    expect(mockReorderTabs).toHaveBeenCalledWith(0, 1);
  });

  it('clears drag state on dragEnd', () => {
    mockTabs = {
      'tab-1': { ...defaultTab, workspaceName: 'WS 1' },
      'tab-2': { ...defaultTab, workspaceName: 'WS 2' },
    };
    mockTabOrder = ['tab-1', 'tab-2'];

    const { container } = render(<TabBar />);
    const tabs = screen.getAllByRole('tab');

    fireEvent.dragStart(tabs[0], { dataTransfer: { effectAllowed: '' } });
    fireEvent.dragOver(tabs[1], { dataTransfer: { dropEffect: '' }, preventDefault: vi.fn() });
    // Should have drag-over class
    expect(tabs[1].classList.contains('tab-bar__tab--drag-over')).toBe(true);
    fireEvent.dragEnd(tabs[0]);
    // Drag-over class should be removed
    expect(tabs[1].classList.contains('tab-bar__tab--drag-over')).toBe(false);
  });

  it('does not reorder when dropping on same index', () => {
    render(<TabBar />);
    const tab = screen.getByRole('tab');
    fireEvent.dragStart(tab, { dataTransfer: { effectAllowed: '' } });
    fireEvent.drop(tab, { dataTransfer: {}, preventDefault: vi.fn() });
    expect(mockReorderTabs).not.toHaveBeenCalled();
  });

  it('shows running dot for tab with PENDING background statements', () => {
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        backgroundStatements: [{ id: 'bg1', status: 'PENDING' } as any],
      },
    };
    const { container } = render(<TabBar />);
    expect(container.querySelector('.tab-bar__running-dot')).toBeInTheDocument();
  });

  it('does not show running dot for COMPLETED statements', () => {
    mockTabs = {
      'tab-1': {
        ...defaultTab,
        statements: [{ id: 's1', code: '', status: 'COMPLETED' } as any],
      },
    };
    const { container } = render(<TabBar />);
    expect(container.querySelector('.tab-bar__running-dot')).toBeNull();
  });

  it('skips null tabs gracefully', () => {
    mockTabs = {
      'tab-1': { ...defaultTab },
    };
    mockTabOrder = ['tab-1', 'tab-nonexistent'];

    render(<TabBar />);
    // Should only render the valid tab
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });
});
