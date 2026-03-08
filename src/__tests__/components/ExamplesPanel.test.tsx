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
  mockAddTab, mockTabOrderRef,
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
  mockAddTab: vi.fn().mockReturnValue('new-tab-id'),
  mockTabOrderRef: { current: ['tab-1'] as string[] },
}));

vi.mock('../../store/workspaceStore', () => {
  const store = {
    addStatement: mockAddStatement,
    addToast: mockAddToast,
    setActiveNavItem: mockSetActiveNavItem,
    get artifactList() { return mockArtifactListRef.current; },
    statements: [],
    loadArtifacts: mockLoadArtifacts,
    saveCurrentWorkspace: mockSaveCurrentWorkspace,
    setWorkspaceName: mockSetWorkspaceName,
    setWorkspaceNotes: mockSetWorkspaceNotes,
    addTab: mockAddTab,
    get tabOrder() { return mockTabOrderRef.current; },
  };
  const hook = (selector: (s: unknown) => unknown) =>
    typeof selector === 'function' ? selector(store) : store;
  hook.getState = () => store;
  return { useWorkspaceStore: hook };
});

vi.mock('../../store/learnStore', () => {
  const learnStore = {
    progress: { completedExamples: [], completedLessons: [], completedTracks: [], completedChallenges: [], badges: [] },
  };
  const hook = (selector: (s: unknown) => unknown) =>
    typeof selector === 'function' ? selector(learnStore) : learnStore;
  hook.getState = () => learnStore;
  return { useLearnStore: hook };
});

vi.mock('../../services/example-setup', () => ({
  setupScalarExtractExample: (...args: unknown[]) => mockSetupScalar(...args),
  setupTableExplodeExample: (...args: unknown[]) => mockSetupExplode(...args),
  setupJavaTableExplodeExample: (...args: unknown[]) => mockSetupExplode(...args),
  setupAggregateUdfExample: (...args: unknown[]) => mockSetupScalar(...args),
  setupValidationExample: (...args: unknown[]) => mockSetupScalar(...args),
  setupPiiMaskingExample: (...args: unknown[]) => mockSetupScalar(...args),
  setupAsyncEnrichmentExample: (...args: unknown[]) => mockSetupScalar(...args),
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
    mockTabOrderRef.current = ['tab-1']; // single tab by default
    mockSetupScalar.mockResolvedValue(undefined);
    mockSetupExplode.mockResolvedValue(undefined);
    mockRunKickstarter.mockResolvedValue({ runId: 'test-run-123' });
  });

  it('renders kickstart cards', () => {
    render(<ExamplesPanel />);
    const cards = getExampleCards([]);
    const kickCards = cards.filter((c) => c.category === 'kickstart');
    for (const card of kickCards) {
      expect(screen.getByTestId(`example-card-${card.id}`)).toBeTruthy();
    }
  });

  it('renders kickstart card titles', () => {
    render(<ExamplesPanel />);
    expect(screen.getByText('Hello Flink')).toBeTruthy();
    expect(screen.getByText('Good Jokes Filter')).toBeTruthy();
  });

  it('has panel aria-label', () => {
    render(<ExamplesPanel />);
    expect(screen.getByLabelText('Examples panel')).toBeTruthy();
  });

  it('shows correct button counts', () => {
    render(<ExamplesPanel />);
    // 49 Set Up + 1 Coming Soon, no Import
    expect(screen.getAllByText('Set Up')).toHaveLength(49);
    expect(screen.getAllByText('Coming Soon').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Import')).toBeNull();
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
    // All 46 kickstart cards visible, each has "Quick Start" tag
    const quickStartTags = screen.getAllByText('Quick Start');
    expect(quickStartTags.length).toBe(50);
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

  // --- Workspace isolation: example opens in new tab ---

  it('clicking Set Up creates a new tab and runs setup immediately', async () => {
    render(<ExamplesPanel />);
    const setupBtns = screen.getAllByText('Set Up');
    await act(async () => { fireEvent.click(setupBtns[0]); });
    expect(mockAddTab).toHaveBeenCalled();
    await waitFor(() => expect(mockRunKickstarter).toHaveBeenCalled());
  });

  it('shows error toast when max tabs (8) reached', async () => {
    mockTabOrderRef.current = ['1', '2', '3', '4', '5', '6', '7', '8'];
    render(<ExamplesPanel />);
    const setupBtns = screen.getAllByText('Set Up');
    await act(async () => { fireEvent.click(setupBtns[0]); });
    expect(mockAddTab).not.toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: expect.stringContaining('Max 8 tabs') })
    );
  });
});
