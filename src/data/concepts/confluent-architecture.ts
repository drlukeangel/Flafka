import type { ConceptContent } from '../../types/learn';

export const confluentArchitectureContent: ConceptContent = {
  animation: 'confluent-architecture',
  sections: [
    {
      heading: 'Environments: The Outermost Box',
      body: 'Everything on Confluent Cloud lives inside an environment. Think of it as a project folder that groups related resources together. You might have one environment for development, another for staging, and a third for production. Each environment gets its own Schema Registry instance, so schema evolution stays isolated across stages.',
    },
    {
      heading: 'Kafka Clusters: Where Data Lives',
      body: 'Inside each environment, you create one or more Kafka clusters. A cluster is your actual Kafka deployment, fully managed, with configurable throughput tiers (Basic, Standard, Dedicated, Enterprise). Your topics, partitions, and data all live here. Confluent handles replication across availability zones so you can focus on what the data means, not where it is stored.',
    },
    {
      heading: 'Flink Compute Pools: Where Logic Runs',
      body: 'Flink compute pools are provisioned inside an environment and sized in Confluent Flink Units (CFUs). A compute pool is the engine that runs your SQL statements. It does not store data, it just processes it. You can spin up multiple pools for different teams or workloads, and each pool scales independently based on demand.',
    },
    {
      heading: 'Schema Registry: The Data Contract Enforcer',
      body: 'Schema Registry lives at the environment level and manages Avro, Protobuf, and JSON schemas for your topics. When Flink SQL reads from or writes to a Kafka topic, it resolves the schema automatically from the registry. This means column names, types, and evolution rules are enforced without you writing a single line of serialization code.',
    },
    {
      heading: 'How It All Connects',
      body: 'The managed service model ties everything together. Your Kafka cluster stores the data, Schema Registry defines its shape, and Flink compute pools transform it with SQL. All three live in the same cloud region for low-latency communication. You never manage brokers, TaskManagers, or schema stores directly. Confluent runs the infrastructure, you write the logic.',
    },
  ],
};
