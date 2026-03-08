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
WHERE status = 'APPROVED'

-- ============================================================
-- WHAT: Continuous job that filters LOANS for status = 'APPROVED', writes matches to LOANS-FILTERED.
-- WHY CAST(loan_id AS BYTES): Kafka keys must be raw bytes. Same loan_id = same partition = ordering guarantee.
-- WHY explicit columns: Output table expects specific columns in order. SELECT * would fail on schema mismatch.
-- GOTCHA: Job runs FOREVER. String comparisons are CASE-SENSITIVE. Wait for data to flow before checking output.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{LOANS-FILTERED}\` LIMIT 50

-- ============================================================
-- WHAT: Reads from the LOANS-FILTERED output topic to verify only APPROVED loans made it through.
-- WHY LIMIT 50: Only a fraction of 200 loans will be APPROVED. 50 is a reasonable sample cap.
-- GOTCHA: Run the INSERT INTO job and produce data FIRST — output topic is empty until the filter processes data.
-- ============================================================`,
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
