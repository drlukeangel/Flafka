import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/environment';

const KAFKA_API_BASE = '/api/kafka';

// CRIT-1: Client created without auth header — auth is injected per-request in the
// interceptor below so credentials are read at call-time, not at module load time.
export const kafkaRestClient: AxiosInstance = axios.create({
  baseURL: KAFKA_API_BASE,
  timeout: 30000, // MED-6: 30-second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

kafkaRestClient.interceptors.request.use(
  config => {
    // Evaluate credentials on every request so rotated keys take effect immediately
    const credentials = `${env.kafkaApiKey}:${env.kafkaApiSecret}`;
    const encoded = btoa(credentials);
    config.headers['Authorization'] = `Basic ${encoded}`;
    if (import.meta.env.DEV) {
      // LOW-1: only log in dev mode — never leak auth details in production
      console.log(`[Kafka REST] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  error => {
    if (import.meta.env.DEV) {
      console.error('[Kafka REST Request Error]', error);
    }
    return Promise.reject(error);
  }
);

kafkaRestClient.interceptors.response.use(
  response => {
    if (import.meta.env.DEV) {
      console.log(`[Kafka REST Response] ${response.status}`);
    }
    return response;
  },
  (error: AxiosError) => {
    const message = (error.response?.data as { message?: string })?.message || error.message;
    if (import.meta.env.DEV) {
      console.error(`[Kafka REST Error] ${error.response?.status}: ${message}`);
    }
    return Promise.reject(error);
  }
);
