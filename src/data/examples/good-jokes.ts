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
      sql: "INSERT INTO `{GOOD-JOKES}`\nSELECT joke_id, joke, category, rating\nFROM `{JOKES}`\nWHERE rating IN ('LOL', 'ROFL', 'DEAD')",
    },
    {
      label: 'view-good-jokes',
      sql: 'SELECT * FROM `{GOOD-JOKES}` LIMIT 20',
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
