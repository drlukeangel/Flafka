import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanCdcPipelineDef: KickstarterExampleDef = {
  id: 'loan-cdc-pipeline',
  tables: [
    {
      name: 'CUSTOMERS',
      schema: 'customers-latest',
      role: 'input',
      dataset: { generator: 'customers-cdc', count: 30 },
      stream: 'produce-consume',
    },
    {
      name: 'CUSTOMERS-LATEST',
      schema: 'customers-latest',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'cdc-materialize-job',
      sql: `INSERT INTO \`{CUSTOMERS-LATEST}\`
SELECT
  CAST(customer_id AS BYTES) AS \`key\`,
  customer_id, name, credit_score, state, risk_score, risk_level
FROM (
  SELECT customer_id, name, credit_score, state, risk_score, risk_level,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY $rowtime DESC) AS rownum
  FROM \`{CUSTOMERS}\`
)
WHERE rownum = 1

-- ============================================================
-- WHAT: CDC materialization — collapses multiple customer versions into the LATEST per customer_id.
-- HOW: ROW_NUMBER() partitioned by customer_id, ordered by $rowtime DESC; outer WHERE rownum = 1 keeps the newest.
-- VS DEDUP: Same ROW_NUMBER pattern but DESC instead of ASC — ASC = keep first (dedup), DESC = keep latest (CDC).
-- WHY: Source databases emit change events to Kafka (Debezium, Maxwell); this reconstructs current table state.
-- WHY CAST(customer_id AS BYTES): Output topic key column is typed BYTES.
-- GOTCHA: Flink keeps state per customer_id; configure state TTL in production to bound memory.
-- GOTCHA: New updates emit a retraction + new row in the changelog stream, superseding old output.
-- EXPECT: 30 input events collapse into fewer rows — one per customer_id with the most recent data.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{CUSTOMERS-LATEST}\` LIMIT 50

-- ============================================================
-- WHAT: Inspect materialized customers; each customer_id appears exactly once with latest data.
-- GOTCHA: Without LIMIT, Flink streams forever; LIMIT 50 stops after 50 rows.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce CDC events', detail: 'Click \u25b6 on the CUSTOMERS stream card to send 30 events with duplicate customer_ids simulating database updates.' },
      { label: 'Run the CDC materialize job', detail: 'Run the INSERT INTO cell; ROW_NUMBER DESC keeps only the latest version per customer.' },
      { label: 'View latest customers', detail: 'Run the SELECT * LIMIT 50 cell \u2014 each customer_id appears exactly once with the most recent data.' },
    ],
  },
};
