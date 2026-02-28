import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SchemaSubject } from '../../types'

// ---------------------------------------------------------------------------
// Store mock — controlled via mutable module-level variables so each test can
// set the state it needs before rendering.
// ---------------------------------------------------------------------------

let mockSubjects: string[] = []
let mockSelectedSchemaSubject: SchemaSubject | null = null
let mockSchemaRegistryLoading = false
let mockSchemaRegistryError: string | null = null

const mockLoadSchemaRegistrySubjects = vi.fn()
const mockLoadSchemaDetail = vi.fn()
const mockClearSelectedSchema = vi.fn()
const mockAddToast = vi.fn()

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      schemaRegistrySubjects: mockSubjects,
      selectedSchemaSubject: mockSelectedSchemaSubject,
      schemaRegistryLoading: mockSchemaRegistryLoading,
      schemaRegistryError: mockSchemaRegistryError,
      loadSchemaRegistrySubjects: mockLoadSchemaRegistrySubjects,
      loadSchemaDetail: mockLoadSchemaDetail,
      clearSelectedSchema: mockClearSelectedSchema,
      addToast: mockAddToast,
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

// Mock the Schema Registry API — SchemaDetail and CreateSchema call it directly.
vi.mock('../../api/schema-registry-api', () => ({
  listSubjects: vi.fn(),
  getSchemaDetail: vi.fn(),
  getSchemaVersions: vi.fn().mockResolvedValue([]),
  getCompatibilityMode: vi.fn().mockResolvedValue(null),
  validateCompatibility: vi.fn(),
  registerSchema: vi.fn(),
  deleteSubject: vi.fn(),
}))

// Import components AFTER mocks are registered.
import SchemaPanel from '../../components/SchemaPanel/SchemaPanel'
import SchemaList from '../../components/SchemaPanel/SchemaList'
import SchemaTreeView from '../../components/SchemaPanel/SchemaTreeView'
import SchemaDetail from '../../components/SchemaPanel/SchemaDetail'
import CreateSchema from '../../components/SchemaPanel/CreateSchema'

// ---------------------------------------------------------------------------
// Shared AVRO schema fixture used across SchemaTreeView tests
// ---------------------------------------------------------------------------

const AVRO_LOAN_SCHEMA = JSON.stringify({
  type: 'record',
  name: 'Loan',
  namespace: 'com.example',
  fields: [
    { name: 'loan_id', type: 'string' },
    { name: 'amount', type: 'double' },
    { name: 'status', type: 'string' },
    { name: 'customer_id', type: ['null', 'string'], default: null },
  ],
})

// ---------------------------------------------------------------------------
// Fixture factory: build a minimal SchemaSubject
// ---------------------------------------------------------------------------

function makeSchemaSubject(overrides: Partial<SchemaSubject> = {}): SchemaSubject {
  return {
    subject: 'orders-value',
    version: 1,
    id: 42,
    schemaType: 'AVRO',
    schema: AVRO_LOAN_SCHEMA,
    ...overrides,
  }
}

// ===========================================================================
// SchemaPanel
// ===========================================================================

describe('[@schema-panel] rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  it('shows "Schema Registry" title when no subject is selected', () => {
    render(<SchemaPanel />)
    expect(screen.getByText('Schema Registry')).toBeInTheDocument()
  })

  it('does not show a back button when no subject is selected', () => {
    render(<SchemaPanel />)
    expect(screen.queryByRole('button', { name: /back to schema list/i })).not.toBeInTheDocument()
  })

  it('shows back button when a subject is selected', () => {
    mockSelectedSchemaSubject = makeSchemaSubject()
    render(<SchemaPanel />)
    expect(screen.getByRole('button', { name: /back to schema list/i })).toBeInTheDocument()
  })

  it('shows the subject name in the header when a subject is selected', () => {
    mockSelectedSchemaSubject = makeSchemaSubject({ subject: 'payments-value' })
    render(<SchemaPanel />)
    expect(screen.getByText('payments-value')).toBeInTheDocument()
  })

  it('does not show "Schema Registry" title when a subject is selected', () => {
    mockSelectedSchemaSubject = makeSchemaSubject()
    render(<SchemaPanel />)
    expect(screen.queryByText('Schema Registry')).not.toBeInTheDocument()
  })

  it('renders the Schema Registry panel with an accessible label', () => {
    render(<SchemaPanel />)
    expect(screen.getByLabelText(/schema registry panel/i)).toBeInTheDocument()
  })
})

describe('[@schema-panel] navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  it('calls loadSchemaRegistrySubjects on mount', () => {
    render(<SchemaPanel />)
    expect(mockLoadSchemaRegistrySubjects).toHaveBeenCalledTimes(1)
  })

  it('back button calls clearSelectedSchema', async () => {
    const user = userEvent.setup()
    mockSelectedSchemaSubject = makeSchemaSubject()

    render(<SchemaPanel />)
    await user.click(screen.getByRole('button', { name: /back to schema list/i }))

    expect(mockClearSelectedSchema).toHaveBeenCalledTimes(1)
  })
})

