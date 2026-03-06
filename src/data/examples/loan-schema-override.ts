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
      sql: `DROP TABLE IF EXISTS \`{LOANS}\``,
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
)`,
    },
    {
      label: 'filter-high-value',
      sql: `INSERT INTO \`{LOANS-RETYPED}\`
SELECT
  CAST(\`loan_id\` AS BYTES) AS \`key\`,
  \`loan_id\`, \`amount\`, \`status\`, \`created_at\`, \`txn_id\`, \`customer_id\`
FROM \`{LOANS}\`
WHERE \`amount\` > 10000
LIMIT 50`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{LOANS-RETYPED}` LIMIT 50',
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
