import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanTopNDef: KickstarterExampleDef = {
  id: 'loan-top-n',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-TOP3',
      schema: 'loans-top3',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'top-n-job',
      sql: `INSERT INTO \`{LOANS-TOP3}\`
SELECT \`key\`, window_start, window_end, loan_id, amount, status, txn_id, customer_id, rank_num
FROM (
  SELECT
    CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status, '-', CAST(rownum AS STRING)) AS BYTES) AS \`key\`,
    DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
    DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
    loan_id, amount, status, txn_id, customer_id, rownum AS rank_num
  FROM (
    SELECT window_start, window_end, loan_id, amount, status, txn_id, customer_id,
      ROW_NUMBER() OVER (PARTITION BY window_start, window_end, status ORDER BY amount DESC) AS rownum
    FROM TABLE(
      TUMBLE(TABLE \`{LOANS}\`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
    )
  )
  WHERE rownum <= 3
)`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{LOANS-TOP3}` LIMIT 50',
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click \u25b6 on the LOANS stream card to send 200 loan records.' },
      { label: 'Run the Top-N job', detail: 'Run the INSERT INTO cell; the job ranks loans by amount within 30-second windows.' },
      { label: 'Wait ~30 seconds', detail: 'Windows emit when they close; wait for the first 30-second window to complete.' },
      { label: 'View rankings', detail: 'Run the SELECT * LIMIT 50 cell to see the top 3 loans per status per window.' },
    ],
  },
};
