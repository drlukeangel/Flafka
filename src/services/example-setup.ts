/**
 * @example-setup
 * One-click setup services for Quick Start example cards.
 * Each run generates a unique ID that prefixes ALL resources:
 *   artifact, function, topics, tables, schema subject, cell labels.
 * This guarantees a fresh installation every time — zero collisions.
 *
 * Two workspace cells are created per setup:
 *   1. Function registration (CREATE FUNCTION)
 *   2. Query execution (INSERT INTO ... SELECT)
 */

import { executeSQL, pollForResults } from '../api/flink-api';
import * as artifactApi from '../api/artifact-api';
import { env } from '../config/environment';
import { generateLoanApplicationDataset } from '../data/loan-sample-generator';
import { generateFunName } from '../utils/names';
import type { FlinkArtifact, NavItem } from '../types';

// ---- Base names (prefixed with unique ID at runtime) ----

const BASE_INPUT_TOPIC = 'LOAN-APPLICATIONS';
const BASE_SCALAR_OUTPUT_TOPIC = 'LOAN-DETAILS';
const BASE_EXPLODE_OUTPUT_TOPIC = 'LOAN-TRADELINES';
const JAVA_UDF_CLASS = 'com.fm.flink.udf.LoanDetailExtractor';
const BASE_JAVA_FN = 'LoanDetailExtract';
const PYTHON_EXTRACT_CLASS = 'loan_detail_udf.extractor.loan_detail_extract';
const PYTHON_EXPLODE_CLASS = 'loan_detail_udf.exploder.loan_detail_explode';
const BASE_PYTHON_EXTRACT_FN = 'loan_detail_extract';
const BASE_PYTHON_EXPLODE_FN = 'LoanDetailExplode';
// No separate topic creation — CREATE TABLE handles both table + backing Kafka topic

// ---- Store interface (minimal) ----

interface StoreSlice {
  addStatement: (code?: string, afterId?: string, label?: string) => void;
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  setActiveNavItem: (item: NavItem) => void;
  addSchemaDataset: (dataset: {
    id: string; name: string; schemaSubject: string;
    records: Record<string, unknown>[]; createdAt: string; updatedAt: string;
  }) => void;
  schemaDatasets: Array<{ name: string; schemaSubject: string }>;
  artifactList: FlinkArtifact[];
  loadArtifacts: () => Promise<void>;
  statements: Array<{ id: string }>;
}

// ---- Unique ID generator ----
// Uses the shared fun name generator (e.g. "wobbling-narwhal-472")
// so all objects created by one example run share the same memorable prefix.

function generateRunId(): string {
  return generateFunName();
}

// ---- Helpers ----

async function createTable(
  tableName: string,
  ddl: string,
  onProgress: (s: string) => void,
): Promise<void> {
  onProgress(`Creating table ${tableName}...`);
  const stmt = await executeSQL(ddl);
  await pollForResults(stmt.name);
}

