/**
 * Configuration sourced from Vite environment variables (VITE_* in .env).
 * These connect the app to Confluent Cloud services: Flink SQL, Schema Registry, and Kafka.
 */
export interface EnvironmentConfig {
  /** Confluent Cloud organization ID */
  orgId: string;
  /** Confluent Cloud environment ID */
  environmentId: string;
  /** Flink Compute Pool ID — determines where SQL statements execute */
  computePoolId: string;
  /** API key for Flink SQL REST API (Basic Auth username) */
  flinkApiKey: string;
  /** API secret for Flink SQL REST API (Basic Auth password) */
  flinkApiSecret: string;
  /** API key for the Confluent Cloud Metrics API */
  metricsKey: string;
  /** API secret for the Confluent Cloud Metrics API */
  metricsSecret: string;
  /** Default Flink catalog (usually matches the Confluent environment name) */
  flinkCatalog: string;
  /** Default Flink database within the catalog */
  flinkDatabase: string;
  /** Cloud provider hosting the environment (e.g. "aws", "gcp", "azure") */
  cloudProvider: string;
  /** Cloud region (e.g. "us-east-1") */
  cloudRegion: string;
  /** Schema Registry URL (optional — enables schema browsing panel) */
  schemaRegistryUrl?: string;
  /** Schema Registry API key (optional) */
  schemaRegistryKey?: string;
  /** Schema Registry API secret (optional) */
  schemaRegistrySecret?: string;
  /** Kafka cluster ID — used for topic management APIs */
  kafkaClusterId: string;
  /** Kafka bootstrap servers (broker endpoint for direct produce/consume) */
  kafkaBootstrap: string;
  /** Kafka REST Proxy endpoint URL */
  kafkaRestEndpoint: string;
  /** API key for the Kafka REST Proxy */
  kafkaApiKey: string;
  /** API secret for the Kafka REST Proxy */
  kafkaApiSecret: string;
  /** Unique user/session identifier — used to tag all created resources (see names.ts) */
  uniqueId: string;
  /** Whether this session has admin privileges (unlocks destructive operations) */
  isAdmin: boolean;
  /** Environment mode — "dev" enables testing-friendly defaults (low partitions, short retention) */
  environment: 'dev' | 'production';
  /** Whether ksqlDB engine toggle is enabled */
  ksqlEnabled: boolean;
  /** ksqlDB cluster endpoint URL */
  ksqlEndpoint?: string;
  /** ksqlDB API key (Basic Auth username) */
  ksqlApiKey?: string;
  /** ksqlDB API secret (Basic Auth password) */
  ksqlApiSecret?: string;
}

/**
 * Reads configuration from Vite's `import.meta.env` (populated from .env files at build time).
 * Validates that required variables are present and logs an error for any missing ones.
 * Returns an EnvironmentConfig with empty-string defaults for missing optional values.
 */
export const getEnv = (): EnvironmentConfig => {
  const requiredVars = [
    'VITE_ORG_ID',
    'VITE_ENV_ID',
    'VITE_COMPUTE_POOL_ID',
    'VITE_FLINK_API_KEY',
    'VITE_FLINK_API_SECRET',
    'VITE_FLINK_CATALOG',
    'VITE_FLINK_DATABASE',
  ];

  const missing = requiredVars.filter(key => !import.meta.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please create a .env file with the required Confluent Cloud credentials.`
    );
  }

  return {
    orgId: import.meta.env.VITE_ORG_ID || '',
    environmentId: import.meta.env.VITE_ENV_ID || '',
    computePoolId: import.meta.env.VITE_COMPUTE_POOL_ID || '',
    flinkApiKey: import.meta.env.VITE_FLINK_API_KEY || '',
    flinkApiSecret: import.meta.env.VITE_FLINK_API_SECRET || '',
    metricsKey: import.meta.env.VITE_METRICS_KEY || '',
    metricsSecret: import.meta.env.VITE_METRICS_SECRET || '',
    flinkCatalog: import.meta.env.VITE_FLINK_CATALOG || '',
    flinkDatabase: import.meta.env.VITE_FLINK_DATABASE || '',
    cloudProvider: import.meta.env.VITE_CLOUD_PROVIDER || '',
    cloudRegion: import.meta.env.VITE_CLOUD_REGION || '',
    schemaRegistryUrl: import.meta.env.VITE_SCHEMA_REGISTRY_URL || '',
    schemaRegistryKey: import.meta.env.VITE_SCHEMA_REGISTRY_KEY || '',
    schemaRegistrySecret: import.meta.env.VITE_SCHEMA_REGISTRY_SECRET || '',
    kafkaClusterId: import.meta.env.VITE_KAFKA_CLUSTER_ID || '',
    kafkaBootstrap: import.meta.env.VITE_KAFKA_BOOTSTRAP || '',
    kafkaRestEndpoint: import.meta.env.VITE_KAFKA_REST_ENDPOINT || '',
    kafkaApiKey: import.meta.env.VITE_KAFKA_API_KEY || '',
    kafkaApiSecret: import.meta.env.VITE_KAFKA_API_SECRET || '',
    uniqueId: import.meta.env.VITE_UNIQUE_ID || '',
    isAdmin: import.meta.env.VITE_ADMIN_SECRET === 'FLAFKA',
    environment: import.meta.env.VITE_ENVIRONMENT === 'dev' ? 'dev' : 'production',
    ksqlEnabled: import.meta.env.VITE_KSQL_ENABLED === 'true',
    ksqlEndpoint: import.meta.env.VITE_KSQL_ENDPOINT || undefined,
    ksqlApiKey: import.meta.env.VITE_KSQL_API_KEY || undefined,
    ksqlApiSecret: import.meta.env.VITE_KSQL_API_SECRET || undefined,
  };
};

/** Whether ksqlDB credentials are fully configured (endpoint + key + secret) */
export const isKsqlConfigured = (): boolean =>
  !!(env.ksqlEndpoint && env.ksqlApiKey && env.ksqlApiSecret);

/** @deprecated Use isKsqlConfigured() + ksqlFeatureEnabled store flag instead */
export const isKsqlEnabled = isKsqlConfigured;

export const env = getEnv();
