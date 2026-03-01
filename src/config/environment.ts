export interface EnvironmentConfig {
  orgId: string;
  environmentId: string;
  computePoolId: string;
  flinkApiKey: string;
  flinkApiSecret: string;
  cloudApiKey: string;
  cloudApiSecret: string;
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
}

export const getEnv = (): EnvironmentConfig => {
  const requiredVars = [
    'VITE_ORG_ID',
    'VITE_ENV_ID',
    'VITE_COMPUTE_POOL_ID',
    'VITE_FLINK_API_KEY',
    'VITE_FLINK_API_SECRET',
    'VITE_CLOUD_API_KEY',
    'VITE_CLOUD_API_SECRET',
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
    cloudApiKey: import.meta.env.VITE_CLOUD_API_KEY || '',
    cloudApiSecret: import.meta.env.VITE_CLOUD_API_SECRET || '',
    flinkCatalog: import.meta.env.VITE_FLINK_CATALOG || 'default',
    flinkDatabase: import.meta.env.VITE_FLINK_DATABASE || 'public',
    cloudProvider: import.meta.env.VITE_CLOUD_PROVIDER || 'aws',
    cloudRegion: import.meta.env.VITE_CLOUD_REGION || 'us-east-1',
    schemaRegistryUrl: import.meta.env.VITE_SCHEMA_REGISTRY_URL || '',
    schemaRegistryKey: import.meta.env.VITE_SCHEMA_REGISTRY_KEY || '',
    schemaRegistrySecret: import.meta.env.VITE_SCHEMA_REGISTRY_SECRET || '',
    kafkaClusterId: import.meta.env.VITE_KAFKA_CLUSTER_ID || '',
    kafkaRestEndpoint: import.meta.env.VITE_KAFKA_REST_ENDPOINT || '',
    kafkaApiKey: import.meta.env.VITE_KAFKA_API_KEY || '',
    kafkaApiSecret: import.meta.env.VITE_KAFKA_API_SECRET || '',
  };
};

export const env = getEnv();
