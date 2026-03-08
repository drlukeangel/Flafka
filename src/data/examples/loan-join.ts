import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanJoinDef: KickstarterExampleDef = {
  id: 'loan-join',
  tables: [
    // CUSTOMERS first — user must produce CUSTOMERS before LOANS for join to work
    {
      name: 'CUSTOMERS',
      schema: 'customers-risk',
      role: 'input',
      dataset: { generator: 'customers-risk', count: 10 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'FRAUD-ALERTS',
      schema: 'fraud-alerts',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'fraud-monitor',
      sql: `INSERT INTO \`{FRAUD-ALERTS}\`
SELECT
  CAST(l.loan_id AS BYTES) AS \`key\`,
  l.loan_id, l.customer_id, l.amount, l.status, l.txn_id,
  c.name AS customer_name, c.risk_score, c.risk_level,
  CASE
    WHEN c.risk_level = 'CRITICAL' THEN 'CRITICAL_RISK_CUSTOMER'
    WHEN c.risk_level = 'HIGH' AND l.amount > 25000 THEN 'HIGH_RISK_LARGE_AMOUNT'
    WHEN c.risk_level = 'HIGH' THEN 'HIGH_RISK_CUSTOMER'
    WHEN l.amount > 40000 THEN 'LARGE_TRANSACTION'
    WHEN c.risk_level = 'MEDIUM' THEN 'MEDIUM_RISK_CUSTOMER'
    ELSE 'LOW_RISK'
  END AS alert_reason
FROM \`{LOANS}\` l
JOIN \`{CUSTOMERS}\` c ON l.customer_id = c.customer_id

-- ============================================================
-- WHAT: Joins each loan against CUSTOMERS to assign a fraud risk alert_reason.
-- HOW: Regular inner JOIN on customer_id; CASE evaluates risk top-down (CRITICAL > HIGH > MEDIUM > LOW).
-- WHY regular JOIN: Both sides are Kafka topics; Flink keeps state for both and matches on shared keys.
-- WHY CAST(loan_id AS BYTES): Output topic key column is typed BYTES; skipping this causes a type mismatch error.
-- GOTCHA: Produce CUSTOMERS first — loans arriving before customers are buffered waiting for a match.
-- GOTCHA: CASE is evaluated top-down; reordering WHEN clauses changes which branch matches.
-- EXPECT: One output row per loan (if matching customer exists) with alert_reason explaining the flag.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{FRAUD-ALERTS}\` LIMIT 50

-- ============================================================
-- WHAT: Inspect fraud alert output written by the INSERT job above.
-- GOTCHA: Without LIMIT, Flink streams forever; LIMIT 50 stops after 50 rows.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce customer risk profiles', detail: 'Click ▶ on the CUSTOMERS stream card first (10 customer records).' },
      { label: 'Run the fraud monitor', detail: 'Run the INSERT INTO cell; the streaming join starts.' },
      { label: 'Produce loan transactions', detail: 'Click ▶ on the LOANS stream card; alerts will appear immediately as loans arrive.' },
      { label: 'View alerts', detail: 'Run the SELECT * LIMIT 50 cell to see flagged loans with alert_reason.' },
    ],
  },
};
