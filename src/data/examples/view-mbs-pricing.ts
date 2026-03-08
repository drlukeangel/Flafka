import type { KickstarterExampleDef } from '../../services/example-runner';

export const viewMbsPricingDef: KickstarterExampleDef = {
  id: 'view-mbs-pricing',
  tables: [
    {
      name: 'MARKET-RATES',
      schema: 'market-rates',
      role: 'input',
      dataset: { generator: 'market-rates', count: 30 },
      stream: 'produce-consume',
    },
    {
      name: 'LOAN-COMMITMENTS',
      schema: 'loan-commitments',
      role: 'input',
      dataset: { generator: 'loan-commitments', count: 200 },
      stream: 'produce-consume',
    },
    {
      name: 'MBS-PRICING-VIEW',
      schema: 'view',
      role: 'output',
      type: 'view',
    },
  ],
  sql: [
    {
      label: 'create-pricing-view',
      sql: `CREATE VIEW \`{MBS-PRICING-VIEW}\` AS
SELECT
  c.commitment_id,
  c.loan_id,
  c.product_type,
  c.principal,
  r.base_rate,
  r.spread,
  c.principal * (r.base_rate + r.spread) / 100 AS estimated_yield
FROM \`{LOAN-COMMITMENTS}\` c
JOIN \`{MARKET-RATES}\` FOR SYSTEM_TIME AS OF c.\`$rowtime\` AS r
  ON c.product_type = r.product_type

-- ============================================================
-- WHAT: Creates a virtual view that enriches loan commitments with
--       point-in-time market rates via a temporal join.
-- WHY: MBS pricing depends on the rate at commitment time, not today's rate.
--      Temporal join gives point-in-time accuracy for each commitment.
-- HOW: FOR SYSTEM_TIME AS OF c.\`$rowtime\` looks up the market rate
--      that was valid when each commitment was created.
-- VIRTUAL VIEW: No data materialized — runs on-demand.
-- GOTCHA: Market rates (version table) must be produced BEFORE
--         commitments. Temporal join requires the lookup table
--         to have data before the probe side emits.
-- GOTCHA: \`$rowtime\` must be backtick-escaped because $ is special.
-- ============================================================`,
    },
    {
      label: 'high-value-opportunities',
      sql: `SELECT * FROM \`{MBS-PRICING-VIEW}\`
WHERE estimated_yield > 50000
LIMIT 50

-- ============================================================
-- WHAT: Finds high-value MBS opportunities.
-- WHY: Commitments with estimated_yield > $50K are worth prioritizing.
-- ACTION: Route to trading desk for immediate pricing.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your MBS pricing workspace is ready. Follow these steps:',
    steps: [
      { label: 'Produce market rates FIRST', detail: 'Click play on the MARKET-RATES stream card FIRST — the temporal join needs rate data before commitments arrive.' },
      { label: 'Wait 5 seconds', detail: 'Give the rates time to land in the topic.' },
      { label: 'Produce loan commitments', detail: 'Click play on the LOAN-COMMITMENTS stream card to send 200 commitment records.' },
      { label: 'Create the pricing view', detail: 'Run the CREATE VIEW cell to register the temporal join view.' },
      { label: 'Find high-value opportunities', detail: 'Run the SELECT query to find commitments with estimated yield > $50K.' },
    ],
  },
};
