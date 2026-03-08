import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanCumulateWindowDef: KickstarterExampleDef = {
  id: 'loan-cumulate-window',
  tables: [
    {
      name: 'LOAN-COMMITMENTS',
      schema: 'loan-commitments',
      role: 'input',
      dataset: { generator: 'loan-commitments', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'DAILY-COMMITMENT-STATS',
      schema: 'daily-commitment-stats',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'cumulate-job',
      sql: `INSERT INTO \`{DAILY-COMMITMENT-STATS}\`
SELECT
  product_type,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
  COUNT(*) AS commitment_count,
  SUM(principal) AS total_principal,
  CAST(AVG(principal) AS DOUBLE) AS avg_principal
FROM TABLE(
  CUMULATE(TABLE \`{LOAN-COMMITMENTS}\`, DESCRIPTOR($rowtime), INTERVAL '10' SECOND, INTERVAL '1' MINUTE)
)
GROUP BY window_start, window_end, product_type

-- ============================================================
-- WHAT: CUMULATE window — expanding windows that grow from 10s up to 1 min, then reset.
-- WHY: "Today so far" dashboards — running intraday totals that reset at the boundary.
-- HOW: Step size = 10s, max size = 1 min. Each step emits a wider window.
-- GOTCHA: Output is upsert (keyed by product_type). Needs PRIMARY KEY + changelog.mode.
-- ============================================================`,
    },
    {
      label: 'view-high-volume',
      sql: `SELECT * FROM \`{DAILY-COMMITMENT-STATS}\`
WHERE total_principal > 500000
LIMIT 50

-- ============================================================
-- WHAT: Action query — find commitment windows where total principal exceeds $500K.
-- WHY: High-volume windows may signal unusual activity or market surges.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your CUMULATE window workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce commitment data', detail: 'Click the play button on the LOAN-COMMITMENTS stream card to send 200 records.' },
      { label: 'Run the CUMULATE job', detail: 'Run the INSERT INTO cell to start the expanding window aggregation.' },
      { label: 'Wait for windows to emit', detail: 'Let a few 10-second steps complete so windows expand.' },
      { label: 'View high-volume windows', detail: 'Run the SELECT query to see windows where total principal > $500K.' },
    ],
  },
};
