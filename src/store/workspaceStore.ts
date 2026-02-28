import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as flinkApi from '../api/flink-api';
import { env } from '../config/environment';
import type { SQLStatement, StatementStatus, TreeNode, Column, Toast } from '../types';

interface WorkspaceState {
  // Catalog & Database
  catalog: string;
  database: string;
  catalogs: string[];
  databases: string[];

  // Tree Navigator
  treeNodes: TreeNode[];
  selectedNodeId: string | null;
  treeLoading: boolean;

  // Schema Panel
  selectedTableSchema: Column[];
  selectedTableName: string | null;
  schemaLoading: boolean;

  // Statements
  statements: SQLStatement[];

  // UI State
  toasts: Toast[];
  sidebarCollapsed: boolean;

  // Persistence
  lastSavedAt: string | null;

  // Compute Pool Status (runtime only, not persisted)
  computePoolPhase: string | null;
  computePoolCfu: number | null;

  // Actions
  setCatalog: (catalog: string) => void;
  setDatabase: (database: string) => void;
  loadCatalogs: () => Promise<void>;
  loadDatabases: (catalog: string) => Promise<void>;
  loadTreeData: () => Promise<void>;
  toggleTreeNode: (nodeId: string) => void;
  selectTreeNode: (nodeId: string) => void;
  loadTreeNodeChildren: (nodeId: string) => Promise<void>;
  loadTableSchema: (catalog: string, database: string, tableName: string) => Promise<void>;

  addStatement: (code?: string, afterId?: string) => void;
  updateStatement: (id: string, code: string) => void;
  deleteStatement: (id: string) => void;
  duplicateStatement: (id: string) => void;
  toggleStatementCollapse: (id: string) => void;

  executeStatement: (id: string) => Promise<void>;
  cancelStatement: (id: string) => Promise<void>;
  runAllStatements: () => Promise<void>;

  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleSidebar: () => void;
  loadComputePoolStatus: () => Promise<void>;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      // Initial State
      catalog: env.flinkCatalog,
      database: env.flinkDatabase,
      catalogs: [env.flinkCatalog],
      databases: [env.flinkDatabase],

      treeNodes: [],
      selectedNodeId: null,
      treeLoading: false,

      selectedTableSchema: [],
      selectedTableName: null,
      schemaLoading: false,

      statements: [
        {
          id: generateId(),
          code: `SELECT * FROM \`${env.flinkCatalog}\`.\`${env.flinkDatabase}\`.\`EOT-PLATFORM-EXAMPLES-LOANS-v1\`;`,
          status: 'IDLE',
          createdAt: new Date(),
        },
      ],

      toasts: [],
      sidebarCollapsed: false,

      lastSavedAt: null,

      computePoolPhase: null,
      computePoolCfu: null,

      // Catalog & Database Actions
      setCatalog: (catalog) => {
        set({ catalog });
        get().loadDatabases(catalog);
        get().loadTreeData();
      },

      setDatabase: (database) => {
        set({ database });
        get().loadTreeData();
      },

      loadCatalogs: async () => {
        try {
          const catalogs = await flinkApi.getCatalogs();
          set({ catalogs });
        } catch (error) {
          console.error('Failed to load catalogs:', error);
          get().addToast({ type: 'error', message: 'Failed to load catalogs' });
        }
      },

      loadDatabases: async (catalog) => {
        try {
          const databases = await flinkApi.getDatabases(catalog);
          set({ databases });
        } catch (error) {
          console.error('Failed to load databases:', error);
          get().addToast({ type: 'error', message: 'Failed to load databases' });
        }
      },

