import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SQLStatement } from '../../types'

// ---------------------------------------------------------------------------
// Child component stubs — prevent any real rendering inside App
// ---------------------------------------------------------------------------

vi.mock('../../components/TreeNavigator', () => ({
  TreeNavigator: () => <div data-testid="stub-tree-navigator" />,
}))

vi.mock('../../components/EditorCell', () => ({
  EditorCell: ({ statement }: { statement: SQLStatement }) => (
    <div data-testid={`stub-editor-cell-${statement.id}`} />
  ),
}))

vi.mock('../../components/ResultsTable/ResultsTable', () => ({
  default: () => <div data-testid="stub-results-table" />,
}))

vi.mock('../../components/HistoryPanel', () => ({
  HistoryPanel: () => <div data-testid="stub-history-panel" />,
}))

vi.mock('../../components/HelpPanel/HelpPanel', () => ({
  HelpPanel: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="stub-help-panel" role="dialog">
        <button onClick={onClose}>Close help</button>
      </div>
    ) : null,
}))

vi.mock('../../components/Dropdown', () => ({
  Dropdown: () => <div data-testid="stub-dropdown" />,
}))

vi.mock('../../components/OnboardingHint', () => ({
  OnboardingHint: ({ onDismiss }: { onDismiss: () => void }) => (
    <div data-testid="stub-onboarding-hint">
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}))

vi.mock('../../components/ui/Toast', () => ({
  default: () => <div data-testid="stub-toast" />,
}))

vi.mock('../../components/FooterStatus', () => ({
  default: () => <div data-testid="stub-footer-status" />,
}))

// ---------------------------------------------------------------------------
// Workspace export utils mock — avoid blob/URL APIs in jsdom
// ---------------------------------------------------------------------------
vi.mock('../../utils/workspace-export', () => ({
  exportWorkspace: vi.fn(() => '{}'),
  generateExportFilename: vi.fn(() => 'workspace.json'),
}))

// ---------------------------------------------------------------------------
// Store mock — module-level mutable state replaced per describe block
// ---------------------------------------------------------------------------

// Action spies shared across all tests
const mockLoadCatalogs = vi.fn().mockResolvedValue(undefined)
const mockLoadDatabases = vi.fn().mockResolvedValue(undefined)
const mockLoadComputePoolStatus = vi.fn().mockResolvedValue(undefined)
const mockLoadStatementHistory = vi.fn().mockResolvedValue(undefined)
const mockToggleSidebar = vi.fn()
const mockToggleTheme = vi.fn()
const mockAddStatement = vi.fn()
const mockRunAllStatements = vi.fn()
const mockSetCatalog = vi.fn()
const mockSetDatabase = vi.fn()
const mockDismissOnboardingHint = vi.fn()
const mockSetWorkspaceName = vi.fn()
const mockImportWorkspace = vi.fn()
const mockAddToast = vi.fn()
const mockSetSessionProperty = vi.fn()
const mockRemoveSessionProperty = vi.fn()
const mockResetSessionProperties = vi.fn()

// Mutable store state — override in each describe group
let mockStoreState = buildStoreState()

function buildStoreState(overrides: Partial<ReturnType<typeof defaultStoreState>> = {}) {
  return { ...defaultStoreState(), ...overrides }
}

function defaultStoreState() {
  return {
    catalog: 'test_catalog',
    database: 'test_db',
    catalogs: ['test_catalog'],
    databases: ['test_db'],
    statements: [
      {
        id: 'stmt-1',
        code: '',
        status: 'IDLE' as const,
        createdAt: new Date(),
      },
    ] as SQLStatement[],
    sidebarCollapsed: false,
    computePoolPhase: null as string | null,
    computePoolCfu: null as number | null,
    statementHistory: [] as unknown[],
    historyLoading: false,
    theme: 'light' as 'light' | 'dark',
    workspaceName: 'SQL Workspace',
    hasSeenOnboardingHint: false,
    sessionProperties: {} as Record<string, string>,
    loadCatalogs: mockLoadCatalogs,
    loadDatabases: mockLoadDatabases,
    loadComputePoolStatus: mockLoadComputePoolStatus,
    loadStatementHistory: mockLoadStatementHistory,
    toggleSidebar: mockToggleSidebar,
    toggleTheme: mockToggleTheme,
    addStatement: mockAddStatement,
    runAllStatements: mockRunAllStatements,
    setCatalog: mockSetCatalog,
    setDatabase: mockSetDatabase,
    dismissOnboardingHint: mockDismissOnboardingHint,
    setWorkspaceName: mockSetWorkspaceName,
    importWorkspace: mockImportWorkspace,
    addToast: mockAddToast,
    setSessionProperty: mockSetSessionProperty,
    removeSessionProperty: mockRemoveSessionProperty,
    resetSessionProperties: mockResetSessionProperties,
  }
}

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector?: (s: unknown) => unknown) => {
    if (selector) return selector(mockStoreState)
    return mockStoreState
  },
}))

// Import App after all mocks are registered
import App from '../../App'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderApp() {
  return render(<App />)
}

// ---------------------------------------------------------------------------
// [@app] 1. Theme sync
// ---------------------------------------------------------------------------

