/**
 * API-level teardown for E2E tests.
 * Runs in Node context (not browser) — uses dotenv for env vars, axios for HTTP.
 * Every call is wrapped in safeExec to swallow "not found" errors.
 *
 * Functions and tables are created with dynamic rid suffixes (e.g. LoanDetailExtract_warp-moose-f696969)
 * so cleanup lists all resources and drops those matching known base-name patterns.
 */
import 'dotenv/config';
import axios, { type AxiosInstance } from 'axios';

// --- Environment ---
const CLOUD_PROVIDER = process.env.VITE_CLOUD_PROVIDER || 'aws';
const CLOUD_REGION = process.env.VITE_CLOUD_REGION || 'us-east-1';
const ORG_ID = process.env.VITE_ORG_ID!;
const ENV_ID = process.env.VITE_ENV_ID!;
const COMPUTE_POOL_ID = process.env.VITE_COMPUTE_POOL_ID!;
const FLINK_CATALOG = process.env.VITE_FLINK_CATALOG || 'default';
const FLINK_DATABASE = process.env.VITE_FLINK_DATABASE || 'cluster_0';

const FLINK_KEY = process.env.VITE_FLINK_API_KEY!;
const FLINK_SECRET = process.env.VITE_FLINK_API_SECRET!;
const CLOUD_KEY = process.env.VITE_METRICS_KEY!;
const CLOUD_SECRET = process.env.VITE_METRICS_SECRET!;
const KAFKA_KEY = process.env.VITE_KAFKA_API_KEY!;
const KAFKA_SECRET = process.env.VITE_KAFKA_API_SECRET!;
const KAFKA_REST = process.env.VITE_KAFKA_REST_ENDPOINT!;
const KAFKA_CLUSTER = process.env.VITE_KAFKA_CLUSTER_ID!;

// --- Clients (direct URLs, no Vite proxy) ---
const flinkClient: AxiosInstance = axios.create({
  baseURL: `https://flink.${CLOUD_REGION}.${CLOUD_PROVIDER}.confluent.cloud`,
  auth: { username: FLINK_KEY, password: FLINK_SECRET },
  headers: { 'Content-Type': 'application/json' },
});

const cloudClient: AxiosInstance = axios.create({
  baseURL: 'https://api.confluent.cloud',
  auth: { username: CLOUD_KEY, password: CLOUD_SECRET },
  headers: { 'Content-Type': 'application/json' },
});

const kafkaClient: AxiosInstance = axios.create({
  baseURL: KAFKA_REST,
  auth: { username: KAFKA_KEY, password: KAFKA_SECRET },
  headers: { 'Content-Type': 'application/json' },
});

// --- Helpers ---

/** Swallow "not found" / 404 errors, warn on anything else. */
async function safeExec(fn: () => Promise<void>, label: string) {
  try {
    await fn();
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('not found') || msg.includes('404') || msg.includes('does not exist')) return;
    console.warn(`Cleanup warning (${label}):`, msg);
  }
}

/** Execute a Flink SQL statement and poll until COMPLETED or FAILED. */
async function execSQL(sql: string, timeoutMs = 30_000): Promise<void> {
  const stmtName = `cleanup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `/sql/v1/organizations/${ORG_ID}/environments/${ENV_ID}/statements`;

  const { data } = await flinkClient.post(path, {
    name: stmtName,
    spec: {
      statement: sql,
      compute_pool_id: COMPUTE_POOL_ID,
      properties: {
        'sql.current-catalog': FLINK_CATALOG,
        'sql.current-database': FLINK_DATABASE,
      },
    },
  });

  // Poll until terminal state
  const deadline = Date.now() + timeoutMs;
  let phase = data?.status?.phase || 'PENDING';
  while (phase !== 'COMPLETED' && phase !== 'FAILED' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await flinkClient.get(`${path}/${stmtName}`);
    phase = poll.data?.status?.phase || 'PENDING';
  }
}

async function dropFunction(name: string) {
  await execSQL(`DROP FUNCTION IF EXISTS \`${name}\``);
}

