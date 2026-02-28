import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as flinkApi from '../../api/flink-api'
import { confluentClient } from '../../api/confluent-client'
import * as mocks from '../../test/mocks/api'

vi.mock('../../api/confluent-client', () => ({
  confluentClient: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
  handleApiError: (error: unknown) => {
    if (error instanceof Error) return new Error(error.message)
    return new Error('Unknown error')
  },
}))

describe('[@api-catalog] Catalog and Schema Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

  // ============================================================================
  // getCatalogs() Tests
  // ============================================================================

  describe('[@api-catalog] getCatalogs', () => {
    it('should fetch catalogs with valid SQL execution', async () => {
      // Mock executeSQL returns a statement
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      // First poll: COMPLETED immediately (skip RUNNING to avoid fake timer issues)
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { name: statement.name, status: { phase: 'COMPLETED' } },
      })

      // Get results
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          results: {
            data: [{ row: ['default'] }, { row: ['system'] }],
          },
          metadata: {},
        },
      })

      const result = await flinkApi.getCatalogs()

      expect(result).toEqual(['default', 'system'])
      expect(confluentClient.post).toHaveBeenCalled()
    })

    it('should return fallback catalog on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('API Error'))

      const result = await flinkApi.getCatalogs()

      // Should return default catalog from environment
      expect(result).toHaveLength(1)
      expect(result[0]).toBeTruthy()
    })

    it('should handle empty results', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: { data: [] },
            metadata: {},
          },
        })

      const result = await flinkApi.getCatalogs()

      expect(result).toEqual([])
    })

    it('should handle 400 Bad Request error', async () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Invalid SQL syntax' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getCatalogs()

      // Should fall back to default catalog
      expect(result).toHaveLength(1)
    })

    it('should handle 401 Unauthorized error', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getCatalogs()

      expect(result).toHaveLength(1)
    })

    it('should handle 500 Server Error', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getCatalogs()

      expect(result).toHaveLength(1)
    })

    it('should handle network timeout', async () => {
      const error = { code: 'ECONNABORTED', message: 'Request timeout' }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getCatalogs()

      expect(result).toHaveLength(1)
    })

    it('should handle ECONNREFUSED error', async () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getCatalogs()

      expect(result).toHaveLength(1)
    })

    it('should handle multiple catalogs correctly', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [
                { row: ['catalog1'] },
                { row: ['catalog2'] },
                { row: ['catalog3'] },
              ],
            },
            metadata: {},
          },
        })

      const result = await flinkApi.getCatalogs()

      expect(result).toEqual(['catalog1', 'catalog2', 'catalog3'])
    })
  })

  // ============================================================================
  // getDatabases() Tests
  // ============================================================================

  describe('[@api-catalog] getDatabases', () => {
    it('should fetch databases for a given catalog', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [{ row: ['public'] }, { row: ['test'] }],
            },
            metadata: {},
          },
        })

      const result = await flinkApi.getDatabases('default')

      expect(result).toEqual(['public', 'test'])
      expect(confluentClient.post).toHaveBeenCalled()
      const call = vi.mocked(confluentClient.post).mock.calls[0]
      expect(call[1]).toHaveProperty('spec.statement', 'SHOW DATABASES IN `default`')
    })

    it('should escape catalog name with backticks', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: { data: [{ row: ['db1'] }] },
            metadata: {},
          },
        })

      await flinkApi.getDatabases('my-catalog')

      const call = vi.mocked(confluentClient.post).mock.calls[0]
      expect(call[1]).toHaveProperty('spec.statement', 'SHOW DATABASES IN `my-catalog`')
    })

    it('should return fallback database on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('API Error'))

      const result = await flinkApi.getDatabases('default')

      expect(result).toHaveLength(1)
      expect(result[0]).toBeTruthy()
    })

    it('should handle empty databases list', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: { data: [] },
            metadata: {},
          },
        })

      const result = await flinkApi.getDatabases('default')

      expect(result).toEqual([])
    })

    it('should handle 404 Not Found', async () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'Catalog not found' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getDatabases('nonexistent')

      expect(result).toHaveLength(1)
    })

    it('should handle 503 Service Unavailable', async () => {
      const error = {
        response: {
          status: 503,
          data: { message: 'Service temporarily unavailable' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getDatabases('default')

      expect(result).toHaveLength(1)
    })

    it('should handle failed statement during polling', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      // First poll: RUNNING, Second poll: FAILED
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'RUNNING' } },
        })
        .mockResolvedValueOnce({
          data: {
            name: statement.name,
            status: { phase: 'FAILED', detail: 'Database access denied' },
          },
        })

      const result = await flinkApi.getDatabases('default')

      expect(result).toHaveLength(1)
    })

    it('should handle multiple databases', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [
                { row: ['db1'] },
                { row: ['db2'] },
                { row: ['db3'] },
              ],
            },
            metadata: {},
          },
        })

      const result = await flinkApi.getDatabases('default')

      expect(result).toEqual(['db1', 'db2', 'db3'])
    })
  })

  // ============================================================================
  // getTables() Tests
  // ============================================================================

  describe('[@api-catalog] getTables', () => {
    it('should fetch tables for a given catalog and database', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [{ row: ['users'] }, { row: ['orders'] }],
            },
            metadata: {},
          },
        })

      const result = await flinkApi.getTables('default', 'public')

      expect(result).toEqual(['users', 'orders'])
      const call = vi.mocked(confluentClient.post).mock.calls[0]
      expect(call[1]).toHaveProperty('spec.statement', 'SHOW TABLES IN `default`.`public`')
    })

    it('should escape both catalog and database names', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: { data: [{ row: ['table1'] }] },
            metadata: {},
          },
        })

      await flinkApi.getTables('my-catalog', 'my-database')

      const call = vi.mocked(confluentClient.post).mock.calls[0]
      expect(call[1]).toHaveProperty('spec.statement', 'SHOW TABLES IN `my-catalog`.`my-database`')
    })

    it('should return empty array on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('API Error'))

      const result = await flinkApi.getTables('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle empty tables list', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: { data: [] },
            metadata: {},
          },
        })

      const result = await flinkApi.getTables('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle 400 Bad Request', async () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Invalid schema' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTables('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle 404 Not Found', async () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'Database not found' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTables('default', 'nonexistent')

      expect(result).toEqual([])
    })

    it('should handle 500 Server Error', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTables('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle network failures', async () => {
      const error = { code: 'ECONNREFUSED' }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTables('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle multiple tables', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [
                { row: ['users'] },
                { row: ['orders'] },
                { row: ['products'] },
              ],
            },
            metadata: {},
          },
        })

      const result = await flinkApi.getTables('default', 'public')

      expect(result).toEqual(['users', 'orders', 'products'])
    })
  })

  // ============================================================================
  // getViews() Tests
  // ============================================================================

  describe('[@api-catalog] getViews', () => {
    it('should fetch views for a given catalog and database', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [{ row: ['active_users'] }, { row: ['recent_orders'] }],
            },
            metadata: {},
          },
        })

      const result = await flinkApi.getViews('default', 'public')

      expect(result).toEqual(['active_users', 'recent_orders'])
      const call = vi.mocked(confluentClient.post).mock.calls[0]
      expect(call[1]).toHaveProperty('spec.statement', 'SHOW VIEWS IN `default`.`public`')
    })

    it('should return empty array on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('API Error'))

      const result = await flinkApi.getViews('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle empty views list', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: { data: [] },
            metadata: {},
          },
        })

      const result = await flinkApi.getViews('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle 401 Unauthorized', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getViews('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle 500 Server Error', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getViews('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle 503 Service Unavailable', async () => {
      const error = {
        response: {
          status: 503,
          data: { message: 'Service temporarily unavailable' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getViews('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle network timeout', async () => {
      const error = { code: 'ECONNABORTED' }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getViews('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle multiple views', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [
                { row: ['view1'] },
                { row: ['view2'] },
                { row: ['view3'] },
              ],
            },
            metadata: {},
          },
        })

      const result = await flinkApi.getViews('default', 'public')

      expect(result).toEqual(['view1', 'view2', 'view3'])
    })
  })

  // ============================================================================
  // getFunctions() Tests
  // ============================================================================

  describe('[@api-catalog] getFunctions', () => {
    it('should fetch functions for a given catalog and database', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [{ row: ['custom_func'] }, { row: ['calc_total'] }],
            },
            metadata: {},
          },
        })

      const result = await flinkApi.getFunctions('default', 'public')

      expect(result).toEqual(['custom_func', 'calc_total'])
      const call = vi.mocked(confluentClient.post).mock.calls[0]
      expect(call[1]).toHaveProperty('spec.statement', 'SHOW USER FUNCTIONS IN `default`.`public`')
    })

    it('should return empty array on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('API Error'))

      const result = await flinkApi.getFunctions('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle empty functions list', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: { data: [] },
            metadata: {},
          },
        })

      const result = await flinkApi.getFunctions('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle 400 Bad Request', async () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Invalid request' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getFunctions('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle 404 Not Found', async () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'Database not found' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getFunctions('default', 'nonexistent')

      expect(result).toEqual([])
    })

    it('should handle 500 Server Error', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getFunctions('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle ECONNREFUSED error', async () => {
      const error = { code: 'ECONNREFUSED' }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getFunctions('default', 'public')

      expect(result).toEqual([])
    })

    it('should handle multiple functions', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: statement,
      })

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: { name: statement.name, status: { phase: 'COMPLETED' } },
        })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [
                { row: ['func1'] },
                { row: ['func2'] },
                { row: ['func3'] },
              ],
            },
            metadata: {},
          },
        })

      const result = await flinkApi.getFunctions('default', 'public')

      expect(result).toEqual(['func1', 'func2', 'func3'])
    })
  })

  // ============================================================================
  // getTableSchema() Tests
  // ============================================================================

  describe('[@api-catalog] getTableSchema', () => {
    it('should fetch table schema with columns and types', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      let getCallCount = 0

      vi.mocked(confluentClient.post).mockImplementation(async () => ({
        data: statement,
      }))

      vi.mocked(confluentClient.get).mockImplementation(async () => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            data: { name: statement.name, status: { phase: 'COMPLETED' } },
          }
        } else {
          return {
            data: {
              results: {
                data: [
                  { row: ['id', 'BIGINT'] },
                  { row: ['name', 'STRING'] },
                  { row: ['age', 'INT'] },
                ],
              },
              metadata: {},
            },
          }
        }
      })

      const result = await flinkApi.getTableSchema('default', 'public', 'users')

      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ name: 'id', type: 'BIGINT', nullable: true })
      expect(result[1]).toEqual({ name: 'name', type: 'STRING', nullable: true })
      expect(result[2]).toEqual({ name: 'age', type: 'INT', nullable: true })
    })

    it('should escape catalog, database, and table names with backticks', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      let getCallCount = 0

      vi.mocked(confluentClient.post).mockImplementation(async () => ({
        data: statement,
      }))

      vi.mocked(confluentClient.get).mockImplementation(async () => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            data: { name: statement.name, status: { phase: 'COMPLETED' } },
          }
        } else {
          return {
            data: {
              results: {
                data: [{ row: ['col1', 'STRING'] }],
              },
              metadata: {},
            },
          }
        }
      })

      await flinkApi.getTableSchema('my-catalog', 'my-database', 'my-table')

      const call = vi.mocked(confluentClient.post).mock.calls[0]
      expect(call[1]).toHaveProperty(
        'spec.statement',
        'DESCRIBE `my-catalog`.`my-database`.`my-table`'
      )
    })

    it('should handle columns with no type (default to STRING)', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      let getCallCount = 0

      vi.mocked(confluentClient.post).mockImplementation(async () => ({
        data: statement,
      }))

      vi.mocked(confluentClient.get).mockImplementation(async () => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            data: { name: statement.name, status: { phase: 'COMPLETED' } },
          }
        } else {
          return {
            data: {
              results: {
                data: [
                  { row: ['col1'] }, // No type provided
                  { row: ['col2', null] }, // Null type
                ],
              },
              metadata: {},
            },
          }
        }
      })

      const result = await flinkApi.getTableSchema('default', 'public', 'test')

      expect(result[0].type).toBe('STRING')
      expect(result[1].type).toBe('STRING')
    })

    it('should return empty array on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('API Error'))

      const result = await flinkApi.getTableSchema('default', 'public', 'nonexistent')

      expect(result).toEqual([])
    })

    it('should handle empty schema', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      let getCallCount = 0

      vi.mocked(confluentClient.post).mockImplementation(async () => ({
        data: statement,
      }))

      vi.mocked(confluentClient.get).mockImplementation(async () => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            data: { name: statement.name, status: { phase: 'COMPLETED' } },
          }
        } else {
          return {
            data: {
              results: { data: [] },
              metadata: {},
            },
          }
        }
      })

      const result = await flinkApi.getTableSchema('default', 'public', 'test')

      expect(result).toEqual([])
    })

    it('should handle large schemas with many columns', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      let getCallCount = 0

      vi.mocked(confluentClient.post).mockImplementation(async () => ({
        data: statement,
      }))

      const rows = Array.from({ length: 100 }, (_, i) => ({
        row: [`col${i}`, 'VARCHAR'],
      }))

      vi.mocked(confluentClient.get).mockImplementation(async () => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            data: { name: statement.name, status: { phase: 'COMPLETED' } },
          }
        } else {
          return {
            data: {
              results: { data: rows },
              metadata: {},
            },
          }
        }
      })

      const result = await flinkApi.getTableSchema('default', 'public', 'large')

      expect(result).toHaveLength(100)
      expect(result[0].name).toBe('col0')
      expect(result[99].name).toBe('col99')
      expect(result[0].type).toBe('VARCHAR')
    })

    it('should handle column names with special characters', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      let getCallCount = 0

      vi.mocked(confluentClient.post).mockImplementation(async () => ({
        data: statement,
      }))

      vi.mocked(confluentClient.get).mockImplementation(async () => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            data: { name: statement.name, status: { phase: 'COMPLETED' } },
          }
        } else {
          return {
            data: {
              results: {
                data: [
                  { row: ['column with spaces', 'STRING'] },
                  { row: ['column-with-dashes', 'INT'] },
                  { row: ['column.with.dots', 'DOUBLE'] },
                ],
              },
              metadata: {},
            },
          }
        }
      })

      const result = await flinkApi.getTableSchema('default', 'public', 'special')

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('column with spaces')
      expect(result[0].type).toBe('STRING')
      expect(result[1].name).toBe('column-with-dashes')
      expect(result[1].type).toBe('INT')
      expect(result[2].name).toBe('column.with.dots')
      expect(result[2].type).toBe('DOUBLE')
    })

    it('should handle various Flink data types', async () => {
      const statement = mocks.mockStatementWithStatus('PENDING')
      let getCallCount = 0

      vi.mocked(confluentClient.post).mockImplementation(async () => ({
        data: statement,
      }))

      vi.mocked(confluentClient.get).mockImplementation(async () => {
        getCallCount++
        if (getCallCount === 1) {
          return {
            data: { name: statement.name, status: { phase: 'COMPLETED' } },
          }
        } else {
          return {
            data: {
              results: {
                data: [
                  { row: ['id', 'BIGINT'] },
                  { row: ['email', 'VARCHAR'] },
                  { row: ['created', 'TIMESTAMP(3)'] },
                  { row: ['data', 'MAP<STRING, STRING>'] },
                  { row: ['tags', 'ARRAY<STRING>'] },
                ],
              },
              metadata: {},
            },
          }
        }
      })

      const result = await flinkApi.getTableSchema('default', 'public', 'users')

      expect(result).toHaveLength(5)
      expect(result[0].name).toBe('id')
      expect(result[0].type).toBe('BIGINT')
      expect(result[1].name).toBe('email')
      expect(result[1].type).toBe('VARCHAR')
      expect(result[2].name).toBe('created')
      expect(result[2].type).toBe('TIMESTAMP(3)')
      expect(result[3].name).toBe('data')
      expect(result[3].type).toBe('MAP<STRING, STRING>')
      expect(result[4].name).toBe('tags')
      expect(result[4].type).toBe('ARRAY<STRING>')
    })

    it('should handle 400 Bad Request', async () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Invalid table reference' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTableSchema('default', 'public', 'invalid')

      expect(result).toEqual([])
    })

    it('should handle 401 Unauthorized', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTableSchema('default', 'public', 'users')

      expect(result).toEqual([])
    })

    it('should handle 404 Not Found', async () => {
      const error = {
        response: {
          status: 404,
          data: { message: 'Table not found' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTableSchema('default', 'public', 'nonexistent')

      expect(result).toEqual([])
    })

    it('should handle 500 Server Error', async () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTableSchema('default', 'public', 'users')

      expect(result).toEqual([])
    })

    it('should handle 503 Service Unavailable', async () => {
      const error = {
        response: {
          status: 503,
          data: { message: 'Service temporarily unavailable' },
        },
      }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTableSchema('default', 'public', 'users')

      expect(result).toEqual([])
    })

    it('should handle network timeout', async () => {
      const error = { code: 'ECONNABORTED' }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTableSchema('default', 'public', 'users')

      expect(result).toEqual([])
    })

    it('should handle ECONNREFUSED error', async () => {
      const error = { code: 'ECONNREFUSED' }
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      const result = await flinkApi.getTableSchema('default', 'public', 'users')

      expect(result).toEqual([])
    })

    it('should handle FAILED status during polling', async () => {
      const statement = mocks.mockStatementWithStatus('FAILED')
      let getCallCount = 0

      // Mock post to return a FAILED statement
      vi.mocked(confluentClient.post).mockImplementation(async () => ({
        data: statement,
      }))

      // Mock get to check status and return FAILED
      vi.mocked(confluentClient.get).mockImplementation(async () => {
        getCallCount++
        if (getCallCount === 1) {
          // First get: status check returns FAILED
          return {
            data: {
              name: statement.name,
              status: { phase: 'FAILED', detail: 'Table does not exist' },
            },
          }
        }
        // If called again, return empty to avoid infinite loops
        return {
          data: {
            results: { data: [] },
            metadata: {},
          },
        }
      })

      const result = await flinkApi.getTableSchema('default', 'public', 'users')

      expect(result).toEqual([])
    })
  })
})
