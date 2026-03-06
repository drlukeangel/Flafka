import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanDedupDef: KickstarterExampleDef = {
  id: 'loan-dedup',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-DEDUPED',
      schema: 'loans-deduped',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'dedup-job',
      sql: `INSERT INTO \`{LOANS-DEDUPED}\`
SELECT \`key\`, loan_id, amount, status, created_at, txn_id, customer_id
FROM (
  SELECT
    CAST(loan_id AS BYTES) AS \`key\`,
    loan_id, amount, status, created_at, txn_id, customer_id,
    ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY $rowtime ASC) AS rownum
  FROM \`{LOANS}\`
)
WHERE rownum = 1`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{LOANS-DEDUPED}` LIMIT 50',
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click \u25b6 on the LOANS stream card to send 200 loan records (some duplicates included).' },
      { label: 'Run the dedup job', detail: 'Run the INSERT INTO cell; ROW_NUMBER keeps only the first event per loan_id.' },
      { label: 'View output', detail: 'Run the SELECT * LIMIT 50 cell to see deduplicated results.' },
    ],
  },
};