      // Tree Navigator Actions
      loadTreeData: async () => {
        const { catalog, database } = get();
        set({ treeLoading: true });

        try {
          const [tables, views, functions] = await Promise.all([
            flinkApi.getTables(catalog, database),
            flinkApi.getViews(catalog, database),
            flinkApi.getFunctions(catalog, database),
          ]);

          const treeNodes: TreeNode[] = [
            {
              id: `${catalog}`,
              name: catalog,
              type: 'catalog',
              isExpanded: true,
              children: [
                {
                  id: `${catalog}.${database}`,
                  name: database,
                  type: 'database',
                  isExpanded: true,
                  metadata: { catalog },
                  children: [
                    {
                      id: `${catalog}.${database}.tables`,
                      name: 'Tables',
                      type: 'tables',
                      isExpanded: true,
                      metadata: { catalog, database },
                      children: tables.map((tableName) => ({
                        id: `${catalog}.${database}.table.${tableName}`,
                        name: tableName,
                        type: 'table' as const,
                        metadata: { catalog, database },
                      })),
                    },
                    {
                      id: `${catalog}.${database}.views`,
                      name: 'Views',
                      type: 'views',
                      isExpanded: false,
                      metadata: { catalog, database },
                      children: views.map((viewName) => ({
                        id: `${catalog}.${database}.view.${viewName}`,
                        name: viewName,
                        type: 'view' as const,
                        metadata: { catalog, database },
                      })),
                    },
                    {
                      id: `${catalog}.${database}.models`,
                      name: 'Models',
                      type: 'models',
                      isExpanded: false,
                      metadata: { catalog, database },
                      children: [],
                    },
                    {
                      id: `${catalog}.${database}.functions`,
                      name: 'Functions',
                      type: 'functions',
                      isExpanded: false,
                      metadata: { catalog, database },
                      children: functions.map((funcName) => ({
                        id: `${catalog}.${database}.function.${funcName}`,
                        name: funcName,
                        type: 'function' as const,
                        metadata: { catalog, database },
                      })),
                    },
                    {
                      id: `${catalog}.${database}.externalTables`,
                      name: 'External tables',
                      type: 'externalTables',
                      isExpanded: false,
                      metadata: { catalog, database },
                      children: [],
                    },
                  ],
                },
              ],
            },
          ];

          set({ treeNodes, treeLoading: false });
        } catch (error) {
          console.error('Failed to load tree data:', error);
          set({ treeLoading: false });
          get().addToast({ type: 'error', message: 'Failed to load database objects' });
        }
      },

      toggleTreeNode: (nodeId) => {
        set((state) => ({
          treeNodes: toggleNodeExpanded(state.treeNodes, nodeId),
        }));
      },

      selectTreeNode: (nodeId) => {
        set({ selectedNodeId: nodeId });
        const node = findNodeById(get().treeNodes, nodeId);
        if (node && (node.type === 'table' || node.type === 'view')) {
          const catalog = node.metadata?.catalog;
          const database = node.metadata?.database;
          if (catalog && database) {
            set({ selectedTableName: node.name });
            get().loadTableSchema(catalog, database, node.name);
          }
        } else {
          set({ selectedTableName: null, selectedTableSchema: [] });
        }
      },

      loadTreeNodeChildren: async (nodeId) => {
        console.log('Load children for:', nodeId);
      },

      loadTableSchema: async (catalog, database, tableName) => {
        set({ schemaLoading: true, selectedTableSchema: [] });
        try {
          const schema = await flinkApi.getTableSchema(catalog, database, tableName);
          set({ selectedTableSchema: schema, schemaLoading: false });
        } catch (error) {
          console.error('Failed to load table schema:', error);
          set({ schemaLoading: false });
        }
      },

      // Statement Actions
      addStatement: (code, afterId) => {
        const { catalog, database } = get();
        const newStatement: SQLStatement = {
          id: generateId(),
          code: code || `-- Write your Flink SQL query here\nSELECT * FROM \`${catalog}\`.\`${database}\`.<table_name> LIMIT 10;`,
          status: 'IDLE',
          createdAt: new Date(),
        };
        set((state) => {
          if (afterId) {
            const index = state.statements.findIndex((s) => s.id === afterId);
            if (index !== -1) {
              const newStatements = [...state.statements];
              newStatements.splice(index + 1, 0, newStatement);
              return { statements: newStatements, lastSavedAt: new Date().toISOString() };
            }
          }
          return { statements: [...state.statements, newStatement], lastSavedAt: new Date().toISOString() };
        });
      },

      updateStatement: (id, code) => {
        set((state) => ({
          statements: state.statements.map((s) =>
            s.id === id ? { ...s, code, updatedAt: new Date() } : s
          ),
          lastSavedAt: new Date().toISOString(),
        }));
      },

      deleteStatement: (id) => {
        set((state) => {
          const newStatements = state.statements.filter((s) => s.id !== id);
          return {
            statements: newStatements.length > 0 ? newStatements : [{
              id: generateId(),
              code: '-- Write your Flink SQL query here',
              status: 'IDLE' as const,
              createdAt: new Date(),
            }],
            lastSavedAt: new Date().toISOString(),
          };
        });
        get().addToast({ type: 'success', message: 'Statement deleted' });
      },

