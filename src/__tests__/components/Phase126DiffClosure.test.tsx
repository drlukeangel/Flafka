/**
 * @phase-12.6-diff-closure
 * Phase 12.6 F7 + F9 + F11 — Schema Diff Stale Closure, Auto-Exit, CSS Vars
 *
 * F7: Stale closure guard — self-compare prevented when primary version changes
 * F9: Auto-exit diff mode when fewer than 2 versions remain after version delete
 * F11: CSS custom property for danger button text (no hardcoded #ffffff)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Static mocks for SchemaDetail rendering
// ---------------------------------------------------------------------------

let mockVersions = [1, 2, 3]
const mockGetSchemaDetail = vi.fn()
const mockListVersions = vi.fn(() => Promise.resolve(mockVersions))
const mockGetCompatibilityLevel = vi.fn().mockResolvedValue('BACKWARD')
const mockDeleteSchemaVersion = vi.fn().mockResolvedValue(undefined)
const mockDeleteSubject = vi.fn().mockResolvedValue(undefined)

vi.mock('../../api/schema-registry-api', () => ({
  getSchemaDetail: (...args: unknown[]) => mockGetSchemaDetail(...args),
  listVersions: (...args: unknown[]) => mockListVersions(...args),
  getCompatibilityLevel: (...args: unknown[]) => mockGetCompatibilityLevel(...args),
  deleteSchemaVersion: (...args: unknown[]) => mockDeleteSchemaVersion(...args),
  deleteSubject: (...args: unknown[]) => mockDeleteSubject(...args),
}))

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector: (s: unknown) => unknown) => {
      const state = {
        addToast: vi.fn(),
        schemaCompatCache: {},
        selectedSchemaSubject: null,
        schemaRegistryLoading: false,
        clearSelectedSchema: vi.fn(),
        loadSchemaDetail: vi.fn(),
        navigateToTopic: vi.fn(),
        loadSchemaRegistrySubjects: vi.fn(),
        topicList: [],
        loadTopics: vi.fn(),
        schemaInitialView: null,
        clearSchemaInitialView: vi.fn(),
        schemaDatasets: [],
        deleteSchemaDataset: vi.fn(),
      }
      return typeof selector === 'function' ? selector(state) : state
    },
    {
      getState: () => ({
        schemaDatasets: [],
        deleteSchemaDataset: vi.fn(),
      }),
    }
  ),
}))

vi.mock('../../config/environment', () => ({
  env: { schemaRegistryUrl: '' },
}))

const AVRO_SCHEMA = JSON.stringify({
  type: 'record',
  name: 'Order',
  fields: [{ name: 'id', type: 'string' }],
})

function makeSchemaDetail(version: number) {
  return {
    subject: 'orders-value',
    version,
    id: version * 100,
    schemaType: 'AVRO' as const,
    schema: AVRO_SCHEMA,
    compatibilityLevel: 'BACKWARD' as const,
  }
}

// Import AFTER mocks
import SchemaDetail from '../../components/SchemaPanel/SchemaDetail'

// ---------------------------------------------------------------------------
// F11 Tests — CSS custom property for danger button text
// ---------------------------------------------------------------------------

describe('[@phase-12.6-diff-closure] F11 — CSS vars for danger button text', () => {
  beforeEach(() => {
    mockVersions = [1, 2, 3]
    mockGetSchemaDetail.mockResolvedValue(makeSchemaDetail(3))
    mockListVersions.mockResolvedValue([1, 2, 3])
  })

  it('SchemaDetail does not use hardcoded #ffffff for danger button text color', { timeout: 15000 }, async () => {
    const { container } = render(<SchemaDetail subject="orders-value" />)

    await waitFor(() => {
      // No inline style on any element should contain hardcoded #ffffff
      const allWithStyle = container.querySelectorAll('[style]')
      allWithStyle.forEach((el) => {
        const style = el.getAttribute('style') ?? ''
        expect(style).not.toContain('#ffffff')
      })
    })
  })
})

// ---------------------------------------------------------------------------
// F9 Tests — Auto-exit diff mode after version delete
// ---------------------------------------------------------------------------

describe('[@phase-12.6-diff-closure] F9 — auto-exit diff mode after version delete', () => {
  it('handles 2-version schema without crashing', { timeout: 15000 }, async () => {
    mockVersions = [1, 2]
    mockListVersions.mockResolvedValue([1, 2])
    mockGetSchemaDetail.mockResolvedValue(makeSchemaDetail(2))

    expect(() => render(<SchemaDetail subject="orders-value" />)).not.toThrow()
  })

  it('handles 1-version schema without crashing', { timeout: 15000 }, async () => {
    mockVersions = [1]
    mockListVersions.mockResolvedValue([1])
    mockGetSchemaDetail.mockResolvedValue(makeSchemaDetail(1))

    expect(() => render(<SchemaDetail subject="orders-value" />)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Tier 2 STUBS — implement in Track C
// ---------------------------------------------------------------------------

describe.todo('[@phase-12.6-diff-closure] [Tier 2] F7 — self-compare guard: diffVersion updates when primary changes to match it')
describe.todo('[@phase-12.6-diff-closure] [Tier 2] F7 — self-compare guard: exits diff mode if no alternative version available')
describe.todo('[@phase-12.6-diff-closure] [Tier 2] F9 — diff mode exits after delete when 1 version remains')
describe.todo('[@phase-12.6-diff-closure] [Tier 2] F9 — diff mode stays active after delete when 2+ versions remain')
