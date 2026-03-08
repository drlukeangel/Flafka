/**
 * ksqlDB engine adapter.
 *
 * Routes SQL to the correct ksqlDB endpoint based on statement classification:
 *  - DDL / SHOW / DESCRIBE / INSERT VALUES → POST /ksql (synchronous)
 *  - Persistent query (CREATE...AS SELECT, INSERT INTO...SELECT) → POST /ksql
 *  - Push query (EMIT CHANGES) → POST /query (streaming via fetch)
 *  - Pull query (SELECT without EMIT) → POST /query (immediate)
 */

import * as ksqlApi from '../../api/ksql-api';
import type { SQLStatement } from '../../types';
import type { SqlEngineAdapter, ExecuteResult, SessionProps } from './types';

// ---------------------------------------------------------------------------
// SQL Classification
// ---------------------------------------------------------------------------

type KsqlQueryType = 'ddl' | 'persistent' | 'push' | 'pull' | 'insert-values';

/**
 * Strip SQL comments (-- line comments and /* block comments *​/) and collapse whitespace.
 * Preserves string literals by tracking quote depth.
 */
function stripComments(sql: string): string {
  let result = '';
  let i = 0;
  while (i < sql.length) {
    // Single-quoted string literal
    if (sql[i] === "'") {
      result += sql[i++];
      while (i < sql.length && sql[i] !== "'") {
        if (sql[i] === "'" && sql[i + 1] === "'") { result += "''"; i += 2; continue; }
        result += sql[i++];
      }
      if (i < sql.length) result += sql[i++];
      continue;
    }
    // Line comment
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      result += ' ';
      continue;
    }
    // Block comment
    if (sql[i] === '/' && sql[i + 1] === '*') {
      i += 2;
      while (i < sql.length - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      result += ' ';
      continue;
    }
    result += sql[i++];
  }
  return result.replace(/\s+/g, ' ').trim();
}

