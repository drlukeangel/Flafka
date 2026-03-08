import type { KickstarterExampleDef } from '../../services/example-runner';

export const helloFlinkDef: KickstarterExampleDef = {
  id: 'hello-flink',
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
      label: 'read-jokes',
      sql: `SELECT * FROM \`{JOKES}\` LIMIT 20

-- ============================================================
-- WHAT: Reads up to 20 joke records from the JOKES Kafka topic, then stops.
-- WHY LIMIT 20: Without LIMIT, Flink reads a Kafka stream FOREVER — it has no natural end.
-- GOTCHA: Produce data FIRST (click play on the stream card). If fewer than 20 records exist, the query hangs waiting.
-- GOTCHA: Table names with special characters need backticks (\`like-this\`). {JOKES} is replaced at runtime.
-- ============================================================`,
    },
  ],
  completionModal: {
    subtitle: 'Your first Flink job is ready. Follow these steps:',
    steps: [
      { label: 'Send some jokes', detail: 'Click ▶ on the JOKES stream card to produce 20 joke records into the topic.' },
      { label: 'Run the query', detail: 'Run the SELECT cell — jokes start streaming in with their ratings.' },
      { label: "You're streaming!", detail: "That's it. You just read a live Kafka topic with Flink SQL." },
    ],
  },
};
