import type { LearningTrack } from '../types/learn';
import {
  whatIsFlinkContent,
  streamsVsTablesContent,
  whatIsKafkaContent,
  consumerGroupsContent,
  changelogModesContent,
  eventTimeWatermarksContent,
  joinTypesContent,
  stateManagementContent,
  confluentArchitectureContent,
  schemaGovernanceContent,
} from './concepts';

export const learningTracks: LearningTrack[] = [
  // Track 1: Getting Started with Flink SQL
  {
    id: 'getting-started',
    title: 'Getting Started with Flink SQL',
    description:
      'Learn the fundamentals of Flink SQL on Confluent Cloud. Write your first queries, filter streams, and understand the relationship between streams and tables.',
    icon: '🚀',
    skillLevel: 'Beginner',
    prerequisites: [],
    estimatedMinutes: 20,
    recommendedRoles: ['Data Engineer', 'Analytics Engineer'],
    lessons: [
      {
        id: 'getting-started-1',
        type: 'concept',
        title: 'What Is Flink SQL?',
        description:
          'Understand what Apache Flink is, how Confluent Cloud runs it as a fully managed service, and why SQL is the preferred interface for stream processing.',
        conceptContent: whatIsFlinkContent,
      },
      {
        id: 'getting-started-2',
        type: 'example',
        exampleId: 'hello-flink',
        title: 'Hello Flink',
        description:
          'Run your very first Flink SQL query and see streaming results in real time.',
      },
      {
        id: 'getting-started-3',
        type: 'example',
        exampleId: 'good-jokes',
        title: 'Good Jokes',
        description:
          'Practice basic SELECT and WHERE clauses with a fun dataset of jokes.',
      },
      {
        id: 'getting-started-4',
        type: 'example',
        exampleId: 'loan-filter',
        title: 'Loan Filter',
        description:
          'Apply filters and projections on a loan applications stream to find records that match criteria.',
      },
      {
        id: 'getting-started-5',
        type: 'concept',
        title: 'Streams vs Tables',
        description:
          'Discover the fundamental duality between streams and tables, and how Flink SQL unifies them.',
        conceptContent: streamsVsTablesContent,
      },
    ],
  },

  // Track 2: Kafka Fundamentals
  {
    id: 'kafka-fundamentals',
    title: 'Kafka Fundamentals',
    description:
      'Understand Apache Kafka from the inside out — topics, partitions, keys, ordering guarantees, consumer groups, changelog semantics, and serialization formats. Every concept is paired with a hands-on Flink SQL example you can run immediately.',
    icon: '📊',
    skillLevel: 'Beginner',
    prerequisites: ['getting-started'],
    estimatedMinutes: 35,
    recommendedRoles: ['Data Engineer', 'Platform Engineer'],
    lessons: [
      {
        id: 'kafka-fundamentals-1',
        type: 'concept',
        title: 'What Is Kafka?',
        description:
          'The distributed commit log that powers every modern streaming architecture. Learn topics, partitions, producers, consumers, offsets, retention, and why Confluent Cloud changes the operational equation entirely.',
        conceptContent: whatIsKafkaContent,
      },
      {
        id: 'kafka-fundamentals-2',
        type: 'example',
        exampleId: 'kafka-produce-consume',
        title: 'Kafka Produce & Consume',
        description:
          'Produce messages with explicit keys into a topic, then SELECT to consume them. See firsthand how the message key controls partition assignment and guarantees ordering — the foundation of everything else in Kafka.',
      },
      {
        id: 'kafka-fundamentals-3',
        type: 'example',
        exampleId: 'kafka-startup-modes',
        title: 'Kafka Startup Modes',
        description:
          'Control exactly where Flink begins reading: earliest-offset replays all history, latest-offset skips to the live edge, timestamp jumps to a precise moment. Understand when and why you would choose each mode.',
      },
      {
        id: 'kafka-fundamentals-4',
        type: 'concept',
        title: 'Consumer Groups & Offsets',
        description:
          'How multiple consumers divide work across partitions, track independent progress with offsets, and coordinate automatically. Plus: why Flink manages consumer groups differently than standard Kafka clients — and what that means for monitoring.',
        conceptContent: consumerGroupsContent,
      },
      {
        id: 'kafka-fundamentals-5',
        type: 'concept',
        title: 'Changelog Modes: Append vs Upsert',
        description:
          'The single most important concept for understanding how Flink SQL tables map to Kafka topics. Watch the animated side-by-side comparison: same events flow in, but append mode produces an ever-growing log while upsert mode maintains a compact state table.',
        conceptContent: changelogModesContent,
      },
      {
        id: 'kafka-fundamentals-6',
        type: 'example',
        exampleId: 'kafka-changelog-modes',
        title: 'Changelog Modes: Hands-On',
        description:
          'Now run it yourself. Feed identical data into an append-mode table and an upsert-mode table, then compare the row counts. The difference is dramatic — and now you know exactly why.',
      },
      {
        id: 'kafka-fundamentals-7',
        type: 'example',
        exampleId: 'kafka-value-formats',
        title: 'Serialization Formats: Avro vs JSON vs Raw',
        description:
          'Three tables, three formats, one comparison. Avro with Schema Registry gives you type safety and evolution. JSON gives you readability with zero enforcement. Raw gives you bytes and a prayer. Run all three and see the tradeoffs in real SQL output.',
      },
    ],
  },

  // Track 3: Windowing & Time
  {
    id: 'windowing-time',
    title: 'Windowing & Time',
    description:
      'Master time-based operations in Flink SQL. Learn tumbling, hopping, session, and cumulating windows along with watermarks and late data handling.',
    icon: '⏰',
    skillLevel: 'Intermediate',
    prerequisites: ['getting-started'],
    estimatedMinutes: 30,
    recommendedRoles: ['Data Engineer', 'Analytics Engineer'],
    lessons: [
      {
        id: 'windowing-time-1',
        type: 'concept',
        title: 'Event Time & Watermarks',
        description:
          'Learn how Flink tracks event time, what watermarks are, and how to handle late-arriving data.',
        conceptContent: eventTimeWatermarksContent,
      },
      {
        id: 'windowing-time-2',
        type: 'example',
        exampleId: 'loan-aggregate',
        title: 'Loan Aggregate',
        description:
          'Run continuous aggregations over a loan stream using tumbling windows.',
      },
      {
        id: 'windowing-time-3',
        type: 'example',
        exampleId: 'loan-hop-window',
        title: 'Loan Hop Window',
        description:
          'Use hopping (sliding) windows to compute overlapping time-based aggregations.',
      },
      {
        id: 'windowing-time-4',
        type: 'example',
        exampleId: 'loan-session-window',
        title: 'Loan Session Window',
        description:
          'Group events into sessions based on activity gaps using session windows.',
      },
      {
        id: 'windowing-time-5',
        type: 'example',
        exampleId: 'loan-cumulate-window',
        title: 'Loan Cumulate Window',
        description:
          'Build cumulative aggregations that grow within a maximum window size using cumulate windows.',
      },
      {
        id: 'windowing-time-6',
        type: 'example',
        exampleId: 'loan-late-payments',
        title: 'Loan Late Payments',
        description:
          'Detect and handle late-arriving payment events using watermark strategies.',
      },
      {
        id: 'windowing-time-7',
        type: 'example',
        exampleId: 'loan-time-range-stats',
        title: 'Loan Time Range Stats',
        description:
          'Compute statistics over custom time ranges and combine multiple window strategies.',
      },
    ],
  },

  // Track 4: Joins & Enrichment
  {
    id: 'joins-enrichment',
    title: 'Joins & Enrichment',
    description:
      'Combine and enrich streaming data using regular joins, temporal joins, interval joins, and lookup joins in Flink SQL.',
    icon: '🔗',
    skillLevel: 'Intermediate',
    prerequisites: ['getting-started'],
    estimatedMinutes: 25,
    recommendedRoles: ['Data Engineer', 'Analytics Engineer'],
    lessons: [
      {
        id: 'joins-enrichment-1',
        type: 'concept',
        title: 'Join Types in Flink SQL',
        description:
          'Understand the different join strategies available in Flink SQL and when to use each one.',
        conceptContent: joinTypesContent,
      },
      {
        id: 'joins-enrichment-2',
        type: 'example',
        exampleId: 'loan-join',
        title: 'Loan Join',
        description:
          'Perform a regular stream-to-stream join to combine loan applications with borrower data.',
      },
      {
        id: 'joins-enrichment-3',
        type: 'example',
        exampleId: 'loan-coborrower-unnest',
        title: 'Loan Co-Borrower Unnest',
        description:
          'Use CROSS JOIN UNNEST to flatten nested arrays and work with complex data structures.',
      },
      {
        id: 'joins-enrichment-4',
        type: 'example',
        exampleId: 'loan-temporal-join',
        title: 'Loan Temporal Join',
        description:
          'Use temporal joins to look up the correct version of a slowly-changing dimension at event time.',
      },
      {
        id: 'joins-enrichment-5',
        type: 'example',
        exampleId: 'loan-interval-join',
        title: 'Loan Interval Join',
        description:
          'Join two streams within a bounded time interval to correlate related events.',
      },
      {
        id: 'joins-enrichment-6',
        type: 'example',
        exampleId: 'loan-stream-enrichment',
        title: 'Loan Stream Enrichment',
        description:
          'Enrich a loan stream with reference data from multiple sources in a single pipeline.',
      },
      {
        id: 'joins-enrichment-7',
        type: 'example',
        exampleId: 'loan-property-lookup',
        title: 'Loan Property Lookup',
        description:
          'Use lookup joins to enrich streaming loan data with property valuation details from an external table.',
      },
    ],
  },

  // Track 5: Stateful Processing
  {
    id: 'stateful-processing',
    title: 'Stateful Processing',
    description:
      'Explore advanced stateful stream processing patterns: deduplication, CDC pipelines, running aggregates, change detection, and pattern matching.',
    icon: '📚',
    skillLevel: 'Advanced',
    prerequisites: ['windowing-time', 'joins-enrichment'],
    estimatedMinutes: 35,
    recommendedRoles: ['Data Engineer'],
    lessons: [
      {
        id: 'stateful-processing-1',
        type: 'concept',
        title: 'State Management in Flink SQL',
        description:
          'Learn how Flink manages state for stateful operators, TTL configuration, and best practices for production workloads.',
        conceptContent: stateManagementContent,
      },
      {
        id: 'stateful-processing-2',
        type: 'example',
        exampleId: 'loan-dedup',
        title: 'Loan Deduplication',
        description:
          'Remove duplicate loan events from a stream using ROW_NUMBER and keyed state.',
      },
      {
        id: 'stateful-processing-3',
        type: 'example',
        exampleId: 'loan-cdc-pipeline',
        title: 'Loan CDC Pipeline',
        description:
          'Build a Change Data Capture pipeline that tracks inserts, updates, and deletes on loan records.',
      },
      {
        id: 'stateful-processing-4',
        type: 'example',
        exampleId: 'loan-running-aggregate',
        title: 'Loan Running Aggregate',
        description:
          'Compute running totals, counts, and averages that update with every new event.',
      },
      {
        id: 'stateful-processing-5',
        type: 'example',
        exampleId: 'loan-change-detection',
        title: 'Loan Change Detection',
        description:
          'Detect meaningful changes in loan status or terms by comparing current and previous state.',
      },
      {
        id: 'stateful-processing-6',
        type: 'example',
        exampleId: 'loan-pattern-match',
        title: 'Loan Pattern Match',
        description:
          'Use MATCH_RECOGNIZE to detect complex event patterns like fraud sequences or escalation paths.',
      },
      {
        id: 'stateful-processing-7',
        type: 'example',
        exampleId: 'loan-borrower-payments',
        title: 'Loan Borrower Payments',
        description:
          'Track per-borrower payment history using keyed state and generate payment summaries.',
      },
    ],
  },

  // Track 6: Views & Architecture
  {
    id: 'views-architecture',
    title: 'Views & Architecture',
    description:
      'Design production-ready streaming architectures with materialized views, golden records, risk scoring, AI drift detection, and dynamic routing.',
    icon: '🏗️',
    skillLevel: 'Advanced',
    prerequisites: ['windowing-time', 'joins-enrichment'],
    estimatedMinutes: 30,
    recommendedRoles: ['Analytics Engineer'],
    lessons: [
      {
        id: 'views-architecture-1',
        type: 'example',
        exampleId: 'view-golden-record',
        title: 'Golden Record View',
        description:
          'Build a single source of truth by merging data from multiple upstream sources into a golden record.',
      },
      {
        id: 'views-architecture-2',
        type: 'example',
        exampleId: 'view-credit-risk',
        title: 'Credit Risk View',
        description:
          'Create a real-time credit risk scoring view that combines borrower history, loan terms, and market data.',
      },
      {
        id: 'views-architecture-3',
        type: 'example',
        exampleId: 'view-ai-drift',
        title: 'AI Drift Detection View',
        description:
          'Monitor ML model predictions in real time and detect feature or prediction drift as it happens.',
      },
      {
        id: 'views-architecture-4',
        type: 'example',
        exampleId: 'view-early-warning',
        title: 'Early Warning View',
        description:
          'Build an early warning system that detects anomalous loan patterns before they become defaults.',
      },
      {
        id: 'views-architecture-5',
        type: 'example',
        exampleId: 'view-mbs-pricing',
        title: 'MBS Pricing View',
        description:
          'Compute real-time mortgage-backed security pricing from underlying loan pool performance data.',
      },
      {
        id: 'views-architecture-6',
        type: 'example',
        exampleId: 'loan-routing-json',
        title: 'Dynamic Event Routing (JSON)',
        description:
          'Route loan events to department topics using temporal joins, UNNEST fan-out, and EXECUTE STATEMENT SET.',
      },
    ],
  },

  // Track 7: Confluent Cloud Platform
  {
    id: 'confluent-cloud',
    title: 'Confluent Cloud Platform',
    description:
      'Master Confluent Cloud-specific capabilities: schema management, schema evolution, connectors, and platform governance features.',
    icon: '☁️',
    skillLevel: 'Intermediate',
    prerequisites: ['getting-started', 'kafka-fundamentals'],
    estimatedMinutes: 25,
    recommendedRoles: ['Platform Engineer'],
    lessons: [
      {
        id: 'confluent-cloud-1',
        type: 'concept',
        title: 'Confluent Cloud Architecture',
        description:
          'Understand how Confluent Cloud orchestrates Kafka clusters, Flink compute pools, Schema Registry, and connectors.',
        conceptContent: confluentArchitectureContent,
      },
      {
        id: 'confluent-cloud-2',
        type: 'example',
        exampleId: 'loan-schemaless-topic',
        title: 'Schemaless Topic',
        description:
          'Work with topics that have no registered schema and handle raw JSON payloads in Flink SQL.',
      },
      {
        id: 'confluent-cloud-3',
        type: 'example',
        exampleId: 'loan-schema-override',
        title: 'Schema Override',
        description:
          'Override the inferred schema from Schema Registry with custom column definitions in Flink SQL.',
      },
      {
        id: 'confluent-cloud-4',
        type: 'example',
        exampleId: 'kafka-schema-evolution',
        title: 'Kafka Schema Evolution',
        description:
          'Evolve schemas safely by adding, removing, or modifying fields while maintaining compatibility.',
      },
      {
        id: 'confluent-cloud-5',
        type: 'example',
        exampleId: 'confluent-connector-bridge',
        title: 'Confluent Connector Bridge',
        description:
          'Bridge data between external systems and Kafka using Confluent managed connectors with Flink SQL.',
      },
      {
        id: 'confluent-cloud-6',
        type: 'concept',
        title: 'Schema Governance',
        description:
          'Learn how Schema Registry enforces compatibility rules and enables safe, governed schema evolution.',
        conceptContent: schemaGovernanceContent,
      },
    ],
  },
];