describe('[@schema-panel] refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  it('refresh button calls loadSchemaRegistrySubjects when list view is shown', async () => {
    const user = userEvent.setup()
    // Mount first to consume the call from useEffect
    render(<SchemaPanel />)
    mockLoadSchemaRegistrySubjects.mockClear()

    await user.click(screen.getByRole('button', { name: /refresh schema list/i }))

    expect(mockLoadSchemaRegistrySubjects).toHaveBeenCalledTimes(1)
  })

  it('refresh button is present and enabled when not loading', () => {
    mockSchemaRegistryLoading = false
    render(<SchemaPanel />)

    const refreshBtn = screen.getByRole('button', { name: /refresh schema list/i })
    expect(refreshBtn).toBeInTheDocument()
    expect(refreshBtn).not.toBeDisabled()
  })

  it('refresh button is disabled while loading', () => {
    mockSchemaRegistryLoading = true
    render(<SchemaPanel />)

    expect(screen.getByRole('button', { name: /refresh schema list/i })).toBeDisabled()
  })
})

// ===========================================================================
// SchemaList
// ===========================================================================

describe('[@schema-list] loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  it('shows "Loading schemas..." text while loading', () => {
    mockSchemaRegistryLoading = true
    render(<SchemaList />)
    expect(screen.getByText(/loading schemas/i)).toBeInTheDocument()
  })

  it('renders an accessible loading region while loading', () => {
    mockSchemaRegistryLoading = true
    render(<SchemaList />)
    expect(screen.getByLabelText(/loading schemas/i)).toBeInTheDocument()
  })

  it('does not render the subject list while loading', () => {
    mockSchemaRegistryLoading = true
    mockSubjects = ['topic-value']
    render(<SchemaList />)
    expect(screen.queryByRole('list', { name: /schema registry subjects/i })).not.toBeInTheDocument()
  })

  it('does not render the filter input while loading', () => {
    mockSchemaRegistryLoading = true
    render(<SchemaList />)
    expect(screen.queryByLabelText(/filter schema subjects/i)).not.toBeInTheDocument()
  })
})

describe('[@schema-list] error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  it('shows error message when schemaRegistryError is set', () => {
    mockSchemaRegistryError = 'Connection refused'
    render(<SchemaList />)
    expect(screen.getByText('Connection refused')).toBeInTheDocument()
  })

  it('renders the error region with alert role', () => {
    mockSchemaRegistryError = 'Connection refused'
    render(<SchemaList />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows a Retry button in the error state', () => {
    mockSchemaRegistryError = 'Network error'
    render(<SchemaList />)
    expect(screen.getByRole('button', { name: /retry loading schemas/i })).toBeInTheDocument()
  })

  it('clicking Retry calls loadSchemaRegistrySubjects', async () => {
    const user = userEvent.setup()
    mockSchemaRegistryError = 'Network error'

    render(<SchemaList />)
    await user.click(screen.getByRole('button', { name: /retry loading schemas/i }))

    expect(mockLoadSchemaRegistrySubjects).toHaveBeenCalledTimes(1)
  })

  it('does not show the subject list in error state', () => {
    mockSchemaRegistryError = 'Bad gateway'
    mockSubjects = ['topic-value']
    render(<SchemaList />)
    expect(screen.queryByRole('list', { name: /schema registry subjects/i })).not.toBeInTheDocument()
  })
})

describe('[@schema-list] empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  it('shows "No schemas found" when subjects array is empty', () => {
    mockSubjects = []
    render(<SchemaList />)
    expect(screen.getByText('No schemas found')).toBeInTheDocument()
  })

  it('shows a hint about Confluent Schema Registry in the empty state', () => {
    mockSubjects = []
    render(<SchemaList />)
    expect(screen.getByText(/confluent schema registry/i)).toBeInTheDocument()
  })

  it('shows a "Create Schema" button in the empty state', () => {
    mockSubjects = []
    render(<SchemaList />)
    expect(screen.getByRole('button', { name: /create schema/i })).toBeInTheDocument()
  })
})

describe('[@schema-list] subject list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  it('renders all subjects when provided', () => {
    mockSubjects = ['orders-value', 'payments-key', 'users-value']
    render(<SchemaList />)

    expect(screen.getByText('orders-value')).toBeInTheDocument()
    expect(screen.getByText('payments-key')).toBeInTheDocument()
    expect(screen.getByText('users-value')).toBeInTheDocument()
  })

  it('each subject row has a listitem role', () => {
    mockSubjects = ['orders-value', 'payments-key']
    render(<SchemaList />)

    const items = screen.getAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(2)
  })

  it('clicking a subject row calls loadSchemaDetail with the subject name', async () => {
    const user = userEvent.setup()
    mockSubjects = ['orders-value']
    render(<SchemaList />)

    await user.click(screen.getByText('orders-value'))

    expect(mockLoadSchemaDetail).toHaveBeenCalledWith('orders-value')
  })

  it('clicking a second subject calls loadSchemaDetail with its name', async () => {
    const user = userEvent.setup()
    mockSubjects = ['orders-value', 'payments-key']
    render(<SchemaList />)

    await user.click(screen.getByText('payments-key'))

    expect(mockLoadSchemaDetail).toHaveBeenCalledWith('payments-key')
  })

  it('shows a count badge for subject count when subjects are present', () => {
    mockSubjects = ['a', 'b', 'c']
    render(<SchemaList />)
    expect(screen.getByText(/3 subjects/)).toBeInTheDocument()
  })

  it('shows singular "subject" in count badge for a single subject', () => {
    mockSubjects = ['only-one']
    render(<SchemaList />)
    // The count badge renders "1 subject" (without the 's')
    expect(screen.getByText('1 subject')).toBeInTheDocument()
  })

  it('renders the subject list container with an accessible label', () => {
    mockSubjects = ['orders-value']
    render(<SchemaList />)
    expect(screen.getByRole('list', { name: /schema registry subjects/i })).toBeInTheDocument()
  })
})

