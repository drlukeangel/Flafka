import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/environment';

// Create Basic Auth header for Confluent Cloud
const createAuthHeader = (): string => {
  const credentials = `${env.flinkApiKey}:${env.flinkApiSecret}`;
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

// Separate client for FCPM API (different base path)
export const fcpmClient: AxiosInstance = axios.create({
  baseURL: FCPM_API_BASE,
  headers: {
    'Authorization': createAuthHeader(),
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for logging
confluentClient.interceptors.request.use(
  config => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  error => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
confluentClient.interceptors.response.use(
  response => {
    console.log(`[API Response] ${response.status}`, response.data);
    return response;
  },
  (error: AxiosError) => {
    const message = (error.response?.data as { message?: string })?.message || error.message;
    console.error(`[API Error] ${error.response?.status}: ${message}`);
    return Promise.reject(error);
  }
);

// Add request interceptor for FCPM client
fcpmClient.interceptors.request.use(
  config => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  error => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for FCPM client
fcpmClient.interceptors.response.use(
  response => {
    console.log(`[API Response] ${response.status}`, response.data);
    return response;
  },
  (error: AxiosError) => {
    const message = (error.response?.data as { message?: string })?.message || error.message;
    console.error(`[API Error] ${error.response?.status}: ${message}`);
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
