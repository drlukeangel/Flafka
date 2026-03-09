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

const EVENT_TYPES = ['NEW_LOAN', 'PAYMENT', 'MODIFICATION', 'FORECLOSURE', 'TERMINATION', 'REFINANCE'] as const;
const EVENT_WEIGHTS = [0.15, 0.35, 0.15, 0.15, 0.10, 0.10] as const;

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
// 6d. generateRoutingRulesThree — initial 3-rule seed for the dynamic routing
//     demo. FORECLOSURE + TERMINATION go to COLLECTIONS (2 event types);
//     NEW_LOAN goes to UNDERWRITING (1 event type). REFINANCE has no rule yet.
// ---------------------------------------------------------------------------

export function generateRoutingRulesThree(): Record<string, unknown>[] {
  return [
    { event_type: 'FORECLOSURE', target_topics: ['{COLLECTIONS}'], updated_at: new Date().toISOString() },
    { event_type: 'TERMINATION', target_topics: ['{COLLECTIONS}'], updated_at: new Date().toISOString() },
    { event_type: 'NEW_LOAN', target_topics: ['{UNDERWRITING}'], updated_at: new Date().toISOString() },
  ];
}

// ---------------------------------------------------------------------------
// 6e. generateRoutingRulesAddRefinance — Use Case 1: upsert a brand-new
//     event type with zero downtime. REFINANCE → UNDERWRITING only.
//     The routing engine is already running — no restart needed.
// ---------------------------------------------------------------------------

export function generateRoutingRulesAddRefinance(): Record<string, unknown>[] {
  return [
    { event_type: 'REFINANCE', target_topics: ['{UNDERWRITING}'], updated_at: new Date().toISOString() },
  ];
}

// ---------------------------------------------------------------------------
// 6f. generateRoutingRulesAddFinance — Use Case 2: expand two existing rules
//     to add FINANCE as a subscriber. TERMINATION and NEW_LOAN now fan out
//     to FINANCE in addition to their original consumer. The routing engine
//     never stops — updated rules take effect on the next matching event.
// ---------------------------------------------------------------------------

export function generateRoutingRulesAddFinance(): Record<string, unknown>[] {
  return [
    { event_type: 'TERMINATION', target_topics: ['{COLLECTIONS}', '{FINANCE}'], updated_at: new Date().toISOString() },
    { event_type: 'NEW_LOAN', target_topics: ['{UNDERWRITING}', '{FINANCE}'], updated_at: new Date().toISOString() },
  ];
}

// ---------------------------------------------------------------------------
// 6g-2. generateRoutingRulesRemoveSubscriber — Use Case 3a: remove a single
//       subscriber from an existing rule. TERMINATION previously fanned out to
//       [COLLECTIONS, FINANCE]; this upsert drops FINANCE, leaving only
//       [COLLECTIONS]. The routing engine never stops — partial removals
//       take effect on the next matching event.
// ---------------------------------------------------------------------------

export function generateRoutingRulesRemoveSubscriber(): Record<string, unknown>[] {
  return [
    { event_type: 'TERMINATION', target_topics: ['{COLLECTIONS}'], updated_at: new Date().toISOString() },
  ];
}

// ---------------------------------------------------------------------------
// 6g-3. generateLoanEventsTermination — 100% TERMINATION events for verifying
//       Use Case 3a (remove subscriber). Useful for confirming that FINANCE no
//       longer receives TERMINATION after the rule is narrowed.
// ---------------------------------------------------------------------------

export function generateLoanEventsTermination(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(1100 + i);
    results.push({
      key: null,
      event_id: `EVT-T${String(i + 1).padStart(4, '0')}`,
      loan_id: `LN-${String(rangeInt(1, 100, rng)).padStart(5, '0')}`,
      event_type: 'TERMINATION',
      amount: rangeFloat(10000, 300000, rng),
      created_at: new Date(now - (count - i) * 2000).toISOString(),
      department: 'SERVICING',
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 6g-4. generateLoanEventsForeclosure — 100% FORECLOSURE events for verifying
//       Use Case 3b (remove rule entirely). Confirms FORECLOSURE events are
//       silently dropped after the rule is nullified.
// ---------------------------------------------------------------------------

export function generateLoanEventsForeclosure(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(1200 + i);
    results.push({
      key: null,
      event_id: `EVT-F${String(i + 1).padStart(4, '0')}`,
      loan_id: `LN-${String(rangeInt(1, 100, rng)).padStart(5, '0')}`,
      event_type: 'FORECLOSURE',
      amount: rangeFloat(50000, 500000, rng),
      created_at: new Date(now - (count - i) * 2000).toISOString(),
      department: 'FORECLOSURES',
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 6g. generateLoanEventsRefinance — second-wave publisher carrying the new
//     event type. 100% REFINANCE events so the fan-out to UNDERWRITING is
//     immediately visible after the routing rule is upserted.
// ---------------------------------------------------------------------------

export function generateLoanEventsRefinance(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(900 + i);
    results.push({
      key: null,
      event_id: `EVT-R${String(i + 1).padStart(4, '0')}`,
      loan_id: `LN-${String(rangeInt(1, 100, rng)).padStart(5, '0')}`,
      event_type: 'REFINANCE',
      amount: rangeFloat(50000, 400000, rng),
      created_at: new Date(now - (count - i) * 2000).toISOString(),
      department: 'UNDERWRITING',
    });
  }
  return results;
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
