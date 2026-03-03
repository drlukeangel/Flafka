import { confluentClient, fcpmClient, handleApiError } from './confluent-client';
import { env } from '../config/environment';
import type { Column } from '../types';

// Build URL path for Flink SQL API
// URL format: /sql/v1/organizations/{org_id}/environments/{env_id}/statements
const buildStatementsUrl = (): string => {
  return `/sql/v1/organizations/${env.orgId}/environments/${env.environmentId}/statements`;
};

// Types
export interface StatementResponse {
  name: string;
  metadata?: {
    resource_version?: string;
    created_at?: string;
  };
  spec?: {
    statement?: string;
    statement_type?: string;
    compute_pool_id?: string;
    properties?: Record<string, string>;
  };
  status?: {
    phase: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    detail?: string;
    traits?: {
      is_append_only?: boolean;
      is_bounded?: boolean;
      schema?: {
        columns?: Array<{
          name: string;
          type: { type: string; nullable?: boolean };
        }>;
      };
    };
  };
}

export interface ResultsResponse {
  results?: {
    data?: Array<{
      row: unknown[];
    }>;
  };
  metadata?: {
    next?: string;
  };
}

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
 * Execute a SQL statement
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
 * Get statement status by name
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
 * Get statement results with pagination support.
 * Pass a nextUrl to continue fetching from a previous cursor position.
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
 * Cancel/stop a statement using DELETE endpoint.
 * Per Confluent Flink SQL API: DELETE /statements/{name} → 202 Accepted
 * @param statementName - The name of the statement to cancel
 * @param _options - Deprecated, kept for backward compatibility (DELETE has no body)
 * @throws ApiError if the delete request fails (e.g., 409 Conflict if already in terminal state)
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
 * List all statements (follows pagination to collect all pages).
 * Pass onPage callback to receive results progressively as each page loads.
 */
export const listStatements = async (
  pageSize?: number,
  onPage?: (accumulated: StatementResponse[]) => void
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

    return allStatements;
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
