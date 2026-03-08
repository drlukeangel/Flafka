import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanStreamEnrichmentDef: KickstarterExampleDef = {
  id: 'loan-stream-enrichment',
  tables: [
    // CUSTOMERS-LATEST first — must be in Kafka before loans for temporal lookup
    {
      name: 'CUSTOMERS-LATEST',
      schema: 'customers-credit',
      role: 'input',
      dataset: { generator: 'customers-credit', count: 10 },
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
      name: 'STREAM-ENRICHED',
      schema: 'stream-enriched',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'stream-enrichment-job',
      sql: `INSERT INTO \`{STREAM-ENRICHED}\`
SELECT CAST(CONCAT(l.customer_id, '-', l.txn_id) AS BYTES) AS \`key\`,
  l.customer_id, l.txn_id, l.loan_id, l.amount, l.status,
  c.name AS customer_name, c.credit_score
FROM \`{LOANS}\` l
JOIN \`{CUSTOMERS-LATEST}\` FOR SYSTEM_TIME AS OF l.\`$rowtime\` AS c
  ON l.customer_id = c.customer_id

-- ============================================================
-- WHAT: Temporal join — enriches each loan with the customer's profile as it was at loan arrival time.
-- HOW: FOR SYSTEM_TIME AS OF l.\`$rowtime\` looks up the CUSTOMERS-LATEST record valid at that instant.
-- WHY TEMPORAL JOIN: Stream + versioned table. Regular JOIN = unbounded state/OOM. Interval JOIN = two event streams.
-- POINT-IN-TIME CORRECTNESS: If credit_score changed at T+1, loans at T still see the old score (audit-safe).
-- WHY CAST(CONCAT(...) AS BYTES): Composite Kafka key for the output record.
-- GOTCHA: CUSTOMERS-LATEST (dimension table) MUST be produced BEFORE LOANS. Missing customer = silently dropped loan.
-- GOTCHA: FOR SYSTEM_TIME AS OF requires stream side to have a time attribute ($rowtime or WATERMARK column).
-- GOTCHA: Right side MUST be a versioned/temporal table (compacted topic with PRIMARY KEY), not a regular stream.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{STREAM-ENRICHED}\` LIMIT 50

-- ============================================================
-- WHAT: View enriched loans — each row = one loan with customer_name and credit_score attached.
-- COLUMNS: customer_id, txn_id, loan_id, amount, status, customer_name, credit_score.
-- GOTCHA: Zero rows? (1) Produce CUSTOMERS-LATEST before LOANS. (2) Check customer_id matches. (3) Start the job first.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce customer dimension data', detail: 'Click \u25b6 on the CUSTOMERS-LATEST stream card first \u2014 this seeds the versioned lookup table with 10 customers \u00d7 2 versions each.' },
      { label: 'Run stream enrichment job', detail: 'Run the INSERT INTO cell; the temporal join looks up the latest customer profile at each loan\'s arrival time.' },
      { label: 'Produce loan transactions', detail: 'Click \u25b6 on the LOANS stream card; each loan is enriched with current customer name and credit score.' },
      { label: 'View enriched results', detail: 'Run the SELECT * LIMIT 50 cell to see loans with customer_name and credit_score attached.' },
    ],
  },
};
