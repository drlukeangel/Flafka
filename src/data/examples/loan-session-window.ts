import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanSessionWindowDef: KickstarterExampleDef = {
  id: 'loan-session-window',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-SESSIONS',
      schema: 'loans-sessions',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'session-window-job',
      sql: `INSERT INTO \`{LOANS-SESSIONS}\`
SELECT
  CAST(CONCAT(customer_id, '-', DATE_FORMAT(session_start, 'yyyy-MM-dd HH:mm:ss')) AS BYTES) AS \`key\`,
  customer_id,
  DATE_FORMAT(session_start, 'yyyy-MM-dd HH:mm:ss') AS session_start,
  DATE_FORMAT(session_end, 'yyyy-MM-dd HH:mm:ss') AS session_end,
  COUNT(*) AS loan_count,
  SUM(amount) AS total_amount,
  CAST(AVG(amount) AS DOUBLE) AS avg_amount
FROM \`{LOANS}\`
GROUP BY customer_id, SESSION($rowtime, INTERVAL '30' SECOND)`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{LOANS-SESSIONS}` LIMIT 50',
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click \u25b6 on the LOANS stream card to send 200 loan records.' },
      { label: 'Run session window job', detail: 'Run the INSERT INTO cell; the job groups loan applications by customer activity bursts with a 30-second gap.' },
      { label: 'Wait ~30 seconds', detail: 'Sessions close when the idle gap exceeds 30 seconds.' },
      { label: 'View sessions', detail: 'Run the SELECT * LIMIT 50 cell to see session aggregates per customer.' },
    ],
  },
};
