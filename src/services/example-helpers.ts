/**
 * @example-helpers
 * Shared utilities for example services.
 * Both example-setup.ts (bespoke UDF examples) and example-runner.ts (template engine)
 * import from here to avoid code duplication.
 */

import { executeSQL, getStatementStatus } from '../api/flink-api';

// Shared store contract for both example services
export interface BaseExampleStoreSlice {
  addStatement: (code?: string, afterId?: string, label?: string) => void;
  addSchemaDataset: (dataset: {
    id: string;
    name: string;
    schemaSubject: string;
    records: Record<string, unknown>[];
    createdAt: string;
    updatedAt: string;
  }) => void;
  addStreamCard: (
    topicName: string,
    initialMode?: 'consume' | 'produce-consume',
    preselectedDatasetId?: string,
    datasetTemplate?: { type: string; count: number },
  ) => void;
  setStreamsPanelOpen: (open: boolean) => void;
}

export async function createTable(
  tableName: string,
  ddl: string,
  onProgress: (s: string) => void,
): Promise<void> {
  onProgress(`Creating table ${tableName}...`);
  const stmt = await executeSQL(ddl);
  // DDL statements don't produce results — poll status only (not results endpoint)
  let attempts = 0;
  const maxAttempts = 60;
  while (attempts < maxAttempts) {
    const status = await getStatementStatus(stmt.name);
    const phase = status.status?.phase;
    if (phase === 'COMPLETED') return;
    if (phase === 'FAILED') {
      throw new Error(status.status?.detail || `CREATE TABLE ${tableName} failed`);
    }
    await new Promise((r) => setTimeout(r, 1000));
    attempts++;
  }
  throw new Error(`CREATE TABLE ${tableName} timed out`);
}
