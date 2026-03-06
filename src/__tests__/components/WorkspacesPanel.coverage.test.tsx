/**
 * @workspaces-coverage
 * WorkspacesPanel — additional coverage for save dialog keyboard,
 * rename blur commit, overlay click-to-close, template badge,
 * getRelativeTime edge cases, workspace sorting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SavedWorkspace } from '../../types';

// Store mock
let mockSavedWorkspaces: SavedWorkspace[] = [];
let mockWorkspaceName = 'My WS';
const mockSaveCurrentWorkspace = vi.fn();
const mockOpenSavedWorkspace = vi.fn().mockResolvedValue(undefined);
const mockDeleteSavedWorkspace = vi.fn();
const mockRenameSavedWorkspace = vi.fn();

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      savedWorkspaces: mockSavedWorkspaces,
      workspaceName: mockWorkspaceName,
      saveCurrentWorkspace: mockSaveCurrentWorkspace,
      openSavedWorkspace: mockOpenSavedWorkspace,
      deleteSavedWorkspace: mockDeleteSavedWorkspace,
      renameSavedWorkspace: mockRenameSavedWorkspace,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../utils/names', () => ({
  generateFunName: () => 'fuzzy-penguin',
}));

// Must import AFTER mocks
import { WorkspacesPanel } from '../../components/WorkspacesPanel/WorkspacesPanel';

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

describe('[@workspaces-coverage] WorkspacesPanel Coverage', () => {
  beforeEach(() => {
    mockSavedWorkspaces = [];
    mockWorkspaceName = 'My WS';
    vi.clearAllMocks();
  });

  // ========================================================================
  // Save Dialog Keyboard
  // ========================================================================

  describe('[@workspaces-coverage] Save Dialog Keyboard', () => {
    it('Enter key in save dialog triggers save', () => {
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));

      const input = screen.getByLabelText(/name/i);
      fireEvent.change(input, { target: { value: 'Quick Save' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockSaveCurrentWorkspace).toHaveBeenCalledWith('Quick Save');
    });

    it('Escape key in save dialog closes it', () => {
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not save when name is whitespace-only', () => {
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));

      const input = screen.getByLabelText(/name/i);
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockSaveCurrentWorkspace).not.toHaveBeenCalled();
    });

    it('clicking overlay closes save dialog', () => {
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click the overlay (role=presentation) directly
      const overlay = screen.getByRole('presentation');
      fireEvent.click(overlay);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Save Dialog Pre-fill
  // ========================================================================

  describe('[@workspaces-coverage] Save Dialog Pre-fill', () => {
    it('pre-fills workspace name if not "F.o.B"', () => {
      mockWorkspaceName = 'My Custom Name';
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));

      const input = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(input.value).toBe('My Custom Name');
    });

    it('generates fun name if workspace name is "F.o.B"', () => {
      mockWorkspaceName = 'F.o.B';
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));

      const input = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(input.value).toBe('fuzzy-penguin');
    });

    it('generates fun name if workspace name is empty', () => {
      mockWorkspaceName = '';
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /save current workspace/i }));

      const input = screen.getByLabelText(/name/i) as HTMLInputElement;
      expect(input.value).toBe('fuzzy-penguin');
    });
  });

  // ========================================================================
  // Rename Flow
  // ========================================================================

  describe('[@workspaces-coverage] Rename Flow', () => {
    beforeEach(() => {
      mockSavedWorkspaces = [makeWorkspace({ id: 'ws-1', name: 'Original' })];
    });

    it('commits rename on blur', async () => {
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /rename workspace Original/i }));

      const input = screen.getByRole('textbox', { name: /rename workspace/i });
      fireEvent.change(input, { target: { value: 'Renamed' } });
      fireEvent.blur(input);

      expect(mockRenameSavedWorkspace).toHaveBeenCalledWith('ws-1', 'Renamed');
    });

    it('does not rename on blur if Escape was pressed', () => {
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /rename workspace Original/i }));

      const input = screen.getByRole('textbox', { name: /rename workspace/i });
      fireEvent.change(input, { target: { value: 'Should Not Save' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      // Blur happens after Escape
      fireEvent.blur(input);

      expect(mockRenameSavedWorkspace).not.toHaveBeenCalled();
    });

    it('clicking confirm button commits rename', () => {
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /rename workspace Original/i }));

      const input = screen.getByRole('textbox', { name: /rename workspace/i });
      fireEvent.change(input, { target: { value: 'New Name' } });

      fireEvent.click(screen.getByRole('button', { name: /save rename/i }));
      expect(mockRenameSavedWorkspace).toHaveBeenCalledWith('ws-1', 'New Name');
    });

    it('clicking cancel button cancels rename', () => {
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /rename workspace Original/i }));

      fireEvent.click(screen.getByRole('button', { name: /cancel rename/i }));
      expect(mockRenameSavedWorkspace).not.toHaveBeenCalled();
    });

    it('does not rename with empty value on blur', () => {
      render(<WorkspacesPanel />);
      fireEvent.click(screen.getByRole('button', { name: /rename workspace Original/i }));

      const input = screen.getByRole('textbox', { name: /rename workspace/i });
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      // Should still call handleCommitRename which checks trimmed value
      expect(mockRenameSavedWorkspace).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Template Badge
  // ========================================================================

  describe('[@workspaces-coverage] Template Badge', () => {
    it('shows template badge when workspace has sourceTemplateName', () => {
      mockSavedWorkspaces = [
        makeWorkspace({ id: 'ws-1', name: 'From Template', sourceTemplateName: 'Hello Flink' }),
      ];
      render(<WorkspacesPanel />);
      expect(screen.getByText(/Example: Hello Flink/)).toBeInTheDocument();
    });

    it('does not show template badge when no sourceTemplateName', () => {
      mockSavedWorkspaces = [makeWorkspace({ id: 'ws-1', name: 'Regular WS' })];
      render(<WorkspacesPanel />);
      expect(screen.queryByText(/Example:/)).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Relative Time
  // ========================================================================

  describe('[@workspaces-coverage] Relative Time', () => {
    it('shows relative time for recent workspace', () => {
      mockSavedWorkspaces = [
        makeWorkspace({
          id: 'ws-1',
          name: 'Recent',
          updatedAt: new Date().toISOString(),
        }),
      ];
      render(<WorkspacesPanel />);
      expect(screen.getByText('now')).toBeInTheDocument();
    });

    it('shows hours ago for workspace updated hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      mockSavedWorkspaces = [
        makeWorkspace({ id: 'ws-1', name: 'Older', updatedAt: twoHoursAgo }),
      ];
      render(<WorkspacesPanel />);
      expect(screen.getByText('2h ago')).toBeInTheDocument();
    });

    it('shows days ago for workspace updated days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      mockSavedWorkspaces = [
        makeWorkspace({ id: 'ws-1', name: 'Old', updatedAt: threeDaysAgo }),
      ];
      render(<WorkspacesPanel />);
      expect(screen.getByText('3d ago')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Workspace Sorting
  // ========================================================================

  describe('[@workspaces-coverage] Sorting', () => {
    it('sorts workspaces newest first', () => {
      const older = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const newer = new Date().toISOString();
      mockSavedWorkspaces = [
        makeWorkspace({ id: 'ws-old', name: 'Older WS', updatedAt: older }),
        makeWorkspace({ id: 'ws-new', name: 'Newer WS', updatedAt: newer }),
      ];
      render(<WorkspacesPanel />);

      const items = screen.getAllByRole('listitem');
      expect(items[0]).toHaveTextContent('Newer WS');
      expect(items[1]).toHaveTextContent('Older WS');
    });
  });

  // ========================================================================
  // Stream Card Count
  // ========================================================================

  describe('[@workspaces-coverage] Metadata Counts', () => {
    it('shows stream count when > 0', () => {
      mockSavedWorkspaces = [
        makeWorkspace({ id: 'ws-1', name: 'With Streams', statementCount: 2, streamCardCount: 3 }),
      ];
      render(<WorkspacesPanel />);
      expect(screen.getByText(/3 streams/)).toBeInTheDocument();
    });

    it('hides stream count when 0', () => {
      mockSavedWorkspaces = [
        makeWorkspace({ id: 'ws-1', name: 'No Streams', statementCount: 2, streamCardCount: 0 }),
      ];
      render(<WorkspacesPanel />);
      expect(screen.queryByText(/stream/)).not.toBeInTheDocument();
    });

    it('uses singular "statement" for count of 1', () => {
      mockSavedWorkspaces = [
        makeWorkspace({ id: 'ws-1', name: 'Single', statementCount: 1, streamCardCount: 0 }),
      ];
      render(<WorkspacesPanel />);
      expect(screen.getByText('1 statement')).toBeInTheDocument();
    });
  });
});
