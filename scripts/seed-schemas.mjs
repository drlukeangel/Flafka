/**
 * seed-schemas.mjs
 * Creates test schemas in Confluent Schema Registry for UI development/testing.
 * Usage: node scripts/seed-schemas.mjs
 *
 * Reads credentials from .env (VITE_SCHEMA_REGISTRY_URL, VITE_SCHEMA_REGISTRY_KEY,
 * VITE_SCHEMA_REGISTRY_SECRET).
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse .env file
function loadEnv() {
  const envPath = resolve(__dirname, '../.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

const env = loadEnv();

const SR_URL = env.VITE_SCHEMA_REGISTRY_URL;
const SR_KEY = env.VITE_SCHEMA_REGISTRY_KEY;
const SR_SECRET = env.VITE_SCHEMA_REGISTRY_SECRET;

if (!SR_URL || !SR_KEY || !SR_SECRET) {
  console.error('Missing VITE_SCHEMA_REGISTRY_URL / VITE_SCHEMA_REGISTRY_KEY / VITE_SCHEMA_REGISTRY_SECRET in .env');
  process.exit(1);
}

const KAFKA_REST = env.VITE_KAFKA_REST_ENDPOINT;
const KAFKA_KEY = env.VITE_KAFKA_API_KEY;
const KAFKA_SECRET = env.VITE_KAFKA_API_SECRET;
const KAFKA_CLUSTER_ID = env.VITE_KAFKA_CLUSTER_ID;

const srAuth = Buffer.from(`${SR_KEY}:${SR_SECRET}`).toString('base64');
const srHeaders = {
  'Authorization': `Basic ${srAuth}`,
  'Content-Type': 'application/vnd.schemaregistry.v1+json',
};

const kafkaAuth = Buffer.from(`${KAFKA_KEY}:${KAFKA_SECRET}`).toString('base64');
const kafkaHeaders = {
  'Authorization': `Basic ${kafkaAuth}`,
  'Content-Type': 'application/json',
};

// ── Schema Registry helpers ──────────────────────────────────────────────────

async function registerSchema(subject, schemaType, schema) {
  const body = JSON.stringify({ schemaType, schema: JSON.stringify(schema) });
  const res = await fetch(`${SR_URL}/subjects/${subject}/versions`, {
    method: 'POST',
    headers: srHeaders,
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`  ✗ schema ${subject}: ${res.status} ${JSON.stringify(json)}`);
  } else {
    console.log(`  ✓ schema ${subject} → id ${json.id}`);
  }
  return json;
}

// ── Kafka Topic helpers ──────────────────────────────────────────────────────

async function createTopic(topicName, partitions = 1, retentionMs = 3600000) {
  if (!KAFKA_REST || !KAFKA_KEY || !KAFKA_CLUSTER_ID) {
    console.warn(`  ⚠ Kafka env not configured — skipping topic ${topicName}`);
    return;
  }
  const body = JSON.stringify({
    topic_name: topicName,
    partitions_count: partitions,
    configs: [
      { name: 'retention.ms', value: String(retentionMs) },
      { name: 'cleanup.policy', value: 'delete' },
    ],
  });
  const res = await fetch(
    `${KAFKA_REST}/kafka/v3/clusters/${KAFKA_CLUSTER_ID}/topics`,
    { method: 'POST', headers: kafkaHeaders, body },
  );
  const json = await res.json();
  if (res.status === 409) {
    console.log(`  ~ topic ${topicName} already exists`);
  } else if (!res.ok) {
    console.error(`  ✗ topic ${topicName}: ${res.status} ${JSON.stringify(json)}`);
  } else {
    console.log(`  ✓ topic ${topicName}`);
  }
}

// ── Schema definitions ───────────────────────────────────────────────────────

const schemas = [
  {
    subject: 'test-loans-value',
    schemaType: 'AVRO',
    schema: {
      type: 'record', name: 'Loan', namespace: 'com.example',
      fields: [
        { name: 'loan_id', type: 'string' },
        { name: 'customer_id', type: 'string' },
        { name: 'amount', type: 'double' },
        { name: 'status', type: { type: 'enum', name: 'LoanStatus', symbols: ['PENDING', 'APPROVED', 'REJECTED'] } },
        { name: 'created_at', type: 'string' },
        { name: 'txn_id', type: 'string' },
      ],
    },
  },
  {
    subject: 'test-customers-value',
    schemaType: 'AVRO',
    schema: {
      type: 'record', name: 'Customer', namespace: 'com.example',
      fields: [
        { name: 'customer_id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'credit_score', type: 'int' },
        { name: 'risk_level', type: { type: 'enum', name: 'RiskLevel', symbols: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] } },
        { name: 'state', type: 'string' },
      ],
    },
  },
  {
    subject: 'test-fraud-alerts-value',
    schemaType: 'AVRO',
    schema: {
      type: 'record', name: 'FraudAlert', namespace: 'com.example',
      fields: [
        { name: 'loan_id', type: 'string' },
        { name: 'customer_name', type: 'string' },
        { name: 'risk_level', type: 'string' },
        { name: 'alert_reason', type: 'string' },
        { name: 'flagged_at', type: 'string' },
      ],
    },
  },
  {
    subject: 'test-loan-stats-value',
    schemaType: 'AVRO',
    schema: {
      type: 'record', name: 'LoanStats', namespace: 'com.example',
      fields: [
        { name: 'status', type: 'string' },
        { name: 'loan_count', type: 'long' },
        { name: 'total_amount', type: 'double' },
        { name: 'window_start', type: 'string' },
        { name: 'window_end', type: 'string' },
      ],
    },
  },
  {
    subject: 'test-notifications-value',
    schemaType: 'AVRO',
    schema: {
      type: 'record', name: 'Notification', namespace: 'com.example',
      fields: [
        { name: 'id', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'channel', type: { type: 'enum', name: 'Channel', symbols: ['EMAIL', 'SMS', 'PUSH'] } },
        { name: 'message', type: 'string' },
        { name: 'sent_at', type: { type: 'long', logicalType: 'timestamp-millis' } },
        { name: 'read', type: 'boolean', default: false },
      ],
    },
  },
  {
    subject: 'test-events-value',
    schemaType: 'JSON',
    schema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Event', type: 'object',
      properties: {
        event_id: { type: 'string' },
        event_type: { type: 'string' },
        payload: { type: 'object' },
        timestamp: { type: 'string', format: 'date-time' },
      },
      required: ['event_id', 'event_type', 'timestamp'],
    },
  },
];

// ── Topic definitions ────────────────────────────────────────────────────────

const topics = [
  'test-loans',
  'test-customers',
  'test-fraud-alerts',
  'test-loan-stats',
  'test-notifications',
  'test-events',
];

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`Schema Registry: ${SR_URL}`);
console.log(`Kafka REST:      ${KAFKA_REST || '(not configured)'}\n`);

console.log('Creating topics...');
for (const topic of topics) {
  await createTopic(topic);
}

console.log('\nRegistering schemas...');
for (const { subject, schemaType, schema } of schemas) {
  await registerSchema(subject, schemaType, schema);
}

console.log('\nDone.');
