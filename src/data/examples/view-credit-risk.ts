import type { KickstarterExampleDef } from '../../services/example-runner';

export const viewCreditRiskDef: KickstarterExampleDef = {
  id: 'view-credit-risk',
  tables: [
    {
      name: 'SECURITIZED-LOANS',
      schema: 'securitized-loans',
      role: 'input',
      dataset: { generator: 'securitized-loans', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'RISK-BY-ZIP',
      schema: 'risk-by-zip',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'risk-concentration-job',
      sql: `INSERT INTO \`{RISK-BY-ZIP}\`
SELECT
  zip_code,
  COUNT(*) AS loan_count,
  SUM(upb) AS total_exposure,
  CAST(AVG(upb) AS DOUBLE) AS avg_loan_size
FROM \`{SECURITIZED-LOANS}\`
GROUP BY zip_code

-- ============================================================
-- WHAT: Aggregates securitized loan exposure by ZIP code.
-- WHY: Concentrated geographic risk is a key metric for MBS portfolios.
--      If too many loans are in one ZIP, a local downturn can cascade.
-- HOW: GROUP BY zip_code with COUNT/SUM/AVG gives per-ZIP risk metrics.
-- GOTCHA: Output table needs PRIMARY KEY (zip_code) + changelog.mode = 'upsert'.
-- ============================================================`,
    },
    {
      label: 'flag-high-concentration',
      sql: `SELECT * FROM \`{RISK-BY-ZIP}\`
WHERE total_exposure > 1000000
ORDER BY total_exposure DESC
LIMIT 20

-- ============================================================
-- WHAT: Finds ZIP codes with over $1M in total unpaid balance.
-- WHY: High concentration = high geographic risk for MBS investors.
-- ACTION: Flag these ZIPs for portfolio rebalancing.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your credit risk workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce securitized loans', detail: 'Click play on the SECURITIZED-LOANS stream card to send 200 loan records.' },
      { label: 'Run the risk aggregation', detail: 'Run the INSERT INTO cell to start aggregating exposure by ZIP code.' },
      { label: 'Wait a few seconds', detail: 'Let the job process all records.' },
      { label: 'Find high-risk ZIPs', detail: 'Run the SELECT query to find ZIP codes with over $1M exposure.' },
    ],
  },
};
