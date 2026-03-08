import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanTemporalJoinDef: KickstarterExampleDef = {
  id: 'loan-temporal-join',
  tables: [
    // CUSTOMERS first — must be in Kafka before loans for temporal lookup
    {
      name: 'CUSTOMERS',
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
      name: 'LOANS-ENRICHED',
      schema: 'loans-enriched',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'enrich-job',
      sql: `INSERT INTO \`{LOANS-ENRICHED}\`
SELECT
  CAST(l.loan_id AS BYTES) AS \`key\`,
  l.loan_id, l.customer_id, l.amount, l.status, l.txn_id,
  c.name AS customer_name, c.credit_score, c.state
FROM \`{LOANS}\` l
JOIN \`{CUSTOMERS}\` FOR SYSTEM_TIME AS OF l.\`$rowtime\` AS c
  ON l.customer_id = c.customer_id

-- ============================================================
-- WHAT: Enriches each loan with the customer's credit data as it was at the loan's arrival time.
-- HOW: Temporal join via FOR SYSTEM_TIME AS OF l.$rowtime — looks up the customer version valid at that timestamp.
-- WHY temporal join: A regular JOIN matches ALL customer versions (duplicates); temporal gives exactly ONE point-in-time match.
-- WHY $rowtime: Flink metadata column for Kafka ingestion timestamp; backtick-escaped because $ is special.
-- WHY CAST(loan_id AS BYTES): Output topic key column is typed BYTES.
-- GOTCHA: Produce CUSTOMERS first — if customers arrive after loans, the temporal join finds no match.
-- GOTCHA: FOR SYSTEM_TIME AS OF only works on the RIGHT side (lookup table); LEFT side is the driving stream.
-- EXPECT: One enriched output row per loan with customer_name, credit_score, and state at loan arrival time.
-- ============================================================`,
    },
    {
      label: 'view-output',
      sql: `SELECT * FROM \`{LOANS-ENRICHED}\` LIMIT 50

-- ============================================================
-- WHAT: Inspect enriched loans with point-in-time customer data.
-- GOTCHA: Without LIMIT, Flink streams forever; LIMIT 50 stops after 50 rows.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce customer credit histories', detail: 'Click ▶ on the CUSTOMERS stream card first; this seeds the versioned lookup table (each customer has 2 credit score records).' },
      { label: 'Run the enrichment job', detail: 'Run the INSERT INTO cell; the temporal join starts; it uses Kafka ingestion time for version lookup.' },
      { label: 'Produce loan transactions', detail: 'Click ▶ on the LOANS stream card; each loan is enriched with the customer\'s credit score at loan arrival time.' },
      { label: 'View enriched loans', detail: 'Run the SELECT * LIMIT 50 cell to see loans with customer_name, credit_score, and state.' },
    ],
  },
};
