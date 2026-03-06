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
SELECT CAST(CONCAT(customer_id, '-', txn_id) AS BYTES) AS \`key\`,
  customer_id, txn_id, amount, status,
  COUNT(*) OVER w AS running_count,
  SUM(amount) OVER w AS running_total,
  CAST(AVG(amount) OVER w AS DOUBLE) AS running_avg
FROM \`{LOANS}\`
WINDOW w AS (
  PARTITION BY customer_id ORDER BY $rowtime
  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{RUNNING-STATS}` LIMIT 50',
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
