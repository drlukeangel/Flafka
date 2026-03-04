/**
 * @artifacts-panel
 * ArtifactsPanel — Root container tests
 *
 * Covers:
 *   - Env guard: shows warning when flinkApiKey is missing
 *   - List/detail toggle based on selectedArtifact
 *   - Loading state display
 *   - Refresh button triggers loadArtifacts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { FlinkArtifact } from '../../types';

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------
let mockSelectedArtifact: FlinkArtifact | null = null;
let mockArtifactLoading = false;
let mockFlinkApiKey = 'key';
let mockFlinkApiSecret = 'secret';
let mockMetricsKey = 'metrics-key';
let mockMetricsSecret = 'metrics-secret';
const mockLoadArtifacts = vi.fn();
const mockClearSelectedArtifact = vi.fn();
const mockSetArtifactError = vi.fn();

vi.mock('../../config/environment', () => ({
  env: new Proxy({}, {
    get(_target, prop) {
      if (prop === 'flinkApiKey') return mockFlinkApiKey;
      if (prop === 'flinkApiSecret') return mockFlinkApiSecret;
      if (prop === 'metricsKey') return mockMetricsKey;
      if (prop === 'metricsSecret') return mockMetricsSecret;
      if (prop === 'cloudProvider') return 'aws';
      if (prop === 'cloudRegion') return 'us-east-1';
      if (prop === 'environmentId') return 'env-test';
      return '';
    },
  }),
}));

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      selectedArtifact: mockSelectedArtifact,
      artifactLoading: mockArtifactLoading,
      artifactUploading: false,
      artifactError: null,
      artifactList: [],
      loadArtifacts: mockLoadArtifacts,
      clearSelectedArtifact: mockClearSelectedArtifact,
      setArtifactError: mockSetArtifactError,
      selectArtifact: vi.fn(),
      deleteArtifact: vi.fn(),
      addToast: vi.fn(),
      setArtifactUploading: vi.fn(),
      setUploadProgress: vi.fn(),
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../components/EditorCell/editorRegistry', () => ({
  insertTextAtCursor: vi.fn().mockReturnValue(true),
}));

// Must import after mocks
import ArtifactsPanel from '../../components/ArtifactsPanel/ArtifactsPanel';

const makeArtifact = (overrides?: Partial<FlinkArtifact>): FlinkArtifact => ({
  id: 'cfa-abc123',
  display_name: 'test-artifact',
  class: 'com.example.TestUdf',
  cloud: 'aws',
  region: 'us-east-1',
  environment: 'env-test',
  content_format: 'JAR',
  runtime_language: 'JAVA',
  versions: [{ version: 'ver-1' }],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@artifacts-panel] ArtifactsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedArtifact = null;
    mockArtifactLoading = false;
    mockFlinkApiKey = 'key';
    mockFlinkApiSecret = 'secret';
    mockMetricsKey = 'metrics-key';
    mockMetricsSecret = 'metrics-secret';
  });

  it('shows config warning when Cloud API key is not set', () => {
    mockMetricsKey = '';
    mockMetricsSecret = '';
    render(<ArtifactsPanel />);
    expect(screen.getByText('Cloud API keys not configured')).toBeTruthy();
  });

  it('calls loadArtifacts on mount when configured', () => {
    render(<ArtifactsPanel />);
    expect(mockLoadArtifacts).toHaveBeenCalledTimes(1);
  });

  it('shows "Artifacts" header when no artifact selected', () => {
    render(<ArtifactsPanel />);
    expect(screen.getByText('Artifacts')).toBeTruthy();
  });

  it('shows artifact name in header when one is selected', () => {
    mockSelectedArtifact = makeArtifact({ display_name: 'MyUdf' });
    render(<ArtifactsPanel />);
    // Name appears in header + metadata, so use getAllByText
    const elements = screen.getAllByText('MyUdf');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows back button when artifact is selected', () => {
    mockSelectedArtifact = makeArtifact();
    render(<ArtifactsPanel />);
    expect(screen.getByLabelText('Back to artifact list')).toBeTruthy();
  });

  it('calls clearSelectedArtifact when back button clicked', () => {
    mockSelectedArtifact = makeArtifact();
    render(<ArtifactsPanel />);
    fireEvent.click(screen.getByLabelText('Back to artifact list'));
    expect(mockClearSelectedArtifact).toHaveBeenCalled();
  });

  it('shows refresh button when configured and no artifact selected', () => {
    render(<ArtifactsPanel />);
    expect(screen.getByLabelText('Refresh artifacts')).toBeTruthy();
  });

  it('calls loadArtifacts when refresh clicked', () => {
    render(<ArtifactsPanel />);
    mockLoadArtifacts.mockClear();
    fireEvent.click(screen.getByLabelText('Refresh artifacts'));
    expect(mockLoadArtifacts).toHaveBeenCalledTimes(1);
  });
});
