import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanMultiRegionMergeDef: KickstarterExampleDef = {
  id: 'loan-multi-region-merge',
  tables: [
    {
      name: 'LOANS-NORTHEAST',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 60 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-SOUTHEAST',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 60 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-WEST',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 60 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-UNIFIED',
      schema: 'loans-standard',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'union-all-job',
      sql: `INSERT INTO \`{LOANS-UNIFIED}\`
SELECT \`key\`, loan_id, amount, status, created_at, txn_id, customer_id FROM \`{LOANS-NORTHEAST}\`
UNION ALL
SELECT \`key\`, loan_id, amount, status, created_at, txn_id, customer_id FROM \`{LOANS-SOUTHEAST}\`
UNION ALL
SELECT \`key\`, loan_id, amount, status, created_at, txn_id, customer_id FROM \`{LOANS-WEST}\`

-- ============================================================
-- WHAT: Merges 3 regional loan feeds into a single unified stream.
-- WHY: Downstream analytics needs one stream, not three. UNION ALL is zero-cost.
-- HOW: All three SELECTs must have identical column lists and types.
-- GOTCHA: UNION ALL does NOT deduplicate — if a loan appears in two regions, it appears twice.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{LOANS-UNIFIED}\` LIMIT 50

-- ============================================================
-- WHAT: Reads the merged output stream.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your UNION ALL workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce regional data', detail: 'Click the play button on each of the 3 regional stream cards to send 60 records each.' },
      { label: 'Run the UNION ALL job', detail: 'Run the INSERT INTO cell to merge all three streams into LOANS-UNIFIED.' },
      { label: 'View merged output', detail: 'Run the SELECT query to see loans from all regions in one stream.' },
    ],
  },
};
