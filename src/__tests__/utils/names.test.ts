import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the environment config
vi.mock('../../config/environment', () => ({
  env: { uniqueId: 'test123' },
}));

import { getSessionTag, generateFunName, generateStatementName, generateTopicStatementName } from '../../utils/names';

describe('[@names] names utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSessionTag', () => {
    it('returns the unique ID from environment', () => {
      expect(getSessionTag()).toBe('test123');
    });
  });

  describe('generateFunName', () => {
    it('returns a string with adjective-noun-uniqueId format', () => {
      const name = generateFunName();
      const parts = name.split('-');
      // At least 3 parts: adjective, noun, uniqueId
      expect(parts.length).toBeGreaterThanOrEqual(3);
      expect(name).toContain('test123');
    });

    it('generates different names on successive calls (probabilistic)', () => {
      const names = new Set(Array.from({ length: 20 }, () => generateFunName()));
      // With 64 adjectives * 64 nouns = 4096 combos, 20 calls should produce multiple unique names
      expect(names.size).toBeGreaterThan(1);
    });
  });

  describe('generateStatementName', () => {
    it('contains the session tag and ends with a hex suffix', () => {
      const name = generateStatementName();
      expect(name).toContain('test123');
      // Format: adjective-noun-uniqueId-hex4
      expect(name).toMatch(/^[a-z]+-[a-z]+-test123-[0-9a-f]{4}$/);
    });

    it('has at least 4 hyphen-separated parts', () => {
      const parts = generateStatementName().split('-');
      expect(parts.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('generateTopicStatementName', () => {
    it('prefixes with slugified topic name', () => {
      const name = generateTopicStatementName('my-topic');
      expect(name.startsWith('my-topic-test123-')).toBe(true);
    });

    it('slugifies special characters in topic name', () => {
      const name = generateTopicStatementName('LOANS_FILTERED');
      expect(name).toMatch(/^loans-filtered-test123-/);
    });

    it('prepends s- if topic slug starts with a number', () => {
      const name = generateTopicStatementName('123-topic');
      expect(name).toMatch(/^s-123-topic-test123-/);
    });

    it('handles empty topic name', () => {
      const name = generateTopicStatementName('');
      // Empty string after slugification, leading hyphen stripped
      expect(name).toContain('test123');
    });
  });
});
