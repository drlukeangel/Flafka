import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanTimeRangeStatsDef: KickstarterExampleDef = {
  id: 'loan-time-range-stats',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOAN-VELOCITY-STATS',
      schema: 'loan-velocity-stats',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'over-range-job',
      sql: `INSERT INTO \`{LOAN-VELOCITY-STATS}\`
SELECT
  customer_id,
  txn_id,
  loan_id,
  amount,
  COUNT(*) OVER w AS window_loan_count,
  SUM(amount) OVER w AS window_total_amount,
  CAST(AVG(amount) OVER w AS DOUBLE) AS window_avg_amount
FROM \`{LOANS}\`
WINDOW w AS (
  PARTITION BY customer_id
  ORDER BY $rowtime
  RANGE BETWEEN INTERVAL '5' MINUTE PRECEDING AND CURRENT ROW
)

-- ============================================================
-- WHAT: OVER window with RANGE BETWEEN — time-based sliding window per customer.
-- WHY: "How many loans has this customer applied for in the last 5 minutes?"
--      Perfect for velocity checks and rapid-fire application detection.
-- HOW: RANGE BETWEEN is time-based (unlike ROWS BETWEEN which is count-based).
--      Each row gets a running aggregate over the preceding 5 minutes of events.
-- GOTCHA: RANGE requires ORDER BY on a time attribute ($rowtime).
-- ============================================================`,
    },
    {
      label: 'find-velocity-spikes',
      sql: `SELECT * FROM \`{LOAN-VELOCITY-STATS}\`
WHERE window_loan_count >= 3
LIMIT 50

-- ============================================================
-- WHAT: Finds customers with 3+ loan applications in a 5-minute window.
-- WHY: Rapid-fire applications may indicate fraud or automated abuse.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your OVER RANGE window workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce loan data', detail: 'Click the play button on the LOANS stream card to send 200 records.' },
      { label: 'Run the OVER RANGE job', detail: 'Run the INSERT INTO cell to compute per-customer velocity stats.' },
      { label: 'Find velocity spikes', detail: 'Run the SELECT query to find customers with 3+ applications in 5 minutes.' },
    ],
  },
};
