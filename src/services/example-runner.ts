/**
 * @example-runner
 * Generic template engine for Quick Start example cards.
 *
 * New examples are defined as typed KickstarterExampleDef config objects.
 * This runner handles all infrastructure boilerplate: table creation,
 * dataset generation, stream card registration, and SQL cell injection.
 *
 * To add a new example: write a config file + register the card. No new
 * runner code required for standard examples.
 */

import { createTable, type BaseExampleStoreSlice } from './example-helpers';
import { createTopic as createKafkaTopic } from '../api/topic-api';
import { generateFunName } from '../utils/names';
import type { ExampleCompletionModal } from '../types';
import {
  generateLoanUpdates,
  generateSecuritizedLoans,
  generateAiAuditLog,
  generatePaymentEvents,
  generateLoanCommitments,
  generateMarketRates,
} from '../data/view-sample-generators';
import {
  generateLoanCoborrowers,
  generateLoansWithProperty,
  generatePropertyReference,
  generateLatePaymentReports,
  generateLoanEvents,
  generateLoanEventsDept,
  generateRoutingRulesArrayDynamic,
  generateRoutingRulesThree,
  generateRoutingRulesAddRefinance,
  generateRoutingRulesAddFinance,
  generateRoutingRulesRemoveSubscriber,
  generateLoanEventsRefinance,
  generateLoanEventsTermination,
  generateLoanEventsForeclosure,
  generatePaymentStream,
  generateBorrowerReference,
} from '../data/new-example-generators';

// ---------------------------------------------------------------------------
// Table schema registry
// ---------------------------------------------------------------------------

type DDLFactory = (tableName: string) => string;