async function dropTable(name: string) {
  await execSQL(`DROP TABLE IF EXISTS \`${name}\``);
}

async function deleteTopic(name: string) {
  await kafkaClient.delete(
    `/kafka/v3/clusters/${KAFKA_CLUSTER}/topics/${encodeURIComponent(name)}`,
  );
}

/**
 * List all Kafka topics and delete those whose name starts with any of the given prefixes.
 * Handles the dynamic rid suffix (e.g. LOAN-APPLICATIONS-warp-moose-f696969).
 */
async function deleteTopicsByPrefixes(prefixes: string[]) {
  const { data } = await kafkaClient.get(`/kafka/v3/clusters/${KAFKA_CLUSTER}/topics`);
  const topics: Array<{ topic_name: string }> = data?.data || [];
  const matching = topics.filter(t => prefixes.some(p => t.topic_name.startsWith(p)));
  await Promise.all(
    matching.map(t => safeExec(() => deleteTopic(t.topic_name), `topic ${t.topic_name}`))
  );
}

/**
 * List all Flink tables and drop those whose name starts with any of the given prefixes.
 * Handles the dynamic rid suffix (e.g. LOAN-APPLICATIONS-warp-moose-f696969).
 */
async function dropTablesByPrefixes(prefixes: string[]) {
  const stmtName = `cleanup-show-${Date.now().toString(36)}`;
  const path = `/sql/v1/organizations/${ORG_ID}/environments/${ENV_ID}/statements`;

  const { data: stmtData } = await flinkClient.post(path, {
    name: stmtName,
    spec: {
      statement: 'SHOW TABLES',
      compute_pool_id: COMPUTE_POOL_ID,
      properties: {
        'sql.current-catalog': FLINK_CATALOG,
        'sql.current-database': FLINK_DATABASE,
      },
    },
  });

  const deadline = Date.now() + 30_000;
  let phase = stmtData?.status?.phase || 'PENDING';
  while (phase !== 'COMPLETED' && phase !== 'FAILED' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await flinkClient.get(`${path}/${stmtName}`);
    phase = poll.data?.status?.phase || 'PENDING';
  }

  const results = stmtData?.status?.result_schema ? await flinkClient.get(
    `/sql/v1/organizations/${ORG_ID}/environments/${ENV_ID}/statements/${stmtName}/results`
  ) : null;

  const tableNames: string[] = results?.data?.results?.data?.flatMap(
    (row: { op: number; row: string[] }) => row.row
  ) || [];

  const matching = tableNames.filter(n => prefixes.some(p => n.startsWith(p)));
  await Promise.all(
    matching.map(n => safeExec(() => dropTable(n), `table ${n}`))
  );
}

/**
 * List all Flink user functions and drop those whose name starts with any of the given prefixes.
 * Handles the dynamic rid suffix (e.g. LoanDetailExtract_warp-moose-f696969).
 */
async function dropFunctionsByPrefixes(prefixes: string[]) {
  const stmtName = `cleanup-show-fn-${Date.now().toString(36)}`;
  const path = `/sql/v1/organizations/${ORG_ID}/environments/${ENV_ID}/statements`;

  const { data: stmtData } = await flinkClient.post(path, {
    name: stmtName,
    spec: {
      statement: 'SHOW USER FUNCTIONS',
      compute_pool_id: COMPUTE_POOL_ID,
      properties: {
        'sql.current-catalog': FLINK_CATALOG,
        'sql.current-database': FLINK_DATABASE,
      },
    },
  });

  const deadline = Date.now() + 30_000;
  let phase = stmtData?.status?.phase || 'PENDING';
  while (phase !== 'COMPLETED' && phase !== 'FAILED' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await flinkClient.get(`${path}/${stmtName}`);
    phase = poll.data?.status?.phase || 'PENDING';
  }

  const results = await flinkClient.get(
    `/sql/v1/organizations/${ORG_ID}/environments/${ENV_ID}/statements/${stmtName}/results`
  );

  const fnNames: string[] = results?.data?.results?.data?.flatMap(
    (row: { op: number; row: string[] }) => row.row
  ) || [];

  const matching = fnNames.filter(n => prefixes.some(p => n.startsWith(p)));
  await Promise.all(
    matching.map(n => safeExec(() => dropFunction(n), `function ${n}`))
  );
}