describe('[@schema-list] search/filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a filter input', () => {
    mockSubjects = ['orders-value']
    render(<SchemaList />)
    expect(screen.getByLabelText(/filter schema subjects/i)).toBeInTheDocument()
  })

  it('filters subjects after the 300ms debounce delay', async () => {
    vi.useFakeTimers()
    mockSubjects = ['orders-value', 'payments-key', 'users-value']
    render(<SchemaList />)

    const input = screen.getByLabelText(/filter schema subjects/i)
    fireEvent.change(input, { target: { value: 'orders' } })

    // Before debounce fires, all subjects still visible
    expect(screen.getByText('orders-value')).toBeInTheDocument()
    expect(screen.getByText('payments-key')).toBeInTheDocument()

    // Advance timer to fire debounce and flush React state updates
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText('orders-value')).toBeInTheDocument()
    expect(screen.queryByText('payments-key')).not.toBeInTheDocument()
    expect(screen.queryByText('users-value')).not.toBeInTheDocument()
  })

  it('filter is case-insensitive', async () => {
    vi.useFakeTimers()
    mockSubjects = ['Orders-Value', 'payments-key']
    render(<SchemaList />)

    const input = screen.getByLabelText(/filter schema subjects/i)
    fireEvent.change(input, { target: { value: 'orders' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText('Orders-Value')).toBeInTheDocument()
    expect(screen.queryByText('payments-key')).not.toBeInTheDocument()
  })

  it('shows filtered count badge when a query is active', async () => {
    vi.useFakeTimers()
    mockSubjects = ['orders-value', 'payments-key', 'users-value']
    render(<SchemaList />)

    const input = screen.getByLabelText(/filter schema subjects/i)
    fireEvent.change(input, { target: { value: 'orders' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText(/1 of 3 subjects/)).toBeInTheDocument()
  })

  it('shows "No results" message when filter matches nothing', async () => {
    vi.useFakeTimers()
    mockSubjects = ['orders-value', 'payments-key']
    render(<SchemaList />)

    const input = screen.getByLabelText(/filter schema subjects/i)
    fireEvent.change(input, { target: { value: 'zzznomatch' } })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText(/no results/i)).toBeInTheDocument()
  })

  it('shows a clear button when search query is non-empty', async () => {
    mockSubjects = ['orders-value']
    render(<SchemaList />)

    const input = screen.getByLabelText(/filter schema subjects/i)
    fireEvent.change(input, { target: { value: 'ord' } })

    expect(screen.getByRole('button', { name: /clear filter/i })).toBeInTheDocument()
  })

  it('clear button resets the filter and shows all subjects again', async () => {
    vi.useFakeTimers()
    mockSubjects = ['orders-value', 'payments-key']
    render(<SchemaList />)

    const input = screen.getByLabelText(/filter schema subjects/i)
    fireEvent.change(input, { target: { value: 'orders' } })

    // Fire the first debounce so the filter is active
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // After filter: only orders-value visible, clear button present
    expect(screen.queryByText('payments-key')).not.toBeInTheDocument()
    const clearBtn = screen.getByRole('button', { name: /clear filter/i })

    // Click clear — sets searchQuery to '' immediately
    await act(async () => {
      fireEvent.click(clearBtn)
    })

    // Advance 300ms so the debounce for '' fires and resets debouncedQuery
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText('orders-value')).toBeInTheDocument()
    expect(screen.getByText('payments-key')).toBeInTheDocument()
  })

  it('does not show clear button when search query is empty', () => {
    mockSubjects = ['orders-value']
    render(<SchemaList />)
    expect(screen.queryByRole('button', { name: /clear filter/i })).not.toBeInTheDocument()
  })
})

describe('[@schema-list] keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  it('pressing ArrowDown on the search input moves focus to the first item', async () => {
    mockSubjects = ['orders-value', 'payments-key']
    render(<SchemaList />)

    const input = screen.getByLabelText(/filter schema subjects/i)
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    await waitFor(() => {
      const firstItem = screen.getByRole('listitem', { name: /schema subject: orders-value/i })
      expect(document.activeElement).toBe(firstItem)
    })
  })

  it('pressing Enter on a focused subject item calls loadSchemaDetail', async () => {
    mockSubjects = ['orders-value']
    render(<SchemaList />)

    const item = screen.getByRole('listitem', { name: /schema subject: orders-value/i })
    fireEvent.keyDown(item, { key: 'Enter' })

    expect(mockLoadSchemaDetail).toHaveBeenCalledWith('orders-value')
  })

  it('pressing Space on a focused subject item calls loadSchemaDetail', async () => {
    mockSubjects = ['orders-value']
    render(<SchemaList />)

    const item = screen.getByRole('listitem', { name: /schema subject: orders-value/i })
    fireEvent.keyDown(item, { key: ' ' })

    expect(mockLoadSchemaDetail).toHaveBeenCalledWith('orders-value')
  })

  it('pressing ArrowDown on first item moves focus to second item', async () => {
    mockSubjects = ['orders-value', 'payments-key']
    render(<SchemaList />)

    // ArrowDown from search input focuses first item
    const input = screen.getByLabelText(/filter schema subjects/i)
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    await waitFor(() => {
      const firstItem = screen.getByRole('listitem', { name: /schema subject: orders-value/i })
      expect(document.activeElement).toBe(firstItem)
    })

    // ArrowDown on first item focuses second item
    const firstItem = screen.getByRole('listitem', { name: /schema subject: orders-value/i })
    fireEvent.keyDown(firstItem, { key: 'ArrowDown' })

    await waitFor(() => {
      const secondItem = screen.getByRole('listitem', { name: /schema subject: payments-key/i })
      expect(document.activeElement).toBe(secondItem)
    })
  })

  it('pressing ArrowUp on first item does not go above index 0', async () => {
    mockSubjects = ['orders-value', 'payments-key']
    render(<SchemaList />)

    // Focus first item via ArrowDown from search
    const input = screen.getByLabelText(/filter schema subjects/i)
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    await waitFor(() => {
      const firstItem = screen.getByRole('listitem', { name: /schema subject: orders-value/i })
      expect(document.activeElement).toBe(firstItem)
    })

    // ArrowUp on first item should stay on first item (clamped to 0)
    const firstItem = screen.getByRole('listitem', { name: /schema subject: orders-value/i })
    fireEvent.keyDown(firstItem, { key: 'ArrowUp' })

    await waitFor(() => {
      expect(document.activeElement).toBe(firstItem)
    })
  })
})