export function classifyKsqlStatement(rawSql: string): KsqlQueryType {
  const sql = stripComments(rawSql);

  // DDL keywords
  if (/^\s*(CREATE\s+(OR\s+REPLACE\s+)?(SOURCE\s+)?(STREAM|TABLE|TYPE|CONNECTOR)\b)/i.test(sql)) {
    // Persistent query: CREATE ... AS SELECT
    if (/\bAS\s+SELECT\b/i.test(sql)) return 'persistent';
    return 'ddl';
  }

  if (/^\s*(DROP|SHOW|DESCRIBE|EXPLAIN|TERMINATE|LIST|PRINT)\b/i.test(sql)) return 'ddl';

  // INSERT INTO ... VALUES (sync DML) vs INSERT INTO ... SELECT (persistent)
  if (/^\s*INSERT\s+INTO\b/i.test(sql)) {
    if (/\bSELECT\b/i.test(sql)) return 'persistent';
    return 'insert-values';
  }

  // SELECT queries
  if (/^\s*SELECT\b/i.test(sql)) {
    if (/\bEMIT\s+CHANGES\b/i.test(sql)) return 'push';
    return 'pull';
  }

  // Default to DDL for SET, UNSET, etc.
  return 'ddl';
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export const ksqlEngine: SqlEngineAdapter = {
  async execute(sql, _name, props, { onStatus, abortSignal }) {
    const queryType = classifyKsqlStatement(sql);

    switch (queryType) {
      case 'ddl':
      case 'insert-values': {
        onStatus('PENDING');
        const responses = await ksqlApi.executeKsql(sql, props);
        const first = responses[0];

        // Extract columns and rows from SHOW/DESCRIBE responses
        let columns = undefined;
        let rows = undefined;

        if (first?.sourceDescription) {
          columns = first.sourceDescription.fields.map(f => ({
            name: f.name,
            type: f.schema.type,
          }));
        }

        if (first?.streams) {
          columns = [
            { name: 'Name', type: 'STRING' },
            { name: 'Topic', type: 'STRING' },
            { name: 'Key Format', type: 'STRING' },
            { name: 'Value Format', type: 'STRING' },
          ];
          rows = first.streams.map(s => ({
            Name: s.name, Topic: s.topic,
            'Key Format': s.keyFormat, 'Value Format': s.valueFormat,
          }));
        }

        if (first?.tables) {
          columns = [
            { name: 'Name', type: 'STRING' },
            { name: 'Topic', type: 'STRING' },
            { name: 'Key Format', type: 'STRING' },
            { name: 'Value Format', type: 'STRING' },
          ];
          rows = first.tables.map(t => ({
            Name: t.name, Topic: t.topic,
            'Key Format': t.keyFormat, 'Value Format': t.valueFormat,
          }));
        }

        if (first?.queries) {
          columns = [
            { name: 'Query ID', type: 'STRING' },
            { name: 'Query Type', type: 'STRING' },
            { name: 'State', type: 'STRING' },
            { name: 'Query', type: 'STRING' },
          ];
          rows = first.queries.map(q => ({
            'Query ID': q.id, 'Query Type': q.queryType,
            'State': q.state, 'Query': q.queryString,
          }));
        }

        const toastMessage = first?.commandStatus?.message
          || (queryType === 'insert-values' ? 'Row inserted' : 'Statement executed');

        return {
          completed: true,
          columns,
          rows,
          toastMessage,
        } satisfies ExecuteResult;
      }

      case 'persistent': {
        onStatus('PENDING');
        const responses = await ksqlApi.executeKsql(sql, props);
        const first = responses[0];
        const queryId = first?.commandStatus?.queryId;

        return {
          statementName: queryId,
          completed: false,
          streaming: false,
          toastMessage: queryId
            ? `Persistent query started: ${queryId}`
            : 'Persistent query started',
        } satisfies ExecuteResult;
      }

      case 'push': {
        onStatus('RUNNING');

        const result = await ksqlApi.executeKsqlQuery(
          sql,
          props,
          (partial) => {
            onStatus('RUNNING', {
              columns: partial.columns,
              results: partial.rows,
              totalRowsReceived: partial.totalRowsReceived,
            });
          },
          abortSignal,
        );

        return {
          statementName: result.queryId,
          columns: result.columns,
          rows: result.rows,
          completed: false,
          streaming: true,
        } satisfies ExecuteResult;
      }

      case 'pull': {
        onStatus('PENDING');

        const result = await ksqlApi.executeKsqlQuery(sql, props, undefined, abortSignal);

        return {
          completed: true,
          columns: result.columns,
          rows: result.rows,
        } satisfies ExecuteResult;
      }
    }
  },

  async getStatus(statementName) {
    // ksqlDB persistent queries: check if still running via EXPLAIN
    try {
      const responses = await ksqlApi.executeKsql(`EXPLAIN ${statementName};`);
      const first = responses[0];
      const state = first?.queries?.[0]?.state;
      if (state === 'RUNNING') return { phase: 'RUNNING' };
      if (state === 'ERROR') return { phase: 'FAILED', errorDetail: 'Query entered ERROR state' };
      return { phase: 'COMPLETED' };
    } catch {
      return { phase: 'UNKNOWN' };
    }
  },

  async cancel(statementName, meta) {
    if (meta?.streaming) {
      // Push queries are cancelled by aborting the HTTP connection (AbortController)
      // Nothing to do server-side — the abort already happened
      return;
    }
    // Persistent queries: TERMINATE
    if (statementName) {
      await ksqlApi.terminateQuery(statementName);
    }
  },

  buildProps(statement: SQLStatement, globalProps: SessionProps): Record<string, string> {
    const props: Record<string, string> = {};
    // Map scan mode to ksqlDB's auto.offset.reset
    const scanMode = statement.scanMode || 'earliest-offset';
    if (scanMode === 'latest-offset') {
      props['ksql.streams.auto.offset.reset'] = 'latest';
    } else {
      props['ksql.streams.auto.offset.reset'] = 'earliest';
    }
    // Pass through any global session properties that are ksqlDB-compatible
    for (const [key, value] of Object.entries(globalProps)) {
      if (key.startsWith('ksql.')) {
        props[key] = value;
      }
    }
    return props;
  },

  validateName(_label: string): string | null {
    // ksqlDB doesn't require a job name — labels are informational only
    return null;
  },
};
