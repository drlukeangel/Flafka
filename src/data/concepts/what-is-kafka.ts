import type { ConceptContent } from '../../types/learn';

export const whatIsKafkaContent: ConceptContent = {
  animation: 'kafka-basics',
  sections: [
    {
      heading: 'What Kafka Actually Is (and Is Not)',
      body: 'Apache Kafka is a distributed event streaming platform — a system designed to move massive volumes of data between services in real time. It is NOT a database (though it can store data). It is NOT a message queue (though it can behave like one). It is a commit log: an append-only, ordered, durable sequence of records that multiple consumers can read independently without interfering with each other. On Confluent Cloud, Kafka is fully managed — no brokers to babysit, no ZooKeeper to wrangle, no replication factors to agonize over at 2am.',
    },
    {
      heading: 'Topics: Named Channels for Your Data',
      body: 'Kafka organizes data into topics. A topic is a named, append-only log — think of it as a conveyor belt that never stops and never rewinds (unless you ask it to). You might have a topic called "loan-applications" that receives every new loan submission, or "payment-events" that captures every payment across your system. Topics are the fundamental unit of organization. When you CREATE TABLE in Flink SQL on Confluent Cloud, you are creating (or connecting to) a Kafka topic.',
    },
    {
      heading: 'Partitions: How Kafka Scales',
      body: 'Each topic is divided into partitions — independent, ordered sub-logs that can live on different brokers. Partitions are the unit of parallelism. A topic with 6 partitions can be consumed by up to 6 consumers simultaneously, each reading from a different partition. When a producer sends a record with a key, Kafka hashes the key to determine which partition it lands in. Same key = same partition = guaranteed ordering within that partition. No key = round-robin across partitions = no ordering guarantee. This key-to-partition relationship is the most important concept in Kafka.',
    },
    {
      heading: 'Producers and Consumers',
      body: 'Producers write records to topics. They serialize your data (JSON, Avro, Protobuf) into bytes and ship them to the appropriate partition. Consumers read records from topics. They pull data in order within each partition, tracking their position with offsets. The critical insight: producers and consumers are completely decoupled. A producer does not know or care who reads its data. A consumer does not know or care who wrote the data. This decoupling is what makes Kafka architectures so flexible — you can add new consumers to an existing topic without changing anything about the producers.',
    },
    {
      heading: 'Offsets: Your Position in the Stream',
      body: 'Every record in a partition gets a sequential offset — a monotonically increasing integer that acts as a bookmark. Offset 0 is the first record ever written. Offset 1,000,000 is the millionth. When a consumer commits an offset, it tells Kafka: "I have processed everything up to here." If the consumer crashes and restarts, it picks up from the last committed offset. In Flink SQL, you control the starting position with the scan.startup.mode table property: earliest-offset to replay from the beginning, latest-offset to start from the live edge, or a specific timestamp to jump to a point in time.',
    },
    {
      heading: 'Retention: How Long Data Lives',
      body: 'Kafka topics have a retention policy — records are kept for a configurable duration (default 7 days on Confluent Cloud) or until the topic exceeds a size limit. After retention expires, old records are deleted. This is different from a database where data lives forever unless you explicitly delete it. For topics that represent entity state (like "current loan status per loan_id"), you can enable log compaction: Kafka keeps only the latest record per key and deletes older versions. Compacted topics act like key-value stores with Kafka durability.',
    },
    {
      heading: 'Why Confluent Cloud Changes Everything',
      body: 'Self-managed Kafka means provisioning brokers, tuning JVM heap sizes, monitoring under-replicated partitions, managing ZooKeeper (or KRaft), planning capacity, and handling upgrades with zero downtime. Confluent Cloud eliminates all of that. Your topics automatically become Flink SQL tables. Schemas register themselves in Schema Registry. Compute pools spin up in seconds. You write SQL instead of Java consumer loops. The infrastructure is invisible — you focus on the data and the logic, not the plumbing.',
    },
  ],
};
