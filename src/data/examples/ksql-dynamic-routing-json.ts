import type { KickstarterExampleDef } from '../../services/example-runner';

/**
 * ksqlDB Dynamic Event Routing — JSON Format
 *
 * Same dynamic routing pipeline as the Avro variant (ksql-dynamic-routing),
 * but uses JSON serialization instead of Avro. This makes the example
 * significantly simpler:
 *
 *   - VALUE_FORMAT = 'JSON' — human-readable, no Schema Registry required
 *   - No STRUCT KEY — JSON doesn't wrap PRIMARY KEYs in Avro record structs
 *   - No KEY_SCHEMA_FULL_NAME — not needed without Avro key encoding
 *   - event_type lives in the VALUE, not the KEY — simpler column extraction
 *
 * Topics are created as raw Kafka topics (type: 'topic') so no Avro schemas
 * get registered in Schema Registry. The StreamCard producer detects the
 * missing schema and falls back to JSON production automatically.
 *
 * Pipeline:
 *   loan-events ─┐
 *                 ├─ EXPLODE + stream-table join ─→ routed-events ─→ underwriting
 *   routing-rules─┘                                                ─→ finance
 *                                                                  ─→ collections
 *
 * Compare with ksql-dynamic-routing (Avro) to see the format differences.
 */
