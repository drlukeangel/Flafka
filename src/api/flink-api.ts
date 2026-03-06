/**
 * Flink SQL REST API Client
 *
 * Communicates with Confluent Cloud's Flink SQL gateway to execute SQL statements,
 * poll for results, and manage statement lifecycle. All requests are routed through
 * a Vite dev proxy at `/api/flink` to avoid CORS issues.
 *
 * Key concepts:
 * - **Statements** are the fundamental unit: you POST a SQL string, get back a
 *   statement name, then poll its status until it reaches a terminal phase.
 * - **Results** use cursor-based pagination: the response includes a `metadata.next`
 *   URL that you follow to get the next page of rows.
 * - **Two API clients**: `confluentClient` talks to the Flink SQL API;
 *   `fcpmClient` talks to the Confluent Cloud Management API (for compute pools).
 *
 * Auth: Basic Auth with VITE_FLINK_API_KEY / VITE_FLINK_API_SECRET (handled by
 * confluent-client.ts interceptor).
 */
import { confluentClient, fcpmClient, handleApiError } from './confluent-client';
import { env } from '../config/environment';
import type { Column } from '../types';

// Build URL path for Flink SQL API
// URL format: /sql/v1/organizations/{org_id}/environments/{env_id}/statements
const buildStatementsUrl = (): string => {
  return `/sql/v1/organizations/${env.orgId}/environments/${env.environmentId}/statements`;
};

/**
 * Response from the Flink SQL `/statements` endpoint.
 *
 * Represents a single SQL statement submitted to Confluent Cloud Flink.
 */
export interface StatementResponse {
  /** Unique statement identifier (e.g. "wobbling-penguin-a3f"). Used to poll status and fetch results. */
  name: string;

  metadata?: {
    /** Optimistic-concurrency version string. Changes on every server-side mutation. */
    resource_version?: string;
    /** ISO-8601 timestamp of when the statement was created on the server. */
    created_at?: string;
  };

  spec?: {
    /** The SQL text that was submitted (e.g. "SELECT * FROM orders"). */
    statement?: string;
    /** Server-classified type: "SELECT", "INSERT", "CREATE_TABLE", etc. */
    statement_type?: string;
    /** Which compute pool runs this statement. */
    compute_pool_id?: string;
    /** Session properties sent with the statement (catalog, database, scan mode, etc.). */
    properties?: Record<string, string>;
  };

  status?: {
    /**
     * Lifecycle phase of the statement:
     * - `PENDING`   — Submitted, waiting for compute resources.
     * - `RUNNING`   — Actively executing. For streaming queries this can last indefinitely.
     * - `COMPLETED` — Finished successfully. Results are available.
     * - `FAILED`    — Execution error. See `detail` for the error message.
     * - `CANCELLED` — User cancelled via DELETE. Terminal state.
     */
    phase: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    /** Human-readable error message when phase is FAILED. */
    detail?: string;

    traits?: {
      /**
       * `true` for append-only streaming queries (e.g. SELECT on a stream).
       * `false` for changelog/upsert queries that emit retractions.
       * Determines how the UI buffers and displays rows.
       */
      is_append_only?: boolean;
      /**
       * `true` for bounded (batch) queries that will eventually COMPLETE.
       * `false` for unbounded (streaming) queries that run until cancelled.
       */
      is_bounded?: boolean;
      /** Result schema — column names and types, available once the statement starts running. */
      schema?: {
        columns?: Array<{
          name: string;
          type: { type: string; nullable?: boolean };
        }>;
      };
    };
  };
}

/** Response from the `/statements/{name}/results` endpoint. */
export interface ResultsResponse {
  results?: {
    /** Array of row objects. Each row's values are in positional order matching the schema columns. */
    data?: Array<{
      row: unknown[];
    }>;
  };
  metadata?: {
    /** Cursor URL for the next page of results. Absent when no more data is available. */
    next?: string;
  };
}

/** Response from the `/statements/{name}/exceptions` endpoint — detailed error logs. */
export interface StatementExceptionsResponse {
  data?: Array<{
    /** Exception class name (e.g. "FlinkRuntimeException"). */
    name?: string;
    /** Human-readable error message with stack trace details. */
    message?: string;
    /** ISO-8601 timestamp when the exception occurred. */
    timestamp?: string;
  }>;
}

/**
 * Fetch exceptions/logs for a statement — returns richer error detail than status.detail.
 * Endpoint: GET /statements/{name}/exceptions
 */