/** Find artifact by display_name prefix, then delete by ID. */
async function deleteArtifactByName(displayNamePattern: string) {
  const { data } = await cloudClient.get('/artifact/v1/flink-artifacts', {
    params: {
      cloud: CLOUD_PROVIDER,
      region: CLOUD_REGION,
      environment: ENV_ID,
    },
  });
  const artifacts: Array<{ id: string; display_name: string }> = data?.data || [];
  const match = artifacts.find((a) =>
    a.display_name.toLowerCase().includes(displayNamePattern.toLowerCase()),
  );
  if (match) {
    await cloudClient.delete(`/artifact/v1/flink-artifacts/${match.id}`, {
      params: { cloud: CLOUD_PROVIDER, region: CLOUD_REGION, environment: ENV_ID },
    });
  }
}

// --- Public API ---

// Base name prefixes for all resources created by UDF examples
const FUNCTION_PREFIXES = [
  'LoanDetailExtract_', 'LoanDetailExplode_', 'loan_detail_extract_',
  'WeightedAvg_', 'LoanValidator_', 'PiiMask_', 'CreditBureauEnrich_',
];
const TABLE_PREFIXES = [
  'LOAN-APPLICATIONS-', 'LOAN-DETAILS-', 'LOAN-TRADELINES-',
  'LOAN-PORTFOLIO-STATS-', 'LOANS-VALIDATED-', 'LOANS-DEAD-LETTER-',
  'LOANS-MASKED-', 'LOANS-ENRICHED-V2-',
];

/** Clean up all resources created by the Loan UDF examples. */
export async function cleanupAll() {
  // Tier 1: Drop all matching functions (must drop before artifacts)
  await safeExec(() => dropFunctionsByPrefixes(FUNCTION_PREFIXES), 'user functions');

  // Tier 2: Drop all matching tables (must drop before topics)
  await safeExec(() => dropTablesByPrefixes(TABLE_PREFIXES), 'tables');

  // Tier 3: Topics + artifacts in parallel (all independent after tables/functions gone)
  await Promise.all([
    safeExec(() => deleteTopicsByPrefixes(TABLE_PREFIXES), 'topics'),
    safeExec(() => deleteArtifactByName('platform-examples-flink-kickstarter'), 'java artifact'),
    safeExec(() => deleteArtifactByName('platform-examples-loan-python-udf'), 'python artifact'),
    safeExec(() => deleteArtifactByName('platform-examples-weighted-avg'), 'weighted-avg artifact'),
    safeExec(() => deleteArtifactByName('platform-examples-loan-validator'), 'validator artifact'),
    safeExec(() => deleteArtifactByName('platform-examples-pii-mask'), 'pii-mask artifact'),
    safeExec(() => deleteArtifactByName('platform-examples-credit-bureau-enrich'), 'enrich artifact'),
  ]);
}

/** Clean up only the Python-specific resources (table function + output table/topic). */
export async function cleanupPython() {
  await safeExec(
    () => dropFunctionsByPrefixes(['LoanDetailExplode_', 'loan_detail_extract_']),
    'python functions',
  );

  await Promise.all([
    safeExec(() => dropTablesByPrefixes(['LOAN-TRADELINES-']), 'explode table'),
    safeExec(() => deleteTopicsByPrefixes(['LOAN-TRADELINES-']), 'explode topic'),
    safeExec(() => deleteArtifactByName('platform-examples-loan-python-udf'), 'python artifact'),
  ]);
}
