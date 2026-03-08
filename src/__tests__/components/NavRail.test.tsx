import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Store mock — controlled via mutable module-level variables
// ---------------------------------------------------------------------------

const mockSetActiveNavItem = vi.fn()
const mockToggleNavExpanded = vi.fn()

let mockActiveNavItem = 'workspace'
let mockNavExpanded = false

const mockToggleTheme = vi.fn()
let mockTheme = 'light'
let mockKsqlFeatureEnabled = false

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      activeNavItem: mockActiveNavItem,
      navExpanded: mockNavExpanded,
      setActiveNavItem: mockSetActiveNavItem,
      toggleNavExpanded: mockToggleNavExpanded,
      theme: mockTheme,
      toggleTheme: mockToggleTheme,
      ksqlFeatureEnabled: mockKsqlFeatureEnabled,
    }
    return typeof selector === 'function' ? selector(state) : state
  },
}))

// Mock isKsqlEnabled from environment config
let mockIsKsqlEnabled = false
vi.mock('../../config/environment', () => ({
  isKsqlEnabled: () => mockIsKsqlEnabled,
}))

// Import the component after mocks are registered
import { NavRail } from '../../components/NavRail/NavRail'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderNavRail() {
  return render(<NavRail />)
}

// ---------------------------------------------------------------------------
// [@phase-12-nav-rail] 1. Renders all nav items
// ---------------------------------------------------------------------------

