import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanIntervalJoinDef: KickstarterExampleDef = {
  id: 'loan-interval-join',
  tables: [
    // CUSTOMERS-STREAM first — must be in Kafka before loans
    {
      name: 'CUSTOMERS-STREAM',
      schema: 'customers-stream',
      role: 'input',
      dataset: { generator: 'customers-stream', count: 20 },
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
      name: 'INTERVAL-JOINED',
      schema: 'interval-joined',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'interval-join-job',
      sql: `INSERT INTO \`{INTERVAL-JOINED}\`
SELECT CAST(CONCAT(l.customer_id, '-', l.txn_id) AS BYTES) AS \`key\`,
  l.customer_id, l.txn_id, l.loan_id, l.amount, l.status,
  c.name AS customer_name, c.credit_score
FROM \`{LOANS}\` l
JOIN \`{CUSTOMERS-STREAM}\` c ON l.customer_id = c.customer_id
  AND c.$rowtime BETWEEN l.$rowtime - INTERVAL '5' MINUTE AND l.$rowtime + INTERVAL '5' MINUTE`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{INTERVAL-JOINED}` LIMIT 50',
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce customer events', detail: 'Click \u25b6 on the CUSTOMERS-STREAM stream card first to send 20 customer records as an append-only stream.' },
      { label: 'Run interval join job', detail: 'Run the INSERT INTO cell; the job joins loans with customer events within a 5-minute time window.' },
      { label: 'Produce loan transactions', detail: 'Click \u25b6 on the LOANS stream card; each loan matches customer events within \u00b15 minutes.' },
      { label: 'View joined results', detail: 'Run the SELECT * LIMIT 50 cell to see loans enriched with customer name and credit score.' },
    ],
  },
};