describe('[@schema-list] create button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = null
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
  })

  it('renders the "+" create button in the toolbar', () => {
    mockSubjects = ['orders-value']
    render(<SchemaList />)
    expect(screen.getByRole('button', { name: /create new schema/i })).toBeInTheDocument()
  })

  it('clicking the "+" button opens the CreateSchema dialog', async () => {
    const user = userEvent.setup()
    mockSubjects = ['orders-value']
    render(<SchemaList />)

    await user.click(screen.getByRole('button', { name: /create new schema/i }))

    // CreateSchema modal should appear
    expect(screen.getByRole('dialog', { name: /create schema/i })).toBeInTheDocument()
  })

  it('clicking "Create Schema" in the empty state opens the dialog', async () => {
    const user = userEvent.setup()
    mockSubjects = []
    render(<SchemaList />)

    // The empty state "Create Schema" button
    const createBtn = screen.getByRole('button', { name: /create schema/i })
    await user.click(createBtn)

    expect(screen.getByRole('dialog', { name: /create schema/i })).toBeInTheDocument()
  })
})

// ===========================================================================
// SchemaTreeView
// ===========================================================================

describe('[@schema-tree-view] valid schema', () => {
  it('renders all field names from the Avro schema', () => {
    render(<SchemaTreeView schema={AVRO_LOAN_SCHEMA} />)

    expect(screen.getByText('loan_id')).toBeInTheDocument()
    expect(screen.getByText('amount')).toBeInTheDocument()
    expect(screen.getByText('status')).toBeInTheDocument()
    expect(screen.getByText('customer_id')).toBeInTheDocument()
  })

  it('renders a type badge for each field', () => {
    render(<SchemaTreeView schema={AVRO_LOAN_SCHEMA} />)

    // string fields → "string" badge
    const stringBadges = screen.getAllByTitle(/type: string/i)
    expect(stringBadges.length).toBeGreaterThanOrEqual(2) // loan_id and status

    // double field
    expect(screen.getByTitle(/type: double/i)).toBeInTheDocument()
  })

  it('renders a field count in the toolbar', () => {
    render(<SchemaTreeView schema={AVRO_LOAN_SCHEMA} />)
    expect(screen.getByText(/4 fields/)).toBeInTheDocument()
  })

  it('renders the record name in the toolbar', () => {
    render(<SchemaTreeView schema={AVRO_LOAN_SCHEMA} />)
    expect(screen.getByText(/Loan/)).toBeInTheDocument()
  })

  it('renders the namespace in the toolbar', () => {
    render(<SchemaTreeView schema={AVRO_LOAN_SCHEMA} />)
    expect(screen.getByText(/com\.example/)).toBeInTheDocument()
  })

  it('renders Expand All and Collapse All buttons', () => {
    render(<SchemaTreeView schema={AVRO_LOAN_SCHEMA} />)
    expect(screen.getByRole('button', { name: /expand all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse all/i })).toBeInTheDocument()
  })
})

describe('[@schema-tree-view] invalid JSON', () => {
  it('shows "Unable to parse" message for malformed JSON', () => {
    render(<SchemaTreeView schema="{not valid json}" />)
    expect(screen.getByText(/unable to parse schema json/i)).toBeInTheDocument()
  })

  it('shows "Unable to parse" for an empty string', () => {
    render(<SchemaTreeView schema="" />)
    expect(screen.getByText(/unable to parse schema json/i)).toBeInTheDocument()
  })

  it('does not render Expand All or Collapse All buttons on parse failure', () => {
    render(<SchemaTreeView schema="not-json" />)
    expect(screen.queryByRole('button', { name: /expand all/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /collapse all/i })).not.toBeInTheDocument()
  })
})

