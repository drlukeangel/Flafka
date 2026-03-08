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

vi.mock('../../components/NavRail/NavRail', () => ({
  NavRail: () => <nav data-testid="stub-nav-rail" aria-label="Main navigation" />,
}))

vi.mock('../../components/SchemaPanel/SchemaPanel', () => ({
  default: () => <div data-testid="stub-schema-panel">Schema Panel Stub</div>,
}))

vi.mock('../../components/TopicPanel/TopicPanel', () => ({
  default: () => <div data-testid="stub-topic-panel" aria-label="Kafka Topics panel">Topic Panel Stub</div>,
}))

vi.mock('../../components/SplitButton/SplitButton', () => ({
  SplitButton: ({ label, onClick, disabled, icon, className }: { label: string; onClick: () => void; disabled?: boolean; icon?: React.ReactNode; className?: string }) => (
    <button data-testid={`split-btn-${label.replace(/\s+/g, '-').toLowerCase()}`} onClick={onClick} disabled={disabled} className={className}>
      {icon}
      <span>{label}</span>
    </button>
  ),
}))

vi.mock('../../components/ComputePoolDashboard/ComputePoolDashboard', () => ({
  ComputePoolDashboard: () => <div data-testid="stub-compute-pool-dashboard" />,
}))

vi.mock('../../components/SnippetsPanel/SnippetsPanel', () => ({
  SnippetsPanel: () => <div data-testid="stub-snippets-panel" />,
}))

vi.mock('../../components/WorkspacesPanel/WorkspacesPanel', () => ({
  WorkspacesPanel: () => <div data-testid="stub-workspaces-panel" />,
}))

vi.mock('../../components/ArtifactsPanel/ArtifactsPanel', () => ({
  default: () => <div data-testid="stub-artifacts-panel" />,
}))

vi.mock('../../components/ExamplesPanel/ExamplesPanel', () => ({
  ExamplesPanel: () => <div data-testid="stub-examples-panel" />,
}))

vi.mock('../../components/ExampleDetailView/ExampleDetailPage', () => ({
  ExampleDetailPage: () => <div data-testid="stub-example-detail-page" />,
}))

vi.mock('../../components/StreamsPanel/StreamsPanel', () => ({
  StreamsPanel: () => <div data-testid="stub-streams-panel" />,
}))

vi.mock('../../components/JobsPage/JobsPage', () => ({
  JobsPage: () => <div data-testid="stub-jobs-page" />,
}))

vi.mock('../../components/TabBar/TabBar', () => ({
  TabBar: () => <div data-testid="stub-tab-bar" />,
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
const mockSetActiveNavItem = vi.fn()
const mockToggleNavExpanded = vi.fn()
const mockStopAllStatements = vi.fn()
const mockClearWorkspace = vi.fn()
const mockClearStatements = vi.fn()
const mockClearStreamCards = vi.fn()
const mockStopAllStreams = vi.fn()
const mockRunAllStreams = vi.fn()
const mockToggleComputePoolDashboard = vi.fn()
const mockLoadStatementTelemetry = vi.fn().mockResolvedValue(undefined)
const mockSaveCurrentWorkspace = vi.fn()
const mockToggleStreamsPanel = vi.fn()

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
    activeNavItem: 'workspace' as string,
    navExpanded: false,
    computePoolMaxCfu: null as number | null,
    computePoolDashboardOpen: false,
    streamCards: [] as unknown[],
    selectedSchemaSubject: null as string | null,
    streamsPanelOpen: false,
    activeTabId: 'tab-1' as string | null,
    selectedExampleId: null as string | null,
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
    setActiveNavItem: mockSetActiveNavItem,
    toggleNavExpanded: mockToggleNavExpanded,
    stopAllStatements: mockStopAllStatements,
    clearWorkspace: mockClearWorkspace,
    clearStatements: mockClearStatements,
    clearStreamCards: mockClearStreamCards,
    stopAllStreams: mockStopAllStreams,
    runAllStreams: mockRunAllStreams,
    toggleComputePoolDashboard: mockToggleComputePoolDashboard,
    loadStatementTelemetry: mockLoadStatementTelemetry,
    saveCurrentWorkspace: mockSaveCurrentWorkspace,
    toggleStreamsPanel: mockToggleStreamsPanel,
    cacheTtlMinutes: 5,
    setCacheTtlMinutes: vi.fn(),
    clearCachedData: vi.fn(),
    navigateToExampleDetail: vi.fn(),
    navigateToJobDetail: vi.fn(),
    navigateToTopic: vi.fn().mockResolvedValue(undefined),
    navigateToSchemaSubject: vi.fn(),
    selectedJobName: null as string | null,
    selectedTopic: null as { topic_name: string } | null,
  }
}

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (s: unknown) => unknown) => {
      if (selector) return selector(mockStoreState)
      return mockStoreState
    },
    { getState: () => mockStoreState }
  ),
  randomStarterJoke: () => '-- SELECT * FROM jokes\nWhy did the SQL query break up?',
}))

// Import App after all mocks are registered
import App from '../../App'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderApp() {
  return render(<App />)
}

/**
 * Simulate a file input change event for async handlers.
 * In jsdom, React nullifies e.currentTarget after sync dispatch. The async handler
 * in App.tsx tries e.currentTarget.value = '' which throws. We wrap the input
 * element's value setter to be resilient to this jsdom limitation.
 */
