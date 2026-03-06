/**
 * @upload-artifact
 * UploadArtifact — Upload modal tests
 *
 * Covers:
 *   - Form validation (class name regex for Java vs Python)
 *   - JAR/ZIP toggle and file accept filter
 *   - 3-step upload flow
 *   - Cancel with AbortController
 *   - Progress tracking
 *   - Error states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockLoadArtifacts = vi.fn();
const mockSetArtifactUploading = vi.fn();
const mockSetUploadProgress = vi.fn();
const mockAddToast = vi.fn();

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: (s: unknown) => unknown) => {
    const state = {
      loadArtifacts: mockLoadArtifacts,
      setArtifactUploading: mockSetArtifactUploading,
      setUploadProgress: mockSetUploadProgress,
      addToast: mockAddToast,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

const mockGetPresignedUploadUrl = vi.fn();
const mockUploadFileToPresignedUrl = vi.fn();
const mockCreateArtifact = vi.fn();

vi.mock('../../api/artifact-api', () => ({
  getPresignedUploadUrl: (...args: unknown[]) => mockGetPresignedUploadUrl(...args),
  uploadFileToPresignedUrl: (...args: unknown[]) => mockUploadFileToPresignedUrl(...args),
  createArtifact: (...args: unknown[]) => mockCreateArtifact(...args),
}));

vi.mock('../../config/environment', () => ({
  env: {
    cloudProvider: 'aws',
    cloudRegion: 'us-east-1',
    environmentId: 'env-test',
  },
}));

import UploadArtifact from '../../components/ArtifactsPanel/UploadArtifact';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[@upload-artifact] UploadArtifact', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the upload dialog', () => {
    render(<UploadArtifact onClose={onClose} />);
    expect(screen.getByText('Upload Artifact')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows JAR/ZIP format toggle', () => {
    render(<UploadArtifact onClose={onClose} />);
    expect(screen.getByText('JAR (Java)')).toBeTruthy();
    expect(screen.getByText('ZIP (Python)')).toBeTruthy();
  });

  it('defaults to JAR format', () => {
    render(<UploadArtifact onClose={onClose} />);
    const jarRadio = screen.getByText('JAR (Java)').closest('button');
    expect(jarRadio?.getAttribute('aria-checked')).toBe('true');
  });

  it('switches to ZIP format on click', () => {
    render(<UploadArtifact onClose={onClose} />);
    fireEvent.click(screen.getByText('ZIP (Python)'));
    const zipRadio = screen.getByText('ZIP (Python)').closest('button');
    expect(zipRadio?.getAttribute('aria-checked')).toBe('true');
  });

  it('shows Java class name validation error', () => {
    render(<UploadArtifact onClose={onClose} />);
    const input = screen.getByPlaceholderText('com.example.MyUdf');
    fireEvent.change(input, { target: { value: '123invalid' } });
    expect(screen.getByText(/Must be a valid Java class name/)).toBeTruthy();
  });

  it('shows Python class name validation error', () => {
    render(<UploadArtifact onClose={onClose} />);
    fireEvent.click(screen.getByText('ZIP (Python)'));
    const input = screen.getByPlaceholderText('my_function');
    fireEvent.change(input, { target: { value: 'invalid.dotted.name' } });
    expect(screen.getByText(/Must be a valid Python identifier/)).toBeTruthy();
  });

  it('accepts valid Python identifier', () => {
    render(<UploadArtifact onClose={onClose} />);
    fireEvent.click(screen.getByText('ZIP (Python)'));
    const input = screen.getByPlaceholderText('my_function');
    fireEvent.change(input, { target: { value: 'sentiment_score' } });
    expect(screen.queryByText(/Must be a valid Python identifier/)).toBeNull();
  });

  it('upload button is disabled when form is incomplete', () => {
    render(<UploadArtifact onClose={onClose} />);
    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.style.cursor === 'not-allowed'
    );
    expect(actionBtn).toBeTruthy();
  });

  it('file size validation rejects large files', () => {
    render(<UploadArtifact onClose={onClose} />);
    const fileInput = screen.getByLabelText(/JAR File/);
    const bigFile = new File(['x'.repeat(100)], 'big.jar', { type: 'application/java-archive' });
    Object.defineProperty(bigFile, 'size', { value: 300 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [bigFile] } });
    expect(screen.getByText(/File too large/)).toBeTruthy();
  });

  it('rejects wrong file extension', () => {
    render(<UploadArtifact onClose={onClose} />);
    const fileInput = screen.getByLabelText(/JAR File/);
    const txtFile = new File(['data'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [txtFile] } });
    expect(screen.getByText(/Only .jar files are accepted/)).toBeTruthy();
  });

  it('runs full 3-step upload flow', async () => {
    mockGetPresignedUploadUrl.mockResolvedValue({
      upload_url: 'https://s3.test/bucket',
      upload_id: 'upload-123',
      upload_form_data: { key: 'test.jar', policy: 'p' },
    });
    mockUploadFileToPresignedUrl.mockResolvedValue(undefined);
    mockCreateArtifact.mockResolvedValue({ id: 'cfa-new', display_name: 'test' });

    render(<UploadArtifact onClose={onClose} />);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('my-udf-artifact'), {
      target: { value: 'TestUdf' },
    });
    fireEvent.change(screen.getByPlaceholderText('com.example.MyUdf'), {
      target: { value: 'com.test.Udf' },
    });

    const fileInput = screen.getByLabelText(/JAR File/);
    const file = new File(['jar-content'], 'test.jar', { type: 'application/java-archive' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click upload
    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.getAttribute('disabled') === null
    );
    if (actionBtn) fireEvent.click(actionBtn);

    await waitFor(() => {
      expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith('JAR');
    });

    await waitFor(() => {
      expect(mockCreateArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'TestUdf',
          content_format: 'JAR',
          runtime_language: 'JAVA',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Artifact created successfully.')).toBeTruthy();
    });
  });

  it('shows error on upload failure', async () => {
    mockGetPresignedUploadUrl.mockRejectedValue(new Error('Network error'));

    render(<UploadArtifact onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('my-udf-artifact'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('com.example.MyUdf'), {
      target: { value: 'com.test.Udf' },
    });

    const fileInput = screen.getByLabelText(/JAR File/);
    const file = new File(['jar'], 'test.jar');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.getAttribute('disabled') === null
    );
    if (actionBtn) fireEvent.click(actionBtn);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('calls onClose when Escape is pressed in form state', () => {
    render(<UploadArtifact onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking overlay', () => {
    render(<UploadArtifact onClose={onClose} />);
    // Click on the backdrop (first child)
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// [@coverage-boost] UploadArtifact — additional coverage for uncovered branches
// ---------------------------------------------------------------------------

describe('[@coverage-boost] UploadArtifact edge cases', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switching format from JAR to ZIP clears selected file and changes accepted extension', () => {
    render(<UploadArtifact onClose={onClose} />);
    // Select a JAR file first
    const fileInput = screen.getByLabelText(/JAR File/);
    const jarFile = new File(['jar'], 'test.jar');
    fireEvent.change(fileInput, { target: { files: [jarFile] } });
    expect(screen.getByText(/test.jar/)).toBeTruthy();

    // Switch to ZIP format
    fireEvent.click(screen.getByText('ZIP (Python)'));
    // File should be cleared, label should now be "ZIP File"
    expect(screen.getByLabelText(/ZIP File/)).toBeTruthy();
    expect(screen.queryByText(/test.jar/)).toBeNull();
  });

  it('Escape during requesting-url step does not show cancel confirm (only uploading step does)', async () => {
    mockGetPresignedUploadUrl.mockImplementation(
      () => new Promise(() => {}) // Never resolves — stuck in requesting-url
    );
    render(<UploadArtifact onClose={onClose} />);

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('my-udf-artifact'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('com.example.MyUdf'), {
      target: { value: 'com.test.Udf' },
    });
    const fileInput = screen.getByLabelText(/JAR File/);
    const file = new File(['jar'], 'test.jar');
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Click upload
    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.getAttribute('disabled') === null
    );
    if (actionBtn) fireEvent.click(actionBtn);

    // Wait for requesting-url step
    await waitFor(() => {
      expect(screen.getByText('Requesting upload URL...')).toBeTruthy();
    });

    // Press Escape — at requesting-url step, this does NOT show cancel confirm
    // (cancel confirm only appears at 'uploading' step)
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Upload in progress. Cancel?')).toBeNull();
  });

  it('cancel upload during progress resets to form state', async () => {
    mockGetPresignedUploadUrl.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );
    render(<UploadArtifact onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('my-udf-artifact'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('com.example.MyUdf'), {
      target: { value: 'com.test.Udf' },
    });
    const fileInput = screen.getByLabelText(/JAR File/);
    const file = new File(['jar'], 'test.jar');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.getAttribute('disabled') === null
    );
    if (actionBtn) fireEvent.click(actionBtn);

    await waitFor(() => {
      expect(screen.getByText('Requesting upload URL...')).toBeTruthy();
    });

    // Click cancel button in progress view
    fireEvent.click(screen.getByText('Cancel'));
    // Should show cancel confirmation
    expect(screen.getByText('Upload in progress. Cancel?')).toBeTruthy();

    // Click Cancel Upload
    fireEvent.click(screen.getByText('Cancel Upload'));
    expect(mockSetArtifactUploading).toHaveBeenCalledWith(false);
  });

  it('close button hidden during upload', async () => {
    mockGetPresignedUploadUrl.mockImplementation(
      () => new Promise(() => {})
    );
    render(<UploadArtifact onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('my-udf-artifact'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('com.example.MyUdf'), {
      target: { value: 'com.test.Udf' },
    });
    const fileInput = screen.getByLabelText(/JAR File/);
    const file = new File(['jar'], 'test.jar');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.getAttribute('disabled') === null
    );
    if (actionBtn) fireEvent.click(actionBtn);

    await waitFor(() => {
      expect(screen.getByText('Requesting upload URL...')).toBeTruthy();
    });

    // Close button should not be visible during upload
    expect(screen.queryByLabelText('Close')).toBeNull();
  });

  it('done state shows success message and Done button calls onClose', async () => {
    mockGetPresignedUploadUrl.mockResolvedValue({
      upload_url: 'https://s3.test/bucket',
      upload_id: 'upload-123',
      upload_form_data: { key: 'test.jar', policy: 'p' },
    });
    mockUploadFileToPresignedUrl.mockResolvedValue(undefined);
    mockCreateArtifact.mockResolvedValue({ id: 'cfa-new' });

    render(<UploadArtifact onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('my-udf-artifact'), {
      target: { value: 'TestUdf' },
    });
    fireEvent.change(screen.getByPlaceholderText('com.example.MyUdf'), {
      target: { value: 'com.test.Udf' },
    });
    const fileInput = screen.getByLabelText(/JAR File/);
    const file = new File(['jar'], 'test.jar');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.getAttribute('disabled') === null
    );
    if (actionBtn) fireEvent.click(actionBtn);

    await waitFor(() => {
      expect(screen.getByText('Artifact created successfully.')).toBeTruthy();
    });

    // Click Done
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape in done state calls onClose', async () => {
    mockGetPresignedUploadUrl.mockResolvedValue({
      upload_url: 'https://s3.test/bucket',
      upload_id: 'upload-123',
      upload_form_data: {},
    });
    mockUploadFileToPresignedUrl.mockResolvedValue(undefined);
    mockCreateArtifact.mockResolvedValue({ id: 'cfa-new' });

    render(<UploadArtifact onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('my-udf-artifact'), {
      target: { value: 'TestUdf' },
    });
    fireEvent.change(screen.getByPlaceholderText('com.example.MyUdf'), {
      target: { value: 'com.test.Udf' },
    });
    const fileInput = screen.getByLabelText(/JAR File/);
    fireEvent.change(fileInput, { target: { files: [new File(['j'], 'test.jar')] } });

    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.getAttribute('disabled') === null
    );
    if (actionBtn) fireEvent.click(actionBtn);

    await waitFor(() => {
      expect(screen.getByText('Artifact created successfully.')).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape in error state calls onClose', async () => {
    mockGetPresignedUploadUrl.mockRejectedValue(new Error('fail'));

    render(<UploadArtifact onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('my-udf-artifact'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('com.example.MyUdf'), {
      target: { value: 'com.test.Udf' },
    });
    const fileInput = screen.getByLabelText(/JAR File/);
    fireEvent.change(fileInput, { target: { files: [new File(['j'], 'test.jar')] } });

    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.getAttribute('disabled') === null
    );
    if (actionBtn) fireEvent.click(actionBtn);

    await waitFor(() => {
      expect(screen.getByText('fail')).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('accepts valid Java fully-qualified class name', () => {
    render(<UploadArtifact onClose={onClose} />);
    const input = screen.getByPlaceholderText('com.example.MyUdf');
    fireEvent.change(input, { target: { value: 'com.example.MyUdf' } });
    expect(screen.queryByText(/Must be a valid Java class name/)).toBeNull();
  });

  it('no file selected does nothing on file change', () => {
    render(<UploadArtifact onClose={onClose} />);
    const fileInput = screen.getByLabelText(/JAR File/);
    fireEvent.change(fileInput, { target: { files: [] } });
    // Should not show any error
    expect(screen.queryByText(/File too large/)).toBeNull();
    expect(screen.queryByText(/Only/)).toBeNull();
  });

  it('overlay click does not close during upload', async () => {
    mockGetPresignedUploadUrl.mockImplementation(() => new Promise(() => {}));
    render(<UploadArtifact onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('my-udf-artifact'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText('com.example.MyUdf'), {
      target: { value: 'com.test.Udf' },
    });
    const fileInput = screen.getByLabelText(/JAR File/);
    fireEvent.change(fileInput, { target: { files: [new File(['j'], 'test.jar')] } });

    const uploadBtns = screen.getAllByText('Upload');
    const actionBtn = uploadBtns.find(
      (btn) => btn.closest('button')?.getAttribute('disabled') === null
    );
    if (actionBtn) fireEvent.click(actionBtn);

    await waitFor(() => {
      expect(screen.getByText('Requesting upload URL...')).toBeTruthy();
    });

    // Click overlay - should NOT close
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });
});