describe('[@schema-tree-view] no fields', () => {
  it('shows the "only available for Avro schemas with fields" message when fields array is absent', () => {
    const schemaWithoutFields = JSON.stringify({ type: 'string' })
    render(<SchemaTreeView schema={schemaWithoutFields} />)
    expect(screen.getByText(/only available for avro schemas/i)).toBeInTheDocument()
  })

  it('shows a "fields" code element in the no-fields message', () => {
    const schemaWithoutFields = JSON.stringify({ type: 'string' })
    render(<SchemaTreeView schema={schemaWithoutFields} />)
    const codeEl = screen.getByText('fields')
    expect(codeEl.tagName.toLowerCase()).toBe('code')
  })

  it('does not render Expand All button when fields are absent', () => {
    const schemaWithoutFields = JSON.stringify({ type: 'record', name: 'Empty' })
    render(<SchemaTreeView schema={schemaWithoutFields} />)
    expect(screen.queryByRole('button', { name: /expand all/i })).not.toBeInTheDocument()
  })
})

describe('[@schema-tree-view] expand/collapse', () => {
  // Build a nested schema so there is something expandable
  const NESTED_SCHEMA = JSON.stringify({
    type: 'record',
    name: 'Order',
    fields: [
      {
        name: 'address',
        type: {
          type: 'record',
          name: 'Address',
          fields: [
            { name: 'street', type: 'string' },
            { name: 'city', type: 'string' },
          ],
        },
      },
      { name: 'total', type: 'double' },
    ],
  })

  it('Expand All button sets expandAll to true (Reset button appears)', async () => {
    const user = userEvent.setup()
    render(<SchemaTreeView schema={NESTED_SCHEMA} />)

    await user.click(screen.getByRole('button', { name: /expand all/i }))

    // After clicking Expand All, a Reset button should appear
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('Collapse All button sets expandAll to false (Reset button appears)', async () => {
    const user = userEvent.setup()
    render(<SchemaTreeView schema={NESTED_SCHEMA} />)

    await user.click(screen.getByRole('button', { name: /collapse all/i }))

    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
  })

  it('Reset button removes the forced expand/collapse state', async () => {
    const user = userEvent.setup()
    render(<SchemaTreeView schema={NESTED_SCHEMA} />)

    await user.click(screen.getByRole('button', { name: /expand all/i }))
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /reset/i }))
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument()
  })

  it('Collapse All hides nested child fields from the expandable node', async () => {
    const user = userEvent.setup()
    render(<SchemaTreeView schema={NESTED_SCHEMA} />)

    // Collapse All — nested fields (street, city) should no longer be visible
    await user.click(screen.getByRole('button', { name: /collapse all/i }))

    expect(screen.queryByText('street')).not.toBeInTheDocument()
    expect(screen.queryByText('city')).not.toBeInTheDocument()
  })

  it('Expand All reveals nested child fields', async () => {
    const user = userEvent.setup()
    render(<SchemaTreeView schema={NESTED_SCHEMA} />)

    // First collapse everything
    await user.click(screen.getByRole('button', { name: /collapse all/i }))
    expect(screen.queryByText('street')).not.toBeInTheDocument()

    // Then expand everything
    await user.click(screen.getByRole('button', { name: /expand all/i }))

    expect(screen.getByText('street')).toBeInTheDocument()
    expect(screen.getByText('city')).toBeInTheDocument()
  })
})

describe('[@schema-tree-view] nullable fields', () => {
  it('shows "?" indicator for union types that include null', () => {
    render(<SchemaTreeView schema={AVRO_LOAN_SCHEMA} />)

    // customer_id has type ["null", "string"] — should render a "?" indicator
    // The nullable indicator has title="Nullable"
    const nullableIndicators = screen.getAllByTitle('Nullable')
    expect(nullableIndicators.length).toBeGreaterThanOrEqual(1)
  })

  it('does not show "?" indicator for non-nullable fields', () => {
    const nonNullableSchema = JSON.stringify({
      type: 'record',
      name: 'Event',
      fields: [
        { name: 'event_id', type: 'string' },
        { name: 'timestamp', type: 'long' },
      ],
    })

    render(<SchemaTreeView schema={nonNullableSchema} />)

    expect(screen.queryByTitle('Nullable')).not.toBeInTheDocument()
  })

  it('shows "?" only for customer_id and not for other fields in the loan schema', () => {
    render(<SchemaTreeView schema={AVRO_LOAN_SCHEMA} />)

    // Only one nullable field (customer_id) — exactly one "?" indicator
    const nullableIndicators = screen.getAllByTitle('Nullable')
    expect(nullableIndicators).toHaveLength(1)
  })

  it('renders the non-null type in the badge for nullable union fields (shows "string" not "null | string")', () => {
    render(<SchemaTreeView schema={AVRO_LOAN_SCHEMA} />)

    // customer_id is ["null", "string"] — after filtering null, badge shows "string"
    // There are multiple string badges (loan_id, status, customer_id)
    const stringBadges = screen.getAllByTitle(/type: string/i)
    expect(stringBadges.length).toBeGreaterThanOrEqual(3)
  })
})

// ===========================================================================
// CreateSchema
// ===========================================================================

// Grab typed references to the API mock functions.
import * as schemaRegistryApi from '../../api/schema-registry-api'

// Shared callbacks used across all CreateSchema describe blocks.
let mockOnClose: ReturnType<typeof vi.fn>
let mockOnCreated: ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helper: render CreateSchema with isOpen=true and shared callbacks
// ---------------------------------------------------------------------------
function renderOpen() {
  return render(
    <CreateSchema isOpen={true} onClose={mockOnClose} onCreated={mockOnCreated} />
  )
}

