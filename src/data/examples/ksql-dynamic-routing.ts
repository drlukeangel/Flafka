import type { KickstarterExampleDef } from '../../services/example-runner';

export const ksqlDynamicRoutingDef: KickstarterExampleDef = {
  id: 'ksql-dynamic-routing',
  tables: [
    {
      name: 'ROUTING-RULES',
      schema: 'routing-rules-array',
      role: 'input',
      dataset: { generator: 'routing-rules-array-dynamic', count: 5 },
      stream: 'produce-consume',
    },
    {
      name: 'LOAN-EVENTS',
      schema: 'loan-events-dept',
      role: 'input',
      dataset: { generator: 'loan-events-dept', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'ROUTED-EVENTS',
      schema: 'routed-events-sink',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'UNDERWRITING',
      schema: 'routed-events-dept',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'FINANCE',
      schema: 'routed-events-dept',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'COLLECTIONS',
      schema: 'routed-events-dept',
      role: 'output',
      stream: 'consume',
    },
  ],
  sql: [
    {
      label: 'register-events',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{LOAN-EVENTS}\` (
  \`event_id\` STRING,
  \`loan_id\` STRING,
  \`event_type\` STRING,
  \`amount\` DOUBLE,
  \`created_at\` STRING,
  \`department\` STRING
) WITH (
  KAFKA_TOPIC = '{LOAN-EVENTS}',
  VALUE_FORMAT = 'AVRO'
);

-- ============================================================
-- Register the LOAN-EVENTS Kafka topic as a ksqlDB STREAM.
-- Column names are backtick-quoted to preserve lowercase —
-- this matches the Avro field names Flink registered in
-- Schema Registry. Without backticks, ksqlDB uppercases
-- identifiers and Avro deserialization returns NULLs.
-- ============================================================`,
    },
    {
      label: 'register-rules-stream',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{ROUTING-RULES}\` (
  \`key_data\` STRUCT<event_type STRING> KEY,
  \`target_topics\` ARRAY<STRING>,
  \`updated_at\` STRING
) WITH (
  KAFKA_TOPIC = '{ROUTING-RULES}',
  KEY_FORMAT = 'AVRO',
  VALUE_FORMAT = 'AVRO',
  KEY_SCHEMA_FULL_NAME = 'RoutingRulesKey'
);

-- ============================================================
-- Register routing rules. Two Flink-to-ksqlDB compatibility
-- issues solved here:
--
-- 1. STRUCT KEY: Flink wraps PRIMARY KEY columns in an Avro
--    record struct. ksqlDB STRING KEY expects a bare string.
--    Fix: STRUCT<event_type STRING> KEY matches the wrapper.
--
-- 2. KEY_SCHEMA_FULL_NAME: ksqlDB auto-generates an Avro record
--    name from the stream name. Hyphenated topic names produce
--    illegal Avro identifiers. This overrides the generated name.
--
-- We extract event_type with key_data->event_type below.
-- ============================================================`,
    },
    {
      label: 'materialize-rules-table',
      engine: 'ksqldb',
      sql: `CREATE TABLE \`{ROUTING-RULES}-table\` AS
SELECT
  \`key_data\`->event_type AS \`event_type\`,
  LATEST_BY_OFFSET(\`target_topics\`) AS \`target_topics\`
FROM \`{ROUTING-RULES}\`
GROUP BY \`key_data\`->event_type
EMIT CHANGES;

-- ============================================================
-- LATEST_BY_OFFSET keeps only the most recent rule per event_type,
-- giving us a materialized TABLE keyed by event_type. We extract
-- event_type from the STRUCT key using key_data->event_type.
-- This is ksqlDB's equivalent of Flink's changelog.mode = 'upsert'.
-- Upsert a new routing rule → the TABLE updates automatically.
-- ============================================================`,
    },
    {
      label: 'explode-routing-engine',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{ROUTED-EVENTS}\`
WITH (KAFKA_TOPIC = '{ROUTED-EVENTS}', VALUE_FORMAT = 'AVRO')
AS SELECT
  e.\`event_id\` AS \`event_id\`,
  EXPLODE(r.\`target_topics\`) AS \`target_topic\`,
  e.\`loan_id\` AS \`loan_id\`,
  e.\`event_type\` AS \`event_type\`,
  e.\`amount\` AS \`amount\`,
  e.\`department\` AS \`department\`
FROM \`{LOAN-EVENTS}\` e
  INNER JOIN \`{ROUTING-RULES}-table\` r
  ON e.\`event_type\` = r.\`event_type\`
EMIT CHANGES;

-- ============================================================
-- ROUTING ENGINE — the ksqlDB equivalent of Flink's CROSS JOIN UNNEST.
--
-- EXPLODE(array) produces one output row per array element.
-- Stream-table join is temporal by default in ksqlDB — no
-- FOR SYSTEM_TIME AS OF needed. Same fan-out pattern:
-- NEW_LOAN → 2 rows (underwriting + finance).
--
-- Output writes directly to the ROUTED-EVENTS topic.
-- The stream card below proves the fan-out: target_topic shows
-- which department each event was routed to.
--
-- Compare:
--   Flink:  CROSS JOIN UNNEST(r.target_topics) AS t(target_topic)
--   ksqlDB: EXPLODE(r.target_topics) AS target_topic
--
-- DYNAMIC: Upsert a routing rule to add/remove targets and events
-- start flowing differently immediately — this query never changes.
-- ============================================================`,
    },
    {
      label: 'route-underwriting',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{UNDERWRITING}\`
WITH (KAFKA_TOPIC = '{UNDERWRITING}', VALUE_FORMAT = 'AVRO')
AS SELECT \`event_id\`, \`loan_id\`, \`event_type\`, \`amount\`, \`department\`
FROM \`{ROUTED-EVENTS}\`
WHERE \`target_topic\` = '{UNDERWRITING}'
EMIT CHANGES;

-- ============================================================
-- Deliver underwriting events to the UNDERWRITING topic.
-- The routing DECISION was made by the EXPLODE + rules table.
-- This is just the delivery step — same pattern in Flink.
-- ============================================================`,
    },
    {
      label: 'route-finance',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{FINANCE}\`
WITH (KAFKA_TOPIC = '{FINANCE}', VALUE_FORMAT = 'AVRO')
AS SELECT \`event_id\`, \`loan_id\`, \`event_type\`, \`amount\`, \`department\`
FROM \`{ROUTED-EVENTS}\`
WHERE \`target_topic\` = '{FINANCE}'
EMIT CHANGES;

-- ============================================================
-- Deliver finance events. NEW_LOAN appears here AND in
-- underwriting — same event, two destinations, driven by
-- the routing rules metadata.
-- ============================================================`,
    },
    {
      label: 'route-collections',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{COLLECTIONS}\`
WITH (KAFKA_TOPIC = '{COLLECTIONS}', VALUE_FORMAT = 'AVRO')
AS SELECT \`event_id\`, \`loan_id\`, \`event_type\`, \`amount\`, \`department\`
FROM \`{ROUTED-EVENTS}\`
WHERE \`target_topic\` = '{COLLECTIONS}'
EMIT CHANGES;

-- ============================================================
-- Deliver collections events. To add PAYMENT here: upsert the
-- PAYMENT routing rule to include 'collections' in its
-- target_topics array. This SQL never changes.
-- ============================================================`,
    },
    {
      label: 'verify-fan-out',
      engine: 'ksqldb',
      sql: `SELECT \`target_topic\`, \`event_type\`, COUNT(*) AS \`event_count\`
FROM \`{ROUTED-EVENTS}\`
GROUP BY \`target_topic\`, \`event_type\`
EMIT CHANGES;

-- ============================================================
-- PROOF: Total output rows > input rows = fan-out is working.
-- NEW_LOAN appears under both the underwriting and finance topics.
-- target_topic values are actual Kafka topic names from the
-- routing rules metadata — not hardcoded department labels.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your ksqlDB dynamic routing workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce routing rules', detail: 'Click play on ROUTING-RULES FIRST to seed event-type-to-topics mappings.' },
      { label: 'Register input streams', detail: 'Run the first two CREATE STREAM cells to register the input topics with ksqlDB.' },
      { label: 'Materialize rules', detail: 'Run the CREATE TABLE cell — this builds a materialized lookup table from the rules stream.' },
      { label: 'Produce events', detail: 'Click play on LOAN-EVENTS to send 200 lifecycle events.' },
      { label: 'Run the routing engine', detail: 'Run the EXPLODE cell — the stream-table join + EXPLODE fans each event to the ROUTED-EVENTS topic.' },
      { label: 'Route to departments', detail: 'Run the 3 route cells — each delivers filtered events to a department topic.' },
      { label: 'Observe fan-out', detail: 'Watch the department stream cards. NEW_LOAN appears in both underwriting and finance — one event, two destinations, driven by the rules table.' },
    ],
  },
};
