import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanDataMaskingDef: KickstarterExampleDef = {
  id: 'loan-data-masking',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-MASKED-SQL',
      schema: 'loans-masked-sql',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'masking-job',
      sql: `INSERT INTO \`{LOANS-MASKED-SQL}\`
SELECT
  CAST(SHA2(CAST(loan_id AS BYTES), 256) AS BYTES) AS \`key\`,
  SHA2(CAST(loan_id AS BYTES), 256) AS hashed_loan_id,
  amount,
  status,
  REGEXP_REPLACE(customer_id, '.', '*') AS masked_customer_id,
  created_at
FROM \`{LOANS}\`

-- ============================================================
-- WHAT: Real-time data masking — obfuscates PII before writing to LOANS-MASKED-SQL. Runs continuously.
-- SHA2(CAST(loan_id AS BYTES), 256): One-way hash producing 64 hex chars. Preserves consistent Kafka partitioning.
-- REGEXP_REPLACE(customer_id, '.', '*'): Redacts every character to '*'. Preserves original value LENGTH (useful for debugging).
-- WHY PURE SQL: No UDF JARs to deploy/version/debug. Built-in functions cover basic masking needs.
-- WHY NOT MASK amount/status: Not PII — masking everything makes data useless for analytics.
-- GOTCHA: SHA2() requires BYTES input, not STRING — CAST first or get a type mismatch error.
-- GOTCHA: Hashing is one-way but NOT encryption. Same input = same hash. Add a salt for stronger protection.
-- GOTCHA: REGEXP_REPLACE redaction is REVERSIBLE. For GDPR/CCPA compliance, prefer SHA2 or tokenization.
-- GOTCHA: REGEXP_REPLACE uses Java regex — '.' matches everything except newlines by default.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{LOANS-MASKED-SQL}\` LIMIT 50

-- ============================================================
-- WHAT: View masked output — hashed loan_ids (64-char hex), redacted customer_ids (all asterisks), unchanged amount/status/created_at.
-- SAFE TO SHARE: Original loan_id and customer_id are gone. Downstream consumers needing raw values must read from LOANS directly.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce test data', detail: 'Click the green Play button on the LOANS stream card to start sending 200 loan records.' },
      { label: 'Run the masking job', detail: 'Run the masking-job cell to start hashing loan IDs and redacting customer IDs in real-time.' },
      { label: 'View masked output', detail: 'Run the view-output cell to see records with hashed loan_ids and masked customer_ids.' },
    ],
  },
};