describe('[@create-schema] rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnClose = vi.fn()
    mockOnCreated = vi.fn()
  })

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <CreateSchema isOpen={false} onClose={mockOnClose} onCreated={mockOnCreated} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows dialog with "Create Schema" title when isOpen is true', () => {
    renderOpen()
    expect(screen.getByRole('dialog', { name: /create schema/i })).toBeInTheDocument()
    expect(screen.getByText('Create Schema')).toBeInTheDocument()
  })

  it('has subject name input with label', () => {
    renderOpen()
    expect(screen.getByLabelText(/subject name/i)).toBeInTheDocument()
  })

  it('has schema type selector with AVRO, PROTOBUF, and JSON options', () => {
    renderOpen()
    const select = screen.getByLabelText(/schema type/i)
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'AVRO' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'PROTOBUF' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'JSON' })).toBeInTheDocument()
  })

  it('has schema content textarea', () => {
    renderOpen()
    expect(screen.getByLabelText(/schema definition/i)).toBeInTheDocument()
  })

  it('has Cancel, Validate, and Create buttons', () => {
    renderOpen()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^validate$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create schema/i })).toBeInTheDocument()
  })

  it('Close button (X) is present', () => {
    renderOpen()
    expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument()
  })
})

describe('[@create-schema] form interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnClose = vi.fn()
    mockOnCreated = vi.fn()
  })

  it('typing in subject name updates input value', async () => {
    const user = userEvent.setup()
    renderOpen()

    const input = screen.getByLabelText(/subject name/i)
    await user.clear(input)
    await user.type(input, 'my-topic-value')

    expect(input).toHaveValue('my-topic-value')
  })

  it('changing schema type updates textarea with template', async () => {
    const user = userEvent.setup()
    renderOpen()

    const select = screen.getByLabelText(/schema type/i)
    await user.selectOptions(select, 'PROTOBUF')

    const textarea = screen.getByLabelText(/schema definition/i) as HTMLTextAreaElement
    expect(textarea.value).toContain('syntax = "proto3"')
  })

  it('schema type change resets validation state', async () => {
    const user = userEvent.setup()
    // Set up validateCompatibility to return compatible so isValidated becomes true
    vi.mocked(schemaRegistryApi.validateCompatibility).mockResolvedValueOnce({
      is_compatible: true,
    })

    renderOpen()

    // Type a subject name and validate
    const input = screen.getByLabelText(/subject name/i)
    await user.type(input, 'orders-value')
    await user.click(screen.getByRole('button', { name: /^validate$/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    // Change schema type — validation success banner should disappear
    const select = screen.getByLabelText(/schema type/i)
    await user.selectOptions(select, 'JSON')

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('subject name change resets validation state', async () => {
    const user = userEvent.setup()
    vi.mocked(schemaRegistryApi.validateCompatibility).mockResolvedValueOnce({
      is_compatible: true,
    })

    renderOpen()

    // Validate first
    const input = screen.getByLabelText(/subject name/i)
    await user.type(input, 'orders-value')
    await user.click(screen.getByRole('button', { name: /^validate$/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })

    // Change subject name — success banner should disappear
    await user.type(input, '-updated')

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('[@create-schema] validation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnClose = vi.fn()
    mockOnCreated = vi.fn()
  })

  it('Validate button is disabled when subject is empty', () => {
    renderOpen()
    // Subject starts empty — Validate must be disabled
    expect(screen.getByRole('button', { name: /^validate$/i })).toBeDisabled()
  })

  it('Validate calls validateCompatibility API with correct args', async () => {
    const user = userEvent.setup()
    vi.mocked(schemaRegistryApi.validateCompatibility).mockResolvedValueOnce({
      is_compatible: true,
    })

    renderOpen()

    const input = screen.getByLabelText(/subject name/i)
    await user.type(input, 'orders-value')
    await user.click(screen.getByRole('button', { name: /^validate$/i }))

    await waitFor(() => {
      expect(schemaRegistryApi.validateCompatibility).toHaveBeenCalledWith(
        'orders-value',
        expect.any(String), // schema content (template)
        'AVRO',
        'latest'
      )
    })
  })

  it('shows success status when compatible', async () => {
    const user = userEvent.setup()
    vi.mocked(schemaRegistryApi.validateCompatibility).mockResolvedValueOnce({
      is_compatible: true,
    })

    renderOpen()

    const input = screen.getByLabelText(/subject name/i)
    await user.type(input, 'orders-value')
    await user.click(screen.getByRole('button', { name: /^validate$/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText(/schema validated/i)).toBeInTheDocument()
    })
  })

  it('shows error alert when incompatible', async () => {
    const user = userEvent.setup()
    vi.mocked(schemaRegistryApi.validateCompatibility).mockResolvedValueOnce({
      is_compatible: false,
    })

    renderOpen()

    const input = screen.getByLabelText(/subject name/i)
    await user.type(input, 'orders-value')
    await user.click(screen.getByRole('button', { name: /^validate$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent(/not compatible/i)
    })
  })

  it('handles 404 as new subject (valid)', async () => {
    const user = userEvent.setup()
    const notFoundError = { response: { status: 404 } }
    vi.mocked(schemaRegistryApi.validateCompatibility).mockRejectedValueOnce(notFoundError)

    renderOpen()

    const input = screen.getByLabelText(/subject name/i)
    await user.type(input, 'brand-new-subject')
    await user.click(screen.getByRole('button', { name: /^validate$/i }))

    await waitFor(() => {
      // 404 means new subject — treated as valid, success status shown
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })
})

describe('[@create-schema] create flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnClose = vi.fn()
    mockOnCreated = vi.fn()
  })

  it('Create button is disabled until validated', () => {
    renderOpen()
    expect(screen.getByRole('button', { name: /create schema/i })).toBeDisabled()
  })

  it('after validation passes, Create button becomes enabled', async () => {
    const user = userEvent.setup()
    vi.mocked(schemaRegistryApi.validateCompatibility).mockResolvedValueOnce({
      is_compatible: true,
    })

    renderOpen()

    const input = screen.getByLabelText(/subject name/i)
    await user.type(input, 'orders-value')
    await user.click(screen.getByRole('button', { name: /^validate$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create schema/i })).not.toBeDisabled()
    })
  })

  it('Create calls registerSchema with correct args', async () => {
    const user = userEvent.setup()
    vi.mocked(schemaRegistryApi.validateCompatibility).mockResolvedValueOnce({
      is_compatible: true,
    })
    vi.mocked(schemaRegistryApi.registerSchema).mockResolvedValueOnce({ id: 12345 })

    renderOpen()

    const input = screen.getByLabelText(/subject name/i)
    await user.type(input, 'orders-value')
    await user.click(screen.getByRole('button', { name: /^validate$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create schema/i })).not.toBeDisabled()
    })

    await user.click(screen.getByRole('button', { name: /create schema/i }))

    await waitFor(() => {
      expect(schemaRegistryApi.registerSchema).toHaveBeenCalledWith(
        'orders-value',
        expect.any(String),
        'AVRO'
      )
    })
  })

  it('on success, calls onCreated and onClose', async () => {
    const user = userEvent.setup()
    vi.mocked(schemaRegistryApi.validateCompatibility).mockResolvedValueOnce({
      is_compatible: true,
    })
    vi.mocked(schemaRegistryApi.registerSchema).mockResolvedValueOnce({ id: 12345 })

    renderOpen()

    const input = screen.getByLabelText(/subject name/i)
    await user.type(input, 'orders-value')
    await user.click(screen.getByRole('button', { name: /^validate$/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create schema/i })).not.toBeDisabled()
    })

    await user.click(screen.getByRole('button', { name: /create schema/i }))

    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })
})

