import { mulberry32 } from '../utils/synthetic-data';

// ---------------------------------------------------------------------------
// Helper utilities (match loan-sample-generator.ts pattern)
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
// 1. generateLoanUpdates – Golden Record (LOAN-UPDATES topic)
// ---------------------------------------------------------------------------

const LOAN_STATUSES = ['CURRENT', 'DELINQUENT', 'FORBEARANCE', 'MODIFIED', 'PAID_OFF'] as const;

export function generateLoanUpdates(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const uniqueLoans = Math.max(1, Math.round(count / 4));

  // Pre-generate stable loan IDs
  const loanIds: string[] = [];
  for (let l = 0; l < uniqueLoans; l++) {
    loanIds.push(`LN-${String(l + 1).padStart(5, '0')}`);
  }

  for (let i = 0; i < count; i++) {
    const rng = mulberry32(42 + i);
    const loanId = loanIds[i % uniqueLoans];
    const updateIndex = Math.floor(i / uniqueLoans);

    // Shift the base timestamp forward per update so LAST_VALUE ordering works
    const baseTs = new Date('2025-01-15T00:00:00Z');
    baseTs.setHours(baseTs.getHours() + updateIndex * 24 + rangeInt(0, 23, rng));
    baseTs.setMinutes(rangeInt(0, 59, rng));
    baseTs.setSeconds(rangeInt(0, 59, rng));

    results.push({
      loan_id: loanId,
      status: pick(LOAN_STATUSES, rng),
      appraisal_value: rangeFloat(150000, 750000, rng),
      credit_score: rangeInt(580, 850, rng),
      updated_at: baseTs.toISOString(),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 2. generateSecuritizedLoans – Credit Risk Concentration (SECURITIZED-LOANS)
// ---------------------------------------------------------------------------

const ZIP_CODES = [
  '90210', '10001', '60601', '30301', '98101',
  '02101', '75201', '85001', '33101', '55401',
  '97201', '84101', '37201', '15201', '48201',
] as const;

export function generateSecuritizedLoans(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const rng = mulberry32(42 + i);

    const origYear = rangeInt(2018, 2025, rng);
    const origMonth = rangeInt(1, 12, rng);
    const origDay = rangeInt(1, 28, rng);

    results.push({
      loan_id: `SL-${String(i + 1).padStart(6, '0')}`,
      zip_code: pick(ZIP_CODES, rng),
      upb: rangeFloat(50000, 500000, rng),
      origination_date: `${origYear}-${String(origMonth).padStart(2, '0')}-${String(origDay).padStart(2, '0')}`,
      ltv: rangeFloat(0.60, 0.95, rng),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 3. generateAiAuditLog – AI/ML Compliance & Drift (AI-AUDIT-LOG)
// ---------------------------------------------------------------------------

const AI_DECISIONS = ['APPROVE', 'DENY', 'REFER'] as const;

export function generateAiAuditLog(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const rng = mulberry32(42 + i);

    const prediction = pick(AI_DECISIONS, rng);
    const disagree = rng() < 0.15; // ~15% disagreement
    const lowConfidence = rng() < 0.05; // ~5% low confidence

    let humanOutcome: string;
    if (disagree) {
      // Pick a different outcome than the prediction
      const others = AI_DECISIONS.filter((d) => d !== prediction);
      humanOutcome = pick(others, rng);
    } else {
      humanOutcome = prediction;
    }

    const confidence = lowConfidence
      ? rangeFloat(0.30, 0.49, rng)
      : rangeFloat(0.50, 0.99, rng);

    const baseTs = new Date('2025-02-01T00:00:00Z');
    baseTs.setMinutes(baseTs.getMinutes() + i * 7 + rangeInt(0, 6, rng));

    results.push({
      audit_id: `AUD-${String(i + 1).padStart(6, '0')}`,
      model_id: `MDL-${String(rangeInt(1, 5, rng)).padStart(3, '0')}`,
      prediction,
      human_outcome: humanOutcome,
      confidence,
      reviewed_at: baseTs.toISOString(),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 4. generatePaymentEvents – Early Warning for Defaults (PAYMENT-EVENTS)
// ---------------------------------------------------------------------------

const SERVICER_IDS = [
  'SVC-001', 'SVC-002', 'SVC-003', 'SVC-004',
  'SVC-005', 'SVC-006', 'SVC-007', 'SVC-008',
] as const;

export function generatePaymentEvents(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const rng = mulberry32(42 + i);

    // Weighted status: ON_TIME 70%, LATE 20%, DELINQUENT 10%
    const roll = rng();
    let status: string;
    if (roll < 0.70) {
      status = 'ON_TIME';
    } else if (roll < 0.90) {
      status = 'LATE';
    } else {
      status = 'DELINQUENT';
    }

    const baseTs = new Date('2025-01-01T00:00:00Z');
    baseTs.setHours(baseTs.getHours() + i * 3 + rangeInt(0, 2, rng));
    baseTs.setMinutes(rangeInt(0, 59, rng));

    results.push({
      payment_id: `PAY-${String(i + 1).padStart(7, '0')}`,
      servicer_id: pick(SERVICER_IDS, rng),
      loan_id: `LN-${String(rangeInt(1, 200, rng)).padStart(5, '0')}`,
      amount: rangeFloat(500, 5000, rng),
      status,
      payment_date: baseTs.toISOString(),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 5. generateLoanCommitments – MBS Pricing Enrichment (LOAN-COMMITMENTS)
// ---------------------------------------------------------------------------

const PRODUCT_TYPES = ['FIXED_30', 'FIXED_15', 'ARM_5_1'] as const;

export function generateLoanCommitments(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const rng = mulberry32(42 + i);

    const baseTs = new Date('2025-03-01T00:00:00Z');
    baseTs.setHours(baseTs.getHours() + i * 2 + rangeInt(0, 1, rng));
    baseTs.setMinutes(rangeInt(0, 59, rng));
    baseTs.setSeconds(rangeInt(0, 59, rng));

    results.push({
      commitment_id: `CMT-${String(i + 1).padStart(6, '0')}`,
      loan_id: `LN-${String(rangeInt(1, 500, rng)).padStart(5, '0')}`,
      product_type: pick(PRODUCT_TYPES, rng),
      principal: rangeFloat(100000, 800000, rng),
      rate_lock_date: baseTs.toISOString(),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 6. generateMarketRates – MBS Pricing temporal join (MARKET-RATES)
// ---------------------------------------------------------------------------

export function generateMarketRates(count: number): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];

  // Distribute count evenly across 3 product types to create versioned rows
  for (let i = 0; i < count; i++) {
    const rng = mulberry32(42 + i);

    const productType = PRODUCT_TYPES[i % PRODUCT_TYPES.length];
    const versionIndex = Math.floor(i / PRODUCT_TYPES.length);

    const baseTs = new Date('2025-01-01T00:00:00Z');
    baseTs.setDate(baseTs.getDate() + versionIndex * 7 + rangeInt(0, 6, rng));
    baseTs.setHours(rangeInt(8, 17, rng));
    baseTs.setMinutes(rangeInt(0, 59, rng));

    results.push({
      product_type: productType,
      base_rate: rangeFloat(3.0, 7.5, rng),
      spread: rangeFloat(0.25, 1.50, rng),
      effective_date: baseTs.toISOString(),
    });
  }

  return results;
}
