import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from '../config/environment';

const createSchemaRegistryAuthHeader = (): string => {
  const credentials = `${env.schemaRegistryKey}:${env.schemaRegistrySecret}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
};

const SCHEMA_REGISTRY_API_BASE = '/api/schema-registry';

export const schemaRegistryClient: AxiosInstance = axios.create({
  baseURL: SCHEMA_REGISTRY_API_BASE,
  headers: {
    'Authorization': createSchemaRegistryAuthHeader(),
    'Content-Type': 'application/vnd.schemaregistry.v1+json',
  },
});

schemaRegistryClient.interceptors.request.use(
  config => {
    if (import.meta.env.DEV) {
      console.log(`[Schema Registry] ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  error => {
    if (import.meta.env.DEV) {
      console.error('[Schema Registry Request Error]', error);
    }
    return Promise.reject(error);
  }
);

schemaRegistryClient.interceptors.response.use(
  response => {
    if (import.meta.env.DEV) {
      console.log(`[Schema Registry Response] ${response.status}`, response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    // 404s are expected for subject-level config lookups (falls back to global config)
    if (error.response?.status !== 404) {
      const message = (error.response?.data as { message?: string })?.message || error.message;
      if (import.meta.env.DEV) {
        console.error(`[Schema Registry Error] ${error.response?.status}: ${message}`);
      }
    }
    return Promise.reject(error);
  }
);
