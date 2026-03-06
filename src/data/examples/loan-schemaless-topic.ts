import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanSchemalessTopicDef: KickstarterExampleDef = {
  id: 'loan-schemaless-topic',
  tables: [
    {
      name: 'RAW-EVENTS',
      schema: 'raw-events',
      role: 'input',
      dataset: { generator: 'raw-json-events', count: 50 },
      stream: 'produce-consume',
    },
    {
      name: 'RAW-EVENTS-PARSED',
      schema: 'raw-events-parsed',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'create-raw-table',
      sql: `CREATE TABLE IF NOT EXISTS \`{RAW-EVENTS}\` (
  \`val\` VARBINARY
) WITH (
  'connector' = 'confluent',
  'scan.startup.mode' = 'latest-offset',
  'value.format' = 'raw'
)`,
    },
    {
      label: 'parse-and-filter',
      sql: `INSERT INTO \`{RAW-EVENTS-PARSED}\` (
  \`key\`, event_id, event_type, user_id, amount, currency, event_ts
)
SELECT
  CAST(JSON_VALUE(CAST(\`val\` AS STRING), '$.event_id') AS BYTES) AS \`key\`,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.event_id') AS event_id,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.event_type') AS event_type,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.user_id') AS user_id,
  CAST(JSON_VALUE(CAST(\`val\` AS STRING), '$.amount') AS DOUBLE) AS amount,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.currency') AS currency,
  CAST(JSON_VALUE(CAST(\`val\` AS STRING), '$.timestamp') AS BIGINT) AS event_ts
FROM \`{RAW-EVENTS}\`
WHERE JSON_VALUE(CAST(\`val\` AS STRING), '$.event_type') IS NOT NULL`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{RAW-EVENTS-PARSED}` LIMIT 50',
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click the play ▶ button on the RAW-EVENTS stream card to send 50 sample JSON events to Kafka. These will flow into your Flink job for processing.' },
      { label: 'Create raw table', detail: 'Run the first SQL cell (labeled "create-raw-table"). This tells Flink: "Listen to RAW-EVENTS topic and treat each message as raw bytes. I\'ll handle the JSON parsing myself." The magic keyword is value.format=\'raw\' — it means "don\'t use a schema, just give me the raw data."' },
      { label: 'Parse & filter events', detail: 'Run the second SQL cell (labeled "parse-and-filter"). This one EXTRACTS the JSON fields using JSON_VALUE() — think of it as a Swiss Army knife for JSON. It also filters out empty values (WHERE ... IS NOT NULL means "only keep rows with actual data").' },
      { label: 'View output', detail: 'Run the third SQL cell (labeled "view-output") to see your results! You should see 50 rows of nicely parsed, typed data — events with event_id, user_id, amount, etc. Success!' },
    ],
  },
};
