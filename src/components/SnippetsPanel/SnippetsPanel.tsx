// Phase 12.6 — F6: Query Templates / Saved SQL Snippets Library
import React, { useState, useRef, useMemo } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { editorRegistry } from '../EditorCell/editorRegistry';
import { FiSearch, FiBookmark, FiTrash2, FiEdit2, FiCheck, FiX, FiPlay, FiLock } from 'react-icons/fi';
import type { Snippet } from '../../types';

const MAX_SNIPPETS = 100;

const BUILT_IN_SNIPPETS: Snippet[] = [
  {
    id: 'builtin-hello-world',
    name: 'Hello World',
    sql: 'SELECT 1;',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    builtIn: true,
  },
  {
    id: 'builtin-show-functions',
    name: 'Show Functions',
    sql: 'SHOW FUNCTIONS;',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    builtIn: true,
  },
  {
    id: 'builtin-create-java-udf',
    name: 'Create Java UDF',
    sql: `CREATE FUNCTION my_java_udf
  AS '<entry-class>'
  USING JAR 'confluent-artifact://<artifact-id>/<version-id>';`,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    builtIn: true,
  },
  {
    id: 'builtin-create-python-udf',
    name: 'Create Python UDF',
    sql: `-- Note: USING JAR works for both Java and Python artifacts
CREATE FUNCTION my_python_udf
  AS '<entry-class>'
  USING JAR 'confluent-artifact://<artifact-id>/<version-id>';`,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    builtIn: true,
  },
];

