import { describe, it, expect, vi, beforeEach } from 'vitest'
import { executeSQL, getStatementStatus, getStatementResults, pollForResults, cancelStatement, listStatements, getComputePoolStatus } from '../../api/flink-api'
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
        name: expect.stringMatching(/^[a-z]+-[a-z]+-\d{3}$/),
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
    it('should generate word-word-number names with shared session number', async () => {
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
        // name format: <adjective>-<noun>-<sessionNumber>
        const parts = name.split('-')
        expect(parts).toHaveLength(3)
        expect(parts[0].length).toBeGreaterThan(1) // adjective
        expect(parts[1].length).toBeGreaterThan(1) // noun
        const num = Number(parts[2])
        expect(num).toBeGreaterThanOrEqual(100)
        expect(num).toBeLessThanOrEqual(999)
      }

      // All names share the same session number (3rd part)
      const numbers = names.map((n) => n.split('-')[2])
      expect(new Set(numbers).size).toBe(1)
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

    it('calls API without page_size when not provided', async () => {
      vi.mocked(confluentClient.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      await listStatements()

      const calledUrl = vi.mocked(confluentClient.get).mock.calls[0][0] as string
      expect(calledUrl).not.toContain('page_size')
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