const TABLE_SCHEMAS: Record<string, DDLFactory | string> = {
  'loans-standard': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  created_at STRING,
  txn_id STRING,
  customer_id STRING
)`,
  // alias — identical DDL to loans-standard
  'loans-filtered': 'loans-standard',
  'loans-stats': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  window_start STRING,
  window_end STRING,
  status STRING,
  loan_count BIGINT,
  total_amount DOUBLE
)`,
  'customers-risk': (n) => `CREATE TABLE \`${n}\` (
  customer_id STRING NOT NULL,
  name STRING,
  risk_score INT,
  risk_level STRING,
  PRIMARY KEY (customer_id) NOT ENFORCED
)`,
  'customers-credit': (n) => `CREATE TABLE \`${n}\` (
  customer_id STRING NOT NULL,
  name STRING,
  credit_score INT,
  state STRING,
  valid_from STRING,
  PRIMARY KEY (customer_id) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  // Streaming join is append-only — no changelog.mode or PRIMARY KEY needed
  'fraud-alerts': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  loan_id STRING,
  customer_id STRING,
  amount DOUBLE,
  status STRING,
  txn_id STRING,
  customer_name STRING,
  risk_score INT,
  risk_level STRING,
  alert_reason STRING
)`,
  'loans-enriched': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  loan_id STRING,
  customer_id STRING,
  amount DOUBLE,
  status STRING,
  txn_id STRING,
  customer_name STRING,
  credit_score INT,
  state STRING
)`,
  // Jokes — no key field (beginner-friendly)
  'jokes': (n) => `CREATE TABLE \`${n}\` (
  joke_id STRING NOT NULL,
  joke STRING,
  category STRING,
  rating STRING,
  PRIMARY KEY (joke_id) NOT ENFORCED
)`,
  'good-jokes': 'jokes',
  // --- New example schemas ---
  'loans-deduped': 'loans-standard',
  'loans-top3': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  window_start STRING,
  window_end STRING,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  txn_id STRING,
  customer_id STRING,
  rank_num BIGINT
)`,
  'loans-hop-stats': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  window_start STRING,
  window_end STRING,
  status STRING,
  loan_count BIGINT,
  total_amount DOUBLE,
  avg_amount DOUBLE
)`,
  'loans-sessions': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  customer_id STRING,
  session_start STRING,
  session_end STRING,
  loan_count BIGINT,
  total_amount DOUBLE,
  avg_amount DOUBLE
)`,
  'customers-latest': (n) => `CREATE TABLE \`${n}\` (
  customer_id STRING NOT NULL,
  name STRING,
  credit_score INT,
  state STRING,
  risk_score INT,
  risk_level STRING,
  PRIMARY KEY (customer_id) NOT ENFORCED
)`,
  'pattern-alerts': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  customer_id STRING,
  first_txn STRING,
  last_txn STRING,
  app_count BIGINT,
  total_amount DOUBLE,
  avg_amount DOUBLE,
  first_time STRING,
  last_time STRING
)`,
  'running-stats': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  customer_id STRING,
  txn_id STRING,
  amount DOUBLE,
  status STRING,
  running_count BIGINT,
  running_total DOUBLE,
  running_avg DOUBLE
)`,
  'status-changes': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  customer_id STRING,
  txn_id STRING,
  loan_id STRING,
  amount DOUBLE,
  prev_status STRING,
  current_status STRING,
  prev_amount DOUBLE,
  amount_change DOUBLE
)`,
  'interval-joined': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  customer_id STRING,
  txn_id STRING,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  customer_name STRING,
  credit_score INT
)`,
  'stream-enriched': 'interval-joined',
  'customers-stream': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  customer_id STRING,
  name STRING,
  credit_score INT,
  state STRING
)`,
  // --- Schemaless topic example (21) ---
  'raw-events': (n) => `CREATE TABLE \`${n}\` (
  \`val\` VARBINARY
)`,
  'raw-events-parsed': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  event_id STRING,
  event_type STRING,
  user_id STRING,
  amount DOUBLE,
  currency STRING,
  event_ts BIGINT
)`,
  'loans-masked-sql': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  hashed_loan_id STRING,
  amount DOUBLE,
  status STRING,
  masked_customer_id STRING,
  created_at STRING
)`,
  // --- View example schemas ---
  'loan-updates': (n) => `CREATE TABLE \`${n}\` (
  loan_id STRING,
  status STRING,
  appraisal_value DOUBLE,
  credit_score INT,
  updated_at STRING
)`,
  'loan-golden-record': (n) => `CREATE TABLE \`${n}\` (
  loan_id STRING NOT NULL,
  latest_status STRING,
  latest_appraisal DOUBLE,
  latest_credit_score INT,
  last_update STRING,
  PRIMARY KEY (loan_id) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  'securitized-loans': (n) => `CREATE TABLE \`${n}\` (
  loan_id STRING,
  zip_code STRING,
  upb DOUBLE,
  origination_date STRING,
  ltv DOUBLE
)`,
  'risk-by-zip': (n) => `CREATE TABLE \`${n}\` (
  zip_code STRING NOT NULL,
  loan_count BIGINT,
  total_exposure DOUBLE,
  avg_loan_size DOUBLE,
  PRIMARY KEY (zip_code) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  'ai-audit-log': (n) => `CREATE TABLE \`${n}\` (
  audit_id STRING,
  model_id STRING,
  prediction STRING,
  human_outcome STRING,
  confidence DOUBLE,
  reviewed_at STRING
)`,
  'payment-events': (n) => `CREATE TABLE \`${n}\` (
  payment_id STRING,
  servicer_id STRING,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  payment_date STRING
)`,
  'servicer-health': (n) => `CREATE TABLE \`${n}\` (
  servicer_id STRING NOT NULL,
  window_start STRING,
  window_end STRING,
  total_payments BIGINT,
  delinquent_payments BIGINT,
  delinquency_rate DOUBLE,
  PRIMARY KEY (servicer_id) NOT ENFORCED
)`,
  'loan-commitments': (n) => `CREATE TABLE \`${n}\` (
  commitment_id STRING,
  loan_id STRING,
  product_type STRING,
  principal DOUBLE,
  rate_lock_date STRING
)`,
  'market-rates': (n) => `CREATE TABLE \`${n}\` (
  product_type STRING NOT NULL,
  base_rate DOUBLE,
  spread DOUBLE,
  effective_date STRING,
  PRIMARY KEY (product_type) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  // --- New pattern examples ---
  'daily-commitment-stats': (n) => `CREATE TABLE \`${n}\` (
  product_type STRING NOT NULL,
  window_start STRING,
  window_end STRING,
  commitment_count BIGINT,
  total_principal DOUBLE,
  avg_principal DOUBLE,
  PRIMARY KEY (product_type) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  'loan-coborrowers': (n) => `CREATE TABLE \`${n}\` (
  loan_id STRING,
  primary_borrower STRING,
  primary_score INT,
  coborrower_names ARRAY<STRING>,
  coborrower_scores ARRAY<INT>
)`,
  'borrower-details': (n) => `CREATE TABLE \`${n}\` (
  loan_id STRING,
  borrower_name STRING,
  credit_score INT,
  borrower_index INT
)`,
  'loans-with-property': (n) => `CREATE TABLE \`${n}\` (
  loan_id STRING,
  property_id STRING,
  amount DOUBLE,
  status STRING,
  borrower_id STRING
)`,
  'property-reference': (n) => `CREATE TABLE \`${n}\` (
  property_id STRING NOT NULL,
  appraisal_value DOUBLE,
  flood_zone STRING,
  property_type STRING,
  last_assessed STRING,
  PRIMARY KEY (property_id) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  'loans-appraised': (n) => `CREATE TABLE \`${n}\` (
  loan_id STRING,
  property_id STRING,
  amount DOUBLE,
  appraisal_value DOUBLE,
  flood_zone STRING,
  ltv_ratio DOUBLE
)`,
  'late-payment-reports': (n) => `CREATE TABLE \`${n}\` (
  payment_id STRING,
  servicer_id STRING,
  amount DOUBLE,
  event_time_ms BIGINT
)`,
  'ontime-payment-stats': (n) => `CREATE TABLE \`${n}\` (
  servicer_id STRING NOT NULL,
  window_start STRING,
  window_end STRING,
  payment_count BIGINT,
  total_amount DOUBLE,
  PRIMARY KEY (servicer_id) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  'loan-velocity-stats': (n) => `CREATE TABLE \`${n}\` (
  customer_id STRING,
  txn_id STRING,
  loan_id STRING,
  amount DOUBLE,
  window_loan_count BIGINT,
  window_total_amount DOUBLE,
  window_avg_amount DOUBLE
)`,
  'loan-events': (n) => `CREATE TABLE \`${n}\` (
  event_id STRING,
  loan_id STRING,
  event_type STRING,
  amount DOUBLE,
  borrower_id STRING,
  event_ts STRING
)`,
  'routing-rules': (n) => `CREATE TABLE \`${n}\` (
  department STRING NOT NULL,
  event_type STRING NOT NULL,
  active BOOLEAN,
  PRIMARY KEY (department, event_type) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  'routed-events': 'loan-events',
  'loan-events-dept': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  event_id STRING,
  loan_id STRING,
  event_type STRING,
  amount DOUBLE,
  created_at STRING,
  department STRING
)`,
  'routing-rules-array': (n) => `CREATE TABLE \`${n}\` (
  event_type STRING NOT NULL,
  target_topics ARRAY<STRING>,
  updated_at STRING,
  PRIMARY KEY (event_type) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  'routed-events-sink': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  target_topic STRING,
  event_id STRING,
  loan_id STRING,
  event_type STRING,
  amount DOUBLE,
  department STRING
)`,
  'routed-events-dept': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  event_id STRING,
  loan_id STRING,
  event_type STRING,
  amount DOUBLE,
  department STRING
)`,
  // --- JSON routing aliases (same DDL — Confluent Cloud manages format at producer level) ---
  'loan-events-dept-json': 'loan-events-dept',
  'routing-rules-array-json': 'routing-rules-array',
  'routed-events-sink-json': 'routed-events-sink',
  'routed-events-dept-json': 'routed-events-dept',
  'payment-stream': (n) => `CREATE TABLE \`${n}\` (
  payment_id STRING,
  borrower_id STRING,
  amount DOUBLE,
  payment_date STRING,
  payment_type STRING
)`,
  'borrower-reference': (n) => `CREATE TABLE \`${n}\` (
  borrower_id STRING NOT NULL,
  name STRING,
  region STRING,
  risk_tier STRING,
  account_status STRING,
  PRIMARY KEY (borrower_id) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  'enriched-payments': (n) => `CREATE TABLE \`${n}\` (
  payment_id STRING,
  borrower_id STRING,
  borrower_name STRING,
  region STRING,
  risk_tier STRING,
  amount DOUBLE,
  payment_type STRING
)`,
  // Virtual view placeholder — used by type='view' tables; no DDL generated
  'view': (n) => `-- Virtual view: ${n} (created by CREATE VIEW SQL cell)`,
  // --- Kafka/Confluent example schemas ---
  'kafka-messages': (n) => `CREATE TABLE \`${n}\` (
  \`key\` BYTES,
  message_key STRING,
  message_value STRING,
  event_time TIMESTAMP(3)
)`,
  'kafka-events': (n) => `CREATE TABLE \`${n}\` (
  event_id STRING,
  event_type STRING,
  payload STRING,
  event_time TIMESTAMP(3)
)`,
  'changelog-append': (n) => `CREATE TABLE \`${n}\` (
  user_id STRING,
  action STRING,
  amount DOUBLE,
  event_time TIMESTAMP(3)
)`,
  'changelog-upsert': (n) => `CREATE TABLE \`${n}\` (
  user_id STRING NOT NULL,
  action STRING,
  amount DOUBLE,
  event_time TIMESTAMP(3),
  PRIMARY KEY (user_id) NOT ENFORCED
) WITH ('changelog.mode' = 'upsert')`,
  'format-avro': (n) => `CREATE TABLE \`${n}\` (
  sensor_id STRING,
  temperature DOUBLE,
  humidity DOUBLE,
  event_time TIMESTAMP(3)
)`,
  'format-json': (n) => `CREATE TABLE \`${n}\` (
  sensor_id STRING,
  temperature DOUBLE,
  humidity DOUBLE,
  event_time TIMESTAMP(3)
)`,
  'format-raw': (n) => `CREATE TABLE \`${n}\` (
  raw_payload VARBINARY,
  event_time TIMESTAMP(3)
)`,
  'evolving-schema': (n) => `CREATE TABLE \`${n}\` (
  event_id STRING,
  event_type STRING,
  payload STRING,
  event_time TIMESTAMP(3)
)`,
  'evolved-schema': (n) => `CREATE TABLE \`${n}\` (
  event_id STRING,
  event_type STRING,
  payload STRING,
  priority INT,
  event_time TIMESTAMP(3)
)`,
  'connector-raw': (n) => `CREATE TABLE \`${n}\` (
  source_system STRING,
  event_id STRING,
  event_payload STRING,
  event_type STRING,
  ingestion_time TIMESTAMP(3)
)`,
  'connector-clean': (n) => `CREATE TABLE \`${n}\` (
  source_system STRING,
  event_id STRING,
  event_payload STRING,
  event_type STRING,
  ingestion_time TIMESTAMP(3)
)`,
};

function resolveDDL(key: string, tableName: string): string {
  const entry = TABLE_SCHEMAS[key];
  if (!entry) throw new Error(`Unknown schema: ${key}`);
  if (typeof entry === 'string') return resolveDDL(entry, tableName); // follow alias
  return entry(tableName);
}

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack'];
const LAST_NAMES = ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davis', 'Wilson', 'Moore', 'Anderson', 'Martin'];
const US_STATES = ['CA', 'NY', 'TX', 'FL', 'WA', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'AZ', 'CO'];

function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateFlatLoans(count: number): Record<string, unknown>[] {
  const statuses = ['APPROVED', 'PENDING', 'REJECTED', 'CANCELLED'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    loan_id: `LN-2024-${String(i + 1).padStart(5, '0')}`,
    amount: (Math.floor(Math.random() * 141) + 10) * 500, // 5000–75000, multiples of 500
    status: statuses[i % 4],
    created_at: new Date(now - (count - i) * 5 * 60 * 1000).toISOString(),
    txn_id: `TXN-${String(i + 1).padStart(4, '0')}`,
    customer_id: `C-${String((i % 10) + 1).padStart(3, '0')}`,
    // No `key` field — BYTES column is populated by Kafka message key header, not value payload
  }));
}

