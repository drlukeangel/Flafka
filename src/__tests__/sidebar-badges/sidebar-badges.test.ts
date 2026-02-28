import { describe, it, expect } from 'vitest';

// [@sidebar-badges]
describe('[@sidebar-badges] Sidebar Count Badges', () => {
  describe('[@sidebar-badges] category node identification', () => {
    function isCategoryNode(nodeType: string): boolean {
      return ['tables', 'views', 'models', 'functions', 'externalTables'].includes(nodeType);
    }

    it('identifies category nodes correctly', () => {
      expect(isCategoryNode('tables')).toBe(true);
      expect(isCategoryNode('views')).toBe(true);
      expect(isCategoryNode('models')).toBe(true);
      expect(isCategoryNode('functions')).toBe(true);
      expect(isCategoryNode('externalTables')).toBe(true);
    });

    it('rejects non-category nodes', () => {
      expect(isCategoryNode('table')).toBe(false);
      expect(isCategoryNode('view')).toBe(false);
      expect(isCategoryNode('catalog')).toBe(false);
      expect(isCategoryNode('database')).toBe(false);
      expect(isCategoryNode('function')).toBe(false);
      expect(isCategoryNode('externalTable')).toBe(false);
      expect(isCategoryNode('model')).toBe(false);
    });
  });
});
