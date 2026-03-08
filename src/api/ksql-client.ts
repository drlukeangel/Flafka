import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/environment';

const createKsqlAuthHeader = (): string => {
  const credentials = `${env.ksqlApiKey}:${env.ksqlApiSecret}`;
  return `Basic ${btoa(credentials)}`;
};

const KSQL_API_BASE = '/api/ksql';

export const ksqlClient: AxiosInstance = axios.create({
  baseURL: KSQL_API_BASE,
  headers: {
    'Authorization': createKsqlAuthHeader(),
    'Content-Type': 'application/vnd.ksql.v1+json',
  },
});

// Request interceptor for logging
ksqlClient.interceptors.request.use(
  config => {
    if (import.meta.env.DEV) {
      console.log(`[ksqlDB] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  error => {
    if (import.meta.env.DEV) {
      console.error('[ksqlDB Request Error]', error);
    }
    return Promise.reject(error);
  }
);

// Retry on transient server errors (502, 503, 504)
ksqlClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const status = error.response?.status;
  const config = error.config;
  if (!config || !status || status < 502 || status > 504) return Promise.reject(error);
  const retryCount = (config as { __retryCount?: number }).__retryCount ?? 0;
  if (retryCount >= 2) return Promise.reject(error);
  (config as { __retryCount?: number }).__retryCount = retryCount + 1;
  const delay = (retryCount + 1) * 1500;
  if (import.meta.env.DEV) {
    console.warn(`[ksqlDB] ${status} — retrying in ${delay}ms (attempt ${retryCount + 1}/2)`);
  }
  await new Promise((r) => setTimeout(r, delay));
  return ksqlClient.request(config);
});

// Response interceptor for error handling
ksqlClient.interceptors.response.use(
  response => {
    if (import.meta.env.DEV) {
      console.log(`[ksqlDB Response] ${response.status}`, response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    const data = error.response?.data as Record<string, unknown> | undefined;
    const message = (data?.message as string) || error.message;
    if (import.meta.env.DEV) {
      console.error(`[ksqlDB Error] ${error.response?.status}: ${message}`, JSON.stringify(data, null, 2));
    }
    return Promise.reject(error);
  }
);

/**
 * Build the Authorization header value for ksqlDB fetch() calls.
 * fetch() doesn't use the Axios instance, so we need the raw header.
 */
export const getKsqlAuthHeader = (): string => createKsqlAuthHeader();

/** Base URL for ksqlDB fetch() calls (push/pull queries). */
export const KSQL_FETCH_BASE = KSQL_API_BASE;
