import type { KickstarterExampleDef } from '../../services/example-runner';

export const goodJokesDef: KickstarterExampleDef = {
  id: 'good-jokes',
  tables: [
    {
      name: 'JOKES',
      schema: 'jokes',
      role: 'input',
      dataset: { generator: 'flat-jokes', count: 30 },
      stream: 'produce-consume',
    },
    {
      name: 'GOOD-JOKES',
      schema: 'good-jokes',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'filter-good-jokes',
      sql: `INSERT INTO \`{GOOD-JOKES}\`
SELECT joke_id, joke, category, rating
FROM \`{JOKES}\`
WHERE rating IN ('LOL', 'ROFL', 'DEAD')

-- ============================================================
-- WHAT: Continuous job that filters jokes by rating, writing only LOL/ROFL/DEAD to GOOD-JOKES.
-- WHY INSERT INTO: SELECT shows results in console but doesn't save. INSERT INTO writes to an actual Kafka topic.
-- WHY explicit columns: Output table may differ from input schema. SELECT * fails on mismatch.
-- WHY IN (...): Shorthand for multiple OR conditions — cleaner with 3+ values.
-- GOTCHA: Job runs FOREVER. Running it twice without cancelling the first creates DUPLICATE output.
-- ============================================================`,
    },
    {
      label: 'view-good-jokes',
      sql: `SELECT * FROM \`{GOOD-JOKES}\` LIMIT 20

-- ============================================================
-- WHAT: Reads from GOOD-JOKES to verify only LOL/ROFL/DEAD ratings made it through the filter.
-- GOTCHA: Run the INSERT INTO job and produce jokes FIRST — topic is empty until the filter processes data.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your joke filter is ready. Follow these steps:',
    steps: [
      { label: 'Send jokes', detail: 'Click ▶ on the JOKES stream card — 30 jokes incoming, mix of LOL, ROFL, DEAD, GROAN, and MEH.' },
      { label: 'Run the filter', detail: "Run the INSERT INTO cell — only LOL, ROFL, and DEAD ratings make it to GOOD-JOKES." },
      { label: 'Check what survived', detail: "Run the SELECT cell to see which jokes passed the vibe check. GROAN and MEH didn't make the cut." },
    ],
  },
};
