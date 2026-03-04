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
  ON l.customer_id = c.customer_id`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{LOANS-ENRICHED}` LIMIT 50',
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
