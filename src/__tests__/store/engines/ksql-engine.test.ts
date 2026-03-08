// [@ksql-engine] — ksqlDB engine adapter tests

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../api/ksql-api', () => ({
  executeKsql: vi.fn(),
  executeKsqlQuery: vi.fn(),
  terminateQuery: vi.fn(),
}))

import * as ksqlApi from '../../../api/ksql-api'
import { ksqlEngine, classifyKsqlStatement } from '../../../store/engines/ksql-engine'
import type { SQLStatement } from '../../../types'

const mockKsqlApi = vi.mocked(ksqlApi)

describe('[@ksql-engine] ksql-engine adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── SQL Classification ──────────────────────────────────────────────
  describe('classifyKsqlStatement', () => {
    it('classifies DDL statements', () => {
      expect(classifyKsqlStatement('CREATE STREAM test (...) WITH (...);')).toBe('ddl')
      expect(classifyKsqlStatement('CREATE TABLE test (...) WITH (...);')).toBe('ddl')
      expect(classifyKsqlStatement('DROP STREAM test;')).toBe('ddl')
      expect(classifyKsqlStatement('SHOW STREAMS;')).toBe('ddl')
      expect(classifyKsqlStatement('DESCRIBE orders;')).toBe('ddl')
      expect(classifyKsqlStatement('EXPLAIN query_id;')).toBe('ddl')
      expect(classifyKsqlStatement('TERMINATE CSAS_TEST_0;')).toBe('ddl')
    })

    it('classifies CREATE OR REPLACE as DDL', () => {
      expect(classifyKsqlStatement('CREATE OR REPLACE STREAM test (...) WITH (...);')).toBe('ddl')
    })

    it('classifies CREATE SOURCE TABLE as DDL', () => {
      expect(classifyKsqlStatement('CREATE SOURCE TABLE test (...) WITH (...);')).toBe('ddl')
    })

    it('classifies persistent queries', () => {
      expect(classifyKsqlStatement('CREATE STREAM derived AS SELECT * FROM source EMIT CHANGES;')).toBe('persistent')
      expect(classifyKsqlStatement('CREATE TABLE agg AS SELECT id, COUNT(*) FROM s GROUP BY id;')).toBe('persistent')
      expect(classifyKsqlStatement('INSERT INTO sink SELECT * FROM source;')).toBe('persistent')
    })

    it('classifies INSERT INTO ... VALUES as sync DML', () => {
      expect(classifyKsqlStatement("INSERT INTO test VALUES ('a', 1);")).toBe('insert-values')
      expect(classifyKsqlStatement("INSERT INTO test (id, name) VALUES ('b', 'c');")).toBe('insert-values')
    })

    it('classifies push queries', () => {
      expect(classifyKsqlStatement('SELECT * FROM orders EMIT CHANGES;')).toBe('push')
      expect(classifyKsqlStatement('SELECT id, amount FROM orders WHERE amount > 100 EMIT CHANGES;')).toBe('push')
    })

    it('classifies pull queries', () => {
      expect(classifyKsqlStatement("SELECT * FROM orders WHERE id = 'abc';")).toBe('pull')
      expect(classifyKsqlStatement('SELECT COUNT(*) FROM orders;')).toBe('pull')
    })

    it('strips comments before classifying', () => {
      expect(classifyKsqlStatement('-- this is a comment\nSELECT * FROM test EMIT CHANGES;')).toBe('push')
      expect(classifyKsqlStatement('/* block comment */ SHOW STREAMS;')).toBe('ddl')
    })

    it('handles CREATE TYPE as DDL', () => {
      expect(classifyKsqlStatement("CREATE TYPE address AS STRUCT<street STRING, city STRING>;")).toBe('ddl')
    })
  })

  // ── execute ─────────────────────────────────────────────────────────
  describe('execute', () => {
    it('handles DDL synchronously', async () => {
      mockKsqlApi.executeKsql.mockResolvedValueOnce([
        { commandStatus: { status: 'SUCCESS', message: 'Stream created' } } as any,
      ])

      const onStatus = vi.fn()
      const result = await ksqlEngine.execute('CREATE STREAM test ...', 'label', {}, { onStatus })

      expect(result.completed).toBe(true)
      expect(onStatus).toHaveBeenCalledWith('PENDING')
    })

    it('handles SHOW STREAMS with result rows', async () => {
      mockKsqlApi.executeKsql.mockResolvedValueOnce([
        {
          streams: [
            { name: 'ORDERS', topic: 'orders', keyFormat: 'KAFKA', valueFormat: 'JSON', isWindowed: false },
          ],
        } as any,
      ])

      const result = await ksqlEngine.execute('SHOW STREAMS;', 'label', {}, { onStatus: vi.fn() })

      expect(result.completed).toBe(true)
      expect(result.columns).toHaveLength(4)
      expect(result.rows).toHaveLength(1)
      expect(result.rows![0].Name).toBe('ORDERS')
    })

    it('handles persistent query and returns queryId', async () => {
      mockKsqlApi.executeKsql.mockResolvedValueOnce([
        { commandStatus: { status: 'SUCCESS', message: 'Created', queryId: 'CSAS_TEST_0' } } as any,
      ])

      const result = await ksqlEngine.execute(
        'CREATE STREAM derived AS SELECT * FROM source EMIT CHANGES;',
        'label', {}, { onStatus: vi.fn() },
      )

      expect(result.completed).toBe(false)
      expect(result.statementName).toBe('CSAS_TEST_0')
    })

    it('handles pull query with immediate results', async () => {
      mockKsqlApi.executeKsqlQuery.mockResolvedValueOnce({
        columns: [{ name: 'id', type: 'STRING' }],
        rows: [{ id: 'abc' }],
        totalRowsReceived: 1,
      })

      const result = await ksqlEngine.execute(
        "SELECT * FROM test WHERE id = 'abc';",
        'label', {}, { onStatus: vi.fn() },
      )

      expect(result.completed).toBe(true)
      expect(result.rows).toHaveLength(1)
    })
  })

  // ── cancel ──────────────────────────────────────────────────────────
  describe('cancel', () => {
    it('calls terminateQuery for persistent queries', async () => {
      mockKsqlApi.terminateQuery.mockResolvedValueOnce(undefined)
      await ksqlEngine.cancel('CSAS_TEST_0', { streaming: false })
      expect(mockKsqlApi.terminateQuery).toHaveBeenCalledWith('CSAS_TEST_0')
    })

    it('does nothing for push query cancellation (handled by AbortController)', async () => {
      await ksqlEngine.cancel('PUSH_123', { streaming: true })
      expect(mockKsqlApi.terminateQuery).not.toHaveBeenCalled()
    })
  })

  // ── buildProps ──────────────────────────────────────────────────────
  describe('buildProps', () => {
    it('maps earliest scan mode', () => {
      const props = ksqlEngine.buildProps({ scanMode: 'earliest-offset' } as SQLStatement, {})
      expect(props['ksql.streams.auto.offset.reset']).toBe('earliest')
    })

    it('maps latest scan mode', () => {
      const props = ksqlEngine.buildProps({ scanMode: 'latest-offset' } as SQLStatement, {})
      expect(props['ksql.streams.auto.offset.reset']).toBe('latest')
    })

    it('defaults to earliest', () => {
      const props = ksqlEngine.buildProps({} as SQLStatement, {})
      expect(props['ksql.streams.auto.offset.reset']).toBe('earliest')
    })

    it('passes through ksql-prefixed global props', () => {
      const props = ksqlEngine.buildProps({} as SQLStatement, {
        'ksql.some.config': 'value',
        'sql.current-catalog': 'default', // Flink-only, should be excluded
      })
      expect(props['ksql.some.config']).toBe('value')
      expect(props['sql.current-catalog']).toBeUndefined()
    })
  })

  // ── validateName ────────────────────────────────────────────────────
  describe('validateName', () => {
    it('always returns null (ksqlDB names are optional)', () => {
      expect(ksqlEngine.validateName('')).toBeNull()
      expect(ksqlEngine.validateName('anything')).toBeNull()
      expect(ksqlEngine.validateName('WITH SPACES')).toBeNull()
    })
  })
})
