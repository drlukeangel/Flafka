import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeSQL, getStatementStatus, getStatementResults, pollForResults, cancelStatement, listStatements, getComputePoolStatus, getCatalogs, getDatabases, getTables, getViews, getFunctions, getTableSchema, getStatementExceptions, getStatementErrorDetail } from '../../api/flink-api'
import * as flinkApi from '../../api/flink-api'
import { confluentClient, fcpmClient } from '../../api/confluent-client'

vi.mock('../../api/confluent-client', () => ({
  confluentClient: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
  fcpmClient: {
    get: vi.fn(),
  },
  handleApiError: (error: unknown) => {
    if (error instanceof Error) return new Error(error.message)
    return new Error('Unknown error')
  },
}))

describe('[@api] [@core] flink-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('[@api] executeSQL', () => {
    it('should execute SQL statement with provided name', async () => {
      const mockResponse = {
        data: {
          name: 'test-stmt',
          spec: { statement: 'SELECT 1' },
          status: { phase: 'PENDING' as const },
        },
      }

      vi.mocked(confluentClient.post).mockResolvedValueOnce(mockResponse)

      const result = await executeSQL('SELECT 1', 'test-stmt')

      expect(confluentClient.post).toHaveBeenCalled()
      expect(result.name).toBe('test-stmt')
      expect(result.spec?.statement).toBe('SELECT 1')
    })

    it('should send correct payload with properties', async () => {
      const mockResponse = {
        data: {
          name: 'auto-generated-name',
          status: { phase: 'PENDING' as const },
        },
      }

      vi.mocked(confluentClient.post).mockResolvedValueOnce(mockResponse)

      await executeSQL('SELECT * FROM table')

      const call = vi.mocked(confluentClient.post).mock.calls[0]
      const [_url, payload] = call as [string, unknown]

      expect(payload).toMatchObject({
        name: expect.stringMatching(/^[a-z]+-[a-z]+-[a-z0-9]+-[0-9a-f]{4}$/i),
        spec: {
          statement: 'SELECT * FROM table',
          compute_pool_id: expect.any(String),
          properties: {
            'sql.current-catalog': expect.any(String),
            'sql.current-database': expect.any(String),
          },
        },
      })
    })

    it('should throw error on API failure', async () => {
      const error = new Error('API Error')
      vi.mocked(confluentClient.post).mockRejectedValueOnce(error)

      await expect(executeSQL('SELECT 1')).rejects.toThrow()
    })
  })

  describe('[@api] getStatementStatus', () => {
    it('should fetch statement status by name', async () => {
      const mockResponse = {
        data: {
          name: 'stmt-123',
          status: { phase: 'RUNNING' as const },
        },
      }

      vi.mocked(confluentClient.get).mockResolvedValueOnce(mockResponse)

      const result = await getStatementStatus('stmt-123')

      expect(confluentClient.get).toHaveBeenCalledWith(expect.stringContaining('stmt-123'))
      expect(result.status?.phase).toBe('RUNNING')
    })

    it('should throw error on API failure', async () => {
      const error = new Error('Not found')
      vi.mocked(confluentClient.get).mockRejectedValueOnce(error)

      await expect(getStatementStatus('nonexistent')).rejects.toThrow()
    })
  })

  describe('[@api] getStatementResults', () => {
    it('should fetch results with pagination support', async () => {
      const mockResponse = {
        data: {
          results: {
            data: [{ row: ['value1', 'value2'] }],
          },
          metadata: { next: '/api/next' },
        },
      }

      vi.mocked(confluentClient.get).mockResolvedValueOnce(mockResponse)

      const result = await getStatementResults('stmt-123')

      expect(confluentClient.get).toHaveBeenCalled()
      expect(result.results?.data).toHaveLength(1)
      expect(result.metadata?.next).toBe('/api/next')
    })

    it('should support nextUrl for pagination', async () => {
      const mockResponse = {
        data: {
          results: {
            data: [{ row: ['next-value'] }],
          },
        },
      }

      vi.mocked(confluentClient.get).mockResolvedValueOnce(mockResponse)

      await getStatementResults('stmt-123', 'https://api.example.com/next')

      const call = vi.mocked(confluentClient.get).mock.calls[0]
      expect(call[0]).toContain('next')
    })

    it('should handle empty results', async () => {
      const mockResponse = {
        data: {
          results: { data: [] },
          metadata: {},
        },
      }

      vi.mocked(confluentClient.get).mockResolvedValueOnce(mockResponse)

      const result = await getStatementResults('stmt-123')

      expect(result.results?.data).toEqual([])
    })
  })

  describe('[@api] statement name generation', () => {
    it('should generate word-word-uniqueId names with shared unique ID suffix', async () => {
      const names: string[] = []

      for (let i = 0; i < 5; i++) {
        vi.mocked(confluentClient.post).mockImplementationOnce((_url, payload: unknown) => {
          const body = payload as { name: string }
          names.push(body.name)
          return Promise.resolve({ data: { name: body.name, status: { phase: 'PENDING' as const } } })
        })
        await executeSQL('SELECT 1')
      }

      expect(names).toHaveLength(5)
      for (const name of names) {
        // name format: <adjective>-<noun>-<uniqueId>-<hex4>
        expect(name).toMatch(/^[a-z]+-[a-z]+-[a-z0-9]+-[0-9a-f]{4}$/i)
      }

      // All names share the same unique ID (third segment)
      const uniqueIds = names.map((n) => {
        const parts = n.split('-')
        return parts[2]
      })
      expect(new Set(uniqueIds).size).toBe(1)
    })
  })

  describe('[@api] pollForResults', () => {
    it('COMPLETED path: polls until phase is COMPLETED, returns rows', async () => {
      // First poll: RUNNING
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({ data: { name: 'stmt-abc', status: { phase: 'RUNNING' } } })
        // Second poll: COMPLETED
        .mockResolvedValueOnce({ data: { name: 'stmt-abc', status: { phase: 'COMPLETED' } } })
        // getStatementResults call
        .mockResolvedValueOnce({
          data: {
            results: { data: [{ row: ['hello', 42] }, { row: ['world', 99] }] },
            metadata: {},
          },
        })

      const result = await pollForResults('stmt-abc', 10, 0)

      expect(result).toEqual([['hello', 42], ['world', 99]])
      // get was called 3 times: status(RUNNING), status(COMPLETED), results
      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(3)
    })

    it('FAILED phase: throws error with message from status.detail', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          name: 'stmt-fail',
          status: { phase: 'FAILED', detail: 'Syntax error near SELECT' },
        },
      })

      await expect(pollForResults('stmt-fail', 10, 0)).rejects.toThrow('Syntax error near SELECT')
    })

    it('FAILED phase: throws generic message when detail is missing', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          name: 'stmt-fail',
          status: { phase: 'FAILED' },
        },
      })

      await expect(pollForResults('stmt-fail', 10, 0)).rejects.toThrow('Query failed')
    })

    it('maxAttempts exhausted: throws timeout error', async () => {
      // Always return RUNNING so we exhaust attempts
      vi.mocked(confluentClient.get).mockResolvedValue({
        data: { name: 'stmt-timeout', status: { phase: 'RUNNING' } },
      })

      await expect(pollForResults('stmt-timeout', 3, 0)).rejects.toThrow('Query timeout')
      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(3)
    })

    it('CANCELLED phase: throws after exhausting maxAttempts (no early-exit for CANCELLED)', async () => {
      // CANCELLED is not handled as an early-exit in the implementation;
      // the loop runs until maxAttempts and then throws 'Query timeout'
      vi.mocked(confluentClient.get).mockResolvedValue({
        data: { name: 'stmt-cancel', status: { phase: 'CANCELLED' } },
      })

      await expect(pollForResults('stmt-cancel', 2, 0)).rejects.toThrow('Query timeout')
    })
  })

  describe('[@api] getStatementResults - initial cursor follow', () => {
    it('auto-fetches next page when first response has no data but metadata.next exists', async () => {
      const emptyFirstResponse = {
        data: {
          results: { data: [] },
          metadata: { next: 'https://api.confluent.cloud/sql/v1/orgs/o1/envs/e1/statements/stmt-xyz/results?page_token=tok123' },
        },
      }
      const secondPageResponse = {
        data: {
          results: { data: [{ row: ['cursor-row'] }] },
          metadata: {},
        },
      }

      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce(emptyFirstResponse)
        .mockResolvedValueOnce(secondPageResponse)

      const result = await getStatementResults('stmt-xyz')

      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(2)
      // Second call should use the pathname+search of the next URL
      const secondCallUrl = vi.mocked(confluentClient.get).mock.calls[1][0] as string
      expect(secondCallUrl).toContain('page_token=tok123')
      expect(result.results?.data).toEqual([{ row: ['cursor-row'] }])
    })
  })

  describe('[@api] cancelStatement', () => {
    it('should DELETE /statements/{name} to cancel a statement', async () => {
      vi.mocked(confluentClient.delete).mockResolvedValueOnce({ data: {} })

      await cancelStatement('stmt-to-cancel')

      expect(vi.mocked(confluentClient.delete)).toHaveBeenCalledTimes(1)
      const [calledUrl] = vi.mocked(confluentClient.delete).mock.calls[0] as [string]
      expect(calledUrl).toContain('stmt-to-cancel')
      expect(calledUrl).not.toContain('/cancel')
    })

    it('accepts legacy options param without error', async () => {
      vi.mocked(confluentClient.delete).mockResolvedValueOnce({ data: {} })

      await cancelStatement('stmt-to-cancel', { stopAfterTerminatingQueries: false })

      expect(vi.mocked(confluentClient.delete)).toHaveBeenCalledTimes(1)
    })

    it('resolves without error on successful cancellation', async () => {
      vi.mocked(confluentClient.delete).mockResolvedValueOnce({ data: {} })

      await expect(cancelStatement('stmt-to-cancel')).resolves.toBeUndefined()
    })

    it('should throw on 409 Conflict (already cancelled)', async () => {
      const error = new Error('409 Conflict')
      vi.mocked(confluentClient.delete).mockRejectedValueOnce(error)

      await expect(cancelStatement('stmt-to-cancel')).rejects.toThrow('409 Conflict')
    })

    it('should throw on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(confluentClient.delete).mockRejectedValueOnce(error)

      await expect(cancelStatement('stmt-to-cancel')).rejects.toThrow('500 Internal Server Error')
    })

    it('throws when the API returns an error', async () => {
      vi.mocked(confluentClient.delete).mockRejectedValueOnce(new Error('403 Forbidden'))

      await expect(cancelStatement('stmt-to-cancel')).rejects.toThrow()
    })
  })

  describe('[@api] listStatements', () => {
    it('calls API with page_size query param when provided', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      await listStatements(25)

      const calledUrl = vi.mocked(confluentClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain('page_size=25')
    })

    it('defaults to page_size=100 when not provided', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      await listStatements()

      const calledUrl = vi.mocked(confluentClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain('page_size=100')
    })

    it('returns response.data.data array when present', async () => {
      const statements = [
        { name: 'stmt-1', status: { phase: 'COMPLETED' as const } },
        { name: 'stmt-2', status: { phase: 'RUNNING' as const } },
      ]

      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { data: statements },
      })

      const result = await listStatements()

      expect(result).toEqual(statements)
    })

    it('returns empty array when response.data.data is absent', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {},
      })

      const result = await listStatements()

      expect(result).toEqual([])
    })
  })

  describe('[@api] executeSQL with session properties', () => {
    it('filters out invalid session properties', async () => {
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: { name: 'stmt-props', status: { phase: 'PENDING' as const } },
      })

      await executeSQL('SELECT 1', 'stmt-props', {
        'sql.current-catalog': 'my-catalog',
        'sql.current-database': 'my-db',
        'invalid.property': 'should-be-filtered',
        'sql.local-time-zone': 'UTC',
      })

      const [, payload] = vi.mocked(confluentClient.post).mock.calls[0] as [string, any]
      expect(payload.spec.properties['sql.current-catalog']).toBe('my-catalog')
      expect(payload.spec.properties['sql.current-database']).toBe('my-db')
      expect(payload.spec.properties['sql.local-time-zone']).toBe('UTC')
      expect(payload.spec.properties['invalid.property']).toBeUndefined()
    })

    it('handles undefined session properties', async () => {
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: { name: 'stmt-no-props', status: { phase: 'PENDING' as const } },
      })

      await executeSQL('SELECT 1', 'stmt-no-props', undefined)

      const [, payload] = vi.mocked(confluentClient.post).mock.calls[0] as [string, any]
      expect(payload.spec.properties).toBeDefined()
    })
  })

  describe('[@api] getStatementExceptions', () => {
    it('returns formatted exceptions when present', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          data: [
            { name: 'FlinkError', message: 'Column not found' },
            { name: 'ValidationError', message: 'Invalid syntax' },
          ],
        },
      })

      const result = await getStatementExceptions('stmt-exc')

      expect(result).toBe('FlinkError: Column not found\n\nValidationError: Invalid syntax')
    })

    it('returns null when no exceptions exist', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      const result = await getStatementExceptions('stmt-no-exc')

      expect(result).toBeNull()
    })

    it('returns null when data array is missing', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {},
      })

      const result = await getStatementExceptions('stmt-missing')

      expect(result).toBeNull()
    })

    it('returns null on API error (catches silently)', async () => {
      vi.mocked(confluentClient.get).mockRejectedValueOnce(new Error('500'))

      const result = await getStatementExceptions('stmt-err')

      expect(result).toBeNull()
    })

    it('formats exceptions with only message (no name)', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          data: [{ message: 'Something broke' }],
        },
      })

      const result = await getStatementExceptions('stmt-msg-only')

      expect(result).toBe('Something broke')
    })

    it('formats exceptions with only name (no message)', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          data: [{ name: 'ErrorName' }],
        },
      })

      const result = await getStatementExceptions('stmt-name-only')

      expect(result).toBe('ErrorName')
    })
  })

  describe('[@api] getStatementErrorDetail', () => {
    it('returns provided detail immediately if it exists', async () => {
      const result = await getStatementErrorDetail('stmt', 'Provided detail')

      expect(result).toBe('Provided detail')
      // Should not call any API
      expect(confluentClient.get).not.toHaveBeenCalled()
    })

    it('falls back to exceptions endpoint when detail is undefined', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          data: [{ name: 'Error', message: 'From exceptions' }],
        },
      })

      const result = await getStatementErrorDetail('stmt-detail')

      expect(result).toBe('Error: From exceptions')
    })

    it('returns generic message when both detail and exceptions are empty', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      const result = await getStatementErrorDetail('stmt-generic')

      expect(result).toBe('Query failed')
    })
  })

  describe('[@api] getStatementResults - edge cases', () => {
    it('does NOT auto-fetch next page when nextUrl parameter is provided', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          results: { data: [] },
          metadata: { next: 'https://api.confluent.cloud/some/other/path' },
        },
      })

      const result = await getStatementResults('stmt-next', 'https://api.confluent.cloud/first/path')

      // Should only make one call (uses the provided nextUrl, does not follow auto-fetch logic)
      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(1)
    })

    it('does NOT auto-fetch when first response has data (even with metadata.next)', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          results: { data: [{ row: ['value'] }] },
          metadata: { next: 'https://api.confluent.cloud/next' },
        },
      })

      const result = await getStatementResults('stmt-has-data')

      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(1)
      expect(result.results?.data).toEqual([{ row: ['value'] }])
    })

    it('does NOT auto-fetch when first response has no data and no next URL', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          results: { data: [] },
          metadata: {},
        },
      })

      const result = await getStatementResults('stmt-no-next')

      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(1)
    })

    it('does NOT auto-fetch when results is undefined and metadata.next is absent', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { metadata: {} },
      })

      const result = await getStatementResults('stmt-no-results')

      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(1)
    })

    it('throws on API failure', async () => {
      vi.mocked(confluentClient.get).mockRejectedValueOnce(new Error('Connection error'))

      await expect(getStatementResults('stmt-fail')).rejects.toThrow()
    })
  })

  describe('[@api] listStatements - pagination', () => {
    it('follows pagination across multiple pages', async () => {
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: {
            data: [{ name: 'stmt-1' }],
            metadata: { next: 'https://api.confluent.cloud/sql/v1/statements?page_token=tok2' },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ name: 'stmt-2' }],
            metadata: {},
          },
        })

      const result = await listStatements(10)

      expect(result).toEqual([{ name: 'stmt-1' }, { name: 'stmt-2' }])
      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(2)
    })

    it('calls onPage callback with accumulated results', async () => {
      const onPage = vi.fn()
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: {
            data: [{ name: 'stmt-1' }],
            metadata: { next: 'https://api.confluent.cloud/sql/v1/statements?page_token=tok2' },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [{ name: 'stmt-2' }],
            metadata: {},
          },
        })

      await listStatements(10, onPage)

      expect(onPage).toHaveBeenCalledTimes(2)
      expect(onPage).toHaveBeenNthCalledWith(1, [{ name: 'stmt-1' }])
      expect(onPage).toHaveBeenNthCalledWith(2, [{ name: 'stmt-1' }, { name: 'stmt-2' }])
    })

    it('does not call onPage for empty pages', async () => {
      const onPage = vi.fn()
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      await listStatements(10, onPage)

      expect(onPage).not.toHaveBeenCalled()
    })

    it('respects maxResults limit', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: {
          data: [{ name: 'stmt-1' }, { name: 'stmt-2' }, { name: 'stmt-3' }],
          metadata: { next: 'https://api.confluent.cloud/sql/v1/statements?page_token=tok2' },
        },
      })

      const result = await listStatements(10, undefined, 2)

      // Should slice to maxResults
      expect(result).toHaveLength(2)
      expect(result).toEqual([{ name: 'stmt-1' }, { name: 'stmt-2' }])
      // Should not follow pagination since maxResults was reached
      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(1)
    })

    it('stops pagination when empty page is returned even with next URL', async () => {
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({
          data: {
            data: [{ name: 'stmt-1' }],
            metadata: { next: 'https://api.confluent.cloud/sql/v1/statements?page_token=tok2' },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [],
            metadata: { next: 'https://api.confluent.cloud/sql/v1/statements?page_token=tok3' },
          },
        })

      const result = await listStatements(10)

      // Stops because page.length === 0 even though there's a next URL
      expect(vi.mocked(confluentClient.get)).toHaveBeenCalledTimes(2)
      expect(result).toEqual([{ name: 'stmt-1' }])
    })

    it('throws on API failure', async () => {
      vi.mocked(confluentClient.get).mockRejectedValueOnce(new Error('Server error'))

      await expect(listStatements()).rejects.toThrow()
    })
  })

  describe('[@api] getCatalogs', () => {
    it('returns catalog names from SHOW CATALOGS result', async () => {
      // executeSQL call
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: { name: 'stmt-cat', status: { phase: 'PENDING' } },
      })
      // pollForResults: first poll returns COMPLETED
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({ data: { name: 'stmt-cat', status: { phase: 'COMPLETED' } } })
        .mockResolvedValueOnce({
          data: { results: { data: [{ row: ['catalog1'] }, { row: ['catalog2'] }] }, metadata: {} },
        })

      const result = await getCatalogs()

      expect(result).toEqual(['catalog1', 'catalog2'])
    })

    it('returns fallback catalog on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('Failed'))

      const result = await getCatalogs()

      // Should return the env default catalog
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })
  })

  describe('[@api] getDatabases', () => {
    it('returns database names from SHOW DATABASES result', async () => {
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: { name: 'stmt-db', status: { phase: 'PENDING' } },
      })
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({ data: { name: 'stmt-db', status: { phase: 'COMPLETED' } } })
        .mockResolvedValueOnce({
          data: { results: { data: [{ row: ['db1'] }, { row: ['db2'] }] }, metadata: {} },
        })

      const result = await getDatabases('my-catalog')

      expect(result).toEqual(['db1', 'db2'])
    })

    it('returns fallback database on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('Failed'))

      const result = await getDatabases('my-catalog')

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(1)
    })
  })

  describe('[@api] getTables', () => {
    it('returns table names from SHOW TABLES result', async () => {
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: { name: 'stmt-tbl', status: { phase: 'PENDING' } },
      })
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({ data: { name: 'stmt-tbl', status: { phase: 'COMPLETED' } } })
        .mockResolvedValueOnce({
          data: { results: { data: [{ row: ['table1'] }, { row: ['table2'] }] }, metadata: {} },
        })

      const result = await getTables('cat', 'db')

      expect(result).toEqual(['table1', 'table2'])
    })

    it('returns empty array on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('Failed'))

      const result = await getTables('cat', 'db')

      expect(result).toEqual([])
    })
  })

  describe('[@api] getViews', () => {
    it('returns view names from SHOW VIEWS result', async () => {
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: { name: 'stmt-view', status: { phase: 'PENDING' } },
      })
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({ data: { name: 'stmt-view', status: { phase: 'COMPLETED' } } })
        .mockResolvedValueOnce({
          data: { results: { data: [{ row: ['view1'] }] }, metadata: {} },
        })

      const result = await getViews('cat', 'db')

      expect(result).toEqual(['view1'])
    })

    it('returns empty array on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('Failed'))

      const result = await getViews('cat', 'db')

      expect(result).toEqual([])
    })
  })

  describe('[@api] getFunctions', () => {
    it('returns function names from SHOW USER FUNCTIONS result', async () => {
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: { name: 'stmt-func', status: { phase: 'PENDING' } },
      })
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({ data: { name: 'stmt-func', status: { phase: 'COMPLETED' } } })
        .mockResolvedValueOnce({
          data: { results: { data: [{ row: ['func1'] }, { row: ['func2'] }] }, metadata: {} },
        })

      const result = await getFunctions('cat', 'db')

      expect(result).toEqual(['func1', 'func2'])
    })

    it('returns empty array on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('Failed'))

      const result = await getFunctions('cat', 'db')

      expect(result).toEqual([])
    })
  })

  describe('[@api] getTableSchema', () => {
    it('returns columns from DESCRIBE result', async () => {
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: { name: 'stmt-desc', status: { phase: 'PENDING' } },
      })
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({ data: { name: 'stmt-desc', status: { phase: 'COMPLETED' } } })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [
                { row: ['col1', 'STRING', 'YES'] },
                { row: ['col2', 'INT', 'NO'] },
              ],
            },
            metadata: {},
          },
        })

      const result = await getTableSchema('cat', 'db', 'tbl')

      expect(result).toEqual([
        { name: 'col1', type: 'STRING', nullable: true },
        { name: 'col2', type: 'INT', nullable: true },
      ])
    })

    it('defaults type to STRING when missing from result', async () => {
      vi.mocked(confluentClient.post).mockResolvedValueOnce({
        data: { name: 'stmt-desc2', status: { phase: 'PENDING' } },
      })
      vi.mocked(confluentClient.get)
        .mockResolvedValueOnce({ data: { name: 'stmt-desc2', status: { phase: 'COMPLETED' } } })
        .mockResolvedValueOnce({
          data: {
            results: {
              data: [{ row: ['col1'] }],
            },
            metadata: {},
          },
        })

      const result = await getTableSchema('cat', 'db', 'tbl')

      expect(result[0].type).toBe('STRING')
    })

    it('returns empty array on error', async () => {
      vi.mocked(confluentClient.post).mockRejectedValueOnce(new Error('Failed'))

      const result = await getTableSchema('cat', 'db', 'tbl')

      expect(result).toEqual([])
    })
  })

  describe('[@api] getComputePoolStatus', () => {
    it('should return pool status with phase and currentCfu', async () => {
      vi.mocked(fcpmClient.get).mockResolvedValueOnce({
        data: {
          status: {
            phase: 'PROVISIONING',
            current_cfu: 5,
          },
          spec: {
            max_cfu: 10,
          },
        },
      })

      const result = await getComputePoolStatus()

      expect(vi.mocked(fcpmClient.get)).toHaveBeenCalledTimes(1)
      const calledUrl = vi.mocked(fcpmClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain('/v2/compute-pools/')
      expect(calledUrl).toContain('environment=')
      expect(result).toEqual({
        phase: 'PROVISIONING',
        currentCfu: 5,
        maxCfu: 10,
      })
    })

    it('should handle default values when status properties are missing', async () => {
      vi.mocked(fcpmClient.get).mockResolvedValueOnce({
        data: {
          status: {},
        },
      })

      const result = await getComputePoolStatus()

      expect(result).toEqual({
        phase: 'UNKNOWN',
        currentCfu: 0,
        maxCfu: 0,
      })
    })

    it('should throw error on 404 Not Found', async () => {
      const error = new Error('404 Not Found')
      vi.mocked(fcpmClient.get).mockRejectedValueOnce(error)

      await expect(getComputePoolStatus()).rejects.toThrow('404 Not Found')
    })

    it('should throw error on 500 Server Error', async () => {
      const error = new Error('500 Internal Server Error')
      vi.mocked(fcpmClient.get).mockRejectedValueOnce(error)

      await expect(getComputePoolStatus()).rejects.toThrow('500 Internal Server Error')
    })

    it('should throw error on network failure', async () => {
      const error = new Error('Network error')
      vi.mocked(fcpmClient.get).mockRejectedValueOnce(error)

      await expect(getComputePoolStatus()).rejects.toThrow('Network error')
    })
  })
})
