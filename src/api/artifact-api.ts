import { artifactClient } from './artifact-client';
import { env } from '../config/environment';
import type {
  FlinkArtifact,
  FlinkArtifactListResponse,
  PresignedUploadUrlResponse,
  CreateArtifactRequest,
} from '../types';

/**
 * List all Flink artifacts for the current environment.
 */
export async function listArtifacts(filterUniqueId?: string): Promise<FlinkArtifact[]> {
  const response = await artifactClient.get<FlinkArtifactListResponse>(
    '/v1/flink-artifacts',
    {
      params: {
        cloud: env.cloudProvider,
        region: env.cloudRegion,
        environment: env.environmentId,
      },
    }
  );
  const artifacts = response.data.data ?? [];
  if (filterUniqueId) {
    return artifacts.filter(a => a.display_name?.includes(filterUniqueId));
  }
  return artifacts;
}

/**
 * Get a single Flink artifact by ID.
 */
export async function getArtifact(artifactId: string): Promise<FlinkArtifact> {
  const response = await artifactClient.get<FlinkArtifact>(
    `/v1/flink-artifacts/${artifactId}`,
    {
      params: {
        cloud: env.cloudProvider,
        region: env.cloudRegion,
        environment: env.environmentId,
      },
    }
  );
  return response.data;
}

/**
 * Request a presigned upload URL for a file (JAR or ZIP).
 */
export async function getPresignedUploadUrl(
  contentFormat: 'JAR' | 'ZIP' = 'JAR',
): Promise<PresignedUploadUrlResponse> {
  const response = await artifactClient.post<PresignedUploadUrlResponse>(
    '/v1/presigned-upload-url',
    {
      content_format: contentFormat,
      cloud: env.cloudProvider,
      region: env.cloudRegion,
      environment: env.environmentId,
    }
  );
  return response.data;
}

/**
 * Upload a file to the presigned URL using S3 POST form upload.
 * The presigned response includes `upload_form_data` (S3 POST policy fields)
 * that must be sent as multipart form fields before the file.
 *
 * On CORS failure, falls back to the Vite dev proxy at /api/s3-upload-proxy.
 */
export async function uploadFileToPresignedUrl(
  presignedResponse: PresignedUploadUrlResponse,
  file: File,
  _onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  const formData = new FormData();
  // Add all S3 policy fields first (order matters for S3)
  Object.entries(presignedResponse.upload_form_data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  // File MUST be the last field
  formData.append('file', file);

  // Use browser native fetch with no-cors — the browser CAN reach S3 and the
  // upload goes through, but CORS blocks reading the response. That's fine for
  // uploads — we verify success by polling the artifact API afterward.
  await fetch(presignedResponse.upload_url, {
    method: 'POST',
    body: formData,
    mode: 'no-cors',
    signal: abortSignal ?? undefined,
  });
}

/**
 * Create a new Flink artifact after uploading the JAR.
 */
export async function createArtifact(
  request: CreateArtifactRequest,
): Promise<FlinkArtifact> {
  const response = await artifactClient.post<FlinkArtifact>(
    '/v1/flink-artifacts',
    request,
  );
  return response.data;
}

/**
 * Delete a Flink artifact by ID.
 */
export async function deleteArtifact(artifactId: string): Promise<void> {
  await artifactClient.delete(`/v1/flink-artifacts/${artifactId}`);
}
