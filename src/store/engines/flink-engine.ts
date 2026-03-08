/**
 * Flink SQL engine adapter.
 *
 * Wraps existing flinkApi calls behind the SqlEngineAdapter interface.
 * The heavy polling loop remains in workspaceStore — this adapter handles
 * the initial execute, status check, and cancel operations.
 */

import * as flinkApi from '../../api/flink-api';
import type { SQLStatement } from '../../types';
import type { SqlEngineAdapter, EngineStatus, SessionProps } from './types';

export const flinkEngine: SqlEngineAdapter = {
  async execute(sql, name, props, { onStatus }) {
    // If restarting (same name exists on server), delete the old statement first
    try {
      await flinkApi.cancelStatement(name);
    } catch {
      // 404 = already gone, 409 = conflict — both OK to ignore
    }

    const result = await flinkApi.executeSQL(sql, name, props);
    const statementName = result.name;

    onStatus('RUNNING', { statementName });

    return { statementName, streaming: true };
  },

  async getStatus(statementName) {
    const status = await flinkApi.getStatementStatus(statementName);
    const phase = status.status?.phase;

    const result: EngineStatus = {
      phase: (phase as EngineStatus['phase']) || 'UNKNOWN',
    };

    if (phase === 'FAILED') {
      result.errorDetail = await flinkApi.getStatementErrorDetail(
        statementName,
        status.status?.detail,
      );
    }

    if (status.status?.traits?.schema?.columns) {
      result.columns = status.status.traits.schema.columns.map((col: { name: string; type?: { type?: string; nullable?: boolean } }) => ({
        name: col.name,
        type: col.type?.type || 'STRING',
        nullable: col.type?.nullable,
      }));
    }

    return result;
  },

  async cancel(statementName) {
    await flinkApi.cancelStatement(statementName);
  },

  buildProps(statement: SQLStatement, globalProps: SessionProps): Record<string, string> {
    const props: Record<string, string> = { ...globalProps };
    const scanMode = statement.scanMode || 'earliest-offset';
    props['sql.tables.scan.startup.mode'] = scanMode;
    if (scanMode === 'timestamp' && statement.scanTimestampMillis) {
      props['sql.tables.scan.startup.timestamp-millis'] = statement.scanTimestampMillis;
    }
    if (scanMode === 'specific-offsets' && statement.scanSpecificOffsets) {
      props['sql.tables.scan.startup.specific-offsets'] = statement.scanSpecificOffsets;
    }
    if (scanMode === 'group-offsets' && statement.scanGroupId) {
      props['properties.group.id'] = statement.scanGroupId;
    }
    return props;
  },

  validateName(label: string): string | null {
    if (!label.trim()) {
      return 'Enter a job name before running.';
    }
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label) || label.length > 72) {
      return 'Job name: lowercase letters, numbers, hyphens only (max 72 chars). Must start/end with a letter or number.';
    }
    return null;
  },
};
