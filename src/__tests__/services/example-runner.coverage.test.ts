/**
 * @example-runner-coverage
 * Additional coverage for example-runner: generateJokes, alias DDL resolution,
 * onProgress calls, tables without stream config.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteSQL, mockGetStatementStatus } = vi.hoisted(() => ({
  mockExecuteSQL: vi.fn().mockResolvedValue({ name: 'stmt-001' }),
  mockGetStatementStatus: vi.fn().mockResolvedValue({ status: { phase: 'COMPLETED' } }),
}));

vi.mock('../../api/flink-api', () => ({
  executeSQL: (...args: unknown[]) => mockExecuteSQL(...args),
  pollForResults: vi.fn().mockResolvedValue(undefined),
  getStatementStatus: (...args: unknown[]) => mockGetStatementStatus(...args),
}));

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
  generateJokes,
  type KickstarterExampleDef,
} from '../../services/example-runner';

function makeStore() {
  return {
    addStatement: vi.fn(),
    addSchemaDataset: vi.fn(),
    addStreamCard: vi.fn(),
    setStreamsPanelOpen: vi.fn(),
  };
}

describe('[@example-runner-coverage] generateJokes', () => {
  it('returns the requested count of jokes', () => {
    const jokes = generateJokes(50);
    expect(jokes).toHaveLength(50);
  });

  it('each joke has joke_id, joke, category, and rating', () => {
    const jokes = generateJokes(10);
    for (const j of jokes) {
      expect(j).toHaveProperty('joke_id');
      expect(j).toHaveProperty('joke');
      expect(j).toHaveProperty('category');
      expect(j).toHaveProperty('rating');
    }
  });

  it('joke_id follows J-NNN pattern', () => {
    const jokes = generateJokes(5);
    for (const j of jokes) {
      expect(String(j.joke_id)).toMatch(/^J-\d{3}$/);
    }
  });

  it('wraps around when count exceeds joke list length', () => {
    // There are ~180+ jokes, requesting 300 should wrap
    const jokes = generateJokes(300);
    expect(jokes).toHaveLength(300);
    // First and wrapped joke should have same content (different joke_id)
    const firstJoke = jokes[0].joke;
    // Find the wrap point
    const wrapIdx = jokes.findIndex((j, i) => i > 0 && j.joke === firstJoke);
    expect(wrapIdx).toBeGreaterThan(0);
  });

  it('category is one of known values', () => {
    const validCategories = new Set(['tech', 'science', 'wordplay', 'dad', 'spicy']);
    const jokes = generateJokes(100);
    for (const j of jokes) {
      expect(validCategories.has(String(j.category))).toBe(true);
    }
  });

  it('rating is one of known values', () => {
    const validRatings = new Set(['LOL', 'ROFL', 'DEAD', 'GROAN', 'MEH']);
    const jokes = generateJokes(100);
    for (const j of jokes) {
      expect(validRatings.has(String(j.rating))).toBe(true);
    }
  });
});

describe('[@example-runner-coverage] DDL alias resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-001' });
    mockGetStatementStatus.mockResolvedValue({ status: { phase: 'COMPLETED' } });
  });

  it('resolves alias schemas (loans-filtered → loans-standard)', async () => {
    const def: KickstarterExampleDef = {
      id: 'alias-test',
      tables: [
        { name: 'FILTERED', schema: 'loans-filtered', role: 'output' },
      ],
      sql: [],
    };
    const store = makeStore();
    await runKickstarterExample(def, store, vi.fn());

    // Should create table with loans-standard DDL (same columns)
    const ddl = mockExecuteSQL.mock.calls[0][0] as string;
    expect(ddl).toContain('CREATE TABLE');
    expect(ddl).toContain('loan_id');
  });

  it('resolves double alias (good-jokes → jokes)', async () => {
    const def: KickstarterExampleDef = {
      id: 'jokes-alias-test',
      tables: [
        { name: 'GOOD', schema: 'good-jokes', role: 'output' },
      ],
      sql: [],
    };
    const store = makeStore();
    await runKickstarterExample(def, store, vi.fn());

    const ddl = mockExecuteSQL.mock.calls[0][0] as string;
    expect(ddl).toContain('joke_id');
  });
});

describe('[@example-runner-coverage] onProgress callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-001' });
    mockGetStatementStatus.mockResolvedValue({ status: { phase: 'COMPLETED' } });
  });

  it('calls onProgress with "Adding queries to workspace..."', async () => {
    const def: KickstarterExampleDef = {
      id: 'progress-test',
      tables: [{ name: 'T', schema: 'loans-standard', role: 'input' }],
      sql: [{ label: 'test', sql: 'SELECT 1' }],
    };
    const store = makeStore();
    const onProgress = vi.fn();
    await runKickstarterExample(def, store, onProgress);
    expect(onProgress).toHaveBeenCalledWith('Adding queries to workspace...');
  });
});

describe('[@example-runner-coverage] tables without stream config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-001' });
    mockGetStatementStatus.mockResolvedValue({ status: { phase: 'COMPLETED' } });
  });

  it('tables with dataset but no stream do NOT call addStreamCard', async () => {
    const def: KickstarterExampleDef = {
      id: 'no-stream-test',
      tables: [
        {
          name: 'DATA',
          schema: 'loans-standard',
          role: 'input',
          dataset: { generator: 'flat-loans', count: 5 },
          // no stream property
        },
      ],
      sql: [],
    };
    const store = makeStore();
    await runKickstarterExample(def, store, vi.fn());
    expect(store.addSchemaDataset).toHaveBeenCalledTimes(1);
    expect(store.addStreamCard).not.toHaveBeenCalled();
  });
});

describe('[@example-runner-coverage] credit profile edge cases', () => {
  it('credit scores stay within 300-850 range even with shift', () => {
    const profiles = generateCustomerCreditProfiles(50);
    for (const p of profiles) {
      const score = Number(p.credit_score);
      expect(score).toBeGreaterThanOrEqual(300);
      expect(score).toBeLessThanOrEqual(850);
    }
  });

  it('generates two records per customer', () => {
    const profiles = generateCustomerCreditProfiles(5);
    expect(profiles).toHaveLength(10);
    // Each customer_id should appear exactly twice
    const counts = new Map<string, number>();
    for (const p of profiles) {
      const id = String(p.customer_id);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    for (const count of counts.values()) {
      expect(count).toBe(2);
    }
  });
});
