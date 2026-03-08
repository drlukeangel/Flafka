import type { KickstarterExampleDef } from '../../services/example-runner';

export const kafkaStartupModesDef: KickstarterExampleDef = {
  id: 'kafka-startup-modes',
  tables: [
    {
      name: 'EVENTS',
      schema: 'kafka-events',
      role: 'input',
      dataset: { generator: 'kafka-events', count: 20 },
      stream: 'produce-consume',
    },
  ],
  sql: [
    {
      label: 'read-all-events',
      sql: `SELECT * FROM \`{EVENTS}\`
-- This reads from the earliest offset by default.
-- Every event that ever existed comes flooding back.
-- Squirrel calls this "the full archaeological dig."
-- You wanted ALL the data? You got ALL the data. You're welcome.`,
    },
    {
      label: 'startup-mode-options',
      sql: `-- Don't actually run this one — it's a reference card.
-- To change where Flink starts reading, set scan.startup.mode:
--
--   'earliest-offset'  : read everything from the dawn of time
--   'latest-offset'    : only new stuff, ignore the past like a pro
--   'timestamp'        : pick an exact moment — time travel without the DeLorean
--   'specific-offsets' : surgeon-level precision, partition by partition
--   'group-offsets'    : let the consumer group remember where you left off
--
-- Example (add to your CREATE TABLE WITH clause):
--   'scan.startup.mode' = 'timestamp',
--   'scan.startup.timestamp-millis' = '1700000000000'
--
-- Squirrel's hot take: 'latest-offset' is for the brave,
-- 'earliest-offset' is for the thorough,
-- and 'timestamp' is for those who wish they had a time machine.
-- Choose wisely. Or don't. Flink will still run either way.
SELECT * FROM \`{EVENTS}\` LIMIT 5`,
    },
  ],
  completionModal: {
    subtitle: 'Time travel through your Kafka topic. No flux capacitor required:',
    steps: [
      {
        label: 'Produce some events',
        detail:
          'Click play on the EVENTS table to seed your topic with 20 events.',
      },
      {
        label: 'Read from the beginning',
        detail:
          'Run the first cell to consume all events from the earliest offset.',
      },
      {
        label: 'Explore startup modes',
        detail:
          'Read the second cell to learn how scan.startup.mode lets you pick your starting point.',
      },
    ],
  },
};