export function SnippetsPanel() {
  const snippets = useWorkspaceStore((s) => s.snippets);
  const addSnippet = useWorkspaceStore((s) => s.addSnippet);
  const deleteSnippet = useWorkspaceStore((s) => s.deleteSnippet);
  const renameSnippet = useWorkspaceStore((s) => s.renameSnippet);
  const addStatement = useWorkspaceStore((s) => s.addStatement);
  const focusedStatementId = useWorkspaceStore((s) => s.focusedStatementId);
  const addToast = useWorkspaceStore((s) => s.addToast);

  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameCancelledRef = useRef(false);

  // Track hidden/renamed built-in snippets (persisted in localStorage)
  const [hiddenBuiltIns, setHiddenBuiltIns] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('flafka-hidden-builtins') || '[]');
    } catch { return []; }
  });
  const [builtInOverrides, setBuiltInOverrides] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('flafka-builtin-overrides') || '{}');
    } catch { return {}; }
  });

  // Save-as-snippet dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveNameValue, setSaveNameValue] = useState('');
  const [saveSqlValue, setSaveSqlValue] = useState('');
  const [saveError, setSaveError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Merge built-in snippets (with overrides applied, hidden ones filtered) with user snippets
  const allSnippets = useMemo(() => {
    const visibleBuiltIns = BUILT_IN_SNIPPETS
      .filter((s) => !hiddenBuiltIns.includes(s.id))
      .map((s) => builtInOverrides[s.id] ? { ...s, name: builtInOverrides[s.id] } : s);
    return [...visibleBuiltIns, ...snippets];
  }, [snippets, hiddenBuiltIns, builtInOverrides]);

  const filtered = allSnippets.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.sql.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBuiltIn = filtered.filter((s) => s.builtIn);
  const filteredUser = filtered.filter((s) => !s.builtIn);

  // Open save dialog, pre-filling SQL from focused editor if available
  const handleOpenSaveDialog = () => {
    let sql = '';
    if (focusedStatementId) {
      const editor = editorRegistry.get(focusedStatementId);
      if (editor) {
        sql = editor.getValue().trim();
      }
    }
    setSaveSqlValue(sql);
    setSaveNameValue('');
    setSaveError('');
    setSaveDialogOpen(true);
    requestAnimationFrame(() => {
      dialogRef.current?.showModal?.();
    });
  };

  const handleCloseSaveDialog = () => {
    setSaveDialogOpen(false);
    dialogRef.current?.close?.();
  };

  const handleSaveSnippet = () => {
    const name = saveNameValue.trim();
    const sql = saveSqlValue.trim();
    if (!name) {
      setSaveError('Name is required.');
      return;
    }
    if (!sql) {
      setSaveError('SQL is required.');
      return;
    }
    const result = addSnippet(name, sql);
    if (!result.success) {
      setSaveError(result.error ?? 'Failed to save snippet.');
      return;
    }
    handleCloseSaveDialog();
    addToast({ type: 'success', message: `Snippet "${name}" saved.` });
  };

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveSnippet();
    } else if (e.key === 'Escape') {
      handleCloseSaveDialog();
    }
  };

  // Insert snippet into focused editor, or create new statement
  const handleInsertSnippet = (sql: string) => {
    if (focusedStatementId) {
      const editor = editorRegistry.get(focusedStatementId);
      if (editor) {
        const selection = editor.getSelection();
        if (selection) {
          editor.executeEdits('snippet-insert', [{ range: selection, text: sql }]);
          editor.focus();
          addToast({ type: 'success', message: 'Snippet inserted.', duration: 2000 });
          return;
        }
      }
    }
    // No focused editor — create a new statement with the snippet SQL
    addStatement(sql);
    addToast({ type: 'success', message: 'Snippet added as new statement.', duration: 2000 });
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
      // Check if this is a built-in snippet
      if (BUILT_IN_SNIPPETS.some((s) => s.id === id)) {
        const updated = { ...builtInOverrides, [id]: trimmed };
        setBuiltInOverrides(updated);
        localStorage.setItem('flafka-builtin-overrides', JSON.stringify(updated));
      } else {
        renameSnippet(id, trimmed);
      }
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

  const handleDeleteBuiltIn = (id: string) => {
    const snippet = BUILT_IN_SNIPPETS.find((s) => s.id === id);
    const updated = [...hiddenBuiltIns, id];
    setHiddenBuiltIns(updated);
    localStorage.setItem('flafka-hidden-builtins', JSON.stringify(updated));
    if (snippet) {
      addToast({ type: 'info', message: `Snippet "${builtInOverrides[id] || snippet.name}" deleted.`, duration: 2000 });
    }
  };

  return (
    <div className="snippets-panel" role="region" aria-label="SQL Snippets Library">
      {/* Header */}
      <div className="snippets-panel-header">
        <div className="snippets-panel-title">
          <FiBookmark size={16} style={{ color: 'var(--color-primary)' }} />
          <span>Snippets</span>
          <span className="snippets-count-badge">{snippets.length}/{MAX_SNIPPETS}</span>
        </div>
        <button
          className="snippets-save-btn"
          onClick={handleOpenSaveDialog}
          disabled={snippets.length >= MAX_SNIPPETS}
          title={snippets.length >= MAX_SNIPPETS ? 'Snippet limit reached (100)' : 'Save new snippet'}
          aria-label="Save new snippet"
        >
          + Save Snippet
        </button>
      </div>

      {/* Search */}
      <div className="snippets-search">
        <FiSearch size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search snippets..."
          aria-label="Search snippets"
          className="snippets-search-input"
        />
        {search && (
          <button
            className="snippets-search-clear"
            onClick={() => setSearch('')}
            aria-label="Clear search"
          >
            <FiX size={12} />
          </button>
        )}
      </div>

      {/* Snippet List */}
      <div
        className="snippets-list-container"
        aria-live="polite"
        aria-label="Snippet list"
      >
        {filtered.length === 0 ? (
          <div className="snippets-empty-state" role="status">
            <p className="snippets-empty-title">No snippets match your search.</p>
          </div>
        ) : (
          <>
            {/* Built-in snippets section */}
            {filteredBuiltIn.length > 0 && (
              <>
                <div style={{
                  padding: '4px 12px 3px',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  color: 'var(--color-text-tertiary)',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <FiLock size={10} />
                  Built-in
                </div>
                <ul className="snippets-list" role="list">
                  {filteredBuiltIn.map((snippet) => (
                    <li key={snippet.id} className="snippet-item" role="listitem">
                      <div className="snippet-item-header">
                        {renamingId === snippet.id ? (
                          <input
                            className="snippet-rename-input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => handleRenameKeyDown(e, snippet.id)}
                            onBlur={() => handleRenameBlur(snippet.id)}
                            autoFocus
                            maxLength={80}
                            aria-label="Rename snippet"
                          />
                        ) : (
                          <span className="snippet-name" title={snippet.name}>
                            {snippet.name}
                          </span>
                        )}
                        <div className="snippet-actions">
                          {renamingId === snippet.id ? (
                            <>
                              <button
                                className="snippet-action-btn snippet-action-btn--confirm"
                                onClick={() => handleCommitRename(snippet.id)}
                                title="Save rename"
                                aria-label="Save rename"
                              >
                                <FiCheck size={12} />
                              </button>
                              <button
                                className="snippet-action-btn"
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
                                className="snippet-action-btn"
                                onClick={() => handleInsertSnippet(snippet.sql)}
                                title="Insert into editor"
                                aria-label={`Insert snippet ${snippet.name}`}
                              >
                                <FiPlay size={12} />
                              </button>
                              <button
                                className="snippet-action-btn"
                                onClick={() => handleStartRename(snippet.id, snippet.name)}
                                title="Rename snippet"
                                aria-label={`Rename snippet ${snippet.name}`}
                              >
                                <FiEdit2 size={12} />
                              </button>
                              <button
                                className="snippet-action-btn snippet-action-btn--danger"
                                onClick={() => handleDeleteBuiltIn(snippet.id)}
                                title="Delete snippet"
                                aria-label={`Delete snippet ${snippet.name}`}
                              >
                                <FiTrash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <pre className="snippet-sql-preview">{snippet.sql.length > 200 ? snippet.sql.slice(0, 200) + '...' : snippet.sql}</pre>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* User snippets section */}
            {filteredUser.length > 0 && (
              <>
                {filteredBuiltIn.length > 0 && (
                  <div style={{
                    padding: '4px 12px 3px',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--color-text-tertiary)',
                    borderBottom: '1px solid var(--color-border)',
                    marginTop: 6,
                  }}>
                    Your Snippets
                  </div>
                )}
                <ul className="snippets-list" role="list">
                  {filteredUser.map((snippet) => (
                    <li key={snippet.id} className="snippet-item" role="listitem">
                      <div className="snippet-item-header">
                        {renamingId === snippet.id ? (
                          <input
                            className="snippet-rename-input"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => handleRenameKeyDown(e, snippet.id)}
                            onBlur={() => handleRenameBlur(snippet.id)}
                            autoFocus
                            maxLength={80}
                            aria-label="Rename snippet"
                          />
                        ) : (
                          <span
                            className="snippet-name"
                            title={snippet.name}
                          >
                            {snippet.name}
                          </span>
                        )}
                        <div className="snippet-actions">
                          {renamingId === snippet.id ? (
                            <>
                              <button
                                className="snippet-action-btn snippet-action-btn--confirm"
                                onClick={() => handleCommitRename(snippet.id)}
                                title="Save rename"
                                aria-label="Save rename"
                              >
                                <FiCheck size={12} />
                              </button>
                              <button
                                className="snippet-action-btn"
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
                                className="snippet-action-btn"
                                onClick={() => handleInsertSnippet(snippet.sql)}
                                title="Insert into editor"
                                aria-label={`Insert snippet ${snippet.name}`}
                              >
                                <FiPlay size={12} />
                              </button>
                              <button
                                className="snippet-action-btn"
                                onClick={() => handleStartRename(snippet.id, snippet.name)}
                                title="Rename snippet"
                                aria-label={`Rename snippet ${snippet.name}`}
                              >
                                <FiEdit2 size={12} />
                              </button>
                              <button
                                className="snippet-action-btn snippet-action-btn--danger"
                                onClick={() => {
                                  deleteSnippet(snippet.id);
                                  addToast({ type: 'info', message: `Snippet "${snippet.name}" deleted.`, duration: 2000 });
                                }}
                                title="Delete snippet"
                                aria-label={`Delete snippet ${snippet.name}`}
                              >
                                <FiTrash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <pre className="snippet-sql-preview">{snippet.sql.length > 200 ? snippet.sql.slice(0, 200) + '...' : snippet.sql}</pre>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Empty state for user snippets when only built-ins match */}
            {filteredUser.length === 0 && filteredBuiltIn.length > 0 && snippets.length === 0 && !search && (
              <div className="snippets-empty-state" role="status" style={{ paddingTop: 12 }}>
                <p className="snippets-empty-hint">
                  Click <strong>Save Snippet</strong> to save frequently used SQL queries.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Save Snippet Dialog (ARIA modal) */}
      {saveDialogOpen && (
        <div
          className="snippets-dialog-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseSaveDialog();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCloseSaveDialog();
          }}
        >
          <dialog
            ref={dialogRef}
            className="snippets-dialog"
            aria-modal="true"
            aria-labelledby="snippet-dialog-title"
            open
          >
            <div className="snippets-dialog-header">
              <span id="snippet-dialog-title" className="snippets-dialog-title">Save Snippet</span>
              <button
                className="snippets-dialog-close"
                onClick={handleCloseSaveDialog}
                aria-label="Close dialog"
              >
                <FiX size={16} />
              </button>
            </div>

            <div className="snippets-dialog-body" onKeyDown={handleSaveKeyDown}>
              <div className="snippets-dialog-field">
                <label htmlFor="snippet-name-input" className="snippets-dialog-label">
                  Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="snippet-name-input"
                  type="text"
                  value={saveNameValue}
                  onChange={(e) => { setSaveNameValue(e.target.value); setSaveError(''); }}
                  placeholder="e.g. Select latest events"
                  className="snippets-dialog-input"
                  maxLength={80}
                  autoFocus
                  aria-required="true"
                  aria-describedby={saveError ? 'snippet-save-error' : undefined}
                />
              </div>
              <div className="snippets-dialog-field">
                <label htmlFor="snippet-sql-input" className="snippets-dialog-label">
                  SQL <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="snippet-sql-input"
                  value={saveSqlValue}
                  onChange={(e) => { setSaveSqlValue(e.target.value); setSaveError(''); }}
                  placeholder="SELECT * FROM my_table LIMIT 10"
                  className="snippets-dialog-textarea"
                  rows={6}
                  aria-required="true"
                  aria-describedby={saveError ? 'snippet-save-error' : undefined}
                />
              </div>
              {saveError && (
                <p id="snippet-save-error" className="snippets-dialog-error" role="alert">
                  {saveError}
                </p>
              )}
            </div>

            <div className="snippets-dialog-footer">
              <button
                className="snippets-dialog-btn snippets-dialog-btn--cancel"
                onClick={handleCloseSaveDialog}
              >
                Cancel
              </button>
              <button
                className="snippets-dialog-btn snippets-dialog-btn--save"
                onClick={handleSaveSnippet}
                disabled={!saveNameValue.trim() || !saveSqlValue.trim()}
              >
                Save
              </button>
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
