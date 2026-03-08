/**
 * @examples-panel
 * Example cards for the Examples panel.
 * Each card has importable SQL, a description, and tags.
 *
 * getExampleCards() resolves <artifact-id>/<version-id> placeholders
 * with real artifact data from the store when available.
 */

import type { ExampleCard, FlinkArtifact } from '../types';
import { isKsqlConfigured } from '../config/environment';
import {
  setupScalarExtractExample,
  setupJavaTableExplodeExample,
  setupAggregateUdfExample,
  setupValidationExample,
  setupPiiMaskingExample,
  setupAsyncEnrichmentExample,
} from '../services/example-setup';
import { runKickstarterExample } from '../services/example-runner';
import { helloFlinkDef } from './examples/hello-flink';
import { helloKsqldbDef } from './examples/hello-ksqldb';
import { ksqlDynamicRoutingDef } from './examples/ksql-dynamic-routing';
import { ksqlDynamicRoutingJsonDef } from './examples/ksql-dynamic-routing-json';
import { goodJokesDef } from './examples/good-jokes';
import { loanFilterDef } from './examples/loan-filter';
import { loanAggregateDef } from './examples/loan-aggregate';
import { loanJoinDef } from './examples/loan-join';
import { loanTemporalJoinDef } from './examples/loan-temporal-join';
import { loanDedupDef } from './examples/loan-dedup';
import { loanTopNDef } from './examples/loan-top-n';
import { loanHopWindowDef } from './examples/loan-hop-window';
import { loanSessionWindowDef } from './examples/loan-session-window';
import { loanCdcPipelineDef } from './examples/loan-cdc-pipeline';
import { loanPatternMatchDef } from './examples/loan-pattern-match';
import { loanRunningAggregateDef } from './examples/loan-running-aggregate';
import { loanChangeDetectionDef } from './examples/loan-change-detection';
import { loanIntervalJoinDef } from './examples/loan-interval-join';
import { loanStreamEnrichmentDef } from './examples/loan-stream-enrichment';
import { loanSchemalessTopicDef } from './examples/loan-schemaless-topic';
import { loanSchemaOverrideDef } from './examples/loan-schema-override';
import { loanDataMaskingDef } from './examples/loan-data-masking';
import { viewGoldenRecordDef } from './examples/view-golden-record';
import { viewCreditRiskDef } from './examples/view-credit-risk';
import { viewAiDriftDef } from './examples/view-ai-drift';
import { viewEarlyWarningDef } from './examples/view-early-warning';
import { viewMbsPricingDef } from './examples/view-mbs-pricing';
import { loanCumulateWindowDef } from './examples/loan-cumulate-window';
import { loanCoborrowerUnnestDef } from './examples/loan-coborrower-unnest';
import { loanMultiRegionMergeDef } from './examples/loan-multi-region-merge';
import { loanPropertyLookupDef } from './examples/loan-property-lookup';
import { loanLatePaymentsDef } from './examples/loan-late-payments';
import { loanTimeRangeStatsDef } from './examples/loan-time-range-stats';
import { loanEventFanoutDef } from './examples/loan-event-fanout';
import { loanRoutingJsonDef } from './examples/loan-routing-json';
import { loanRoutingAvroDef } from './examples/loan-routing-avro';
import { loanBorrowerPaymentsDef } from './examples/loan-borrower-payments';
import { kafkaProduceConsumeDef } from './examples/kafka-produce-consume';
import { kafkaStartupModesDef } from './examples/kafka-startup-modes';
import { kafkaChangelogModesDef } from './examples/kafka-changelog-modes';
import { kafkaValueFormatsDef } from './examples/kafka-value-formats';
import { kafkaSchemaEvolutionDef } from './examples/kafka-schema-evolution';
import { confluentConnectorBridgeDef } from './examples/confluent-connector-bridge';
import { useWorkspaceStore } from '../store/workspaceStore';
import { kickstarterDocs } from './examples/docs';