function riskLevel(score: number): string {
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 35) return 'MEDIUM';
  return 'LOW';
}

export function generateCustomerRiskProfiles(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => {
    const score = Math.floor(Math.random() * 99) + 1; // 1–99
    return {
      customer_id: `C-${String(i + 1).padStart(3, '0')}`,
      name: `${pickFrom(FIRST_NAMES)} ${pickFrom(LAST_NAMES)}`,
      risk_score: score,
      risk_level: riskLevel(score),
    };
  });
}

export function generateCustomerCreditProfiles(count: number): Record<string, unknown>[] {
  const now = Date.now();
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const customerId = `C-${String(i + 1).padStart(3, '0')}`;
    const name = `${pickFrom(FIRST_NAMES)} ${pickFrom(LAST_NAMES)}`;
    const state = pickFrom(US_STATES);
    const baseScore = Math.floor(Math.random() * 241) + 580; // 580–820
    const shift = (Math.floor(Math.random() * 16) + 15) * (Math.random() < 0.5 ? 1 : -1); // ±15–30
    const secondScore = Math.min(850, Math.max(300, baseScore + shift));
    const t1 = new Date(now - (count - i + 1) * 5 * 60 * 1000).toISOString();
    const t2 = new Date(now - (count - i) * 5 * 60 * 1000).toISOString();
    rows.push({
      customer_id: customerId,
      name,
      credit_score: baseScore,
      state,
      valid_from: t1,
    });
    rows.push({
      customer_id: customerId,
      name,
      credit_score: secondScore,
      state,
      valid_from: t2,
    });
  }
  return rows;
}

