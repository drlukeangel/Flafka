import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanHopWindowDef: KickstarterExampleDef = {
  id: 'loan-hop-window',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-HOP-STATS',
      schema: 'loans-hop-stats',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'hop-window-job',
      sql: `INSERT INTO \`{LOANS-HOP-STATS}\`
SELECT
  CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status) AS BYTES) AS \`key\`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
  status,
  COUNT(*) AS loan_count,
  SUM(amount) AS total_amount,
  CAST(AVG(amount) AS DOUBLE) AS avg_amount
FROM TABLE(
  HOP(TABLE \`{LOANS}\`, DESCRIPTOR($rowtime), INTERVAL '10' SECOND, INTERVAL '60' SECOND)
)
GROUP BY window_start, window_end, status

-- ============================================================
-- WHAT: Groups loans into OVERLAPPING 60-second windows sliding every 10 seconds. Computes COUNT, SUM, AVG per status.
-- HOPPING WINDOW: Unlike tumble, windows overlap. Each event belongs to up to 6 windows (60s / 10s). Like a moving average.
-- WHY HOP vs TUMBLE: Tumble is spiky at boundaries. Hop smooths metrics by overlapping — rolling view of the data.
-- HOP TVF args: TABLE = input, DESCRIPTOR($rowtime) = event time, 10s = slide interval, 60s = window size.
-- WHY CAST(AVG AS DOUBLE): AVG may return DECIMAL which serializes poorly to JSON. CAST ensures clean numeric output.
-- GOTCHA: Each event generates MULTIPLE output rows (one per window it belongs to) — more output than tumble. That's expected.
-- GOTCHA: Windows emit every 10s (the slide interval). Wait at least 10s before checking output.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{LOANS-HOP-STATS}\` LIMIT 50

-- ============================================================
-- WHAT: Reads smoothed aggregate stats from LOANS-HOP-STATS — overlapping window ranges with moving-average metrics.
-- GOTCHA: Wait at least 10 seconds (the slide interval) after starting the job before running this.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click \u25b6 on the LOANS stream card to send 200 loan records.' },
      { label: 'Run the hop window job', detail: 'Run the INSERT INTO cell; the job creates overlapping 60-second windows that slide every 10 seconds.' },
      { label: 'Wait ~10 seconds', detail: 'Hop windows update every 10 seconds with a 60-second lookback.' },
      { label: 'View smoothed stats', detail: 'Run the SELECT * LIMIT 50 cell to see moving-average metrics per status.' },
    ],
  },
};
