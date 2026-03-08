import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanBorrowerPaymentsDef: KickstarterExampleDef = {
  id: 'loan-borrower-payments',
  tables: [
    {
      name: 'PAYMENT-STREAM',
      schema: 'payment-stream',
      role: 'input',
      dataset: { generator: 'payment-stream-data', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'BORROWER-REFERENCE',
      schema: 'borrower-reference',
      role: 'input',
      dataset: { generator: 'borrower-reference', count: 30 },
      stream: 'produce-consume',
    },
    {
      name: 'ENRICHED-PAYMENTS',
      schema: 'enriched-payments',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'enrich-payments-job',
      sql: `INSERT INTO \`{ENRICHED-PAYMENTS}\`
SELECT
  p.payment_id,
  p.borrower_id,
  b.name AS borrower_name,
  b.region,
  b.risk_tier,
  p.amount,
  p.payment_type
FROM \`{PAYMENT-STREAM}\` p
JOIN \`{BORROWER-REFERENCE}\` FOR SYSTEM_TIME AS OF p.\`$rowtime\` AS b
  ON p.borrower_id = b.borrower_id

-- ============================================================
-- WHAT: Temporal join enriches every payment with borrower context.
-- WHY: High-volume payments need borrower details (name, region, risk tier) for analytics.
-- HOW: FOR SYSTEM_TIME AS OF attaches the latest borrower profile at each payment's event time.
-- GOTCHA: Produce BORROWER-REFERENCE first so the lookup table is populated before payments arrive.
-- ============================================================`,
    },
    {
      label: 'find-high-risk',
      sql: `SELECT * FROM \`{ENRICHED-PAYMENTS}\`
WHERE risk_tier = 'HIGH'
LIMIT 50

-- ============================================================
-- WHAT: Finds payments from high-risk borrowers.
-- WHY: Risk teams need to monitor payment activity from high-risk accounts in real-time.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your payment enrichment workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce borrower reference data', detail: 'Click the play button on BORROWER-REFERENCE first to populate the lookup table with 30 borrowers.' },
      { label: 'Produce payment data', detail: 'Click the play button on PAYMENT-STREAM to send 200 payment events.' },
      { label: 'Run the enrichment join', detail: 'Run the INSERT INTO cell to enrich payments with borrower details.' },
      { label: 'Find high-risk payments', detail: 'Run the SELECT query to see payments from high-risk borrowers.' },
    ],
  },
};
