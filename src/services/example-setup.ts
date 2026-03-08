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

import * as artifactApi from '../api/artifact-api';
import { env } from '../config/environment';
import { generateLoanApplicationDataset } from '../data/loan-sample-generator';
import { generateFunName } from '../utils/names';
import { createTable } from './example-helpers';
import type { FlinkArtifact, NavItem } from '../types';

// ---- Base names (prefixed with unique ID at runtime) ----

const BASE_INPUT_TOPIC = 'LOAN-APPLICATIONS';
const BASE_SCALAR_OUTPUT_TOPIC = 'LOAN-DETAILS';
const BASE_EXPLODE_OUTPUT_TOPIC = 'LOAN-TRADELINES';
const JAVA_UDF_CLASS = 'com.fm.flink.udf.LoanDetailExtractor';
const JAVA_EXPLODE_CLASS = 'com.fm.flink.udf.LoanDetailExploder';
const BASE_JAVA_FN = 'LoanDetailExtract';
const BASE_JAVA_EXPLODE_FN = 'LoanDetailExplode';
const PYTHON_EXTRACT_CLASS = 'loan_detail_udf.extractor.loan_detail_extract';
const PYTHON_EXPLODE_CLASS = 'loan_detail_udf.exploder.loan_detail_explode';
const BASE_PYTHON_EXTRACT_FN = 'loan_detail_extract';
const BASE_PYTHON_EXPLODE_FN = 'LoanDetailExplode';

// UDF classes for additional examples
const WEIGHTED_AVG_CLASS = 'com.fm.flink.udf.WeightedAvg';
const LOAN_VALIDATOR_CLASS = 'com.fm.flink.udf.LoanValidator';
const PII_MASK_CLASS = 'com.fm.flink.udf.PiiMask';
const CREDIT_BUREAU_ENRICH_CLASS = 'com.fm.flink.udf.CreditBureauEnrich';

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
  addStreamCard: (topicName: string, initialMode?: 'consume' | 'produce-consume', preselectedDatasetId?: string, datasetTemplate?: { type: string; count: number }) => void;
  setStreamsPanelOpen: (open: boolean) => void;
}

// ---- Unique ID generator ----
// Uses the shared fun name generator (e.g. "wobbling-narwhal-472")
// so all objects created by one example run share the same memorable prefix.

function generateRunId(): string {
  return generateFunName();
}

// ---- Helpers ----

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
  const currentArtifacts = await artifactApi.listArtifacts() ?? [];
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

  // Wait for artifact version to appear (exponential backoff: 2s, 4s, 8s, 8s, 8s...)
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const fresh = await artifactApi.getArtifact(artifact.id);
      if (fresh.versions && fresh.versions.length > 0) return fresh;
    } catch { /* retry */ }
    const delay = Math.min(2000 * Math.pow(2, attempt), 8000);
    await new Promise((r) => setTimeout(r, delay));
  }

  console.warn(`[example-setup] Artifact ${artifact.id} versions not ready after retries`);
  throw new Error(`Artifact versions did not appear in time for ${artifact.id}`);
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

function createFunctionSQL(fnName: string, entryClass: string, artifactId: string, version: string, language?: 'PYTHON'): string {
  if (language === 'PYTHON') {
    return `CREATE FUNCTION \`${fnName}\` AS '${entryClass}' LANGUAGE PYTHON USING JAR 'confluent-artifact://${artifactId}'

-- WHAT: Registers a Python UDF named ${fnName} from a ZIP artifact uploaded to Confluent Cloud.
-- HOW: 'confluent-artifact://...' points to the uploaded archive. LANGUAGE PYTHON tells Flink to use the Python runtime.
-- GOTCHA: Python UDF registration can take 60-90 seconds. Wait for "Completed" before running queries that use this function.`;
  }
  return `CREATE FUNCTION \`${fnName}\` AS '${entryClass}' USING JAR 'confluent-artifact://${artifactId}/${version}'

-- WHAT: Registers a Java UDF named ${fnName} from a JAR artifact uploaded to Confluent Cloud.
-- HOW: 'confluent-artifact://...' points to the uploaded JAR. After this runs, call the function by name in any SQL query.
-- GOTCHA: Registration can take 30-60 seconds. Wait for "Completed" before running queries that use this function.`;
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
  \`${fnName}\`(json_payload, 'application.collateral.appraised_value') AS appraised_value,
  \`${fnName}\`(json_payload, 'underwriting.fraud_check.result') AS fraud_result
FROM \`${inputTopic}\`

-- WHAT: Extracts loan details from deeply nested JSON using the LoanDetailExtract scalar UDF.
-- HOW: The UDF navigates JSON paths like 'application.applicant.name.first' — one input row produces one output row.
-- WHY '||' concatenation: Combines first + last name into a single applicant_name column.
-- GOTCHA: This job runs continuously. New rows appear as data flows through the input topic.`;
}