describe('[@phase-12-nav-rail] renders all nav items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveNavItem = 'workspace'
    mockNavExpanded = false
  })

  it('renders all nav item buttons by aria-label', () => {
    renderNavRail()

    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jobs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Database Objects' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Topics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schemas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Workspaces' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Snippets' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Artifacts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learn' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })

  it('renders the theme toggle button', () => {
    renderNavRail()

    // Theme toggle button is rendered
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-nav-rail] 2. Section headers when expanded
// ---------------------------------------------------------------------------

describe('[@phase-12-nav-rail] renders section headers when expanded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveNavItem = 'workspace'
    mockNavExpanded = true
  })

  it('shows all four section header labels', () => {
    const { container } = renderNavRail()

    // Section headers live inside .nav-rail-section-header divs
    const headers = container.querySelectorAll('.nav-rail-section-header')
    const headerTexts = Array.from(headers).map((h) => h.textContent)
    expect(headerTexts).toContain('Workspace')
    expect(headerTexts).toContain('Data')
    expect(headerTexts).toContain('Tools')
    expect(headerTexts).toContain('Settings')
  })

  it('theme toggle button present when expanded', () => {
    renderNavRail()

    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-nav-rail] 3. Section headers present in DOM when collapsed
// ---------------------------------------------------------------------------

describe('[@phase-12-nav-rail] section headers always in DOM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveNavItem = 'workspace'
    mockNavExpanded = false
  })

  it('section headers are in the DOM even when nav is collapsed', () => {
    const { container } = renderNavRail()

    // They should always be rendered (visibility controlled by CSS)
    const headers = container.querySelectorAll('.nav-rail-section-header')
    const headerTexts = Array.from(headers).map((h) => h.textContent)
    expect(headerTexts).toContain('Workspace')
    expect(headerTexts).toContain('Data')
    expect(headerTexts).toContain('Tools')
    expect(headerTexts).toContain('Settings')
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-nav-rail] 4. Expand/collapse toggle
// ---------------------------------------------------------------------------

describe('[@phase-12-nav-rail] theme toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveNavItem = 'workspace'
    mockNavExpanded = false
    mockTheme = 'light'
  })

  it('calls toggleTheme when theme button is clicked', async () => {
    const user = userEvent.setup()
    renderNavRail()

    const themeBtn = screen.getByRole('button', { name: /switch to dark mode/i })
    await user.click(themeBtn)

    expect(mockToggleTheme).toHaveBeenCalledTimes(1)
  })

  it('theme button shows correct label based on theme state', () => {
    mockTheme = 'dark'
    renderNavRail()

    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-nav-rail] 5. Active item highlighting
// ---------------------------------------------------------------------------

describe('[@phase-12-nav-rail] active item highlighting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavExpanded = false
  })

  it('active item has nav-rail-item--active class', () => {
    mockActiveNavItem = 'workspace'
    renderNavRail()

    const workspaceBtn = screen.getByRole('button', { name: 'Workspace' })
    expect(workspaceBtn).toHaveClass('nav-rail-item--active')
  })

  it('inactive items do not have nav-rail-item--active class', () => {
    mockActiveNavItem = 'workspace'
    renderNavRail()

    const dbObjectsBtn = screen.getByRole('button', { name: 'Database Objects' })
    expect(dbObjectsBtn).not.toHaveClass('nav-rail-item--active')
  })

  it('correct item gets active class when activeNavItem is "tree"', () => {
    mockActiveNavItem = 'tree'
    renderNavRail()

    const dbObjectsBtn = screen.getByRole('button', { name: 'Database Objects' })
    expect(dbObjectsBtn).toHaveClass('nav-rail-item--active')

    const workspaceBtn = screen.getByRole('button', { name: 'Workspace' })
    expect(workspaceBtn).not.toHaveClass('nav-rail-item--active')
  })

  it('only one item has active class at a time', () => {
    mockActiveNavItem = 'settings'
    renderNavRail()

    const activeItems = document
      .querySelectorAll('.nav-rail-item--active')
    expect(activeItems).toHaveLength(1)
    expect(activeItems[0]).toHaveAttribute('aria-label', 'Settings')
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-nav-rail] 6. Click item sets active
// ---------------------------------------------------------------------------

describe('[@phase-12-nav-rail] click item calls setActiveNavItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveNavItem = 'workspace'
    mockNavExpanded = false
  })

  it('clicking a nav item calls setActiveNavItem with the item id', async () => {
    const user = userEvent.setup()
    renderNavRail()

    const dbObjectsBtn = screen.getByRole('button', { name: 'Database Objects' })
    await user.click(dbObjectsBtn)

    expect(mockSetActiveNavItem).toHaveBeenCalledWith('tree')
  })

  it('clicking History calls setActiveNavItem with "history"', async () => {
    const user = userEvent.setup()
    renderNavRail()

    const historyBtn = screen.getByRole('button', { name: 'History' })
    await user.click(historyBtn)

    expect(mockSetActiveNavItem).toHaveBeenCalledWith('history')
  })

  it('clicking Settings calls setActiveNavItem with "settings"', async () => {
    const user = userEvent.setup()
    renderNavRail()

    const settingsBtn = screen.getByRole('button', { name: 'Settings' })
    await user.click(settingsBtn)

    expect(mockSetActiveNavItem).toHaveBeenCalledWith('settings')
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-nav-rail] 7. Click active item toggles back to workspace
// ---------------------------------------------------------------------------

describe('[@phase-12-nav-rail] click active non-workspace item toggles to workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavExpanded = false
  })

  it('clicking active "tree" item sets activeNavItem to "workspace"', async () => {
    mockActiveNavItem = 'tree'
    const user = userEvent.setup()
    renderNavRail()

    const dbObjectsBtn = screen.getByRole('button', { name: 'Database Objects' })
    await user.click(dbObjectsBtn)

    // Active non-workspace item clicked → toggle back to workspace
    expect(mockSetActiveNavItem).toHaveBeenCalledWith('workspace')
  })

  it('clicking active "settings" item sets activeNavItem to "workspace"', async () => {
    mockActiveNavItem = 'settings'
    const user = userEvent.setup()
    renderNavRail()

    const settingsBtn = screen.getByRole('button', { name: 'Settings' })
    await user.click(settingsBtn)

    expect(mockSetActiveNavItem).toHaveBeenCalledWith('workspace')
  })

  it('clicking active "history" item sets activeNavItem to "workspace"', async () => {
    mockActiveNavItem = 'history'
    const user = userEvent.setup()
    renderNavRail()

    const historyBtn = screen.getByRole('button', { name: 'History' })
    await user.click(historyBtn)

    expect(mockSetActiveNavItem).toHaveBeenCalledWith('workspace')
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-nav-rail] 8. Workspace item does NOT toggle away when active
// ---------------------------------------------------------------------------

describe('[@phase-12-nav-rail] workspace item stays on workspace when already active', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavExpanded = false
  })

  it('clicking workspace when already active calls setActiveNavItem with "workspace" (not toggling)', async () => {
    mockActiveNavItem = 'workspace'
    const user = userEvent.setup()
    renderNavRail()

    const workspaceBtn = screen.getByRole('button', { name: 'Workspace' })
    await user.click(workspaceBtn)

    // The handler: if item === activeNavItem && item !== 'workspace' → set to 'workspace'
    // else → set to item. So workspace when active → setActiveNavItem('workspace')
    expect(mockSetActiveNavItem).toHaveBeenCalledWith('workspace')
  })
})