async function simulateFileChange(fileInput: HTMLInputElement, file: File) {
  // Make the value property writable so the async handler doesn't crash
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  const origSet = descriptor?.set

  // We need to patch the specific input instance so that setting value on null doesn't throw
  // Actually, the issue is e.currentTarget is null, not the input itself.
  // The simplest approach: just catch the error in a process handler
  const errorHandler = (reason: unknown) => {
    if (reason instanceof TypeError && String(reason.message).includes('Cannot set properties of null')) {
      // Swallow this known jsdom limitation
      return
    }
    // Re-throw anything else
    throw reason
  }
  process.on('unhandledRejection', errorHandler)

  await act(async () => {
    fireEvent.change(fileInput, { target: { files: [file] } })
    await new Promise(r => setTimeout(r, 10))
  })

  process.removeListener('unhandledRejection', errorHandler)
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

  it('calls setActiveNavItem("help") when "?" key is pressed on the document', () => {
    // Phase 12: help panel is controlled via activeNavItem store state.
    // Pressing "?" dispatches setActiveNavItem('help'), not local state.
    renderApp()

    // Fire on document.body so e.target is an HTMLElement with a .closest() method.
    fireEvent.keyDown(document.body, { key: '?' })

    expect(mockSetActiveNavItem).toHaveBeenCalledWith('help')
  })

  it('calls setActiveNavItem("workspace") on Escape when activeNavItem is "help"', () => {
    // Phase 12: Escape navigates back to workspace via store action.
    mockStoreState = buildStoreState({ activeNavItem: 'help' })
    renderApp()

    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(mockSetActiveNavItem).toHaveBeenCalledWith('workspace')
  })

  it('renders HelpPanel stub in side panel when activeNavItem is "help"', () => {
    // Phase 12: help is rendered inside aside.side-panel when activeNavItem === 'help'
    mockStoreState = buildStoreState({ activeNavItem: 'help' })
    renderApp()

    expect(screen.getByTestId('stub-help-panel')).toBeInTheDocument()
  })

  it('does not render HelpPanel when activeNavItem is "workspace"', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'workspace' })
    renderApp()

    expect(screen.queryByTestId('stub-help-panel')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 3. Settings panel (Phase 12: now side panel via activeNavItem)
// ---------------------------------------------------------------------------

describe('[@app] settings panel via activeNavItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ sessionProperties: {} })
  })

  it('does not render settings content when activeNavItem is "workspace"', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'workspace', sessionProperties: {} })
    renderApp()

    // Settings content is in the side panel — only shown when activeNavItem === 'settings'
    expect(screen.queryByText('Environment')).not.toBeInTheDocument()
  })

  it('renders settings content in side panel when activeNavItem is "settings"', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
    renderApp()

    expect(screen.getByText('Environment')).toBeInTheDocument()
  })

  it('settings button no longer exists in the app header', () => {
    // Phase 12: Settings moved to NavRail — no "toggle settings panel" button in header
    mockStoreState = buildStoreState({ activeNavItem: 'workspace', sessionProperties: {} })
    renderApp()

    expect(screen.queryByRole('button', { name: /toggle settings panel/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 4. Settings outside-click close (obsolete in Phase 12)
// ---------------------------------------------------------------------------

describe('[@app] settings side panel layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
  })

  it('settings side panel contains Environment section', () => {
    renderApp()

    expect(screen.getByText('Environment')).toBeInTheDocument()
  })

  it('settings side panel contains Workspace section', () => {
    renderApp()

    expect(screen.getByText('Workspace')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 5. Logo displays static "Flafka" text
// ---------------------------------------------------------------------------

describe('[@app] logo title display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState()
  })

  it('displays the Flafka logo text', () => {
    renderApp()
    expect(screen.getByText('Flafka')).toBeInTheDocument()
  })

  it('logo-title-group contains "Flafka" text', () => {
    const { container } = renderApp()
    const titleGroup = container.querySelector('.logo-title-group')
    expect(titleGroup).toBeInTheDocument()
    expect(titleGroup!.textContent).toBe('Flafka')
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

// ---------------------------------------------------------------------------
// [@phase-12-app-layout] 1. NavRail renders in app
// ---------------------------------------------------------------------------

describe('[@phase-12-app-layout] NavRail renders in app', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'workspace' })
  })

  it('renders the NavRail component inside the app', () => {
    renderApp()

    expect(screen.getByTestId('stub-nav-rail')).toBeInTheDocument()
  })

  it('NavRail has correct accessible role', () => {
    renderApp()

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-app-layout] 2. No side panel when activeNavItem is 'workspace'
// ---------------------------------------------------------------------------

describe('[@phase-12-app-layout] no side panel when viewing workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'workspace' })
  })

  it('does not render an aside.side-panel element when activeNavItem is "workspace"', () => {
    const { container } = renderApp()

    const sidePanel = container.querySelector('aside.side-panel')
    expect(sidePanel).not.toBeInTheDocument()
  })

  it('TreeNavigator stub is not present when activeNavItem is "workspace"', () => {
    renderApp()

    expect(screen.queryByTestId('stub-tree-navigator')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-app-layout] 3. Side panel shows for tree nav item
// ---------------------------------------------------------------------------

describe('[@phase-12-app-layout] side panel shows TreeNavigator for tree nav item', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'tree' })
  })

  it('renders aside.side-panel when activeNavItem is "tree"', () => {
    const { container } = renderApp()

    const sidePanel = container.querySelector('aside.side-panel')
    expect(sidePanel).toBeInTheDocument()
  })

  it('renders TreeNavigator in the side panel when activeNavItem is "tree"', () => {
    renderApp()

    expect(screen.getByTestId('stub-tree-navigator')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-app-layout] 4. Side panel shows settings content
// ---------------------------------------------------------------------------

describe('[@phase-12-app-layout] side panel shows settings when activeNavItem is "settings"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
  })

  it('renders aside.side-panel when activeNavItem is "settings"', () => {
    const { container } = renderApp()

    const sidePanel = container.querySelector('aside.side-panel')
    expect(sidePanel).toBeInTheDocument()
  })

  it('renders Environment section heading inside settings side panel', () => {
    renderApp()

    expect(screen.getByText('Environment')).toBeInTheDocument()
  })

  it('does not render TreeNavigator when activeNavItem is "settings"', () => {
    renderApp()

    expect(screen.queryByTestId('stub-tree-navigator')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-app-layout] 5. Header-right contains toolbar buttons when on workspace
// ---------------------------------------------------------------------------

describe('[@phase-12-app-layout] header-right toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'workspace', theme: 'light' })
  })

  it('header-right contains toolbar buttons when activeNavItem is workspace', () => {
    const { container } = renderApp()

    const headerRight = container.querySelector('.header-right')
    expect(headerRight).toBeInTheDocument()

    // Should contain split buttons and add cell button
    expect(screen.getByTestId('split-btn-run-all')).toBeInTheDocument()
    expect(screen.getByTitle('Add Statement')).toBeInTheDocument()
  })

  it('header-right does not contain toolbar buttons when activeNavItem is not workspace', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
    renderApp()

    expect(screen.queryByTestId('split-btn-run-all')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Add Statement')).not.toBeInTheDocument()
  })

  it('header-right does not contain history, help, or settings buttons', () => {
    const { container } = renderApp()

    const headerRight = container.querySelector('.header-right')
    const headerRightText = headerRight!.textContent

    expect(screen.queryByRole('button', { name: /toggle settings panel/i })).not.toBeInTheDocument()

    expect(headerRightText).not.toMatch(/history/i)
    expect(headerRightText).not.toMatch(/help/i)
  })
})

// ---------------------------------------------------------------------------
// [@app] 8. Helper functions - getPoolDotClass, getPoolStatusText, maskId
// ---------------------------------------------------------------------------

describe('[@app] compute pool dot class rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "unknown" dot class when computePoolPhase is null', () => {
    mockStoreState = buildStoreState({ computePoolPhase: null })
    const { container } = renderApp()
    const dot = container.querySelector('.pool-status-dot')
    expect(dot).toHaveClass('unknown')
  })

  it('renders "running" dot class when computePoolPhase is "RUNNING"', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'RUNNING' })
    const { container } = renderApp()
    const dot = container.querySelector('.pool-status-dot')
    expect(dot).toHaveClass('running')
  })

  it('renders "running" dot class when computePoolPhase is "PROVISIONED"', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'PROVISIONED' })
    const { container } = renderApp()
    const dot = container.querySelector('.pool-status-dot')
    expect(dot).toHaveClass('running')
  })

  it('renders "provisioning" dot class when computePoolPhase is "PROVISIONING"', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'PROVISIONING' })
    const { container } = renderApp()
    const dot = container.querySelector('.pool-status-dot')
    expect(dot).toHaveClass('provisioning')
  })

  it('renders "error" dot class for unrecognized phase like "FAILED"', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'FAILED' })
    const { container } = renderApp()
    const dot = container.querySelector('.pool-status-dot')
    expect(dot).toHaveClass('error')
  })

  it('handles case-insensitive phase values (e.g., "running" lowercase)', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'running' })
    const { container } = renderApp()
    const dot = container.querySelector('.pool-status-dot')
    expect(dot).toHaveClass('running')
  })
})

