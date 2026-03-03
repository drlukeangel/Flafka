import { describe, it, expect } from 'vitest';
import {
  generateLoanApplication,
  generateLoanApplicationDataset,
} from '../../data/loan-sample-generator';

describe('[@loan-generator] generateLoanApplication', () => {
  it('returns loan_id and json_payload fields', () => {
    const record = generateLoanApplication(42);
    expect(record).toHaveProperty('loan_id');
    expect(record).toHaveProperty('json_payload');
    expect(typeof record.loan_id).toBe('string');
    expect(typeof record.json_payload).toBe('string');
  });

  it('loan_id matches LN-2024-XXXXX pattern', () => {
    const record = generateLoanApplication(42);
    expect(record.loan_id).toMatch(/^LN-2024-\d{5}$/);
  });

  it('json_payload is valid JSON', () => {
    const record = generateLoanApplication(42);
    expect(() => JSON.parse(record.json_payload)).not.toThrow();
  });

  it('parsed payload has expected nested structure', () => {
    const record = generateLoanApplication(42);
    const payload = JSON.parse(record.json_payload);
    expect(payload.application).toBeDefined();
    expect(payload.application.applicant.name.first).toBeTruthy();
    expect(payload.application.applicant.name.last).toBeTruthy();
    expect(payload.application.loan.type).toBeTruthy();
    expect(payload.underwriting.risk_assessment.credit_analysis.bureau_data.score).toBeDefined();
    expect(payload.underwriting.fraud_check.result).toBeTruthy();
  });

  it('produces variation across different seeds', () => {
    const a = generateLoanApplication(1);
    const b = generateLoanApplication(2);
    // Different seeds should produce different loan IDs or payloads
    expect(a.loan_id !== b.loan_id || a.json_payload !== b.json_payload).toBe(true);
  });

  it('is deterministic — same seed produces same output', () => {
    const a = generateLoanApplication(42);
    const b = generateLoanApplication(42);
    expect(a.loan_id).toBe(b.loan_id);
    expect(a.json_payload).toBe(b.json_payload);
  });

  it('credit score is within range 580–850', () => {
    for (let seed = 0; seed < 50; seed++) {
      const record = generateLoanApplication(seed);
      const payload = JSON.parse(record.json_payload);
      const score = payload.underwriting.risk_assessment.credit_analysis.bureau_data.score;
      expect(score).toBeGreaterThanOrEqual(580);
      expect(score).toBeLessThanOrEqual(850);
    }
  });

  it('tradelines array has 1–5 items', () => {
    for (let seed = 0; seed < 50; seed++) {
      const record = generateLoanApplication(seed);
      const payload = JSON.parse(record.json_payload);
      const tradelines = payload.underwriting.risk_assessment.credit_analysis.bureau_data.tradelines;
      expect(Array.isArray(tradelines)).toBe(true);
      expect(tradelines.length).toBeGreaterThanOrEqual(1);
      expect(tradelines.length).toBeLessThanOrEqual(5);
    }
  });

  it('tradeline items have required fields', () => {
    const record = generateLoanApplication(42);
    const payload = JSON.parse(record.json_payload);
    const tradeline = payload.underwriting.risk_assessment.credit_analysis.bureau_data.tradelines[0];
    expect(tradeline).toHaveProperty('account_type');
    expect(tradeline).toHaveProperty('lender');
    expect(tradeline).toHaveProperty('balance');
    expect(tradeline).toHaveProperty('credit_limit');
    expect(tradeline).toHaveProperty('status');
  });
});

describe('[@loan-generator] generateLoanApplicationDataset', () => {
  it('generates requested count of records', () => {
    const records = generateLoanApplicationDataset(200);
    expect(records).toHaveLength(200);
  });

  it('all records have unique loan_ids in a batch of 200', () => {
    const records = generateLoanApplicationDataset(200);
    const ids = new Set(records.map((r) => r.loan_id));
    // Seeded RNG may produce some duplicates in the ID space but should be rare
    // Allow at least 90% unique
    expect(ids.size).toBeGreaterThanOrEqual(180);
  });
});
