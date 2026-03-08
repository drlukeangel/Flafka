import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanCoborrowerUnnestDef: KickstarterExampleDef = {
  id: 'loan-coborrower-unnest',
  tables: [
    {
      name: 'LOAN-COBORROWERS',
      schema: 'loan-coborrowers',
      role: 'input',
      dataset: { generator: 'loan-coborrowers', count: 100 },
      stream: 'produce-consume',
    },
    {
      name: 'BORROWER-DETAILS',
      schema: 'borrower-details',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'unnest-job',
      sql: `INSERT INTO \`{BORROWER-DETAILS}\`
SELECT
  l.loan_id,
  t.name AS borrower_name,
  t.score AS credit_score,
  t.idx AS borrower_index
FROM \`{LOAN-COBORROWERS}\` l
CROSS JOIN UNNEST(l.coborrower_names, l.coborrower_scores) WITH ORDINALITY AS t(name, score, idx)

-- ============================================================
-- WHAT: Explodes ARRAY columns into individual rows using CROSS JOIN UNNEST.
-- WHY: Compliance needs one row per borrower for individual credit checks.
-- HOW: UNNEST flattens both arrays in parallel. WITH ORDINALITY adds a 1-based index.
-- GOTCHA: Arrays must have the same length. NULL arrays produce zero rows (no error).
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{BORROWER-DETAILS}\` LIMIT 50

-- ============================================================
-- WHAT: Reads the flattened output — one row per co-borrower.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your CROSS JOIN UNNEST workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce loan data', detail: 'Click the play button on the LOAN-COBORROWERS stream card to send 100 records with array columns.' },
      { label: 'Run the UNNEST job', detail: 'Run the INSERT INTO cell to flatten arrays into individual borrower rows.' },
      { label: 'View output', detail: 'Run the SELECT query to see one row per co-borrower.' },
    ],
  },
};