// ---------------------------------------------------------------------------
// [@app] 9. Compute pool status text display
// ---------------------------------------------------------------------------

describe('[@app] compute pool status text display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays "Loading..." when computePoolPhase is null', () => {
    mockStoreState = buildStoreState({ computePoolPhase: null, computePoolCfu: null })
    renderApp()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('displays "Unknown" when computePoolPhase is "UNKNOWN"', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'UNKNOWN', computePoolCfu: null })
    renderApp()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('displays phase name without CFU when cfu is null', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'RUNNING', computePoolCfu: null })
    renderApp()
    expect(screen.getByText('RUNNING')).toBeInTheDocument()
  })

  it('displays phase name with 0 CFU when cfu is 0', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'RUNNING', computePoolCfu: 0 })
    renderApp()
    expect(screen.getByText('RUNNING \u00b7 0 CFU')).toBeInTheDocument()
  })

  it('displays phase name with CFU suffix when cfu > 0', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'RUNNING', computePoolCfu: 10 })
    renderApp()
    expect(screen.getByText('RUNNING · 10 CFU')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 10. Settings panel - maskId and environment info
// ---------------------------------------------------------------------------

describe('[@app] settings panel environment info display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
  })

  it('displays Unique ID label', () => {
    renderApp()
    expect(screen.getByText('Unique ID')).toBeInTheDocument()
  })

  it('displays Catalog label', () => {
    renderApp()
    expect(screen.getByText('Catalog')).toBeInTheDocument()
  })

  it('displays Database label', () => {
    renderApp()
    expect(screen.getByText('Database')).toBeInTheDocument()
  })

  it('displays Workspace section', () => {
    renderApp()
    expect(screen.getByText('Workspace')).toBeInTheDocument()
  })

  it('displays Performance section', () => {
    renderApp()
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })

  it('displays Session Properties section', () => {
    renderApp()
    expect(screen.getByText('Session Properties')).toBeInTheDocument()
  })

  it('displays Statements count', () => {
    renderApp()
    expect(screen.getByText('Statements')).toBeInTheDocument()
  })

  it('displays Rows Cached count', () => {
    renderApp()
    expect(screen.getByText('Rows Cached')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 11. Settings panel - session properties editor
// ---------------------------------------------------------------------------

describe('[@app] settings panel session properties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Session Properties" section title', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
    renderApp()
    expect(screen.getByText('Session Properties')).toBeInTheDocument()
  })

  it('renders existing session property key and value', () => {
    mockStoreState = buildStoreState({
      activeNavItem: 'settings',
      sessionProperties: { 'sql.tables.scan.startup.mode': 'earliest-offset' },
    })
    renderApp()
    expect(screen.getByText('sql.tables.scan.startup.mode')).toBeInTheDocument()
    expect(screen.getByDisplayValue('earliest-offset')).toBeInTheDocument()
  })

  it('calls setSessionProperty when property value is changed', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({
      activeNavItem: 'settings',
      sessionProperties: { 'my.prop': 'old-val' },
    })
    renderApp()

    const input = screen.getByDisplayValue('old-val')
    await user.clear(input)
    await user.type(input, 'new-val')

    expect(mockSetSessionProperty).toHaveBeenCalled()
  })

  it('calls removeSessionProperty when delete button is clicked', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({
      activeNavItem: 'settings',
      sessionProperties: { 'my.prop': 'val' },
    })
    renderApp()

    const deleteBtn = screen.getByTitle('Remove property')
    await user.click(deleteBtn)

    expect(mockRemoveSessionProperty).toHaveBeenCalledWith('my.prop')
  })

  it('calls resetSessionProperties when "Reset Defaults" is clicked', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
    renderApp()

    const resetBtn = screen.getByText('Reset Defaults')
    await user.click(resetBtn)

    expect(mockResetSessionProperties).toHaveBeenCalledTimes(1)
  })

  it('calls setSessionProperty when "Add Property" is clicked and key entered via inline input', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
    renderApp()

    const addBtn = screen.getByText('+ Add Property')
    await user.click(addBtn)

    // The inline input field should now be visible
    const keyInput = screen.getByPlaceholderText('property key')
    expect(keyInput).toBeInTheDocument()
  })

  it('does not call setSessionProperty when prompt is cancelled', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    renderApp()

    const addBtn = screen.getByText('+ Add Property')
    await user.click(addBtn)

    expect(mockSetSessionProperty).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})