describe('[@app] theme sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets document.documentElement.dataset.theme to "light" on initial render when theme is light', () => {
    mockStoreState = buildStoreState({ theme: 'light' })
    renderApp()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('sets document.documentElement.dataset.theme to "dark" when theme is dark', () => {
    mockStoreState = buildStoreState({ theme: 'dark' })
    renderApp()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})

// ---------------------------------------------------------------------------
// [@app] 2. Help modal keyboard
// ---------------------------------------------------------------------------

describe('[@app] help modal keyboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState()
  })

  it('opens help panel when "?" key is pressed on the document', () => {
    renderApp()

    expect(screen.queryByTestId('stub-help-panel')).not.toBeInTheDocument()

    // Fire on document.body so e.target is an HTMLElement with a .closest() method.
    // Firing directly on `document` gives e.target = document, which lacks .closest().
    fireEvent.keyDown(document.body, { key: '?' })

    expect(screen.getByTestId('stub-help-panel')).toBeInTheDocument()
  })

  it('closes help panel when Escape key is pressed while panel is open', async () => {
    renderApp()

    // Open first — fire on document.body so e.target has a .closest() method
    fireEvent.keyDown(document.body, { key: '?' })
    expect(screen.getByTestId('stub-help-panel')).toBeInTheDocument()

    // Close with Escape — same reasoning: target must be an HTMLElement
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByTestId('stub-help-panel')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 3. Settings panel toggle
// ---------------------------------------------------------------------------

describe('[@app] settings panel toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ sessionProperties: {} })
  })

  it('opens settings panel when settings button is clicked', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(screen.queryByText('Environment')).not.toBeInTheDocument()

    const settingsBtn = screen.getByRole('button', { name: /toggle settings panel/i })
    await user.click(settingsBtn)

    expect(screen.getByText('Environment')).toBeInTheDocument()
  })

  it('closes settings panel when settings button is clicked again', async () => {
    const user = userEvent.setup()
    renderApp()

    const settingsBtn = screen.getByRole('button', { name: /toggle settings panel/i })

    // Open
    await user.click(settingsBtn)
    expect(screen.getByText('Environment')).toBeInTheDocument()

    // Close
    await user.click(settingsBtn)
    expect(screen.queryByText('Environment')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 4. Settings outside-click close
// ---------------------------------------------------------------------------

describe('[@app] settings outside-click close', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ sessionProperties: {} })
  })

  it('closes settings panel when clicking outside of it', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()

    // Open settings
    const settingsBtn = screen.getByRole('button', { name: /toggle settings panel/i })
    await user.click(settingsBtn)
    expect(screen.getByText('Environment')).toBeInTheDocument()

    // Click outside: the .app root element is outside the .settings-wrapper
    const appRoot = container.querySelector('.app')!
    // Use mousedown to trigger the outside-click handler (App uses mousedown event)
    fireEvent.mouseDown(appRoot)

    expect(screen.queryByText('Environment')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 5. Workspace title editing
// ---------------------------------------------------------------------------

describe('[@app] workspace title editing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ workspaceName: 'My Workspace' })
  })

  it('enters edit mode (shows input) when workspace title is clicked', async () => {
    const user = userEvent.setup()
    renderApp()

    // Title text should be visible before edit
    expect(screen.getByText('My Workspace')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    // Click the logo-title-group to enter edit mode
    const titleGroup = screen.getByText('My Workspace').closest('.logo-title-group')!
    await user.click(titleGroup)

    // Input should now be visible
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('saves new name and exits edit mode when Enter is pressed', async () => {
    const user = userEvent.setup()
    renderApp()

    const titleGroup = screen.getByText('My Workspace').closest('.logo-title-group')!
    await user.click(titleGroup)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'New Workspace Name')
    await user.keyboard('{Enter}')

    expect(mockSetWorkspaceName).toHaveBeenCalledWith('New Workspace Name')
    // Edit mode should be exited (no input visible)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('cancels edit and exits edit mode without saving when Escape is pressed', async () => {
    const user = userEvent.setup()
    renderApp()

    const titleGroup = screen.getByText('My Workspace').closest('.logo-title-group')!
    await user.click(titleGroup)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Should Not Be Saved')
    await user.keyboard('{Escape}')

    // setWorkspaceName must NOT have been called with the new value
    expect(mockSetWorkspaceName).not.toHaveBeenCalledWith('Should Not Be Saved')
    // Edit mode should be exited
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 6. Onboarding hint logic
// ---------------------------------------------------------------------------

describe('[@app] onboarding hint logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows OnboardingHint when hasSeenOnboardingHint=false, 1 IDLE statement with empty code', () => {
    mockStoreState = buildStoreState({
      hasSeenOnboardingHint: false,
      statements: [
        {
          id: 'stmt-1',
          code: '',
          status: 'IDLE',
          createdAt: new Date(),
        },
      ],
    })

    renderApp()

    expect(screen.getByTestId('stub-onboarding-hint')).toBeInTheDocument()
  })

  it('hides OnboardingHint when hasSeenOnboardingHint=true', () => {
    mockStoreState = buildStoreState({
      hasSeenOnboardingHint: true,
      statements: [
        {
          id: 'stmt-1',
          code: '',
          status: 'IDLE',
          createdAt: new Date(),
        },
      ],
    })

    renderApp()

    expect(screen.queryByTestId('stub-onboarding-hint')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 7. Compute pool polling
// ---------------------------------------------------------------------------

describe('[@app] compute pool polling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockStoreState = buildStoreState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls loadComputePoolStatus immediately on mount', () => {
    renderApp()
    // loadComputePoolStatus is called once synchronously in the useEffect on mount
    expect(mockLoadComputePoolStatus).toHaveBeenCalledTimes(1)
  })

  it('calls loadComputePoolStatus again after 30 seconds via setInterval', async () => {
    renderApp()

    // Already called once on mount
    expect(mockLoadComputePoolStatus).toHaveBeenCalledTimes(1)

    // Advance timers by 30 seconds to trigger the interval
    await act(async () => {
      vi.advanceTimersByTime(30000)
    })

    expect(mockLoadComputePoolStatus).toHaveBeenCalledTimes(2)
  })
})
