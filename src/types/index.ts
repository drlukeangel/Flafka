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
  scanMode?: string;
  scanTimestampMillis?: string;
  scanSpecificOffsets?: string;
  scanGroupId?: string;
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
// Phase 12.6 F6: Added 'snippets' for SQL snippet library panel
export type NavItem = 'workspace' | 'jobs' | 'tree' | 'topics' | 'schemas' | 'snippets' | 'examples' | 'artifacts' | 'history' | 'help' | 'settings' | 'streams' | 'workspaces';

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
  // ENH-4: optional timestamp fields — present only if API version includes them
  created_at?: string;
  last_modified_at?: string;
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

// Phase 12.6 — F1: Config Edit Audit Log
export interface ConfigAuditEntry {
  topicName: string;
  configKey: string;
  oldValue: string;
  newValue: string;
  timestamp: string; // ISO 8601
}

// Phase 12.6 — F6: Query Templates / Saved SQL Snippets
export interface Snippet {
  id: string;
  name: string;
  sql: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// Saved Workspaces — snapshot of SQL cells + stream card configs
export interface SavedWorkspaceStatement {
  id: string;
  code: string;
  label?: string;
  isCollapsed?: boolean;
  scanMode?: string;
  scanTimestampMillis?: string;
  scanSpecificOffsets?: string;
  scanGroupId?: string;
  statementName?: string; // only if was RUNNING when saved
}

export interface SavedWorkspaceStreamCard {
  topicName: string;
  mode: 'consume' | 'produce-consume';
  dataSource: 'synthetic' | 'dataset';
  selectedDatasetId: string | null;
  scanMode: 'earliest-offset' | 'latest-offset';
  // Present for stream cards created by Quick Start examples (informational only)
  datasetTemplate?: { type: string; count: number };
}

export interface SavedWorkspace {
  id: string;
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  statementCount: number;
  streamCardCount: number;
  statements: SavedWorkspaceStatement[];
  streamCards: SavedWorkspaceStreamCard[];
  // Template provenance — set for workspaces created from Quick Start examples
  sourceTemplateId?: string;   // ExampleCard.id
  sourceTemplateName?: string; // Display name for badge (ephemeral — not preserved through export/import)
  notes?: string;              // Free-form notes; pre-populated from steps for example workspaces
}

// Stream card entry — shape stored in the workspace store
export interface StreamCardEntry {
  id: string;
  topicName: string;
  initialMode?: 'consume' | 'produce-consume';
  preselectedDatasetId?: string;
  mode?: 'consume' | 'produce-consume';
  dataSource?: 'synthetic' | 'dataset';
  selectedDatasetId?: string | null;
  scanMode?: 'earliest-offset' | 'latest-offset';
  datasetTemplate?: { type: string; count: number };
}

// Per-tab workspace state (each open tab has its own independent copy)
export interface TabState {
  statements: SQLStatement[];
  focusedStatementId: string | null;
  workspaceName: string;
  workspaceNotes: string | null;
  workspaceNotesOpen: boolean;
  lastSavedAt: string | null;
  streamCards: StreamCardEntry[];
  backgroundStatements: BackgroundStatement[];
  treeNodes: TreeNode[];
  selectedNodeId: string | null;
  treeLoading: boolean;
  selectedTableSchema: Column[];
  selectedTableName: string | null;
  schemaLoading: boolean;
}

// Phase 13.1 — Stream Panel Types

export interface BackgroundStatement {
  id: string;
  contextId: string;         // Identifies what this statement is for (e.g., topic name)
  statementName: string;     // Flink statement name (bg-{timestamp}-{contextId})
  sql: string;
  status: StatementStatus;
  results?: Record<string, unknown>[];
  columns?: Column[];
  error?: string;
  createdAt: Date;
}

export interface ProduceRecord {
  key?: { type: 'JSON' | 'AVRO' | 'PROTOBUF' | 'BINARY'; data: unknown; schema_id?: number };
  value: { type: 'JSON' | 'AVRO' | 'PROTOBUF' | 'BINARY'; data: unknown; schema_id?: number };
}

export interface ProduceResult {
  error_code?: number;
  message?: string;
  cluster_id: string;
  topic_name: string;
  partition_id: number;
  offset: number;
  timestamp: string;
}

export interface SyntheticResult {
  sent: number;
  errors: number;
  lastError?: string;
}

export interface StreamCardState {
  topicName: string;
  isCollapsed: boolean;
  isProducing: boolean;
  produceCount: number;
  error?: string;
}

// Flink Artifact Types (Confluent Cloud artifact/v1 API)
export interface FlinkArtifactVersion {
  version: string;         // e.g. "ver-abc123"
  release_notes?: string;
  is_draft?: boolean;
  created_at?: string;     // ISO 8601
}

export interface FlinkArtifact {
  id: string;              // e.g. "cfa-abc123"
  display_name: string;
  class: string;           // e.g. "com.example.MyUdf"
  cloud: string;
  region: string;
  environment: string;     // environment ID
  content_format: string;  // e.g. "JAR"
  runtime_language: string; // e.g. "JAVA"
  description?: string;
  documentation_link?: string;
  versions: FlinkArtifactVersion[];
  metadata?: {
    created_at?: string;
    updated_at?: string;
  };
}

export interface FlinkArtifactListResponse {
  api_version: string;
  kind: string;
  metadata: { total_size: number };
  data: FlinkArtifact[];
}

export interface PresignedUploadUrlResponse {
  api_version: string;
  kind: string;
  content_format: string;
  cloud: string;
  region: string;
  upload_url: string;
  upload_id: string;
  upload_form_data: Record<string, string>;
}

// Example completion steps — shown in the Workspace Notes panel after Quick Start setup
export interface ExampleCompletionStep {
  label: string;    // Bold step title, e.g. "Start the stream"
  detail?: string;  // Optional trailing detail after em dash
}

export interface ExampleCompletionModal {
  title: string;           // Card title (injected at runtime — not stored on ExampleCard)
  subtitle?: string;       // Introductory paragraph
  steps: ExampleCompletionStep[];
}

// Example card for the Examples panel
export interface ExampleCard {
  id: string;
  title: string;
  description: string;
  sql: string;
  tags: string[];
  category: 'kickstart' | 'snippet';
  completionModal?: Omit<ExampleCompletionModal, 'title'>; // title injected from card.title at runtime
  onImport?: (onProgress: (step: string) => void) => Promise<{ runId: string }>;
  comingSoon?: string; // If set: show disabled "Coming Soon" button; no Set Up button
}

// Schema test datasets
export interface SchemaDataset {
  id: string;              // crypto.randomUUID()
  name: string;            // User-given name
  schemaSubject: string;   // Which schema this belongs to
  records: Record<string, unknown>[];
  createdAt: string;       // ISO 8601 string (NOT Date — survives JSON roundtrip)
  updatedAt: string;       // ISO 8601 string
}

export interface CreateArtifactRequest {
  display_name: string;
  class: string;
  cloud: string;
  region: string;
  environment: string;
  content_format: string;
  runtime_language?: string;
  description?: string;
  documentation_link?: string;
  upload_source: {
    location: string;
    upload_id: string;
  };
}

// Compute Pool Dashboard — telemetry per statement
export interface StatementTelemetry {
  statementName: string;
  cfus: number | null;
  recordsIn: number | null;
  recordsOut: number | null;
  pendingRecords: number | null;
  stateSizeBytes: number | null;
  // Merged from listStatements()
  sql?: string;
  createdAt?: string;
  isWorkspaceStatement?: boolean;
}