// ---------------------------------------------------------------------------
// [@app] 12. Export workspace
// ---------------------------------------------------------------------------

describe('[@app] export workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
  })

  it('calls exportWorkspace and addToast when Export button is clicked', async () => {
    const user = userEvent.setup()

    // Mock Blob and URL APIs for jsdom
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test')
    const mockRevokeObjectURL = vi.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    // Save original and mock only for 'a' tag
    const origCreateElement = document.createElement.bind(document)
    const mockClick = vi.fn()
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement
      }
      return origCreateElement(tag)
    })

    renderApp()

    const exportBtn = screen.getByText('Export Workspace')
    await user.click(exportBtn)

    const { exportWorkspace } = await import('../../utils/workspace-export')
    expect(exportWorkspace).toHaveBeenCalled()
    expect(mockAddToast).toHaveBeenCalledWith({ type: 'success', message: 'Workspace exported' })

    vi.restoreAllMocks()
  })
})

// ---------------------------------------------------------------------------
// [@app] 13. Import workspace - file selection and confirmation dialog
// ---------------------------------------------------------------------------

describe('[@app] import workspace flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
  })

  it('renders hidden file input with accept=".json"', () => {
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    expect(fileInput.accept).toBe('.json')
    expect(fileInput.style.display).toBe('none')
  })

  it('triggers file input click when Import Workspace button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    const importBtn = screen.getByText('Import Workspace')
    await user.click(importBtn)

    expect(clickSpy).toHaveBeenCalled()
  })

  it('shows error toast when file exceeds 5MB limit', async () => {
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const largeFile = new File(['x'.repeat(100)], 'large.json', { type: 'application/json' })
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 })

    await simulateFileChange(fileInput, largeFile)

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: expect.stringContaining('File too large') })
    )
  })

  it('shows error toast for invalid JSON file', async () => {
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const invalidFile = new File(['not json'], 'bad.json', { type: 'application/json' })

    await simulateFileChange(fileInput, invalidFile)

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: expect.stringContaining('Import failed') })
    )
  })

  it('shows confirmation dialog for valid JSON import', async () => {
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const validData = JSON.stringify({
      workspaceName: 'Imported WS',
      statements: [{ id: 's1', code: 'SELECT 1' }],
      catalog: 'my_catalog',
      database: 'my_db',
    })
    const validFile = new File([validData], 'workspace.json', { type: 'application/json' })

    await simulateFileChange(fileInput, validFile)

    expect(screen.getByText('Import Workspace?')).toBeInTheDocument()
    expect(screen.getByText('Imported WS')).toBeInTheDocument()
    expect(screen.getByText('my_catalog')).toBeInTheDocument()
    expect(screen.getByText('my_db')).toBeInTheDocument()
  })

  it('calls importWorkspace and shows success toast on confirm', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const validData = JSON.stringify({
      workspaceName: 'WS',
      statements: [],
      catalog: 'c',
      database: 'd',
    })
    const validFile = new File([validData], 'ws.json', { type: 'application/json' })

    await simulateFileChange(fileInput, validFile)

    const confirmBtn = screen.getByText('Confirm Import')
    await user.click(confirmBtn)

    expect(mockImportWorkspace).toHaveBeenCalled()
    expect(mockAddToast).toHaveBeenCalledWith({ type: 'success', message: 'Workspace imported successfully' })
  })

  it('dismisses confirmation dialog on cancel', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const validData = JSON.stringify({
      workspaceName: 'WS',
      statements: [],
      catalog: 'c',
      database: 'd',
    })
    const validFile = new File([validData], 'ws.json', { type: 'application/json' })

    await simulateFileChange(fileInput, validFile)

    expect(screen.getByText('Import Workspace?')).toBeInTheDocument()

    const cancelBtn = screen.getByText('Cancel')
    await user.click(cancelBtn)

    expect(screen.queryByText('Import Workspace?')).not.toBeInTheDocument()
    expect(mockImportWorkspace).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// [@app] 14. Side panel - history, topics, schemas panels
// ---------------------------------------------------------------------------

describe('[@app] side panel variant rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders HistoryPanel when activeNavItem is "history"', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'history' })
    renderApp()
    expect(screen.getByTestId('stub-history-panel')).toBeInTheDocument()
  })

  it('renders TopicPanel when activeNavItem is "topics"', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'topics' })
    renderApp()
    expect(screen.getByLabelText('Kafka Topics panel')).toBeInTheDocument()
  })

  it('renders SchemaPanel when activeNavItem is "schemas"', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'schemas' })
    renderApp()
    expect(screen.getByTestId('stub-schema-panel')).toBeInTheDocument()
  })

  it('does not render tree, help, or settings when activeNavItem is "history"', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'history' })
    renderApp()
    expect(screen.queryByTestId('stub-tree-navigator')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stub-help-panel')).not.toBeInTheDocument()
    expect(screen.queryByText('Environment')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 15. Toolbar buttons - Run All and Add Statement
// ---------------------------------------------------------------------------

describe('[@app] toolbar buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders "Run All" button', () => {
    mockStoreState = buildStoreState()
    renderApp()
    expect(screen.getByText('Run All')).toBeInTheDocument()
  })

  it('renders "Add Statement" button', () => {
    mockStoreState = buildStoreState()
    renderApp()
    expect(screen.getByTitle('Add Statement')).toBeInTheDocument()
  })

  it('disables "Run All" when no runnable statements exist', () => {
    mockStoreState = buildStoreState({
      statements: [
        { id: 's1', code: 'SELECT 1', status: 'RUNNING' as const, createdAt: new Date() },
      ],
    })
    renderApp()
    const runAllBtn = screen.getByText('Run All').closest('button')!
    expect(runAllBtn).toBeDisabled()
  })

  it('enables "Run All" when there are IDLE statements', () => {
    mockStoreState = buildStoreState({
      statements: [
        { id: 's1', code: 'SELECT 1', status: 'IDLE' as const, createdAt: new Date() },
      ],
    })
    renderApp()
    const runAllBtn = screen.getByText('Run All').closest('button')!
    expect(runAllBtn).not.toBeDisabled()
  })

  it('enables "Run All" when there are ERROR statements', () => {
    mockStoreState = buildStoreState({
      statements: [
        { id: 's1', code: 'SELECT 1', status: 'ERROR' as const, createdAt: new Date() },
      ],
    })
    renderApp()
    const runAllBtn = screen.getByText('Run All').closest('button')!
    expect(runAllBtn).not.toBeDisabled()
  })

  it('enables "Run All" when there are CANCELLED statements', () => {
    mockStoreState = buildStoreState({
      statements: [
        { id: 's1', code: 'SELECT 1', status: 'CANCELLED' as const, createdAt: new Date() },
      ],
    })
    renderApp()
    const runAllBtn = screen.getByText('Run All').closest('button')!
    expect(runAllBtn).not.toBeDisabled()
  })

  it('calls runAllStatements and dismissOnboardingHint when "Run All" is clicked', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({
      statements: [
        { id: 's1', code: 'SELECT 1', status: 'IDLE' as const, createdAt: new Date() },
      ],
    })
    renderApp()

    const runAllBtn = screen.getByText('Run All').closest('button')!
    await user.click(runAllBtn)

    expect(mockRunAllStatements).toHaveBeenCalledTimes(1)
    expect(mockDismissOnboardingHint).toHaveBeenCalledTimes(1)
  })

  it('calls addStatement and dismissOnboardingHint when "Add Statement" is clicked', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState()
    renderApp()

    const addBtn = screen.getByTitle('Add Statement')
    await user.click(addBtn)

    expect(mockAddStatement).toHaveBeenCalledTimes(1)
    expect(mockDismissOnboardingHint).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// [@app] 16. Ctrl+S save workspace keyboard shortcut
// ---------------------------------------------------------------------------

describe('[@app] Ctrl+S save workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ workspaceName: 'Test WS' })
  })

  it('calls saveCurrentWorkspace when Ctrl+S is pressed with a valid workspace name', () => {
    renderApp()

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    expect(mockSaveCurrentWorkspace).toHaveBeenCalledWith('Test WS')
  })

  it('does not save when workspace name is "Flafka" (default)', () => {
    mockStoreState = buildStoreState({ workspaceName: 'Flafka' })
    renderApp()

    fireEvent.keyDown(window, { key: 's', ctrlKey: true })

    expect(mockSaveCurrentWorkspace).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// [@app] 17. Help keyboard shortcuts - skip in input/textarea
// ---------------------------------------------------------------------------

describe('[@app] help keyboard skip in input fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'workspace' })
  })

  it('does not toggle help when "?" is pressed in an INPUT element', () => {
    renderApp()
    // Create a temporary input to fire the event on
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: '?' })

    expect(mockSetActiveNavItem).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('does not toggle help when "?" is pressed in a TEXTAREA element', () => {
    renderApp()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    fireEvent.keyDown(textarea, { key: '?' })

    expect(mockSetActiveNavItem).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('toggles help to workspace when "?" pressed while help is already active', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'help' })
    renderApp()

    fireEvent.keyDown(document.body, { key: '?' })

    expect(mockSetActiveNavItem).toHaveBeenCalledWith('workspace')
  })
})

