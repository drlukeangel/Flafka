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
)

-- ============================================================
-- WHAT: Define a raw (schemaless) table — one VARBINARY column holding the entire Kafka message as raw bytes.
-- WHY CREATE TABLE: Topics without Schema Registry entries are invisible to auto-discovery; must be defined manually.
-- 'value.format' = 'raw': Flink does NOT deserialize — hands you raw bytes. You parse with JSON_VALUE() later.
-- 'scan.startup.mode' = 'latest-offset': Reads from NOW. Use 'earliest-offset' to replay historical data.
-- GOTCHA: Column name "val" is arbitrary, but "value" is a reserved word in some SQL dialects.
-- GOTCHA: This is Confluent Cloud syntax. Open-source Flink uses 'kafka' connector with slightly different config.
-- ============================================================`,
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
WHERE JSON_VALUE(CAST(\`val\` AS STRING), '$.event_type') IS NOT NULL

-- ============================================================
-- WHAT: Schema-on-read — parse raw JSON bytes into typed columns and write to RAW-EVENTS-PARSED.
-- HOW: CAST(val AS STRING) converts raw bytes to UTF-8, then JSON_VALUE('$.field') extracts scalars via JSONPath.
-- WHY REPEAT CAST(val AS STRING): Flink SQL on Confluent Cloud doesn't support CTEs in INSERT statements.
-- WHY EXPLICIT COLUMN LIST: Omitting it risks data landing in wrong columns if SELECT/schema order differs.
-- CAST(... AS DOUBLE/BIGINT): JSON_VALUE always returns VARCHAR — numeric fields MUST be cast to proper types.
-- WHERE ... IS NOT NULL: Quality gate — filters malformed messages (missing fields, corrupt bytes produce NULLs).
-- GOTCHA: JSON_VALUE() returns NULL silently if path doesn't exist or JSON is malformed. Data loss without WHERE filters.
-- GOTCHA: Invalid numeric CAST throws a runtime error and drops the row (or fails the job, depending on error config).
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{RAW-EVENTS-PARSED}\` LIMIT 50

-- ============================================================
-- WHAT: View parsed events — cleaned, typed output from the parse-and-filter job.
-- COLUMNS: event_id, event_type, user_id, amount (DOUBLE), currency, event_ts (BIGINT).
-- GOTCHA: Zero rows? Run steps in order: (1) CREATE TABLE, (2) parse-and-filter job, (3) produce to RAW-EVENTS.
-- ============================================================`,
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
