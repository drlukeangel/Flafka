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
    cloudApiKey: 'test-key',
    cloudApiSecret: 'test-secret',
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
