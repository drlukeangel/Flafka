/**
 * @phase-12.6-schema-filter
 * Phase 12.6 F2 — Schema Subject List Filter
 *
 * Covers:
 *   - Type filter dropdown (AVRO / PROTOBUF / JSON / All) renders
 *   - Compat filter dropdown renders
 *   - Filtering by name search still works
 *   - Type + compat filter uses AND logic
 *   - "No subjects match the current filters." empty state
 *   - schemaCompatCache lookup drives compat filter matching
 *   - aria-live="polite" present on list container
 *   - aria-label on filter dropdowns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock store with filter-relevant state (using real store property names)
// ---------------------------------------------------------------------------

let mockSubjects: string[] = ['orders', 'payments', 'returns']
let mockSchemaTypeCache: Record<string, string> = {}
let mockSchemaCompatCache: Record<string, string> = {}
let mockSubjectsLoading = false
const mockLoadSchemaRegistrySubjects = vi.fn().mockResolvedValue(undefined)
const mockLoadSchemaDetail = vi.fn()
const mockSelectSubject = vi.fn()

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      schemaRegistrySubjects: mockSubjects,
      schemaRegistryLoading: mockSubjectsLoading,
      schemaRegistryError: null,
      selectedSchemaSubject: null,
      schemaTypeCache: mockSchemaTypeCache,
      schemaCompatCache: mockSchemaCompatCache,
      loadSchemaRegistrySubjects: mockLoadSchemaRegistrySubjects,
      loadSchemaDetail: mockLoadSchemaDetail,
      selectSchemaSubject: mockSelectSubject,
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

vi.mock('../../config/environment', () => ({
  env: { schemaRegistryUrl: '', uniqueId: 'test' },
}))

// Import after mocks
import SchemaList from '../../components/SchemaPanel/SchemaList'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@phase-12.6-schema-filter] SchemaList — type filter', () => {
  beforeEach(() => {
    mockSubjects = ['orders', 'payments', 'returns']
    mockSchemaTypeCache = {}
    mockSchemaCompatCache = {}
    mockSubjectsLoading = false
    mockLoadSchemaRegistrySubjects.mockClear()
    mockSelectSubject.mockClear()
  })

  it('renders a Type filter dropdown', { timeout: 15000 }, () => {
    render(<SchemaList />)
    const typeSelect = screen.getByLabelText('Filter by schema type')
    expect(typeSelect).toBeTruthy()
  })

  it('renders a Compat filter dropdown', () => {
    render(<SchemaList />)
    const compatSelect = screen.getByLabelText('Filter by compatibility mode')
    expect(compatSelect).toBeTruthy()
  })

  it('shows all subjects when no filter applied', () => {
    render(<SchemaList />)
    expect(screen.getByText('orders')).toBeTruthy()
    expect(screen.getByText('payments')).toBeTruthy()
    expect(screen.getByText('returns')).toBeTruthy()
  })

  it('filters subjects by name search', async () => {
    render(<SchemaList />)
    const searchInput = screen.getByPlaceholderText(/filter/i)
    fireEvent.change(searchInput, { target: { value: 'order' } })
    await waitFor(() => {
      expect(screen.getByText('orders')).toBeTruthy()
      expect(screen.queryByText('payments')).toBeNull()
    })
  })

  it('filters by AVRO type using schemaTypeCache', async () => {
    mockSchemaTypeCache = { orders: 'AVRO', payments: 'PROTOBUF', returns: 'JSON' }
    render(<SchemaList />)
    const typeSelect = screen.getByLabelText('Filter by schema type')
    fireEvent.change(typeSelect, { target: { value: 'AVRO' } })
    await waitFor(() => {
      expect(screen.getByText('orders')).toBeTruthy()
      expect(screen.queryByText('payments')).toBeNull()
      expect(screen.queryByText('returns')).toBeNull()
    })
  })

  it('shows "No subjects match" empty state when filter yields no results', async () => {
    mockSchemaTypeCache = { orders: 'AVRO', payments: 'AVRO', returns: 'AVRO' }
    render(<SchemaList />)
    const typeSelect = screen.getByLabelText('Filter by schema type')
    fireEvent.change(typeSelect, { target: { value: 'PROTOBUF' } })
    await waitFor(() => {
      expect(screen.getByText(/no subjects match/i)).toBeTruthy()
    })
  })

  it('applies AND logic: both type and compat must match', async () => {
    mockSchemaTypeCache = { orders: 'AVRO', payments: 'AVRO', returns: 'PROTOBUF' }
    mockSchemaCompatCache = { orders: 'BACKWARD', payments: 'FULL', returns: 'BACKWARD' }
    render(<SchemaList />)
    const typeSelect = screen.getByLabelText('Filter by schema type')
    const compatSelect = screen.getByLabelText('Filter by compatibility mode')
    fireEvent.change(typeSelect, { target: { value: 'AVRO' } })
    fireEvent.change(compatSelect, { target: { value: 'BACKWARD' } })
    await waitFor(() => {
      expect(screen.getByText('orders')).toBeTruthy()
      expect(screen.queryByText('payments')).toBeNull()
      expect(screen.queryByText('returns')).toBeNull()
    })
  })
})

describe('[@phase-12.6-schema-filter] SchemaList — accessibility', () => {
  beforeEach(() => {
    mockSubjects = ['orders']
    mockSchemaTypeCache = {}
    mockSchemaCompatCache = {}
    mockSubjectsLoading = false
  })

  it('subject list container has aria-live="polite"', () => {
    const { container } = render(<SchemaList />)
    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeTruthy()
  })

  it('type filter has aria-label="Filter by schema type"', () => {
    render(<SchemaList />)
    const typeSelect = screen.getByLabelText('Filter by schema type')
    expect(typeSelect).toBeTruthy()
  })

  it('compat filter has aria-label="Filter by compatibility mode"', () => {
    render(<SchemaList />)
    const compatSelect = screen.getByLabelText('Filter by compatibility mode')
    expect(compatSelect).toBeTruthy()
  })
})
