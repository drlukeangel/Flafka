import type { KickstarterExampleDef } from '../../services/example-runner';

export const loanPropertyLookupDef: KickstarterExampleDef = {
  id: 'loan-property-lookup',
  tables: [
    {
      name: 'LOANS-WITH-PROPERTY',
      schema: 'loans-with-property',
      role: 'input',
      dataset: { generator: 'loans-with-property', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'PROPERTY-REFERENCE',
      schema: 'property-reference',
      role: 'input',
      dataset: { generator: 'property-reference', count: 50 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-APPRAISED',
      schema: 'loans-appraised',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'lookup-join-job',
      sql: `INSERT INTO \`{LOANS-APPRAISED}\`
SELECT
  l.loan_id,
  l.property_id,
  l.amount,
  p.appraisal_value,
  p.flood_zone,
  CAST(l.amount / p.appraisal_value * 100 AS DOUBLE) AS ltv_ratio
FROM \`{LOANS-WITH-PROPERTY}\` l
JOIN \`{PROPERTY-REFERENCE}\` FOR SYSTEM_TIME AS OF l.\`$rowtime\` AS p
  ON l.property_id = p.property_id

-- ============================================================
-- WHAT: Temporal join enriches each loan with current property data.
-- WHY: Underwriting needs appraisal value + flood zone for every loan decision.
-- HOW: FOR SYSTEM_TIME AS OF looks up the latest property record at the loan's event time.
-- KEY: LTV ratio = loan amount / appraisal value * 100 — core underwriting metric.
-- GOTCHA: PROPERTY-REFERENCE must have PRIMARY KEY + changelog.mode = 'upsert'.
--         Produce property data FIRST so the reference table is populated before loans arrive.
-- ============================================================`,
    },
    {
      label: 'view-high-ltv',
      sql: `SELECT * FROM \`{LOANS-APPRAISED}\`
WHERE ltv_ratio > 80
LIMIT 50

-- ============================================================
-- WHAT: Finds high-LTV loans (>80%) — these need mortgage insurance.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your property lookup join workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce property reference data', detail: 'Click the play button on PROPERTY-REFERENCE first to populate the lookup table with 50 properties.' },
      { label: 'Produce loan data', detail: 'Click the play button on LOANS-WITH-PROPERTY to send 200 loan records.' },
      { label: 'Run the lookup join', detail: 'Run the INSERT INTO cell to enrich loans with property appraisals and compute LTV ratios.' },
      { label: 'Find high-LTV loans', detail: 'Run the SELECT query to see loans with LTV ratio above 80%.' },
    ],
  },
};
