import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/environment';

// Create Basic Auth header for Flink SQL API
const createAuthHeader = (): string => {
  const credentials = `${env.flinkApiKey}:${env.flinkApiSecret}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
};

// Create Basic Auth header for Telemetry / Metrics API (SA-scoped Cloud API key)
const createMetricsAuthHeader = (): string => {
  const credentials = `${env.metricsKey}:${env.metricsSecret}`;
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

// Separate client for FCPM API (Cloud management — uses SA-scoped Cloud API key)
export const fcpmClient: AxiosInstance = axios.create({
  baseURL: FCPM_API_BASE,
  timeout: 15000,
  headers: {
    'Authorization': createMetricsAuthHeader(),
    'Content-Type': 'application/json',
  },
});

// Telemetry API client (Confluent Cloud metrics)
const TELEMETRY_API_BASE = '/api/telemetry';

export const telemetryClient: AxiosInstance = axios.create({
  baseURL: TELEMETRY_API_BASE,
  timeout: 15000,
  headers: {
    'Authorization': createMetricsAuthHeader(),
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

// Retry helper for transient server errors (502, 503, 504)
function retryOn5xx(client: AxiosInstance, label: string) {
  client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config;
    if (!config || !status || status < 502 || status > 504) return Promise.reject(error);
    const retryCount = (config as { __retryCount?: number }).__retryCount ?? 0;
    if (retryCount >= 2) return Promise.reject(error);
    (config as { __retryCount?: number }).__retryCount = retryCount + 1;
    const delay = (retryCount + 1) * 1500;
    if (import.meta.env.DEV) {
      console.warn(`[${label}] ${status} — retrying in ${delay}ms (attempt ${retryCount + 1}/2)`);
    }
    await new Promise((r) => setTimeout(r, delay));
    return client.request(config);
  });
}

retryOn5xx(confluentClient, 'API');

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
      console.error(`[API Error] ${error.response?.status}: ${message}`, JSON.stringify(error.response?.data, null, 2));
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

// Add request interceptor for Telemetry client
telemetryClient.interceptors.request.use(
  config => {
    if (import.meta.env.DEV) {
      console.log(`[Telemetry] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  error => {
    if (import.meta.env.DEV) {
      console.error('[Telemetry Request Error]', error);
    }
    return Promise.reject(error);
  }
);

// Add response interceptor for Telemetry client
telemetryClient.interceptors.response.use(
  response => {
    if (import.meta.env.DEV) {
      console.log(`[Telemetry Response] ${response.status}`, response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    if (import.meta.env.DEV) {
      console.error(`[Telemetry Error] ${error.response?.status}`, error.response?.data);
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
    const axiosError = error as AxiosError<{ message?: string; detail?: string; errors?: Array<{ detail?: string }> }>;
    const data = axiosError.response?.data;
    const detail = data?.errors?.[0]?.detail ?? data?.detail;
    return {
      status: axiosError.response?.status || 500,
      message: data?.message || axiosError.message,
      details: detail,
    };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : 'Unknown error',
  };
};
