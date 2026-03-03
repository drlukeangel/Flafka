/**
 * @artifact-store
 * Artifact store actions — loadArtifacts, selectArtifact, clearSelectedArtifact,
 * deleteArtifact (optimistic + rollback), setArtifactError, setArtifactUploading,
 * setUploadProgress
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { FlinkArtifact } from '../../types';

// Mock artifact API
const mockListArtifacts = vi.fn();
const mockDeleteArtifact = vi.fn();

vi.mock('../../api/artifact-api', () => ({
  listArtifacts: () => mockListArtifacts(),
  deleteArtifact: (id: string) => mockDeleteArtifact(id),
  getPresignedUploadUrl: vi.fn(),
  uploadFileToPresignedUrl: vi.fn(),
  createArtifact: vi.fn(),
}));

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

describe('[@artifact-store] artifact store actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      artifactList: [],
      selectedArtifact: null,
      artifactLoading: false,
      artifactUploading: false,
      uploadProgress: null,
      artifactError: null,
      toasts: [],
    });
  });

  describe('loadArtifacts', () => {
    it('sets loading state and populates artifact list', async () => {
      const artifacts = [makeArtifact(), makeArtifact({ id: 'cfa-second', display_name: 'second' })];
      mockListArtifacts.mockResolvedValue(artifacts);

      await useWorkspaceStore.getState().loadArtifacts();

      const state = useWorkspaceStore.getState();
      expect(state.artifactLoading).toBe(false);
      expect(state.artifactList).toEqual(artifacts);
      expect(state.artifactError).toBeNull();
    });

    it('sets error on API failure', async () => {
      mockListArtifacts.mockRejectedValue({
        response: { status: 401 },
        message: 'Unauthorized',
      });

      await useWorkspaceStore.getState().loadArtifacts();

      const state = useWorkspaceStore.getState();
      expect(state.artifactLoading).toBe(false);
      expect(state.artifactError).toContain('Unauthorized');
    });

    it('handles 409 conflict', async () => {
      mockListArtifacts.mockRejectedValue({
        response: { status: 409 },
        message: 'Conflict',
      });

      await useWorkspaceStore.getState().loadArtifacts();

      const state = useWorkspaceStore.getState();
      expect(state.artifactError).toContain('artifacts');
    });
  });

  describe('selectArtifact', () => {
    it('sets selectedArtifact', () => {
      const artifact = makeArtifact();
      useWorkspaceStore.getState().selectArtifact(artifact);
      expect(useWorkspaceStore.getState().selectedArtifact).toEqual(artifact);
    });
  });

  describe('clearSelectedArtifact', () => {
    it('clears selectedArtifact to null', () => {
      useWorkspaceStore.setState({ selectedArtifact: makeArtifact() });
      useWorkspaceStore.getState().clearSelectedArtifact();
      expect(useWorkspaceStore.getState().selectedArtifact).toBeNull();
    });
  });

  describe('deleteArtifact', () => {
    it('removes artifact optimistically', async () => {
      const artifact = makeArtifact();
      useWorkspaceStore.setState({ artifactList: [artifact], selectedArtifact: artifact });
      mockDeleteArtifact.mockResolvedValue(undefined);

      await useWorkspaceStore.getState().deleteArtifact('cfa-abc123');

      const state = useWorkspaceStore.getState();
      expect(state.artifactList).toHaveLength(0);
      expect(state.selectedArtifact).toBeNull();
    });

    it('rolls back on 409 error', async () => {
      const artifact = makeArtifact();
      useWorkspaceStore.setState({ artifactList: [artifact], selectedArtifact: artifact });
      mockDeleteArtifact.mockRejectedValue({ response: { status: 409 } });

      await useWorkspaceStore.getState().deleteArtifact('cfa-abc123');

      const state = useWorkspaceStore.getState();
      // Rolled back — artifact is back in the list
      expect(state.artifactList).toHaveLength(1);
      expect(state.artifactList[0].id).toBe('cfa-abc123');
    });

    it('shows success toast on delete', async () => {
      const artifact = makeArtifact({ display_name: 'MyUdf' });
      useWorkspaceStore.setState({ artifactList: [artifact] });
      mockDeleteArtifact.mockResolvedValue(undefined);

      await useWorkspaceStore.getState().deleteArtifact('cfa-abc123');

      const toasts = useWorkspaceStore.getState().toasts;
      expect(toasts.some((t) => t.type === 'success' && t.message.includes('MyUdf'))).toBe(true);
    });
  });

  describe('setArtifactError', () => {
    it('sets error message', () => {
      useWorkspaceStore.getState().setArtifactError('Something broke');
      expect(useWorkspaceStore.getState().artifactError).toBe('Something broke');
    });

    it('clears error with null', () => {
      useWorkspaceStore.setState({ artifactError: 'old error' });
      useWorkspaceStore.getState().setArtifactError(null);
      expect(useWorkspaceStore.getState().artifactError).toBeNull();
    });
  });

  describe('setArtifactUploading', () => {
    it('sets uploading flag', () => {
      useWorkspaceStore.getState().setArtifactUploading(true);
      expect(useWorkspaceStore.getState().artifactUploading).toBe(true);

      useWorkspaceStore.getState().setArtifactUploading(false);
      expect(useWorkspaceStore.getState().artifactUploading).toBe(false);
    });
  });

  describe('setUploadProgress', () => {
    it('sets upload progress value', () => {
      useWorkspaceStore.getState().setUploadProgress(42);
      expect(useWorkspaceStore.getState().uploadProgress).toBe(42);
    });

    it('clears progress with null', () => {
      useWorkspaceStore.setState({ uploadProgress: 75 });
      useWorkspaceStore.getState().setUploadProgress(null);
      expect(useWorkspaceStore.getState().uploadProgress).toBeNull();
    });
  });
});
