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

// Generate unique statement name
const generateStatementName = (): string => {
  return `stmt-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`;
};

/**
 * Execute a SQL statement
 */
export const executeSQL = async (sql: string, name?: string): Promise<StatementResponse> => {
  const statementName = name || generateStatementName();

  const payload = {
    name: statementName,
    spec: {
      statement: sql,
      compute_pool_id: env.computePoolId,
      properties: {
        'sql.current-catalog': env.flinkCatalog,
        'sql.current-database': env.flinkDatabase,
        'sql.tables.scan.startup.mode': 'earliest-offset',
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
 * Delete/cancel a statement
 */
export const cancelStatement = async (statementName: string): Promise<void> => {
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
}

/**
 * Get compute pool status (phase and current CFU usage)
 */
export const getComputePoolStatus = async (): Promise<ComputePoolStatus | null> => {
  try {
    const url = `/v2/compute-pools/${env.computePoolId}?environment=${env.environmentId}`;
    const response = await fcpmClient.get(url);
    const data = response.data;
    return {
      phase: data?.status?.phase ?? 'UNKNOWN',
      currentCfu: data?.status?.current_cfu ?? 0,
    };
  } catch (error) {
    console.error('Failed to get compute pool status:', error);
    return null;
  }
};

/**
 * List all statements
 */
export const listStatements = async (pageSize?: number): Promise<StatementResponse[]> => {
  try {
    const url = pageSize ? `${buildStatementsUrl()}?page_size=${pageSize}` : buildStatementsUrl();
    const response = await confluentClient.get(url);
    return response.data.data || [];
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