describe('[@create-schema] keyboard and accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnClose = vi.fn()
    mockOnCreated = vi.fn()
  })

  it('dialog has role="dialog" and aria-modal', () => {
    renderOpen()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('Cancel button calls onClose', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('X (close) button calls onClose', async () => {
    const user = userEvent.setup()
    renderOpen()

    await user.click(screen.getByRole('button', { name: /close dialog/i }))

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('Escape key calls onClose', async () => {
    renderOpen()

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// SchemaDetail
// ===========================================================================

const DETAIL_AVRO_SCHEMA =
  '{"type":"record","name":"Test","namespace":"com.test","fields":[{"name":"id","type":"string"}]}'

function makeDetailSubject(overrides: Partial<SchemaSubject> = {}): SchemaSubject {
  return {
    subject: 'test-subject-value',
    version: 1,
    id: 100001,
    schemaType: 'AVRO',
    schema: DETAIL_AVRO_SCHEMA,
    compatibilityLevel: 'BACKWARD',
    ...overrides,
  }
}

describe('[@schema-detail] rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = makeDetailSubject()
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([1])
    vi.mocked(schemaRegistryApi.getCompatibilityMode).mockResolvedValue('BACKWARD')
  })

  it('shows AVRO schema type badge', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByTitle('Schema type: AVRO')).toBeInTheDocument()
    })
    expect(screen.getByTitle('Schema type: AVRO')).toHaveTextContent('AVRO')
  })

  it('shows PROTOBUF schema type badge', async () => {
    mockSelectedSchemaSubject = makeDetailSubject({ schemaType: 'PROTOBUF' })
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByTitle('Schema type: PROTOBUF')).toBeInTheDocument()
    })
    expect(screen.getByTitle('Schema type: PROTOBUF')).toHaveTextContent('PROTOBUF')
  })

  it('shows JSON schema type badge', async () => {
    mockSelectedSchemaSubject = makeDetailSubject({ schemaType: 'JSON' })
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByTitle('Schema type: JSON')).toBeInTheDocument()
    })
    expect(screen.getByTitle('Schema type: JSON')).toHaveTextContent('JSON')
  })

  it('shows schema ID', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByTitle('Schema ID')).toBeInTheDocument()
    })
    expect(screen.getByTitle('Schema ID')).toHaveTextContent('100001')
  })

  it('shows "Refresh schema" button', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh schema/i })).toBeInTheDocument()
    })
  })

  it('shows "Close schema detail" button', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close schema detail/i })).toBeInTheDocument()
    })
  })

  it('shows version selector with "Latest" option', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /select schema version/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'Latest' })).toBeInTheDocument()
  })

  it('shows compatibility mode label after loading', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /compatibility mode/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('combobox', { name: /compatibility mode/i })).toHaveValue('BACKWARD')
  })

  it('shows Code/Tree view toggle', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByRole('group', { name: /schema view mode/i })).toBeInTheDocument()
    })
    expect(screen.getByTitle(/view formatted json/i)).toBeInTheDocument()
    expect(screen.getByTitle(/view field tree/i)).toBeInTheDocument()
  })

  it('shows Evolve and Delete buttons in read mode', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /evolve schema/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /delete subject/i })).toBeInTheDocument()
  })
})