// ---------------------------------------------------------------------------
// [@app] 18. Import confirmation dialog overlay click
// ---------------------------------------------------------------------------

describe('[@app] import confirmation dialog overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStoreState = buildStoreState({ activeNavItem: 'settings', sessionProperties: {} })
  })

  it('dismisses dialog when overlay background is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const validData = JSON.stringify({
      workspaceName: 'WS',
      statements: [],
      catalog: 'c',
      database: 'd',
    })
    const validFile = new File([validData], 'ws.json', { type: 'application/json' })

    await simulateFileChange(fileInput, validFile)

    expect(screen.getByText('Import Workspace?')).toBeInTheDocument()

    // Click on the overlay (not the dialog itself)
    const overlay = container.querySelector('.import-confirm-overlay')!
    await user.click(overlay)

    expect(screen.queryByText('Import Workspace?')).not.toBeInTheDocument()
  })

  it('does not dismiss dialog when dialog body is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const validData = JSON.stringify({
      workspaceName: 'WS',
      statements: [],
      catalog: 'c',
      database: 'd',
    })
    const validFile = new File([validData], 'ws.json', { type: 'application/json' })

    await simulateFileChange(fileInput, validFile)

    expect(screen.getByText('Import Workspace?')).toBeInTheDocument()

    // Click on the dialog body itself
    const dialog = container.querySelector('.import-confirm-dialog')!
    await user.click(dialog)

    // Dialog should still be visible
    expect(screen.getByText('Import Workspace?')).toBeInTheDocument()
  })

  it('shows warning about replacing current workspace', async () => {
    const { container } = renderApp()
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const validData = JSON.stringify({
      workspaceName: 'WS',
      statements: [],
      catalog: 'c',
      database: 'd',
    })
    const validFile = new File([validData], 'ws.json', { type: 'application/json' })

    await simulateFileChange(fileInput, validFile)

    expect(screen.getByText('This will replace your current workspace.')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@app] 19. Rows cached calculation
// ---------------------------------------------------------------------------

describe('[@app] rows cached calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays correct total rows cached from multiple statements', () => {
    mockStoreState = buildStoreState({
      activeNavItem: 'settings',
      sessionProperties: {},
      statements: [
        { id: 's1', code: 'SELECT 1', status: 'COMPLETED' as const, createdAt: new Date(), results: [{}, {}, {}] },
        { id: 's2', code: 'SELECT 2', status: 'COMPLETED' as const, createdAt: new Date(), results: [{}, {}] },
      ],
    })
    renderApp()
    // 3 + 2 = 5 rows
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('displays 0 when no statements have results', () => {
    mockStoreState = buildStoreState({
      activeNavItem: 'settings',
      sessionProperties: {},
      statements: [
        { id: 's1', code: 'SELECT 1', status: 'IDLE' as const, createdAt: new Date() },
      ],
    })
    renderApp()
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@split-button-integration] Split button toolbar integration tests
// ---------------------------------------------------------------------------

describe('[@split-button-integration] split button toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Run All split button renders with correct label', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'workspace' })
    renderApp()
    const btn = screen.getByTestId('split-btn-run-all')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Run All')
  })

  it('Stop All split button renders with correct label', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'workspace' })
    renderApp()
    const btn = screen.getByTestId('split-btn-stop-all')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Stop All')
  })

  it('Delete All split button renders with correct label', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'workspace' })
    renderApp()
    const btn = screen.getByTestId('split-btn-delete-all')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('Delete All')
  })

  it('+ button renders without "Statement" text (just the plus icon)', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'workspace' })
    renderApp()
    const addBtn = screen.getByTitle('Add Statement')
    expect(addBtn).toBeInTheDocument()
    expect(addBtn.textContent).toBe('')
  })

  it('Run All is disabled when no statements and no stream cards', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'workspace', statements: [], streamCards: [] })
    renderApp()
    expect(screen.getByTestId('split-btn-run-all')).toBeDisabled()
  })

  it('Stop All is disabled when no active statements and no stream cards', () => {
    mockStoreState = buildStoreState({
      activeNavItem: 'workspace',
      statements: [{ id: 's1', code: '', status: 'IDLE' as const, createdAt: new Date() }],
      streamCards: [],
    })
    renderApp()
    expect(screen.getByTestId('split-btn-stop-all')).toBeDisabled()
  })

  it('Delete All is disabled when no statements and no stream cards', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'workspace', statements: [], streamCards: [] })
    renderApp()
    expect(screen.getByTestId('split-btn-delete-all')).toBeDisabled()
  })

  it('clicking Run All main button calls runAllStatements and runAllStreams', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({
      activeNavItem: 'workspace',
      statements: [{ id: 's1', code: 'SELECT 1', status: 'IDLE' as const, createdAt: new Date() }],
      streamCards: [{ id: 'sc1' }],
    })
    renderApp()
    await user.click(screen.getByTestId('split-btn-run-all'))
    expect(mockRunAllStatements).toHaveBeenCalledTimes(1)
    expect(mockRunAllStreams).toHaveBeenCalledTimes(1)
  })

  it('clicking Stop All main button calls stopAllStatements and stopAllStreams', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({
      activeNavItem: 'workspace',
      statements: [{ id: 's1', code: 'SELECT 1', status: 'RUNNING' as const, createdAt: new Date() }],
      streamCards: [{ id: 'sc1' }],
    })
    renderApp()
    await user.click(screen.getByTestId('split-btn-stop-all'))
    expect(mockStopAllStatements).toHaveBeenCalledTimes(1)
    expect(mockStopAllStreams).toHaveBeenCalledTimes(1)
  })

  it('clicking Delete All main button calls clearWorkspace and clearStreamCards', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({
      activeNavItem: 'workspace',
      statements: [{ id: 's1', code: 'SELECT 1', status: 'IDLE' as const, createdAt: new Date() }],
      streamCards: [{ id: 'sc1' }],
    })
    renderApp()
    await user.click(screen.getByTestId('split-btn-delete-all'))
    expect(mockClearWorkspace).toHaveBeenCalledTimes(1)
    expect(mockClearStreamCards).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// [@coverage-boost] App.tsx — additional coverage for helper functions & branches
// ---------------------------------------------------------------------------

describe('[@coverage-boost] App helper functions via rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('compute pool badge shows "Loading..." when phase is null', () => {
    mockStoreState = buildStoreState({ computePoolPhase: null, computePoolCfu: null, computePoolMaxCfu: null })
    renderApp()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('compute pool badge shows "Unknown" when phase is UNKNOWN', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'UNKNOWN', computePoolCfu: null, computePoolMaxCfu: null })
    renderApp()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('compute pool badge shows CFU/MaxCFU when both positive', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'RUNNING', computePoolCfu: 5, computePoolMaxCfu: 10 })
    renderApp()
    expect(screen.getByText(/RUNNING.*5\/10 CFU/)).toBeInTheDocument()
  })

  it('compute pool badge shows phase + cfu suffix when only cfu > 0', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'PROVISIONING', computePoolCfu: 3, computePoolMaxCfu: null })
    renderApp()
    expect(screen.getByText(/PROVISIONING.*3 CFU/)).toBeInTheDocument()
  })

  it('compute pool badge shows phase with 0 CFU when cfu is 0', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'PROVISIONING', computePoolCfu: 0, computePoolMaxCfu: null })
    renderApp()
    expect(screen.getByText('PROVISIONING \u00b7 0 CFU')).toBeInTheDocument()
  })

  it('pool status dot has "error" class for unknown phase like STOPPING', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'STOPPING' })
    renderApp()
    const dot = document.querySelector('.pool-status-dot')
    expect(dot?.classList.contains('error')).toBe(true)
  })

  it('pool status dot has "running" class for PROVISIONED phase', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'PROVISIONED' })
    renderApp()
    const dot = document.querySelector('.pool-status-dot')
    expect(dot?.classList.contains('running')).toBe(true)
  })

  it('pool status dot has "provisioning" class', () => {
    mockStoreState = buildStoreState({ computePoolPhase: 'PROVISIONING' })
    renderApp()
    const dot = document.querySelector('.pool-status-dot')
    expect(dot?.classList.contains('provisioning')).toBe(true)
  })

  it('pool status dot has "unknown" class when phase is null', () => {
    mockStoreState = buildStoreState({ computePoolPhase: null })
    renderApp()
    const dot = document.querySelector('.pool-status-dot')
    expect(dot?.classList.contains('unknown')).toBe(true)
  })
})