/** Build example cards, substituting real artifact IDs when available. */
export function getExampleCards(_artifacts: FlinkArtifact[]): ExampleCard[] {
  return ([
    // --- Basics ---
    {
      id: 'hello-flink',
      category: 'kickstart' as const,
      group: 'Basics',
      skillLevel: 'Beginner',
      title: 'Hello Flink',
      description: 'Your first Flink job — streams 20 jokes into a topic and reads them back. No setup required.',
      sql: 'SELECT * FROM `{rid}-JOKES` LIMIT 20',
      tags: ['Quick Start', 'Hello World', 'Streaming'],
      documentation: kickstarterDocs['hello-flink'],
      completionModal: helloFlinkDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(helloFlinkDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'hello-ksqldb',
      category: 'kickstart' as const,
      group: 'Basics',
      skillLevel: 'Beginner',
      title: 'Hello ksqlDB',
      description: 'Your first ksqlDB query — same jokes topic, but read with ksqlDB push queries, filters, and live aggregations.',
      sql: "SELECT * FROM jokes_stream EMIT CHANGES;",
      tags: ['Quick Start', 'Hello World', 'ksqlDB', 'Push Query'],
      documentation: kickstarterDocs['hello-ksqldb'],
      completionModal: helloKsqldbDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(helloKsqldbDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'ksql-dynamic-routing',
      category: 'kickstart' as const,
      group: 'Joins',
      skillLevel: 'Advanced',
      stateful: true,
      title: 'Dynamic Routing (ksqlDB)',
      description: 'Same fan-out routing pattern as the Flink version, but built entirely in ksqlDB. EXPLODE replaces CROSS JOIN UNNEST, stream-table joins are temporal by default.',
      sql: `CREATE STREAM routed_events_ksql AS
SELECT e.event_id, EXPLODE(r.target_topics) AS target_topic,
  e.loan_id, e.event_type, e.amount, e.department
FROM loan_events_ksql e
  INNER JOIN routing_rules_ksql r ON e.event_type = r.event_type
EMIT CHANGES;`,
      tags: ['Quick Start', 'ksqlDB', 'Dynamic Routing', 'Fan-Out', 'EXPLODE', 'Stream-Table Join'],
      documentation: kickstarterDocs['ksql-dynamic-routing'],
      completionModal: ksqlDynamicRoutingDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(ksqlDynamicRoutingDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'ksql-dynamic-routing-json',
      category: 'kickstart' as const,
      group: 'Joins',
      skillLevel: 'Advanced',
      stateful: true,
      title: 'Dynamic Routing JSON (ksqlDB)',
      description: 'Same fan-out routing as the Avro ksqlDB variant, but with VALUE_FORMAT = \'JSON\'. No STRUCT KEY, no KEY_SCHEMA_FULL_NAME — much simpler DDL. Compare both to see the Avro vs JSON trade-offs.',
      sql: `CREATE STREAM routed_events_ksql_json AS
SELECT e.event_id, EXPLODE(r.target_topics) AS target_topic,
  e.loan_id, e.event_type, e.amount, e.department
FROM loan_events_ksql e
  INNER JOIN routing_rules_ksql r ON e.event_type = r.event_type
EMIT CHANGES;`,
      tags: ['Quick Start', 'ksqlDB', 'Dynamic Routing', 'Fan-Out', 'EXPLODE', 'JSON'],
      documentation: kickstarterDocs['ksql-dynamic-routing-json'],
      completionModal: ksqlDynamicRoutingJsonDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(ksqlDynamicRoutingJsonDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'good-jokes',
      category: 'kickstart' as const,
      group: 'Basics',
      skillLevel: 'Beginner',
      title: 'Good Jokes Filter',
      description: "Filter a jokes stream — LOL, ROFL, and DEAD ratings flow to GOOD-JOKES. GROAN and MEH get dropped.",
      sql: "INSERT INTO `{rid}-GOOD-JOKES`\nSELECT * FROM `{rid}-JOKES`\nWHERE rating IN ('LOL', 'ROFL', 'DEAD')",
      tags: ['Quick Start', 'Filter', 'Streaming'],
      documentation: kickstarterDocs['good-jokes'],
      completionModal: goodJokesDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(goodJokesDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-filter',
      category: 'kickstart' as const,
      group: 'Basics',
      skillLevel: 'Beginner',
      title: 'Loan Filter',
      description:
        'Only care about approved loans? One WHERE clause and Flink drops everything else in real-time. Sub-second latency, zero code.',
      sql: `INSERT INTO \`{rid}-LOANS-FILTERED\`
SELECT CAST(loan_id AS BYTES) AS \`key\`, loan_id, amount, status, created_at, txn_id, customer_id
FROM \`{rid}-LOANS\`
WHERE status = 'APPROVED'`,
      tags: ['Quick Start', 'Filter', 'Streaming'],
      documentation: kickstarterDocs['loan-filter'],
      completionModal: loanFilterDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanFilterDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-coborrower-unnest',
      category: 'kickstart' as const,
      group: 'Basics',
      skillLevel: 'Beginner',
      title: 'Co-Borrower UNNEST',
      description: 'A single loan lists multiple co-borrowers in an ARRAY column. CROSS JOIN UNNEST explodes them into one row per borrower — no UDF needed.',
      sql: `SELECT l.loan_id, t.name AS borrower_name, t.score AS credit_score
FROM \`{rid}-LOAN-COBORROWERS\` l
CROSS JOIN UNNEST(l.coborrower_names, l.coborrower_scores) AS t(name, score)`,
      tags: ['Quick Start', 'UNNEST', 'Array'],
      documentation: kickstarterDocs['loan-coborrower-unnest'],
      completionModal: loanCoborrowerUnnestDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanCoborrowerUnnestDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-multi-region-merge',
      category: 'kickstart' as const,
      group: 'Basics',
      skillLevel: 'Beginner',
      title: 'Multi-Region Merge',
      description: 'Three regional loan feeds need to become one unified stream. UNION ALL merges them — zero transformation, zero code.',
      sql: `INSERT INTO \`{rid}-LOANS-UNIFIED\`
SELECT * FROM \`{rid}-LOANS-NORTHEAST\`
UNION ALL SELECT * FROM \`{rid}-LOANS-SOUTHEAST\`
UNION ALL SELECT * FROM \`{rid}-LOANS-WEST\``,
      tags: ['Quick Start', 'UNION ALL', 'Multi-Source'],
      documentation: kickstarterDocs['loan-multi-region-merge'],
      completionModal: loanMultiRegionMergeDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanMultiRegionMergeDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-event-fanout',
      category: 'kickstart' as const,
      group: 'Basics',
      skillLevel: 'Beginner',
      title: 'Static Event Fan-Out',
      description: 'Route loan lifecycle events to department-specific topics using hardcoded WHERE clauses. Simple, explicit, zero dependencies.',
      sql: `INSERT INTO \`{rid}-EVENTS-UNDERWRITING\`
SELECT * FROM \`{rid}-LOAN-EVENTS\`
WHERE event_type = 'NEW_LOAN'`,
      tags: ['Quick Start', 'Fan-Out', 'WHERE Routing'],
      documentation: kickstarterDocs['loan-event-fanout'],
      completionModal: loanEventFanoutDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanEventFanoutDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Windows ---
    {
      id: 'loan-aggregate',
      group: 'Windows',
      skillLevel: 'Intermediate',
      title: 'Loan Aggregate',
      description:
        'How many loans per status? How much money? Get live dashboard metrics every 20 seconds with tumbling windows.',
      sql: `INSERT INTO \`{rid}-LOANS-STATS\`
SELECT status, COUNT(*) AS loan_count, SUM(amount) AS total_amount
FROM TABLE(TUMBLE(TABLE \`{rid}-LOANS\`, DESCRIPTOR($rowtime), INTERVAL '20' SECOND))
GROUP BY window_start, window_end, status`,
      category: 'kickstart' as const,
      tags: ['Quick Start', 'Aggregation', 'Window'],
      documentation: kickstarterDocs['loan-aggregate'],
      completionModal: loanAggregateDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanAggregateDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-hop-window',
      category: 'kickstart' as const,
      group: 'Windows',
      skillLevel: 'Intermediate',
      title: 'Hop Window (Sliding)',
      description: 'Tumbling windows show choppy snapshots. Hop windows slide smoothly — "last 60 seconds, updated every 10." Your ops dashboard will love this.',
      sql: `INSERT INTO \`{rid}-LOANS-HOP-STATS\`
SELECT
  CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status) AS BYTES) as \`key\`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
  status,
  COUNT(*) as loan_count,
  SUM(amount) as total_amount,
  CAST(AVG(amount) AS DOUBLE) as avg_amount
FROM TABLE(
  HOP(TABLE \`{rid}-LOANS\`, DESCRIPTOR($rowtime), INTERVAL '10' SECOND, INTERVAL '60' SECOND)
)
GROUP BY window_start, window_end, status`,
      tags: ['Quick Start', 'Windowed'],
      documentation: kickstarterDocs['loan-hop-window'],
      completionModal: loanHopWindowDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanHopWindowDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-session-window',
      category: 'kickstart' as const,
      group: 'Windows',
      skillLevel: 'Intermediate',
      title: 'Session Window',
      description: '3 loans in a burst, then silence, then 2 more — that\'s two sessions. Fixed windows can\'t see this. Session windows can.',
      sql: `INSERT INTO \`{rid}-LOANS-SESSIONS\`
SELECT
  CAST(CONCAT(customer_id, '-', DATE_FORMAT(session_start, 'yyyy-MM-dd HH:mm:ss')) AS BYTES) as \`key\`,
  customer_id,
  DATE_FORMAT(session_start, 'yyyy-MM-dd HH:mm:ss') as session_start,
  DATE_FORMAT(session_end, 'yyyy-MM-dd HH:mm:ss') as session_end,
  COUNT(*) as loan_count,
  SUM(amount) as total_amount,
  CAST(AVG(amount) AS DOUBLE) as avg_amount
FROM \`{rid}-LOANS\`
GROUP BY customer_id, SESSION($rowtime, INTERVAL '30' SECOND)`,
      tags: ['Quick Start', 'Windowed'],
      documentation: kickstarterDocs['loan-session-window'],
      completionModal: loanSessionWindowDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanSessionWindowDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-top-n',
      category: 'kickstart' as const,
      group: 'Windows',
      skillLevel: 'Intermediate',
      title: 'Top-N Ranking',
      description: 'What are the 3 biggest loans right now? Real-time leaderboards that update every 30 seconds. Great for dashboards and anomaly alerts.',
      sql: `INSERT INTO \`{rid}-LOANS-TOP3\`
SELECT \`key\`, window_start, window_end, loan_id, amount, status, txn_id, customer_id, rank_num
FROM (
  SELECT
    CAST(CONCAT(DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss'), '-', status, '-', CAST(rownum AS STRING)) AS BYTES) as \`key\`,
    DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
    DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
    loan_id, amount, status, txn_id, customer_id, rownum as rank_num
  FROM (
    SELECT window_start, window_end, loan_id, amount, status, txn_id, customer_id,
      ROW_NUMBER() OVER (PARTITION BY window_start, window_end, status ORDER BY amount DESC) AS rownum
    FROM TABLE(
      TUMBLE(TABLE \`{rid}-LOANS\`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
    )
  )
  WHERE rownum <= 3
)`,
      tags: ['Quick Start', 'Windowed'],
      documentation: kickstarterDocs['loan-top-n'],
      completionModal: loanTopNDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanTopNDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-cumulate-window',
      category: 'kickstart' as const,
      group: 'Windows',
      skillLevel: 'Intermediate',
      title: 'CUMULATE Window',
      description: 'Need "today so far" dashboards? CUMULATE gives expanding windows that grow from 10s up to 1 min, then reset. Running intraday totals without batch.',
      sql: `INSERT INTO \`{rid}-DAILY-COMMITMENT-STATS\`
SELECT product_type, COUNT(*) AS commitment_count, SUM(principal) AS total_principal
FROM TABLE(CUMULATE(TABLE \`{rid}-LOAN-COMMITMENTS\`, DESCRIPTOR($rowtime), INTERVAL '10' SECOND, INTERVAL '1' MINUTE))
GROUP BY window_start, window_end, product_type`,
      tags: ['Quick Start', 'Window', 'CUMULATE'],
      documentation: kickstarterDocs['loan-cumulate-window'],
      completionModal: loanCumulateWindowDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanCumulateWindowDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-late-payments',
      category: 'kickstart' as const,
      group: 'Windows',
      skillLevel: 'Advanced',
      schema: true,
      title: 'Late Data & Watermarks',
      description: 'Payment reports arrive late — network delays, batch uploads, timezone issues. Override the schema with a WATERMARK, then see what gets processed vs what\'s too late.',
      sql: `CREATE TABLE ... (
  event_time AS TO_TIMESTAMP_LTZ(event_time_ms, 3),
  WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
)`,
      tags: ['Quick Start', 'Watermark', 'Late Data', 'Window'],
      documentation: kickstarterDocs['loan-late-payments'],
      completionModal: loanLatePaymentsDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanLatePaymentsDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Joins ---
    {
      id: 'loan-join',
      group: 'Joins',
      skillLevel: 'Intermediate',
      title: 'Loan Fraud Monitor',
      description:
        'Catch fraud the moment it happens. Joins every loan with its customer risk profile and flags suspicious activity instantly.',
      sql: `INSERT INTO \`{rid}-FRAUD-ALERTS\`
SELECT l.loan_id, c.name AS customer_name, c.risk_level,
  CASE WHEN c.risk_level = 'CRITICAL' THEN 'CRITICAL_RISK_CUSTOMER' ELSE 'LOW_RISK' END AS alert_reason
FROM \`{rid}-LOANS\` l
JOIN \`{rid}-CUSTOMERS\` c ON l.customer_id = c.customer_id`,
      category: 'kickstart' as const,
      tags: ['Quick Start', 'Join', 'Streaming'],
      documentation: kickstarterDocs['loan-join'],
      completionModal: loanJoinDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanJoinDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-temporal-join',
      group: 'Joins',
      skillLevel: 'Intermediate',
      title: 'Loan Enrichment',
      stateful: true,
      description:
        'What was the customer\'s credit score when they applied — not now, but then? Temporal joins give you point-in-time accuracy for audits and compliance.',
      sql: `INSERT INTO \`{rid}-LOANS-ENRICHED\`
SELECT l.loan_id, c.name AS customer_name, c.credit_score, c.state
FROM \`{rid}-LOANS\` l
JOIN \`{rid}-CUSTOMERS\` FOR SYSTEM_TIME AS OF l.\`$rowtime\` AS c
  ON l.customer_id = c.customer_id`,
      category: 'kickstart' as const,
      tags: ['Quick Start', 'Temporal Join', 'Streaming'],
      documentation: kickstarterDocs['loan-temporal-join'],
      completionModal: loanTemporalJoinDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanTemporalJoinDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-property-lookup',
      category: 'kickstart' as const,
      group: 'Joins',
      skillLevel: 'Intermediate',
      title: 'Property Lookup Join',
      description: 'Each loan references a property_id but needs the latest appraisal value and flood zone. Temporal join enriches every loan with current property data.',
      sql: `SELECT l.loan_id, l.property_id, l.amount, p.appraisal_value, p.flood_zone,
  l.amount / p.appraisal_value * 100 AS ltv_ratio
FROM \`{rid}-LOANS-WITH-PROPERTY\` l
JOIN \`{rid}-PROPERTY-REFERENCE\` FOR SYSTEM_TIME AS OF l.\`$rowtime\` AS p
  ON l.property_id = p.property_id`,
      tags: ['Quick Start', 'Lookup Join', 'Temporal Join'],
      documentation: kickstarterDocs['loan-property-lookup'],
      completionModal: loanPropertyLookupDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanPropertyLookupDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-borrower-payments',
      category: 'kickstart' as const,
      group: 'Joins',
      skillLevel: 'Intermediate',
      title: 'Payment Enrichment',
      description: 'High-volume payments need borrower context. Temporal join attaches borrower details (name, region, risk tier) to every payment — always current, zero staleness.',
      sql: `SELECT p.payment_id, p.borrower_id, b.name AS borrower_name, b.region, b.risk_tier, p.amount
FROM \`{rid}-PAYMENT-STREAM\` p
JOIN \`{rid}-BORROWER-REFERENCE\` FOR SYSTEM_TIME AS OF p.\`$rowtime\` AS b
  ON p.borrower_id = b.borrower_id`,
      tags: ['Quick Start', 'Temporal Join', 'Enrichment'],
      documentation: kickstarterDocs['loan-borrower-payments'],
      completionModal: loanBorrowerPaymentsDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanBorrowerPaymentsDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Patterns ---
    {
      id: 'loan-routing-json',
      category: 'kickstart' as const,
      group: 'Patterns',
      skillLevel: 'Advanced',
      stateful: true,
      title: 'Dynamic Event Routing (JSON)',
      description: 'Routes loan events to department topics using temporal joins, UNNEST fan-out, and EXECUTE STATEMENT SET — all consumers in one Flink job. JSON format.',
      sql: `EXECUTE STATEMENT SET
BEGIN
  INSERT INTO \`{rid}-UNDERWRITING\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{rid}-ROUTED-EVENTS\` WHERE target_topic = '{rid}-underwriting';
  INSERT INTO \`{rid}-FINANCE\`
    SELECT ...
END;`,
      tags: ['Quick Start', 'Routing', 'JSON', 'Statement Set', 'Temporal Join', 'UNNEST'],
      documentation: kickstarterDocs['loan-routing-json'],
      completionModal: loanRoutingJsonDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanRoutingJsonDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-routing-avro',
      category: 'kickstart' as const,
      group: 'Patterns',
      skillLevel: 'Advanced',
      stateful: true,
      title: 'Dynamic Event Routing (Avro)',
      description: 'Same routing pipeline using Avro serialization with Schema Registry. Compare with JSON variant to see format differences.',
      sql: `EXECUTE STATEMENT SET
BEGIN
  INSERT INTO \`{rid}-UNDERWRITING\`
    SELECT \`key\`, event_id, loan_id, event_type, amount, department
    FROM \`{rid}-ROUTED-EVENTS\` WHERE target_topic = '{rid}-underwriting';
  INSERT INTO \`{rid}-FINANCE\`
    SELECT ...
END;`,
      tags: ['Quick Start', 'Routing', 'Avro', 'Statement Set', 'Temporal Join', 'UNNEST'],
      documentation: kickstarterDocs['loan-routing-avro'],
      completionModal: loanRoutingAvroDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanRoutingAvroDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Stateful ---
    {
      id: 'loan-dedup',
      category: 'kickstart' as const,
      group: 'Stateful',
      skillLevel: 'Intermediate',
      title: 'Deduplication',
      stateful: true,
      description: 'Kafka says "at least once" — your billing system says "exactly once or we double-charge." ROW_NUMBER keeps the first, kills the rest.',
      sql: `INSERT INTO \`{rid}-LOANS-DEDUPED\`
SELECT \`key\`, loan_id, amount, status, created_at, txn_id, customer_id
FROM (
  SELECT
    CAST(loan_id AS BYTES) as \`key\`,
    loan_id, amount, status, created_at, txn_id, customer_id,
    ROW_NUMBER() OVER (PARTITION BY loan_id ORDER BY $rowtime ASC) AS rownum
  FROM \`{rid}-LOANS\`
)
WHERE rownum = 1`,
      tags: ['Quick Start', 'Pattern'],
      documentation: kickstarterDocs['loan-dedup'],
      completionModal: loanDedupDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanDedupDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-cdc-pipeline',
      category: 'kickstart' as const,
      group: 'Stateful',
      skillLevel: 'Advanced',
      title: 'CDC Pipeline',
      stateful: true,
      description: 'Database changes stream in via CDC — 50 updates for one customer. Downstream only wants the latest. Same ROW_NUMBER trick, opposite sort order.',
      sql: `INSERT INTO \`{rid}-CUSTOMERS-LATEST\`
SELECT
  CAST(customer_id AS BYTES) as \`key\`,
  customer_id, name, credit_score, state, risk_score, risk_level
FROM (
  SELECT customer_id, name, credit_score, state, risk_score, risk_level,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY $rowtime DESC) AS rownum
  FROM \`{rid}-CUSTOMERS\`
)
WHERE rownum = 1`,
      tags: ['Quick Start', 'Pattern'],
      documentation: kickstarterDocs['loan-cdc-pipeline'],
      completionModal: loanCdcPipelineDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanCdcPipelineDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-running-aggregate',
      category: 'kickstart' as const,
      group: 'Stateful',
      skillLevel: 'Advanced',
      title: 'Running Aggregate',
      stateful: true,
      description:
        'Every loan gets its own running scoreboard — total count, total dollars, running average. OVER windows give you per-row context without grouping anything away.',
      sql: `INSERT INTO \`{rid}-RUNNING-STATS\`
SELECT CAST(CONCAT(customer_id, '-', txn_id) AS BYTES) AS \`key\`,
  customer_id, txn_id, amount, status,
  COUNT(*) OVER w AS running_count,
  SUM(amount) OVER w AS running_total,
  CAST(AVG(amount) OVER w AS DOUBLE) AS running_avg
FROM \`{rid}-LOANS\`
WINDOW w AS (
  PARTITION BY customer_id ORDER BY $rowtime
  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
)`,
      tags: ['Quick Start', 'Stateful', 'Aggregation', 'OVER Window'],
      documentation: kickstarterDocs['loan-running-aggregate'],
      completionModal: loanRunningAggregateDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanRunningAggregateDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-change-detection',
      category: 'kickstart' as const,
      group: 'Stateful',
      skillLevel: 'Advanced',
      title: 'Change Detection',
      stateful: true,
      description:
        'SUBMITTED \u2192 PENDING \u2192 APPROVED — or did it go straight to DECLINED? LAG() compares each event to its predecessor and catches every status flip in real-time.',
      sql: `INSERT INTO \`{rid}-STATUS-CHANGES\`
SELECT CAST(CONCAT(customer_id, '-', txn_id) AS BYTES) AS \`key\`,
  customer_id, txn_id, loan_id, amount, prev_status, status AS current_status,
  prev_amount, amount - prev_amount AS amount_change
FROM (
  SELECT customer_id, txn_id, loan_id, amount, status,
    LAG(status) OVER w AS prev_status, LAG(amount) OVER w AS prev_amount
  FROM \`{rid}-LOANS\`
  WINDOW w AS (PARTITION BY customer_id ORDER BY $rowtime)
)
WHERE prev_status IS NOT NULL AND prev_status <> status`,
      tags: ['Quick Start', 'Stateful', 'Pattern', 'LAG'],
      documentation: kickstarterDocs['loan-change-detection'],
      completionModal: loanChangeDetectionDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanChangeDetectionDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-pattern-match',
      category: 'kickstart' as const,
      group: 'Stateful',
      skillLevel: 'Advanced',
      title: 'Pattern Match (Fraud)',
      stateful: true,
      description:
        '3 loan apps from the same customer in 10 seconds? That\'s not normal. MATCH_RECOGNIZE spots burst patterns and fires alerts before humans even notice.',
      sql: `INSERT INTO \`{rid}-PATTERN-ALERTS\`
SELECT CAST(customer_id AS BYTES) AS \`key\`,
  customer_id, first_txn, last_txn, app_count, total_amount,
  CAST(avg_amount AS DOUBLE) AS avg_amount, first_time, last_time
FROM \`{rid}-LOANS\`
MATCH_RECOGNIZE (
  PARTITION BY customer_id ORDER BY $rowtime
  MEASURES
    FIRST(A.txn_id) AS first_txn, LAST(A.txn_id) AS last_txn,
    COUNT(A.txn_id) AS app_count, SUM(A.amount) AS total_amount,
    AVG(A.amount) AS avg_amount,
    FIRST(A.$rowtime) AS first_time, LAST(A.$rowtime) AS last_time
  ONE ROW PER MATCH
  AFTER MATCH SKIP PAST LAST ROW
  PATTERN (A{3,})
  DEFINE A AS TRUE
)`,
      tags: ['Quick Start', 'Stateful', 'Pattern', 'CEP'],
      documentation: kickstarterDocs['loan-pattern-match'],
      completionModal: loanPatternMatchDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanPatternMatchDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-interval-join',
      category: 'kickstart' as const,
      group: 'Stateful',
      skillLevel: 'Advanced',
      title: 'Interval Join',
      stateful: true,
      description:
        'A loan and a customer event within 5 minutes of each other? That\'s a match. Interval joins correlate two streams by time proximity — no shared state table needed.',
      sql: `INSERT INTO \`{rid}-INTERVAL-JOINED\`
SELECT CAST(CONCAT(l.customer_id, '-', l.txn_id) AS BYTES) AS \`key\`,
  l.customer_id, l.txn_id, l.loan_id, l.amount, l.status,
  c.name AS customer_name, c.credit_score
FROM \`{rid}-LOANS\` l
JOIN \`{rid}-CUSTOMERS-STREAM\` c ON l.customer_id = c.customer_id
  AND c.$rowtime BETWEEN l.$rowtime - INTERVAL '5' MINUTE AND l.$rowtime + INTERVAL '5' MINUTE`,
      tags: ['Quick Start', 'Stateful', 'Join', 'Streaming'],
      documentation: kickstarterDocs['loan-interval-join'],
      completionModal: loanIntervalJoinDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanIntervalJoinDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-stream-enrichment',
      category: 'kickstart' as const,
      group: 'Stateful',
      skillLevel: 'Advanced',
      title: 'Stream Enrichment',
      stateful: true,
      description:
        'Every loan arrives with just a customer_id. The temporal join looks up the LATEST customer profile and attaches name + credit score — always current, zero staleness.',
      sql: `INSERT INTO \`{rid}-STREAM-ENRICHED\`
SELECT CAST(CONCAT(l.customer_id, '-', l.txn_id) AS BYTES) AS \`key\`,
  l.customer_id, l.txn_id, l.loan_id, l.amount, l.status,
  c.name AS customer_name, c.credit_score
FROM \`{rid}-LOANS\` l
JOIN \`{rid}-CUSTOMERS-LATEST\` FOR SYSTEM_TIME AS OF l.\`$rowtime\` AS c
  ON l.customer_id = c.customer_id`,
      tags: ['Quick Start', 'Stateful', 'Temporal Join', 'Streaming'],
      documentation: kickstarterDocs['loan-stream-enrichment'],
      completionModal: loanStreamEnrichmentDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanStreamEnrichmentDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-time-range-stats',
      category: 'kickstart' as const,
      group: 'Stateful',
      skillLevel: 'Advanced',
      stateful: true,
      title: 'OVER RANGE Window',
      description: 'How many loans has this customer applied for in the last 5 minutes? RANGE BETWEEN is time-based — perfect for velocity checks and rapid-fire application detection.',
      sql: `SELECT customer_id, loan_id, amount,
  COUNT(*) OVER w AS window_loan_count,
  SUM(amount) OVER w AS window_total_amount
FROM \`{rid}-LOANS\`
WINDOW w AS (PARTITION BY customer_id ORDER BY $rowtime
  RANGE BETWEEN INTERVAL '5' MINUTE PRECEDING AND CURRENT ROW)`,
      tags: ['Quick Start', 'OVER Window', 'RANGE', 'Velocity'],
      documentation: kickstarterDocs['loan-time-range-stats'],
      completionModal: loanTimeRangeStatsDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanTimeRangeStatsDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Schema ---
    {
      id: 'loan-schemaless-topic',
      category: 'kickstart' as const,
      group: 'Schema',
      skillLevel: 'Advanced',
      schema: true,
      title: 'Schemaless Topic',
      description:
        'Legacy systems and third-party feeds produce raw JSON with no Schema Registry. Learn to read and parse schemaless topics using value.format=\'raw\' and JSON_VALUE().',
      sql: `CREATE TABLE IF NOT EXISTS \`{rid}-RAW-EVENTS\` (
  \`val\` VARBINARY
) WITH (
  'connector' = 'confluent',
  'scan.startup.mode' = 'latest-offset',
  'value.format' = 'raw'
);

INSERT INTO \`{rid}-RAW-EVENTS-PARSED\`
SELECT
  CAST(JSON_VALUE(CAST(\`val\` AS STRING), '$.event_id') AS BYTES) AS \`key\`,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.event_id') AS event_id,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.event_type') AS event_type,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.user_id') AS user_id,
  CAST(JSON_VALUE(CAST(\`val\` AS STRING), '$.amount') AS DOUBLE) AS amount,
  JSON_VALUE(CAST(\`val\` AS STRING), '$.currency') AS currency,
  CAST(JSON_VALUE(CAST(\`val\` AS STRING), '$.timestamp') AS BIGINT) AS event_ts
FROM \`{rid}-RAW-EVENTS\`
WHERE JSON_VALUE(CAST(\`val\` AS STRING), '$.event_type') IS NOT NULL`,
      tags: ['Quick Start', 'Schema Handling', 'Streaming'],
      documentation: kickstarterDocs['loan-schemaless-topic'],
      completionModal: loanSchemalessTopicDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanSchemalessTopicDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-schema-override',
      category: 'kickstart' as const,
      group: 'Schema',
      skillLevel: 'Advanced',
      schema: true,
      title: 'Topic Schema Override',
      description:
        'Confluent Cloud auto-discovers schemas, but the auto table has no watermarks. Learn to override it with custom event-time support for windowing.',
      sql: `DROP TABLE IF EXISTS \`{rid}-LOANS\`;

CREATE TABLE \`{rid}-LOANS\` (
  \`key\` VARBINARY(2147483647),
  \`loan_id\` VARCHAR(2147483647) NOT NULL,
  \`amount\` DOUBLE NOT NULL,
  \`status\` VARCHAR(2147483647) NOT NULL,
  \`created_at\` BIGINT NOT NULL,
  \`txn_id\` VARCHAR(2147483647) NOT NULL,
  \`customer_id\` VARCHAR(2147483647) NOT NULL,
  \`event_time\` AS TO_TIMESTAMP_LTZ(\`created_at\`, 3),
  WATERMARK FOR \`event_time\` AS \`event_time\` - INTERVAL '10' SECOND
) WITH (
  'connector' = 'confluent',
  'value.format' = 'avro-registry'
);

INSERT INTO \`{rid}-LOANS-RETYPED\`
SELECT
  CAST(\`loan_id\` AS BYTES) AS \`key\`,
  \`loan_id\`, \`amount\`, \`status\`, \`created_at\`, \`txn_id\`, \`customer_id\`
FROM \`{rid}-LOANS\`
WHERE \`amount\` > 10000
LIMIT 50`,
      tags: ['Quick Start', 'Schema Handling', 'Event-Time'],
      documentation: kickstarterDocs['loan-schema-override'],
      completionModal: loanSchemaOverrideDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanSchemaOverrideDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Data Masking (Pure SQL) ---
    {
      id: 'loan-data-masking',
      category: 'kickstart' as const,
      group: 'Data Masking',
      skillLevel: 'Beginner',
      title: 'Data Masking (Pure SQL)',
      description:
        'No UDFs needed — mask loan IDs with SHA-256, redact phone numbers with REGEXP_REPLACE, and truncate emails. Pure SQL data protection that runs anywhere.',
      sql: `INSERT INTO \`{rid}-LOANS-MASKED-SQL\`
SELECT
  CAST(SHA2(CAST(loan_id AS BYTES), 256) AS BYTES) AS \`key\`,
  SHA2(CAST(loan_id AS BYTES), 256) AS hashed_loan_id,
  amount,
  status,
  REGEXP_REPLACE(customer_id, '.', '*') AS masked_customer_id,
  created_at
FROM \`{rid}-LOANS\``,
      tags: ['Quick Start', 'Pattern', 'Security'],
      documentation: kickstarterDocs['loan-data-masking'],
      completionModal: loanDataMaskingDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanDataMaskingDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- UDFs ---
    {
      id: 'loan-scalar-extract',
      group: 'UDFs',
      skillLevel: 'Advanced',
      udf: true,
      title: 'Loan Detail Extract',
      description:
        'Loan JSON nested 7 levels deep? A custom UDF rips out credit scores, names, and risk levels into clean flat rows. No ETL pipeline needed.',
      sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOAN-DETAILS\`
SELECT loan_id,
  LoanDetailExtract(json_payload, 'application.applicant.name.first') || ' ' ||
    LoanDetailExtract(json_payload, 'application.applicant.name.last') AS applicant_name,
  LoanDetailExtract(json_payload, 'application.loan.type') AS loan_type,
  ...
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\``,
      category: 'kickstart' as const,
      tags: ['Quick Start', 'Java', 'UDF', 'Loan Example'],
      completionModal: {
        subtitle: 'Your workspace is ready. Follow these steps to run the example:',
        steps: [
          { label: 'Produce test data', detail: 'Click the green Play button on the LOAN-APPLICATIONS stream card to start sending 200 loan records.' },
          { label: 'Run the function-creation cell to register the Java scalar extractor', detail: 'Run the function-creation cell. Wait for it to show "Completed" before continuing.' },
          { label: 'Wait for ALL function registrations to show "Completed"', detail: 'UDF registration can take 30-60 seconds. Do NOT run the next cell until every CREATE FUNCTION cell shows a green "Completed" status.' },
          { label: 'Run the exec-udf cell to begin extracting loan fields', detail: 'Once CREATE FUNCTION shows Completed, run the exec-udf cell to begin extracting loan fields into the output topic.' },
          { label: 'Run the view-output cell', detail: 'Run the view-output cell to see extracted rows flowing in from the output topic.' },
        ],
      },
      documentation: kickstarterDocs['loan-scalar-extract'],
      onImport: (onProgress) =>
        setupScalarExtractExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-tradeline-java',
      group: 'UDFs',
      skillLevel: 'Advanced',
      udf: true,
      title: 'Loan Tradeline Explode',
      description:
        'One loan, five credit accounts buried in a JSON array. LATERAL TABLE blows it apart — one row per tradeline, ready for risk analysis.',
      sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOAN-TRADELINES\`
SELECT
  CAST(CONCAT(loan_id, '-', CAST(t.array_index AS STRING)) AS BYTES) AS \`key\`,
  loan_id, t.array_index AS tradeline_index,
  LoanDetailExtract(t.element_json, 'account_type') AS account_type, ...
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\`,
  LATERAL TABLE(LoanDetailExplode(json_payload, '...')) AS t`,
      category: 'kickstart' as const,
      tags: ['Quick Start', 'Java', 'UDF', 'Loan Example'],
      completionModal: {
        subtitle: 'Your workspace is ready. Follow these steps to run the example:',
        steps: [
          { label: 'Produce test data', detail: 'Click the green Play button on the LOAN-APPLICATIONS stream card to send 200 loan records.' },
          { label: 'Run BOTH the fn-extract and fn-explode cells', detail: 'Run both CREATE FUNCTION cells. Wait for each to show Completed before continuing.' },
          { label: 'Wait for ALL function registrations to show "Completed"', detail: 'UDF registration can take 30-60 seconds. Do NOT run the next cell until every CREATE FUNCTION cell shows a green "Completed" status.' },
          { label: 'Run the exec-udf cell', detail: 'Run the exec-udf cell to begin exploding tradeline arrays into individual rows.' },
          { label: 'View output', detail: 'Run the view-output cell to see one row per tradeline flowing into the output topic.' },
        ],
      },
      documentation: kickstarterDocs['loan-tradeline-java'],
      onImport: (onProgress) =>
        setupJavaTableExplodeExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-table-explode',
      group: 'UDFs',
      skillLevel: 'Intermediate',
      udf: true,
      title: 'Loan Tradeline Explode (Python)',
      description:
        'Same tradeline explosion, but with Python UDFs. Write your UDF in Python, deploy to Flink, and explode arrays at scale.',
      sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOAN-TRADELINES\`
SELECT loan_id,
  t.f0 AS tradeline_index,
  loan_detail_extract(t.f1, 'account_type') AS account_type,
  ...
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\`,
  LATERAL TABLE(LoanDetailExplode(json_payload, '...')) AS t`,
      category: 'kickstart' as const,
      tags: ['Quick Start', 'Python', 'UDF', 'Loan Example'],
      documentation: kickstarterDocs['loan-table-explode'],
      comingSoon: 'Python UDFs require Confluent Early Access enrollment. Contact your account team to enroll.',
    },
    {
      id: 'loan-aggregate-udf',
      category: 'kickstart' as const,
      group: 'UDFs',
      skillLevel: 'Advanced',
      udf: true,
      title: 'Portfolio Stats',
      description: 'AVG treats a $500 loan the same as a $500K one. WeightedAvg doesn\'t. Get real portfolio risk metrics that actually mean something.',
      sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOAN-PORTFOLIO-STATS\` (
  \`key\`, window_start, window_end, loan_count, total_amount,
  avg_credit_score, weighted_avg_credit_score
)
SELECT
  CAST('portfolio' AS BYTES) as \`key\`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
  COUNT(*) as loan_count,
  SUM(CAST(LoanDetailExtract(json_payload, 'application.loan.amount_requested') AS BIGINT)) as total_amount,
  AVG(CAST(LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT)) as avg_credit_score,
  WeightedAvg(
    CAST(LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT),
    CAST(LoanDetailExtract(json_payload, 'application.loan.amount_requested') AS INT)
  ) as weighted_avg_credit_score
FROM TABLE(
  TUMBLE(TABLE \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
)
GROUP BY window_start, window_end`,
      tags: ['Quick Start', 'UDF', 'Windowed'],
      completionModal: {
        subtitle: 'Your workspace is ready. Follow these steps to run the example:',
        steps: [
          { label: 'Produce test data', detail: 'Click the green Play button on the LOAN-APPLICATIONS stream card to start sending 200 loan records.' },
          { label: 'Register UDFs', detail: 'Run the fn-extract and fn-weighted-avg cells to register both Java functions.' },
          { label: 'Wait for ALL function registrations to show "Completed"', detail: 'UDF registration can take 30-60 seconds. Do NOT run the next cell until every CREATE FUNCTION cell shows a green "Completed" status.' },
          { label: 'Run the pipeline', detail: 'Run the exec-udf cell to start the windowed aggregation job.' },
          { label: 'View results', detail: 'Run the view-output cell to see portfolio statistics updating every 30 seconds.' },
        ],
      },
      documentation: kickstarterDocs['loan-aggregate-udf'],
      onImport: (onProgress) =>
        setupAggregateUdfExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-validation',
      category: 'kickstart' as const,
      group: 'UDFs',
      skillLevel: 'Advanced',
      udf: true,
      title: 'Dead-Letter Validation',
      description: 'Bad data shouldn\'t disappear silently. Failed loans land in a dead-letter queue with full rejection reasons — audit-ready and reprocessable.',
      sql: `-- Job 1: Valid loans
INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-VALIDATED\`
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  LoanDetailExtract(json_payload, 'application.applicant.name.first') as applicant_name,
  LoanDetailExtract(json_payload, 'application.loan.type') as loan_type,
  LoanDetailExtract(json_payload, 'application.loan.amount_requested') as amount_requested,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level,
  'VALID' as validation_status
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\`
WHERE LoanValidator(json_payload) = 'VALID'`,
      tags: ['Quick Start', 'UDF', 'Pattern'],
      completionModal: {
        subtitle: 'Your workspace is ready. Follow these steps to run the example:',
        steps: [
          { label: 'Produce test data', detail: 'Click the green Play button on the LOAN-APPLICATIONS stream card to start sending 200 loan records.' },
          { label: 'Register UDFs', detail: 'Run the fn-extract and fn-validator cells to register both Java functions.' },
          { label: 'Wait for ALL function registrations to show "Completed"', detail: 'UDF registration can take 30-60 seconds. Do NOT run the next cell until every CREATE FUNCTION cell shows a green "Completed" status.' },
          { label: 'Run the valid-loans job', detail: 'Run the exec-valid cell to route valid loans to the validated output.' },
          { label: 'Run the dead-letter job', detail: 'Run the exec-dead-letter cell to route invalid loans to the dead-letter output.' },
          { label: 'View validated loans', detail: 'Run the view-validated cell to see loans that passed validation.' },
          { label: 'View dead-letter loans', detail: 'Run the view-dead-letter cell to see rejected loans with rejection reasons.' },
        ],
      },
      documentation: kickstarterDocs['loan-validation'],
      onImport: (onProgress) =>
        setupValidationExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-pii-masking',
      category: 'kickstart' as const,
      group: 'UDFs',
      skillLevel: 'Advanced',
      udf: true,
      title: 'PII Masking',
      description: 'Share loan data with analytics without exposing names, SSNs, or emails. Every record arrives pre-masked — GDPR-ready before it hits the topic.',
      sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-MASKED\` (
  \`key\`, loan_id, applicant_name, applicant_email, applicant_phone,
  applicant_ssn, loan_type, amount_requested, credit_score, risk_level
)
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  PiiMask(LoanDetailExtract(json_payload, 'application.applicant.name.first'), 'name') as applicant_name,
  PiiMask(LoanDetailExtract(json_payload, 'application.applicant.contact.email'), 'email') as applicant_email,
  PiiMask(LoanDetailExtract(json_payload, 'application.applicant.contact.phone'), 'phone') as applicant_phone,
  PiiMask(LoanDetailExtract(json_payload, 'application.applicant.ssn_last_four'), 'ssn') as applicant_ssn,
  LoanDetailExtract(json_payload, 'application.loan.type') as loan_type,
  LoanDetailExtract(json_payload, 'application.loan.amount_requested') as amount_requested,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\``,
      tags: ['Quick Start', 'UDF', 'Pattern'],
      completionModal: {
        subtitle: 'Your workspace is ready. Follow these steps to run the example:',
        steps: [
          { label: 'Produce test data', detail: 'Click the green Play button on the LOAN-APPLICATIONS stream card to start sending 200 loan records.' },
          { label: 'Register UDFs', detail: 'Run the fn-extract and fn-pii-mask cells to register both Java functions.' },
          { label: 'Wait for ALL function registrations to show "Completed"', detail: 'UDF registration can take 30-60 seconds. Do NOT run the next cell until every CREATE FUNCTION cell shows a green "Completed" status.' },
          { label: 'Run the masking pipeline', detail: 'Run the exec-udf cell to start masking PII fields in real-time.' },
          { label: 'View masked output', detail: 'Run the view-output cell to see records with names, emails, phones, and SSNs replaced with masked values.' },
        ],
      },
      documentation: kickstarterDocs['loan-pii-masking'],
      onImport: (onProgress) =>
        setupPiiMaskingExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-async-enrichment',
      category: 'kickstart' as const,
      group: 'UDFs',
      skillLevel: 'Advanced',
      udf: true,
      title: 'Credit Bureau Enrichment',
      description: 'Instant pre-qualification: extract credit data, score it, and get approval probability + rate quotes — all in one SQL statement, all in real-time.',
      sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-ENRICHED-V2\` (
  \`key\`, loan_id, applicant_name, loan_type, amount_requested,
  credit_score, risk_level, dti_ratio,
  score_band, approval_probability, recommended_rate,
  max_approved_amount, risk_tier
)
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  LoanDetailExtract(json_payload, 'application.applicant.name.first') as applicant_name,
  LoanDetailExtract(json_payload, 'application.loan.type') as loan_type,
  LoanDetailExtract(json_payload, 'application.loan.amount_requested') as amount_requested,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio') as dti_ratio,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'application.loan.amount_requested')
    ), 'score_band') as score_band,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'application.loan.amount_requested')
    ), 'approval_probability') as approval_probability,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'application.loan.amount_requested')
    ), 'recommended_rate') as recommended_rate,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'application.loan.amount_requested')
    ), 'max_approved_amount') as max_approved_amount,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'application.loan.amount_requested')
    ), 'risk_tier') as risk_tier
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\``,
      tags: ['Quick Start', 'UDF'],
      completionModal: {
        subtitle: 'Your workspace is ready. Follow these steps to run the example:',
        steps: [
          { label: 'Produce test data', detail: 'Click the green Play button on the LOAN-APPLICATIONS stream card to start sending 200 loan records.' },
          { label: 'Register UDFs', detail: 'Run the fn-extract and fn-enrich cells to register both Java functions.' },
          { label: 'Wait for ALL function registrations to show "Completed"', detail: 'UDF registration can take 30-60 seconds. Do NOT run the next cell until every CREATE FUNCTION cell shows a green "Completed" status.' },
          { label: 'Run the enrichment pipeline', detail: 'Run the exec-udf cell to start enriching loans with credit bureau data.' },
          { label: 'View enriched output', detail: 'Run the view-output cell to see loans with score bands, approval probabilities, and rate quotes.' },
        ],
      },
      documentation: kickstarterDocs['loan-async-enrichment'],
      onImport: (onProgress) =>
        setupAsyncEnrichmentExample(useWorkspaceStore.getState(), onProgress),
    },


    // --- Views ---
    {
      id: 'view-golden-record',
      category: 'kickstart' as const,
      group: 'Views',
      skillLevel: 'Intermediate',
      view: true,
      title: 'Golden Record',
      description: 'Multiple updates per loan_id? Materialize the latest state — one row per loan with LAST_VALUE + GROUP BY. Then find distressed loans instantly.',
      sql: `INSERT INTO \`{rid}-LOAN-GOLDEN-RECORD\`\nSELECT loan_id, LAST_VALUE(status) AS latest_status, ...\nFROM \`{rid}-LOAN-UPDATES\`\nGROUP BY loan_id`,
      tags: ['Quick Start', 'Materialized View', 'Aggregation'],
      documentation: kickstarterDocs['view-golden-record'],
      completionModal: viewGoldenRecordDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(viewGoldenRecordDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'view-credit-risk',
      category: 'kickstart' as const,
      group: 'Views',
      skillLevel: 'Intermediate',
      view: true,
      title: 'Credit Risk Concentration',
      description: 'How exposed is your portfolio to one ZIP code? Aggregate securitized loans by geography — flag high-concentration areas before they become systemic risk.',
      sql: `INSERT INTO \`{rid}-RISK-BY-ZIP\`\nSELECT zip_code, COUNT(*) AS loan_count, SUM(upb) AS total_exposure\nFROM \`{rid}-SECURITIZED-LOANS\`\nGROUP BY zip_code`,
      tags: ['Quick Start', 'Materialized View', 'Risk'],
      documentation: kickstarterDocs['view-credit-risk'],
      completionModal: viewCreditRiskDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(viewCreditRiskDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'view-ai-drift',
      category: 'kickstart' as const,
      group: 'Views',
      skillLevel: 'Advanced',
      view: true,
      title: 'AI/ML Compliance & Drift',
      description: 'Is your AI model drifting? A virtual view classifies every prediction as ALIGNED, DISCREPANCY, or LOW_CONFIDENCE — surface bias before regulators do.',
      sql: `CREATE VIEW \`{rid}-AI-DRIFT-MONITOR\` AS\nSELECT *, CASE WHEN prediction <> human_outcome THEN 'DISCREPANCY' ... END AS audit_status\nFROM \`{rid}-AI-AUDIT-LOG\``,
      tags: ['Quick Start', 'Virtual View', 'Compliance'],
      documentation: kickstarterDocs['view-ai-drift'],
      completionModal: viewAiDriftDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(viewAiDriftDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'view-early-warning',
      category: 'kickstart' as const,
      group: 'Views',
      skillLevel: 'Advanced',
      view: true,
      title: 'Early Warning for Defaults',
      description: 'Which servicers are struggling? Compute delinquency rates per servicer in 30-second windows. A spike above 10% means it\'s time to intervene.',
      sql: `INSERT INTO \`{rid}-SERVICER-HEALTH\`\nSELECT servicer_id, ..., CAST(delinquent_payments AS DOUBLE) / total_payments * 100 AS delinquency_rate\nFROM (SELECT ... FROM TABLE(TUMBLE(...)))`,
      tags: ['Quick Start', 'Materialized View', 'Window', 'Risk'],
      documentation: kickstarterDocs['view-early-warning'],
      completionModal: viewEarlyWarningDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(viewEarlyWarningDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'view-mbs-pricing',
      category: 'kickstart' as const,
      group: 'Views',
      skillLevel: 'Advanced',
      view: true,
      title: 'MBS Pricing Enrichment',
      description: 'What was the market rate when each loan committed? A temporal join virtual view gives point-in-time pricing accuracy for MBS portfolios.',
      sql: `CREATE VIEW \`{rid}-MBS-PRICING-VIEW\` AS\nSELECT c.*, r.base_rate, r.spread, c.principal * (r.base_rate + r.spread) / 100 AS estimated_yield\nFROM \`{rid}-LOAN-COMMITMENTS\` c\nJOIN \`{rid}-MARKET-RATES\` FOR SYSTEM_TIME AS OF c.\`$rowtime\` AS r ...`,
      tags: ['Quick Start', 'Virtual View', 'Temporal Join'],
      documentation: kickstarterDocs['view-mbs-pricing'],
      completionModal: viewMbsPricingDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(viewMbsPricingDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Kafka ---
    {
      id: 'kafka-produce-consume',
      category: 'kickstart' as const,
      group: 'Kafka',
      skillLevel: 'Beginner',
      title: 'Kafka Produce & Consume',
      description:
        'Keys matter more than you think. Produce messages with explicit keys, then SELECT to consume. Watch how keys control partition assignment and ordering.',
      sql: `SELECT * FROM \`{rid}-KAFKA-MESSAGES\`
-- Squirrel says: "No key? No order guarantee. Choose wisely."`,
      tags: ['Quick Start', 'Kafka', 'Streaming'],
      documentation: kickstarterDocs['kafka-produce-consume'],
      completionModal: kafkaProduceConsumeDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(kafkaProduceConsumeDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'kafka-startup-modes',
      category: 'kickstart' as const,
      group: 'Kafka',
      skillLevel: 'Beginner',
      title: 'Kafka Startup Modes',
      description:
        'earliest-offset reads everything from the beginning. latest-offset only sees new messages. Toggle between them and watch the row count change. Time travel for data engineers.',
      sql: `SELECT * FROM \`{rid}-KAFKA-EVENTS\`
-- Squirrel says: "earliest = time machine. latest = living in the now."`,
      tags: ['Quick Start', 'Kafka', 'Configuration'],
      documentation: kickstarterDocs['kafka-startup-modes'],
      completionModal: kafkaStartupModesDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(kafkaStartupModesDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'kafka-changelog-modes',
      category: 'kickstart' as const,
      group: 'Kafka',
      skillLevel: 'Intermediate',
      title: 'Changelog Modes',
      description:
        'append vs upsert: same data, wildly different behavior. Append keeps growing forever. Upsert stays calm. Run both side by side and compare the row counts — the difference is dramatic.',
      sql: `SELECT * FROM \`{rid}-CHANGELOG-APPEND\`
-- Compare with the upsert table to see the difference`,
      tags: ['Quick Start', 'Kafka', 'Changelog'],
      documentation: kickstarterDocs['kafka-changelog-modes'],
      completionModal: kafkaChangelogModesDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(kafkaChangelogModesDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'kafka-value-formats',
      category: 'kickstart' as const,
      group: 'Kafka',
      skillLevel: 'Intermediate',
      title: 'Value Formats',
      description:
        'Avro with Schema Registry, plain JSON, and raw bytes — three tables, three formats, one head-to-head comparison. See how Flink handles each differently and why format choice matters for production.',
      sql: `SELECT * FROM \`{rid}-AVRO-DATA\`
-- Squirrel rating: 9/10 acorns for Avro`,
      tags: ['Quick Start', 'Kafka', 'Serialization'],
      documentation: kickstarterDocs['kafka-value-formats'],
      completionModal: kafkaValueFormatsDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(kafkaValueFormatsDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'kafka-schema-evolution',
      category: 'kickstart' as const,
      group: 'Kafka',
      skillLevel: 'Intermediate',
      title: 'Schema Evolution',
      description:
        'Schemas evolve, producers add fields, and Flink tables are statically defined. Learn the DROP + CREATE workflow, understand backward/forward compatibility, and see NULL backfill in action.',
      sql: `SELECT * FROM \`{rid}-EVOLVING-DATA\`
-- Squirrel warns: "Flink doesn't read your mind."`,
      tags: ['Quick Start', 'Kafka', 'Schema'],
      documentation: kickstarterDocs['kafka-schema-evolution'],
      completionModal: kafkaSchemaEvolutionDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(kafkaSchemaEvolutionDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Confluent ---
    {
      id: 'confluent-connector-bridge',
      category: 'kickstart' as const,
      group: 'Confluent',
      skillLevel: 'Intermediate',
      title: 'Connector Bridge',
      description:
        'Source connectors dump raw data into Kafka. Flink SQL cleans, validates, and normalizes it. Sink connectors deliver the clean output downstream. This is the most common production architecture on Confluent Cloud.',
      sql: `INSERT INTO \`{rid}-CLEAN-OUTPUT\`
SELECT UPPER(TRIM(source_system)) AS source_system, event_id,
  COALESCE(event_payload, '{}') AS event_payload, ...
FROM \`{rid}-RAW-INGEST\`
WHERE event_id IS NOT NULL`,
      tags: ['Quick Start', 'Confluent', 'ETL'],
      documentation: kickstarterDocs['confluent-connector-bridge'],
      completionModal: confluentConnectorBridgeDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(confluentConnectorBridgeDef, useWorkspaceStore.getState(), onProgress),
    },
  ] satisfies ExampleCard[]).filter((card) => {
    // Hide ksqlDB examples when ksqlDB is not configured or not enabled
    if (card.tags?.includes('ksqlDB')) {
      return isKsqlConfigured() && useWorkspaceStore.getState().ksqlFeatureEnabled;
    }
    return true;
  });
}
