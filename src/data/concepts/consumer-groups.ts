import type { ConceptContent } from '../../types/learn';

export const consumerGroupsContent: ConceptContent = {
  animation: 'consumer-groups',
  sections: [
    {
      heading: 'The Problem Consumer Groups Solve',
      body: 'Imagine a topic with 1 million records per second across 12 partitions. A single consumer cannot keep up. You need parallelism. But you also need guarantees: every record must be processed exactly once, with no gaps and no duplicates. Consumer groups solve this by coordinating multiple consumers so that each partition is assigned to exactly one consumer in the group. Add consumers to scale out. Remove consumers and Kafka redistributes the work automatically. The group acts as a single logical subscriber.',
    },
    {
      heading: 'How Partition Assignment Works',
      body: 'When consumers join a group, Kafka runs a partition assignment protocol. With 12 partitions and 3 consumers, each consumer gets 4 partitions. With 6 consumers, each gets 2. With 12 consumers, each gets 1. With 13 consumers, one sits idle — there is no partition to assign. This is why the number of partitions sets the upper bound on consumer parallelism. Kafka rebalances assignments whenever a consumer joins, leaves, or crashes. During a rebalance, consumption pauses briefly while partitions are redistributed.',
    },
    {
      heading: 'Independent Group Progress',
      body: 'Each consumer group tracks its own set of offsets independently. Two different applications — say, a real-time dashboard and a batch analytics pipeline — can read the same topic at completely different speeds without interfering. The dashboard group might be at offset 5,000,000 (processing in real time) while the analytics group is at offset 3,000,000 (catching up from yesterday). They share the same topic data but have completely separate progress markers. This is one of Kafka\'s most powerful features: one topic, many independent consumers.',
    },
    {
      heading: 'Commit Strategies: Auto vs Manual',
      body: 'Auto-commit: offsets are committed on a timer (default every 5 seconds). Simple but risky — if the consumer crashes between a commit and actually processing the records, those records are lost. Manual commit: the consumer explicitly commits after processing. Stronger delivery guarantees but more code to write. At-least-once semantics (process, then commit) guarantee no data loss but may reprocess records after a crash. Exactly-once requires either idempotent processing or transactional commits — which is what Flink provides through its checkpointing mechanism.',
    },
    {
      heading: 'How Flink SQL Handles Consumer Groups Differently',
      body: 'Here is the twist: Flink SQL does NOT use standard Kafka consumer group mechanics the way a typical Java application would. Flink creates internal consumer groups for coordination, but manages offsets through its own checkpoint and savepoint system. This means you will NOT see Flink consumer lag in the standard Confluent Cloud consumer group monitoring dashboard. You will not find Flink\'s committed offsets in the __consumer_offsets topic. Flink tracks progress in its own state backend, which is why it can provide exactly-once guarantees that standard consumers cannot.',
    },
    {
      heading: 'What You Cannot Observe (and Why That Is OK)',
      body: 'Because Flink manages offsets internally, several familiar Kafka operations do not work: you cannot manually reset consumer group offsets with kafka-consumer-groups.sh, you cannot view per-partition lag through standard monitoring, and you cannot use consumer group rebalancing strategies (sticky, cooperative, etc.). Instead, you manage Flink\'s starting position via scan.startup.mode at table creation time. If you need to reprocess data, you change the startup mode and restart the query — Flink handles the rest. Trust the Flink statement lifecycle, not the consumer group dashboard.',
    },
  ],
};
