import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/environment';

// Create Basic Auth header for Flink SQL API
const createAuthHeader = (): string => {
  const credentials = `${env.flinkApiKey}:${env.flinkApiSecret}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
};

// Create Basic Auth header for Cloud management API (FCPM)
const createCloudAuthHeader = (): string => {
  const credentials = `${env.cloudApiKey}:${env.cloudApiSecret}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
};

// Use local proxy to avoid CORS issues
// The proxy is configured in vite.config.ts to forward to Confluent Cloud
const FLINK_API_BASE = '/api/flink';
const FCPM_API_BASE = '/api/fcpm';

export const confluentClient: AxiosInstance = axios.create({
  baseURL: FLINK_API_BASE,
  headers: {
    'Authorization': createAuthHeader(),
    'Content-Type': 'application/json',
  },
});

// Separate client for FCPM API (different base path and credentials)
export const fcpmClient: AxiosInstance = axios.create({
  baseURL: FCPM_API_BASE,
  headers: {
    'Authorization': createCloudAuthHeader(),
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
confluentClient.interceptors.request.use(
  config => {
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  error => {
    if (import.meta.env.DEV) {
      console.error('[API Request Error]', error);
    }
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
confluentClient.interceptors.response.use(
  response => {
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.status}`, response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    const message = (error.response?.data as { message?: string })?.message || error.message;
    if (import.meta.env.DEV) {
      console.error(`[API Error] ${error.response?.status}: ${message}`);
    }
    return Promise.reject(error);
  }
);

// Add request interceptor for FCPM client
fcpmClient.interceptors.request.use(
  config => {
    if (import.meta.env.DEV) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  error => {
    if (import.meta.env.DEV) {
      console.error('[API Request Error]', error);
    }
    return Promise.reject(error);
  }
);

// Add response interceptor for FCPM client
fcpmClient.interceptors.response.use(
  response => {
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.status}`, response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    const message = (error.response?.data as { message?: string })?.message || error.message;
    if (import.meta.env.DEV) {
      console.error(`[API Error] ${error.response?.status}: ${message}`);
    }
    return Promise.reject(error);
  }
);

export interface ApiError {
  status: number;
  message: string;
  details?: string;
}

export const handleApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; detail?: string }>;
    return {
      status: axiosError.response?.status || 500,
      message: axiosError.response?.data?.message || axiosError.message,
      details: axiosError.response?.data?.detail,
    };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : 'Unknown error',
  };
};