async function uploadArtifact(
  store: StoreSlice,
  displayName: string,
  entryClass: string,
  fetchPath: string,
  contentFormat: 'JAR' | 'ZIP',
  runtimeLanguage: string,
  onProgress: (s: string) => void,
): Promise<FlinkArtifact> {
  // Check if an artifact with same class already exists (reuse to avoid re-uploading)
  onProgress('Checking for existing artifact...');
  const currentArtifacts = await artifactApi.listArtifacts();
  const existing = currentArtifacts.find(
    (a) => a.class && a.class.toLowerCase() === entryClass.toLowerCase(),
  );

  if (existing) {
    try {
      return await artifactApi.getArtifact(existing.id);
    } catch {
      return existing;
    }
  }

  onProgress('Uploading UDF artifact...');
  const response = await fetch(fetchPath);
  if (!response.ok) throw new Error(`Failed to fetch ${fetchPath}: ${response.status}`);
  const blob = await response.blob();
  const fileName = fetchPath.split('/').pop() || 'artifact';
  const file = new File([blob], fileName, { type: 'application/octet-stream' });

  const presigned = await artifactApi.getPresignedUploadUrl(contentFormat);
  await artifactApi.uploadFileToPresignedUrl(presigned, file);

  const artifact = await artifactApi.createArtifact({
    display_name: displayName,
    class: entryClass,
    cloud: env.cloudProvider,
    region: env.cloudRegion,
    environment: env.environmentId,
    content_format: contentFormat,
    runtime_language: runtimeLanguage,
    upload_source: { location: 'PRESIGNED_URL_LOCATION', upload_id: presigned.upload_id },
  });

  // Refresh store for UI consistency
  await store.loadArtifacts();

  // Wait for artifact version to appear
  let attempts = 0;
  while (attempts < 10) {
    try {
      const fresh = await artifactApi.getArtifact(artifact.id);
      if (fresh.versions && fresh.versions.length > 0) return fresh;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
  }

  return artifact;
}

// ---- DDL / SQL builders (all take unique-prefixed names) ----

function inputTableDDL(topicName: string): string {
  return `CREATE TABLE \`${topicName}\` (
  loan_id STRING,
  json_payload STRING
)`;
}

function scalarOutputDDL(topicName: string): string {
  return `CREATE TABLE \`${topicName}\` (
  \`key\` BYTES,
  loan_id STRING,
  applicant_name STRING,
  loan_type STRING,
  amount_requested STRING,
  credit_score STRING,
  risk_level STRING,
  dti_ratio STRING,
  appraised_value STRING,
  fraud_result STRING
)`;
}

function explodeOutputDDL(topicName: string): string {
  return `CREATE TABLE \`${topicName}\` (
  \`key\` BYTES,
  loan_id STRING,
  tradeline_index INT,
  account_type STRING,
  lender STRING,
  balance STRING,
  credit_limit STRING,
  status STRING
)`;
}

function createFunctionSQL(fnName: string, entryClass: string, artifactId: string, version: string): string {
  return `CREATE FUNCTION \`${fnName}\` AS '${entryClass}' USING JAR 'confluent-artifact://${artifactId}/${version}'`;
}

function scalarExtractSQL(fnName: string, inputTopic: string, outputTopic: string): string {
  return `INSERT INTO \`${outputTopic}\`
SELECT
  CAST(NULL AS BYTES) AS \`key\`,
  loan_id,
  \`${fnName}\`(json_payload, 'application.applicant.name.first') || ' ' ||
    \`${fnName}\`(json_payload, 'application.applicant.name.last') AS applicant_name,
  \`${fnName}\`(json_payload, 'application.loan.type') AS loan_type,
  \`${fnName}\`(json_payload, 'application.loan.amount_requested') AS amount_requested,
  \`${fnName}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS credit_score,
  \`${fnName}\`(json_payload, 'underwriting.risk_assessment.risk_level') AS risk_level,
  \`${fnName}\`(json_payload, 'underwriting.risk_assessment.dti_ratio') AS dti_ratio,
  \`${fnName}\`(json_payload, 'collateral.items[0].valuation.appraised_value') AS appraised_value,
  \`${fnName}\`(json_payload, 'underwriting.fraud_check.result') AS fraud_result
FROM \`${inputTopic}\``;
}

function tableExplodeSQL(
  extractFn: string, explodeFn: string, inputTopic: string, outputTopic: string,
): string {
  return `INSERT INTO \`${outputTopic}\`
SELECT
  CAST(NULL AS BYTES) AS \`key\`,
  loan_id,
  t.f0 AS tradeline_index,
  \`${extractFn}\`(t.f1, 'account_type') AS account_type,
  \`${extractFn}\`(t.f1, 'lender') AS lender,
  \`${extractFn}\`(t.f1, 'balance') AS balance,
  \`${extractFn}\`(t.f1, 'credit_limit') AS credit_limit,
  \`${extractFn}\`(t.f1, 'status') AS status
FROM \`${inputTopic}\`,
  LATERAL TABLE(\`${explodeFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.tradelines')) AS t`;
}

// ===========================================================================
// Part A: Java Scalar Extract Setup
// ===========================================================================

export async function setupScalarExtractExample(
  store: StoreSlice,
  onProgress: (step: string) => void,
): Promise<void> {
  const rid = generateRunId();
  const fnName = `${rid}_${BASE_JAVA_FN}`;
  const inputTopic = `${rid}-${BASE_INPUT_TOPIC}`;
  const outputTopic = `${rid}-${BASE_SCALAR_OUTPUT_TOPIC}`;
  const datasetSubject = `${inputTopic}-value`;
  const datasetName = `Loan Applications (${rid})`;

  // Step 1: Upload artifact (reuses existing by class if available)
  const artifact = await uploadArtifact(
    store, `Loan Detail Extractor (${rid})`, JAVA_UDF_CLASS,
    '/examples/flink-kickstarter-udfs-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );

  // Step 2: Create tables (also creates backing Kafka topics on Confluent Cloud)
  await createTable(inputTopic, inputTableDDL(inputTopic), onProgress);
  await createTable(outputTopic, scalarOutputDDL(outputTopic), onProgress);

  // Step 3: Generate dataset
  onProgress('Generating test data...');
  const records = generateLoanApplicationDataset(200);
  const now = new Date().toISOString();
  store.addSchemaDataset({
    id: crypto.randomUUID(),
    name: datasetName,
    schemaSubject: datasetSubject,
    records: records as unknown as Record<string, unknown>[],
    createdAt: now,
    updatedAt: now,
  });

  // Step 5: Add two workspace cells (user runs these)
  const version = artifact.versions?.[0]?.version;
  if (!version) throw new Error(`Artifact ${artifact.id} has no versions yet — try again in a moment`);
  const createFnSQL = createFunctionSQL(fnName, JAVA_UDF_CLASS, artifact.id, version);

  onProgress('Adding queries to workspace...');
  store.addStatement(createFnSQL, undefined, `${rid}-function-creation`);
  store.addStatement(
    scalarExtractSQL(fnName, inputTopic, outputTopic),
    undefined,
    `${rid}-exec-udf`,
  );
}

// ===========================================================================
// Part B: Python Table Explode Setup
// ===========================================================================

export async function setupTableExplodeExample(
  store: StoreSlice,
  onProgress: (step: string) => void,
): Promise<void> {
  const rid = generateRunId();
  const extractFn = `${rid}_${BASE_PYTHON_EXTRACT_FN}`;
  const explodeFn = `${rid}_${BASE_PYTHON_EXPLODE_FN}`;
  const inputTopic = `${rid}-${BASE_INPUT_TOPIC}`;
  const outputTopic = `${rid}-${BASE_EXPLODE_OUTPUT_TOPIC}`;
  const datasetSubject = `${inputTopic}-value`;
  const datasetName = `Loan Applications (${rid})`;

  // Step 1: Upload artifact (reuses existing by class if available)
  const artifact = await uploadArtifact(
    store, `Loan Detail UDF Python (${rid})`, PYTHON_EXPLODE_CLASS,
    '/examples/loan-detail-udf-python.zip', 'ZIP', 'PYTHON', onProgress,
  );

  // Step 2: Create tables (also creates backing Kafka topics on Confluent Cloud)
  await createTable(inputTopic, inputTableDDL(inputTopic), onProgress);
  await createTable(outputTopic, explodeOutputDDL(outputTopic), onProgress);

  // Step 3: Generate dataset
  onProgress('Generating test data...');
  const records = generateLoanApplicationDataset(200);
  const now = new Date().toISOString();
  store.addSchemaDataset({
    id: crypto.randomUUID(),
    name: datasetName,
    schemaSubject: datasetSubject,
    records: records as unknown as Record<string, unknown>[],
    createdAt: now,
    updatedAt: now,
  });

  // Step 5: Add two workspace cells (user runs these)
  const version = artifact.versions?.[0]?.version;
  if (!version) throw new Error(`Artifact ${artifact.id} has no versions yet — try again in a moment`);
  const createFnsSQL = [
    createFunctionSQL(extractFn, PYTHON_EXTRACT_CLASS, artifact.id, version),
    createFunctionSQL(explodeFn, PYTHON_EXPLODE_CLASS, artifact.id, version),
  ].join(';\n');

  onProgress('Adding queries to workspace...');
  store.addStatement(createFnsSQL, undefined, `${rid}-function-creation`);
  store.addStatement(
    tableExplodeSQL(extractFn, explodeFn, inputTopic, outputTopic),
    undefined,
    `${rid}-exec-udf`,
  );
}
