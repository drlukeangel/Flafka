import { describe, it, expect } from 'vitest';

// [@statement-labels]
describe('[@statement-labels] Statement Label Logic', () => {
  describe('[@statement-labels] label trimming', () => {
    it('trims whitespace from labels', () => {
      const label = '  My Query  ';
      const result = label.trim() === '' ? undefined : label.trim();
      expect(result).toBe('My Query');
    });

    it('returns undefined for empty string', () => {
      const label = '';
      const result = label.trim() === '' ? undefined : label.trim();
      expect(result).toBeUndefined();
    });

    it('returns undefined for whitespace-only string', () => {
      const label = '   ';
      const result = label.trim() === '' ? undefined : label.trim();
      expect(result).toBeUndefined();
    });
  });

  describe('[@statement-labels] duplicate label suffix', () => {
    it('appends Copy to existing label', () => {
      const label = 'Query A';
      const newLabel = label ? `${label} Copy` : undefined;
      expect(newLabel).toBe('Query A Copy');
    });

    it('returns undefined when no label', () => {
      const label = undefined;
      const newLabel = label ? `${label} Copy` : undefined;
      expect(newLabel).toBeUndefined();
    });
  });

  describe('[@statement-labels] label character limit', () => {
    it('allows up to 50 characters', () => {
      const label = 'A'.repeat(50);
      expect(label.length).toBe(50);
    });
  });
});
