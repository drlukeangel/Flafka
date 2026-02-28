import React, { useCallback, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { SQLStatement } from '../../types';
import {
  FiPlay,
  FiSquare,
  FiCopy,
  FiTrash2,
  FiChevronDown,
  FiChevronRight,
  FiPlus,
  FiLoader,
  FiAlertCircle,
  FiCheckCircle,
} from 'react-icons/fi';
import ResultsTable from '../ResultsTable/ResultsTable';

interface EditorCellProps {
  statement: SQLStatement;
  index: number;
}

const EditorCell: React.FC<EditorCellProps> = ({ statement, index }) => {
  const {
    updateStatement,
    deleteStatement,
    duplicateStatement,
    toggleStatementCollapse,
    executeStatement,
    cancelStatement,
    addStatement,
  } = useWorkspaceStore();

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editorHeight, setEditorHeight] = useState(100);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // --- Keyboard Shortcuts ---
    editor.addAction({
      id: 'run-statement',
      label: 'Run Statement',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        const s = useWorkspaceStore.getState().statements.find(s => s.id === statement.id);
        if (s && s.status !== 'RUNNING' && s.status !== 'PENDING') {
          executeStatement(statement.id);
        }
      },
    });

    editor.addAction({
      id: 'cancel-statement',
      label: 'Cancel Statement',
      keybindings: [monaco.KeyCode.Escape],
      run: () => {
        const s = useWorkspaceStore.getState().statements.find(s => s.id === statement.id);
        if (s && (s.status === 'RUNNING' || s.status === 'PENDING')) {
          cancelStatement(statement.id);
        }
      },
    });

    // --- Auto-Resize ---
    const updateHeight = (e?: { contentHeight: number }) => {
      const contentHeight = e?.contentHeight ?? editor.getContentHeight();
      const newHeight = Math.min(Math.max(contentHeight, 80), 400);
      setEditorHeight(prev => prev === newHeight ? prev : newHeight);
    };

    const disposable = editor.onDidContentSizeChange(updateHeight);
    editor.onDidDispose(() => disposable.dispose());
    updateHeight();
  };

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        updateStatement(statement.id, value);
      }
    },
    [statement.id, updateStatement]
  );

  const handleRun = () => {
    if (statement.status === 'RUNNING' || statement.status === 'PENDING') {
      cancelStatement(statement.id);
    } else {
      executeStatement(statement.id);
    }
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      deleteStatement(statement.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleDuplicate = () => {
    duplicateStatement(statement.id);
  };

  const handleToggleCollapse = () => {
    toggleStatementCollapse(statement.id);
  };

  const handleAddCell = () => {
    addStatement(undefined, statement.id);
  };

  const isRunning = statement.status === 'RUNNING' || statement.status === 'PENDING';
  const hasResults = statement.results && statement.results.length > 0;
  const hasError = statement.status === 'ERROR';

  const getStatusBadge = () => {
    switch (statement.status) {
      case 'PENDING':
        return (
          <span className="status-badge pending">
            <FiLoader className="animate-spin" size={12} />
            <span>Pending</span>
          </span>
        );
      case 'RUNNING':
        return (
          <span className="status-badge running">
            <span className="status-dot running"></span>
            <span>Running</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="status-badge completed">
            <FiCheckCircle size={12} />
            <span>Completed</span>
          </span>
        );
      case 'ERROR':
        return (
          <span className="status-badge error">
            <FiAlertCircle size={12} />
            <span>Error</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="status-badge cancelled">
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`editor-cell ${statement.isCollapsed ? 'collapsed' : ''}`}>
      <div className={`cell-header ${showDeleteConfirm ? 'confirming-delete' : ''}`}>
        <div className="cell-header-left">
          <button
            className="icon-btn add-btn"
            onClick={handleAddCell}
            title="Insert cell below"
          >
            <FiPlus size={16} />
          </button>
          <span className="cell-number">#{index + 1}</span>
        </div>

        <div className="cell-header-center">
          {getStatusBadge()}
          {statement.executionTime && (
            <span className="execution-time">
              {(statement.executionTime / 1000).toFixed(2)}s
            </span>
          )}
          {hasResults && (
            <span className="results-count">
              {statement.totalRowsReceived && statement.totalRowsReceived > (statement.results?.length || 0)
                ? `${statement.results?.length} of ${statement.totalRowsReceived.toLocaleString()} rows`
                : `${statement.results?.length} rows`}
            </span>
          )}
        </div>

        <div className="cell-header-right">
          <button
            className="icon-btn"
            onClick={handleDuplicate}
            title="Duplicate statement"
          >
            <FiCopy size={14} />
          </button>
          {showDeleteConfirm ? (
            <div className="delete-confirm">
              <button className="confirm-yes" onClick={handleDelete}>Delete</button>
              <button className="confirm-no" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          ) : (
            <button
              className="icon-btn delete-btn"
              onClick={handleDelete}
              title="Delete statement"
            >
              <FiTrash2 size={14} />
            </button>
          )}
          <button
            className={`run-btn ${isRunning ? 'running' : ''}`}
            onClick={handleRun}
            disabled={statement.status === 'PENDING'}
          >
            {isRunning ? (
              <>
                <FiSquare size={14} />
                <span>Stop</span>
              </>
            ) : (
              <>
                <FiPlay size={14} />
                <span>Run</span>
              </>
            )}
          </button>
          <button
            className="icon-btn collapse-btn"
            onClick={handleToggleCollapse}
            title={statement.isCollapsed ? 'Expand' : 'Collapse'}
          >
            {statement.isCollapsed ? (
              <FiChevronRight size={16} />
            ) : (
              <FiChevronDown size={16} />
            )}
          </button>
        </div>
      </div>

      {!statement.isCollapsed && (
        <>
          <div className="cell-editor">
            <Editor
              height={`${editorHeight}px`}
              defaultLanguage="sql"
              value={statement.code}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                folding: true,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
                renderLineHighlight: 'line',
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'auto',
                  verticalScrollbarSize: 10,
                  alwaysConsumeMouseWheel: false,
                },
              }}
            />
          </div>

          {hasError && statement.error && (
            <div className="cell-error">
              <FiAlertCircle size={16} />
              <span>{statement.error}</span>
            </div>
          )}

          {hasResults && (
            <div className="cell-results">
              <ResultsTable
                data={statement.results || []}
                columns={statement.columns || []}
                totalRowsReceived={statement.totalRowsReceived}
              />
            </div>
          )}
        </>
      )}

      {statement.isCollapsed && (
        <div className="cell-collapsed-preview">
          <code>{statement.code.split('\n')[0].substring(0, 80)}...</code>
        </div>
      )}
    </div>
  );
};

export default EditorCell;
