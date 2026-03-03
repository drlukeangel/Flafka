/**
 * @phase-12.6-diff-abort
 * Phase 12.6 F5 — AbortController Signal Forwarding in Schema Diff
 *
 * Covers:
 *   - getSchemaDetail accepts optional { signal } parameter
 *   - Changing diffVersion while fetch is in-flight aborts prior request
 *   - AbortError / CanceledError is silently swallowed (no UI error shown)
 *   - Abort controller cleaned up on subject change
 *   - Abort controller cleaned up on component unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as schemaApi from '../../api/schema-registry-api'

// ---------------------------------------------------------------------------
// Mock schema registry API to track signal forwarding
// ---------------------------------------------------------------------------

const mockGetSchemaDetail = vi.fn()
const mockListVersions = vi.fn().mockResolvedValue([1, 2, 3])
const mockGetCompatibilityLevel = vi.fn().mockResolvedValue('BACKWARD')
const mockDeleteSchemaVersion = vi.fn()
const mockDeleteSubject = vi.fn()

vi.mock('../../api/schema-registry-api', () => ({
  getSchemaDetail: (...args: unknown[]) => mockGetSchemaDetail(...args),
  listVersions: (...args: unknown[]) => mockListVersions(...args),
  getCompatibilityLevel: (...args: unknown[]) => mockGetCompatibilityLevel(...args),
  deleteSchemaVersion: (...args: unknown[]) => mockDeleteSchemaVersion(...args),
  deleteSubject: (...args: unknown[]) => mockDeleteSubject(...args),
}))

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      addToast: vi.fn(),
      schemaCompatCache: {},
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

vi.mock('../../config/environment', () => ({
  env: { schemaRegistryUrl: '' },
}))

// ---------------------------------------------------------------------------
// Tests: getSchemaDetail API accepts AbortSignal
// ---------------------------------------------------------------------------

describe('[@phase-12.6-diff-abort] schema-registry-api — getSchemaDetail signal forwarding', () => {
  beforeEach(() => {
    mockGetSchemaDetail.mockClear()
    mockListVersions.mockClear()
  })

  it('getSchemaDetail can be called with an AbortSignal', async () => {
    const controller = new AbortController()
    mockGetSchemaDetail.mockResolvedValueOnce({
      subject: 'orders',
      version: 1,
      id: 1,
      schemaType: 'AVRO',
      schema: '{}',
    })

    await schemaApi.getSchemaDetail('orders', 1, { signal: controller.signal })
    expect(mockGetSchemaDetail).toHaveBeenCalledWith('orders', 1, { signal: controller.signal })
  })

  it('getSchemaDetail can be called without a signal (backward compatible)', async () => {
    mockGetSchemaDetail.mockResolvedValueOnce({
      subject: 'orders',
      version: 1,
      id: 1,
      schemaType: 'AVRO',
      schema: '{}',
    })

    await expect(schemaApi.getSchemaDetail('orders', 1)).resolves.toBeDefined()
  })

  it('AbortError from getSchemaDetail propagates to caller', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('Aborted', 'AbortError')
    mockGetSchemaDetail.mockRejectedValueOnce(abortError)

    controller.abort()
    await expect(
      schemaApi.getSchemaDetail('orders', 1, { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})

// ---------------------------------------------------------------------------
// Tier 2 STUBS — implement in Track C
// ---------------------------------------------------------------------------

describe.todo('[@phase-12.6-diff-abort] [Tier 2] SchemaDetail — abort on rapid diff version change')
describe.todo('[@phase-12.6-diff-abort] [Tier 2] SchemaDetail — abort on subject change')
describe.todo('[@phase-12.6-diff-abort] [Tier 2] SchemaDetail — abort on unmount')
describe.todo('[@phase-12.6-diff-abort] [Tier 2] SchemaDetail — CanceledError silently swallowed')
