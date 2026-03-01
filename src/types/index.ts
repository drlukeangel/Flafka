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

// Schema Registry Types
export type CompatibilityLevel = 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE' | 'BACKWARD_TRANSITIVE' | 'FORWARD_TRANSITIVE' | 'FULL_TRANSITIVE';

export interface SchemaListItem {
  subject: string;
}

export interface SchemaSubject {
  subject: string;
  version: number;
  id: number;
  schemaType: 'AVRO' | 'PROTOBUF' | 'JSON';
  schema: string;
  compatibilityLevel?: CompatibilityLevel;
  references?: SchemaReference[];
}

export interface SchemaVersion {
  subject: string;
  version: number;
  id: number;
  schemaType: 'AVRO' | 'PROTOBUF' | 'JSON';
  schema: string;
  references?: SchemaReference[];
}

export interface SchemaReference {
  name: string;
  subject: string;
  version: number;
}

export interface SchemaField {
  name: string;
  type: string | SchemaField[];
  default?: unknown;
  doc?: string;
  avroMetadata?: Record<string, unknown>;
}

// Kafka Topic — shape returned by list and detail endpoints
export interface KafkaTopic {
  topic_name: string;
  is_internal: boolean;
  replication_factor: number;
  partitions_count: number;
}

// Topic configuration entry — returned by the configs endpoint
export interface TopicConfig {
  name: string;
  value: string | null;
  is_default: boolean;
  is_read_only: boolean;
  is_sensitive: boolean;
}

export interface KafkaPartition {
  partition_id: number;
  leader: { broker_id: number } | null;
  replicas: Array<{ broker_id: number }>;
  isr: Array<{ broker_id: number }>;
}

export interface PartitionOffsets {
  beginning_offset: number;
  end_offset: number;
}

export interface TopicConfigAlterRequest {
  data: Array<{ name: string; value: string }>;
}