function tableExplodeJavaSQL(
  extractFn: string, explodeFn: string, inputTopic: string, outputTopic: string,
): string {
  return `INSERT INTO \`${outputTopic}\`
SELECT
  CAST(CONCAT(loan_id, '-', CAST(t.array_index AS STRING)) AS BYTES) AS \`key\`,
  loan_id,
  t.array_index AS tradeline_index,
  \`${extractFn}\`(t.element_json, 'account_type') AS account_type,
  \`${extractFn}\`(t.element_json, 'lender') AS lender,
  \`${extractFn}\`(t.element_json, 'balance') AS balance,
  \`${extractFn}\`(t.element_json, 'limit') AS credit_limit,
  \`${extractFn}\`(t.element_json, 'status') AS status
FROM \`${inputTopic}\`,
  LATERAL TABLE(\`${explodeFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.tradelines')) AS t

-- WHAT: Explodes nested JSON tradeline arrays into individual rows using LoanDetailExplode (Table UDF).
-- HOW: LATERAL TABLE turns each array element into its own row. LoanDetailExtract pulls fields from each tradeline.
-- WHY CONCAT key: Creates a composite Kafka key (loan_id + index) so each tradeline gets a unique message key.
-- GOTCHA: This job runs continuously. One input loan with 5 tradelines produces 5 output rows.`;
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

// ---- DDL / SQL builders for additional UDF examples ----

function aggregateOutputDDL(topicName: string): string {
  return `CREATE TABLE \`${topicName}\` (
  \`key\` BYTES,
  window_start STRING,
  window_end STRING,
  loan_count BIGINT,
  total_amount BIGINT,
  avg_credit_score INT,
  weighted_avg_credit_score INT
)`;
}

function validatedOutputDDL(topicName: string): string {
  return `CREATE TABLE \`${topicName}\` (
  \`key\` BYTES,
  loan_id STRING,
  applicant_name STRING,
  loan_type STRING,
  amount_requested STRING,
  credit_score STRING,
  risk_level STRING,
  validation_status STRING
)`;
}

function deadLetterOutputDDL(topicName: string): string {
  return `CREATE TABLE \`${topicName}\` (
  \`key\` BYTES,
  loan_id STRING,
  json_payload STRING,
  rejection_reasons STRING,
  credit_score STRING,
  dti_ratio STRING,
  fraud_result STRING
)`;
}

function maskedOutputDDL(topicName: string): string {
  return `CREATE TABLE \`${topicName}\` (
  \`key\` BYTES,
  loan_id STRING,
  applicant_name STRING,
  applicant_email STRING,
  applicant_phone STRING,
  applicant_ssn STRING,
  loan_type STRING,
  amount_requested STRING,
  credit_score STRING,
  risk_level STRING
)`;
}

function enrichedOutputDDL(topicName: string): string {
  return `CREATE TABLE \`${topicName}\` (
  \`key\` BYTES,
  loan_id STRING,
  applicant_name STRING,
  loan_type STRING,
  amount_requested STRING,
  credit_score STRING,
  risk_level STRING,
  dti_ratio STRING,
  score_band STRING,
  approval_probability STRING,
  recommended_rate STRING,
  max_approved_amount STRING,
  risk_tier STRING
)`;
}

function aggregateUdfSQL(extractFn: string, weightedAvgFn: string, inputTopic: string, outputTopic: string): string {
  return `INSERT INTO \`${outputTopic}\` (
  \`key\`, window_start, window_end, loan_count, total_amount,
  avg_credit_score, weighted_avg_credit_score
)
SELECT
  CAST('portfolio' AS BYTES) as \`key\`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') as window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') as window_end,
  COUNT(*) as loan_count,
  SUM(CAST(\`${extractFn}\`(json_payload, 'application.loan.amount_requested') AS BIGINT)) as total_amount,
  AVG(CAST(\`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT)) as avg_credit_score,
  \`${weightedAvgFn}\`(
    CAST(\`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT),
    CAST(\`${extractFn}\`(json_payload, 'application.loan.amount_requested') AS INT)
  ) as weighted_avg_credit_score
FROM TABLE(
  TUMBLE(TABLE \`${inputTopic}\`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
)
GROUP BY window_start, window_end

-- WHAT: Computes portfolio statistics every 30 seconds using tumbling windows.
-- HOW: AVG() gives simple average; WeightedAvg() weights credit scores by loan amount (bigger loans = more influence).
-- WHY TUMBLE: Fixed 30-second non-overlapping windows for clean periodic snapshots.
-- GOTCHA: Windows only emit after they close. Wait ~30 seconds for first results.`;
}

function validationValidSQL(extractFn: string, validatorFn: string, inputTopic: string, outputTopic: string): string {
  return `INSERT INTO \`${outputTopic}\`
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  \`${extractFn}\`(json_payload, 'application.applicant.name.first') as applicant_name,
  \`${extractFn}\`(json_payload, 'application.loan.type') as loan_type,
  \`${extractFn}\`(json_payload, 'application.loan.amount_requested') as amount_requested,
  \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level,
  'VALID' as validation_status
FROM \`${inputTopic}\`
WHERE \`${validatorFn}\`(json_payload) = 'VALID'

-- WHAT: Routes VALID loans to the validated output topic.
-- HOW: LoanValidator UDF returns 'VALID' or a rejection reason. WHERE clause filters for valid only.
-- WHY separate jobs: Valid and invalid loans go to different topics — this is the "pass" path.
-- GOTCHA: Invalid loans are NOT dropped — they're handled by the companion dead-letter job.`;
}

function validationDeadLetterSQL(extractFn: string, validatorFn: string, inputTopic: string, outputTopic: string): string {
  return `INSERT INTO \`${outputTopic}\`
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  json_payload,
  \`${validatorFn}\`(json_payload) as rejection_reasons,
  \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio') as dti_ratio,
  \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.fraud_screening.result') as fraud_result
FROM \`${inputTopic}\`
WHERE \`${validatorFn}\`(json_payload) <> 'VALID'

-- WHAT: Routes INVALID loans to a dead-letter topic with full rejection reasons.
-- HOW: Companion to the valid-loans job. WHERE <> 'VALID' catches everything that failed validation.
-- WHY: Every loan goes somewhere — valid to validated, invalid to dead-letter. Nothing is silently dropped.
-- GOTCHA: The rejection_reasons column contains the validator's explanation of why the loan failed.`;
}

function piiMaskingSQL(extractFn: string, maskFn: string, inputTopic: string, outputTopic: string): string {
  return `INSERT INTO \`${outputTopic}\` (
  \`key\`, loan_id, applicant_name, applicant_email, applicant_phone,
  applicant_ssn, loan_type, amount_requested, credit_score, risk_level
)
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  \`${maskFn}\`(\`${extractFn}\`(json_payload, 'application.applicant.name.first'), 'name') as applicant_name,
  \`${maskFn}\`(\`${extractFn}\`(json_payload, 'application.applicant.contact.email'), 'email') as applicant_email,
  \`${maskFn}\`(\`${extractFn}\`(json_payload, 'application.applicant.contact.phone'), 'phone') as applicant_phone,
  \`${maskFn}\`(\`${extractFn}\`(json_payload, 'application.applicant.ssn_last_four'), 'ssn') as applicant_ssn,
  JSON_VALUE(json_payload, '$.application.loan.type') as loan_type,
  JSON_VALUE(json_payload, '$.application.loan.amount_requested') as amount_requested,
  JSON_VALUE(json_payload, '$.underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  JSON_VALUE(json_payload, '$.underwriting.risk_assessment.overall_risk') as risk_level
FROM \`${inputTopic}\`

-- WHAT: Masks PII fields (name, email, phone, SSN) while passing safe fields through.
-- HOW: PiiMask UDF replaces sensitive data: 'name' → "J*** D**", 'email' → "j***@***.com", etc.
-- WHY JSON_VALUE for non-PII: Avoids unnecessary UDF calls, keeps function count under Flink's 10-function limit.
-- GOTCHA: PiiMask + LoanDetailExtract = 2 UDFs. Non-PII fields bypass UDFs entirely via JSON_VALUE.`;
}

function asyncEnrichmentSQL(extractFn: string, enrichFn: string, inputTopic: string, outputTopic: string): string {
  return `INSERT INTO \`${outputTopic}\` (
  \`key\`, loan_id, applicant_name, loan_type, amount_requested,
  credit_score, risk_level, dti_ratio,
  score_band, approval_probability, recommended_rate,
  max_approved_amount, risk_tier
)
SELECT
  CAST(loan_id AS BYTES) as \`key\`,
  loan_id,
  \`${extractFn}\`(json_payload, 'application.applicant.name.first') as applicant_name,
  \`${extractFn}\`(json_payload, 'application.loan.type') as loan_type,
  \`${extractFn}\`(json_payload, 'application.loan.amount_requested') as amount_requested,
  \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.overall_risk') as risk_level,
  \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio') as dti_ratio,
  \`${extractFn}\`(
    \`${enrichFn}\`(
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      \`${extractFn}\`(json_payload, 'application.loan.amount_requested')
    ), 'score_band') as score_band,
  \`${extractFn}\`(
    \`${enrichFn}\`(
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      \`${extractFn}\`(json_payload, 'application.loan.amount_requested')
    ), 'approval_probability') as approval_probability,
  \`${extractFn}\`(
    \`${enrichFn}\`(
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      \`${extractFn}\`(json_payload, 'application.loan.amount_requested')
    ), 'recommended_rate') as recommended_rate,
  \`${extractFn}\`(
    \`${enrichFn}\`(
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      \`${extractFn}\`(json_payload, 'application.loan.amount_requested')
    ), 'max_approved_amount') as max_approved_amount,
  \`${extractFn}\`(
    \`${enrichFn}\`(
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score'),
      \`${extractFn}\`(json_payload, 'underwriting.risk_assessment.credit_analysis.dti_ratio'),
      \`${extractFn}\`(json_payload, 'application.loan.amount_requested')
    ), 'risk_tier') as risk_tier
FROM \`${inputTopic}\`

-- WHAT: Chains two UDFs for instant loan pre-qualification.
-- HOW: LoanDetailExtract pulls raw fields → CreditBureauEnrich computes score_band, approval_probability, recommended_rate → LoanDetailExtract extracts each enriched field.
-- WHY chained UDFs: One UDF returns a JSON object, the other extracts individual fields from it. Together they do complex enrichment in a single SQL statement.
-- GOTCHA: CreditBureauEnrich is called 5 times (once per output field). Flink may optimize this internally.`;
}

// ===========================================================================
// Part A: Java Scalar Extract Setup
// ===========================================================================

export async function setupScalarExtractExample(
  store: StoreSlice,
  onProgress: (step: string) => void,
): Promise<{ runId: string }> {
  const rid = generateRunId();
  const fnName = `${rid}_${BASE_JAVA_FN}`;
  const inputTopic = `${BASE_INPUT_TOPIC}-${rid}`;
  const outputTopic = `${BASE_SCALAR_OUTPUT_TOPIC}-${rid}`;
  const datasetSubject = `${inputTopic}-value`;
  const datasetName = `${BASE_INPUT_TOPIC}-${rid}`;

  // Step 1: Upload artifact (reuses existing by class if available)
  const artifact = await uploadArtifact(
    store, 'platform-examples-flink-kickstarter', JAVA_UDF_CLASS,
    '/examples/flink-kickstarter-udfs-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );

  // Step 2: Create tables (also creates backing Kafka topics on Confluent Cloud)
  await createTable(inputTopic, inputTableDDL(inputTopic), onProgress);
  await createTable(outputTopic, scalarOutputDDL(outputTopic), onProgress);

  // Step 3: Generate dataset
  onProgress('Generating test data...');
  const records = generateLoanApplicationDataset(200);
  const now = new Date().toISOString();
  const datasetId = crypto.randomUUID();
  store.addSchemaDataset({
    id: datasetId,
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
  store.addStatement(createFnSQL, undefined, `function-creation-${rid}`);
  store.addStatement(
    scalarExtractSQL(fnName, inputTopic, outputTopic),
    undefined,
    `exec-udf-${rid}`,
  );
  // Cell 3: view output topic results as they flow in
  store.addStatement(
    `SELECT * FROM \`${outputTopic}\` LIMIT 50`,
    undefined,
    `view-output-${rid}`,
  );

  // Open stream panel with input topic card in Produce mode, dataset pre-selected
  store.setStreamsPanelOpen(true);
  store.addStreamCard(inputTopic, 'produce-consume', datasetId, { type: 'loan-applications', count: 200 });

  return { runId: rid };
}

// ===========================================================================
// Part B: Python Table Explode Setup
// ===========================================================================

export async function setupTableExplodeExample(
  store: StoreSlice,
  onProgress: (step: string) => void,
): Promise<{ runId: string }> {
  const rid = generateRunId();
  const extractFn = `${rid}_${BASE_PYTHON_EXTRACT_FN}`;
  const explodeFn = `${rid}_${BASE_PYTHON_EXPLODE_FN}`;
  const inputTopic = `${BASE_INPUT_TOPIC}-${rid}`;
  const outputTopic = `${BASE_EXPLODE_OUTPUT_TOPIC}-${rid}`;
  const datasetSubject = `${inputTopic}-value`;
  const datasetName = `${BASE_INPUT_TOPIC}-${rid}`;

  // Step 1: Upload artifact (reuses existing by class if available)
  const artifact = await uploadArtifact(
    store, 'platform-examples-loan-python-udf', PYTHON_EXPLODE_CLASS,
    '/examples/loan-detail-udf-python.zip', 'ZIP', 'PYTHON', onProgress,
  );

  // Step 2: Create tables (also creates backing Kafka topics on Confluent Cloud)
  await createTable(inputTopic, inputTableDDL(inputTopic), onProgress);
  await createTable(outputTopic, explodeOutputDDL(outputTopic), onProgress);

  // Step 3: Generate dataset
  onProgress('Generating test data...');
  const records = generateLoanApplicationDataset(200);
  const now = new Date().toISOString();
  const datasetId = crypto.randomUUID();
  store.addSchemaDataset({
    id: datasetId,
    name: datasetName,
    schemaSubject: datasetSubject,
    records: records as unknown as Record<string, unknown>[],
    createdAt: now,
    updatedAt: now,
  });

  // Step 5: Add two workspace cells (user runs these)
  const version = artifact.versions?.[0]?.version;
  if (!version) throw new Error(`Artifact ${artifact.id} has no versions yet — try again in a moment`);
  onProgress('Adding queries to workspace...');
  // Two separate cells — Confluent API only accepts one statement at a time
  store.addStatement(createFunctionSQL(extractFn, PYTHON_EXTRACT_CLASS, artifact.id, version, 'PYTHON'), undefined, `fn-extract-${rid}`);
  store.addStatement(createFunctionSQL(explodeFn, PYTHON_EXPLODE_CLASS, artifact.id, version, 'PYTHON'), undefined, `fn-explode-${rid}`);
  store.addStatement(
    tableExplodeSQL(extractFn, explodeFn, inputTopic, outputTopic),
    undefined,
    `exec-udf-${rid}`,
  );
  // Cell 3: view output topic results as they flow in
  store.addStatement(
    `SELECT * FROM \`${outputTopic}\` LIMIT 50`,
    undefined,
    `view-output-${rid}`,
  );

  // Open stream panel with input topic card in Produce mode, dataset pre-selected
  store.setStreamsPanelOpen(true);
  store.addStreamCard(inputTopic, 'produce-consume', datasetId, { type: 'loan-applications', count: 200 });

  return { runId: rid };
}
// ===========================================================================
// Part C: Java Table Explode Setup
// ===========================================================================

export async function setupJavaTableExplodeExample(
  store: StoreSlice,
  onProgress: (step: string) => void,
): Promise<{ runId: string }> {
  const rid = generateRunId();
  const extractFn = `${rid}_${BASE_JAVA_FN}`;
  const explodeFn = `${rid}_${BASE_JAVA_EXPLODE_FN}`;
  const inputTopic = `${BASE_INPUT_TOPIC}-${rid}`;
  const outputTopic = `${BASE_EXPLODE_OUTPUT_TOPIC}-${rid}`;
  const datasetSubject = `${inputTopic}-value`;
  const datasetName = `${BASE_INPUT_TOPIC}-${rid}`;

  // Find existing JAR artifact by class — skips upload if already present
  const artifact = await uploadArtifact(
    store, 'platform-examples-flink-kickstarter', JAVA_UDF_CLASS,
    '/examples/flink-kickstarter-udfs-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );

  await createTable(inputTopic, inputTableDDL(inputTopic), onProgress);
  await createTable(outputTopic, explodeOutputDDL(outputTopic), onProgress);

  onProgress('Generating test data...');
  const records = generateLoanApplicationDataset(200);
  const now = new Date().toISOString();
  const datasetId = crypto.randomUUID();
  store.addSchemaDataset({
    id: datasetId,
    name: datasetName,
    schemaSubject: datasetSubject,
    records: records as unknown as Record<string, unknown>[],
    createdAt: now,
    updatedAt: now,
  });

  const version = artifact.versions?.[0]?.version;
  if (!version) throw new Error(`Artifact ${artifact.id} has no versions yet — try again in a moment`);

  onProgress('Adding queries to workspace...');
  // Cell 1: Register scalar extract function
  store.addStatement(createFunctionSQL(extractFn, JAVA_UDF_CLASS, artifact.id, version), undefined, `fn-extract-${rid}`);
  // Cell 2: Register table explode function (same artifact, different class)
  store.addStatement(createFunctionSQL(explodeFn, JAVA_EXPLODE_CLASS, artifact.id, version), undefined, `fn-explode-${rid}`);
  // Cell 3: LATERAL TABLE query
  store.addStatement(tableExplodeJavaSQL(extractFn, explodeFn, inputTopic, outputTopic), undefined, `exec-udf-${rid}`);
  // Cell 4: View output
  store.addStatement(`SELECT * FROM \`${outputTopic}\` LIMIT 50`, undefined, `view-output-${rid}`);

  store.setStreamsPanelOpen(true);
  store.addStreamCard(inputTopic, 'produce-consume', datasetId, { type: 'loan-applications', count: 200 });

  return { runId: rid };
}

// ===========================================================================
// Part D: Aggregate UDF — Portfolio Stats with WeightedAvg
// ===========================================================================

export async function setupAggregateUdfExample(
  store: StoreSlice,
  onProgress: (step: string) => void,
): Promise<{ runId: string }> {
  const rid = generateRunId();
  const extractFn = `${rid}_LoanDetailExtract`;
  const weightedAvgFn = `${rid}_WeightedAvg`;
  const inputTopic = `${BASE_INPUT_TOPIC}-${rid}`;
  const outputTopic = `LOAN-PORTFOLIO-STATS-${rid}`;

  // Step 1: Upload artifacts (reuses existing by class if available)
  const extractArtifact = await uploadArtifact(
    store, 'platform-examples-flink-kickstarter', JAVA_UDF_CLASS,
    '/examples/flink-kickstarter-udfs-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );
  const weightedAvgArtifact = await uploadArtifact(
    store, 'platform-examples-weighted-avg', WEIGHTED_AVG_CLASS,
    '/udf/credit-bureau-enrich-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );

  // Step 2: Create tables
  await createTable(inputTopic, inputTableDDL(inputTopic), onProgress);
  await createTable(outputTopic, aggregateOutputDDL(outputTopic), onProgress);

  // Step 3: Generate dataset
  onProgress('Generating test data...');
  const records = generateLoanApplicationDataset(200);
  const now = new Date().toISOString();
  const datasetId = crypto.randomUUID();
  store.addSchemaDataset({
    id: datasetId,
    name: `${BASE_INPUT_TOPIC}-${rid}`,
    schemaSubject: `${inputTopic}-value`,
    records: records as unknown as Record<string, unknown>[],
    createdAt: now,
    updatedAt: now,
  });

  // Step 4: Add workspace cells
  const extractVer = extractArtifact.versions?.[0]?.version;
  const weightedAvgVer = weightedAvgArtifact.versions?.[0]?.version;
  if (!extractVer) throw new Error(`Artifact ${extractArtifact.id} has no versions yet — try again in a moment`);
  if (!weightedAvgVer) throw new Error(`Artifact ${weightedAvgArtifact.id} has no versions yet — try again in a moment`);

  onProgress('Adding queries to workspace...');
  store.addStatement(createFunctionSQL(extractFn, JAVA_UDF_CLASS, extractArtifact.id, extractVer), undefined, `fn-extract-${rid}`);
  store.addStatement(createFunctionSQL(weightedAvgFn, WEIGHTED_AVG_CLASS, weightedAvgArtifact.id, weightedAvgVer), undefined, `fn-weighted-avg-${rid}`);
  store.addStatement(aggregateUdfSQL(extractFn, weightedAvgFn, inputTopic, outputTopic), undefined, `exec-udf-${rid}`);
  store.addStatement(`SELECT * FROM \`${outputTopic}\` LIMIT 50`, undefined, `view-output-${rid}`);

  store.setStreamsPanelOpen(true);
  store.addStreamCard(inputTopic, 'produce-consume', datasetId, { type: 'loan-applications', count: 200 });

  return { runId: rid };
}

// ===========================================================================
// Part E: Validation — Valid + Dead Letter Routing
// ===========================================================================

export async function setupValidationExample(
  store: StoreSlice,
  onProgress: (step: string) => void,
): Promise<{ runId: string }> {
  const rid = generateRunId();
  const extractFn = `${rid}_LoanDetailExtract`;
  const validatorFn = `${rid}_LoanValidator`;
  const inputTopic = `${BASE_INPUT_TOPIC}-${rid}`;
  const validatedTopic = `LOANS-VALIDATED-${rid}`;
  const deadLetterTopic = `LOANS-DEAD-LETTER-${rid}`;

  // Step 1: Upload artifacts
  const extractArtifact = await uploadArtifact(
    store, 'platform-examples-flink-kickstarter', JAVA_UDF_CLASS,
    '/examples/flink-kickstarter-udfs-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );
  const validatorArtifact = await uploadArtifact(
    store, 'platform-examples-loan-validator', LOAN_VALIDATOR_CLASS,
    '/udf/loan-validator-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );

  // Step 2: Create tables (input + 2 outputs)
  await createTable(inputTopic, inputTableDDL(inputTopic), onProgress);
  await createTable(validatedTopic, validatedOutputDDL(validatedTopic), onProgress);
  await createTable(deadLetterTopic, deadLetterOutputDDL(deadLetterTopic), onProgress);

  // Step 3: Generate dataset
  onProgress('Generating test data...');
  const records = generateLoanApplicationDataset(200);
  const now = new Date().toISOString();
  const datasetId = crypto.randomUUID();
  store.addSchemaDataset({
    id: datasetId,
    name: `${BASE_INPUT_TOPIC}-${rid}`,
    schemaSubject: `${inputTopic}-value`,
    records: records as unknown as Record<string, unknown>[],
    createdAt: now,
    updatedAt: now,
  });

  // Step 4: Add workspace cells (2 CREATE FUNCTION + 2 INSERT INTO + 2 SELECT)
  const extractVer = extractArtifact.versions?.[0]?.version;
  const validatorVer = validatorArtifact.versions?.[0]?.version;
  if (!extractVer) throw new Error(`Artifact ${extractArtifact.id} has no versions yet — try again in a moment`);
  if (!validatorVer) throw new Error(`Artifact ${validatorArtifact.id} has no versions yet — try again in a moment`);

  onProgress('Adding queries to workspace...');
  store.addStatement(createFunctionSQL(extractFn, JAVA_UDF_CLASS, extractArtifact.id, extractVer), undefined, `fn-extract-${rid}`);
  store.addStatement(createFunctionSQL(validatorFn, LOAN_VALIDATOR_CLASS, validatorArtifact.id, validatorVer), undefined, `fn-validator-${rid}`);
  store.addStatement(validationValidSQL(extractFn, validatorFn, inputTopic, validatedTopic), undefined, `exec-valid-${rid}`);
  store.addStatement(validationDeadLetterSQL(extractFn, validatorFn, inputTopic, deadLetterTopic), undefined, `exec-dead-letter-${rid}`);
  store.addStatement(`SELECT * FROM \`${validatedTopic}\` LIMIT 50`, undefined, `view-validated-${rid}`);
  store.addStatement(`SELECT * FROM \`${deadLetterTopic}\` LIMIT 50`, undefined, `view-dead-letter-${rid}`);

  store.setStreamsPanelOpen(true);
  store.addStreamCard(inputTopic, 'produce-consume', datasetId, { type: 'loan-applications', count: 200 });

  return { runId: rid };
}

// ===========================================================================
// Part F: PII Masking
// ===========================================================================

export async function setupPiiMaskingExample(
  store: StoreSlice,
  onProgress: (step: string) => void,
): Promise<{ runId: string }> {
  const rid = generateRunId();
  const extractFn = `${rid}_LoanDetailExtract`;
  const maskFn = `${rid}_PiiMask`;
  const inputTopic = `${BASE_INPUT_TOPIC}-${rid}`;
  const outputTopic = `LOANS-MASKED-${rid}`;

  // Step 1: Upload artifacts
  const extractArtifact = await uploadArtifact(
    store, 'platform-examples-flink-kickstarter', JAVA_UDF_CLASS,
    '/examples/flink-kickstarter-udfs-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );
  const maskArtifact = await uploadArtifact(
    store, 'platform-examples-pii-mask', PII_MASK_CLASS,
    '/udf/pii-mask-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );

  // Step 2: Create tables
  await createTable(inputTopic, inputTableDDL(inputTopic), onProgress);
  await createTable(outputTopic, maskedOutputDDL(outputTopic), onProgress);

  // Step 3: Generate dataset
  onProgress('Generating test data...');
  const records = generateLoanApplicationDataset(200);
  const now = new Date().toISOString();
  const datasetId = crypto.randomUUID();
  store.addSchemaDataset({
    id: datasetId,
    name: `${BASE_INPUT_TOPIC}-${rid}`,
    schemaSubject: `${inputTopic}-value`,
    records: records as unknown as Record<string, unknown>[],
    createdAt: now,
    updatedAt: now,
  });

  // Step 4: Add workspace cells
  const extractVer = extractArtifact.versions?.[0]?.version;
  const maskVer = maskArtifact.versions?.[0]?.version;
  if (!extractVer) throw new Error(`Artifact ${extractArtifact.id} has no versions yet — try again in a moment`);
  if (!maskVer) throw new Error(`Artifact ${maskArtifact.id} has no versions yet — try again in a moment`);

  onProgress('Adding queries to workspace...');
  store.addStatement(createFunctionSQL(extractFn, JAVA_UDF_CLASS, extractArtifact.id, extractVer), undefined, `fn-extract-${rid}`);
  store.addStatement(createFunctionSQL(maskFn, PII_MASK_CLASS, maskArtifact.id, maskVer), undefined, `fn-pii-mask-${rid}`);
  store.addStatement(piiMaskingSQL(extractFn, maskFn, inputTopic, outputTopic), undefined, `exec-udf-${rid}`);
  store.addStatement(`SELECT * FROM \`${outputTopic}\` LIMIT 50`, undefined, `view-output-${rid}`);

  store.setStreamsPanelOpen(true);
  store.addStreamCard(inputTopic, 'produce-consume', datasetId, { type: 'loan-applications', count: 200 });

  return { runId: rid };
}

// ===========================================================================
// Part G: Async Enrichment — Credit Bureau Enrich
// ===========================================================================

export async function setupAsyncEnrichmentExample(
  store: StoreSlice,
  onProgress: (step: string) => void,
): Promise<{ runId: string }> {
  const rid = generateRunId();
  const extractFn = `${rid}_LoanDetailExtract`;
  const enrichFn = `${rid}_CreditBureauEnrich`;
  const inputTopic = `${BASE_INPUT_TOPIC}-${rid}`;
  const outputTopic = `LOANS-ENRICHED-V2-${rid}`;

  // Step 1: Upload artifacts
  const extractArtifact = await uploadArtifact(
    store, 'platform-examples-flink-kickstarter', JAVA_UDF_CLASS,
    '/examples/flink-kickstarter-udfs-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );
  const enrichArtifact = await uploadArtifact(
    store, 'platform-examples-credit-bureau-enrich', CREDIT_BUREAU_ENRICH_CLASS,
    '/udf/credit-bureau-enrich-1.0.0.jar', 'JAR', 'JAVA', onProgress,
  );

  // Step 2: Create tables
  await createTable(inputTopic, inputTableDDL(inputTopic), onProgress);
  await createTable(outputTopic, enrichedOutputDDL(outputTopic), onProgress);

  // Step 3: Generate dataset
  onProgress('Generating test data...');
  const records = generateLoanApplicationDataset(200);
  const now = new Date().toISOString();
  const datasetId = crypto.randomUUID();
  store.addSchemaDataset({
    id: datasetId,
    name: `${BASE_INPUT_TOPIC}-${rid}`,
    schemaSubject: `${inputTopic}-value`,
    records: records as unknown as Record<string, unknown>[],
    createdAt: now,
    updatedAt: now,
  });

  // Step 4: Add workspace cells
  const extractVer = extractArtifact.versions?.[0]?.version;
  const enrichVer = enrichArtifact.versions?.[0]?.version;
  if (!extractVer) throw new Error(`Artifact ${extractArtifact.id} has no versions yet — try again in a moment`);
  if (!enrichVer) throw new Error(`Artifact ${enrichArtifact.id} has no versions yet — try again in a moment`);

  onProgress('Adding queries to workspace...');
  store.addStatement(createFunctionSQL(extractFn, JAVA_UDF_CLASS, extractArtifact.id, extractVer), undefined, `fn-extract-${rid}`);
  store.addStatement(createFunctionSQL(enrichFn, CREDIT_BUREAU_ENRICH_CLASS, enrichArtifact.id, enrichVer), undefined, `fn-enrich-${rid}`);
  store.addStatement(asyncEnrichmentSQL(extractFn, enrichFn, inputTopic, outputTopic), undefined, `exec-udf-${rid}`);
  store.addStatement(`SELECT * FROM \`${outputTopic}\` LIMIT 50`, undefined, `view-output-${rid}`);

  store.setStreamsPanelOpen(true);
  store.addStreamCard(inputTopic, 'produce-consume', datasetId, { type: 'loan-applications', count: 200 });

  return { runId: rid };
}
