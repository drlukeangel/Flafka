import axios from 'axios';
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
export async function listArtifacts(): Promise<FlinkArtifact[]> {
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
  return response.data.data ?? [];
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
  onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  const buildFormData = () => {
    const formData = new FormData();
    // Add all S3 policy fields first (order matters for S3)
    Object.entries(presignedResponse.upload_form_data).forEach(([key, value]) => {
      formData.append(key, value);
    });
    // File MUST be the last field
    formData.append('file', file);
    return formData;
  };

  const progressHandler = (progressEvent: { loaded: number; total?: number }) => {
    if (onProgress && progressEvent.total) {
      const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
      onProgress(percent);
    }
  };

  // S3 presigned URLs always CORS-block from browser — go through Vite proxy directly
  await axios.post(
    '/api/s3-upload-proxy',
    buildFormData(),
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Target-Url': presignedResponse.upload_url,
      },
      onUploadProgress: progressHandler,
      signal: abortSignal,
    },
  );
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
