import { describe, it, expect } from 'vitest';

// [@json-expander]
describe('[@json-expander] JSON Cell Expander helpers', () => {
  describe('[@json-expander] isExpandable helper', () => {
    const isExpandable = (value: unknown): boolean => {
      return value !== null && value !== undefined && typeof value === 'object';
    };

    it('isExpandable returns true for objects', () => {
      expect(isExpandable({ a: 1 })).toBe(true);
    });

    it('isExpandable returns true for arrays', () => {
      expect(isExpandable([1, 2, 3])).toBe(true);
    });

    it('isExpandable returns false for null', () => {
      expect(isExpandable(null)).toBe(false);
    });

    it('isExpandable returns false for undefined', () => {
      expect(isExpandable(undefined)).toBe(false);
    });

    it('isExpandable returns false for primitives', () => {
      expect(isExpandable('string')).toBe(false);
      expect(isExpandable(42)).toBe(false);
      expect(isExpandable(true)).toBe(false);
    });
  });

  describe('[@json-expander] formatJSON helper', () => {
    const formatJSON = (value: unknown): string => {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '[Unable to display]';
      }
    };

    it('formatJSON pretty-prints objects', () => {
      const result = formatJSON({ a: 1, b: 'hello' });
      expect(result).toBe('{\n  "a": 1,\n  "b": "hello"\n}');
    });

    it('formatJSON pretty-prints arrays', () => {
      const result = formatJSON([1, 2, 3]);
      expect(result).toBe('[\n  1,\n  2,\n  3\n]');
    });

    it('formatJSON handles empty objects', () => {
      expect(formatJSON({})).toBe('{}');
    });

    it('formatJSON handles empty arrays', () => {
      expect(formatJSON([])).toBe('[]');
    });

    it('formatJSON handles deeply nested objects', () => {
      const nested = { a: { b: { c: { d: 'deep' } } } };
      const result = formatJSON(nested);
      expect(result).toContain('"d": "deep"');
    });
  });
});
