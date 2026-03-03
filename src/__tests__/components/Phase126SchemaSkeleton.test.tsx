/**
 * @phase-12.6-schema-skeleton
 * Phase 12.6 F3 — Schema Panel Loading Skeleton
 *
 * Covers:
 *   - Skeleton rows shown on initial load (loading=true, no prior data)
 *   - Skeleton rows have aria-hidden="true"
 *   - No skeleton on subsequent loads once list has loaded once
 *   - Real subject rows rendered after loading completes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Controlled loading state
// ---------------------------------------------------------------------------

let mockSchemaRegistryLoading = true
let mockSubjects: string[] = []
const mockLoadSchemaRegistrySubjects = vi.fn().mockResolvedValue(undefined)

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      schemaRegistrySubjects: mockSubjects,
      schemaRegistryLoading: mockSchemaRegistryLoading,
      schemaRegistryError: null,
      selectedSchemaSubject: null,
      schemaTypeCache: {},
      schemaCompatCache: {},
      loadSchemaRegistrySubjects: mockLoadSchemaRegistrySubjects,
      loadSchemaDetail: vi.fn(),
      selectSchemaSubject: vi.fn(),
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

vi.mock('../../config/environment', () => ({
  env: { schemaRegistryUrl: '' },
}))

import SchemaList from '../../components/SchemaPanel/SchemaList'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@phase-12.6-schema-skeleton] SchemaList — initial loading skeleton', () => {
  beforeEach(() => {
    mockSchemaRegistryLoading = true
    mockSubjects = []
    mockLoadSchemaRegistrySubjects.mockClear()
  })

  it('renders skeleton rows on initial load', { timeout: 15000 }, () => {
    const { container } = render(<SchemaList />)
    // Skeleton rows use .shimmer CSS class
    const shimmerElements = container.querySelectorAll('.shimmer')
    expect(shimmerElements.length).toBeGreaterThan(0)
  })

  it('skeleton row elements have aria-hidden="true"', () => {
    const { container } = render(<SchemaList />)
    // Skeleton rows are <div aria-hidden="true"> elements inside aria-busy container
    const hiddenRows = container.querySelectorAll('[aria-busy="true"] [aria-hidden="true"]')
    expect(hiddenRows.length).toBeGreaterThan(0)
    hiddenRows.forEach((row) => {
      expect(row.getAttribute('aria-hidden')).toBe('true')
    })
  })

  it('does not show skeleton shimmer when data is already loaded', () => {
    mockSchemaRegistryLoading = false
    mockSubjects = ['orders', 'payments']

    const { container } = render(<SchemaList />)
    // When loading=false, shimmer skeleton should not be rendered
    const shimmerElements = container.querySelectorAll('.shimmer')
    expect(shimmerElements.length).toBe(0)
  })

  it('shows subject list after load completes', () => {
    mockSchemaRegistryLoading = false
    mockSubjects = ['orders', 'payments', 'returns']

    render(<SchemaList />)
    expect(screen.getByText('orders')).toBeTruthy()
    expect(screen.getByText('payments')).toBeTruthy()
    expect(screen.getByText('returns')).toBeTruthy()
  })
})