export const getStatementExceptions = async (statementName: string): Promise<string | null> => {
  try {
    const response = await confluentClient.get(`${buildStatementsUrl()}/${statementName}/exceptions`);
    const data: StatementExceptionsResponse = response.data;
    const exceptions = data?.data ?? [];
    if (exceptions.length === 0) return null;
    // Join all exception messages, newest last
    return exceptions.map((e) => [e.name, e.message].filter(Boolean).join(': ')).join('\n\n');
  } catch {
    return null;
  }
};

/**
 * Get the best available error detail for a FAILED statement.
 * Tries status.detail first, then falls back to the /exceptions endpoint for full logs.
 */
export const getStatementErrorDetail = async (statementName: string, detail?: string): Promise<string> => {
  if (detail) return detail;
  const exceptions = await getStatementExceptions(statementName);
  return exceptions || 'Query failed';
};

// Generate a memorable statement name like "wobbling-penguin-a3f"
import { generateStatementName } from '../utils/names';

// Valid Flink SQL session properties (filter out invalid ones before sending to API)
const VALID_SESSION_PROPERTIES = new Set([
  'sql.current-catalog',
  'sql.current-database',
  'sql.dry-run',
  'sql.inline-result',
  'sql.local-time-zone',
  'sql.state-ttl',
  'sql.tables.scan.bounded.mode',
  'sql.tables.scan.bounded.timestamp-millis',
  'sql.tables.scan.idle-timeout',
  'sql.tables.scan.source-operator-parallelism',
  'sql.tables.scan.startup.mode',
  'sql.tables.scan.startup.specific-offsets',
  'sql.tables.scan.startup.timestamp-millis',
  'sql.tables.scan.watermark-alignment.max-allowed-drift',
]);

// Filter session properties to only include valid ones
const filterSessionProperties = (props?: Record<string, string>): Record<string, string> => {
  if (!props) return {};
  const filtered: Record<string, string> = {};
  Object.entries(props).forEach(([key, value]) => {
    if (VALID_SESSION_PROPERTIES.has(key)) {
      filtered[key] = value;
    }
  });
  return filtered;
};

/**
 * Submit a SQL statement for execution on Confluent Cloud Flink.
 *
 * Sends a POST to `/statements` with the SQL text, compute pool, and session
 * properties (catalog, database, scan mode, etc.). The server returns immediately
 * with a `StatementResponse` whose phase is typically `PENDING` — you must then
 * poll with {@link getStatementStatus} to track progress.
 *
 * @param sql - The Flink SQL text to execute (e.g. "SELECT * FROM orders").
 * @param name - Optional custom statement name. If omitted, a memorable name is
 *               auto-generated (e.g. "wobbling-penguin-a3f").
 * @param sessionProperties - Optional key-value map of Flink session properties.
 *               Only properties in the VALID_SESSION_PROPERTIES allowlist are sent.
 * @returns The initial StatementResponse (phase will be PENDING or RUNNING).
 * @throws ApiError on network or server errors (4xx/5xx).
 */
