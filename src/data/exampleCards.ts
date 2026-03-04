/**
 * @examples-panel
 * Example cards for the Examples panel.
 * Each card has importable SQL, a description, and tags.
 *
 * getExampleCards() resolves <artifact-id>/<version-id> placeholders
 * with real artifact data from the store when available.
 */

import type { ExampleCard, FlinkArtifact } from '../types';
import { setupScalarExtractExample, setupJavaTableExplodeExample } from '../services/example-setup';
import { runKickstarterExample } from '../services/example-runner';
import { helloFlinkDef } from './examples/hello-flink';
import { goodJokesDef } from './examples/good-jokes';
import { loanFilterDef } from './examples/loan-filter';
import { loanAggregateDef } from './examples/loan-aggregate';
import { loanJoinDef } from './examples/loan-join';
import { loanTemporalJoinDef } from './examples/loan-temporal-join';
import { useWorkspaceStore } from '../store/workspaceStore';

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
        'One-click setup: creates LOANS and LOANS-FILTERED tables, loads 200 records. Filters streaming loans WHERE status = APPROVED.',
      sql: `INSERT INTO \`{rid}-LOANS-FILTERED\`
SELECT CAST(loan_id AS BYTES) AS \`key\`, loan_id, amount, status, created_at, txn_id, customer_id
FROM \`{rid}-LOANS\`
WHERE status = 'APPROVED'`,
      tags: ['Quick Start', 'Filter', 'Streaming'],
      completionModal: loanFilterDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanFilterDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-aggregate',
      title: 'Loan Aggregate',
      description:
        'One-click setup: creates LOANS and LOANS-STATS tables, loads 200 records. Tumbling window aggregation by status — 20-second windows.',
      sql: `INSERT INTO \`{rid}-LOANS-STATS\`
SELECT status, COUNT(*) AS loan_count, SUM(amount) AS total_amount
FROM TABLE(TUMBLE(TABLE \`{rid}-LOANS\`, DESCRIPTOR($rowtime), INTERVAL '20' SECOND))
GROUP BY window_start, window_end, status`,
      category: 'kickstart' as const,
      tags: ['Quick Start', 'Aggregation', 'Window'],
      completionModal: loanAggregateDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanAggregateDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-join',
      title: 'Loan Fraud Monitor',
      description:
        'One-click setup: creates LOANS, CUSTOMERS, and FRAUD-ALERTS tables, loads 210 records, opens 2 stream cards. Streaming join flags high-risk loans.',
      sql: `INSERT INTO \`{rid}-FRAUD-ALERTS\`
SELECT l.loan_id, c.name AS customer_name, c.risk_level,
  CASE WHEN c.risk_level = 'CRITICAL' THEN 'CRITICAL_RISK_CUSTOMER' ELSE 'LOW_RISK' END AS alert_reason
FROM \`{rid}-LOANS\` l
JOIN \`{rid}-CUSTOMERS\` c ON l.customer_id = c.customer_id`,
      category: 'kickstart' as const,
      tags: ['Quick Start', 'Join', 'Streaming'],
      completionModal: loanJoinDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanJoinDef, useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-temporal-join',
      title: 'Loan Enrichment',
      description:
        'One-click setup: creates LOANS, CUSTOMERS (versioned), and LOANS-ENRICHED tables, loads 220 records, opens 2 stream cards. Temporal join enriches loans with credit score at arrival time.',
      sql: `INSERT INTO \`{rid}-LOANS-ENRICHED\`
SELECT l.loan_id, c.name AS customer_name, c.credit_score, c.state
FROM \`{rid}-LOANS\` l
JOIN \`{rid}-CUSTOMERS\` FOR SYSTEM_TIME AS OF l.\`$rowtime\` AS c
  ON l.customer_id = c.customer_id`,
      category: 'kickstart' as const,
      tags: ['Quick Start', 'Temporal Join', 'Streaming'],
      completionModal: loanTemporalJoinDef.completionModal,
      onImport: (onProgress) =>
        runKickstarterExample(loanTemporalJoinDef, useWorkspaceStore.getState(), onProgress),
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
        'One-click setup: uploads Java UDF, creates tables + topics, loads 200 test records. Extracts flat fields from deeply nested loan JSON.',
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
      onImport: (onProgress) =>
        setupScalarExtractExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-tradeline-java',
      title: 'Loan Tradeline Explode (Java UDF)',
      description:
        'One-click setup: finds existing Java UDF artifact, creates tables + topics, loads 200 test records. Explodes tradeline array into individual rows using LATERAL TABLE.',
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
      onImport: (onProgress) =>
        setupJavaTableExplodeExample(useWorkspaceStore.getState(), onProgress),
    },
    {
      id: 'loan-table-explode',
      title: 'Loan Tradeline Explode (Python UDF)',
      description:
        'One-click setup: uploads Python UDF, creates tables + topics, loads 200 test records. Explodes tradeline array into individual rows.',
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
  ];
}
