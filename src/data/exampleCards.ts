/**
 * @examples-panel
 * Example cards for the Examples panel.
 * Each card has importable SQL, a description, and tags.
 *
 * getExampleCards() resolves <artifact-id>/<version-id> placeholders
 * with real artifact data from the store when available.
 */

import type { ExampleCard, FlinkArtifact } from '../types';
import { setupScalarExtractExample, setupTableExplodeExample } from '../services/example-setup';
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
    {
      id: 'hello-world',
      title: 'Hello World',
      description: 'Sanity check — confirm the compute pool is running.',
      sql: 'SELECT 1;',
      tags: ['Query'],
    },
    {
      id: 'show-functions',
      title: 'Show Functions',
      description: 'List all registered functions including UDFs.',
      sql: 'SHOW FUNCTIONS;',
      tags: ['Query', 'DDL'],
    },
    {
      id: 'create-java-udf',
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
      id: 'create-example-table',
      title: 'Create Example Table',
      description: 'DDL for a Kafka-backed user events table with watermark.',
      sql: `CREATE TABLE example_user_events (
  user_id STRING,
  email STRING,
  comment STRING,
  event_type STRING,
  ts TIMESTAMP(3),
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'example-user-events',
  'format' = 'avro',
  'scan.startup.mode' = 'earliest-offset'
);`,
      tags: ['DDL'],
    },
    {
      id: 'query-java-udf',
      title: 'Query with Java UDF',
      description: `Use the ${jarFnName} UDF. Requires Create Example Table + Create Java UDF first.`,
      sql: `SELECT user_id, ${jarFnName}(email) AS result, event_type
FROM example_user_events
LIMIT 20;`,
      tags: ['Java', 'UDF', 'Query'],
    },
    {
      id: 'query-python-udf',
      title: 'Query with Python UDF',
      description: `Use the ${zipFnName} UDF. Requires Create Example Table + Create Python UDF first.`,
      sql: `SELECT user_id, comment, ${zipFnName}(comment) AS result
FROM example_user_events
WHERE comment IS NOT NULL
LIMIT 20;`,
      tags: ['Python', 'UDF', 'Query'],
    },
    {
      id: 'windowed-aggregation',
      title: 'Windowed Aggregation (TVF)',
      description:
        '1-minute tumbling window aggregation using TVF syntax. Requires Create Example Table first.',
      sql: `SELECT window_start, window_end, event_type, COUNT(*) AS cnt
FROM TABLE(
  TUMBLE(TABLE example_user_events, DESCRIPTOR(ts), INTERVAL '1' MINUTE)
)
GROUP BY window_start, window_end, event_type;`,
      tags: ['Query', 'Window'],
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
      tags: ['Quick Start', 'Java', 'UDF', 'Loan Example'],
      onImport: (onProgress) =>
        setupScalarExtractExample(useWorkspaceStore.getState(), onProgress),
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
      tags: ['Quick Start', 'Python', 'UDF', 'Loan Example'],
      onImport: (onProgress) =>
        setupTableExplodeExample(useWorkspaceStore.getState(), onProgress),
    },
  ];
}