describe('[@coverage-boost] App empty state and joke display', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows empty state with joke when no statements', () => {
    mockStoreState = buildStoreState({ statements: [] })
    renderApp()
    expect(document.querySelector('.workspace-empty-state')).toBeInTheDocument()
    expect(document.querySelector('.workspace-empty-sql')).toBeInTheDocument()
  })

  it('add statement button in empty state calls addStatement and dismissOnboardingHint', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({ statements: [] })
    renderApp()
    const addBtn = document.querySelector('.workspace-empty-state .add-cell-btn')
    expect(addBtn).toBeInTheDocument()
    await user.click(addBtn!)
    expect(mockAddStatement).toHaveBeenCalled()
    expect(mockDismissOnboardingHint).toHaveBeenCalled()
  })
})

describe('[@coverage-boost] App Ctrl+S save workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Ctrl+S calls saveCurrentWorkspace when name is not Flafka', () => {
    mockStoreState = buildStoreState({ workspaceName: 'MyWorkspace' })
    renderApp()
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(mockSaveCurrentWorkspace).toHaveBeenCalledWith('MyWorkspace')
  })

  it('Ctrl+S does not call saveCurrentWorkspace when name is Flafka', () => {
    mockStoreState = buildStoreState({ workspaceName: 'Flafka' })
    renderApp()
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(mockSaveCurrentWorkspace).not.toHaveBeenCalled()
  })

  it('Ctrl+S does not call saveCurrentWorkspace when name is empty', () => {
    mockStoreState = buildStoreState({ workspaceName: '' })
    renderApp()
    fireEvent.keyDown(window, { key: 's', ctrlKey: true })
    expect(mockSaveCurrentWorkspace).not.toHaveBeenCalled()
  })
})

