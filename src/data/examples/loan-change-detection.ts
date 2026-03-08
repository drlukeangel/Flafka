import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanChangeDetectionDef: KickstarterExampleDef = {
  id: 'loan-change-detection',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'STATUS-CHANGES',
      schema: 'status-changes',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'change-detection-job',
      sql: `INSERT INTO \`{STATUS-CHANGES}\`
SELECT
  CAST(CONCAT(customer_id, '-', txn_id) AS BYTES) AS \`key\`,
  customer_id, txn_id, loan_id, amount,
  prev_status,
  status AS current_status,
  prev_amount, amount - prev_amount AS amount_change
FROM (
  SELECT customer_id, txn_id, loan_id, amount, status,
    LAG(status) OVER w AS prev_status,
    LAG(amount) OVER w AS prev_amount
  FROM \`{LOANS}\`
  WINDOW w AS (PARTITION BY customer_id ORDER BY $rowtime)
)
WHERE prev_status IS NOT NULL AND prev_status <> status

-- ============================================================
-- WHAT: Detects status changes between consecutive loan events per customer.
-- HOW: LAG(status) OVER w gets the previous row's status; outer WHERE keeps only rows where status actually changed.
-- WHY LAG not self-join: LAG() is the idiomatic, efficient way to access the previous row in a partition.
-- WHY PARTITION BY customer_id: Each customer's events are compared independently; without it LAG crosses customers.
-- WHY IS NOT NULL check: LAG returns NULL for the first event per customer (no predecessor); <> NULL evaluates to NULL, not TRUE.
-- WHY named window: Both LAG(status) and LAG(amount) share the same partition/order spec.
-- GOTCHA: Flink keeps state per customer_id; configure state TTL in production.
-- EXPECT: Only rows where status transitioned (e.g., PENDING -> APPROVED) with amount_change showing the dollar shift.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{STATUS-CHANGES}\` LIMIT 50

-- ============================================================
-- WHAT: Inspect detected status changes; each row is a prev_status -> current_status transition.
-- TIP: Fewer rows than input is normal — only actual status transitions are captured.
-- GOTCHA: Without LIMIT, Flink streams forever; LIMIT 50 stops after 50 rows.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click \u25b6 on the LOANS stream card to send 200 loan records.' },
      { label: 'Run change detection job', detail: 'Run the INSERT INTO cell; LAG() compares each event to its predecessor per customer.' },
      { label: 'View status changes', detail: 'Run the SELECT * LIMIT 50 cell \u2014 only rows where status actually changed appear.' },
    ],
  },
};
