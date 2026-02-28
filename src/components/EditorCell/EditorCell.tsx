import React, { useCallback, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { SQLStatement, TreeNode, Column } from '../../types';
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
  FiRefreshCw,
  FiMoreVertical,
} from 'react-icons/fi';
import ResultsTable from '../ResultsTable/ResultsTable';

// ---------------------------------------------------------------------------
// SQL Autocomplete - module-level disposable (prevents duplicate providers on HMR)
// ---------------------------------------------------------------------------

let completionProviderDisposable: monaco.IDisposable | null = null;

// Flink-specific keywords not already handled by Monaco's built-in SQL mode
const FLINK_KEYWORDS: string[] = [
  'TUMBLE',
  'HOP',
  'CUMULATE',
  'SESSION',
  'MATCH_RECOGNIZE',
  'WATERMARK',
  'LATERAL TABLE',
  'PROCTIME()',
  'ROWTIME()',
  'CURRENT_WATERMARK',
  'SHOW CATALOGS',
  'SHOW DATABASES',
  'SHOW TABLES',
  'SHOW VIEWS',
  'SHOW JOBS',
  'SET',
  'RESET',
  'EXPLAIN',
  'CALL',
  'EXECUTE STATEMENT SET',
  'END',
  'DESCRIPTOR',
  'TABLESAMPLE',
];

/**
 * Recursively walk treeNodes and collect completion items for tables and views.
 * Nodes of type 'table' and 'externalTable' → CompletionItemKind.Class
 * Nodes of type 'view' → CompletionItemKind.Interface
 */
function extractTableCompletions(
  nodes: TreeNode[],
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  const items: monaco.languages.CompletionItem[] = [];

  const walk = (nodeList: TreeNode[], parentDb?: string) => {
    for (const node of nodeList) {
      if (node.type === 'table' || node.type === 'externalTable') {
        const label = parentDb ? `${parentDb}.${node.name}` : node.name;
        items.push({
          label,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: label,
          detail: node.type === 'externalTable' ? 'External Table' : 'Table',
          range,
        });
      } else if (node.type === 'view') {
        const label = parentDb ? `${parentDb}.${node.name}` : node.name;
        items.push({
          label,
          kind: monaco.languages.CompletionItemKind.Interface,
          insertText: label,
          detail: 'View',
          range,
        });
      }

      if (node.children && node.children.length > 0) {
        // Pass the database name down when descending from a database node
        const nextDb = node.type === 'database' ? node.name : parentDb;
        walk(node.children, nextDb);
      }
    }
  };

  walk(nodes);
  return items;
}

/**
 * Extract column completion items from a cached table schema.
 */
function extractColumnCompletions(
  columns: Column[],
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return columns.map(col => ({
    label: col.name,
    kind: monaco.languages.CompletionItemKind.Field,
    insertText: col.name,
    detail: col.type ?? 'column',
    range,
  }));
}

// ---------------------------------------------------------------------------

interface EditorCellProps {
  statement: SQLStatement;
  index: number;
}

const getPreviewLine = (code: string): string => {
  const lines = code.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('--')) {
      return trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
    }
  }
  return code.trim().slice(0, 60) || '(empty)';
};

