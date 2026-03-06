import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanCdcPipelineDef: KickstarterExampleDef = {
  id: 'loan-cdc-pipeline',
  tables: [
    {
      name: 'CUSTOMERS',
      schema: 'customers-latest',
      role: 'input',
      dataset: { generator: 'customers-cdc', count: 30 },
      stream: 'produce-consume',
    },
    {
      name: 'CUSTOMERS-LATEST',
      schema: 'customers-latest',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'cdc-materialize-job',
      sql: `INSERT INTO \`{CUSTOMERS-LATEST}\`
SELECT
  CAST(customer_id AS BYTES) AS \`key\`,
  customer_id, name, credit_score, state, risk_score, risk_level
FROM (
  SELECT customer_id, name, credit_score, state, risk_score, risk_level,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY $rowtime DESC) AS rownum
  FROM \`{CUSTOMERS}\`
)
WHERE rownum = 1`,
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{CUSTOMERS-LATEST}` LIMIT 50',
    },
  ],
  completionModal: {
    subtitle: 'Your workspace is ready. Follow these steps to run the example:',
    steps: [
      { label: 'Produce CDC events', detail: 'Click \u25b6 on the CUSTOMERS stream card to send 30 events with duplicate customer_ids simulating database updates.' },
      { label: 'Run the CDC materialize job', detail: 'Run the INSERT INTO cell; ROW_NUMBER DESC keeps only the latest version per customer.' },
      { label: 'View latest customers', detail: 'Run the SELECT * LIMIT 50 cell \u2014 each customer_id appears exactly once with the most recent data.' },
    ],
  },
};
