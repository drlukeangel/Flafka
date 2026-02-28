import { describe, it, expect } from 'vitest';
import { validateWorkspaceJSON, exportWorkspace, generateExportFilename } from '../../utils/workspace-export';

// [@workspace-export]
describe('[@workspace-export] Workspace Import/Export', () => {
  describe('validateWorkspaceJSON', () => {
    it('rejects non-object input', () => {
      expect(validateWorkspaceJSON(null).valid).toBe(false);
      expect(validateWorkspaceJSON('string').valid).toBe(false);
      expect(validateWorkspaceJSON(42).valid).toBe(false);
    });

    it('rejects missing statements', () => {
      const result = validateWorkspaceJSON({ catalog: 'c', database: 'd', workspaceName: 'w' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid "statements" array');
    });

    it('rejects missing catalog', () => {
      const result = validateWorkspaceJSON({ statements: [], database: 'd', workspaceName: 'w' });
      expect(result.valid).toBe(false);
    });

    it('rejects missing database', () => {
      const result = validateWorkspaceJSON({ statements: [], catalog: 'c', workspaceName: 'w' });
      expect(result.valid).toBe(false);
    });

    it('rejects missing workspaceName', () => {
      const result = validateWorkspaceJSON({ statements: [], catalog: 'c', database: 'd' });
      expect(result.valid).toBe(false);
    });

    it('accepts valid workspace with empty statements', () => {
      const result = validateWorkspaceJSON({
        statements: [],
        catalog: 'my-catalog',
        database: 'my-database',
        workspaceName: 'Test Workspace',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts valid workspace with statements', () => {
      const result = validateWorkspaceJSON({
        statements: [
          { id: '1', code: 'SELECT 1', createdAt: '2026-01-01T00:00:00.000Z' }
        ],
        catalog: 'my-catalog',
        database: 'my-database',
        workspaceName: 'Test Workspace',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects statements without id', () => {
      const result = validateWorkspaceJSON({
        statements: [{ code: 'SELECT 1', createdAt: '2026-01-01T00:00:00.000Z' }],
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects statements without code', () => {
      const result = validateWorkspaceJSON({
        statements: [{ id: '1', createdAt: '2026-01-01T00:00:00.000Z' }],
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects statements with invalid createdAt', () => {
      const result = validateWorkspaceJSON({
        statements: [{ id: '1', code: 'SELECT 1', createdAt: 'not-a-date' }],
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects > 500 statements', () => {
      const statements = Array.from({ length: 501 }, (_, i) => ({
        id: String(i), code: 'SELECT 1', createdAt: '2026-01-01T00:00:00.000Z',
      }));
      const result = validateWorkspaceJSON({
        statements, catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('exportWorkspace', () => {
    it('generates valid JSON string', () => {
      const result = exportWorkspace({
        statements: [{ id: '1', code: 'SELECT 1', createdAt: new Date('2026-01-01') }],
        catalog: 'test-catalog',
        database: 'test-db',
        workspaceName: 'Test',
      });
      const parsed = JSON.parse(result);
      expect(parsed.catalog).toBe('test-catalog');
      expect(parsed.database).toBe('test-db');
      expect(parsed.workspaceName).toBe('Test');
      expect(parsed.version).toBe('1.0');
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.statements).toHaveLength(1);
    });
  });

  describe('generateExportFilename', () => {
    it('sanitizes unsafe characters', () => {
      const filename = generateExportFilename('My/Bad:Name*');
      expect(filename).not.toContain('/');
      expect(filename).not.toContain(':');
      expect(filename).not.toContain('*');
      expect(filename).toContain('My_Bad_Name_');
      expect(filename.endsWith('.json')).toBe(true);
    });

    it('includes timestamp', () => {
      const filename = generateExportFilename('Test');
      expect(filename).toMatch(/Test-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json/);
    });
  });
});
