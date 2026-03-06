import { useState, useRef, useCallback, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { WorkspaceState } from '../../store/workspaceStore';
import { FiPlus, FiX, FiSave, FiEdit3 } from 'react-icons/fi';
import './TabBar.css';

const MAX_TABS = 8;

export function TabBar() {
  const tabs = useWorkspaceStore((s: WorkspaceState) => s.tabs);
  const activeTabId = useWorkspaceStore((s: WorkspaceState) => s.activeTabId);
  const tabOrder = useWorkspaceStore((s: WorkspaceState) => s.tabOrder);
  const switchTab = useWorkspaceStore((s: WorkspaceState) => s.switchTab);
  const addTab = useWorkspaceStore((s: WorkspaceState) => s.addTab);
  const closeTab = useWorkspaceStore((s: WorkspaceState) => s.closeTab);
  const renameTab = useWorkspaceStore((s: WorkspaceState) => s.renameTab);
  const reorderTabs = useWorkspaceStore((s: WorkspaceState) => s.reorderTabs);
  const saveCurrentWorkspace = useWorkspaceStore((s: WorkspaceState) => s.saveCurrentWorkspace);
  const toggleWorkspaceNotes = useWorkspaceStore((s: WorkspaceState) => s.toggleWorkspaceNotes);
  const setWorkspaceNotes = useWorkspaceStore((s: WorkspaceState) => s.setWorkspaceNotes);
  const savedWorkspaces = useWorkspaceStore((s: WorkspaceState) => s.savedWorkspaces);
  const updateSavedWorkspaceNotes = useWorkspaceStore((s: WorkspaceState) => s.updateSavedWorkspaceNotes);

  // Active tab info for right side
  const activeTab = tabs[activeTabId];
  const statements = activeTab?.statements ?? [];
  const focusedStatementId = activeTab?.focusedStatementId;
  const lastSavedAt = activeTab?.lastSavedAt;

  const focusedIndex = focusedStatementId
    ? statements.findIndex((s) => s.id === focusedStatementId)
    : -1;
  const cellPositionText = focusedIndex >= 0
    ? `Cell ${focusedIndex + 1} of ${statements.length}`
    : `${statements.length} statement(s)`;

  // Rename state
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close warning state
  const [closeWarningTabId, setCloseWarningTabId] = useState<string | null>(null);

  // Drag state
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSrcIdx = useRef<number | null>(null);

  // Notes local state
  const [localNotes, setLocalNotes] = useState('');

  useEffect(() => {
    if (renamingTabId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingTabId]);

  // Sync local notes from active tab
  useEffect(() => {
    setLocalNotes(activeTab?.workspaceNotes || '');
  }, [activeTabId, activeTab?.workspaceNotes]);

  const handleNotesSave = useCallback(() => {
    setWorkspaceNotes(localNotes || null);
    // If this workspace is saved, update saved copy too
    if (activeTab) {
      const saved = savedWorkspaces.find(w => w.name === activeTab.workspaceName);
      if (saved) {
        updateSavedWorkspaceNotes(saved.id, localNotes);
      }
    }
  }, [localNotes, setWorkspaceNotes, activeTab, savedWorkspaces, updateSavedWorkspaceNotes]);

  const handleDoubleClick = useCallback((tabId: string) => {
    const tab = tabs[tabId];
    if (!tab) return;
    setRenamingTabId(tabId);
    setRenameValue(tab.workspaceName);
  }, [tabs]);

  const commitRename = useCallback(() => {
    if (renamingTabId && renameValue.trim()) {
      renameTab(renamingTabId, renameValue.trim());
    }
    setRenamingTabId(null);
  }, [renamingTabId, renameValue, renameTab]);

  const handleTabClick = useCallback((tabId: string) => {
    if (renamingTabId) return;
    switchTab(tabId);
  }, [switchTab, renamingTabId]);

  const handleCloseClick = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    const tab = tabs[tabId];
    if (!tab) return;

    // Check for running statements or live streams
    const hasRunning = tab.statements.some(s => s.status === 'RUNNING' || s.status === 'PENDING');
    const hasLiveStreams = tab.backgroundStatements.some(s => s.status === 'RUNNING' || s.status === 'PENDING');

    if (hasRunning || hasLiveStreams) {
      setCloseWarningTabId(tabId);
    } else {
      closeTab(tabId);
    }
  }, [tabs, closeTab]);

  const confirmClose = useCallback(() => {
    if (closeWarningTabId) {
      closeTab(closeWarningTabId);
      setCloseWarningTabId(null);
    }
  }, [closeWarningTabId, closeTab]);

  // Keyboard navigation (arrow keys within tablist)
  const handleKeyDown = useCallback((e: React.KeyboardEvent, tabId: string) => {
    const idx = tabOrder.indexOf(tabId);
    if (idx === -1) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextIdx = e.key === 'ArrowRight'
        ? (idx + 1) % tabOrder.length
        : (idx - 1 + tabOrder.length) % tabOrder.length;
      switchTab(tabOrder[nextIdx]);
      // Focus the new tab
      const tabEl = document.querySelector(`[data-tab-id="${tabOrder[nextIdx]}"]`) as HTMLElement;
      tabEl?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      switchTab(tabOrder[0]);
      (document.querySelector(`[data-tab-id="${tabOrder[0]}"]`) as HTMLElement)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      switchTab(tabOrder[tabOrder.length - 1]);
      (document.querySelector(`[data-tab-id="${tabOrder[tabOrder.length - 1]}"]`) as HTMLElement)?.focus();
    }
  }, [tabOrder, switchTab]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragSrcIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragSrcIdx.current !== null && dragSrcIdx.current !== idx) {
      reorderTabs(dragSrcIdx.current, idx);
    }
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  }, [reorderTabs]);

  const handleDragEnd = useCallback(() => {
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  }, []);

  // Notes panel resize
  const [notesHeight, setNotesHeight] = useState(200);
  const resizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = notesHeight;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startYRef.current - ev.clientY;
      const newHeight = Math.min(Math.max(startHeightRef.current + delta, 80), window.innerHeight * 0.6);
      setNotesHeight(newHeight);
    };

    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [notesHeight]);

  return (
    <>
      {activeTab?.workspaceNotesOpen && (
        <div className="tab-bar__notes-panel" role="region" aria-label="Workspace Notes" style={{ height: notesHeight }}>
          <div className="tab-bar__notes-resize-handle" onMouseDown={onResizeMouseDown} title="Drag to resize" />
          <div className="tab-bar__notes-header">
            <span className="tab-bar__notes-label">Notes</span>
            <button className="tab-bar__notes-close" onClick={toggleWorkspaceNotes} aria-label="Close notes">
              Close
            </button>
          </div>
          <textarea
            className="tab-bar__notes-textarea"
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            onBlur={handleNotesSave}
            onKeyDown={(e) => { if (e.key === 'Escape') { handleNotesSave(); toggleWorkspaceNotes(); } }}
            placeholder="Add notes about this workspace..."
            aria-label="Workspace notes"
          />
        </div>
      )}

      <div className="tab-bar" role="tablist" aria-label="Workspace tabs">
        {tabOrder.map((tabId, idx) => {
          const tab = tabs[tabId];
          if (!tab) return null;
          const isActive = tabId === activeTabId;
          const hasRunning = tab.statements.some(s => s.status === 'RUNNING' || s.status === 'PENDING');
          const hasLiveStreams = tab.backgroundStatements.some(s => s.status === 'RUNNING' || s.status === 'PENDING');

          return (
            <div
              key={tabId}
              role="tab"
              data-tab-id={tabId}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={`tab-bar__tab${dragOverIdx === idx ? ' tab-bar__tab--drag-over' : ''}`}
              onClick={() => handleTabClick(tabId)}
              onDoubleClick={() => handleDoubleClick(tabId)}
              onKeyDown={(e) => handleKeyDown(e, tabId)}
              draggable={renamingTabId !== tabId}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
            >
              {(hasRunning || hasLiveStreams) && (
                <span className="tab-bar__running-dot" title="Has running statements" />
              )}
              {tab.workspaceNotes && (
                <span className="tab-bar__notes-dot" aria-label="Has notes" title="Has notes" />
              )}
              {renamingTabId === tabId ? (
                <input
                  ref={renameInputRef}
                  className="tab-bar__rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                    if (e.key === 'Escape') { e.preventDefault(); setRenamingTabId(null); }
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={80}
                />
              ) : (
                <span className="tab-bar__name" title={tab.workspaceName}>
                  {tab.workspaceName}
                </span>
              )}
              {isActive && (
                <>
                  <button
                    className="tab-bar__save-btn"
                    onClick={(e) => { e.stopPropagation(); saveCurrentWorkspace(tab.workspaceName); }}
                    title="Save workspace (Ctrl+S)"
                    aria-label="Save workspace"
                    tabIndex={0}
                  >
                    <FiSave size={12} />
                  </button>
                  <button
                    className={`tab-bar__notes-btn${tab.workspaceNotesOpen ? ' tab-bar__notes-btn--active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleWorkspaceNotes(); }}
                    title={tab.workspaceNotesOpen ? 'Close notes' : 'Open notes'}
                    aria-label={tab.workspaceNotesOpen ? 'Close notes' : 'Open notes'}
                    tabIndex={0}
                  >
                    <FiEdit3 size={12} />
                  </button>
                </>
              )}
              <button
                className="tab-bar__close"
                aria-label={`Close ${tab.workspaceName}`}
                onClick={(e) => handleCloseClick(e, tabId)}
                tabIndex={-1}
              >
                <FiX size={12} />
              </button>
            </div>
          );
        })}

        <button
          className="tab-bar__add"
          onClick={() => addTab()}
          disabled={tabOrder.length >= MAX_TABS}
          title={tabOrder.length >= MAX_TABS ? 'Tab limit reached (8)' : 'New tab'}
          aria-label="Add new tab"
        >
          <FiPlus size={14} />
        </button>

        <div className="tab-bar__right">
          <span className={focusedIndex >= 0 ? 'cell-count cell-count--focused' : 'cell-count'}>
            {cellPositionText}
          </span>
          {lastSavedAt && (
            <span className="last-saved">
              Last saved at {new Date(lastSavedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Close warning dialog */}
      {closeWarningTabId && (
        <div
          className="tab-close-warning-overlay"
          onClick={() => setCloseWarningTabId(null)}
        >
          <div
            className="tab-close-warning-dialog"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setCloseWarningTabId(null); }}
          >
            <h3>Close tab?</h3>
            <p>
              This tab has running statements or live streams. Closing it will stop them.
            </p>
            <div className="tab-close-warning-actions">
              <button onClick={() => setCloseWarningTabId(null)}>Cancel</button>
              <button onClick={confirmClose}>Close Tab</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
