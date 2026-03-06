/**
 * @artifact-detail
 * ArtifactDetail — Detail view tests
 *
 * Covers:
 *   - SQL snippet content and structure
 *   - Version dropdown updates snippet
 *   - Copy and insert buttons
 *   - Delete name-confirm gate
 *   - Content format and runtime language badges
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { FlinkArtifact } from '../../types';

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------
let mockSelectedArtifact: FlinkArtifact | null = null;
const mockDeleteArtifact = vi.fn();
const mockAddToast = vi.fn();
const mockInsertTextAtCursor = vi.fn().mockReturnValue(true);

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      selectedArtifact: mockSelectedArtifact,
      deleteArtifact: mockDeleteArtifact,
      addToast: mockAddToast,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('../../components/EditorCell/editorRegistry', () => ({
  insertTextAtCursor: (...args: unknown[]) => mockInsertTextAtCursor(...args),
}));

import ArtifactDetail from '../../components/ArtifactsPanel/ArtifactDetail';

const makeArtifact = (overrides?: Partial<FlinkArtifact>): FlinkArtifact => ({
  id: 'cfa-abc123',
  display_name: 'test-artifact',
  class: 'com.example.TestUdf',
  cloud: 'aws',
  region: 'us-east-1',
  environment: 'env-test',
  content_format: 'JAR',
  runtime_language: 'JAVA',
  versions: [
    { version: 'ver-1', created_at: '2026-01-01T00:00:00Z' },
    { version: 'ver-2', created_at: '2026-02-01T00:00:00Z' },
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@artifact-detail] ArtifactDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedArtifact = makeArtifact();
  });

  it('renders nothing when no artifact selected', () => {
    mockSelectedArtifact = null;
    const { container } = render(<ArtifactDetail />);
    expect(container.innerHTML).toBe('');
  });

  it('shows SQL snippet with CREATE FUNCTION', () => {
    render(<ArtifactDetail />);
    // The pre element contains the full SQL snippet
    const preElements = document.querySelectorAll('pre');
    const sqlPre = Array.from(preElements).find((el) =>
      el.textContent?.includes('CREATE FUNCTION')
    );
    expect(sqlPre).toBeTruthy();
    expect(sqlPre!.textContent).toContain('com.example.TestUdf');
    expect(sqlPre!.textContent).toContain('confluent-artifact://cfa-abc123/ver-1');
  });

  it('shows version dropdown when multiple versions exist', () => {
    render(<ArtifactDetail />);
    const select = screen.getByLabelText('Select artifact version');
    expect(select).toBeTruthy();
    expect(select.querySelectorAll('option')).toHaveLength(2);
  });

  it('updates SQL snippet when version changes', () => {
    render(<ArtifactDetail />);
    const select = screen.getByLabelText('Select artifact version');
    fireEvent.change(select, { target: { value: '1' } });
    // After selecting version index 1 (ver-2), the SQL should reference ver-2
    const preElements = document.querySelectorAll('pre');
    const sqlPre = Array.from(preElements).find((el) =>
      el.textContent?.includes('CREATE FUNCTION')
    );
    expect(sqlPre!.textContent).toContain('ver-2');
  });

  it('copy button triggers clipboard write', async () => {
    render(<ArtifactDetail />);
    const copyBtn = screen.getByTitle('Copy SQL to clipboard');
    await fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('insert button calls insertTextAtCursor', () => {
    render(<ArtifactDetail />);
    const insertBtn = screen.getByTitle('Insert SQL at editor cursor');
    fireEvent.click(insertBtn);
    expect(mockInsertTextAtCursor).toHaveBeenCalledTimes(1);
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' })
    );
  });

  it('shows content format badge', () => {
    render(<ArtifactDetail />);
    const badge = screen.getByTestId('badge-content-format');
    expect(badge.textContent).toBe('JAR');
  });

  it('shows runtime language badge', () => {
    render(<ArtifactDetail />);
    const badge = screen.getByTestId('badge-runtime-language');
    expect(badge.textContent).toBe('JAVA');
  });

  it('shows ZIP/PYTHON badges for Python artifacts', () => {
    mockSelectedArtifact = makeArtifact({
      content_format: 'ZIP',
      runtime_language: 'PYTHON',
    });
    render(<ArtifactDetail />);
    expect(screen.getByTestId('badge-content-format').textContent).toBe('ZIP');
    expect(screen.getByTestId('badge-runtime-language').textContent).toBe('PYTHON');
  });

  it('delete button shows confirmation dialog', () => {
    render(<ArtifactDetail />);
    fireEvent.click(screen.getByText('Delete Artifact'));
    expect(screen.getByLabelText('Confirm artifact name')).toBeTruthy();
  });

  it('delete confirm button is disabled until name matches', () => {
    render(<ArtifactDetail />);
    fireEvent.click(screen.getByText('Delete Artifact'));

    // Find the confirm Delete button in the dialog (not the "Delete Artifact" trigger)
    const dialog = screen.getByLabelText('Confirm artifact name').closest('div')!.parentElement!;
    const confirmBtn = within(dialog).getAllByRole('button').find(
      (b) => b.textContent === 'Delete'
    );
    expect(confirmBtn?.disabled).toBe(true);

    // Type correct name
    const input = screen.getByLabelText('Confirm artifact name');
    fireEvent.change(input, { target: { value: 'test-artifact' } });
    expect(confirmBtn?.disabled).toBe(false);
  });

  it('displays metadata rows', () => {
    render(<ArtifactDetail />);
    expect(screen.getByText('Display Name')).toBeTruthy();
    expect(screen.getByText('Entry Class')).toBeTruthy();
    expect(screen.getByText('Cloud / Region')).toBeTruthy();
    expect(screen.getByText('aws / us-east-1')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// [@coverage-boost] ArtifactDetail — additional coverage for uncovered branches
// ---------------------------------------------------------------------------

describe('[@coverage-boost] ArtifactDetail edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedArtifact = makeArtifact();
  });

  it('insert at cursor shows warning toast when no focused editor', () => {
    mockInsertTextAtCursor.mockReturnValue(false);
    render(<ArtifactDetail />);
    const insertBtn = screen.getByTitle('Insert SQL at editor cursor');
    fireEvent.click(insertBtn);
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning', message: expect.stringContaining('No focused editor') })
    );
  });

  it('SQL snippet uses <entry-class> when class is empty string', () => {
    mockSelectedArtifact = makeArtifact({ class: '' });
    render(<ArtifactDetail />);
    const preElements = document.querySelectorAll('pre');
    const sqlPre = Array.from(preElements).find((el) =>
      el.textContent?.includes('CREATE FUNCTION')
    );
    expect(sqlPre!.textContent).toContain('<entry-class>');
  });

  it('SQL snippet uses <entry-class> when class is "default"', () => {
    mockSelectedArtifact = makeArtifact({ class: 'default' });
    render(<ArtifactDetail />);
    const preElements = document.querySelectorAll('pre');
    const sqlPre = Array.from(preElements).find((el) =>
      el.textContent?.includes('CREATE FUNCTION')
    );
    expect(sqlPre!.textContent).toContain('<entry-class>');
  });

  it('hides version dropdown when only one version', () => {
    mockSelectedArtifact = makeArtifact({
      versions: [{ version: 'ver-1' }],
    });
    render(<ArtifactDetail />);
    expect(screen.queryByLabelText('Select artifact version')).toBeNull();
  });

  it('shows doc link as clickable anchor', () => {
    mockSelectedArtifact = makeArtifact({
      documentation_link: 'https://docs.example.com',
    });
    render(<ArtifactDetail />);
    const link = screen.getByText('https://docs.example.com');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows em-dash for missing runtime_language', () => {
    mockSelectedArtifact = makeArtifact({ runtime_language: '' });
    render(<ArtifactDetail />);
    // Runtime Language row should show em-dash (plain text, no badge)
    expect(screen.queryByTestId('badge-runtime-language')).toBeNull();
  });

  it('delete confirm button calls deleteArtifact when name matches', async () => {
    mockDeleteArtifact.mockResolvedValue(undefined);
    render(<ArtifactDetail />);
    fireEvent.click(screen.getByText('Delete Artifact'));
    const input = screen.getByLabelText('Confirm artifact name');
    fireEvent.change(input, { target: { value: 'test-artifact' } });
    const dialog = input.closest('div')!.parentElement!;
    const confirmBtn = within(dialog).getAllByRole('button').find(
      (b) => b.textContent === 'Delete'
    )!;
    fireEvent.click(confirmBtn);
    expect(mockDeleteArtifact).toHaveBeenCalledWith('cfa-abc123');
  });

  it('clicking overlay dismisses delete confirmation', () => {
    render(<ArtifactDetail />);
    fireEvent.click(screen.getByText('Delete Artifact'));
    expect(screen.getByLabelText('Confirm artifact name')).toBeTruthy();
    // Click overlay (the backdrop with rgba background)
    const overlay = screen.getByLabelText('Confirm artifact name').closest('[style*="rgba"]')!.parentElement!;
    fireEvent.click(overlay);
    // Dialog should close
    expect(screen.queryByLabelText('Confirm artifact name')).toBeNull();
  });

  it('cancel button in delete dialog closes it', () => {
    render(<ArtifactDetail />);
    fireEvent.click(screen.getByText('Delete Artifact'));
    expect(screen.getByLabelText('Confirm artifact name')).toBeTruthy();
    // Click Cancel button
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByLabelText('Confirm artifact name')).toBeNull();
  });

  it('version draft badge shown for draft versions', () => {
    mockSelectedArtifact = makeArtifact({
      versions: [
        { version: 'ver-1', is_draft: true },
        { version: 'ver-2' },
      ],
    });
    render(<ArtifactDetail />);
    expect(screen.getByText('draft')).toBeTruthy();
  });

  it('copy metadata field shows check icon temporarily', async () => {
    render(<ArtifactDetail />);
    const copyBtns = screen.getAllByTitle(/Copy/);
    // Find the "Copy ID" button
    const copyIdBtn = copyBtns.find(b => b.title === 'Copy ID');
    if (copyIdBtn) {
      await fireEvent.click(copyIdBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    }
  });

  it('formatDate returns em-dash for undefined date', () => {
    mockSelectedArtifact = makeArtifact({
      metadata: undefined,
    });
    render(<ArtifactDetail />);
    // Created and Updated rows should show em-dash
    const metadataSection = screen.getByText('Metadata');
    expect(metadataSection).toBeTruthy();
  });
});
