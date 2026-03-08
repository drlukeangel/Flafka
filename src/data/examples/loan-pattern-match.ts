import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanPatternMatchDef: KickstarterExampleDef = {
  id: 'loan-pattern-match',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'PATTERN-ALERTS',
      schema: 'pattern-alerts',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'pattern-match-job',
      sql: `INSERT INTO \`{PATTERN-ALERTS}\`
SELECT CAST(customer_id AS BYTES) AS \`key\`,
  customer_id, first_txn, last_txn, app_count, total_amount,
  CAST(avg_amount AS DOUBLE) AS avg_amount, first_time, last_time
FROM \`{LOANS}\`
MATCH_RECOGNIZE (
  PARTITION BY customer_id ORDER BY $rowtime
  MEASURES
    FIRST(A.txn_id) AS first_txn, LAST(A.txn_id) AS last_txn,
    COUNT(A.txn_id) AS app_count, SUM(A.amount) AS total_amount,
    AVG(A.amount) AS avg_amount,
    FIRST(A.$rowtime) AS first_time, LAST(A.$rowtime) AS last_time
  ONE ROW PER MATCH
  AFTER MATCH SKIP PAST LAST ROW
  PATTERN (A{3,})
  DEFINE A AS TRUE
)

-- ============================================================
-- WHAT: CEP pattern match detecting 3+ consecutive loan applications per borrower.
-- HOW: MATCH_RECOGNIZE partitions by customer_id, orders by $rowtime, matches A{3,} (3+ events).
-- MEASURES: Extracts first/last txn_id, count, sum, avg amount, and time range from matched events.
-- ONE ROW PER MATCH: Emits one summary row per pattern match (vs ALL ROWS PER MATCH for debugging).
-- AFTER MATCH SKIP PAST LAST ROW: Prevents overlapping matches; next scan starts after last matched event.
-- DEFINE A AS TRUE: Every event qualifies — to filter, change to e.g. A.amount > 5000.
-- WHY CAST(avg_amount AS DOUBLE): AVG() returns DECIMAL; output schema expects DOUBLE. Mismatch = silent failure.
-- WHY CAST(customer_id AS BYTES): Kafka keys must be raw bytes for partitioning.
-- GOTCHA: $rowtime is Flink's Kafka-timestamp metadata column — cannot use a regular column without a WATERMARK.
-- GOTCHA: MATCH_RECOGNIZE is powerful but complex. Start simple and iterate.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{PATTERN-ALERTS}\` LIMIT 50

-- ============================================================
-- WHAT: View pattern match results — each row = one burst of 3+ consecutive loan apps from one customer.
-- COLUMNS: customer_id, first_txn, last_txn, app_count, total_amount, avg_amount, first_time, last_time.
-- GOTCHA: Zero rows? Pattern-match job may still be running, or no customer had 3+ consecutive events.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click \u25b6 on the LOANS stream card to send 200 loan records.' },
      { label: 'Run pattern match job', detail: 'Run the INSERT INTO cell; MATCH_RECOGNIZE detects 3+ consecutive loan applications per customer.' },
      { label: 'View pattern alerts', detail: 'Run the SELECT * LIMIT 50 cell to see burst patterns with first/last txn and totals.' },
    ],
  },
};
