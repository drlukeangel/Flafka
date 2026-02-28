// SQL Statement Types
export type StatementStatus = 'IDLE' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR' | 'CANCELLED';

export interface SQLStatement {
  id: string;
  code: string;
  status: StatementStatus;
  results?: Record<string, unknown>[];
  columns?: Column[];
  error?: string;
  executionTime?: number;
  totalRowsReceived?: number;
  statementName?: string;
  createdAt: Date;
  updatedAt?: Date;
  lastExecutedAt?: Date;
  startedAt?: Date;
  isCollapsed?: boolean;
  lastExecutedCode?: string | null;
  label?: string;
}

export interface Column {
  name: string;
  type: string;
  nullable?: boolean;
}

// Tree Navigator Types
export type TreeNodeType = 'catalog' | 'database' | 'tables' | 'views' | 'models' | 'functions' | 'externalTables' | 'table' | 'view' | 'model' | 'function' | 'externalTable';

export interface TreeNode {
  id: string;
  name: string;
  type: TreeNodeType;
  isExpanded?: boolean;
  isLoading?: boolean;
  children?: TreeNode[];
  metadata?: {
    catalog?: string;
    database?: string;
  };
}

// Filter & Sort Types
export interface Filter {
  column: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'not_equals';
  value: string;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

// Toast/Notification Types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Workspace Import/Export Types
export interface WorkspaceExportData {
  statements: Array<{
    id: string;
    code: string;
    createdAt: Date;
    isCollapsed?: boolean;
    lastExecutedCode?: string | null;
  }>;
  catalog: string;
  database: string;
  workspaceName: string;
}

export interface WorkspaceImportData {
  statements: Array<{
    id: string;
    code: string;
    status?: string;
    createdAt: string;
    isCollapsed?: boolean;
    lastExecutedCode?: string | null;
  }>;
  catalog: string;
  database: string;
  workspaceName: string;
  exportedAt?: string;
  version?: string;
}

// Navigation Rail Types
export type NavItem = 'workspace' | 'tree' | 'topics' | 'schemas' | 'history' | 'help' | 'settings';