      duplicateStatement: (id) => {
        const statement = get().statements.find((s) => s.id === id);
        if (!statement) return;

        const newStatement: SQLStatement = {
          ...statement,
          id: generateId(),
          status: 'IDLE',
          results: undefined,
          error: undefined,
          statementName: undefined,
          startedAt: undefined,
          createdAt: new Date(),
        };

        set((state) => ({
          statements: [...state.statements, newStatement],
          lastSavedAt: new Date().toISOString(),
        }));
      },

      toggleStatementCollapse: (id) => {
        set((state) => ({
          statements: state.statements.map((s) =>
            s.id === id ? { ...s, isCollapsed: !s.isCollapsed } : s
          ),
        }));
      },

      // Execution Actions
      executeStatement: async (id) => {
        const statement = get().statements.find((s) => s.id === id);
        if (!statement) return;

        // Update status to PENDING
        set((state) => ({
          statements: state.statements.map((s) =>
            s.id === id ? { ...s, status: 'PENDING' as StatementStatus, error: undefined, results: undefined, startedAt: new Date() } : s
          ),
        }));

        const startTime = Date.now();

        try {
          // Execute the SQL
          const result = await flinkApi.executeSQL(statement.code);
          const statementName = result.name;

          // Update with statement name and RUNNING status
          set((state) => ({
            statements: state.statements.map((s) =>
              s.id === id ? { ...s, status: 'RUNNING' as StatementStatus, statementName } : s
            ),
          }));

          // Poll for results continuously.
          // The Confluent API uses long-polling cursors: you call the same cursor URL
          // repeatedly and each call returns the next batch of new rows.
          const maxAttempts = 600; // 10 minutes for streaming queries
          let attempts = 0;
          let nextCursor: string | undefined;
          const MAX_ROWS = 5000;
          let allResults: Record<string, unknown>[] = [];
          let totalRowsReceived = 0;
          let columns: Column[] = [];
          const poll = async (): Promise<void> => {
            if (attempts >= maxAttempts) {
              throw new Error('Query timeout');
            }

            // Check if this statement was cancelled or re-executed
            const currentStatement = get().statements.find((s) => s.id === id);
            if (currentStatement?.status === 'CANCELLED') {
              return;
            }

            const status = await flinkApi.getStatementStatus(statementName);
            const phase = status.status?.phase;

            if (phase === 'FAILED') {
              throw new Error(status.status?.detail || 'Query failed');
            }

            if (phase === 'CANCELLED') {
              return;
            }

            // Extract column names from traits.schema on first successful status check
            if (columns.length === 0 && status.status?.traits?.schema?.columns) {
              columns = status.status.traits.schema.columns.map((col) => ({
                name: col.name,
                type: col.type?.type || 'STRING',
                nullable: col.type?.nullable,
              }));
            }

            // Fetch results for both COMPLETED and RUNNING states
            if (phase === 'COMPLETED' || phase === 'RUNNING') {
              try {
                const resultsData = await flinkApi.getStatementResults(statementName, nextCursor);
                const rawRows = resultsData.results?.data || [];
                const rows = rawRows.map((item) => item.row || []);

                if (rows.length > 0) {
                  // If we still don't have columns from schema, derive from data
                  if (columns.length === 0) {
                    const firstRow = rows[0];
                    columns = firstRow.map((_: unknown, idx: number) => ({
                      name: `col_${idx}`,
                      type: 'STRING',
                    }));
                  }

                  // Convert and append all rows from this batch
                  const newResults = rows.map((row: unknown[]) => {
                    const obj: Record<string, unknown> = {};
                    row.forEach((val, idx) => {
                      const colName = columns[idx]?.name || `col_${idx}`;
                      obj[colName] = val;
                    });
                    return obj;
                  });

                  allResults = [...allResults, ...newResults];
                  totalRowsReceived += newResults.length;

                  // FIFO: keep only the last MAX_ROWS rows
                  if (allResults.length > MAX_ROWS) {
                    allResults = allResults.slice(allResults.length - MAX_ROWS);
                  }

                  const executionTime = Date.now() - startTime;

                  // Update store with all accumulated results
                  set((state) => ({
                    statements: state.statements.map((s) =>
                      s.id === id
                        ? {
                            ...s,
                            status: phase === 'COMPLETED' ? 'COMPLETED' as StatementStatus : 'RUNNING' as StatementStatus,
                            results: allResults,
                            columns,
                            executionTime,
                            totalRowsReceived,
                            lastExecutedAt: new Date(),
                          }
                        : s
                    ),
                  }));

                  console.log(`[Poll] Total: ${allResults.length} (+${newResults.length})`);
                }

                // Update cursor for next fetch
                if (resultsData.metadata?.next) {
                  nextCursor = resultsData.metadata.next;
                }

                if (phase === 'COMPLETED' && !resultsData.metadata?.next) {
                  const executionTime = Date.now() - startTime;
                  get().addToast({
                    type: 'success',
                    message: `Query completed in ${(executionTime / 1000).toFixed(2)}s - ${allResults.length} rows`,
                  });
                  return;
                }
              } catch (resultError) {
                console.log('Results not ready yet:', resultError);
              }
            }

            // Continue polling
            if (phase !== 'COMPLETED' || nextCursor) {
              set((state) => ({
                statements: state.statements.map((s) =>
                  s.id === id && s.status !== 'CANCELLED' ? { ...s, status: 'RUNNING' as StatementStatus } : s
                ),
              }));

              attempts++;
              await new Promise((resolve) => setTimeout(resolve, 1000));
              await poll();
            }
          };

          await poll();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set((state) => ({
            statements: state.statements.map((s) =>
              s.id === id ? { ...s, status: 'ERROR' as StatementStatus, error: errorMessage } : s
            ),
          }));
          get().addToast({ type: 'error', message: errorMessage });
        }
      },

