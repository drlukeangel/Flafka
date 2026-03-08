import type { KickstarterExampleDef } from '../../services/example-runner';

export const kafkaChangelogModesDef: KickstarterExampleDef = {
  id: 'kafka-changelog-modes',
  tables: [
    {
      name: 'APPEND-LOG',
      schema: 'changelog-append',
      role: 'input',
      dataset: { generator: 'changelog-events', count: 15 },
      stream: 'produce-consume',
    },
    {
      name: 'UPSERT-LOG',
      schema: 'changelog-upsert',
      role: 'input',
      dataset: { generator: 'changelog-events', count: 15 },
      stream: 'produce-consume',
    },
    {
      name: 'APPEND-RESULT',
      schema: 'changelog-append',
      role: 'output',
      stream: 'consume',
    },
    {
      name: 'UPSERT-RESULT',
      schema: 'changelog-upsert',
      role: 'output',
      stream: 'consume',
    },
  ],
  sql: [
    {
      label: 'append-mode-insert',
      sql: `INSERT INTO \`{APPEND-RESULT}\`
SELECT * FROM \`{APPEND-LOG}\`
-- Append mode: every row is a NEW row. No take-backs.
-- The table just keeps growing. And growing. AND GROWING.
-- Squirrel has seen append-only tables consume entire clusters.
-- It's like a squirrel that never stops burying acorns.`,
    },
    {
      label: 'upsert-mode-aggregate',
      sql: `INSERT INTO \`{UPSERT-RESULT}\`
SELECT
  event_key,
  COUNT(*) AS event_count,
  MAX(event_value) AS latest_value
FROM \`{UPSERT-LOG}\`
GROUP BY event_key
-- Upsert mode: same key? We UPDATE, not append.
-- The table stays calm. Zen-like. One row per key.
-- Squirrel prefers upsert. Less hoarding, more organizing.
-- Think of it as Marie Kondo for your Kafka topic.`,
    },
    {
      label: 'compare-results',
      sql: `SELECT 'APPEND' AS mode, COUNT(*) AS row_count FROM \`{APPEND-RESULT}\`
UNION ALL
SELECT 'UPSERT' AS mode, COUNT(*) AS row_count FROM \`{UPSERT-RESULT}\`
-- Moment of truth: append has ALL the rows.
-- Upsert has... significantly fewer.
-- Same input data, wildly different output.
-- This is why changelog modes matter, folks.
-- Squirrel drops the mic.`,
    },
  ],
  completionModal: {
    subtitle: 'Append vs Upsert: the changelog showdown begins:',
    steps: [
      {
        label: 'Seed both topics',
        detail:
          'Click play on both APPEND-LOG and UPSERT-LOG to produce identical events.',
      },
      {
        label: 'Run append, then upsert',
        detail:
          'Execute cells 1 and 2 to write results in append mode and upsert mode respectively.',
      },
      {
        label: 'Compare the output',
        detail:
          'Run cell 3 to see the row count difference. Append hoards, upsert consolidates.',
      },
    ],
  },
};
