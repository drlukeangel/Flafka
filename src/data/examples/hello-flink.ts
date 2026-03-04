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
      sql: 'SELECT * FROM `{JOKES}` LIMIT 20',
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
