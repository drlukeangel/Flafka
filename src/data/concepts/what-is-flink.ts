import type { ConceptContent } from '../../types/learn';

export const whatIsFlinkContent: ConceptContent = {
  animation: 'flink-basics',
  sections: [
    {
      heading: 'Apache Flink in a Nutshell',
      body: 'Apache Flink is a distributed stream processing engine that chews through events one at a time as they arrive, not in big boring batches hours later. Think of it as the difference between watching a live game and reading the box score the next morning. Flink handles stateful computations over continuous, unbounded data with exactly-once guarantees, which is a fancy way of saying it processes your streams correctly without losing or double-counting anything.',
    },
    {
      heading: 'Confluent Cloud Runs It So You Don\'t Have To',
      body: 'On Confluent Cloud, Flink is fully managed. No cluster provisioning, no JVM tuning, no 3 AM pages about crashed TaskManagers. You spin up a compute pool in your cloud region and start writing SQL. Confluent handles the scaling, resource allocation, and all the operational headaches that come with running distributed systems. You focus on the logic; they focus on keeping it alive.',
    },
    {
      heading: 'Why SQL?',
      body: 'Flink SQL lets you query streaming data using standard ANSI SQL syntax. If you can write a SELECT statement, you can process a stream. The catch is that your query never finishes because the input never ends. A Flink SQL query is a long-running statement that continuously produces results as new events flow in. Write a filter, and it filters forever. Write an aggregation, and it aggregates forever. It is oddly satisfying.',
    },
    {
      heading: 'Compute Pools and Statements',
      body: 'Your Flink workloads run inside compute pools, which are sets of managed resources measured in Confluent Flink Units. When you submit a SQL statement, it becomes a statement resource living in your pool, consuming compute as it runs. You can monitor, pause, resume, and stop statements through the UI, CLI, or API. For learning, a small pool is plenty. For production, size up based on throughput and query complexity.',
    },
    {
      heading: 'Streaming vs Batch: Pick Your Fighter',
      body: 'Traditional batch processing collects data, waits, processes it all at once, and gives you stale results. Stream processing handles events as they arrive, delivering results in milliseconds. Flink treats streaming as the fundamental model and batch as just streaming over bounded input. On Confluent Cloud, most workloads are streaming since they read from Kafka topics, but you can also run bounded queries that scan existing data and terminate when done.',
    },
  ],
};
