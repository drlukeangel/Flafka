/**
 * @example-runner
 * Tests for the generic Kickstarter example runner and data generators.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock flink-api — must be hoisted
// ---------------------------------------------------------------------------
const { mockExecuteSQL, mockPollForResults } = vi.hoisted(() => ({
  mockExecuteSQL: vi.fn().mockResolvedValue({ name: 'stmt-001' }),
  mockPollForResults: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../api/flink-api', () => ({
  executeSQL: (...args: unknown[]) => mockExecuteSQL(...args),
  pollForResults: (...args: unknown[]) => mockPollForResults(...args),
}));

// Mock names so runId is deterministic
vi.mock('../../utils/names', () => ({
  generateFunName: vi.fn().mockReturnValue('test-run-123'),
  generateStatementName: vi.fn().mockReturnValue('test-stmt'),
  getSessionTag: vi.fn().mockReturnValue('123'),
  generateTopicStatementName: vi.fn().mockReturnValue('test-topic-stmt'),
}));

import {
  runKickstarterExample,
  generateFlatLoans,
  generateCustomerRiskProfiles,
  generateCustomerCreditProfiles,
  type KickstarterExampleDef,
} from '../../services/example-runner';

// ---------------------------------------------------------------------------
// Minimal store mock
// ---------------------------------------------------------------------------

function makeStore() {
  return {
    addStatement: vi.fn(),
    addSchemaDataset: vi.fn(),
    addStreamCard: vi.fn(),
    setStreamsPanelOpen: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Minimal example def for runner tests
// ---------------------------------------------------------------------------

const simpleDef: KickstarterExampleDef = {
  id: 'test-example',
  tables: [
    {
      name: 'LOANS',
      schema: 'loans-standard',
      role: 'input',
      dataset: { generator: 'flat-loans', count: 5 },
      stream: 'produce-consume',
    },
    {
      name: 'LOANS-FILTERED',
      schema: 'loans-filtered',
      role: 'output',
    },
  ],
  sql: [
    {
      label: 'filter-job',
      sql: "INSERT INTO `{LOANS-FILTERED}` SELECT * FROM `{LOANS}` WHERE status = 'APPROVED'",
    },
    {
      label: 'view-output',
      sql: 'SELECT * FROM `{LOANS-FILTERED}` LIMIT 50',
    },
  ],
};

// ---------------------------------------------------------------------------
// Runner tests — marker [@example-runner]
// ---------------------------------------------------------------------------

describe('[@example-runner] runKickstarterExample', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-001' });
    mockPollForResults.mockResolvedValue(undefined);
  });

  it('calls executeSQL + pollForResults N times for N tables', async () => {
    const store = makeStore();
    await runKickstarterExample(simpleDef, store, vi.fn());
    // 2 tables → 2 DDL executions
    expect(mockExecuteSQL).toHaveBeenCalledTimes(2);
    expect(mockPollForResults).toHaveBeenCalledTimes(2);
  });

  it('calls store.addStatement once per SQL cell', async () => {
    const store = makeStore();
    await runKickstarterExample(simpleDef, store, vi.fn());
    expect(store.addStatement).toHaveBeenCalledTimes(2);
  });

  it('template substitution: {LOANS} replaced with LOANS-rid (no extra backticks)', async () => {
    const store = makeStore();
    await runKickstarterExample(simpleDef, store, vi.fn());
    // The first SQL cell references {LOANS-FILTERED} and {LOANS}
    const firstCall = store.addStatement.mock.calls[0][0] as string;
    expect(firstCall).toContain('`LOANS-test-run-123`');
    expect(firstCall).toContain('`LOANS-FILTERED-test-run-123`');
    // Should NOT have double backticks like ``LOANS-test-run-123``
    expect(firstCall).not.toContain('``');
  });

  it('placeholder appearing twice in same query is replaced both times', async () => {
    const doubleDef: KickstarterExampleDef = {
      id: 'double-test',
      tables: [{ name: 'LOANS', schema: 'loans-standard', role: 'input' }],
      sql: [{ label: 'cell', sql: 'SELECT * FROM `{LOANS}` UNION SELECT * FROM `{LOANS}`' }],
    };
    const store = makeStore();
    await runKickstarterExample(doubleDef, store, vi.fn());
    const sql = store.addStatement.mock.calls[0][0] as string;
    const matches = sql.match(/`LOANS-test-run-123`/g) || [];
    expect(matches.length).toBe(2);
  });

  it('unknown schema key throws Error containing the bad key', async () => {
    const badDef: KickstarterExampleDef = {
      id: 'bad',
      tables: [{ name: 'LOANS', schema: 'nonexistent-schema', role: 'input' }],
      sql: [],
    };
    const store = makeStore();
    await expect(runKickstarterExample(badDef, store, vi.fn())).rejects.toThrow('nonexistent-schema');
  });

  it('unknown generator key throws Error containing the bad key', async () => {
    const badDef: KickstarterExampleDef = {
      id: 'bad',
      tables: [{ name: 'LOANS', schema: 'loans-standard', role: 'input', dataset: { generator: 'nonexistent-gen', count: 5 } }],
      sql: [],
    };
    const store = makeStore();
    await expect(runKickstarterExample(badDef, store, vi.fn())).rejects.toThrow('nonexistent-gen');
  });

  it('store.addSchemaDataset called with correct schemaSubject', async () => {
    const store = makeStore();
    await runKickstarterExample(simpleDef, store, vi.fn());
    expect(store.addSchemaDataset).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaSubject: 'LOANS-test-run-123-value',
      }),
    );
  });

  it('store.addStreamCard called with produce-consume for input tables with stream', async () => {
    const store = makeStore();
    await runKickstarterExample(simpleDef, store, vi.fn());
    expect(store.addStreamCard).toHaveBeenCalledWith(
      'LOANS-test-run-123',
      'produce-consume',
      expect.any(String),
      expect.any(Object),
    );
  });

  it('output tables (no dataset) do not trigger addSchemaDataset or addStreamCard', async () => {
    const store = makeStore();
    await runKickstarterExample(simpleDef, store, vi.fn());
    // Only LOANS has a dataset — LOANS-FILTERED does not
    expect(store.addSchemaDataset).toHaveBeenCalledTimes(1);
    expect(store.addStreamCard).toHaveBeenCalledTimes(1);
  });

  it('store.setStreamsPanelOpen(true) called once per invocation', async () => {
    const store = makeStore();
    await runKickstarterExample(simpleDef, store, vi.fn());
    expect(store.setStreamsPanelOpen).toHaveBeenCalledTimes(1);
    expect(store.setStreamsPanelOpen).toHaveBeenCalledWith(true);
  });

  it('return value has runId that appears as prefix in generated table names', async () => {
    const store = makeStore();
    const result = await runKickstarterExample(simpleDef, store, vi.fn());
    expect(result.runId).toBe('test-run-123');
    // Verify the runId appears as suffix in DDL calls (THING-rid format)
    const firstDDLArg = mockExecuteSQL.mock.calls[0][0] as string;
    expect(firstDDLArg).toContain('LOANS-test-run-123');
  });
});

// ---------------------------------------------------------------------------
// Generator tests — marker [@example-runner-generators]
// ---------------------------------------------------------------------------

describe('[@example-runner-generators] data generators', () => {
  it('generateFlatLoans(200) returns exactly 200 records', () => {
    expect(generateFlatLoans(200)).toHaveLength(200);
  });

  it('each flat loan has required fields and NO key field', () => {
    const loans = generateFlatLoans(5);
    for (const loan of loans) {
      expect(loan).toHaveProperty('loan_id');
      expect(loan).toHaveProperty('amount');
      expect(loan).toHaveProperty('status');
      expect(loan).toHaveProperty('created_at');
      expect(loan).toHaveProperty('txn_id');
      expect(loan).toHaveProperty('customer_id');
      expect(loan).not.toHaveProperty('key');
    }
  });

  it('loan_id matches /^LN-2024-\\d{5}$/', () => {
    const loans = generateFlatLoans(10);
    for (const loan of loans) {
      expect(String(loan.loan_id)).toMatch(/^LN-2024-\d{5}$/);
    }
  });

  it('status is one of APPROVED, PENDING, REJECTED, CANCELLED', () => {
    const valid = new Set(['APPROVED', 'PENDING', 'REJECTED', 'CANCELLED']);
    const loans = generateFlatLoans(20);
    for (const loan of loans) {
      expect(valid.has(String(loan.status))).toBe(true);
    }
  });

  it('amount is between 5000 and 75000 inclusive and a multiple of 500', () => {
    const loans = generateFlatLoans(50);
    for (const loan of loans) {
      const amt = Number(loan.amount);
      expect(amt).toBeGreaterThanOrEqual(5000);
      expect(amt).toBeLessThanOrEqual(75000);
      expect(amt % 500).toBe(0);
    }
  });

  it('customer_id cycles through C-001 to C-010 only', () => {
    const valid = new Set(['C-001','C-002','C-003','C-004','C-005','C-006','C-007','C-008','C-009','C-010']);
    const loans = generateFlatLoans(30);
    for (const loan of loans) {
      expect(valid.has(String(loan.customer_id))).toBe(true);
    }
  });

  it('generateCustomerRiskProfiles(10) returns 10 records with all required fields', () => {
    const profiles = generateCustomerRiskProfiles(10);
    expect(profiles).toHaveLength(10);
    for (const p of profiles) {
      expect(p).toHaveProperty('customer_id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('risk_score');
      expect(p).toHaveProperty('risk_level');
    }
  });

  it('risk_level thresholds: 85→CRITICAL, 84→HIGH, 65→HIGH, 64→MEDIUM, 35→MEDIUM, 34→LOW', () => {
    // We test by generating profiles with controlled scores
    // Since generateCustomerRiskProfiles uses random scores, we test the logic directly
    // by importing helper indirectly through multiple profile runs or by checking boundary values
    const boundary = (score: number) => {
      if (score >= 85) return 'CRITICAL';
      if (score >= 65) return 'HIGH';
      if (score >= 35) return 'MEDIUM';
      return 'LOW';
    };
    expect(boundary(85)).toBe('CRITICAL');
    expect(boundary(84)).toBe('HIGH');
    expect(boundary(65)).toBe('HIGH');
    expect(boundary(64)).toBe('MEDIUM');
    expect(boundary(35)).toBe('MEDIUM');
    expect(boundary(34)).toBe('LOW');

    // Also verify that generated profiles have valid risk levels
    const profiles = generateCustomerRiskProfiles(50);
    const validLevels = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
    for (const p of profiles) {
      expect(validLevels.has(String(p.risk_level))).toBe(true);
      // Verify risk_level is consistent with risk_score
      expect(p.risk_level).toBe(boundary(Number(p.risk_score)));
    }
  });

  it('generateCustomerCreditProfiles(10) returns records with all required fields matching customers-credit DDL', () => {
    const profiles = generateCustomerCreditProfiles(10);
    // 2 records per customer
    expect(profiles.length).toBe(20);
    for (const p of profiles) {
      expect(p).toHaveProperty('customer_id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('credit_score');
      expect(p).toHaveProperty('state');
      expect(p).toHaveProperty('valid_from');
    }
  });

  it('credit_score in credit profiles is in range 300–850', () => {
    const profiles = generateCustomerCreditProfiles(20);
    for (const p of profiles) {
      const score = Number(p.credit_score);
      expect(score).toBeGreaterThanOrEqual(300);
      expect(score).toBeLessThanOrEqual(850);
    }
  });
});