describe('[@schema-detail] version switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = makeDetailSubject()
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([1])
    vi.mocked(schemaRegistryApi.getCompatibilityMode).mockResolvedValue('BACKWARD')
  })

  it('changing version selector calls loadSchemaDetail with correct version', async () => {
    const user = userEvent.setup()
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([1, 2])
    render(<SchemaDetail />)

    // Wait for version options to load
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'v1' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByRole('combobox', { name: /select schema version/i }), 'v1')

    expect(mockLoadSchemaDetail).toHaveBeenCalledWith('test-subject-value', 1)
  })

  it('version selector is disabled during editing', async () => {
    const user = userEvent.setup()
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /evolve schema/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /evolve schema/i }))

    expect(screen.getByRole('combobox', { name: /select schema version/i })).toBeDisabled()
  })
})

describe('[@schema-detail] code view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = makeDetailSubject()
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([1])
    vi.mocked(schemaRegistryApi.getCompatibilityMode).mockResolvedValue('BACKWARD')
  })

  it('code view is the default view', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      expect(screen.getByRole('group', { name: /schema view mode/i })).toBeInTheDocument()
    })
    const codeBtn = screen.getByTitle(/view formatted json/i)
    expect(codeBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows formatted JSON in pre block', async () => {
    render(<SchemaDetail />)
    await waitFor(() => {
      const preEls = document.querySelectorAll('pre')
      expect(preEls.length).toBeGreaterThanOrEqual(1)
    })
    // The schema contains "com.test" — verify it's visible in the formatted output
    expect(screen.getByText(/com\.test/)).toBeInTheDocument()
  })
})

describe('[@schema-detail] tree view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = makeDetailSubject()
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([1])
    vi.mocked(schemaRegistryApi.getCompatibilityMode).mockResolvedValue('BACKWARD')
  })

  it('switching to Tree view shows SchemaTreeView content', async () => {
    const user = userEvent.setup()
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByTitle(/view field tree/i)).toBeInTheDocument()
    })

    await user.click(screen.getByTitle(/view field tree/i))

    // SchemaTreeView renders field names from the AVRO schema — the detail schema has an "id" field
    await waitFor(() => {
      expect(screen.getByText('id')).toBeInTheDocument()
    })
  })

  it('shows "not available for Protobuf" message for PROTOBUF schemas in tree view', async () => {
    const user = userEvent.setup()
    mockSelectedSchemaSubject = makeDetailSubject({ schemaType: 'PROTOBUF' })
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByTitle(/view field tree/i)).toBeInTheDocument()
    })

    await user.click(screen.getByTitle(/view field tree/i))

    await waitFor(() => {
      expect(screen.getByText(/not available for protobuf/i)).toBeInTheDocument()
    })
  })
})

describe('[@schema-detail] evolve mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = makeDetailSubject()
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([1])
    vi.mocked(schemaRegistryApi.getCompatibilityMode).mockResolvedValue('BACKWARD')
  })

  it('clicking "Evolve" enters edit mode with textarea', async () => {
    const user = userEvent.setup()
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /evolve schema/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /evolve schema/i }))

    expect(screen.getByRole('textbox', { name: /edit schema json/i })).toBeInTheDocument()
  })

  it('Cancel returns to read mode', async () => {
    const user = userEvent.setup()
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /evolve schema/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /evolve schema/i }))
    expect(screen.getByRole('textbox', { name: /edit schema json/i })).toBeInTheDocument()

    // The cancel button in edit mode has title="Cancel editing" and text "Cancel"
    await user.click(screen.getByTitle(/cancel editing/i))

    expect(screen.queryByRole('textbox', { name: /edit schema json/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /evolve schema/i })).toBeInTheDocument()
  })

  it('Validate button calls validateCompatibility API', async () => {
    const user = userEvent.setup()
    vi.mocked(schemaRegistryApi.validateCompatibility).mockResolvedValue({ is_compatible: true })
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /evolve schema/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /evolve schema/i }))

    await user.click(screen.getByTitle(/check compatibility against existing versions/i))

    await waitFor(() => {
      expect(schemaRegistryApi.validateCompatibility).toHaveBeenCalledWith(
        'test-subject-value',
        expect.any(String),
        'AVRO'
      )
    })
  })

  it('Save button is disabled until validated', async () => {
    const user = userEvent.setup()
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /evolve schema/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /evolve schema/i }))

    expect(screen.getByRole('button', { name: /save new schema version/i })).toBeDisabled()
  })
})

describe('[@schema-detail] delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubjects = []
    mockSelectedSchemaSubject = makeDetailSubject()
    mockSchemaRegistryLoading = false
    mockSchemaRegistryError = null
    vi.mocked(schemaRegistryApi.getSchemaVersions).mockResolvedValue([1])
    vi.mocked(schemaRegistryApi.getCompatibilityMode).mockResolvedValue('BACKWARD')
  })

  it('clicking Delete shows confirmation dialog', async () => {
    const user = userEvent.setup()
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete subject/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /delete subject/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /delete test-subject-value/i })).toBeInTheDocument()
  })

  it('confirmation dialog has cancel and delete buttons', async () => {
    const user = userEvent.setup()
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete subject/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /delete subject/i }))

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete test-subject-value/i })).toBeInTheDocument()
  })

  it('Cancel button dismisses the confirmation dialog', async () => {
    const user = userEvent.setup()
    render(<SchemaDetail />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete subject/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /delete subject/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