export const ksqlDynamicRoutingJsonDef: KickstarterExampleDef = {
  id: 'ksql-dynamic-routing-json',
  tables: [
    // ── INPUT TABLES ──────────────────────────────────────────────────────
    // type: 'topic' creates bare Kafka topics via REST API (no Flink DDL,
    // no Schema Registry). This is what makes JSON production possible —
    // StreamCard checks Schema Registry, finds nothing, falls back to JSON.
    {
      name: 'ROUTING-RULES',
      schema: 'view',     // Not used — type: 'topic' skips DDL resolution
      type: 'topic',      // Raw Kafka topic, no Avro schema registered
      role: 'input',
      dataset: { generator: 'routing-rules-array-dynamic', count: 5 },
      stream: 'produce-consume',
    },
    {
      name: 'LOAN-EVENTS',
      schema: 'view',
      type: 'topic',
      role: 'input',
      dataset: { generator: 'loan-events-dept', count: 200 },
      stream: 'produce-consume',
    },
    // ── OUTPUT TABLES ─────────────────────────────────────────────────────
    // type: 'topic' creates the topics ahead of time so stream cards can
    // start consuming immediately. ksqlDB's CSAS will write to these
    // pre-existing topics.
    {
      name: 'ROUTED-EVENTS',
      schema: 'view',
      type: 'topic',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'UNDERWRITING',
      schema: 'view',
      type: 'topic',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'FINANCE',
      schema: 'view',
      type: 'topic',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'COLLECTIONS',
      schema: 'view',
      type: 'topic',
      role: 'output',
      stream: 'consume',
    },
  ],
  sql: [
    // ── CELL 1: Register loan events stream ───────────────────────────────
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
  VALUE_FORMAT = 'JSON'
);

-- ============================================================
-- Register the LOAN-EVENTS topic as a ksqlDB STREAM.
--
-- VALUE_FORMAT = 'JSON': Data is stored as human-readable JSON
-- on the wire. No Schema Registry schema is required — ksqlDB
-- reads raw JSON and maps fields by name.
--
-- Compare with the Avro variant which uses VALUE_FORMAT = 'AVRO'
-- and requires backtick-quoting to match Avro field names. We
-- still backtick-quote here because ksqlDB uppercases unquoted
-- identifiers (EVENT_ID), but JSON field names are lowercase
-- (event_id). Without backticks, all values would be NULL.
-- ============================================================`,
    },
    // ── CELL 2: Register routing rules stream ─────────────────────────────
    {
      label: 'register-rules',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{ROUTING-RULES}\` (
  \`event_type\` STRING,
  \`target_topics\` ARRAY<STRING>,
  \`updated_at\` STRING
) WITH (
  KAFKA_TOPIC = '{ROUTING-RULES}',
  VALUE_FORMAT = 'JSON'
);

-- ============================================================
-- Register routing rules as a ksqlDB STREAM. This is MUCH
-- simpler than the Avro variant! Two key differences:
--
-- 1. NO STRUCT KEY: With Avro, Flink wraps PRIMARY KEY columns
--    in an Avro record struct, requiring:
--      STRUCT<event_type STRING> KEY
--    With JSON, event_type is just a VALUE column — no struct
--    wrapping to deal with.
--
-- 2. NO KEY_SCHEMA_FULL_NAME: Avro requires overriding the
--    auto-generated Avro record name for hyphenated topics
--    (which produce illegal Avro identifiers). JSON doesn't
--    use Schema Registry for keys, so this isn't needed.
--
-- This is a key advantage of JSON: simpler schema handling
-- at the cost of no schema enforcement on the wire.
-- ============================================================`,
    },
    // ── CELL 3: Materialize rules into a lookup table ─────────────────────
    {
      label: 'materialize-rules-table',
      engine: 'ksqldb',
      sql: `CREATE TABLE \`{ROUTING-RULES}-table\` AS
SELECT
  \`event_type\`,
  LATEST_BY_OFFSET(\`target_topics\`) AS \`target_topics\`
FROM \`{ROUTING-RULES}\`
GROUP BY \`event_type\`
EMIT CHANGES;

-- ============================================================
-- Materialize routing rules into a TABLE for lookup.
--
-- LATEST_BY_OFFSET keeps only the most recent rule per
-- event_type, giving us a live lookup table. This is ksqlDB's
-- equivalent of Flink's changelog.mode = 'upsert'.
--
-- Compare with Avro variant:
--   Avro:  GROUP BY \`key_data\`->event_type  (extract from STRUCT KEY)
--   JSON:  GROUP BY \`event_type\`            (direct VALUE column)
--
-- The JSON version is simpler because event_type is a regular
-- VALUE column, not wrapped in an Avro key struct.
--
-- DYNAMIC: Upsert a routing rule by producing a new record
-- with the same event_type. The TABLE updates automatically
-- and the routing engine starts routing differently.
-- ============================================================`,
    },
    // ── CELL 4: Routing engine — EXPLODE + stream-table join ──────────────
    {
      label: 'explode-routing-engine',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{ROUTED-EVENTS}\`
WITH (KAFKA_TOPIC = '{ROUTED-EVENTS}', VALUE_FORMAT = 'JSON')
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
-- ROUTING ENGINE — fans each event to one or more departments.
--
-- EXPLODE(array) is ksqlDB's equivalent of Flink's
-- CROSS JOIN UNNEST. It produces one output row per array
-- element. For example:
--   NEW_LOAN -> target_topics = [underwriting, finance]
--   EXPLODE produces 2 rows: one for underwriting, one for finance.
--
-- Stream-table join is temporal by default in ksqlDB — no
-- FOR SYSTEM_TIME AS OF needed (unlike Flink).
--
-- Compare:
--   Flink:  CROSS JOIN UNNEST(r.target_topics) AS t(target_topic)
--   ksqlDB: EXPLODE(r.target_topics) AS target_topic
--
-- The output writes to ROUTED-EVENTS in JSON format. Watch the
-- stream card to see the fan-out: each event now has a
-- target_topic column showing its destination.
--
-- DYNAMIC: Change a routing rule -> events start flowing to
-- different destinations immediately. This SQL never changes.
-- ============================================================`,
    },
    // ── CELL 5: Route underwriting events ─────────────────────────────────
    {
      label: 'route-underwriting',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{UNDERWRITING}\`
WITH (KAFKA_TOPIC = '{UNDERWRITING}', VALUE_FORMAT = 'JSON')
AS SELECT \`event_id\`, \`loan_id\`, \`event_type\`, \`amount\`, \`department\`
FROM \`{ROUTED-EVENTS}\`
WHERE \`target_topic\` = '{UNDERWRITING}'
EMIT CHANGES;

-- ============================================================
-- Filter routed events to the UNDERWRITING department topic.
-- NEW_LOAN events appear here (and also in finance — fan-out).
-- The WHERE clause matches the target_topic set by EXPLODE.
-- ============================================================`,
    },
    // ── CELL 6: Route finance events ──────────────────────────────────────
    {
      label: 'route-finance',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{FINANCE}\`
WITH (KAFKA_TOPIC = '{FINANCE}', VALUE_FORMAT = 'JSON')
AS SELECT \`event_id\`, \`loan_id\`, \`event_type\`, \`amount\`, \`department\`
FROM \`{ROUTED-EVENTS}\`
WHERE \`target_topic\` = '{FINANCE}'
EMIT CHANGES;

-- ============================================================
-- Finance receives: NEW_LOAN, PAYMENT, MODIFICATION.
-- NEW_LOAN appears in BOTH underwriting and finance — one
-- event, two destinations, driven by the routing rules table.
-- ============================================================`,
    },
    // ── CELL 7: Route collections events ──────────────────────────────────
    {
      label: 'route-collections',
      engine: 'ksqldb',
      sql: `CREATE STREAM \`{COLLECTIONS}\`
WITH (KAFKA_TOPIC = '{COLLECTIONS}', VALUE_FORMAT = 'JSON')
AS SELECT \`event_id\`, \`loan_id\`, \`event_type\`, \`amount\`, \`department\`
FROM \`{ROUTED-EVENTS}\`
WHERE \`target_topic\` = '{COLLECTIONS}'
EMIT CHANGES;

-- ============================================================
-- Collections receives: FORECLOSURE, TERMINATION.
-- To add PAYMENT here: produce a new routing rule with
-- target_topics = ['finance', 'collections'] for PAYMENT.
-- No SQL changes needed — just upsert the rule.
-- ============================================================`,
    },
    // ── CELL 8: Verify fan-out counts ─────────────────────────────────────
    {
      label: 'verify-fan-out',
      engine: 'ksqldb',
      sql: `SELECT \`target_topic\`, \`event_type\`, COUNT(*) AS \`event_count\`
FROM \`{ROUTED-EVENTS}\`
GROUP BY \`target_topic\`, \`event_type\`
EMIT CHANGES;

-- ============================================================
-- PROOF: Total output rows > input rows = fan-out is working.
-- NEW_LOAN appears under both underwriting and finance topics.
-- Compare counts with the Avro variant — they should match
-- exactly (same routing rules, same event distribution).
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your ksqlDB JSON routing workspace is ready. Follow these steps:',
    steps: [
      { label: 'Register source streams', detail: 'Run the first two CREATE STREAM cells to register LOAN-EVENTS and ROUTING-RULES with ksqlDB using JSON format.' },
      { label: 'Produce routing rules', detail: 'Click play on ROUTING-RULES to seed event-type-to-topics mappings as JSON data.' },
      { label: 'Materialize rules', detail: 'Run the CREATE TABLE cell — this builds a materialized lookup table from the rules stream.' },
      { label: 'Produce events', detail: 'Click play on LOAN-EVENTS to send 200 lifecycle events in JSON format.' },
      { label: 'Run the routing engine', detail: 'Run the EXPLODE cell — the stream-table join + EXPLODE fans each event to the ROUTED-EVENTS topic.' },
      { label: 'Route to departments', detail: 'Run the 3 route cells — each delivers filtered events to a department topic.' },
      { label: 'Observe fan-out', detail: 'Watch the department stream cards. NEW_LOAN appears in both underwriting and finance — one event, two destinations. Data is human-readable JSON on the wire!' },
    ],
  },
};