export const executeSQL = async (sql: string, name?: string, sessionProperties?: Record<string, string>): Promise<StatementResponse> => {
  const statementName = name || generateStatementName();

  const payload = {
    name: statementName,
    spec: {
      statement: sql,
      compute_pool_id: env.computePoolId,
      properties: {
        // Env vars as defaults, session properties can override catalog/database
        'sql.current-catalog': env.flinkCatalog,
        'sql.current-database': env.flinkDatabase,
        ...filterSessionProperties(sessionProperties),
      },
    },
  };

  try {
    const response = await confluentClient.post(buildStatementsUrl(), payload);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Poll the current status of a previously submitted statement.
 *
 * Typical polling pattern: call this in a loop (e.g. every 1s) until `status.phase`
 * reaches a terminal state (`COMPLETED`, `FAILED`, or `CANCELLED`). While in
 * `RUNNING`, streaming queries will stay in this phase until explicitly cancelled.
 *
 * @param statementName - The unique statement name returned by {@link executeSQL}.
 * @returns The full StatementResponse including current phase, traits, and schema.
 * @throws ApiError if the statement does not exist (404) or on server errors.
 */
export const getStatementStatus = async (statementName: string): Promise<StatementResponse> => {
  try {
    const response = await confluentClient.get(`${buildStatementsUrl()}/${statementName}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Fetch result rows for a completed or running statement, with cursor pagination.
 *
 * **First call**: pass only `statementName`. The API may return an empty first page
 * with a `metadata.next` cursor — this function automatically follows it once to
 * get the initial batch of rows.
 *
 * **Subsequent calls**: pass the `metadata.next` URL from the previous response as
 * `nextUrl` to fetch the next page. For streaming queries, this acts as a long-poll:
 * the server holds the connection until new rows are available or a timeout elapses.
 *
 * @param statementName - The unique statement name.
 * @param nextUrl - Full cursor URL from a previous response's `metadata.next`.
 *                  Omit on the first call.
 * @returns ResultsResponse containing `results.data` (array of rows) and
 *          `metadata.next` (cursor URL for the next page, if more data exists).
 * @throws ApiError on network or server errors.
 */
export const getStatementResults = async (
  statementName: string,
  nextUrl?: string
): Promise<ResultsResponse> => {
  try {
    let path: string;

    if (nextUrl) {
      // Continue from a previous cursor position
      const url = new URL(nextUrl);
      path = url.pathname + url.search;
    } else {
      path = `${buildStatementsUrl()}/${statementName}/results`;
    }

    const response = await confluentClient.get(path);
    const data: ResultsResponse = response.data;

    // If no data yet and there's a next URL, follow it once to get initial data
    if (!nextUrl && (!data.results?.data || data.results.data.length === 0) && data.metadata?.next) {
      const initialNextUrl = new URL(data.metadata.next);
      const initialNextPath = initialNextUrl.pathname + initialNextUrl.search;
      const paginatedResponse = await confluentClient.get(initialNextPath);
      return paginatedResponse.data;
    }

    return data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Cancel a running or pending statement by issuing a DELETE request.
 *
 * The Confluent Flink SQL API uses DELETE (not PATCH/PUT) for cancellation.
 * Returns 202 Accepted — the statement transitions to `CANCELLED` phase
 * asynchronously, so a subsequent {@link getStatementStatus} call may still
 * show `RUNNING` briefly before settling.
 *
 * Cancelling a streaming query is a normal workflow in Flink (not an error).
 *
 * @param statementName - The unique statement name to cancel.
 * @param _options - Deprecated parameter kept for backward compatibility. Ignored.
 * @throws ApiError on failure (e.g. 409 Conflict if already in a terminal state,
 *         404 if statement not found).
 */
export const cancelStatement = async (
  statementName: string,
  _options?: { stopAfterTerminatingQueries?: boolean }
): Promise<void> => {
  try {
    await confluentClient.delete(`${buildStatementsUrl()}/${statementName}`);
  } catch (error) {
    throw handleApiError(error);
  }
};

// Compute Pool Status types
export interface ComputePoolStatus {
  phase: string;
  currentCfu: number;
  maxCfu: number;
}

/**
 * Get compute pool status (phase and current CFU usage).
 * Uses Confluent Cloud Management API (FCPM) via fcpmClient.
 * @returns ComputePoolStatus with phase and current CFU
 * @throws ApiError if the request fails (e.g., 404 if pool not found, 500 server error)
 */
export const getComputePoolStatus = async (): Promise<ComputePoolStatus> => {
  try {
    const url = `/v2/compute-pools/${env.computePoolId}?environment=${env.environmentId}`;
    const response = await fcpmClient.get(url);
    const data = response.data;
    return {
      phase: data?.status?.phase ?? 'UNKNOWN',
      currentCfu: data?.status?.current_cfu ?? 0,
      maxCfu: data?.spec?.max_cfu ?? 0,
    };
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * List all statements from the Flink SQL gateway, following pagination automatically.
 *
 * Fetches pages sequentially, accumulating results. Use `onPage` for progressive
 * loading — the callback fires after each page with all rows collected so far,
 * letting the UI render partial results while loading continues.
 *
 * The server returns full URLs in `metadata.next`; this function extracts the
 * path + query to route through the Vite proxy.
 *
 * @param pageSize - Number of statements per page (default: 100).
 * @param onPage - Called after each page with a snapshot of all accumulated results.
 *                 Useful for progressive rendering in the History panel.
 * @param maxResults - Stop fetching once this many total results are collected.
 * @param filterUniqueId - If set, only return statements whose name includes this
 *                         string. Applied client-side after all pages are fetched.
 * @returns Array of StatementResponse objects, optionally filtered and capped.
 * @throws ApiError on network or server errors.
 */
export const listStatements = async (
  pageSize?: number,
  onPage?: (accumulated: StatementResponse[]) => void,
  maxResults?: number,
  filterUniqueId?: string
): Promise<StatementResponse[]> => {
  try {
    const size = pageSize ?? 100;
    let url: string = `${buildStatementsUrl()}?page_size=${size}`;
    const allStatements: StatementResponse[] = [];

    while (url) {
      const response = await confluentClient.get(url);
      const page = response.data.data || [];
      allStatements.push(...page);

      // Notify caller with accumulated results so far
      if (onPage && page.length > 0) {
        onPage([...allStatements]);
      }

      // Stop if we've reached the max results limit (before filtering)
      if (maxResults && allStatements.length >= maxResults) {
        break;
      }

      // Follow next page if available
      const nextUrl = response.data.metadata?.next;
      if (nextUrl && page.length > 0) {
        // next is a full URL — extract the path+query for the proxy
        const parsed = new URL(nextUrl);
        url = parsed.pathname + parsed.search;
      } else {
        url = '';
      }
    }

    let filtered = allStatements;
    if (filterUniqueId) {
      filtered = allStatements.filter((s) => s.name.includes(filterUniqueId));
    }

    return maxResults ? filtered.slice(0, maxResults) : filtered;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Get catalogs using SHOW CATALOGS
 */
export const getCatalogs = async (): Promise<string[]> => {
  try {
    const statement = await executeSQL('SHOW CATALOGS');
    const results = await pollForResults(statement.name);
    return results.map((row) => String(row[0]));
  } catch (error) {
    console.error('Failed to get catalogs:', error);
    return [env.flinkCatalog];
  }
};

/**
 * Get databases using SHOW DATABASES
 */
export const getDatabases = async (catalog: string): Promise<string[]> => {
  try {
    const statement = await executeSQL(`SHOW DATABASES IN \`${catalog}\``);
    const results = await pollForResults(statement.name);
    return results.map((row) => String(row[0]));
  } catch (error) {
    console.error('Failed to get databases:', error);
    return [env.flinkDatabase];
  }
};

/**
 * Get tables using SHOW TABLES
 */
export const getTables = async (catalog: string, database: string): Promise<string[]> => {
  try {
    const statement = await executeSQL(`SHOW TABLES IN \`${catalog}\`.\`${database}\``);
    const results = await pollForResults(statement.name);
    return results.map((row) => String(row[0]));
  } catch (error) {
    console.error('Failed to get tables:', error);
    return [];
  }
};

/**
 * Get views using SHOW VIEWS
 */
export const getViews = async (catalog: string, database: string): Promise<string[]> => {
  try {
    const statement = await executeSQL(`SHOW VIEWS IN \`${catalog}\`.\`${database}\``);
    const results = await pollForResults(statement.name);
    return results.map((row) => String(row[0]));
  } catch (error) {
    console.error('Failed to get views:', error);
    return [];
  }
};

/**
 * Get functions using SHOW FUNCTIONS
 */
export const getFunctions = async (catalog: string, database: string): Promise<string[]> => {
  try {
    const statement = await executeSQL(`SHOW USER FUNCTIONS IN \`${catalog}\`.\`${database}\``);
    const results = await pollForResults(statement.name);
    return results.map((row) => String(row[0]));
  } catch (error) {
    console.error('Failed to get functions:', error);
    return [];
  }
};

/**
 * Get table schema using DESCRIBE
 */
export const getTableSchema = async (catalog: string, database: string, table: string): Promise<Column[]> => {
  try {
    const statement = await executeSQL(`DESCRIBE \`${catalog}\`.\`${database}\`.\`${table}\``);
    const results = await pollForResults(statement.name);
    return results.map((row) => ({
      name: String(row[0]),
      type: String(row[1] || 'STRING'),
      nullable: true,
    }));
  } catch (error) {
    console.error('Failed to get table schema:', error);
    return [];
  }
};

/**
 * Poll for statement results until complete
 */
export const pollForResults = async (
  statementName: string,
  maxAttempts = 60,
  intervalMs = 1000
): Promise<unknown[][]> => {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const status = await getStatementStatus(statementName);
      const phase = status.status?.phase;

      if (phase === 'COMPLETED') {
        const resultsData = await getStatementResults(statementName);
        // Extract rows from results.data[].row format
        const rows = resultsData.results?.data || [];
        return rows.map((item) => item.row || []);
      }

      if (phase === 'FAILED') {
        throw new Error(status.status?.detail || 'Query failed');
      }

      // Still running/pending, wait and try again
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error) {
      console.error('Error polling for results:', error);
      throw error;
    }
  }

  throw new Error('Query timeout');
};
