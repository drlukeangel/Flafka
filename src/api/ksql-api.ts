/**
 * ksqlDB REST API layer.
 *
 * Two endpoints:
 *  - POST /ksql   — DDL, DML, SHOW, DESCRIBE, TERMINATE (synchronous, via Axios)
 *  - POST /query  — push queries (EMIT CHANGES) and pull queries (via fetch + ReadableStream)
 *
 * Error shapes differ from Flink — three distinct formats are handled by handleKsqlError().
 */

import { ksqlClient, getKsqlAuthHeader, KSQL_FETCH_BASE } from './ksql-client';
import type { Column } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KsqlCommandStatus {
  status: 'SUCCESS' | 'ERROR' | 'QUEUED';
  message: string;
  queryId?: string;
}

export interface KsqlStatementResponse {
  '@type'?: string;
  statementText?: string;
  commandId?: string;
  commandStatus?: KsqlCommandStatus;
  commandSequenceNumber?: number;
  warnings?: Array<{ message: string }>;
  // SHOW QUERIES shape
  queries?: Array<{ queryString: string; sinks: string[]; id: string; queryType: string; state: string }>;
  // SHOW STREAMS/TABLES shape
  streams?: Array<{ name: string; topic: string; keyFormat: string; valueFormat: string; isWindowed: boolean }>;
  tables?: Array<{ name: string; topic: string; keyFormat: string; valueFormat: string; isWindowed: boolean }>;
  // DESCRIBE shape
  sourceDescription?: {
    name: string;
    type: string;
    fields: Array<{ name: string; schema: { type: string; fields?: unknown[]; memberSchema?: unknown } }>;
    topic: string;
    keyFormat: string;
    valueFormat: string;
    statement: string;
  };
  // Error shape (statement_error)
  error_code?: number;
  message?: string;
}

export interface KsqlQueryHeader {
  queryId?: string;
  schema: string; // e.g. "`COL1` STRING, `COL2` INTEGER"
}

export interface KsqlQueryRow {
  row?: { columns: unknown[] };
  errorMessage?: { message: string };
  finalMessage?: string;
}

export interface KsqlError {
  message: string;
  errorCode?: number;
}

// ---------------------------------------------------------------------------
// Error handling (3 distinct formats)
// ---------------------------------------------------------------------------

export function handleKsqlError(data: unknown): KsqlError {
  if (!data || typeof data !== 'object') {
    return { message: 'Unknown ksqlDB error' };
  }

  const obj = data as Record<string, unknown>;

  // Format 1: DDL/DML error — { commandStatus: { status: "ERROR", message: "..." } }
  if (obj.commandStatus) {
    const cs = obj.commandStatus as KsqlCommandStatus;
    if (cs.status === 'ERROR') {
      return { message: cs.message };
    }
  }

  // Format 2: Statement error — { "@type": "statement_error", error_code: 40001, message: "..." }
  if (obj['@type'] === 'statement_error' || obj['@type'] === 'currentStatus') {
    return {
      message: (obj.message as string) || 'ksqlDB statement error',
      errorCode: obj.error_code as number | undefined,
    };
  }

  // Format 3: HTTP-level error — { error_code: 40100, message: "..." }
  if (obj.error_code && obj.message) {
    return {
      message: obj.message as string,
      errorCode: obj.error_code as number,
    };
  }

  // Array response with embedded errors
  if (Array.isArray(data)) {
    for (const item of data) {
      const err = handleKsqlError(item);
      if (err.message !== 'Unknown ksqlDB error') return err;
    }
  }

  return { message: 'Unknown ksqlDB error' };
}

// ---------------------------------------------------------------------------
// Schema parser
// ---------------------------------------------------------------------------

/**
 * Parse ksqlDB schema string into Column[].
 * Input: "`COL1` STRING, `COL2` INTEGER, `COL3` STRUCT<`F1` STRING, `F2` INT>"
 * Handles nested types (STRUCT, ARRAY, MAP) by counting angle-bracket depth.
 */
export function parseKsqlSchema(schemaStr: string): Column[] {
  if (!schemaStr?.trim()) return [];

  const columns: Column[] = [];
  let depth = 0;
  let current = '';

  for (const char of schemaStr) {
    if (char === '<') depth++;
    if (char === '>') depth--;
    if (char === ',' && depth === 0) {
      const col = parseOneColumn(current.trim());
      if (col) columns.push(col);
      current = '';
    } else {
      current += char;
    }
  }
  const last = parseOneColumn(current.trim());
  if (last) columns.push(last);

  return columns;
}

