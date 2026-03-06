/**
 * @examples-panel
 * Example cards for the Examples panel.
 * Each card has importable SQL, a description, and tags.
 *
 * getExampleCards() resolves <artifact-id>/<version-id> placeholders
 * with real artifact data from the store when available.
 */

import type { ExampleCard, FlinkArtifact } from '../types';
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
import { useWorkspaceStore } from '../store/workspaceStore';
import { kickstarterDocs } from './examples/docs';

/** True when the class value is missing or a default placeholder that Flink would reject. */
function isUnresolvedClass(cls: string | undefined | null): boolean {
  return !cls || cls === '' || cls === 'default';
}

/** Derive a clean SQL function name from a class string. */
function deriveFnName(cls: string, fallback: string): string {
  if (!cls || cls === 'default') return fallback;
  // Java: com.example.MaskEmail → mask_email (last segment, CamelCase → snake_case)
  if (cls.includes('.')) {
    const last = cls.split('.').pop()!;
    return last.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }
  // Python or simple class: use as-is if valid identifier
  if (/^[a-zA-Z_]\w*$/.test(cls)) return cls.toLowerCase();
  return fallback;
}

/** Build example cards, substituting real artifact IDs when available. */
export function getExampleCards(artifacts: FlinkArtifact[]): ExampleCard[] {
  // Find artifacts by format; accept any artifact (versions may be empty in list response)
  const jarArtifact = artifacts.find((a) => a.content_format === 'JAR');
  const zipArtifact = artifacts.find((a) => a.content_format === 'ZIP');
  const anyArtifact = jarArtifact ?? artifacts[0];

  const jarId = jarArtifact?.id || '<artifact-id>';
  const jarVer = jarArtifact?.versions?.[0]?.version || '<version-id>';
  const jarClass = jarArtifact && !isUnresolvedClass(jarArtifact.class)
    ? jarArtifact.class
    : '<entry-class>';
  const jarFnName = jarArtifact && !isUnresolvedClass(jarArtifact.class)
    ? deriveFnName(jarArtifact.class, 'my_java_udf')
    : 'my_java_udf';

  const zipId = zipArtifact?.id || anyArtifact?.id || '<artifact-id>';
  const zipVer =
    zipArtifact?.versions?.[0]?.version ||
    anyArtifact?.versions?.[0]?.version ||
    '<version-id>';
  const zipClass = zipArtifact && !isUnresolvedClass(zipArtifact.class)
    ? zipArtifact.class
    : '<entry-class>';
  const zipFnName = zipArtifact && !isUnresolvedClass(zipArtifact.class)
    ? deriveFnName(zipArtifact.class, 'my_python_udf')
    : 'my_python_udf';

  const hasJar = !!jarArtifact;
  const hasZip = !!zipArtifact;

  return [
    // --- Hello World Quick Start examples ---
    {
      id: 'hello-flink',
      category: 'kickstart' as const,
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
      id: 'good-jokes',
      category: 'kickstart' as const,
      title: 'Good Jokes Filter',
      description: "Filter a jokes stream — LOL, ROFL, and DEAD ratings flow to GOOD-JOKES. GROAN and MEH get dropped.",
      sql: "INSERT INTO `{rid}-GOOD-JOKES`\nSELECT * FROM `{rid}-JOKES`\nWHERE rating IN ('LOL', 'ROFL', 'DEAD')",
      tags: ['Quick Start', 'Filter', 'Streaming'],
      documentation: kickstarterDocs['good-jokes'],
      completionModal: goodJokesDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(goodJokesDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Quick Start examples (template engine) ---
    {
      id: 'loan-filter',
      category: 'kickstart' as const,
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
      id: 'loan-aggregate',
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
      id: 'loan-join',
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
      id: 'loan-schemaless-topic',
      category: 'kickstart' as const,
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
      completionModal: loanSchemalessTopicDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanSchemalessTopicDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-schema-override',
      category: 'kickstart' as const,
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
      completionModal: loanSchemaOverrideDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanSchemaOverrideDef, useWorkspaceStore.getState(), onProgress),
    },

    // --- Standard snippet examples ---
    {
      id: 'hello-world',
      category: 'snippet' as const,
      title: 'Hello World',
      description: 'Sanity check — confirm the compute pool is running.',
      sql: 'SELECT 1;',
      tags: ['Query'],
    },
    {
      id: 'show-functions',
      category: 'snippet' as const,
      title: 'Show Functions',
      description: 'List all registered functions including UDFs.',
      sql: 'SHOW FUNCTIONS;',
      tags: ['Query', 'DDL'],
    },
    {
      id: 'create-java-udf',
      category: 'snippet' as const,
      title: 'Create Java UDF',
      description: hasJar
        ? `Register UDF from ${jarArtifact!.display_name}.${isUnresolvedClass(jarArtifact!.class) ? ' Replace <entry-class> with your fully-qualified class name (e.g. com.example.MyUdf).' : ''}`
        : 'Register a Java UDF from an uploaded JAR artifact. Upload a JAR artifact first.',
      sql: `CREATE FUNCTION ${jarFnName}
  AS '${jarClass}'
  USING JAR 'confluent-artifact://${jarId}/${jarVer}';`,
      tags: ['Java', 'UDF', 'DDL'],
    },
    {
      id: 'create-python-udf',
      category: 'snippet' as const,
      title: 'Create Python UDF',
      description: hasZip
        ? `Register UDF from ${zipArtifact!.display_name}.${isUnresolvedClass(zipArtifact!.class) ? ' Replace <entry-class> with your fully-qualified class name.' : ''}`
        : 'Register a Python UDF from an uploaded ZIP artifact. Upload a ZIP artifact first.',
      sql: `-- Note: USING JAR works for both Java and Python artifacts
CREATE FUNCTION ${zipFnName}
  AS '${zipClass}'
  USING JAR 'confluent-artifact://${zipId}/${zipVer}';`,
      tags: ['Python', 'UDF', 'DDL'],
    },
    {
      id: 'loan-scalar-extract',
      title: 'Loan Detail Extract (Java UDF)',
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
          { label: 'Produce test data', detail: 'Click the green ▶ button on the LOAN-APPLICATIONS stream card to start sending 200 loan records.' },
          { label: 'Register the UDF', detail: 'Run the CREATE FUNCTION cell to register the Java scalar extractor. Wait for it to show Completed before continuing.' },
          { label: 'Start the INSERT INTO job', detail: 'Once CREATE FUNCTION shows Completed, run the INSERT INTO cell to begin extracting loan fields into the output topic.' },
          { label: 'View output', detail: 'Run the SELECT * LIMIT 50 cell to see extracted rows flowing in from the output topic.' },
        ],
      },
      documentation: kickstarterDocs['loan-scalar-extract'],
      onImport: (onProgress) =>
        setupScalarExtractExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-tradeline-java',
      title: 'Loan Tradeline Explode (Java UDF)',
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
          { label: 'Produce test data', detail: 'Click the green ▶ button on the LOAN-APPLICATIONS stream card to send 200 loan records.' },
          { label: 'Register the UDFs', detail: 'Run the two CREATE FUNCTION cells in order. Wait for each to show Completed before continuing.' },
          { label: 'Start the LATERAL TABLE job', detail: 'Run the INSERT INTO cell to begin exploding tradeline arrays into individual rows.' },
          { label: 'View output', detail: 'Run the SELECT * LIMIT 50 cell to see one row per tradeline flowing into the output topic.' },
        ],
      },
      documentation: kickstarterDocs['loan-tradeline-java'],
      onImport: (onProgress) =>
        setupJavaTableExplodeExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-table-explode',
      title: 'Loan Tradeline Explode (Python UDF)',
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
      comingSoon: 'Python UDFs require Confluent Early Access enrollment. Contact your account team to enroll.',
    },

    // --- Coming Soon kickstarter examples ---
    {
      id: 'loan-dedup',
      category: 'kickstart' as const,
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
      id: 'loan-top-n',
      category: 'kickstart' as const,
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
      id: 'loan-aggregate-udf',
      category: 'kickstart' as const,
      title: 'Portfolio Stats (UDF)',
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
  SUM(CAST(LoanDetailExtract(json_payload, 'loan_details.amount_requested') AS BIGINT)) as total_amount,
  AVG(CAST(LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT)) as avg_credit_score,
  WeightedAvg(
    CAST(LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT),
    CAST(LoanDetailExtract(json_payload, 'loan_details.amount_requested') AS INT)
  ) as weighted_avg_credit_score
FROM TABLE(
  TUMBLE(TABLE \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
)
GROUP BY window_start, window_end`,
      tags: ['Quick Start', 'UDF', 'Windowed'],
      documentation: kickstarterDocs['loan-aggregate-udf'],
      onImport: (onProgress) =>
        setupAggregateUdfExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-validation',
      category: 'kickstart' as const,
      title: 'Dead-Letter Validation',
      description: 'Bad data shouldn\'t disappear silently. Failed loans land in a dead-letter queue with full rejection reasons — audit-ready and reprocessable.',
      sql: `-- Job 1: Valid loans
INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-VALIDATED\`
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  LoanDetailExtract(json_payload, 'applicant.personal.name.first') as applicant_name,
  LoanDetailExtract(json_payload, 'loan_details.type') as loan_type,
  LoanDetailExtract(json_payload, 'loan_details.amount_requested') as amount_requested,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level,
  'VALID' as validation_status
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\`
WHERE LoanValidator(json_payload) = 'VALID'`,
      tags: ['Quick Start', 'UDF', 'Pattern'],
      documentation: kickstarterDocs['loan-validation'],
      onImport: (onProgress) =>
        setupValidationExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-hop-window',
      category: 'kickstart' as const,
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
      id: 'loan-pii-masking',
      category: 'kickstart' as const,
      title: 'PII Masking',
      description: 'Share loan data with analytics without exposing names, SSNs, or emails. Every record arrives pre-masked — GDPR-ready before it hits the topic.',
      sql: `INSERT INTO \`EOT-PLATFORM-EXAMPLES-LOANS-MASKED\` (
  \`key\`, loan_id, applicant_name, applicant_email, applicant_phone,
  applicant_ssn, loan_type, amount_requested, credit_score, risk_level
)
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  PiiMask(LoanDetailExtract(json_payload, 'applicant.personal.name.first'), 'name') as applicant_name,
  PiiMask(LoanDetailExtract(json_payload, 'applicant.contact.email'), 'email') as applicant_email,
  PiiMask(LoanDetailExtract(json_payload, 'applicant.contact.phone'), 'phone') as applicant_phone,
  PiiMask(LoanDetailExtract(json_payload, 'applicant.personal.ssn_last_four'), 'ssn') as applicant_ssn,
  LoanDetailExtract(json_payload, 'loan_details.type') as loan_type,
  LoanDetailExtract(json_payload, 'loan_details.amount_requested') as amount_requested,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\``,
      tags: ['Quick Start', 'UDF', 'Pattern'],
      documentation: kickstarterDocs['loan-pii-masking'],
      onImport: (onProgress) =>
        setupPiiMaskingExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-async-enrichment',
      category: 'kickstart' as const,
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
  LoanDetailExtract(json_payload, 'applicant.personal.name.first') as applicant_name,
  LoanDetailExtract(json_payload, 'loan_details.type') as loan_type,
  LoanDetailExtract(json_payload, 'loan_details.amount_requested') as amount_requested,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level,
  LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio') as dti_ratio,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'loan_details.amount_requested')
    ), 'score_band') as score_band,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'loan_details.amount_requested')
    ), 'approval_probability') as approval_probability,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'loan_details.amount_requested')
    ), 'recommended_rate') as recommended_rate,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'loan_details.amount_requested')
    ), 'max_approved_amount') as max_approved_amount,
  LoanDetailExtract(
    CreditBureauEnrich(
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      LoanDetailExtract(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      LoanDetailExtract(json_payload, 'loan_details.amount_requested')
    ), 'risk_tier') as risk_tier
FROM \`EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS\``,
      tags: ['Quick Start', 'UDF'],
      documentation: kickstarterDocs['loan-async-enrichment'],
      onImport: (onProgress) =>
        setupAsyncEnrichmentExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-cdc-pipeline',
      category: 'kickstart' as const,
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

    // --- New SQL-only kickstarter examples (16-20) ---
    {
      id: 'loan-pattern-match',
      category: 'kickstart' as const,
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
      id: 'loan-running-aggregate',
      category: 'kickstart' as const,
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
  WINDOW w AS (PARTITION BY customer_id ORDER BY $rowtime ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)
)
WHERE prev_status IS NOT NULL AND prev_status <> status`,
      tags: ['Quick Start', 'Stateful', 'Pattern', 'LAG'],
      documentation: kickstarterDocs['loan-change-detection'],
      completionModal: loanChangeDetectionDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanChangeDetectionDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-interval-join',
      category: 'kickstart' as const,
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
  ];
}
