import type { ConceptContent } from '../../types/learn';

export const streamsVsTablesContent: ConceptContent = {
  animation: 'streams-vs-tables',
  sections: [
    {
      heading: 'The Great Duality',
      body: 'Here is the mind-bending part: every stream is secretly a table, and every table is secretly a stream. A stream is an append-only log of things that happened. A table is what you get when you replay that log and accumulate the results. Count all the orders by customer in a stream, and you have a table. Capture every change to that table, and you have a stream again. It is turtles all the way down.',
    },
    {
      heading: 'Changelog Streams: Tables in Disguise',
      body: 'Every table in Flink is backed by a changelog stream under the hood. When you run a GROUP BY aggregation, Flink does not just spit out static rows. It emits a changelog: an insert when a key first appears, then retract-and-update pairs as the aggregate value changes. This changelog gets written to a Kafka topic in upsert mode, where the message key determines which row is being updated. If that sounds like a table with version history, you are catching on.',
    },
    {
      heading: 'How Flink SQL Treats Both Uniformly',
      body: 'The beautiful thing about Flink SQL is that you do not have to think about whether you are querying a stream or a table. You write SQL, and Flink figures out the execution strategy. A SELECT with a WHERE clause over raw events is a stateless stream filter. A SELECT with GROUP BY is a stateful table aggregation. Same syntax, wildly different internal behavior, zero headaches for you.',
    },
    {
      heading: 'INSERT INTO vs SELECT: Getting Results Out',
      body: 'A standalone SELECT query in Flink SQL is great for exploring data interactively, but the results vanish when you stop the query. To persist results, you use INSERT INTO to push output into a target table, which is really a Kafka topic. This is how you build pipelines: SELECT from one topic, transform the data, and INSERT INTO another. The source is a stream, the sink is a table-backed-by-a-stream, and the circle of duality continues.',
    },
  ],
};
