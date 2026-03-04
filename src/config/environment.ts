export interface EnvironmentConfig {
  orgId: string;
  environmentId: string;
  computePoolId: string;
  flinkApiKey: string;
  flinkApiSecret: string;
  metricsKey: string;
  metricsSecret: string;
  flinkCatalog: string;
  flinkDatabase: string;
  cloudProvider: string;
  cloudRegion: string;
  schemaRegistryUrl?: string;
  schemaRegistryKey?: string;
  schemaRegistrySecret?: string;
  kafkaClusterId: string;
  kafkaRestEndpoint: string;
  kafkaApiKey: string;
  kafkaApiSecret: string;
  employeeId: string;
}

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
    kafkaRestEndpoint: import.meta.env.VITE_KAFKA_REST_ENDPOINT || '',
    kafkaApiKey: import.meta.env.VITE_KAFKA_API_KEY || '',
    kafkaApiSecret: import.meta.env.VITE_KAFKA_API_SECRET || '',
    employeeId: import.meta.env.VITE_EMPLOYEE_ID || '',
  };
};

export const env = getEnv();
