import type { StatementResponse, ResultsResponse } from '../../api/flink-api'

/**
 * Factory to create mock statement responses for tests
 */
export const mockStatement = (overrides?: Partial<StatementResponse>): StatementResponse => {
  const timestamp = new Date().toISOString()
  return {
    name: `stmt-${Date.now().toString(36)}`,
    metadata: { resource_version: '1' },
    spec: {
      statement: 'SELECT 1',
      statement_type: 'SELECT',
      compute_pool_id: 'test-pool',
      properties: {
        'sql.current-catalog': 'test_catalog',
        'sql.current-database': 'test_db',
      },
    },
    status: {
      phase: 'COMPLETED',
      traits: {
        is_append_only: false,
        is_bounded: true,
        schema: {
          columns: [{ name: 'col1', type: { type: 'STRING', nullable: false } }],
        },
      },
    },
    ...overrides,
  }
}

/**
 * Factory to create mock result responses
 */
export const mockResults = (overrides?: Partial<ResultsResponse>): ResultsResponse => {
  return {
    results: {
      data: [{ row: ['value1'] }],
    },
    metadata: { next: undefined },
    ...overrides,
  }
}

/**
 * Helper to create a statement with a specific status
 */
export const mockStatementWithStatus = (
  phase: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
): StatementResponse => {
  return mockStatement({
    status: { phase, detail: phase === 'FAILED' ? 'Test error' : undefined },
  })
}