function parseOneColumn(fragment: string): Column | null {
  if (!fragment) return null;
  // "`name` TYPE" or "name TYPE"
  const match = fragment.match(/^`?([^`]+)`?\s+(.+)$/);
  if (!match) return null;
  return { name: match[1], type: match[2].trim() };
}

// ---------------------------------------------------------------------------
// DDL / DML — POST /ksql (synchronous)
// ---------------------------------------------------------------------------

export async function executeKsql(
  sql: string,
  streamsProperties?: Record<string, string>,
): Promise<KsqlStatementResponse[]> {
  const body: Record<string, unknown> = { ksql: sql };
  if (streamsProperties && Object.keys(streamsProperties).length > 0) {
    body.streamsProperties = streamsProperties;
  }

  let data: KsqlStatementResponse[];
  try {
    const response = await ksqlClient.post<KsqlStatementResponse[]>('/ksql', body);
    data = response.data;
  } catch (err: unknown) {
    // Axios throws on 4xx/5xx — extract the real ksqlDB error from response body
    const respData = (err as { response?: { data?: unknown } })?.response?.data;
    if (respData) {
      const ksqlErr = handleKsqlError(respData);
      if (ksqlErr.message !== 'Unknown ksqlDB error') {
        throw new Error(ksqlErr.message);
      }
    }
    throw err;
  }

  // Check for error in 2xx response array
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item['@type'] === 'statement_error') {
        throw new Error(handleKsqlError(item).message);
      }
      if (item.commandStatus?.status === 'ERROR') {
        throw new Error(item.commandStatus.message);
      }
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Queries — POST /query (streaming via fetch + ReadableStream)
// ---------------------------------------------------------------------------

const MAX_ROWS = 5000;

export interface KsqlQueryResult {
  columns: Column[];
  rows: Record<string, unknown>[];
  queryId?: string;
  totalRowsReceived: number;
}

export async function executeKsqlQuery(
  sql: string,
  streamsProperties?: Record<string, string>,
  onRow?: (result: KsqlQueryResult) => void,
  abortSignal?: AbortSignal,
): Promise<KsqlQueryResult> {
  const body: Record<string, unknown> = { ksql: sql };
  if (streamsProperties && Object.keys(streamsProperties).length > 0) {
    body.streamsProperties = streamsProperties;
  }

  const response = await fetch(`${KSQL_FETCH_BASE}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.ksql.v1+json',
      'Authorization': getKsqlAuthHeader(),
    },
    body: JSON.stringify(body),
    signal: abortSignal,
  });

  if (!response.ok) {
    let errorData: unknown;
    try { errorData = await response.json(); } catch { /* ignore */ }
    const err = handleKsqlError(errorData);
    throw new Error(err.message || `ksqlDB query failed (HTTP ${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('ksqlDB response has no body');

  const decoder = new TextDecoder();
  let buffer = '';
  let columns: Column[] = [];
  let rows: Record<string, unknown>[] = [];
  let queryId: string | undefined;
  let totalRowsReceived = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === ',') continue;

        // Strip trailing comma (ksqlDB uses JSON array streaming)
        const clean = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
        // Skip array delimiters
        if (clean === '[' || clean === ']') continue;

        let parsed: KsqlQueryHeader & KsqlQueryRow;
        try {
          parsed = JSON.parse(clean);
        } catch {
          continue; // skip unparseable lines
        }

        // Check for in-band error
        if (parsed.errorMessage) {
          throw new Error(parsed.errorMessage.message || 'ksqlDB query error');
        }

        // Header line with schema
        if (parsed.schema && columns.length === 0) {
          queryId = parsed.queryId;
          columns = parseKsqlSchema(parsed.schema);
          continue;
        }

        // Final message (query terminated)
        if ((parsed as KsqlQueryRow).finalMessage) {
          break;
        }

        // Data row
        if (parsed.row?.columns) {
          totalRowsReceived++;
          const obj: Record<string, unknown> = {};
          parsed.row.columns.forEach((val, idx) => {
            const colName = columns[idx]?.name || `col_${idx}`;
            obj[colName] = val;
          });
          rows.push(obj);

          // FIFO buffer: keep most recent MAX_ROWS
          if (rows.length > MAX_ROWS) {
            rows = rows.slice(rows.length - MAX_ROWS);
          }

          if (onRow) {
            onRow({ columns, rows: [...rows], queryId, totalRowsReceived });
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      // Expected: push query was cancelled
    } else {
      throw err;
    }
  } finally {
    reader.releaseLock();
  }

  return { columns, rows, queryId, totalRowsReceived };
}

// ---------------------------------------------------------------------------
// Terminate persistent query — POST /ksql with TERMINATE
// ---------------------------------------------------------------------------

export async function terminateQuery(queryId: string, retries = 3): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await executeKsql(`TERMINATE \`${queryId}\`;`);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isCommandTopicTimeout = msg.includes('command topic');
      if (isCommandTopicTimeout && attempt < retries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = 2000 * Math.pow(2, attempt);
        console.log(`[ksqlDB] TERMINATE attempt ${attempt + 1} failed, retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw isCommandTopicTimeout
        ? new Error(`ksqlDB command topic timed out after ${retries + 1} attempts. The cluster may be busy — try again in a few seconds.`)
        : err;
    }
  }
}

// ---------------------------------------------------------------------------
// List queries — POST /ksql with SHOW QUERIES
// ---------------------------------------------------------------------------

export async function listQueries(): Promise<KsqlStatementResponse[]> {
  return executeKsql('SHOW QUERIES;');
}

// ---------------------------------------------------------------------------
// Explain query — POST /ksql with EXPLAIN
// ---------------------------------------------------------------------------

export async function explainQuery(queryId: string): Promise<KsqlStatementResponse[]> {
  return executeKsql(`EXPLAIN \`${queryId}\`;`);
}
