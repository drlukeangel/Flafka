/**
 * @artifact-api
 * Tests for artifact-api.ts — list, get, create, delete, presigned URL, upload, CORS fallback
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PresignedUploadUrlResponse, FlinkArtifact, FlinkArtifactListResponse } from '../../types';

// Mock artifact-client — use vi.hoisted for hoisted mock references
const { mockGet, mockPost, mockDelete, mockAxiosPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDelete: vi.fn(),
  mockAxiosPost: vi.fn(),
}));

vi.mock('../../api/artifact-client', () => ({
  artifactClient: { get: mockGet, post: mockPost, delete: mockDelete },
}));

vi.mock('../../config/environment', () => ({
  env: {
    cloudProvider: 'aws',
    cloudRegion: 'us-east-1',
    environmentId: 'env-test123',
    cloudApiKey: 'test-key',
    cloudApiSecret: 'test-secret',
  },
}));

vi.mock('axios', () => ({
  default: {
    post: (...args: unknown[]) => mockAxiosPost(...args),
  },
}));

// Import AFTER mocks
import {
  listArtifacts,
  getArtifact,
  getPresignedUploadUrl,
  uploadFileToPresignedUrl,
  createArtifact,
  deleteArtifact,
} from '../../api/artifact-api';

beforeEach(() => {
  vi.clearAllMocks();
});

const makeArtifact = (overrides?: Partial<FlinkArtifact>): FlinkArtifact => ({
  id: 'cfa-abc123',
  display_name: 'test-artifact',
  class: 'com.example.TestUdf',
  cloud: 'aws',
  region: 'us-east-1',
  environment: 'env-test123',
  content_format: 'JAR',
  runtime_language: 'JAVA',
  versions: [{ version: 'ver-1' }],
  ...overrides,
});

const makePresigned = (overrides?: Partial<PresignedUploadUrlResponse>): PresignedUploadUrlResponse => ({
  api_version: 'v1',
  kind: 'PresignedUploadUrl',
  content_format: 'JAR',
  cloud: 'aws',
  region: 'us-east-1',
  upload_url: 'https://s3.amazonaws.com/bucket',
  upload_id: 'upload-123',
  upload_form_data: {
    key: 'artifacts/test.jar',
    policy: 'base64policy',
    'x-amz-credential': 'cred123',
    'x-amz-signature': 'sig456',
  },
  ...overrides,
});

describe('[@artifact-api] listArtifacts', () => {
  it('fetches artifacts with correct params', async () => {
    const artifacts = [makeArtifact()];
    mockGet.mockResolvedValue({
      data: { data: artifacts, metadata: { total_size: 1 } } as FlinkArtifactListResponse,
    });

    const result = await listArtifacts();

    expect(mockGet).toHaveBeenCalledWith('/v1/flink-artifacts', {
      params: { cloud: 'aws', region: 'us-east-1', environment: 'env-test123' },
    });
    expect(result).toEqual(artifacts);
  });

  it('propagates 401 error', async () => {
    mockGet.mockRejectedValue({ response: { status: 401 }, message: 'Unauthorized' });
    await expect(listArtifacts()).rejects.toBeTruthy();
  });
});

describe('[@artifact-api] getArtifact', () => {
  it('fetches a single artifact by ID', async () => {
    const artifact = makeArtifact();
    mockGet.mockResolvedValue({ data: artifact });

    const result = await getArtifact('cfa-abc123');

    expect(mockGet).toHaveBeenCalledWith('/v1/flink-artifacts/cfa-abc123', {
      params: { cloud: 'aws', region: 'us-east-1', environment: 'env-test123' },
    });
    expect(result).toEqual(artifact);
  });

  it('propagates 403 error', async () => {
    mockGet.mockRejectedValue({ response: { status: 403 }, message: 'Forbidden' });
    await expect(getArtifact('cfa-bad')).rejects.toBeTruthy();
  });
});

describe('[@artifact-api] getPresignedUploadUrl', () => {
  it('requests presigned URL for JAR (default)', async () => {
    const presigned = makePresigned();
    mockPost.mockResolvedValue({ data: presigned });

    const result = await getPresignedUploadUrl();

    expect(mockPost).toHaveBeenCalledWith('/v1/presigned-upload-url', {
      content_format: 'JAR',
      cloud: 'aws',
      region: 'us-east-1',
      environment: 'env-test123',
    });
    expect(result).toEqual(presigned);
  });

  it('requests presigned URL for ZIP', async () => {
    const presigned = makePresigned({ content_format: 'ZIP' });
    mockPost.mockResolvedValue({ data: presigned });

    const result = await getPresignedUploadUrl('ZIP');

    expect(mockPost).toHaveBeenCalledWith('/v1/presigned-upload-url', {
      content_format: 'ZIP',
      cloud: 'aws',
      region: 'us-east-1',
      environment: 'env-test123',
    });
    expect(result.content_format).toBe('ZIP');
  });
});

describe('[@artifact-api] uploadFileToPresignedUrl', () => {
  it('builds FormData with S3 fields + file and POSTs to upload_url', async () => {
    const presigned = makePresigned();
    const file = new File(['jar-content'], 'test.jar', { type: 'application/java-archive' });
    mockAxiosPost.mockResolvedValue({ status: 204 });

    await uploadFileToPresignedUrl(presigned, file);

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    const [url, formData, config] = mockAxiosPost.mock.calls[0];
    expect(url).toBe('https://s3.amazonaws.com/bucket');
    expect(formData).toBeInstanceOf(FormData);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('calls onProgress callback', async () => {
    const presigned = makePresigned();
    const file = new File(['content'], 'test.jar');
    const onProgress = vi.fn();

    mockAxiosPost.mockImplementation((_url: string, _data: FormData, config: { onUploadProgress?: (e: { loaded: number; total: number }) => void }) => {
      config.onUploadProgress?.({ loaded: 50, total: 100 });
      return Promise.resolve({ status: 204 });
    });

    await uploadFileToPresignedUrl(presigned, file, onProgress);
    expect(onProgress).toHaveBeenCalledWith(50);
  });

  it('falls back to proxy on CORS/network error', async () => {
    const presigned = makePresigned();
    const file = new File(['content'], 'test.jar');

    mockAxiosPost
      .mockRejectedValueOnce({ code: 'ERR_NETWORK' })
      .mockResolvedValueOnce({ status: 204 });

    await uploadFileToPresignedUrl(presigned, file);

    expect(mockAxiosPost).toHaveBeenCalledTimes(2);
    expect(mockAxiosPost.mock.calls[1][0]).toBe('/api/artifact-upload-proxy');
  });

  it('rethrows non-CORS errors', async () => {
    const presigned = makePresigned();
    const file = new File(['content'], 'test.jar');

    mockAxiosPost.mockRejectedValue({ response: { status: 500 }, code: 'ERR_BAD_RESPONSE' });

    await expect(
      uploadFileToPresignedUrl(presigned, file)
    ).rejects.toBeTruthy();
  });
});

describe('[@artifact-api] createArtifact', () => {
  it('posts artifact creation request', async () => {
    const artifact = makeArtifact();
    mockPost.mockResolvedValue({ data: artifact });

    const result = await createArtifact({
      display_name: 'test-artifact',
      class: 'com.example.TestUdf',
      cloud: 'aws',
      region: 'us-east-1',
      environment: 'env-test123',
      content_format: 'JAR',
      upload_source: { upload_id: 'upload-123' },
    });

    expect(mockPost).toHaveBeenCalledWith('/v1/flink-artifacts', expect.objectContaining({
      display_name: 'test-artifact',
    }));
    expect(result.id).toBe('cfa-abc123');
  });

  it('propagates 409 conflict', async () => {
    mockPost.mockRejectedValue({ response: { status: 409 }, message: 'Conflict' });
    await expect(createArtifact({
      display_name: 'dup',
      class: 'com.Dup',
      cloud: 'aws',
      region: 'us-east-1',
      environment: 'env-test123',
      content_format: 'JAR',
      upload_source: { upload_id: 'x' },
    })).rejects.toBeTruthy();
  });
});

describe('[@artifact-api] deleteArtifact', () => {
  it('sends DELETE request', async () => {
    mockDelete.mockResolvedValue({ status: 204 });
    await deleteArtifact('cfa-abc123');
    expect(mockDelete).toHaveBeenCalledWith('/v1/flink-artifacts/cfa-abc123');
  });

  it('propagates 409 error (in use)', async () => {
    mockDelete.mockRejectedValue({ response: { status: 409 }, message: 'In use' });
    await expect(deleteArtifact('cfa-inuse')).rejects.toBeTruthy();
  });
});
