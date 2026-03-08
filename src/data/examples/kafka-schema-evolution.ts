import type { KickstarterExampleDef } from '../../services/example-runner';

export const kafkaSchemaEvolutionDef: KickstarterExampleDef = {
  id: 'kafka-schema-evolution',
  tables: [
    {
      name: 'EVOLVING-DATA',
      schema: 'evolving-schema',
      role: 'input',
      dataset: { generator: 'evolving-events', count: 15 },
      stream: 'produce-consume',
    },
    {
      name: 'EVOLVED-OUTPUT',
      schema: 'evolved-schema',
      role: 'output',
      stream: 'consume',
    },
  ],
  sql: [
    {
      label: 'query-original-schema',
      sql: `SELECT * FROM \`{EVOLVING-DATA}\`
-- Here's your data with the ORIGINAL schema.
-- Looks nice. Looks complete. Looks like nothing could go wrong.
-- Squirrel narrator voice: "Something was about to go wrong."
-- Schemas evolve. Producers add fields. The world moves on.
-- But does your Flink table know that? Spoiler: no. No it does not.`,
    },
    {
      label: 'evolve-the-schema',
      sql: `-- WARNING: This is a schema migration. Proceed with caffeinated caution.
-- Step 1: DROP the old table definition
-- Step 2: CREATE a new one with the extra column
-- Step 3: Hope for the best (just kidding, this actually works)
--
-- DROP TABLE \`{EVOLVING-DATA}\`;
--
-- CREATE TABLE \`{EVOLVING-DATA}\` (
--   event_id STRING,
--   event_type STRING,
--   payload STRING,
--   priority INT,          -- << THE NEW COLUMN. Look at it. So shiny.
--   event_time TIMESTAMP(3)
-- ) WITH ( ... );
--
-- Squirrel's warning: Flink doesn't read your mind.
-- If the schema changes upstream and you don't update your table,
-- Flink will happily ignore new fields or blow up on missing ones.
-- Communication is key. Talk to your producers. Send them a Slack message.
-- Or, you know, use Schema Registry like a civilized mammal.
SELECT 'Schema evolution requires dropping and recreating the Flink table.' AS reminder`,
    },
    {
      label: 'query-evolved-data',
      sql: `SELECT * FROM \`{EVOLVED-OUTPUT}\`
-- After the schema evolution, your new column appears here.
-- Old records without the field? They get NULLs. Classic.
-- New records with the field? They show up beautifully.
-- This is backward compatibility in action.
-- Squirrel is proud of you for making it this far.
-- Most developers rage-quit at the DROP TABLE step.`,
    },
  ],
  completionModal: {
    subtitle: 'Schemas change. Your Flink tables need to keep up:',
    steps: [
      {
        label: 'Query the original',
        detail:
          'Run cell 1 to see data with the current schema. Note the columns.',
      },
      {
        label: 'Understand the evolution',
        detail:
          'Read cell 2 to learn how to DROP and recreate a table when the schema changes.',
      },
      {
        label: 'See the result',
        detail:
          'Run cell 3 to query the evolved output and see old + new fields coexisting.',
      },
    ],
  },
};