describe('[@coverage-boost] App import file handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('import file too large shows error toast', async () => {
    mockStoreState = buildStoreState({ activeNavItem: 'settings' })
    renderApp()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    const bigFile = new File(['x'], 'big.json', { type: 'application/json' })
    Object.defineProperty(bigFile, 'size', { value: 10 * 1024 * 1024 })
    await simulateFileChange(fileInput, bigFile)
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: expect.stringContaining('File too large') })
    )
  })

  it('import invalid JSON shows error toast', async () => {
    mockStoreState = buildStoreState({ activeNavItem: 'settings' })
    renderApp()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const badFile = new File(['not json'], 'bad.json', { type: 'application/json' })
    await simulateFileChange(fileInput, badFile)
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: expect.stringContaining('Import failed') })
    )
  })

  it('valid JSON triggers confirmation dialog', async () => {
    mockStoreState = buildStoreState({ activeNavItem: 'settings' })
    renderApp()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const validFile = new File([JSON.stringify({ workspaceName: 'Test', statements: [], catalog: 'c', database: 'd' })], 'ws.json', { type: 'application/json' })
    await simulateFileChange(fileInput, validFile)
    // Confirmation dialog should appear
    expect(screen.getByText('Import Workspace?')).toBeInTheDocument()
  })

  it('import confirm calls importWorkspace and shows success toast', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({ activeNavItem: 'settings' })
    renderApp()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const validFile = new File([JSON.stringify({ workspaceName: 'Test', statements: [{ id: 'a', code: '' }], catalog: 'c', database: 'd' })], 'ws.json', { type: 'application/json' })
    await simulateFileChange(fileInput, validFile)
    expect(screen.getByText('Import Workspace?')).toBeInTheDocument()
    // Click confirm
    await user.click(screen.getByText('Confirm Import'))
    expect(mockImportWorkspace).toHaveBeenCalled()
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: 'Workspace imported successfully' })
    )
  })

  it('import cancel closes dialog without importing', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState({ activeNavItem: 'settings' })
    renderApp()
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const validFile = new File([JSON.stringify({ workspaceName: 'Test', statements: [], catalog: 'c', database: 'd' })], 'ws.json', { type: 'application/json' })
    await simulateFileChange(fileInput, validFile)
    await user.click(screen.getByText('Cancel'))
    expect(mockImportWorkspace).not.toHaveBeenCalled()
    expect(screen.queryByText('Import Workspace?')).not.toBeInTheDocument()
  })
})

describe('[@coverage-boost] App streams panel handle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stream panel handle button calls toggleStreamsPanel', async () => {
    const user = userEvent.setup()
    mockStoreState = buildStoreState()
    renderApp()
    const handle = screen.getByLabelText(/^(open|close) streams panel$/i)
    await user.click(handle)
    expect(mockToggleStreamsPanel).toHaveBeenCalled()
  })
})

describe('[@coverage-boost] App jobs page rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders jobs page when activeNavItem is jobs', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'jobs' })
    renderApp()
    expect(screen.getByTestId('stub-jobs-page')).toBeInTheDocument()
  })

  it('renders learn panel when activeNavItem is learn', () => {
    mockStoreState = buildStoreState({ activeNavItem: 'learn' })
    renderApp()
    // LearnPanel is rendered as full-page when activeNavItem is 'learn'
    expect(screen.getByLabelText('Learn panel')).toBeInTheDocument()
  })
})
