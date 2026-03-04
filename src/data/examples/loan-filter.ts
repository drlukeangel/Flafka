import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanFilterDef: KickstarterExampleDef = {
  id: 'loan-filter',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-FILTERED',
      schema: 'loans-filtered',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'filter-job',
      sql: `INSERT INTO \`{LOANS-FILTERED}\`
SELECT CAST(loan_id AS BYTES) AS \`key\`, loan_id, amount, status, created_at, txn_id, customer_id
FROM \`{LOANS}\`
WHERE status = 'APPROVED'`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{LOANS-FILTERED}` LIMIT 50',
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click ▶ on the LOANS stream card to send 200 loan records.' },
      { label: 'Run the filter job', detail: 'Run the INSERT INTO cell; approved loans start flowing to LOANS-FILTERED.' },
      { label: 'View output', detail: 'Run the SELECT * LIMIT 50 cell to see filtered results.' },
    ],
  },
};
