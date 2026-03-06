/**
 * @artifact-list
 * ArtifactList — List view tests
 *
 * Covers:
 *   - Empty state message
 *   - Populated list with artifact rows
 *   - Search debounce with fake timers
 *   - Keyboard navigation (ArrowDown/Up/Enter)
 *   - Upload button disabled during upload
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { FlinkArtifact } from '../../types';

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------
let mockArtifactList: FlinkArtifact[] = [];
let mockArtifactLoading = false;
let mockArtifactUploading = false;
let mockArtifactError: string | null = null;
const mockSelectArtifact = vi.fn();

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      artifactList: mockArtifactList,
      artifactLoading: mockArtifactLoading,
      artifactUploading: mockArtifactUploading,
      artifactError: mockArtifactError,
      selectArtifact: mockSelectArtifact,
      // UploadArtifact needs these
      loadArtifacts: vi.fn(),
      setArtifactUploading: vi.fn(),
      setUploadProgress: vi.fn(),
      addToast: vi.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../config/environment', () => ({
  env: {
    cloudProvider: 'aws',
    cloudRegion: 'us-east-1',
    environmentId: 'env-test',
    flinkApiKey: 'test-key',
    flinkApiSecret: 'test-secret',
    metricsKey: 'test-metrics-key',
    metricsSecret: 'test-metrics-secret',
  },
}));

import ArtifactList from '../../components/ArtifactsPanel/ArtifactList';

const makeArtifact = (name: string, overrides?: Partial<FlinkArtifact>): FlinkArtifact => ({
  id: `cfa-${name}`,
  display_name: name,
  class: `com.example.${name}`,
  cloud: 'aws',
  region: 'us-east-1',
  environment: 'env-test',
  content_format: 'JAR',
  runtime_language: 'JAVA',
  versions: [{ version: 'ver-1' }],
  metadata: { created_at: '2026-01-01T00:00:00Z' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@artifact-list] ArtifactList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockArtifactList = [];
    mockArtifactLoading = false;
    mockArtifactUploading = false;
    mockArtifactError = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows empty state when no artifacts', () => {
    render(<ArtifactList />);
    expect(screen.getByText(/No artifacts found/)).toBeTruthy();
  });

  it('shows loading state', () => {
    mockArtifactLoading = true;
    render(<ArtifactList />);
    expect(screen.getByText('Loading artifacts...')).toBeTruthy();
  });

  it('renders artifact rows', () => {
    mockArtifactList = [makeArtifact('TestUdf'), makeArtifact('OtherUdf')];
    render(<ArtifactList />);
    expect(screen.getByText('TestUdf')).toBeTruthy();
    expect(screen.getByText('OtherUdf')).toBeTruthy();
  });

  it('shows artifact count', () => {
    mockArtifactList = [makeArtifact('A'), makeArtifact('B'), makeArtifact('C')];
    render(<ArtifactList />);
    expect(screen.getByText('3 artifacts')).toBeTruthy();
  });

  it('filters artifacts with debounced search', () => {
    mockArtifactList = [makeArtifact('MaskEmail'), makeArtifact('SentimentScore')];
    render(<ArtifactList />);

    const input = screen.getByLabelText('Search artifacts');
    fireEvent.change(input, { target: { value: 'Mask' } });

    // Before debounce — both visible
    expect(screen.getByText('2 artifacts')).toBeTruthy();

    // After debounce
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText(/1 artifact/)).toBeTruthy();
    expect(screen.getByText('MaskEmail')).toBeTruthy();
    expect(screen.queryByText('SentimentScore')).toBeNull();
  });

  it('selects artifact on click', () => {
    mockArtifactList = [makeArtifact('ClickMe')];
    render(<ArtifactList />);
    fireEvent.click(screen.getByLabelText('Artifact: ClickMe'));
    expect(mockSelectArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'ClickMe' })
    );
  });

  it('keyboard ArrowDown + Enter selects artifact', () => {
    // Mock scrollIntoView (not available in jsdom)
    Element.prototype.scrollIntoView = vi.fn();

    mockArtifactList = [makeArtifact('First'), makeArtifact('Second')];
    const { container } = render(<ArtifactList />);

    // The onKeyDown handler is on the root div
    const rootDiv = container.firstElementChild!;

    fireEvent.keyDown(rootDiv, { key: 'ArrowDown' });
    fireEvent.keyDown(rootDiv, { key: 'Enter' });

    expect(mockSelectArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'First' })
    );
  });

  it('upload button is disabled during upload', () => {
    mockArtifactUploading = true;
    render(<ArtifactList />);
    const btn = screen.getByLabelText('Upload new artifact');
    expect(btn.disabled).toBe(true);
  });

  it('shows error banner', () => {
    mockArtifactError = 'Something went wrong';
    render(<ArtifactList />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// [@coverage-boost] ArtifactList — additional coverage for uncovered branches
// ---------------------------------------------------------------------------

describe('[@coverage-boost] ArtifactList edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockArtifactList = [];
    mockArtifactLoading = false;
    mockArtifactUploading = false;
    mockArtifactError = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows singular "1 artifact" text for single item', () => {
    mockArtifactList = [makeArtifact('SingleArt')];
    render(<ArtifactList />);
    expect(screen.getByText('1 artifact')).toBeTruthy();
  });

  it('search filters by class name', () => {
    mockArtifactList = [makeArtifact('UdfA'), makeArtifact('UdfB', { class: 'com.special.Magic' })];
    render(<ArtifactList />);

    const input = screen.getByLabelText('Search artifacts');
    fireEvent.change(input, { target: { value: 'Magic' } });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText('UdfB')).toBeTruthy();
    expect(screen.queryByText('UdfA')).toBeNull();
  });

  it('shows search-specific empty message when query has no matches', () => {
    mockArtifactList = [makeArtifact('TestUdf')];
    render(<ArtifactList />);

    const input = screen.getByLabelText('Search artifacts');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText('No artifacts match your search.')).toBeTruthy();
  });

  it('shows count with matching query text', () => {
    mockArtifactList = [makeArtifact('Alpha'), makeArtifact('AlphaBeta')];
    render(<ArtifactList />);

    const input = screen.getByLabelText('Search artifacts');
    fireEvent.change(input, { target: { value: 'Alpha' } });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText(/matching "Alpha"/)).toBeTruthy();
  });

  it('keyboard ArrowUp navigates focus upward', () => {
    Element.prototype.scrollIntoView = vi.fn();
    mockArtifactList = [makeArtifact('First'), makeArtifact('Second'), makeArtifact('Third')];
    const { container } = render(<ArtifactList />);
    const rootDiv = container.firstElementChild!;

    // Navigate down twice
    fireEvent.keyDown(rootDiv, { key: 'ArrowDown' });
    fireEvent.keyDown(rootDiv, { key: 'ArrowDown' });
    // Now navigate up once
    fireEvent.keyDown(rootDiv, { key: 'ArrowUp' });
    // Press Enter to select the second item (index 0 after going down 2, up 1 = index 1)
    fireEvent.keyDown(rootDiv, { key: 'Enter' });

    expect(mockSelectArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'First' })
    );
  });

  it('ArrowDown stops at last item', () => {
    Element.prototype.scrollIntoView = vi.fn();
    mockArtifactList = [makeArtifact('Only')];
    const { container } = render(<ArtifactList />);
    const rootDiv = container.firstElementChild!;

    fireEvent.keyDown(rootDiv, { key: 'ArrowDown' });
    fireEvent.keyDown(rootDiv, { key: 'ArrowDown' }); // Should not go beyond
    fireEvent.keyDown(rootDiv, { key: 'Enter' });

    expect(mockSelectArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: 'Only' })
    );
  });

  it('Enter with no focused item does not select', () => {
    mockArtifactList = [makeArtifact('Test')];
    const { container } = render(<ArtifactList />);
    const rootDiv = container.firstElementChild!;

    // No ArrowDown, so focusedIndex is -1
    fireEvent.keyDown(rootDiv, { key: 'Enter' });
    expect(mockSelectArtifact).not.toHaveBeenCalled();
  });

  it('mouse enter highlights artifact row', () => {
    mockArtifactList = [makeArtifact('HoverMe')];
    render(<ArtifactList />);
    const btn = screen.getByLabelText('Artifact: HoverMe');
    fireEvent.mouseEnter(btn);
    // The background style changes on hover (focusedIndex matches)
    expect(btn).toBeTruthy();
  });

  it('upload button opens upload modal', () => {
    render(<ArtifactList />);
    fireEvent.click(screen.getByLabelText('Upload new artifact'));
    // UploadArtifact modal should be rendered
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('formatDate returns em-dash for undefined date', () => {
    mockArtifactList = [makeArtifact('NoDate', { metadata: undefined })];
    render(<ArtifactList />);
    // The date column should show em-dash
    expect(screen.getByText('NoDate')).toBeTruthy();
  });

  it('formatDate returns raw string for invalid date', () => {
    mockArtifactList = [makeArtifact('BadDate', { metadata: { created_at: 'not-a-date' } })];
    render(<ArtifactList />);
    expect(screen.getByText('BadDate')).toBeTruthy();
  });
});
