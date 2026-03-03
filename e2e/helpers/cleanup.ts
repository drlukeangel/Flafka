/**
 * API-level teardown for E2E tests.
 * Runs in Node context (not browser) — uses dotenv for env vars, axios for HTTP.
 * Every call is wrapped in safeExec to swallow "not found" errors.
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
const CLOUD_KEY = process.env.VITE_CLOUD_API_KEY!;
const CLOUD_SECRET = process.env.VITE_CLOUD_API_SECRET!;
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

/** Find artifact by display_name pattern, then delete by ID. */
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
    await cloudClient.delete(`/artifact/v1/flink-artifacts/${match.id}`);
  }
}

// --- Public API ---

/** Clean up all resources created by the Loan UDF examples. */
export async function cleanupAll() {
  // Tier 1: Drop functions in parallel (must drop before artifacts)
  await Promise.all([
    safeExec(() => dropFunction('LoanDetailExtract'), 'LoanDetailExtract'),
    safeExec(() => dropFunction('LoanDetailExplode'), 'LoanDetailExplode'),
    safeExec(() => dropFunction('loan_detail_extract'), 'loan_detail_extract'),
  ]);

  // Tier 2: Drop tables in parallel (must drop before topics)
  await Promise.all([
    safeExec(() => dropTable('EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS'), 'input table'),
    safeExec(() => dropTable('EOT-PLATFORM-EXAMPLES-LOAN-DETAILS'), 'scalar output table'),
    safeExec(() => dropTable('EOT-PLATFORM-EXAMPLES-LOAN-TRADELINES'), 'explode output table'),
  ]);

  // Tier 3: Topics + artifacts in parallel (all independent after tables/functions gone)
  await Promise.all([
    safeExec(() => deleteTopic('EOT-PLATFORM-EXAMPLES-LOAN-APPLICATIONS'), 'input topic'),
    safeExec(() => deleteTopic('EOT-PLATFORM-EXAMPLES-LOAN-DETAILS'), 'scalar output topic'),
    safeExec(() => deleteTopic('EOT-PLATFORM-EXAMPLES-LOAN-TRADELINES'), 'explode output topic'),
    safeExec(() => deleteArtifactByName('Loan Detail Extractor'), 'java artifact'),
    safeExec(() => deleteArtifactByName('Loan Detail UDF Python'), 'python artifact'),
  ]);
}

/** Clean up only the Python-specific resources (table function + output table/topic). */
export async function cleanupPython() {
  // Tier 1: Functions in parallel
  await Promise.all([
    safeExec(() => dropFunction('LoanDetailExplode'), 'LoanDetailExplode'),
    safeExec(() => dropFunction('loan_detail_extract'), 'loan_detail_extract'),
  ]);

  // Tier 2: Table + topic + artifact in parallel
  await Promise.all([
    safeExec(() => dropTable('EOT-PLATFORM-EXAMPLES-LOAN-TRADELINES'), 'explode output table'),
    safeExec(() => deleteTopic('EOT-PLATFORM-EXAMPLES-LOAN-TRADELINES'), 'explode output topic'),
    safeExec(() => deleteArtifactByName('Loan Detail UDF Python'), 'python artifact'),
  ]);
}
