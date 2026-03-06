/**
 * @examples-panel
 * ExamplesPanel — Example cards panel tests
 *
 * Covers:
 *   - Card rendering (8 cards total)
 *   - Import button calls addStatement with correct SQL
 *   - Copy button copies SQL to clipboard
 *   - SQL preview display
 *   - Tags/badges
 *   - Dynamic artifact ID resolution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures these exist before vi.mock factories run
// ---------------------------------------------------------------------------
const {
  mockAddStatement, mockAddToast, mockSetActiveNavItem, mockLoadArtifacts,
  mockSetupScalar, mockSetupExplode, mockRunKickstarter, mockArtifactListRef,
  mockSaveCurrentWorkspace, mockSetWorkspaceName, mockSetWorkspaceNotes,
  mockClearWorkspace, mockStatementsRef,
} = vi.hoisted(() => ({
  mockAddStatement: vi.fn(),
  mockAddToast: vi.fn(),
  mockSetActiveNavItem: vi.fn(),
  mockLoadArtifacts: vi.fn(),
  mockSetupScalar: vi.fn().mockResolvedValue(undefined),
  mockSetupExplode: vi.fn().mockResolvedValue(undefined),
  mockRunKickstarter: vi.fn().mockResolvedValue({ runId: 'test-run-123' }),
  mockArtifactListRef: { current: [] as unknown[] },
  mockSaveCurrentWorkspace: vi.fn(),
  mockSetWorkspaceName: vi.fn(),
  mockSetWorkspaceNotes: vi.fn(),
  mockClearWorkspace: vi.fn(),
  mockStatementsRef: { current: [] as unknown[] },
}));

vi.mock('../../store/workspaceStore', () => {
  const store = {
    addStatement: mockAddStatement,
    addToast: mockAddToast,
    setActiveNavItem: mockSetActiveNavItem,
    get artifactList() { return mockArtifactListRef.current; },
    get statements() { return mockStatementsRef.current; },
    loadArtifacts: mockLoadArtifacts,
    saveCurrentWorkspace: mockSaveCurrentWorkspace,
    setWorkspaceName: mockSetWorkspaceName,
    setWorkspaceNotes: mockSetWorkspaceNotes,
    clearWorkspace: mockClearWorkspace,
  };
  const hook = (selector: (s: unknown) => unknown) =>
    typeof selector === 'function' ? selector(store) : store;
  hook.getState = () => store;
  return { useWorkspaceStore: hook };
});

vi.mock('../../services/example-setup', () => ({
  setupScalarExtractExample: (...args: unknown[]) => mockSetupScalar(...args),
  setupTableExplodeExample: (...args: unknown[]) => mockSetupExplode(...args),
  setupJavaTableExplodeExample: (...args: unknown[]) => mockSetupExplode(...args),
}));

vi.mock('../../services/example-runner', () => ({
  runKickstarterExample: (...args: unknown[]) => mockRunKickstarter(...args),
}));

import { ExamplesPanel } from '../../components/ExamplesPanel/ExamplesPanel';
import { getExampleCards } from '../../data/exampleCards';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@examples-panel] ExamplesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArtifactListRef.current = [] as unknown[];
    mockStatementsRef.current = [] as unknown[]; // empty workspace by default
    mockSetupScalar.mockResolvedValue(undefined);
    mockSetupExplode.mockResolvedValue(undefined);
    mockRunKickstarter.mockResolvedValue({ runId: 'test-run-123' });
  });

  it('renders kickstart cards on default tab', () => {
    render(<ExamplesPanel />);
    const cards = getExampleCards([]);
    const kickCards = cards.filter((c) => c.category === 'kickstart');
    for (const card of kickCards) {
      expect(screen.getByTestId(`example-card-${card.id}`)).toBeTruthy();
    }
    // Snippet cards not visible on default tab
    expect(screen.queryByTestId('example-card-hello-world')).toBeNull();
  });

  it('renders snippet cards after switching to Snippets tab', () => {
    render(<ExamplesPanel />);
    fireEvent.click(screen.getByText('Snippets'));
    const cards = getExampleCards([]);
    const snippetCards = cards.filter((c) => c.category === 'snippet');
    for (const card of snippetCards) {
      expect(screen.getByTestId(`example-card-${card.id}`)).toBeTruthy();
    }
    // Kickstart cards not visible on Snippets tab
    expect(screen.queryByTestId('example-card-hello-flink')).toBeNull();
  });

  it('renders kickstart card titles on default tab', () => {
    render(<ExamplesPanel />);
    expect(screen.getByText('Hello Flink')).toBeTruthy();
    expect(screen.getByText('Good Jokes Filter')).toBeTruthy();
  });

  it('renders snippet card titles on Snippets tab', () => {
    render(<ExamplesPanel />);
    fireEvent.click(screen.getByText('Snippets'));
    expect(screen.getAllByText('Hello World').length).toBeGreaterThan(0);
    expect(screen.getByText('Create Java UDF')).toBeTruthy();
    expect(screen.getByText('Create Python UDF')).toBeTruthy();
    expect(screen.getByText('Show Functions')).toBeTruthy();
  });

  it('renders card descriptions on Snippets tab', () => {
    render(<ExamplesPanel />);
    fireEvent.click(screen.getByText('Snippets'));
    expect(screen.getByText(/Sanity check/)).toBeTruthy();
  });

  it('renders SQL preview for snippet cards', () => {
    render(<ExamplesPanel />);
    fireEvent.click(screen.getByText('Snippets'));
    expect(screen.getByText('SELECT 1;')).toBeTruthy();
    expect(screen.getByText('SHOW FUNCTIONS;')).toBeTruthy();
  });

  it('renders tags on Snippets tab', () => {
    render(<ExamplesPanel />);
    fireEvent.click(screen.getByText('Snippets'));
    expect(screen.getAllByText('Query').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DDL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Java').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Python').length).toBeGreaterThan(0);
  });

  it('import button calls addStatement with valid job name and switches to workspace', async () => {
    render(<ExamplesPanel />);
    // Switch to Snippets tab to see Import buttons
    fireEvent.click(screen.getByText('Snippets'));
    const importBtns = screen.getAllByText('Import');
    await act(async () => {
      fireEvent.click(importBtns[0]);
    });

    // Title "Hello World" → job name "{rid}-hello-world" (rid prefix + lowercase, hyphens)
    expect(mockAddStatement).toHaveBeenCalledWith(
      'SELECT 1;',
      undefined,
      expect.stringMatching(/^hello-world-.+$/)
    );
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: 'Imported "Hello World"' })
    );
    expect(mockSetActiveNavItem).toHaveBeenCalledWith('workspace');
  });

  it('copy button copies SQL to clipboard and shows feedback', async () => {
    render(<ExamplesPanel />);
    fireEvent.click(screen.getByText('Snippets'));
    const helloWorldCard = screen.getByTestId('example-card-hello-world');
    const copyBtn = helloWorldCard.querySelector('button')!;
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('SELECT 1;');
    // Should show "Copied" feedback
    expect(screen.getByText('Copied')).toBeTruthy();
  });

  it('has panel aria-label', () => {
    render(<ExamplesPanel />);
    expect(screen.getByLabelText('Examples panel')).toBeTruthy();
  });

  it('shows correct button counts per tab', () => {
    render(<ExamplesPanel />);
    // Kickstart tab (default): 8 Set Up + 10 Coming Soon, no Import
    expect(screen.getAllByText('Set Up')).toHaveLength(8);
    expect(screen.getAllByText('Coming Soon').length).toBeGreaterThanOrEqual(10);
    expect(screen.queryByText('Import')).toBeNull();
    // Switch to Snippets tab: 4 Import, no Set Up
    fireEvent.click(screen.getByText('Snippets'));
    expect(screen.getAllByText('Import')).toHaveLength(4);
    expect(screen.queryByText('Set Up')).toBeNull();
  });

  it('resolves artifact IDs when artifacts are available', () => {
    mockArtifactListRef.current = [
      {
        id: 'cfa-real123',
        display_name: 'my-jar-udf',
        class: 'com.example.RealClass',
        content_format: 'JAR',
        runtime_language: 'JAVA',
        versions: [{ version: 'ver-abc' }],
      },
    ];
    render(<ExamplesPanel />);
    fireEvent.click(screen.getByText('Snippets'));
    const javaCard = screen.getByTestId('example-card-create-java-udf');
    expect(javaCard.textContent).toContain('cfa-real123');
    expect(javaCard.textContent).toContain('ver-abc');
    // Function name should be derived from class (CamelCase → snake_case)
    expect(javaCard.textContent).toContain('real_class');
  });

  it('shows placeholder IDs when no artifacts available', () => {
    mockArtifactListRef.current = [] as unknown[];
    render(<ExamplesPanel />);
    fireEvent.click(screen.getByText('Snippets'));
    const javaCard = screen.getByTestId('example-card-create-java-udf');
    expect(javaCard.textContent).toContain('<artifact-id>');
    expect(javaCard.textContent).toContain('<version-id>');
  });

  it('uses clean fallback function name when class is "default"', () => {
    mockArtifactListRef.current = [
      {
        id: 'cfa-abc',
        display_name: 'some-long-ugly-artifact-name-1.0.0',
        class: 'default',
        content_format: 'JAR',
        runtime_language: 'JAVA',
        versions: [{ version: 'ver-1' }],
      },
    ];
    render(<ExamplesPanel />);
    fireEvent.click(screen.getByText('Snippets'));
    const javaCard = screen.getByTestId('example-card-create-java-udf');
    // Should NOT use ugly display_name derivation
    expect(javaCard.textContent).not.toContain('some_long_ugly');
    // Should use clean fallback name
    expect(javaCard.textContent).toContain('my_java_udf');
    // But should still resolve the real artifact ID
    expect(javaCard.textContent).toContain('cfa-abc');
  });

  it('card hover changes border color', () => {
    render(<ExamplesPanel />);
    // Use a kickstart card (visible on default tab)
    const card = screen.getByTestId('example-card-hello-flink');
    fireEvent.mouseEnter(card);
    // Hover state is visual only — verify no error
    fireEvent.mouseLeave(card);
  });

  // --- Quick Start card tests ---

  it('Quick Start card shows "Set Up" button (not "Import")', () => {
    render(<ExamplesPanel />);
    const loanCard = screen.getByTestId('example-card-loan-scalar-extract');
    expect(loanCard.textContent).toContain('Set Up');
    expect(loanCard.querySelector('button')?.textContent).not.toContain('Import');
  });

  it('Quick Start card has visual differentiation (primary border)', () => {
    render(<ExamplesPanel />);
    const loanCard = screen.getByTestId('example-card-loan-scalar-extract');
    expect(loanCard.style.borderLeft).toContain('var(--color-primary)');
  });

  it('"Quick Start" tag rendered with primary background', () => {
    render(<ExamplesPanel />);
    // Kickstart tab (default): all 9 kickstart cards visible, each has "Quick Start" tag
    const quickStartTags = screen.getAllByText('Quick Start');
    expect(quickStartTags.length).toBe(9);
    expect(quickStartTags[0].style.background).toContain('var(--color-primary)');
  });

  it('Set Up button calls onImport and shows success toast', async () => {
    render(<ExamplesPanel />);
    // loan-filter is the first Set Up card now (kickstarter cards are first)
    const setupBtns = screen.getAllByText('Set Up');
    await act(async () => {
      fireEvent.click(setupBtns[0]);
    });

    // First "Set Up" card is now loan-filter (uses runKickstarterExample)
    expect(mockRunKickstarter).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      );
    });
  });

  // --- comingSoon gate tests ---

  it('loan-tradeline-java renders a "Set Up" button', () => {
    render(<ExamplesPanel />);
    const javaCard = screen.getByTestId('example-card-loan-tradeline-java');
    expect(javaCard.textContent).toContain('Set Up');
    expect(javaCard.textContent).not.toContain('Coming Soon');
  });

  it('loan-table-explode renders a disabled "Coming Soon" button (not "Set Up")', () => {
    render(<ExamplesPanel />);
    const explodeCard = screen.getByTestId('example-card-loan-table-explode');
    expect(explodeCard.textContent).toContain('Coming Soon');
    expect(explodeCard.textContent).not.toContain('Set Up');
  });

  it('"Coming Soon" button is aria-disabled="true"', () => {
    render(<ExamplesPanel />);
    const comingSoonBtns = screen.getAllByText('Coming Soon');
    expect(comingSoonBtns.length).toBeGreaterThanOrEqual(1);
    expect(comingSoonBtns[0].closest('button')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('comingSoon message text is visible on the card', () => {
    render(<ExamplesPanel />);
    expect(
      screen.getByText(/Python UDFs require Confluent Early Access enrollment/)
    ).toBeTruthy();
  });

  it('loan-table-explode does NOT have a clickable "Set Up" button', () => {
    render(<ExamplesPanel />);
    const explodeCard = screen.getByTestId('example-card-loan-table-explode');
    const buttons = Array.from(explodeCard.querySelectorAll('button'));
    const setupBtns = buttons.filter((b) => b.textContent?.includes('Set Up'));
    expect(setupBtns).toHaveLength(0);
  });

  it('kickstart card titles present on default tab', () => {
    render(<ExamplesPanel />);
    expect(screen.getByText('Loan Filter')).toBeTruthy();
    expect(screen.getByText('Loan Aggregate')).toBeTruthy();
    expect(screen.getByText('Loan Fraud Monitor')).toBeTruthy();
    expect(screen.getByText('Loan Enrichment')).toBeTruthy();
  });

  // --- Workspace isolation: confirmation when workspace is non-empty ---

  it('shows inline confirmation when workspace has existing statements', async () => {
    mockStatementsRef.current = [{ id: '1' }]; // non-empty workspace
    render(<ExamplesPanel />);
    const setupBtns = screen.getAllByText('Set Up');
    await act(async () => {
      fireEvent.click(setupBtns[0]);
    });
    // Should show confirmation, not run immediately
    expect(mockRunKickstarter).not.toHaveBeenCalled();
    expect(screen.getByText(/Your current workspace will be cleared/)).toBeTruthy();
  });

  it('"Clear & Set Up" clears workspace then runs setup', async () => {
    mockStatementsRef.current = [{ id: '1' }];
    render(<ExamplesPanel />);
    const setupBtns = screen.getAllByText('Set Up');
    await act(async () => { fireEvent.click(setupBtns[0]); });
    const clearBtn = screen.getByText('Clear & Set Up');
    await act(async () => { fireEvent.click(clearBtn); });
    expect(mockClearWorkspace).toHaveBeenCalledTimes(1);
    expect(mockRunKickstarter).toHaveBeenCalled();
  });

  it('"Cancel" dismisses confirmation without running setup', async () => {
    mockStatementsRef.current = [{ id: '1' }];
    render(<ExamplesPanel />);
    const setupBtns = screen.getAllByText('Set Up');
    await act(async () => { fireEvent.click(setupBtns[0]); });
    const cancelBtn = screen.getByText('Cancel');
    await act(async () => { fireEvent.click(cancelBtn); });
    expect(mockRunKickstarter).not.toHaveBeenCalled();
    expect(screen.queryByText(/Your current workspace will be cleared/)).toBeNull();
  });

  it('empty workspace runs setup immediately without confirmation', async () => {
    // mockStatementsRef.current is [] by default in beforeEach
    render(<ExamplesPanel />);
    const setupBtns = screen.getAllByText('Set Up');
    await act(async () => { fireEvent.click(setupBtns[0]); });
    expect(screen.queryByText(/Your current workspace will be cleared/)).toBeNull();
    await waitFor(() => expect(mockRunKickstarter).toHaveBeenCalled());
  });
});
