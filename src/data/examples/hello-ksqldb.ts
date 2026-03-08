import type { KickstarterExampleDef } from '../../services/example-runner';

export const helloKsqldbDef: KickstarterExampleDef = {
  id: 'hello-ksqldb',
  tables: [
    {
      name: 'JOKES',
      schema: 'jokes',
      role: 'input',
      dataset: { generator: 'flat-jokes', count: 20 },
      stream: 'produce-consume',
    },
  ],
  sql: [
    {
      label: 'create-stream',
      engine: 'ksqldb',
      sql: `CREATE STREAM jokes_stream (
  joke_id STRING KEY,
  joke STRING,
  category STRING,
  rating STRING
) WITH (
  KAFKA_TOPIC = '{JOKES}',
  VALUE_FORMAT = 'JSON'
);

-- ============================================================
-- WHAT: Registers the JOKES Kafka topic as a ksqlDB STREAM.
-- WHY STREAM: In ksqlDB a STREAM is an append-only sequence of
-- events — perfect for reading a Kafka topic of joke records.
-- KEY: joke_id is the Kafka message key.
-- VALUE_FORMAT: Records are JSON encoded.
-- NOTE: The topic was already created by Flink. This just tells
-- ksqlDB how to read it — no data is copied or moved.
-- ============================================================`,
    },
    {
      label: 'read-jokes',
      engine: 'ksqldb',
      sql: `SELECT * FROM jokes_stream EMIT CHANGES;

-- ============================================================
-- WHAT: Push query — streams jokes as they arrive, never stops.
-- EMIT CHANGES: Makes this a push query (continuous streaming).
-- Without EMIT CHANGES it would be a pull query (one-shot).
-- GOTCHA: Produce data FIRST (click play on the stream card).
-- GOTCHA: Click Stop to cancel when you have seen enough.
-- ============================================================`,
    },
    {
      label: 'filter-best-jokes',
      engine: 'ksqldb',
      sql: `SELECT joke_id, joke, category
FROM jokes_stream
WHERE rating = 'ROFL'
EMIT CHANGES;

-- ============================================================
-- WHAT: Only streams jokes rated ROFL — server-side filter.
-- HOW: ksqlDB evaluates the WHERE on the server. Only matching
-- rows are sent to the client. Same topic, less data.
-- COMPARE: In Flink you would write:
--   SELECT joke_id, joke, category
--   FROM \`topic\` WHERE rating = 'ROFL'
-- The logic is nearly identical — the difference is EMIT CHANGES.
-- ============================================================`,
    },
    {
      label: 'count-by-category',
      engine: 'ksqldb',
      sql: `SELECT category, COUNT(*) AS joke_count
FROM jokes_stream
GROUP BY category
EMIT CHANGES;

-- ============================================================
-- WHAT: Running count of jokes per category, updated live.
-- HOW: ksqlDB maintains an in-memory aggregate. Each new joke
-- emits an updated row for its category.
-- NOTE: This is a push query — it never completes. The counts
-- update as new jokes arrive. Click Stop when done.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your first ksqlDB workspace is ready. Follow these steps:',
    steps: [
      { label: 'Register the stream', detail: 'Run the CREATE STREAM cell to tell ksqlDB about the JOKES topic.' },
      { label: 'Send some jokes', detail: 'Click play on the JOKES stream card to produce 20 joke records.' },
      { label: 'Stream all jokes', detail: 'Run the SELECT * EMIT CHANGES cell — jokes appear as they arrive.' },
      { label: 'Try the filter', detail: 'Run the ROFL filter cell — only the best jokes come through.' },
      { label: 'Live aggregation', detail: 'Run the GROUP BY cell — watch counts update in real time.' },
      { label: 'Stop when done', detail: 'Click Stop on any running push query to cancel it.' },
    ],
  },
};