// ---------------------------------------------------------------------------
// [@phase-12-nav-rail] 9. Accessibility
// ---------------------------------------------------------------------------

describe('[@phase-12-nav-rail] accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveNavItem = 'workspace'
    mockNavExpanded = false
    mockTheme = 'light'
  })

  it('nav element has aria-label "Main navigation"', () => {
    renderNavRail()

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', 'Main navigation')
  })

  it('all nav items have aria-label attributes', () => {
    renderNavRail()

    const expectedLabels = [
      'Workspace',
      'Jobs',
      'Database Objects',
      'Topics',
      'Schemas',
      'Workspaces',
      'Snippets',
      'History',
      'Artifacts',
      'Learn',
      'Help',
      'Settings',
    ]

    for (const label of expectedLabels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('active item has aria-current="page"', () => {
    mockActiveNavItem = 'tree'
    renderNavRail()

    const activeBtn = screen.getByRole('button', { name: 'Database Objects' })
    expect(activeBtn).toHaveAttribute('aria-current', 'page')
  })

  it('inactive items do not have aria-current attribute', () => {
    mockActiveNavItem = 'tree'
    renderNavRail()

    const inactiveBtn = screen.getByRole('button', { name: 'Workspace' })
    expect(inactiveBtn).not.toHaveAttribute('aria-current')
  })

  it('theme toggle button has aria-label', () => {
    renderNavRail()

    const themeBtn = screen.getByRole('button', { name: /switch to dark mode/i })
    expect(themeBtn).toHaveAttribute('aria-label', 'Switch to dark mode')
  })

  it('theme toggle button aria-label updates when theme is dark', () => {
    mockTheme = 'dark'
    renderNavRail()

    const themeBtn = screen.getByRole('button', { name: /switch to light mode/i })
    expect(themeBtn).toHaveAttribute('aria-label', 'Switch to light mode')
  })
})

// ---------------------------------------------------------------------------
// [@ksql-nav] 10. ksqlDB Queries nav item visibility
// ---------------------------------------------------------------------------

describe('[@ksql-nav] ksqlDB Queries nav item', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveNavItem = 'workspace'
    mockNavExpanded = false
    mockTheme = 'light'
  })

  it('shows ksqlDB Queries nav item when ksqlDB is enabled', () => {
    mockKsqlFeatureEnabled = true
    mockIsKsqlEnabled = true
    renderNavRail()

    expect(screen.getByRole('button', { name: 'ksqlDB Queries' })).toBeInTheDocument()
  })

  it('hides ksqlDB Queries nav item when ksqlFeatureEnabled is false', () => {
    mockKsqlFeatureEnabled = false
    mockIsKsqlEnabled = true
    renderNavRail()

    expect(screen.queryByRole('button', { name: 'ksqlDB Queries' })).not.toBeInTheDocument()
  })

  it('hides ksqlDB Queries nav item when isKsqlEnabled returns false', () => {
    mockKsqlFeatureEnabled = true
    mockIsKsqlEnabled = false
    renderNavRail()

    expect(screen.queryByRole('button', { name: 'ksqlDB Queries' })).not.toBeInTheDocument()
  })

  it('hides ksqlDB Queries nav item when both flags are false', () => {
    mockKsqlFeatureEnabled = false
    mockIsKsqlEnabled = false
    renderNavRail()

    expect(screen.queryByRole('button', { name: 'ksqlDB Queries' })).not.toBeInTheDocument()
  })

  it('clicking ksqlDB Queries calls setActiveNavItem with ksql-queries', async () => {
    mockKsqlFeatureEnabled = true
    mockIsKsqlEnabled = true
    const user = userEvent.setup()
    renderNavRail()

    const ksqlBtn = screen.getByRole('button', { name: 'ksqlDB Queries' })
    await user.click(ksqlBtn)

    expect(mockSetActiveNavItem).toHaveBeenCalledWith('ksql-queries')
  })
})
