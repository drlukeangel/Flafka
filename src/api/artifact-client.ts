import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/environment';

const ARTIFACT_API_BASE = '/api/artifact';

// Retry helper for transient server errors (502, 503, 504)
function retryOn5xx(client: AxiosInstance, label: string) {
  client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config;
    if (!config || !status || status < 502 || status > 504) return Promise.reject(error);
    const retryCount = (config as InternalAxiosRequestConfig & { __retryCount?: number }).__retryCount ?? 0;
    if (retryCount >= 2) return Promise.reject(error);
    (config as InternalAxiosRequestConfig & { __retryCount?: number }).__retryCount = retryCount + 1;
    const delay = (retryCount + 1) * 1500;
    if (import.meta.env.DEV) {
      console.warn(`[${label}] ${status} — retrying in ${delay}ms (attempt ${retryCount + 1}/2)`);
    }
    await new Promise((r) => setTimeout(r, delay));
    return client.request(config);
  });
}

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
    const credentials = `${env.metricsKey}:${env.metricsSecret}`;
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

retryOn5xx(artifactClient, 'Artifact API');

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
