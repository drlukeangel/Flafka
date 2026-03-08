import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanRunningAggregateDef: KickstarterExampleDef = {
  id: 'loan-running-aggregate',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'RUNNING-STATS',
      schema: 'running-stats',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'running-aggregate-job',
      sql: `INSERT INTO \`{RUNNING-STATS}\`
SELECT
  CAST(CONCAT(customer_id, '-', txn_id) AS BYTES) AS \`key\`,
  customer_id, txn_id, amount, status,
  COUNT(*) OVER w AS running_count,
  SUM(amount) OVER w AS running_total,
  CAST(AVG(amount) OVER w AS DOUBLE) AS running_avg
FROM \`{LOANS}\`
WINDOW w AS (
  PARTITION BY customer_id ORDER BY $rowtime
  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)

-- ============================================================
-- WHAT: Computes running count, total, and average per customer as loans stream in.
-- HOW: OVER window with UNBOUNDED PRECEDING AND CURRENT ROW — each row shows cumulative stats up to that point.
-- WHY OVER not GROUP BY: GROUP BY collapses to one row per group; OVER keeps every row and adds the aggregate alongside.
-- WHY CAST(AVG AS DOUBLE): Flink AVG may return DECIMAL; casting to DOUBLE matches the output schema.
-- WHY CONCAT key: Composite customer_id + txn_id prevents Kafka key collisions under log compaction.
-- WHY named window: WINDOW w AS (...) avoids repeating the same OVER spec on all three aggregates.
-- GOTCHA: UNBOUNDED PRECEDING means state per customer_id never expires; configure state TTL in production.
-- EXPECT: 5 loans for C001 = 5 output rows with running_count 1..5 and growing running_total.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{RUNNING-STATS}\` LIMIT 50

-- ============================================================
-- WHAT: Inspect running stats; same customer_id appears multiple times with growing count/total.
-- TIP: Filter by customer_id to see the 1, 2, 3... progression clearly.
-- GOTCHA: Without LIMIT, Flink streams forever; LIMIT 50 stops after 50 rows.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click \u25b6 on the LOANS stream card to send 200 loan records.' },
      { label: 'Run running aggregate job', detail: 'Run the INSERT INTO cell; the OVER window computes running count, total, and average per customer.' },
      { label: 'View running stats', detail: 'Run the SELECT * LIMIT 50 cell \u2014 each row shows cumulative stats up to that point.' },
    ],
  },
};