      cancelStatement: async (id) => {
        const statement = get().statements.find((s) => s.id === id);

        // Always update local state to CANCELLED so user can re-run
        set((state) => ({
          statements: state.statements.map((s) =>
            s.id === id ? { ...s, status: 'CANCELLED' as StatementStatus } : s
          ),
        }));
        get().addToast({ type: 'info', message: 'Query cancelled' });

        // Try to cancel on the server if we have a statement name
        if (statement?.statementName) {
          try {
            await flinkApi.cancelStatement(statement.statementName);
          } catch (error) {
            console.error('Failed to cancel statement on server:', error);
            // Already updated local state, so user can still re-run
          }
        }
      },

      runAllStatements: async () => {
        const { statements } = get();
        const eligible = statements.filter(
          (s) => s.status === 'IDLE' || s.status === 'ERROR' || s.status === 'CANCELLED'
        );
        if (eligible.length === 0) return;

        get().addToast({ type: 'info', message: `Running ${eligible.length} statement(s)...` });

        for (const statement of eligible) {
          // Re-check: skip if somehow already running (e.g. user triggered individually)
          const current = get().statements.find((s) => s.id === statement.id);
          if (!current || current.status === 'RUNNING' || current.status === 'PENDING') continue;
          await get().executeStatement(statement.id);
        }
      },

      // Toast Actions
      addToast: (toast) => {
        const id = generateId();
        set((state) => ({
          toasts: [...state.toasts, { ...toast, id }],
        }));
        setTimeout(() => {
          get().removeToast(id);
        }, toast.duration || 5000);
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      // Compute Pool Status Action
      loadComputePoolStatus: async () => {
        try {
          const status = await flinkApi.getComputePoolStatus();
          if (status) {
            set({ computePoolPhase: status.phase, computePoolCfu: status.currentCfu });
          } else {
            set({ computePoolPhase: 'UNKNOWN', computePoolCfu: null });
          }
        } catch (error) {
          console.error('Failed to load compute pool status:', error);
          set({ computePoolPhase: 'UNKNOWN', computePoolCfu: null });
        }
      },
    }),
    {
      name: 'flink-workspace',
      partialize: (state) => ({
        statements: state.statements.map((s) => ({
          id: s.id,
          code: s.code,
          status: s.status === 'RUNNING' || s.status === 'PENDING' ? 'IDLE' as const : s.status,
          createdAt: s.createdAt,
          isCollapsed: s.isCollapsed,
          // Don't persist results, error, statementName (transient)
        })),
        catalog: state.catalog,
        database: state.database,
        lastSavedAt: state.lastSavedAt,
      }),
    }
  )
);

// Helper function to toggle node expanded state
function toggleNodeExpanded(nodes: TreeNode[], nodeId: string): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, isExpanded: !node.isExpanded };
    }
    if (node.children) {
      return { ...node, children: toggleNodeExpanded(node.children, nodeId) };
    }
    return node;
  });
}

// Helper function to find a node by ID in the tree
function findNodeById(nodes: TreeNode[], nodeId: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children) {
      const found = findNodeById(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}
