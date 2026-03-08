/**
 * SqlEngineAdapter — thin interface that both Flink and ksqlDB implement.
 *
 * Keeps the workspaceStore engine-agnostic: it calls adapter methods instead of
 * importing flinkApi / ksqlApi directly. Only execution-path methods are included;
 * catalog/metadata browsing remains Flink-only for MVP.
 */

import type { Column, SQLStatement } from '../../types';

export interface ExecuteResult {
  /** Server-side statement/query identifier (Flink statementName, ksqlDB queryId) */
  statementName?: string;
  /** Terminal status if the query completed synchronously */
  completed?: boolean;
  /** Columns from synchronous results */
  columns?: Column[];
  /** Rows from synchronous results */
  rows?: Record<string, unknown>[];
  /** For streaming queries: called with incremental results */
  streaming?: boolean;
  /** Toast message to display */
  toastMessage?: string;
}

export interface EngineStatus {
  phase: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING' | 'UNKNOWN';
  errorDetail?: string;
  columns?: Column[];
  rows?: Record<string, unknown>[];
  nextCursor?: string;
  totalRowsReceived?: number;
}

export interface SessionProps {
  [key: string]: string;
}

export interface SqlEngineAdapter {
  /** Execute a SQL statement. May complete synchronously or start a long-running query. */
  execute(
    sql: string,
    name: string,
    props: Record<string, string>,
    callbacks: {
      onStatus: (status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR', updates?: Partial<SQLStatement>) => void;
      abortSignal?: AbortSignal;
    },
  ): Promise<ExecuteResult>;

  /** Get current status of a running statement (for polling / refresh). */
  getStatus(statementName: string): Promise<EngineStatus>;

  /** Cancel / stop a running statement. */
  cancel(statementName: string, meta?: { queryId?: string; streaming?: boolean }): Promise<void>;

  /** Build engine-specific session properties from the statement + global session props. */
  buildProps(statement: SQLStatement, globalProps: SessionProps): Record<string, string>;

  /** Validate the statement name/label. Returns null if valid, error message if invalid. */
  validateName(label: string): string | null;
}
