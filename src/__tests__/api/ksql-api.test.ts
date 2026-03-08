// [@ksql-api] — ksqlDB API function tests

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mockPost is available before vi.mock hoisting
const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}))

vi.mock('../../api/ksql-client', () => ({
  ksqlClient: { post: mockPost },
  getKsqlAuthHeader: () => 'Basic dGVzdDp0ZXN0',
  KSQL_FETCH_BASE: '/api/ksql',
}))

import { executeKsql, handleKsqlError, parseKsqlSchema, terminateQuery, explainQuery } from '../../api/ksql-api'

describe('[@ksql-api] ksql-api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── handleKsqlError ─────────────────────────────────────────────────
  describe('handleKsqlError', () => {
    it('handles DDL error format (commandStatus)', () => {
      const result = handleKsqlError({
        commandStatus: { status: 'ERROR', message: 'Stream already exists' },
      })
      expect(result.message).toBe('Stream already exists')
    })

    it('handles statement_error format', () => {
      const result = handleKsqlError({
        '@type': 'statement_error',
        error_code: 40001,
        message: 'Line 1: unknown column',
      })
      expect(result.message).toBe('Line 1: unknown column')
      expect(result.errorCode).toBe(40001)
    })

    it('handles HTTP error format', () => {
      const result = handleKsqlError({
        error_code: 40100,
        message: 'Authentication error',
      })
      expect(result.message).toBe('Authentication error')
      expect(result.errorCode).toBe(40100)
    })

    it('handles unknown error shape', () => {
      const result = handleKsqlError({ unexpected: true })
      expect(result.message).toBe('Unknown ksqlDB error')
    })

    it('handles null/undefined', () => {
      expect(handleKsqlError(null).message).toBe('Unknown ksqlDB error')
      expect(handleKsqlError(undefined).message).toBe('Unknown ksqlDB error')
    })

    it('handles array with embedded error', () => {
      const result = handleKsqlError([
        { '@type': 'statement_error', error_code: 40001, message: 'bad query' },
      ])
      expect(result.message).toBe('bad query')
    })
  })

  // ── parseKsqlSchema ─────────────────────────────────────────────────
  describe('parseKsqlSchema', () => {
    it('parses simple schema', () => {
      const cols = parseKsqlSchema('`ID` STRING, `NAME` STRING, `AGE` INTEGER')
      expect(cols).toHaveLength(3)
      expect(cols[0]).toEqual({ name: 'ID', type: 'STRING' })
      expect(cols[1]).toEqual({ name: 'NAME', type: 'STRING' })
      expect(cols[2]).toEqual({ name: 'AGE', type: 'INTEGER' })
    })

    it('handles nested STRUCT types', () => {
      const cols = parseKsqlSchema('`ID` STRING, `ADDR` STRUCT<`CITY` STRING, `ZIP` INT>')
      expect(cols).toHaveLength(2)
      expect(cols[1].name).toBe('ADDR')
      expect(cols[1].type).toBe('STRUCT<`CITY` STRING, `ZIP` INT>')
    })

    it('returns empty for empty/null input', () => {
      expect(parseKsqlSchema('')).toEqual([])
      expect(parseKsqlSchema(null as unknown as string)).toEqual([])
    })

    it('handles columns without backticks', () => {
      const cols = parseKsqlSchema('ID STRING, NAME STRING')
      expect(cols).toHaveLength(2)
      expect(cols[0].name).toBe('ID')
    })
  })

  // ── executeKsql ─────────────────────────────────────────────────────
  describe('executeKsql', () => {
    it('sends SQL to POST /ksql', async () => {
      mockPost.mockResolvedValueOnce({
        data: [{ commandStatus: { status: 'SUCCESS', message: 'Stream created' } }],
      })
      const result = await executeKsql('CREATE STREAM test (id STRING) WITH (KAFKA_TOPIC=\'t\', VALUE_FORMAT=\'JSON\');')
      expect(mockPost).toHaveBeenCalledWith('/ksql', { ksql: expect.any(String) })
      expect(result).toHaveLength(1)
    })

    it('includes streamsProperties when provided', async () => {
      mockPost.mockResolvedValueOnce({ data: [{ commandStatus: { status: 'SUCCESS', message: 'ok' } }] })
      await executeKsql('SHOW STREAMS;', { 'ksql.streams.auto.offset.reset': 'earliest' })
      expect(mockPost).toHaveBeenCalledWith('/ksql', {
        ksql: 'SHOW STREAMS;',
        streamsProperties: { 'ksql.streams.auto.offset.reset': 'earliest' },
      })
    })

    it('throws on statement_error response', async () => {
      mockPost.mockResolvedValueOnce({
        data: [{ '@type': 'statement_error', error_code: 40001, message: 'bad sql' }],
      })
      await expect(executeKsql('BAD SQL')).rejects.toThrow('bad sql')
    })

    it('throws on commandStatus ERROR', async () => {
      mockPost.mockResolvedValueOnce({
        data: [{ commandStatus: { status: 'ERROR', message: 'duplicate' } }],
      })
      await expect(executeKsql('CREATE STREAM dup ...')).rejects.toThrow('duplicate')
    })
  })

  // ── terminateQuery ──────────────────────────────────────────────────
  describe('terminateQuery', () => {
    it('sends TERMINATE command', async () => {
      mockPost.mockResolvedValueOnce({
        data: [{ commandStatus: { status: 'SUCCESS', message: 'Query terminated' } }],
      })
      await terminateQuery('CSAS_TEST_0')
      expect(mockPost).toHaveBeenCalledWith('/ksql', { ksql: 'TERMINATE `CSAS_TEST_0`;' })
    })
  })

  // ── explainQuery ──────────────────────────────────────────────────
  describe('explainQuery', () => {
    it('calls executeKsql with correct EXPLAIN SQL', async () => {
      mockPost.mockResolvedValueOnce({
        data: [{ queryDescription: { id: 'CSAS_MY_STREAM_0', state: 'RUNNING' } }],
      })
      const result = await explainQuery('CSAS_MY_STREAM_0')
      expect(mockPost).toHaveBeenCalledWith('/ksql', { ksql: 'EXPLAIN `CSAS_MY_STREAM_0`;' })
      expect(result).toHaveLength(1)
    })

    it('returns full response for further parsing', async () => {
      const mockResponse = {
        queryDescription: {
          id: 'CSAS_MY_STREAM_0',
          state: 'RUNNING',
          sinks: ['output-topic'],
          fields: [{ name: 'ID', schema: { type: 'STRING' } }],
        },
      }
      mockPost.mockResolvedValueOnce({ data: [mockResponse] })
      const result = await explainQuery('CSAS_MY_STREAM_0')
      expect(result[0]).toEqual(mockResponse)
    })
  })
})
