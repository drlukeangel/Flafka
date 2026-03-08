// Saved Workspaces sidebar panel — snapshot + restore SQL cells & stream card configs
import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { generateFunName } from '../../utils/names';
import { FiLayers, FiSearch, FiTrash2, FiEdit2, FiCheck, FiX, FiFolder } from 'react-icons/fi';
import './WorkspacesPanel.css';

const MAX_WORKSPACES = 50;

function getRelativeTime(isoDateString: string | undefined | null): string | null {
  if (!isoDateString) return null;
  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    if (diffSeconds < 60) return 'now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return null;
  }
}

export function WorkspacesPanel() {
  const savedWorkspaces = useWorkspaceStore((s) => s.savedWorkspaces);
  const saveCurrentWorkspace = useWorkspaceStore((s) => s.saveCurrentWorkspace);
  const openSavedWorkspace = useWorkspaceStore((s) => s.openSavedWorkspace);
  const deleteSavedWorkspace = useWorkspaceStore((s) => s.deleteSavedWorkspace);
  const renameSavedWorkspace = useWorkspaceStore((s) => s.renameSavedWorkspace);
  const workspaceName = useWorkspaceStore((s) => s.workspaceName);

  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameCancelledRef = useRef(false);

  const [openConfirmId, setOpenConfirmId] = useState<string | null>(null);

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNameValue, setSaveNameValue] = useState('');
  const saveInputRef = useRef<HTMLInputElement>(null);

  // Sort newest-first
  const sorted = [...savedWorkspaces].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const filtered = sorted.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase())
  );

  // Open save dialog
  const handleOpenSaveDialog = () => {
    setSaveNameValue(workspaceName && workspaceName !== 'F.o.B' ? workspaceName : generateFunName());
    setSaveDialogOpen(true);
  };

  // Pre-select text when save dialog opens
  useEffect(() => {
    if (saveDialogOpen) {
      requestAnimationFrame(() => {
        saveInputRef.current?.select();
      });
    }
  }, [saveDialogOpen]);

  const handleCloseSaveDialog = () => {
    setSaveDialogOpen(false);
  };

  const handleSave = () => {
    const name = saveNameValue.trim();
    if (!name) return;
    saveCurrentWorkspace(name);
    setSaveDialogOpen(false);
  };

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCloseSaveDialog();
    }
  };

  // Open workspace
  const handleOpenClick = (id: string) => {
    setOpenConfirmId(id);
  };

  const handleOpenConfirm = async (id: string) => {
    setOpenConfirmId(null);
    await openSavedWorkspace(id);
  };

  const handleOpenCancel = () => {
    setOpenConfirmId(null);
  };

  // Rename handlers
  const handleStartRename = (id: string, currentName: string) => {
    renameCancelledRef.current = false;
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const handleCommitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameSavedWorkspace(id, trimmed);
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      renameCancelledRef.current = false;
      handleCommitRename(id);
    } else if (e.key === 'Escape') {
      renameCancelledRef.current = true;
      setRenamingId(null);
      setRenameValue('');
    }
  };

  const handleRenameBlur = (id: string) => {
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false;
      return;
    }
    handleCommitRename(id);
  };

  const atMax = savedWorkspaces.length >= MAX_WORKSPACES;

  return (
    <div className="workspaces-panel" role="region" aria-label="Saved Workspaces">
      {/* Header */}
      <div className="workspaces-panel-header">
        <div className="workspaces-panel-title">
          <FiLayers size={16} style={{ color: 'var(--color-primary)' }} />
          <span>Workspaces</span>
          <span className="workspaces-count-badge">{savedWorkspaces.length}/{MAX_WORKSPACES}</span>
        </div>
        <button
          className="workspaces-save-btn"
          onClick={handleOpenSaveDialog}
          disabled={atMax}
          title={atMax ? 'Max 50 workspaces — delete one first' : 'Save current workspace'}
          aria-label="Save current workspace"
        >
          Save Current
        </button>
      </div>

      {/* Search */}
      <div className="workspaces-search">
        <FiSearch size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workspaces..."
          aria-label="Search workspaces"
          className="workspaces-search-input"
        />
        {search && (
          <button
            className="workspaces-search-clear"
            onClick={() => setSearch('')}
            aria-label="Clear search"
          >
            <FiX size={12} />
          </button>
        )}
      </div>

      {/* Workspace List */}
      <div className="workspaces-list-container" aria-live="polite" aria-label="Workspace list">
        {savedWorkspaces.length === 0 ? (
          <div className="workspaces-empty-state" role="status">
            <FiLayers size={32} style={{ color: 'var(--color-text-tertiary)', marginBottom: 8 }} />
            <p className="workspaces-empty-title">No saved workspaces yet</p>
            <p className="workspaces-empty-hint">
              Click <strong>Save Current</strong> to snapshot your SQL cells and stream cards.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="workspaces-empty-state" role="status">
            <p className="workspaces-empty-title">No workspaces match your search.</p>
          </div>
        ) : (
          <ul className="workspaces-list" role="list">
            {filtered.map((workspace) => (
              <li key={workspace.id} className="workspace-item" role="listitem">
                <div className="workspace-item-header">
                  {renamingId === workspace.id ? (
                    <input
                      className="workspace-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, workspace.id)}
                      onBlur={() => handleRenameBlur(workspace.id)}
                      autoFocus
                      maxLength={80}
                      aria-label="Rename workspace"
                    />
                  ) : (
                    <span className="workspace-name" title={workspace.name}>
                      {workspace.name}
                    </span>
                  )}
                  <div className="workspace-actions">
                    {renamingId === workspace.id ? (
                      <>
                        <button
                          className="workspace-action-btn workspace-action-btn--confirm"
                          onClick={() => handleCommitRename(workspace.id)}
                          title="Save rename"
                          aria-label="Save rename"
                        >
                          <FiCheck size={12} />
                        </button>
                        <button
                          className="workspace-action-btn"
                          onClick={() => {
                            renameCancelledRef.current = true;
                            setRenamingId(null);
                          }}
                          title="Cancel rename"
                          aria-label="Cancel rename"
                        >
                          <FiX size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="workspace-action-btn workspace-action-btn--open"
                          onClick={() => handleOpenClick(workspace.id)}
                          title="Open this workspace"
                          aria-label={`Open workspace ${workspace.name}`}
                        >
                          <FiFolder size={12} />
                        </button>
                        <button
                          className="workspace-action-btn"
                          onClick={() => handleStartRename(workspace.id, workspace.name)}
                          title="Rename workspace"
                          aria-label={`Rename workspace ${workspace.name}`}
                        >
                          <FiEdit2 size={12} />
                        </button>
                        <button
                          className="workspace-action-btn workspace-action-btn--danger"
                          onClick={() => deleteSavedWorkspace(workspace.id)}
                          title="Delete workspace"
                          aria-label={`Delete workspace ${workspace.name}`}
                        >
                          <FiTrash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Metadata row */}
                <div className="workspace-meta">
                  <span className="workspace-meta-counts">
                    {workspace.statementCount} statement{workspace.statementCount !== 1 ? 's' : ''}
                    {workspace.streamCardCount > 0 && ` · ${workspace.streamCardCount} stream${workspace.streamCardCount !== 1 ? 's' : ''}`}
                  </span>
                  {getRelativeTime(workspace.updatedAt) && (
                    <span className="workspace-meta-time" title={workspace.updatedAt}>
                      {getRelativeTime(workspace.updatedAt)}
                    </span>
                  )}
                </div>

                {/* Template badge */}
                {workspace.sourceTemplateName && (
                  <span
                    className="workspace-template-badge"
                    title={`Created from example: ${workspace.sourceTemplateName}`}
                  >
                    Example: {workspace.sourceTemplateName}
                  </span>
                )}

                {/* Open confirmation row */}
                {openConfirmId === workspace.id && (
                  <div className="workspace-open-confirm" role="alert">
                    <p className="workspace-open-confirm-msg">
                      Your current SQL cells and stream cards will be replaced. Running statements will be cancelled.
                    </p>
                    <div className="workspace-open-confirm-actions">
                      <button
                        className="workspace-confirm-btn workspace-confirm-btn--cancel"
                        onClick={handleOpenCancel}
                      >
                        Cancel
                      </button>
                      <button
                        className="workspace-confirm-btn workspace-confirm-btn--open"
                        onClick={() => handleOpenConfirm(workspace.id)}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Save Dialog */}
      {saveDialogOpen && (
        <div
          className="workspaces-dialog-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseSaveDialog();
          }}
        >
          <div
            className="workspaces-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-dialog-title"
            onKeyDown={handleSaveKeyDown}
          >
            <div className="workspaces-dialog-header">
              <span id="workspace-dialog-title" className="workspaces-dialog-title">Save Workspace</span>
              <button
                className="workspaces-dialog-close"
                onClick={handleCloseSaveDialog}
                aria-label="Close dialog"
              >
                <FiX size={16} />
              </button>
            </div>
            <div className="workspaces-dialog-body">
              <label htmlFor="workspace-name-input" className="workspaces-dialog-label">
                Name
              </label>
              <input
                id="workspace-name-input"
                ref={saveInputRef}
                type="text"
                value={saveNameValue}
                onChange={(e) => setSaveNameValue(e.target.value)}
                className="workspaces-dialog-input"
                maxLength={80}
                aria-required="true"
              />
            </div>
            <div className="workspaces-dialog-footer">
              <button
                className="workspaces-dialog-btn workspaces-dialog-btn--cancel"
                onClick={handleCloseSaveDialog}
              >
                Cancel
              </button>
              <button
                className="workspaces-dialog-btn workspaces-dialog-btn--save"
                onClick={handleSave}
                disabled={!saveNameValue.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
