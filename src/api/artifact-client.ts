import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/environment';

const ARTIFACT_API_BASE = '/api/artifact';

// Client created without auth header — auth is injected per-request in the
// interceptor below so credentials are read at call-time, not at module load time.
export const artifactClient: AxiosInstance = axios.create({
  baseURL: ARTIFACT_API_BASE,
  timeout: 60000, // 60-second timeout for upload flows
  headers: {
    'Content-Type': 'application/json',
  },
});

artifactClient.interceptors.request.use(
  config => {
    // Evaluate credentials on every request so rotated keys take effect immediately
    const credentials = `${env.cloudApiKey}:${env.cloudApiSecret}`;
    const encoded = btoa(credentials);
    config.headers['Authorization'] = `Basic ${encoded}`;
    if (import.meta.env.DEV) {
      console.log(`[Artifact API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  error => {
    if (import.meta.env.DEV) {
      console.error('[Artifact API Request Error]', error);
    }
    return Promise.reject(error);
  }
);

artifactClient.interceptors.response.use(
  response => {
    if (import.meta.env.DEV) {
      console.log(`[Artifact API Response] ${response.status}`);
    }
    return response;
  },
  (error: AxiosError) => {
    const message = (error.response?.data as { message?: string })?.message || error.message;
    if (import.meta.env.DEV) {
      console.error(`[Artifact API Error] ${error.response?.status}: ${message}`);
    }
    return Promise.reject(error);
  }
);
