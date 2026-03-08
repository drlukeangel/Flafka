/**
 * @workspaces-ui
 * WorkspacesPanel Component Tests
 *
 * Covers:
 *   - Empty state renders correctly
 *   - Workspace list renders with items
 *   - Search filters by name
 *   - Save dialog opens and closes
 *   - Open confirmation row shows/hides
 *   - Delete button triggers deleteSavedWorkspace
 *   - Rename flow
 *   - Header: Save button visible in workspace nav
 *   - NavRail: workspaces item renders
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SavedWorkspace } from '../../types';

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

let mockSavedWorkspaces: SavedWorkspace[] = [];
let mockWorkspaceName = 'My WS';
const mockSaveCurrentWorkspace = vi.fn();
const mockOpenSavedWorkspace = vi.fn().mockResolvedValue(undefined);
const mockDeleteSavedWorkspace = vi.fn();
const mockRenameSavedWorkspace = vi.fn();
const mockSetActiveNavItem = vi.fn();

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      savedWorkspaces: mockSavedWorkspaces,
      workspaceName: mockWorkspaceName,
      saveCurrentWorkspace: mockSaveCurrentWorkspace,
      openSavedWorkspace: mockOpenSavedWorkspace,
      deleteSavedWorkspace: mockDeleteSavedWorkspace,
      renameSavedWorkspace: mockRenameSavedWorkspace,
      // NavRail state
      activeNavItem: 'workspaces' as const,
      navExpanded: false,
      setActiveNavItem: mockSetActiveNavItem,
      toggleNavExpanded: vi.fn(),
      theme: 'light' as const,
      toggleTheme: vi.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../utils/names', () => ({
  generateFunName: () => 'fuzzy-penguin',
}));

// Import after mocks
import { WorkspacesPanel } from '../../components/WorkspacesPanel/WorkspacesPanel';
import { NavRail } from '../../components/NavRail/NavRail';

function makeWorkspace(overrides: Partial<SavedWorkspace> = {}): SavedWorkspace {
  return {
    id: 'ws-1',
    name: 'My Workspace',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statementCount: 2,
    streamCardCount: 1,
    statements: [],
    streamCards: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@workspaces] WorkspacesPanel — empty state', () => {
  beforeEach(() => {
    mockSavedWorkspaces = [];
    vi.clearAllMocks();
  });

  it('renders empty state when no workspaces', () => {
    render(<WorkspacesPanel />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/No saved workspaces yet/i)).toBeInTheDocument();
  });

  it('renders header with count badge', () => {
    render(<WorkspacesPanel />);
    expect(screen.getByText('0/50')).toBeInTheDocument();
  });

  it('renders Save Current button', () => {
    render(<WorkspacesPanel />);
    expect(screen.getByRole('button', { name: /save current workspace/i })).toBeInTheDocument();
  });
});

describe('[@workspaces] WorkspacesPanel — with workspaces', () => {
  beforeEach(() => {
    mockSavedWorkspaces = [
      makeWorkspace({ id: 'ws-1', name: 'Alpha WS', statementCount: 3, streamCardCount: 1 }),
      makeWorkspace({ id: 'ws-2', name: 'Beta WS', statementCount: 1, streamCardCount: 0 }),
    ];
    vi.clearAllMocks();
  });

  it('renders workspace list', () => {
    render(<WorkspacesPanel />);
    expect(screen.getByText('Alpha WS')).toBeInTheDocument();
    expect(screen.getByText('Beta WS')).toBeInTheDocument();
  });

  it('renders statement + stream counts', () => {
    render(<WorkspacesPanel />);
    expect(screen.getByText(/3 statements/)).toBeInTheDocument();
    expect(screen.getByText(/1 stream/)).toBeInTheDocument();
  });

  it('renders count badge showing 2/50', () => {
    render(<WorkspacesPanel />);
    expect(screen.getByText('2/50')).toBeInTheDocument();
  });
});

describe('[@workspaces] WorkspacesPanel — search', () => {
  beforeEach(() => {
    mockSavedWorkspaces = [
      makeWorkspace({ id: 'ws-1', name: 'Alpha WS' }),
      makeWorkspace({ id: 'ws-2', name: 'Beta WS' }),
    ];
    vi.clearAllMocks();
  });

  it('filters list by search query', () => {
    render(<WorkspacesPanel />);
    const searchInput = screen.getByRole('textbox', { name: /search workspaces/i });
    fireEvent.change(searchInput, { target: { value: 'alpha' } });
    expect(screen.getByText('Alpha WS')).toBeInTheDocument();
    expect(screen.queryByText('Beta WS')).not.toBeInTheDocument();
  });

  it('shows no-match state when nothing found', () => {
    render(<WorkspacesPanel />);
    const searchInput = screen.getByRole('textbox', { name: /search workspaces/i });
    fireEvent.change(searchInput, { target: { value: 'zzz-no-match' } });
    expect(screen.getByText(/No workspaces match/i)).toBeInTheDocument();
  });

  it('clear button resets search', () => {
    render(<WorkspacesPanel />);
    const searchInput = screen.getByRole('textbox', { name: /search workspaces/i });
    fireEvent.change(searchInput, { target: { value: 'alpha' } });
    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearBtn);
    expect(screen.getByText('Beta WS')).toBeInTheDocument();
  });
});

describe('[@workspaces] WorkspacesPanel — save dialog', () => {
  beforeEach(() => {
    mockSavedWorkspaces = [];
    vi.clearAllMocks();
  });

  it('opens save dialog on Save Current click', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it('calls saveCurrentWorkspace on Save button click', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));
    const input = screen.getByLabelText(/name/i);
    fireEvent.change(input, { target: { value: 'My New WS' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockSaveCurrentWorkspace).toHaveBeenCalledWith('My New WS');
  });

  it('closes dialog on Cancel', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Save button is disabled when name is empty', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));
    const input = screen.getByLabelText(/name/i);
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });
});

describe('[@workspaces] WorkspacesPanel — open confirmation', () => {
  beforeEach(() => {
    mockSavedWorkspaces = [makeWorkspace({ id: 'ws-1', name: 'My WS' })];
    vi.clearAllMocks();
  });

  it('shows confirmation row on open click', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /open workspace My WS/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/will be replaced/i)).toBeInTheDocument();
  });

  it('calls openSavedWorkspace on confirm', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /open workspace My WS/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Open$/i }));
    expect(mockOpenSavedWorkspace).toHaveBeenCalledWith('ws-1');
  });

  it('hides confirmation row on Cancel', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /open workspace My WS/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('[@workspaces] WorkspacesPanel — delete', () => {
  beforeEach(() => {
    mockSavedWorkspaces = [makeWorkspace({ id: 'ws-1', name: 'My WS' })];
    vi.clearAllMocks();
  });

  it('calls deleteSavedWorkspace on trash click', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /delete workspace My WS/i }));
    expect(mockDeleteSavedWorkspace).toHaveBeenCalledWith('ws-1');
  });
});

describe('[@workspaces] WorkspacesPanel — rename', () => {
  beforeEach(() => {
    mockSavedWorkspaces = [makeWorkspace({ id: 'ws-1', name: 'My WS' })];
    vi.clearAllMocks();
  });

  it('shows rename input on edit click', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /rename workspace My WS/i }));
    expect(screen.getByRole('textbox', { name: /rename workspace/i })).toBeInTheDocument();
  });

  it('calls renameSavedWorkspace on Enter', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /rename workspace My WS/i }));
    const input = screen.getByRole('textbox', { name: /rename workspace/i });
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockRenameSavedWorkspace).toHaveBeenCalledWith('ws-1', 'New Name');
  });

  it('cancels rename on Escape without calling rename', () => {
    render(<WorkspacesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /rename workspace My WS/i }));
    const input = screen.getByRole('textbox', { name: /rename workspace/i });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockRenameSavedWorkspace).not.toHaveBeenCalled();
  });
});

describe('[@workspaces] NavRail — workspaces item', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Workspaces nav item', () => {
    render(<NavRail />);
    expect(screen.getByRole('button', { name: /workspaces/i })).toBeInTheDocument();
  });

  it('Workspaces is in tools section (after Jobs)', () => {
    render(<NavRail />);
    const items = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    const wsIdx = items.indexOf('Workspaces');
    const jobsIdx = items.indexOf('Jobs');
    expect(wsIdx).toBeGreaterThan(-1);
    expect(jobsIdx).toBeGreaterThan(-1);
    expect(wsIdx).toBeGreaterThan(jobsIdx);
  });
});

describe('[@workspaces] WorkspacesPanel — max limit', () => {
  it('disables Save Current button at 50 workspaces', () => {
    mockSavedWorkspaces = Array.from({ length: 50 }, (_, i) =>
      makeWorkspace({ id: `ws-${i}`, name: `WS ${i}` })
    );
    render(<WorkspacesPanel />);
    expect(screen.getByRole('button', { name: /save current workspace/i })).toBeDisabled();
  });
});