const EditorCell: React.FC<EditorCellProps> = ({ statement, index }) => {
  const {
    updateStatement,
    deleteStatement,
    duplicateStatement,
    toggleStatementCollapse,
    executeStatement,
    cancelStatement,
    addStatement,
    reorderStatements,
  } = useWorkspaceStore();

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editorHeight, setEditorHeight] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState<'top' | 'bottom' | null>(null);

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

    // --- SQL Autocomplete Provider ---
    // Dispose any previous registration (handles Vite HMR re-mounts)
    if (completionProviderDisposable) {
      completionProviderDisposable.dispose();
      completionProviderDisposable = null;
    }

    completionProviderDisposable = monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems(
        model: monaco.editor.ITextModel,
        position: monaco.Position
      ) {
        try {
          const word = model.getWordUntilPosition(position);
          const range: monaco.IRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const state = useWorkspaceStore.getState();
          const treeNodes = state.treeNodes ?? [];
          const selectedTableSchema = state.selectedTableSchema ?? [];

          const keywordItems: monaco.languages.CompletionItem[] = FLINK_KEYWORDS.map(kw => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            detail: 'Flink SQL keyword',
            range,
          }));

          const tableItems = extractTableCompletions(treeNodes, range);
          const columnItems = extractColumnCompletions(selectedTableSchema, range);

          return { suggestions: [...keywordItems, ...tableItems, ...columnItems] };
        } catch {
          return { suggestions: [] };
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

  const handleDragStart = (e: React.DragEvent<HTMLSpanElement>) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDragOver(e.clientY < midY ? 'top' : 'bottom');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if leaving the cell entirely (not entering a child)
    if (!cellRef.current?.contains(e.relatedTarget as Node)) {
      setDragOver(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(fromIndex)) return;

    let toIndex = index;
    if (dragOver === 'bottom') {
      toIndex = index + 1;
    }
    // Adjust for the fact that removing fromIndex shifts indices
    if (fromIndex < toIndex) {
      toIndex -= 1;
    }

    setDragOver(null);
    reorderStatements(fromIndex, toIndex);
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
            <span className="status-dot running" role="img" aria-label="RUNNING"></span>
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

  const cellClassName = [
    'editor-cell',
    statement.isCollapsed ? 'collapsed' : '',
    isDragging ? 'dragging' : '',
    dragOver === 'top' ? 'drag-over-top' : '',
    dragOver === 'bottom' ? 'drag-over-bottom' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={cellRef}
      className={cellClassName}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`cell-header ${showDeleteConfirm ? 'confirming-delete' : ''}`}>
        <div className="cell-header-left">
          <span
            className="drag-handle"
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            title="Drag to reorder"
          >
            <FiMoreVertical size={16} />
          </span>
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

          {statement.startedAt && (
            <div className="statement-status-bar">
              <div className="status-bar-item">
                <span className="status-bar-label">START TIME:</span>
                <span>{statement.startedAt.toLocaleTimeString()}</span>
              </div>
              <div className="status-bar-item">
                <span className="status-bar-label">STATUS:</span>
                <span className={`status-dot ${statement.status.toLowerCase()}`} role="img" aria-label={statement.status}></span>
                <span>{statement.status}</span>
              </div>
              {statement.statementName && (
                <div className="status-bar-item">
                  <span className="status-bar-label">STATEMENT:</span>
                  <span className="statement-name">{statement.statementName}</span>
                </div>
              )}
            </div>
          )}

          {hasError && statement.error && (
            <div className="cell-error">
              <FiAlertCircle size={16} />
              <span>{statement.error}</span>
              <button
                className="retry-btn"
                onClick={() => executeStatement(statement.id)}
                title="Retry this statement"
              >
                <FiRefreshCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {statement.status === 'CANCELLED' && !hasError && (
            <div className="cell-cancelled">
              <span>Statement was cancelled.</span>
              <button
                className="retry-btn"
                onClick={() => executeStatement(statement.id)}
                title="Retry this statement"
              >
                <FiRefreshCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {hasResults && (
            <div className="cell-results">
              <ResultsTable
                data={statement.results || []}
                columns={statement.columns || []}
                totalRowsReceived={statement.totalRowsReceived}
                statementIndex={index}
                statementName={statement.statementName}
              />
            </div>
          )}
        </>
      )}

      {statement.isCollapsed && (
        <div className="cell-collapsed-preview">
          <code className="cell-collapsed-sql">{getPreviewLine(statement.code)}</code>
          {getStatusBadge()}
          {hasResults && (
            <span className="cell-collapsed-rows">
              ({statement.totalRowsReceived != null && statement.totalRowsReceived > (statement.results?.length ?? 0)
                ? `${statement.totalRowsReceived.toLocaleString()}`
                : statement.results?.length} rows)
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorCell;
