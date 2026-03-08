// [@flink-engine] — Flink engine adapter tests

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../api/flink-api', () => ({
  executeSQL: vi.fn(),
  getStatementStatus: vi.fn(),
  getStatementErrorDetail: vi.fn(),
  cancelStatement: vi.fn(),
}))

import * as flinkApi from '../../../api/flink-api'
import { flinkEngine } from '../../../store/engines/flink-engine'
import type { SQLStatement } from '../../../types'

const mockFlinkApi = vi.mocked(flinkApi)

describe('[@flink-engine] flink-engine adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('execute', () => {
    it('calls flinkApi.executeSQL with name and props', async () => {
      mockFlinkApi.executeSQL.mockResolvedValueOnce({ name: 'test-job' } as any)
      mockFlinkApi.cancelStatement.mockRejectedValueOnce(new Error('404'))

      const onStatus = vi.fn()
      const result = await flinkEngine.execute('SELECT 1', 'test-job', { prop: 'val' }, { onStatus })

      expect(mockFlinkApi.executeSQL).toHaveBeenCalledWith('SELECT 1', 'test-job', { prop: 'val' })
      expect(onStatus).toHaveBeenCalledWith('RUNNING', { statementName: 'test-job' })
      expect(result.statementName).toBe('test-job')
      expect(result.streaming).toBe(true)
    })

    it('cancels existing statement before re-executing', async () => {
      mockFlinkApi.cancelStatement.mockResolvedValueOnce(undefined)
      mockFlinkApi.executeSQL.mockResolvedValueOnce({ name: 'job-1' } as any)

      await flinkEngine.execute('SELECT 1', 'job-1', {}, { onStatus: vi.fn() })

      expect(mockFlinkApi.cancelStatement).toHaveBeenCalledWith('job-1')
    })
  })

  describe('getStatus', () => {
    it('returns RUNNING for running phase', async () => {
      mockFlinkApi.getStatementStatus.mockResolvedValueOnce({
        status: { phase: 'RUNNING' },
      } as any)
      const status = await flinkEngine.getStatus('test-stmt')
      expect(status.phase).toBe('RUNNING')
    })

    it('returns FAILED with error detail', async () => {
      mockFlinkApi.getStatementStatus.mockResolvedValueOnce({
        status: { phase: 'FAILED', detail: 'error-uri' },
      } as any)
      mockFlinkApi.getStatementErrorDetail.mockResolvedValueOnce('Column not found')

      const status = await flinkEngine.getStatus('test-stmt')
      expect(status.phase).toBe('FAILED')
      expect(status.errorDetail).toBe('Column not found')
    })

    it('extracts columns from schema traits', async () => {
      mockFlinkApi.getStatementStatus.mockResolvedValueOnce({
        status: {
          phase: 'COMPLETED',
          traits: {
            schema: {
              columns: [
                { name: 'id', type: { type: 'INT', nullable: false } },
                { name: 'name', type: { type: 'STRING', nullable: true } },
              ],
            },
          },
        },
      } as any)
      const status = await flinkEngine.getStatus('test-stmt')
      expect(status.columns).toHaveLength(2)
      expect(status.columns![0]).toEqual({ name: 'id', type: 'INT', nullable: false })
    })
  })

  describe('cancel', () => {
    it('delegates to flinkApi.cancelStatement', async () => {
      mockFlinkApi.cancelStatement.mockResolvedValueOnce(undefined)
      await flinkEngine.cancel('test-stmt')
      expect(mockFlinkApi.cancelStatement).toHaveBeenCalledWith('test-stmt')
    })
  })

  describe('buildProps', () => {
    it('maps scan mode to Flink properties', () => {
      const statement = {
        scanMode: 'timestamp',
        scanTimestampMillis: '1609459200000',
      } as SQLStatement
      const props = flinkEngine.buildProps(statement, { 'pipeline.name': 'test' })
      expect(props['sql.tables.scan.startup.mode']).toBe('timestamp')
      expect(props['sql.tables.scan.startup.timestamp-millis']).toBe('1609459200000')
      expect(props['pipeline.name']).toBe('test')
    })

    it('defaults to earliest-offset', () => {
      const props = flinkEngine.buildProps({} as SQLStatement, {})
      expect(props['sql.tables.scan.startup.mode']).toBe('earliest-offset')
    })

    it('maps group-offsets with group ID', () => {
      const statement = {
        scanMode: 'group-offsets',
        scanGroupId: 'my-group',
      } as SQLStatement
      const props = flinkEngine.buildProps(statement, {})
      expect(props['sql.tables.scan.startup.mode']).toBe('group-offsets')
      expect(props['properties.group.id']).toBe('my-group')
    })
  })

  describe('validateName', () => {
    it('returns null for valid name', () => {
      expect(flinkEngine.validateName('my-job-123')).toBeNull()
    })

    it('rejects empty name', () => {
      expect(flinkEngine.validateName('')).toBeTruthy()
      expect(flinkEngine.validateName('  ')).toBeTruthy()
    })

    it('rejects uppercase', () => {
      expect(flinkEngine.validateName('MyJob')).toBeTruthy()
    })

    it('rejects names over 72 chars', () => {
      expect(flinkEngine.validateName('a'.repeat(73))).toBeTruthy()
    })

    it('rejects names starting/ending with hyphen', () => {
      expect(flinkEngine.validateName('-bad')).toBeTruthy()
      expect(flinkEngine.validateName('bad-')).toBeTruthy()
    })
  })
})