export function generateJokes(count: number): Record<string, unknown>[] {
  const JOKES: { joke: string; category: string; rating: string }[] = [
    // Tech
    { joke: "A SQL query walks into a bar, walks up to two tables and asks... 'Can I join you?'", category: 'tech', rating: 'ROFL' },
    { joke: "Why do Java developers wear glasses? Because they don't C#.", category: 'tech', rating: 'LOL' },
    { joke: "There are 10 types of people: those who understand binary and those who don't.", category: 'tech', rating: 'LOL' },
    { joke: "How do you comfort a JavaScript bug? You console it.", category: 'tech', rating: 'LOL' },
    { joke: "Why was the function depressed? It had too many arguments and nobody called.", category: 'tech', rating: 'DEAD' },
    { joke: "I told my computer I needed a break. Now it won't stop sending me Kit Kat ads.", category: 'tech', rating: 'ROFL' },
    { joke: "A TCP packet walks into a bar. 'I'd like a beer.' Bartender: 'You want a beer?' Packet: 'Yes, a beer.'", category: 'tech', rating: 'DEAD' },
    { joke: "Why do programmers prefer dark mode? Because light attracts bugs.", category: 'tech', rating: 'ROFL' },
    { joke: "I tried to write a joke about Kafka but it was too much of a stream of consciousness.", category: 'tech', rating: 'DEAD' },
    { joke: "Why did the developer quit? They didn't get arrays.", category: 'tech', rating: 'LOL' },
    { joke: "My code has no bugs. It has undocumented features.", category: 'tech', rating: 'LOL' },
    { joke: "I have a joke about UDP. You might not get it.", category: 'tech', rating: 'DEAD' },
    { joke: "Debugging is like being the detective in a crime movie where you're also the murderer.", category: 'tech', rating: 'DEAD' },
    { joke: "The best thing about a Boolean is that even if you're wrong, you're only off by a bit.", category: 'tech', rating: 'LOL' },
    { joke: "I asked a database admin what their favorite band is. They said 'DROP TABLE'.", category: 'tech', rating: 'DEAD' },
    { joke: "How many software engineers does it take to change a light bulb? None, that's a hardware problem.", category: 'tech', rating: 'LOL' },
    { joke: "A developer walks into a bar and finds a bug. Now there are 0 bars.", category: 'tech', rating: 'DEAD' },
    { joke: "An SQL query walks into a bar and orders everything in alphabetical ORDER BY.", category: 'tech', rating: 'LOL' },
    { joke: "Why do programmers mix up Halloween and Christmas? Because Oct 31 = Dec 25.", category: 'tech', rating: 'DEAD' },
    { joke: "My wifi password is 'incorrect'. When someone asks what it is, I say 'incorrect' and I'm not lying.", category: 'tech', rating: 'DEAD' },
    // Science
    { joke: "Why don't scientists trust atoms? Because they make up everything.", category: 'science', rating: 'LOL' },
    { joke: "I'd tell you a chemistry joke but I know I wouldn't get a reaction.", category: 'science', rating: 'LOL' },
    { joke: "Did you hear oxygen and potassium went on a date? It was OK.", category: 'science', rating: 'LOL' },
    { joke: "A neutron walks into a bar. 'How much for a beer?' Bartender: 'For you, no charge.'", category: 'science', rating: 'ROFL' },
    { joke: "Schrodinger's cat walks into a bar. And doesn't.", category: 'science', rating: 'DEAD' },
    { joke: "I have a joke about infinity. I never finish it.", category: 'science', rating: 'LOL' },
    { joke: "Why did the photon refuse to check its luggage? It was traveling light.", category: 'science', rating: 'LOL' },
    { joke: "Two blood cells met and fell in love. Sadly it was all in vein.", category: 'science', rating: 'GROAN' },
    { joke: "The mitochondria is the powerhouse of the cell. I've said it. I'll say it again. I'll never stop.", category: 'science', rating: 'ROFL' },
    { joke: "I used to be a banker but I lost interest.", category: 'science', rating: 'DEAD' },
    { joke: "An electron and a proton started a business. Unfortunately they had opposing charges.", category: 'science', rating: 'LOL' },
    { joke: "Why did the physics teacher break up with the biology teacher? There was no chemistry.", category: 'science', rating: 'ROFL' },
    { joke: "I stayed up all night wondering where the sun went. Then it dawned on me.", category: 'science', rating: 'DEAD' },
    { joke: "Why does a Moon-rock taste better than an Earth-rock? It's a little meteor.", category: 'science', rating: 'DEAD' },
    // Wordplay
    { joke: "I have a joke about paper. It's tearable.", category: 'wordplay', rating: 'DEAD' },
    { joke: "Time flies like an arrow. Fruit flies like a banana.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I don't trust stairs. They're always up to something.", category: 'wordplay', rating: 'LOL' },
    { joke: "I named my dog Stay. Now I say: 'Come here, Stay! Come here, Stay!'", category: 'wordplay', rating: 'DEAD' },
    { joke: "I'm writing a book on reverse psychology. Please don't buy it.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I used to hate facial hair. Then it grew on me.", category: 'wordplay', rating: 'LOL' },
    { joke: "I told someone to embrace their mistakes. They gave me a hug.", category: 'wordplay', rating: 'LOL' },
    { joke: "I'm reading a book about anti-gravity. Impossible to put down.", category: 'wordplay', rating: 'ROFL' },
    { joke: "I once got hit in the head with a can of soda. Luckily it was a soft drink.", category: 'wordplay', rating: 'LOL' },
    { joke: "I have a lot of jokes about retired people. None of them work.", category: 'wordplay', rating: 'DEAD' },
    { joke: "The rotation of the Earth really makes my day.", category: 'wordplay', rating: 'LOL' },
    { joke: "I used to be addicted to soap. I'm clean now.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I used to be indecisive. Now I'm not so sure.", category: 'wordplay', rating: 'DEAD' },
    { joke: "The early bird catches the worm. The second mouse gets the cheese. Timing is everything.", category: 'wordplay', rating: 'LOL' },
    { joke: "What do you call a factory that makes OK products? A satisfactory.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I'm on a seafood diet. I see food and I eat it.", category: 'wordplay', rating: 'GROAN' },
    { joke: "What do you call cheese that isn't yours? Nacho cheese.", category: 'wordplay', rating: 'GROAN' },
    { joke: "I have a joke about pizza. Never mind, it's too cheesy.", category: 'wordplay', rating: 'GROAN' },
    { joke: "I tried to write a joke about clocks. It was too time-consuming.", category: 'wordplay', rating: 'MEH' },
    { joke: "I have a joke about construction. Still working on it.", category: 'wordplay', rating: 'MEH' },
    // Dad jokes
    { joke: "What do you call a fake noodle? An impasta.", category: 'dad', rating: 'GROAN' },
    { joke: "Why did the bicycle fall over? It was two-tired.", category: 'dad', rating: 'MEH' },
    { joke: "Did you hear about the claustrophobic astronaut? They needed a little space.", category: 'dad', rating: 'LOL' },
    { joke: "What do you call a fish without eyes? A fsh.", category: 'dad', rating: 'DEAD' },
    { joke: "Why don't eggs tell jokes? They'd crack each other up.", category: 'dad', rating: 'LOL' },
    { joke: "What do you call a sleeping dinosaur? A dino-snore.", category: 'dad', rating: 'GROAN' },
    { joke: "Why did the scarecrow win an award? Outstanding in their field.", category: 'dad', rating: 'LOL' },
    { joke: "Why did the math book look so sad? Too many problems.", category: 'dad', rating: 'GROAN' },
    { joke: "Apparently you can't use 'beefstew' as a password. It's not stroganoff.", category: 'dad', rating: 'DEAD' },
    { joke: "I'm on a whiskey diet. I've lost three days already.", category: 'dad', rating: 'LOL' },
    { joke: "Why can't a leopard hide? Always spotted.", category: 'dad', rating: 'GROAN' },
    { joke: "What's brown and sticky? A stick.", category: 'dad', rating: 'GROAN' },
    { joke: "I bought some shoes from a drug dealer. Don't know what they laced them with but I was tripping all day.", category: 'dad', rating: 'DEAD' },
    { joke: "I have a joke about a broken pencil. Never mind, it's pointless.", category: 'dad', rating: 'DEAD' },
    { joke: "What do you call a bear with no teeth? A gummy bear.", category: 'dad', rating: 'GROAN' },
    // Spicy-safe
    { joke: "They say money can't buy happiness. But it can buy coffee, which is basically the same thing.", category: 'spicy', rating: 'LOL' },
    { joke: "I was addicted to the hokey pokey. I turned myself around.", category: 'spicy', rating: 'DEAD' },
    { joke: "My therapist told me I have trouble letting go of the past. I said: 'We'll see about that.'", category: 'spicy', rating: 'DEAD' },
    { joke: "I don't need a hair stylist. My pillow gives me a new hairstyle every morning.", category: 'spicy', rating: 'LOL' },
    { joke: "I was going to start a diet. Then the fridge light came on and it felt like a sign.", category: 'spicy', rating: 'LOL' },
    { joke: "I asked Siri why I'm still single. It opened the front-facing camera.", category: 'spicy', rating: 'DEAD' },
    { joke: "My patience is like a phone battery — works great right until it doesn't.", category: 'spicy', rating: 'LOL' },
    { joke: "I started a business selling trampolines. It has its ups and downs.", category: 'spicy', rating: 'DEAD' },
    { joke: "Someone stole my mood ring. I don't know how I feel about that.", category: 'spicy', rating: 'DEAD' },
    { joke: "Parallel lines have so much in common. It's a shame they'll never meet.", category: 'spicy', rating: 'LOL' },
    // Flink & Kafka
    { joke: "Why did the Kafka consumer break up with the producer? Too many mixed messages.", category: 'tech', rating: 'DEAD' },
    { joke: "My Flink job and my ex have a lot in common. Both process events I'd rather forget.", category: 'spicy', rating: 'DEAD' },
    { joke: "I told my Kafka cluster I needed space. It gave me 256 more partitions.", category: 'tech', rating: 'LOL' },
    { joke: "Why did the data engineer get promoted? They had great throughput and zero latency in meetings.", category: 'tech', rating: 'LOL' },
    { joke: "My Flink watermark is more behind than my New Year's resolutions.", category: 'tech', rating: 'ROFL' },
    { joke: "A Kafka topic walks into a bar. The bartender says 'I'll get to you eventually, I'm still processing the last guy.'", category: 'tech', rating: 'DEAD' },
    { joke: "I named my cat Kafka. It ignores all my messages but keeps a perfect log of every time I open the fridge.", category: 'tech', rating: 'DEAD' },
    { joke: "Why do Flink developers make terrible DJs? They can't stop windowing.", category: 'tech', rating: 'LOL' },
    { joke: "My Kafka retention policy is longer than my attention span.", category: 'tech', rating: 'ROFL' },
    { joke: "I wrote a Flink job to process my feelings. It's been in RUNNING state for three years.", category: 'spicy', rating: 'DEAD' },
    { joke: "Why did the event fail to process? It arrived late and the watermark had already moved on. Story of my life.", category: 'spicy', rating: 'DEAD' },
    { joke: "Kafka guarantees at-least-once delivery. My mother-in-law guarantees at-least-twelve-times delivery of the same advice.", category: 'spicy', rating: 'DEAD' },
    { joke: "Why do stream processors make great therapists? They handle your events in order without judgment.", category: 'tech', rating: 'LOL' },
    { joke: "I tried exactly-once semantics with my alarm clock. Woke up four times anyway.", category: 'tech', rating: 'ROFL' },
    { joke: "My code compiles on the first try about as often as my Flink checkpoints complete under load.", category: 'tech', rating: 'LOL' },
    // SQL bangers
    { joke: "SELECT * FROM problems WHERE solution IS NULL — that's my morning standup.", category: 'tech', rating: 'DEAD' },
    { joke: "I told SQL I wanted a relationship. It said 'FOREIGN KEY CONSTRAINT VIOLATION.'", category: 'tech', rating: 'DEAD' },
    { joke: "My love life is like a LEFT JOIN. I show up every time, they return NULL.", category: 'spicy', rating: 'DEAD' },
    { joke: "I asked my database for commitment. It said 'ROLLBACK.'", category: 'tech', rating: 'DEAD' },
    { joke: "Why did the DBA leave the party early? Too many deadlocks on the dance floor.", category: 'tech', rating: 'LOL' },
    { joke: "My resume is basically SELECT * FROM skills WHERE years_experience > actual_experience.", category: 'spicy', rating: 'DEAD' },
    { joke: "TRUNCATE TABLE monday_motivation; — runs every Sunday night.", category: 'tech', rating: 'ROFL' },
    { joke: "I don't always test my SQL in production. But when I do, I DROP TABLE accidentally.", category: 'tech', rating: 'DEAD' },
    { joke: "My dating profile is just a poorly optimized query. Full table scan, zero matches.", category: 'spicy', rating: 'DEAD' },
    { joke: "ALTER TABLE life ADD COLUMN happiness INT DEFAULT 0; — still waiting for an UPDATE.", category: 'spicy', rating: 'LOL' },
    { joke: "They say every relationship needs a PRIMARY KEY. Mine keeps throwing duplicate violations.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO weekend (plans) VALUES ('nothing'); — executes successfully every Friday.", category: 'tech', rating: 'LOL' },
    { joke: "My boss asked for a JOIN between work and life. I said that table doesn't exist.", category: 'tech', rating: 'DEAD' },
    { joke: "DELETE FROM fridge WHERE expiry_date < CURRENT_DATE; — returns 47 rows. Terrifying.", category: 'spicy', rating: 'ROFL' },
    { joke: "Why did the index get jealous? The query kept doing full table scans behind its back.", category: 'tech', rating: 'LOL' },
    // More tech
    { joke: "There's no place like 127.0.0.1.", category: 'tech', rating: 'LOL' },
    { joke: "Why do backend developers hate nature? Too many trees, not enough tables.", category: 'tech', rating: 'LOL' },
    { joke: "A QA engineer walks into a bar. Orders 1 beer. Orders 0 beers. Orders 99999 beers. Orders -1 beers. Orders a lizard.", category: 'tech', rating: 'DEAD' },
    { joke: "Why did the developer go broke? Because they used up all their cache.", category: 'tech', rating: 'LOL' },
    { joke: "What's a pirate's favorite programming language? R. You'd think it's Python but they really love the aRRR.", category: 'tech', rating: 'GROAN' },
    { joke: "git commit -m 'fixed bug' — narrator: they had not fixed the bug.", category: 'tech', rating: 'DEAD' },
    { joke: "Why did the microservice break up with the monolith? It needed its own space to grow.", category: 'tech', rating: 'LOL' },
    { joke: "My code works on my machine. We're shipping my machine.", category: 'tech', rating: 'DEAD' },
    { joke: "Why do Python developers need glasses? Because they can't C.", category: 'tech', rating: 'LOL' },
    { joke: "I asked ChatGPT to fix my code. It wrote me a poem about why my code doesn't deserve to work.", category: 'tech', rating: 'DEAD' },
    // More dad jokes
    { joke: "I told my wife she was drawing her eyebrows too high. She looked surprised.", category: 'dad', rating: 'DEAD' },
    { joke: "What did the ocean say to the beach? Nothing, it just waved.", category: 'dad', rating: 'GROAN' },
    { joke: "Why don't skeletons fight each other? They don't have the guts.", category: 'dad', rating: 'LOL' },
    { joke: "I used to play piano by ear. Now I use my hands.", category: 'dad', rating: 'GROAN' },
    { joke: "What do you call someone with no body and no nose? Nobody knows.", category: 'dad', rating: 'DEAD' },
    { joke: "Why did the golfer bring two pairs of pants? In case he got a hole in one.", category: 'dad', rating: 'LOL' },
    { joke: "I'm afraid for the calendar. Its days are numbered.", category: 'dad', rating: 'GROAN' },
    { joke: "What do you call a dog that does magic? A Labracadabrador.", category: 'dad', rating: 'DEAD' },
    // More spicy
    { joke: "My bank account and I have something in common. We've both lost interest.", category: 'spicy', rating: 'DEAD' },
    { joke: "I'm not saying my wifi is bad, but even my smart fridge has given up on me.", category: 'spicy', rating: 'LOL' },
    { joke: "My gym membership and my New Year's resolution walked into a bar. Neither lasted past January.", category: 'spicy', rating: 'LOL' },
    { joke: "I told my suitcase we weren't going on vacation this year. Now I'm dealing with emotional baggage.", category: 'spicy', rating: 'DEAD' },
    { joke: "Why do I drink coffee? Because adulting without stimulants is just staring at walls professionally.", category: 'spicy', rating: 'LOL' },
    { joke: "I put my phone on airplane mode. It didn't fly. Worst. Transformer. Ever.", category: 'spicy', rating: 'LOL' },
    // More wordplay
    { joke: "I'm reading a horror book in Braille. Something bad is about to happen, I can feel it.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I used to be a train driver but I got sidetracked.", category: 'wordplay', rating: 'GROAN' },
    { joke: "What's the best thing about Switzerland? The flag is a big plus.", category: 'wordplay', rating: 'LOL' },
    { joke: "I made a pencil with two erasers. It was pointless.", category: 'wordplay', rating: 'GROAN' },
    { joke: "Why can't your nose be 12 inches long? Because then it'd be a foot.", category: 'wordplay', rating: 'LOL' },
    { joke: "I tried to catch some fog earlier. I mist.", category: 'wordplay', rating: 'DEAD' },
    { joke: "I entered ten puns in a contest to see if any would win. No pun in ten did.", category: 'wordplay', rating: 'DEAD' },
    { joke: "Why don't scientists trust atoms anymore? Ever since they made up everything, their credibility has been sub-atomic.", category: 'wordplay', rating: 'LOL' },
    // More science
    { joke: "What did one tectonic plate say when it bumped into another? Sorry, my fault.", category: 'science', rating: 'DEAD' },
    { joke: "Why can you never trust an atom? They literally make up everything. Even this joke.", category: 'science', rating: 'GROAN' },
    { joke: "Helium walks into a bar. The bartender says 'We don't serve noble gases here.' Helium doesn't react.", category: 'science', rating: 'DEAD' },
    // SQL Statement Jokes — the barn burners
    { joke: "SELECT * FROM dating_apps WHERE matches > 0; — 0 rows returned. As expected.", category: 'spicy', rating: 'DEAD' },
    { joke: "DROP TABLE self_esteem; — operation completed in 0.001s. New record.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT excuse FROM brain WHERE deadline = CURRENT_DATE; — returns 47 rows.", category: 'spicy', rating: 'ROFL' },
    { joke: "INSERT INTO gym (visit_date) VALUES (CURRENT_DATE); — constraint violation: conflicts with couch_schedule.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE salary SET amount = amount * 2 WHERE employee = 'me'; — permission denied. Obviously.", category: 'spicy', rating: 'DEAD' },
    { joke: "DELETE FROM inbox WHERE read = false; — 14,283 rows affected. I regret nothing.", category: 'spicy', rating: 'ROFL' },
    { joke: "SELECT * FROM fridge WHERE item NOT LIKE '%condiment%'; — 0 rows returned.", category: 'spicy', rating: 'DEAD' },
    { joke: "ALTER TABLE sleep ADD CONSTRAINT minimum CHECK (hours >= 8); — constraint violated 365 times this year.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO meetings (purpose) VALUES (NULL); — inserted successfully. As always.", category: 'tech', rating: 'DEAD' },
    { joke: "SELECT COUNT(*) FROM promises WHERE kept = true; — returns 0. Merry Christmas, kids.", category: 'spicy', rating: 'DEAD' },
    { joke: "TRUNCATE TABLE new_years_resolutions; — executed January 4th. Personal best.", category: 'spicy', rating: 'ROFL' },
    { joke: "UPDATE relationship SET status = 'complicated' WHERE partner IN (SELECT * FROM red_flags I_ignored); — 38 rows matched.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM wardrobe WHERE clean = true AND presentable = true; — 0 rows. Guess I'm working from home.", category: 'spicy', rating: 'LOL' },
    { joke: "INSERT INTO cart (item, quantity) VALUES ('things I don''t need', 47); — wallet has left the chat.", category: 'spicy', rating: 'DEAD' },
    { joke: "DELETE FROM browser_history WHERE timestamp > '2024-01-01'; — nice try, FBI.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT motivation FROM monday WHERE hour < 10; — NULL. Every. Single. Time.", category: 'spicy', rating: 'ROFL' },
    { joke: "CREATE INDEX idx_finding_keys ON house(every_pocket, every_drawer, between_cushions); — still a full table scan.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE bank_account SET balance = balance - 847.00 WHERE description = 'quick grocery run'; — a quick one, they said.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM compliments WHERE source = 'mom' AND genuine = true; — unable to determine. Insufficient data.", category: 'spicy', rating: 'LOL' },
    { joke: "INSERT INTO slack (message, channel) VALUES ('sounds good!', '#general'); — auto-generated. I didn't read the thread.", category: 'tech', rating: 'DEAD' },
    { joke: "DROP DATABASE production; — statement executed. Wait. Which terminal was that?", category: 'tech', rating: 'DEAD' },
    { joke: "SELECT * FROM people WHERE listens_to_me AND remembers_what_I_said; — 0 rows. Even the dog walked away.", category: 'spicy', rating: 'DEAD' },
    { joke: "ALTER TABLE age DROP COLUMN metabolism; — cannot drop. Column has been degrading automatically since age 30.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE todo_list SET status = 'done' WHERE task = 'make todo list'; — productivity achieved.", category: 'spicy', rating: 'ROFL' },
    { joke: "SELECT * FROM emails WHERE important = true; — 2 rows. The other 11,000 are from Jira.", category: 'tech', rating: 'DEAD' },
    { joke: "INSERT INTO retirement_fund (amount) VALUES (12.50); — at this rate, I'll retire in the year 2847.", category: 'spicy', rating: 'DEAD' },
    { joke: "DELETE FROM contacts WHERE last_interaction > INTERVAL '3 years'; — 212 rows. Didn't even notice.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT skill FROM resume WHERE actually_know_it = true; — 3 rows. Resume says 47. Interview is Tuesday.", category: 'spicy', rating: 'DEAD' },
    { joke: "CREATE TABLE boundaries (id INT PRIMARY KEY); — table created. 0 rows will ever be inserted.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE coffee SET cups = cups + 1 WHERE time = '3pm' AND will_regret_at_midnight = true; — updated.", category: 'spicy', rating: 'LOL' },
    { joke: "SELECT * FROM laundry WHERE status = 'folded' AND location != 'pile_on_chair'; — 0 rows. The chair wins again.", category: 'spicy', rating: 'DEAD' },
    { joke: "GRANT ALL PRIVILEGES ON my_life TO anxiety; — granted. Thanks, brain.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO diet (day, meal) VALUES ('Monday', 'salad'); DELETE FROM diet WHERE day = 'Monday' AND hour > 18; — pizza wins.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM childhood_dreams WHERE status != 'crushed'; — 1 row: 'astronaut'. Status: 'pending'. Age: 38.", category: 'spicy', rating: 'DEAD' },
    { joke: "ROLLBACK TO SAVEPOINT before_I_said_that; — savepoint not found. You're on your own.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE plants SET status = 'alive' WHERE owner = 'me'; — 0 rows affected. They're all dead, Karen.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT COUNT(*) FROM tabs WHERE browser = 'chrome'; — integer overflow. RAM has filed a restraining order.", category: 'tech', rating: 'DEAD' },
    { joke: "INSERT INTO 2am_thoughts (thought) VALUES ('what if dogs think WE''RE the pets?'); — cannot sleep. Index scan on existential_dread.", category: 'spicy', rating: 'DEAD' },
    { joke: "ALTER TABLE Friday ADD COLUMN leaving_early BOOLEAN DEFAULT true; — schema updated. Manager not notified.", category: 'spicy', rating: 'ROFL' },
    { joke: "DELETE FROM pantry WHERE purchased_for = 'recipe I saw on TikTok' AND used = false; — 31 rows. $247 in shame.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM group_chat WHERE message NOT LIKE '%lol%' AND message NOT LIKE '%haha%'; — 0 rows. We communicate exclusively in laughs.", category: 'spicy', rating: 'LOL' },
    { joke: "UPDATE autopilot SET enabled = true WHERE activity = 'commute'; — arrived at work. No memory of driving. Classic.", category: 'spicy', rating: 'LOL' },
    { joke: "CREATE VIEW my_potential AS SELECT * FROM skills WHERE practiced = true; — view is empty. But the potential is huge. Trust me.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO google (query) VALUES ('is it normal to...'); — auto-complete has seen things. Terrible things.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM sock_drawer WHERE has_match = true; — 4 rows out of 37. The Bermuda Triangle of laundry.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE confidence SET level = 100 WHERE event = 'singing_in_shower'; UPDATE confidence SET level = 0 WHERE event = 'karaoke'; — committed.", category: 'spicy', rating: 'ROFL' },
    { joke: "DELETE FROM memory WHERE type = 'important' AND timing = 'right before I needed it'; — 1 row. Gone. Poof.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM weekend_plans; — 0 rows. SELECT * FROM couch_time; — 48 rows. Consistency is key.", category: 'spicy', rating: 'LOL' },
    { joke: "INSERT INTO linkedin (post) VALUES ('Thrilled to announce...'); — likes: 3. One is my mom. One is a bot. One is me.", category: 'spicy', rating: 'DEAD' },
    { joke: "ALTER TABLE patience DROP COLUMN remaining; — cannot drop: column already at zero since 9am standup.", category: 'tech', rating: 'DEAD' },
    { joke: "MERGE INTO reality USING expectations ON (1=1) WHEN MATCHED THEN UPDATE SET disappointment = 'maximum'; — merged. Every single time.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM passwords WHERE I_remember_it = true; — 1 row: 'password123'. For everything. Judge me.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO uber_eats (order) VALUES ('healthy salad'); UPDATE uber_eats SET order = 'large pizza' WHERE willpower < hunger; — 1 row updated.", category: 'spicy', rating: 'ROFL' },
    { joke: "CREATE TRIGGER on_alarm_ring AFTER INSERT ON morning EXECUTE snooze(7); — trigger fires 9 times. Late again.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM adulting WHERE doing_it_right = true; — 0 rows. But the vibes are immaculate.", category: 'spicy', rating: 'LOL' },
    { joke: "DELETE FROM spotify WHERE song = 'that one song' AND times_played > 300; — cannot delete. Emotionally dependent foreign key.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE haircut SET regret = true WHERE minutes_since_cut < 30; — every. single. time.", category: 'spicy', rating: 'LOL' },
    { joke: "SELECT item, price FROM shopping WHERE needed = false ORDER BY price DESC; — narrator: it was all of them.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO amazon_cart VALUES ('thing I''ll never buy but need to save for later'); — cart has 847 items. 0 checkouts.", category: 'spicy', rating: 'DEAD' },
    { joke: "REVOKE ALL PRIVILEGES ON sleep FROM (SELECT * FROM thoughts WHERE time > '11pm'); — revoke failed. Thoughts have admin access.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM fridge ORDER BY opened_count DESC LIMIT 1; — result: door. Opened 47 times. Nothing changed inside.", category: 'spicy', rating: 'ROFL' },
    { joke: "UPDATE self SET productive = true WHERE distraction_level = 0; — 0 rows updated. Phone exists.", category: 'spicy', rating: 'DEAD' },
    { joke: "CREATE TABLE regrets (id SERIAL, description TEXT, severity INT); — table size: 4.7 TB and growing.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM calendar WHERE event_type = 'fun'; — 0 rows found in Q1, Q2, Q3, or Q4. Audit complete.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO zoom_call (camera) VALUES ('off'); INSERT INTO zoom_call (pants) VALUES ('optional'); — this is the way.", category: 'spicy', rating: 'ROFL' },
    { joke: "DELETE FROM brain WHERE thought = 'that embarrassing thing from 2009'; — constraint violation: thought is permanent and load-bearing.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM gym_membership WHERE last_used < CURRENT_DATE - INTERVAL '11 months'; — 1 row. $599.88 well spent.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE morning_routine SET includes_breakfast = false WHERE running_late = true; — updated 365 rows this year.", category: 'spicy', rating: 'LOL' },
    { joke: "ALTER TABLE conversation ADD COLUMN awkward_silence INTERVAL DEFAULT '30 seconds'; — schema matches reality.", category: 'spicy', rating: 'LOL' },
    { joke: "SELECT excuse FROM excuses WHERE believable = true ORDER BY times_used ASC LIMIT 1; — 'traffic'. Classic. Undefeated.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO twitter (hot_take) VALUES ('...'); DELETE FROM twitter WHERE posted_seconds_ago < 30; — the cycle continues.", category: 'spicy', rating: 'DEAD' },
    { joke: "EXPLAIN ANALYZE SELECT * FROM my_decisions WHERE good = true; — Seq Scan. Cost: astronomical. Rows: 2. Both questionable.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE dog SET walked = true WHERE rain = false AND I_feel_like_it = true; — 0 rows. Dog is judging me from the door.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM texts WHERE sent_at BETWEEN '1am' AND '4am' AND sober = false; — we don't talk about these rows.", category: 'spicy', rating: 'DEAD' },
    { joke: "CREATE MATERIALIZED VIEW pretending_to_work AS SELECT * FROM slack WHERE status = 'online' AND actually_working = false; — refreshes every 5 minutes.", category: 'tech', rating: 'DEAD' },
    { joke: "INSERT INTO dishwasher (item) SELECT * FROM sink; — constraint violation: dishwasher still full of clean dishes from last week.", category: 'spicy', rating: 'ROFL' },
    { joke: "UPDATE age SET back_pain = true WHERE age >= 30; — migration complete. No rollback available.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM parking_lot WHERE spot = 'the one I just passed'; — row locked by someone faster. Every time.", category: 'spicy', rating: 'LOL' },
    { joke: "DELETE FROM notifications WHERE app = 'screen_time_report'; — you can't hurt me if I can't see you.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO resume (skill) VALUES ('proficient in Excel'); — actual ability: SUM and bold headers.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM snacks WHERE location = 'hidden_from_kids'; — 0 rows. They found the stash. Again.", category: 'spicy', rating: 'ROFL' },
    { joke: "TRUNCATE TABLE motivation; — executes automatically every Sunday at 6pm.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE wifi SET password = 'something_easy' WHERE guest_asks = true; UPDATE wifi SET password = 'Xy7$kQ9!mR2#' WHERE guest_leaves = true; — security.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT COUNT(*) FROM times_said_ill_start_monday; — integer overflow at row 2,147,483,647.", category: 'spicy', rating: 'DEAD' },
    { joke: "ALTER TABLE metabolism ALTER COLUMN speed SET DEFAULT 'glacial' WHERE age > 35; — cannot revert. Warranty expired.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO therapy (session_topic) VALUES ('that one comment from 2014 that lives rent-free in my head'); — session 47. Still processing.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM people_who_reply_all WHERE necessary = true; — 0 rows. Always 0 rows. Why do you exist.", category: 'tech', rating: 'DEAD' },
    { joke: "CREATE INDEX idx_keys ON house(last_known_location); — index invalidated immediately. Keys have quantum state.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE sleep_schedule SET bedtime = '10pm' WHERE day = 'weeknight'; — constraint violated by phone at 10:01pm. Every night.", category: 'spicy', rating: 'ROFL' },
    { joke: "SELECT * FROM flink_jobs WHERE state = 'RUNNING' AND anyone_knows_why = false; — 14 rows. Legacy. Don't touch them.", category: 'tech', rating: 'DEAD' },
    { joke: "DELETE FROM amazon_subscriptions WHERE forgot_about = true AND charging_monthly = true; — 7 rows. $89/month in surprise.", category: 'spicy', rating: 'DEAD' },
    { joke: "INSERT INTO microwave (food, time) VALUES ('leftovers', '2 min'); SELECT * FROM microwave; — outside: lava. Inside: frozen. Every time.", category: 'spicy', rating: 'DEAD' },
    { joke: "VACUUM FULL brain; — operation failed: not enough free space. Too many open tabs.", category: 'spicy', rating: 'DEAD' },
    { joke: "SELECT * FROM closet WHERE fits = true AND in_style = true AND clean = true; — 0 rows. Wearing the same hoodie. Day 4.", category: 'spicy', rating: 'DEAD' },
    { joke: "UPDATE jira_ticket SET status = 'in progress' WHERE started = false AND standup_is_in = '5 minutes'; — classic engineering.", category: 'tech', rating: 'DEAD' },
    { joke: "INSERT INTO conversation (response) VALUES ('yeah no totally'); — meaning: I was not listening. At all.", category: 'spicy', rating: 'ROFL' },
    { joke: "SELECT * FROM life WHERE everything_is_fine = true; — 0 rows. But the dashboard says green. Ship it.", category: 'tech', rating: 'DEAD' },
  ];
  return Array.from({ length: count }, (_, i) => ({
    joke_id: `J-${String(i + 1).padStart(3, '0')}`,
    ...JOKES[i % JOKES.length],
  }));
}

