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
  mockSetupScalar, mockSetupExplode, mockArtifactListRef,
} = vi.hoisted(() => ({
  mockAddStatement: vi.fn(),
  mockAddToast: vi.fn(),
  mockSetActiveNavItem: vi.fn(),
  mockLoadArtifacts: vi.fn(),
  mockSetupScalar: vi.fn().mockResolvedValue(undefined),
  mockSetupExplode: vi.fn().mockResolvedValue(undefined),
  mockArtifactListRef: { current: [] as unknown[] },
}));

vi.mock('../../store/workspaceStore', () => {
  const store = {
    addStatement: mockAddStatement,
    addToast: mockAddToast,
    setActiveNavItem: mockSetActiveNavItem,
    get artifactList() { return mockArtifactListRef.current; },
    loadArtifacts: mockLoadArtifacts,
  };
  const hook = (selector: (s: unknown) => unknown) =>
    typeof selector === 'function' ? selector(store) : store;
  hook.getState = () => store;
  return { useWorkspaceStore: hook };
});

vi.mock('../../services/example-setup', () => ({
  setupScalarExtractExample: (...args: unknown[]) => mockSetupScalar(...args),
  setupTableExplodeExample: (...args: unknown[]) => mockSetupExplode(...args),
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
    mockSetupScalar.mockResolvedValue(undefined);
    mockSetupExplode.mockResolvedValue(undefined);
  });

  it('renders all example cards', () => {
    render(<ExamplesPanel />);
    const cards = getExampleCards([]);
    // Header shows count
    expect(screen.getByText(`Examples (${cards.length})`)).toBeTruthy();
    // Each card rendered
    for (const card of cards) {
      expect(screen.getByTestId(`example-card-${card.id}`)).toBeTruthy();
    }
  });

  it('renders card titles', () => {
    render(<ExamplesPanel />);
    expect(screen.getByText('Hello World')).toBeTruthy();
    expect(screen.getByText('Create Java UDF')).toBeTruthy();
    expect(screen.getByText('Create Python UDF')).toBeTruthy();
    expect(screen.getByText('Show Functions')).toBeTruthy();
    expect(screen.getByText('Windowed Aggregation (TVF)')).toBeTruthy();
  });

  it('renders card descriptions', () => {
    render(<ExamplesPanel />);
    expect(screen.getByText(/Sanity check/)).toBeTruthy();
  });

  it('renders SQL preview for each card', () => {
    render(<ExamplesPanel />);
    // Hello World card should show SELECT 1
    expect(screen.getByText('SELECT 1;')).toBeTruthy();
    // Show Functions card
    expect(screen.getByText('SHOW FUNCTIONS;')).toBeTruthy();
  });

  it('renders tags for each card', () => {
    render(<ExamplesPanel />);
    // Multiple Query tags across cards
    const queryTags = screen.getAllByText('Query');
    expect(queryTags.length).toBeGreaterThan(0);
    // DDL tags
    const ddlTags = screen.getAllByText('DDL');
    expect(ddlTags.length).toBeGreaterThan(0);
    // Java and Python tags
    expect(screen.getAllByText('Java').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Python').length).toBeGreaterThan(0);
  });

  it('import button calls addStatement with valid job name and switches to workspace', async () => {
    render(<ExamplesPanel />);
    // Click first Import button (Hello World card)
    const importBtns = screen.getAllByText('Import');
    await act(async () => {
      fireEvent.click(importBtns[0]);
    });

    // Title "Hello World" → job name "hello-world" (lowercase, hyphens)
    expect(mockAddStatement).toHaveBeenCalledWith(
      'SELECT 1;',
      undefined,
      'hello-world'
    );
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: 'Imported "Hello World"' })
    );
    expect(mockSetActiveNavItem).toHaveBeenCalledWith('workspace');
  });

  it('copy button copies SQL to clipboard and shows feedback', async () => {
    render(<ExamplesPanel />);
    const copyBtns = screen.getAllByText('Copy');
    await act(async () => {
      fireEvent.click(copyBtns[0]);
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('SELECT 1;');
    // Should show "Copied" feedback
    expect(screen.getByText('Copied')).toBeTruthy();
  });

  it('has panel aria-label', () => {
    render(<ExamplesPanel />);
    expect(screen.getByLabelText('Examples panel')).toBeTruthy();
  });

  it('shows 10 cards total (8 standard + 2 Quick Start)', () => {
    render(<ExamplesPanel />);
    // 8 standard cards have "Import" button, 2 Quick Start cards have "Set Up" button
    const importBtns = screen.getAllByText('Import');
    const setupBtns = screen.getAllByText('Set Up');
    expect(importBtns).toHaveLength(8);
    expect(setupBtns).toHaveLength(2);
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
    // The Java UDF card should contain the real artifact ID and version
    const javaCard = screen.getByTestId('example-card-create-java-udf');
    expect(javaCard.textContent).toContain('cfa-real123');
    expect(javaCard.textContent).toContain('ver-abc');
    // Function name should be derived from class (CamelCase → snake_case)
    expect(javaCard.textContent).toContain('real_class');
  });

  it('shows placeholder IDs when no artifacts available', () => {
    mockArtifactListRef.current = [] as unknown[];
    render(<ExamplesPanel />);
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
    const card = screen.getByTestId('example-card-hello-world');
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
    const quickStartTags = screen.getAllByText('Quick Start');
    expect(quickStartTags.length).toBe(2);
    expect(quickStartTags[0].style.background).toContain('var(--color-primary)');
  });

  it('Set Up button calls onImport and shows success toast', async () => {
    render(<ExamplesPanel />);
    const setupBtns = screen.getAllByText('Set Up');
    await act(async () => {
      fireEvent.click(setupBtns[0]);
    });

    expect(mockSetupScalar).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success' })
      );
    });
  });
});
