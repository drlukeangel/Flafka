import type { KickstarterExampleDef } from '../../services/example-runner';

export const confluentConnectorBridgeDef: KickstarterExampleDef = {
  id: 'confluent-connector-bridge',
  tables: [
    {
      name: 'RAW-INGEST',
      schema: 'connector-raw',
      role: 'input',
      dataset: { generator: 'connector-events', count: 20 },
      stream: 'produce-consume',
    },
    {
      name: 'CLEAN-OUTPUT',
      schema: 'connector-clean',
      role: 'output',
      stream: 'consume',
    },
  ],
  sql: [
    {
      label: 'transform-and-clean',
      sql: `INSERT INTO \`{CLEAN-OUTPUT}\`
SELECT
  UPPER(TRIM(source_system)) AS source_system,
  event_id,
  COALESCE(event_payload, '{}') AS event_payload,
  CASE
    WHEN event_type IS NULL THEN 'UNKNOWN'
    WHEN event_type = '' THEN 'EMPTY'
    ELSE UPPER(event_type)
  END AS event_type,
  ingestion_time
FROM \`{RAW-INGEST}\`
WHERE event_id IS NOT NULL
--
-- Squirrel's Architecture Napkin Drawing:
-- ========================================
--
--   [External DB]         [API]        [Files]
--        |                  |             |
--        v                  v             v
--   +----------+  +----------+  +----------+
--   | Source    |  | Source   |  | Source   |
--   | Connector|  | Connector|  | Connector|
--   +----------+  +----------+  +----------+
--        \\            |            /
--         v           v           v
--       +-------------------------+
--       |     RAW-INGEST topic    |
--       |   (messy, unvalidated)  |
--       +-------------------------+
--                  |
--                  v
--         +-----------------+
--         |   THIS FLINK    |
--         |   JOB RIGHT     |
--         |   HERE <<<      |
--         +-----------------+
--                  |
--                  v
--       +-------------------------+
--       |    CLEAN-OUTPUT topic   |
--       |  (trimmed, validated,   |
--       |   ready for business)   |
--       +-------------------------+
--                  |
--                  v
--          [Sink Connector]
--          [to wherever]
--
-- Yes, Squirrel drew this on an actual napkin.
-- The coffee stain is a feature, not a bug.`,
    },
    {
      label: 'verify-clean-output',
      sql: `SELECT
  source_system,
  event_type,
  COUNT(*) AS event_count
FROM \`{CLEAN-OUTPUT}\`
GROUP BY source_system, event_type
-- Let's see what came out the other side.
-- NULLs? Gone. Whitespace? Trimmed. Empty types? Labeled.
-- This is what connectors WISH they could do on their own.
-- But that's why Flink exists: to clean up everyone else's mess.
-- Squirrel's job here is done. Time for a well-earned acorn.`,
    },
  ],
  completionModal: {
    subtitle: 'Connectors bring the data, Flink makes it presentable:',
    steps: [
      {
        label: 'Simulate raw connector data',
        detail:
          'Click play on RAW-INGEST to produce messy, unvalidated events from simulated connectors.',
      },
      {
        label: 'Run the cleanup job',
        detail:
          'Execute cell 1 to transform, trim, and validate the raw data into CLEAN-OUTPUT.',
      },
      {
        label: 'Verify the results',
        detail:
          'Run cell 2 to see a summary of cleaned events, grouped by source and type.',
      },
    ],
  },
};
