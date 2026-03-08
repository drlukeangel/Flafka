import type { KickstarterExampleDef } from '../../services/example-runner';

export const kafkaProduceConsumeDef: KickstarterExampleDef = {
  id: 'kafka-produce-consume',
  tables: [
    {
      name: 'MESSAGES',
      schema: 'kafka-messages',
      role: 'input',
      dataset: { generator: 'kafka-messages', count: 15 },
      stream: 'produce-consume',
    },
    {
      name: 'MESSAGES-BY-KEY',
      schema: 'kafka-messages',
      role: 'output',
      stream: 'consume',
    },
  ],
  sql: [
    {
      label: 'produce-keyed-messages',
      sql: `INSERT INTO \`{MESSAGES-BY-KEY}\`
SELECT
  user_id,
  message_body,
  category,
  ts
FROM \`{MESSAGES}\`
-- Squirrel PSA: the key is literally the key.
-- Kafka uses it to decide which partition gets your message.
-- Same key = same partition = guaranteed order.
-- Different key = different partition = chaos gremlin territory.
-- Choose your keys wisely or suffer the consequences.`,
    },
    {
      label: 'consume-by-key',
      sql: `SELECT
  user_id AS message_key,
  message_body,
  category,
  ts
FROM \`{MESSAGES-BY-KEY}\`
-- Now you can see messages grouped by their key (user_id).
-- Notice how messages with the same key arrive in order?
-- That's not a coincidence, that's partitioning doing its job.
-- Squirrel approves of deterministic ordering. Very nutty. Very good.`,
    },
  ],
  completionModal: {
    subtitle: 'Keys, partitions, and why order matters. Here we go:',
    steps: [
      {
        label: 'Produce keyed messages',
        detail:
          'Click play on the MESSAGES table to generate messages with user_id as the Kafka key.',
      },
      {
        label: 'Run the INSERT',
        detail:
          'Execute the first cell to route messages into MESSAGES-BY-KEY, preserving key semantics.',
      },
      {
        label: 'Read them back',
        detail:
          'Run the SELECT cell and observe how messages with the same key maintain their order.',
      },
    ],
  },
};
