import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanAggregateDef: KickstarterExampleDef = {
  id: 'loan-aggregate',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-STATS',
      schema: 'loans-stats',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'aggregate-job',
      sql: `INSERT INTO \`{LOANS-STATS}\`
SELECT
  CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status) AS BYTES) AS \`key\`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
  status,
  COUNT(*) AS loan_count,
  SUM(amount) AS total_amount
FROM TABLE(
  TUMBLE(TABLE \`{LOANS}\`, DESCRIPTOR($rowtime), INTERVAL '20' SECOND)
)
GROUP BY window_start, window_end, status

-- ============================================================
-- WHAT: Groups loans into fixed 20-second tumbling windows, computes COUNT and SUM per status per window.
-- TUMBLING WINDOW: Non-overlapping time buckets. Each event belongs to exactly one window.
-- WHY TUMBLE TVF: TABLE = input, DESCRIPTOR($rowtime) = Kafka event time, INTERVAL = window size.
-- WHY DATE_FORMAT: Converts TIMESTAMP to readable strings for JSON output. Without it, you get epoch millis.
-- WHY composite key: CONCAT(window_start, status) ensures unique Kafka key per (window, status) for compaction.
-- GOTCHA: Windows emit only AFTER they close — wait 20s. GROUP BY must include BOTH window_start and window_end.
-- GOTCHA: $rowtime = Kafka message timestamp, not wall clock. Bulk-produced records may all land in one window.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{LOANS-STATS}\` LIMIT 50

-- ============================================================
-- WHAT: Reads aggregated stats from LOANS-STATS — loan counts and totals per window per status.
-- GOTCHA: Wait ~20 seconds for the first tumbling window to close before running this.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click ▶ on the LOANS stream card to send 200 loan records.' },
      { label: 'Run the aggregate job', detail: 'Run the INSERT INTO cell; the job starts windowing by status.' },
      { label: 'Wait ~20 seconds', detail: 'Tumbling windows emit on a 20-second cadence; wait for the first window to close.' },
      { label: 'View stats', detail: 'Run the SELECT * LIMIT 50 cell to see window_start, loan_count, total_amount per status.' },
    ],
  },
};