export function generateCustomerCdcEvents(count: number): Record<string, unknown>[] {
  // Generates ~10 unique customers with 3 versions each (simulates CDC updates)
  const uniqueCustomers = Math.max(3, Math.floor(count / 3));
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < uniqueCustomers; i++) {
    const customerId = `C-${String(i + 1).padStart(3, '0')}`;
    const name = `${pickFrom(FIRST_NAMES)} ${pickFrom(LAST_NAMES)}`;
    const state = pickFrom(US_STATES);
    const versions = Math.floor(Math.random() * 3) + 2; // 2–4 versions per customer
    for (let v = 0; v < versions; v++) {
      const score = Math.floor(Math.random() * 99) + 1;
      const creditScore = Math.floor(Math.random() * 241) + 580;
      rows.push({
        customer_id: customerId,
        name,
        credit_score: creditScore,
        state: v > 0 && Math.random() < 0.3 ? pickFrom(US_STATES) : state,
        risk_score: score,
        risk_level: riskLevel(score),
      });
    }
  }
  return rows;
}

export function generateCustomerStreamEvents(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    customer_id: `C-${String((i % 10) + 1).padStart(3, '0')}`,
    name: `${pickFrom(FIRST_NAMES)} ${pickFrom(LAST_NAMES)}`,
    credit_score: Math.floor(Math.random() * 241) + 580,
    state: pickFrom(US_STATES),
  }));
}

