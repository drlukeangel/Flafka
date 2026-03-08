import { mulberry32 } from '../utils/synthetic-data';

// ---------------------------------------------------------------------------
// Helper utilities (match view-sample-generators.ts pattern)
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rangeFloat(min: number, max: number, rng: () => number, decimals = 2): number {
  return parseFloat((min + rng() * (max - min)).toFixed(decimals));
}

function rangeInt(min: number, max: number, rng: () => number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Name pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Hank', 'Iris', 'Jack'] as const;
const LAST_NAMES = ['Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Davis', 'Wilson', 'Moore', 'Anderson', 'Martin'] as const;

// ---------------------------------------------------------------------------
// 1. generateLoanCoborrowers — CROSS JOIN UNNEST example
// ---------------------------------------------------------------------------

export function generateLoanCoborrowers(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(100 + i);
    const numCoborrowers = rangeInt(2, 4, rng);
    const names: string[] = [];
    const scores: number[] = [];
    for (let j = 0; j < numCoborrowers; j++) {
      names.push(`${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`);
      scores.push(rangeInt(580, 850, rng));
    }
    results.push({
      loan_id: `LN-${String(i + 1).padStart(5, '0')}`,
      primary_borrower: `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`,
      primary_score: rangeInt(600, 850, rng),
      coborrower_names: names,
      coborrower_scores: scores,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2. generateLoansWithProperty — Property Lookup Join example
// ---------------------------------------------------------------------------

export function generateLoansWithProperty(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const statuses = ['SUBMITTED', 'UNDERWRITING', 'APPROVED', 'FUNDED'] as const;
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(200 + i);
    results.push({
      loan_id: `LN-${String(i + 1).padStart(5, '0')}`,
      property_id: `PROP-${String(rangeInt(1, 50, rng)).padStart(3, '0')}`,
      amount: rangeFloat(100000, 750000, rng),
      status: pick(statuses, rng),
      borrower_id: `B-${String(rangeInt(1, 30, rng)).padStart(3, '0')}`,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 3. generatePropertyReference — Property reference table (upsert)
// ---------------------------------------------------------------------------

const FLOOD_ZONES = ['A', 'AE', 'X', 'X500', 'V', 'NONE'] as const;
const PROPERTY_TYPES = ['SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE', 'MULTI_FAMILY', 'MANUFACTURED'] as const;

export function generatePropertyReference(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const numProperties = Math.min(count, 50);
  for (let i = 0; i < numProperties; i++) {
    const rng = mulberry32(300 + i);
    results.push({
      property_id: `PROP-${String(i + 1).padStart(3, '0')}`,
      appraisal_value: rangeFloat(150000, 900000, rng),
      flood_zone: pick(FLOOD_ZONES, rng),
      property_type: pick(PROPERTY_TYPES, rng),
      last_assessed: new Date(2025, rangeInt(0, 11, rng), rangeInt(1, 28, rng)).toISOString(),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 4. generateLatePaymentReports — Late Data & Watermarks example
// ---------------------------------------------------------------------------

export function generateLatePaymentReports(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(400 + i);
    const isLate = rng() < 0.2; // 20% deliberately late
    // On-time: event happened recently; Late: event happened 30-120s ago
    const delay = isLate ? rangeInt(30000, 120000, rng) : rangeInt(0, 5000, rng);
    results.push({
      payment_id: `PAY-${String(i + 1).padStart(5, '0')}`,
      servicer_id: `SVC-${String(rangeInt(1, 10, rng)).padStart(3, '0')}`,
      amount: rangeFloat(500, 5000, rng),
      event_time_ms: now - (count - i) * 3000 - delay,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 5. generateLoanEvents — Static & Dynamic Fan-Out examples
// ---------------------------------------------------------------------------

const EVENT_TYPES = ['NEW_LOAN', 'PAYMENT', 'MODIFICATION', 'FORECLOSURE', 'TERMINATION'] as const;
const EVENT_WEIGHTS = [0.20, 0.40, 0.15, 0.15, 0.10] as const;

function pickWeighted(types: readonly string[], weights: readonly number[], rng: () => number): string {
  const r = rng();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) return types[i];
  }
  return types[types.length - 1];
}

export function generateLoanEvents(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(500 + i);
    results.push({
      event_id: `EVT-${String(i + 1).padStart(5, '0')}`,
      loan_id: `LN-${String(rangeInt(1, 100, rng)).padStart(5, '0')}`,
      event_type: pickWeighted(EVENT_TYPES, EVENT_WEIGHTS, rng),
      amount: rangeFloat(1000, 500000, rng),
      borrower_id: `B-${String(rangeInt(1, 30, rng)).padStart(3, '0')}`,
      event_ts: new Date(now - (count - i) * 2000).toISOString(),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 6b. generateLoanEventsDept — Loan events with department field
// ---------------------------------------------------------------------------

const DEPARTMENTS = ['UNDERWRITING', 'FINANCE', 'SERVICING', 'FORECLOSURES', 'COMPLIANCE'] as const;

export function generateLoanEventsDept(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(550 + i);
    results.push({
      key: null,
      event_id: `EVT-${String(i + 1).padStart(5, '0')}`,
      loan_id: `LN-${String(rangeInt(1, 100, rng)).padStart(5, '0')}`,
      event_type: pickWeighted(EVENT_TYPES, EVENT_WEIGHTS, rng),
      amount: rangeFloat(1000, 500000, rng),
      created_at: new Date(now - (count - i) * 2000).toISOString(),
      department: pick(DEPARTMENTS, rng),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 6c. generateRoutingRulesArrayDynamic — target_topics use {TABLE_NAME}
//     placeholders that the runner resolves to actual Kafka topic names
// ---------------------------------------------------------------------------

export function generateRoutingRulesArrayDynamic(): Record<string, unknown>[] {
  return [
    { event_type: 'NEW_LOAN', target_topics: ['{UNDERWRITING}', '{FINANCE}'], updated_at: new Date().toISOString() },
    { event_type: 'PAYMENT', target_topics: ['{FINANCE}'], updated_at: new Date().toISOString() },
    { event_type: 'MODIFICATION', target_topics: ['{FINANCE}'], updated_at: new Date().toISOString() },
    { event_type: 'FORECLOSURE', target_topics: ['{COLLECTIONS}'], updated_at: new Date().toISOString() },
    { event_type: 'TERMINATION', target_topics: ['{COLLECTIONS}'], updated_at: new Date().toISOString() },
  ];
}

// ---------------------------------------------------------------------------
// 7. generatePaymentStream — Borrower Payment Enrichment example
// ---------------------------------------------------------------------------

const PAYMENT_TYPES = ['MONTHLY', 'EXTRA', 'LUMP_SUM', 'ESCROW', 'INSURANCE'] as const;

export function generatePaymentStream(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(700 + i);
    results.push({
      payment_id: `PMNT-${String(i + 1).padStart(5, '0')}`,
      borrower_id: `B-${String(rangeInt(1, 30, rng)).padStart(3, '0')}`,
      amount: rangeFloat(500, 5000, rng),
      payment_date: new Date(now - (count - i) * 3000).toISOString(),
      payment_type: pick(PAYMENT_TYPES, rng),
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 8. generateBorrowerReference — Borrower reference table (upsert)
// ---------------------------------------------------------------------------

const RISK_TIERS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const ACCOUNT_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const;
const REGIONS = ['NORTHEAST', 'SOUTHEAST', 'MIDWEST', 'WEST', 'SOUTHWEST'] as const;

export function generateBorrowerReference(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const numBorrowers = Math.min(count, 30);
  for (let i = 0; i < numBorrowers; i++) {
    const rng = mulberry32(800 + i);
    results.push({
      borrower_id: `B-${String(i + 1).padStart(3, '0')}`,
      name: `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`,
      region: pick(REGIONS, rng),
      risk_tier: pick(RISK_TIERS, rng),
      account_status: pick(ACCOUNT_STATUSES, rng),
    });
  }
  return results;
}
