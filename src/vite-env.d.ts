/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLOUD_PROVIDER: string;
  readonly VITE_CLOUD_REGION: string;
  readonly VITE_ORG_ID: string;
  readonly VITE_ENV_ID: string;
  readonly VITE_COMPUTE_POOL_ID: string;
  readonly VITE_FLINK_API_KEY: string;
  readonly VITE_FLINK_API_SECRET: string;
  readonly VITE_FLINK_CATALOG: string;
  readonly VITE_FLINK_DATABASE: string;
  readonly VITE_KAFKA_BOOTSTRAP: string;
  readonly VITE_KAFKA_API_KEY: string;
  readonly VITE_KAFKA_API_SECRET: string;
  readonly VITE_SCHEMA_REGISTRY_URL: string;
  readonly VITE_SCHEMA_REGISTRY_KEY: string;
  readonly VITE_SCHEMA_REGISTRY_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
