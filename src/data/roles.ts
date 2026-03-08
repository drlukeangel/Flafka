export interface Role {
  id: string;
  title: string;
  description: string;
  recommendedTrackIds: string[];
  highlightExampleIds: string[];
}

export const roles: Role[] = [
  {
    id: 'data-engineer',
    title: 'Data Engineer',
    description:
      'Build and maintain streaming data pipelines. Focus on joins, stateful processing, CDC, deduplication, and pattern matching to create robust real-time data infrastructure.',
    recommendedTrackIds: [
      'getting-started',
      'kafka-fundamentals',
      'windowing-time',
      'joins-enrichment',
      'stateful-processing',
    ],
    highlightExampleIds: [
      'loan-join',
      'loan-temporal-join',
      'loan-dedup',
      'loan-cdc-pipeline',
      'loan-pattern-match',
      'loan-running-aggregate',
    ],
  },
  {
    id: 'analytics-engineer',
    title: 'Analytics Engineer',
    description:
      'Design streaming views and real-time analytics layers. Focus on windowing, aggregations, materialized views, and building golden records for downstream consumption.',
    recommendedTrackIds: [
      'getting-started',
      'windowing-time',
      'joins-enrichment',
      'views-architecture',
    ],
    highlightExampleIds: [
      'loan-aggregate',
      'view-golden-record',
      'view-credit-risk',
      'view-early-warning',
      'view-mbs-pricing',
      'loan-time-range-stats',
    ],
  },
  {
    id: 'platform-engineer',
    title: 'Platform Engineer',
    description:
      'Manage the Confluent Cloud platform, including Kafka topics, schemas, connectors, and governance. Focus on schema evolution, compatibility modes, and infrastructure integration.',
    recommendedTrackIds: [
      'getting-started',
      'kafka-fundamentals',
      'confluent-cloud',
    ],
    highlightExampleIds: [
      'kafka-produce-consume',
      'kafka-changelog-modes',
      'kafka-value-formats',
      'loan-schemaless-topic',
      'kafka-schema-evolution',
      'confluent-connector-bridge',
    ],
  },
];
