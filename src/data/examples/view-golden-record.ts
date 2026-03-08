import type { KickstarterExampleDef } from '../../services/example-runner';

export const viewGoldenRecordDef: KickstarterExampleDef = {
  id: 'view-golden-record',
  tables: [
    {
      name: 'LOAN-UPDATES',
      schema: 'loan-updates',
      role: 'input',
      dataset: { generator: 'loan-updates', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'LOAN-GOLDEN-RECORD',
      schema: 'loan-golden-record',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'golden-record-job',
      sql: `INSERT INTO \`{LOAN-GOLDEN-RECORD}\`
SELECT
  loan_id,
  LAST_VALUE(status) AS latest_status,
  LAST_VALUE(appraisal_value) AS latest_appraisal,
  LAST_VALUE(credit_score) AS latest_credit_score,
  MAX(updated_at) AS last_update
FROM \`{LOAN-UPDATES}\`
GROUP BY loan_id

-- ============================================================
-- WHAT: Builds a "golden record" — one row per loan with the latest values.
-- WHY: Kafka topics contain multiple updates per loan_id over time.
--      LAST_VALUE picks the most recent value for each column.
-- HOW: GROUP BY loan_id collapses all updates. LAST_VALUE is ordered by
--      Flink's internal rowtime, so the newest event wins.
-- GOTCHA: Output table needs PRIMARY KEY + changelog.mode = 'upsert'
--         because GROUP BY produces update (changelog) output.
-- GOTCHA: Produce data FIRST, then run this job.
-- ============================================================`,
    },
    {
      label: 'find-distressed',
      sql: `SELECT * FROM \`{LOAN-GOLDEN-RECORD}\`
WHERE latest_status = 'DELINQUENT' AND latest_credit_score < 650
LIMIT 50

-- ============================================================
-- WHAT: Queries the materialized golden record to find distressed loans.
-- WHY: After the INSERT INTO job materializes the view, this query
--      reads the output table like a regular SELECT.
-- ACTION: Finds loans that are both DELINQUENT and have low credit scores.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your materialized view workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce loan updates', detail: 'Click the play button on the LOAN-UPDATES stream card to send 200 loan update records.' },
      { label: 'Run the golden record job', detail: 'Run the INSERT INTO cell to start materializing the latest state per loan.' },
      { label: 'Wait a few seconds', detail: 'Let the job process updates and write results to the output table.' },
      { label: 'Find distressed loans', detail: 'Run the SELECT query to find delinquent loans with low credit scores.' },
    ],
  },
};