export function generateRawJsonEvents(count: number): Record<string, unknown>[] {
  const eventTypes = ['PAYMENT', 'REFUND', 'TRANSFER', 'DEPOSIT', 'WITHDRAWAL'];
  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    event_id: `EVT-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
    event_type: i % 6 === 0 ? null : pickFrom(eventTypes), // 1/6 will have null type (for filtering)
    user_id: `USR-${String((i % 20) + 1).padStart(3, '0')}`,
    amount: Math.round(Math.random() * 5000 * 100) / 100, // 0–5000
    currency: pickFrom(currencies),
    timestamp: now - (count - i) * 10 * 1000, // spread over time in ms
  }));
}

// --- Kafka/Confluent example generators ---

function generateKafkaMessages(count: number): Record<string, unknown>[] {
  const topics = ['orders', 'users', 'inventory', 'payments', 'events'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    message_key: `key-${topics[i % topics.length]}-${i + 1}`,
    message_value: JSON.stringify({
      id: i + 1,
      type: topics[i % topics.length],
      data: `payload-${Math.random().toString(36).slice(2, 8)}`,
    }),
    event_time: new Date(now - (count - i) * 3000).toISOString(),
  }));
}

function generateKafkaEvents(count: number): Record<string, unknown>[] {
  const types = ['LOGIN', 'LOGOUT', 'PURCHASE', 'VIEW', 'CLICK', 'SIGNUP'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    event_id: `EVT-${String(i + 1).padStart(4, '0')}`,
    event_type: types[i % types.length],
    payload: JSON.stringify({ user: `user-${(i % 10) + 1}`, value: Math.floor(Math.random() * 100) }),
    event_time: new Date(now - (count - i) * 2000).toISOString(),
  }));
}

function generateChangelogEvents(count: number): Record<string, unknown>[] {
  const actions = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'REFUND', 'PAYMENT'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    user_id: `USR-${String((i % 8) + 1).padStart(3, '0')}`,
    action: actions[i % actions.length],
    amount: Math.round(Math.random() * 1000 * 100) / 100,
    event_time: new Date(now - (count - i) * 2500).toISOString(),
  }));
}

function generateFormatEvents(count: number): Record<string, unknown>[] {
  const sensors = ['TEMP-01', 'TEMP-02', 'HUM-01', 'HUM-02', 'MIX-01'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    sensor_id: sensors[i % sensors.length],
    temperature: Math.round((18 + Math.random() * 12) * 10) / 10,
    humidity: Math.round((40 + Math.random() * 40) * 10) / 10,
    event_time: new Date(now - (count - i) * 3000).toISOString(),
  }));
}

function generateFormatRawEvents(count: number): Record<string, unknown>[] {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    raw_payload: `sensor=${i % 5 + 1},temp=${(18 + Math.random() * 12).toFixed(1)},ts=${now - (count - i) * 3000}`,
    event_time: new Date(now - (count - i) * 3000).toISOString(),
  }));
}

function generateEvolvingEvents(count: number): Record<string, unknown>[] {
  const types = ['CREATED', 'UPDATED', 'DELETED', 'ARCHIVED'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    event_id: `EVO-${String(i + 1).padStart(4, '0')}`,
    event_type: types[i % types.length],
    payload: JSON.stringify({ entity: `item-${i + 1}`, version: Math.floor(i / 4) + 1 }),
    event_time: new Date(now - (count - i) * 2000).toISOString(),
  }));
}

function generateConnectorEvents(count: number): Record<string, unknown>[] {
  const sources = ['  postgres ', 'MYSQL', ' salesforce', 'S3 ', ' api-gateway '];
  const types = ['INSERT', '', null, 'UPDATE', 'DELETE', 'UPSERT'];
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    source_system: sources[i % sources.length],
    event_id: i % 7 === 0 ? null : `CON-${String(i + 1).padStart(4, '0')}`,
    event_payload: i % 9 === 0 ? null : JSON.stringify({ record: i + 1, data: `val-${Math.random().toString(36).slice(2, 6)}` }),
    event_type: types[i % types.length],
    ingestion_time: new Date(now - (count - i) * 1500).toISOString(),
  }));
}

const DATA_GENERATORS: Record<string, (count: number) => Record<string, unknown>[]> = {
  'flat-loans': generateFlatLoans,
  'customers-risk': generateCustomerRiskProfiles,
  'customers-credit': generateCustomerCreditProfiles,
  'customers-cdc': generateCustomerCdcEvents,
  'customers-stream': generateCustomerStreamEvents,
  'flat-jokes': generateJokes,
  'raw-json-events': generateRawJsonEvents,
  // View example generators
  'loan-updates': generateLoanUpdates,
  'securitized-loans': generateSecuritizedLoans,
  'ai-audit-log': generateAiAuditLog,
  'payment-events': generatePaymentEvents,
  'loan-commitments': generateLoanCommitments,
  'market-rates': generateMarketRates,
  // New pattern example generators
  'loan-coborrowers': generateLoanCoborrowers,
  'loans-with-property': generateLoansWithProperty,
  'property-reference': generatePropertyReference,
  'late-payment-reports': generateLatePaymentReports,
  'loan-events': generateLoanEvents,
  'loan-events-dept': generateLoanEventsDept,
  'routing-rules-array-dynamic': (_count: number) => generateRoutingRulesArrayDynamic(),
  'routing-rules-three': (_count: number) => generateRoutingRulesThree(),
  'routing-rules-add-refinance': (_count: number) => generateRoutingRulesAddRefinance(),
  'routing-rules-add-finance': (_count: number) => generateRoutingRulesAddFinance(),
  'routing-rules-remove-subscriber': (_count: number) => generateRoutingRulesRemoveSubscriber(),
  'loan-events-refinance': generateLoanEventsRefinance,
  'loan-events-termination': generateLoanEventsTermination,
  'loan-events-foreclosure': generateLoanEventsForeclosure,
  'payment-stream-data': generatePaymentStream,
  'borrower-reference': generateBorrowerReference,
  // Kafka/Confluent example generators
  'kafka-messages': generateKafkaMessages,
  'kafka-events': generateKafkaEvents,
  'changelog-events': generateChangelogEvents,
  'format-events': generateFormatEvents,
  'format-raw-events': generateFormatRawEvents,
  'evolving-events': generateEvolvingEvents,
  'connector-events': generateConnectorEvents,
};

// ---------------------------------------------------------------------------
// KickstarterExampleDef — typed config interface
// ---------------------------------------------------------------------------

export interface TableDef {
  name: string;              // base name: "LOANS"
  schema: string;            // key in TABLE_SCHEMAS registry (use 'view' for virtual views)
  role: 'input' | 'output';
  type?: 'table' | 'view' | 'topic';  // 'view' = skip DDL, 'topic' = create raw Kafka topic (no Flink DDL or Schema Registry schema)
  dataset?: { generator: string; count: number };
  /** Multiple ordered datasets — all registered under the same schemaSubject, pre-selects the first */
  datasets?: Array<{ label: string; generator: string; count: number }>;
  stream?: 'produce-consume' | 'consume';
}

export interface CellDef {
  label: string;
  sql: string; // uses {TABLE_NAME} placeholders — already backtick-wrapped in template
  engine?: import('../types').SqlEngine;
}

export interface KickstarterExampleDef {
  id: string;
  tables: TableDef[];
  sql: CellDef[];
  vars?: Record<string, string>;  // additional {KEY} → value substitutions (e.g. Kafka credentials)
  completionModal?: Omit<ExampleCompletionModal, 'title'>;
}

// ---------------------------------------------------------------------------
// runKickstarterExample — generic runner
// ---------------------------------------------------------------------------

export async function runKickstarterExample(
  def: KickstarterExampleDef,
  store: BaseExampleStoreSlice,
  onProgress: (step: string) => void,
): Promise<{ runId: string }> {
  const rid = generateFunName();

  // Resolve table names: "LOANS" → "loans-{rid}"
  // Confluent API requires lowercase alphanumeric + hyphens for resource names
  const names: Record<string, string> = {};
  for (const t of def.tables) {
    names[t.name] = `${t.name.toLowerCase()}-${rid}`;
  }

  // Create all tables (skip virtual views — their DDL is in the SQL cells)
  for (const t of def.tables) {
    if (t.type === 'view') continue;
    if (t.type === 'topic') {
      // Create raw Kafka topic without Flink DDL — no schema registered in Schema Registry.
      // This ensures the StreamCard falls back to JSON production (no Avro serialization).
      // Used by ksqlDB JSON examples where VALUE_FORMAT = 'JSON' needs actual JSON on the wire.
      onProgress(`Creating topic: ${names[t.name]}`);
      await createKafkaTopic({ topic_name: names[t.name], partitions_count: 1, replication_factor: 3 });
      continue;
    }
    await createTable(names[t.name], resolveDDL(t.schema, names[t.name]), onProgress);
  }

  // Generate datasets, register, add stream cards
  store.setStreamsPanelOpen(true);
  for (const t of def.tables) {
    // Normalise: `datasets` (multi) takes precedence over `dataset` (single)
    const datasetDefs = t.datasets
      ? t.datasets
      : t.dataset
        ? [{ label: t.name, generator: t.dataset.generator, count: t.dataset.count }]
        : [];

    if (datasetDefs.length === 0) continue;

    let firstDatasetId: string | null = null;
    const now = new Date().toISOString();

    for (let i = 0; i < datasetDefs.length; i++) {
      const dd = datasetDefs[i];
      const genFn = DATA_GENERATORS[dd.generator];
      if (!genFn) throw new Error(`Unknown generator: ${dd.generator}`);
      let records = genFn(dd.count);
      // Substitute {TABLE_NAME} placeholders in generated data (e.g. routing rules with topic refs)
      let recordsJson = JSON.stringify(records);
      for (const [base, resolved] of Object.entries(names)) {
        recordsJson = recordsJson.split(`{${base}}`).join(resolved);
      }
      records = JSON.parse(recordsJson);
      const datasetId = crypto.randomUUID();
      const datasetName = t.datasets ? `${dd.label}` : `${t.name}-${rid}`;
      store.addSchemaDataset({
        id: datasetId,
        name: datasetName,
        schemaSubject: `${names[t.name]}-value`,
        records,
        createdAt: now,
        updatedAt: now,
      });
      if (i === 0) firstDatasetId = datasetId;
    }

    if (t.stream && firstDatasetId) {
      store.addStreamCard(names[t.name], t.stream, firstDatasetId, {
        type: def.id,
        count: datasetDefs[0].count,
      });
    }
  }

  // Add consume-only stream cards (no dataset — just a consumer)
  for (const t of def.tables) {
    if (t.dataset || t.datasets || !t.stream) continue;
    store.addStreamCard(names[t.name], t.stream);
  }

  // Add SQL cells — template substitution
  onProgress('Adding queries to workspace...');
  for (const cell of def.sql) {
    let sql = cell.sql;
    for (const [base, resolved] of Object.entries(names)) {
      // Replace {BASE_NAME} with resolved name (templates already include backticks)
      sql = sql.split(`{${base}}`).join(resolved);
    }
    // Replace additional {VAR} placeholders (e.g. Kafka credentials for UDF params)
    if (def.vars) {
      for (const [key, value] of Object.entries(def.vars)) {
        sql = sql.split(`{${key}}`).join(value);
      }
    }
    store.addStatement(sql, undefined, `${cell.label}-${rid}`, { engine: cell.engine });
  }

  return { runId: rid };
}
