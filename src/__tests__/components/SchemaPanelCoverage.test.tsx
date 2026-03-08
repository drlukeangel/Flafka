/**
 * @schema-panel-coverage
 * Additional coverage tests for SchemaPanel.tsx
 *
 * Targets uncovered branches:
 *   - Resize handle (handleResizeStart, onMouseMove, onMouseUp)
 *   - Resize handle hover (onMouseEnter/onMouseLeave)
 *   - "Not configured" state when env vars are missing
 *   - Refresh button hover (onMouseEnter/onMouseLeave)
 *   - Back button hover (onMouseEnter/onMouseLeave)
 *   - clearSchemaRegistryError on unmount
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { SchemaSubject } from '../../types';

// ---------------------------------------------------------------------------
// Store mock
// ---------------------------------------------------------------------------

let mockSelectedSchemaSubject: SchemaSubject | null = null;
let mockSchemaRegistryLoading = false;

const mockLoadSchemaRegistrySubjects = vi.fn();
const mockClearSelectedSchema = vi.fn();
const mockClearSchemaRegistryError = vi.fn();

vi.mock('../../store/workspaceStore', () => {
  const fn = vi.fn();
  (fn as unknown as { getState: () => unknown }).getState = vi.fn();
  return { useWorkspaceStore: fn };
});

// Will be set per-test via envConfigured flag
let envConfigured = true;

vi.mock('../../config/environment', () => ({
  env: {
    get schemaRegistryUrl() { return envConfigured ? 'https://test.example.com' : ''; },
    get schemaRegistryKey() { return envConfigured ? 'test-key' : ''; },
    schemaRegistrySecret: 'test-secret',
    orgId: '', environmentId: '', computePoolId: '',
    flinkApiKey: '', flinkApiSecret: '',
    metricsKey: '', metricsSecret: '',
    flinkCatalog: 'default', flinkDatabase: 'public',
    cloudProvider: 'aws', cloudRegion: 'us-east-1',
    kafkaClusterId: '', kafkaRestEndpoint: '',
    kafkaApiKey: '', kafkaApiSecret: '',
    uniqueId: 'test',
  },
}));

vi.mock('../../api/schema-registry-api', () => ({
  getSchemaVersions: vi.fn().mockResolvedValue([]),
  getCompatibilityMode: vi.fn().mockResolvedValue(null),
  getCompatibilityModeWithSource: vi.fn().mockResolvedValue({ level: 'BACKWARD', isGlobal: false }),
  validateCompatibility: vi.fn(),
  registerSchema: vi.fn(),
  deleteSubject: vi.fn(),
  deleteSchemaVersion: vi.fn(),
  setCompatibilityMode: vi.fn(),
  getSubjectsForSchemaId: vi.fn().mockResolvedValue([]),
}));

import SchemaPanel from '../../components/SchemaPanel/SchemaPanel';
import * as workspaceStoreModule from '../../store/workspaceStore';

function buildMockState() {
  return {
    selectedSchemaSubject: mockSelectedSchemaSubject,
    schemaRegistryLoading: mockSchemaRegistryLoading,
    schemaRegistryError: null,
    schemaRegistrySubjects: [],
    schemaTypeCache: {},
    schemaCompatCache: {},
    loadSchemaRegistrySubjects: mockLoadSchemaRegistrySubjects,
    clearSelectedSchema: mockClearSelectedSchema,
    clearSchemaRegistryError: mockClearSchemaRegistryError,
    loadSchemaDetail: vi.fn(),
    addToast: vi.fn(),
    navigateToTopic: vi.fn(),
    topicList: [],
    loadTopics: vi.fn(),
    schemaInitialView: null,
    clearSchemaInitialView: vi.fn(),
    schemaDatasets: [],
    deleteSchemaDataset: vi.fn(),
  };
}

function setupStoreMock() {
  const mockedStore = vi.mocked(workspaceStoreModule.useWorkspaceStore) as unknown as {
    (selector?: unknown): unknown;
    getState: () => unknown;
    mockImplementation: (fn: (s: unknown) => unknown) => void;
  };
  mockedStore.mockImplementation((selector: unknown) => {
    const state = buildMockState();
    return typeof selector === 'function' ? (selector as (s: unknown) => unknown)(state) : state;
  });
  const getStateMock = mockedStore.getState as unknown as { mockImplementation: (fn: () => unknown) => void };
  getStateMock.mockImplementation(() => buildMockState());
}

function makeSchemaSubject(overrides: Partial<SchemaSubject> = {}): SchemaSubject {
  return {
    subject: 'orders-value',
    version: 1,
    id: 42,
    schemaType: 'AVRO',
    schema: '{"type":"record","name":"Test","fields":[{"name":"id","type":"string"}]}',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@schema-panel-coverage] SchemaPanel — not configured state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSelectedSchemaSubject = null;
    mockSchemaRegistryLoading = false;
    envConfigured = false;
  });

  afterEach(() => {
    envConfigured = true;
  });

  it('shows "Schema Registry not configured" when env vars are missing', () => {
    render(<SchemaPanel />);
    expect(screen.getByText('Schema Registry not configured')).toBeInTheDocument();
  });

  it('shows the .env file hint when not configured', () => {
    render(<SchemaPanel />);
    expect(screen.getByText(/VITE_SCHEMA_REGISTRY_URL/)).toBeInTheDocument();
    expect(screen.getByText(/VITE_SCHEMA_REGISTRY_KEY/)).toBeInTheDocument();
    expect(screen.getByText(/VITE_SCHEMA_REGISTRY_SECRET/)).toBeInTheDocument();
  });

  it('renders an alert role for the not-configured state', () => {
    render(<SchemaPanel />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does NOT call loadSchemaRegistrySubjects when not configured', () => {
    render(<SchemaPanel />);
    expect(mockLoadSchemaRegistrySubjects).not.toHaveBeenCalled();
  });
});

describe('[@schema-panel-coverage] SchemaPanel — resize handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSelectedSchemaSubject = null;
    mockSchemaRegistryLoading = false;
    envConfigured = true;
  });

  it('resize handle has col-resize cursor and title', () => {
    render(<SchemaPanel />);
    const resizeHandle = screen.getByLabelText('Resize schema panel');
    expect(resizeHandle).toBeInTheDocument();
    expect(resizeHandle).toHaveAttribute('title', 'Drag to resize panel');
  });

  it('mouseDown on resize handle sets body cursor and attaches listeners', () => {
    render(<SchemaPanel />);
    const resizeHandle = screen.getByLabelText('Resize schema panel');

    fireEvent.mouseDown(resizeHandle, { clientX: 500 });

    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');
  });

  it('mousemove after mouseDown updates --schema-panel-width CSS var', () => {
    render(<SchemaPanel />);
    const resizeHandle = screen.getByLabelText('Resize schema panel');

    fireEvent.mouseDown(resizeHandle, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 450 });

    const width = document.documentElement.style.getPropertyValue('--schema-panel-width');
    // Width should be set (non-empty)
    expect(width).toBeTruthy();
  });

  it('mouseup after mouseDown clears body cursor and userSelect', () => {
    render(<SchemaPanel />);
    const resizeHandle = screen.getByLabelText('Resize schema panel');

    fireEvent.mouseDown(resizeHandle, { clientX: 500 });
    expect(document.body.style.cursor).toBe('col-resize');

    fireEvent.mouseUp(document);

    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
  });

  it('resize width is clamped to MIN (260px) and MAX (800px)', () => {
    render(<SchemaPanel />);
    const resizeHandle = screen.getByLabelText('Resize schema panel');

    // Drag left a huge amount (should clamp to 800)
    fireEvent.mouseDown(resizeHandle, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: -500 });

    const width = parseInt(document.documentElement.style.getPropertyValue('--schema-panel-width'), 10);
    expect(width).toBeLessThanOrEqual(800);

    fireEvent.mouseUp(document);

    // Drag right a huge amount (should clamp to 260)
    fireEvent.mouseDown(resizeHandle, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 2000 });

    const width2 = parseInt(document.documentElement.style.getPropertyValue('--schema-panel-width'), 10);
    expect(width2).toBeGreaterThanOrEqual(260);

    fireEvent.mouseUp(document);
  });

  it('resize handle hover changes background to primary color', () => {
    render(<SchemaPanel />);
    const resizeHandle = screen.getByLabelText('Resize schema panel');

    fireEvent.mouseEnter(resizeHandle);
    expect(resizeHandle.style.background).toBe('var(--color-primary)');

    fireEvent.mouseLeave(resizeHandle);
    expect(resizeHandle.style.background).toBe('transparent');
  });
});

describe('[@schema-panel-coverage] SchemaPanel — button hover styles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSchemaRegistryLoading = false;
    envConfigured = true;
  });

  it('back button hover changes color to primary', () => {
    mockSelectedSchemaSubject = makeSchemaSubject();
    render(<SchemaPanel />);

    const backBtn = screen.getByRole('button', { name: /back to schema list/i });
    fireEvent.mouseEnter(backBtn);
    expect(backBtn.style.color).toBe('var(--color-text-primary)');

    fireEvent.mouseLeave(backBtn);
    expect(backBtn.style.color).toBe('var(--color-text-secondary)');
  });

  it('refresh button hover changes color to primary when not loading', () => {
    mockSelectedSchemaSubject = null;
    render(<SchemaPanel />);

    const refreshBtn = screen.getByRole('button', { name: /refresh schema list/i });
    fireEvent.mouseEnter(refreshBtn);
    expect(refreshBtn.style.color).toBe('var(--color-text-primary)');

    fireEvent.mouseLeave(refreshBtn);
    expect(refreshBtn.style.color).toBe('var(--color-text-secondary)');
  });

  it('refresh button hover does NOT change color when loading', () => {
    mockSchemaRegistryLoading = true;
    render(<SchemaPanel />);

    const refreshBtn = screen.getByRole('button', { name: /refresh schema list/i });
    // Record the initial color
    const initialColor = refreshBtn.style.color;
    fireEvent.mouseEnter(refreshBtn);
    // Should NOT have changed to primary
    expect(refreshBtn.style.color).toBe(initialColor);
  });
});

describe('[@schema-panel-coverage] SchemaPanel — cleanup on unmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
    mockSelectedSchemaSubject = null;
    mockSchemaRegistryLoading = false;
    envConfigured = true;
  });

  it('calls clearSchemaRegistryError on unmount', () => {
    const { unmount } = render(<SchemaPanel />);
    expect(mockClearSchemaRegistryError).not.toHaveBeenCalled();

    unmount();

    expect(mockClearSchemaRegistryError).toHaveBeenCalledTimes(1);
  });
});
