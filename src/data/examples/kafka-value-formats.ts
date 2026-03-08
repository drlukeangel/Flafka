import type { KickstarterExampleDef } from '../../services/example-runner';

export const kafkaValueFormatsDef: KickstarterExampleDef = {
  id: 'kafka-value-formats',
  tables: [
    {
      name: 'AVRO-DATA',
      schema: 'format-avro',
      role: 'input',
      dataset: { generator: 'format-events', count: 10 },
      stream: 'produce-consume',
    },
    {
      name: 'JSON-DATA',
      schema: 'format-json',
      role: 'input',
      dataset: { generator: 'format-events', count: 10 },
      stream: 'produce-consume',
    },
    {
      name: 'RAW-DATA',
      schema: 'format-raw',
      role: 'input',
      dataset: { generator: 'format-raw-events', count: 10 },
      stream: 'produce-consume',
    },
  ],
  sql: [
    {
      label: 'read-avro',
      sql: `SELECT * FROM \`{AVRO-DATA}\`
-- Avro: the fancy one. Schema Registry backed. Type-safe.
-- Squirrel rating: 9/10 acorns.
-- Pros: compact binary, schema evolution, the grown-up choice.
-- Cons: you need a Schema Registry. Nothing is free in this world.
-- But seriously, if you're doing production Kafka, this is the way.`,
    },
    {
      label: 'read-json',
      sql: `SELECT * FROM \`{JSON-DATA}\`
-- JSON: the crowd favorite. Human-readable. Universally understood.
-- Squirrel rating: 7/10 acorns.
-- Pros: easy to debug, everyone knows JSON, no extra infra needed.
-- Cons: no schema enforcement — it's the Wild West out here.
-- One producer sends "age": 25, another sends "age": "twenty-five".
-- Good luck with that.`,
    },
    {
      label: 'read-raw-with-cast',
      sql: `SELECT
  CAST(raw_payload AS STRING) AS decoded_message,
  event_time
FROM \`{RAW-DATA}\`
-- Raw: just bytes. No schema. No structure. Pure anarchy.
-- Squirrel rating: 3/10 acorns (and that's generous).
-- You have to CAST everything yourself like some kind of caveman.
-- Useful for legacy systems, log lines, or when you've given up on life.
-- But hey, at least it's honest about what it is: a bag of bytes.`,
    },
  ],
  completionModal: {
    subtitle: 'Avro, JSON, and Raw walk into a Kafka topic:',
    steps: [
      {
        label: 'Produce all three formats',
        detail:
          'Click play on AVRO-DATA, JSON-DATA, and RAW-DATA to seed each topic.',
      },
      {
        label: 'Read each format',
        detail:
          'Run each cell to see how Flink handles Avro, JSON, and raw bytes differently.',
      },
      {
        label: 'Pick your favorite',
        detail:
          'Spoiler: Avro wins for production, JSON for prototyping, Raw for suffering.',
      },
    ],
  },
};
