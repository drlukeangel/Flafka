import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanSchemaOverrideDef: KickstarterExampleDef = {
  id: 'loan-schema-override',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-RETYPED',
      schema: 'loans-standard',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'drop-auto-table',
      sql: `DROP TABLE IF EXISTS \`{LOANS}\`

-- ============================================================
-- WHAT: Drop the auto-discovered Flink table so we can re-create it with computed columns and watermarks.
-- WHY: Flink doesn't support ALTER TABLE for adding computed columns or watermarks — must DROP and re-CREATE.
-- SAFE: DROP TABLE only removes Flink metadata, NOT the Kafka topic or its data. Data is preserved.
-- GOTCHA: IF EXISTS prevents errors if table was already dropped or never existed.
-- ============================================================`,
    },
    {
      label: 'create-with-watermark',
      sql: `CREATE TABLE \`{LOANS}\` (
  \`key\` VARBINARY(2147483647),
  \`loan_id\` VARCHAR(2147483647) NOT NULL,
  \`amount\` DOUBLE NOT NULL,
  \`status\` VARCHAR(2147483647) NOT NULL,
  \`created_at\` BIGINT NOT NULL,
  \`txn_id\` VARCHAR(2147483647) NOT NULL,
  \`customer_id\` VARCHAR(2147483647) NOT NULL,
  \`event_time\` AS TO_TIMESTAMP_LTZ(\`created_at\`, 3),
  WATERMARK FOR \`event_time\` AS \`event_time\` - INTERVAL '10' SECOND
) WITH (
  'connector' = 'confluent',
  'value.format' = 'avro-registry'
)

-- ============================================================
-- WHAT: Re-create LOANS table with a computed column (event_time) and a WATERMARK for event-time processing.
-- COMPUTED COLUMN: TO_TIMESTAMP_LTZ(created_at, 3) converts epoch millis to TIMESTAMP_LTZ (UTC stored, local displayed).
-- WATERMARK: Events may arrive up to 10 seconds late. Enables TUMBLE/HOP/SESSION windows, interval joins, MATCH_RECOGNIZE.
-- WHY LTZ: Stores instant in UTC but displays in session's time zone — avoids confusion across regions.
-- VARCHAR(2147483647): Flink's way of saying "unbounded string." NOT NULL rejects records missing that field.
-- GOTCHA: Computed columns are virtual — zero storage cost, recalculated on every read.
-- GOTCHA: Without WATERMARK, Flink throws "rowtime attribute not found" for any event-time operation.
-- GOTCHA: If Avro schema allows nulls but Flink says NOT NULL, null values cause runtime errors and drop rows.
-- GOTCHA: If topic uses JSON or Protobuf, change 'value.format' to 'json-registry' or 'protobuf-registry'.
-- ============================================================`,
    },
    {
      label: 'filter-high-value',
      sql: `INSERT INTO \`{LOANS-RETYPED}\`
SELECT
  CAST(\`loan_id\` AS BYTES) AS \`key\`,
  \`loan_id\`, \`amount\`, \`status\`, \`created_at\`, \`txn_id\`, \`customer_id\`
FROM \`{LOANS}\`
WHERE \`amount\` > 10000
LIMIT 50

-- ============================================================
-- WHAT: Stream routing — filter loans > $10,000 and write to a separate topic for review/compliance.
-- WHY CAST(loan_id AS BYTES): Kafka key ensures same-loan messages land on the same partition (ordering preserved).
-- LIMIT 50: Teaching safeguard — caps output so job terminates. Remove in production for continuous streaming.
-- GOTCHA: If no loans exceed $10,000, output topic stays empty. Check test data generator value ranges.
-- GOTCHA: LIMIT in a streaming INSERT INTO is unusual — most streaming jobs run indefinitely without it.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{LOANS-RETYPED}\` LIMIT 50

-- ============================================================
-- WHAT: View filtered high-value loans — all rows have amount > $10,000.
-- COLUMNS: loan_id, amount, status, created_at, txn_id, customer_id.
-- GOTCHA: At most 50 rows (due to LIMIT in the INSERT job). Fewer means fewer loans exceeded $10,000 in test data.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click the play ▶ button on the LOANS stream card to send 200 sample loan records into the LOANS topic. Watch the counter on the card to see progress.' },
      { label: 'Drop auto-discovered table', detail: 'Run the DROP TABLE cell. Why? Flink auto-discovered a basic table schema when you created the workspace, but it\'s missing our fancy features (like watermarks for event time). We\'re cleaning it up to start fresh with a better schema.' },
      { label: 'Create with watermark', detail: 'Run the CREATE TABLE cell. Notice the new features: (1) A computed column `event_time` that converts `created_at` timestamps to the right format, (2) A WATERMARK that tells Flink to expect data delays up to 10 seconds — crucial for windowed calculations!' },
      { label: 'Filter & view', detail: 'Run the INSERT INTO cell to filter loans with amount > 10000 (we only care about big loans). Then run the SELECT * cell to see your results — 50 high-value loans with timestamps and watermark info. Each row shows the loan plus when it arrived in your pipeline.' },
    ],
  },
};
