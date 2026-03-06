import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanPatternMatchDef: KickstarterExampleDef = {
  id: 'loan-pattern-match',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'PATTERN-ALERTS',
      schema: 'pattern-alerts',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'pattern-match-job',
      sql: `INSERT INTO \`{PATTERN-ALERTS}\`
SELECT CAST(customer_id AS BYTES) AS \`key\`,
  customer_id, first_txn, last_txn, app_count, total_amount,
  CAST(avg_amount AS DOUBLE) AS avg_amount, first_time, last_time
FROM \`{LOANS}\`
MATCH_RECOGNIZE (
  PARTITION BY customer_id ORDER BY $rowtime
  MEASURES
    FIRST(A.txn_id) AS first_txn, LAST(A.txn_id) AS last_txn,
    COUNT(A.txn_id) AS app_count, SUM(A.amount) AS total_amount,
    AVG(A.amount) AS avg_amount,
    FIRST(A.$rowtime) AS first_time, LAST(A.$rowtime) AS last_time
  ONE ROW PER MATCH
  AFTER MATCH SKIP PAST LAST ROW
  PATTERN (A{3,})
  DEFINE A AS TRUE
)`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{PATTERN-ALERTS}` LIMIT 50',
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click \u25b6 on the LOANS stream card to send 200 loan records.' },
      { label: 'Run pattern match job', detail: 'Run the INSERT INTO cell; MATCH_RECOGNIZE detects 3+ consecutive loan applications per customer.' },
      { label: 'View pattern alerts', detail: 'Run the SELECT * LIMIT 50 cell to see burst patterns with first/last txn and totals.' },
    ],
  },
};
