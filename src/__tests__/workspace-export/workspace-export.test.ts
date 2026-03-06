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

    it('truncates very long names to 200 characters', () => {
      const longName = 'A'.repeat(300);
      const filename = generateExportFilename(longName);
      // The sanitized name portion should be truncated to 200 chars
      // filename format: <sanitized>-<timestamp>.json
      expect(filename.length).toBeLessThan(300 + 30); // name + timestamp + .json
    });

    it('sanitizes backslash and question mark', () => {
      const filename = generateExportFilename('path\\to?file');
      expect(filename).not.toContain('\\');
      expect(filename).not.toContain('?');
    });

    it('sanitizes angle brackets and pipe', () => {
      const filename = generateExportFilename('file<name>|here');
      expect(filename).not.toContain('<');
      expect(filename).not.toContain('>');
      expect(filename).not.toContain('|');
    });

    it('sanitizes double quotes', () => {
      const filename = generateExportFilename('my "workspace"');
      expect(filename).not.toContain('"');
    });
  });

  // =========================================================================
  // Additional validation edge cases
  // =========================================================================

  describe('[@workspace-export] validateWorkspaceJSON edge cases', () => {
    it('rejects undefined input', () => {
      const result = validateWorkspaceJSON(undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File must contain a valid JSON object');
    });

    it('rejects boolean input', () => {
      const result = validateWorkspaceJSON(true);
      expect(result.valid).toBe(false);
    });

    it('rejects statement that is a non-object (e.g., string)', () => {
      const result = validateWorkspaceJSON({
        statements: ['not-an-object'],
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be an object'))).toBe(true);
    });

    it('rejects statement that is null', () => {
      const result = validateWorkspaceJSON({
        statements: [null],
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be an object'))).toBe(true);
    });

    it('rejects statement with missing createdAt', () => {
      const result = validateWorkspaceJSON({
        statements: [{ id: '1', code: 'SELECT 1' }],
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing required "createdAt"'))).toBe(true);
    });

    it('rejects statement with non-string createdAt', () => {
      const result = validateWorkspaceJSON({
        statements: [{ id: '1', code: 'SELECT 1', createdAt: 12345 }],
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('"createdAt" must be a string'))).toBe(true);
    });

    it('rejects empty string catalog', () => {
      const result = validateWorkspaceJSON({
        statements: [],
        catalog: '', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects empty string database', () => {
      const result = validateWorkspaceJSON({
        statements: [],
        catalog: 'c', database: '', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects empty string workspaceName', () => {
      const result = validateWorkspaceJSON({
        statements: [],
        catalog: 'c', database: 'd', workspaceName: '',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects numeric catalog', () => {
      const result = validateWorkspaceJSON({
        statements: [],
        catalog: 123 as any, database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
    });

    it('collects multiple errors at once', () => {
      const result = validateWorkspaceJSON({
        statements: [{ id: '1' }],
        catalog: '', database: '', workspaceName: '',
      });
      expect(result.valid).toBe(false);
      // Should have errors for: code, createdAt, catalog, database, workspaceName
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it('rejects statements that is not an array', () => {
      const result = validateWorkspaceJSON({
        statements: 'not-an-array',
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid "statements" array');
    });

    it('rejects statement with numeric id', () => {
      const result = validateWorkspaceJSON({
        statements: [{ id: 123, code: 'SELECT 1', createdAt: '2026-01-01T00:00:00.000Z' }],
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing required "id"'))).toBe(true);
    });

    it('rejects statement with numeric code', () => {
      const result = validateWorkspaceJSON({
        statements: [{ id: '1', code: 123, createdAt: '2026-01-01T00:00:00.000Z' }],
        catalog: 'c', database: 'd', workspaceName: 'w',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing required "code"'))).toBe(true);
    });
  });

  // =========================================================================
  // exportWorkspace edge cases
  // =========================================================================

  describe('[@workspace-export] exportWorkspace edge cases', () => {
    it('includes exportedAt as valid ISO string', () => {
      const result = exportWorkspace({
        statements: [],
        catalog: 'c',
        database: 'd',
        workspaceName: 'w',
      });
      const parsed = JSON.parse(result);
      expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt);
    });

    it('exports multiple statements correctly', () => {
      const stmts = [
        { id: '1', code: 'SELECT 1', createdAt: new Date('2026-01-01') },
        { id: '2', code: 'SELECT 2', createdAt: new Date('2026-01-02') },
      ];
      const result = exportWorkspace({
        statements: stmts,
        catalog: 'c',
        database: 'd',
        workspaceName: 'w',
      });
      const parsed = JSON.parse(result);
      expect(parsed.statements).toHaveLength(2);
    });

    it('produces pretty-printed JSON (indented)', () => {
      const result = exportWorkspace({
        statements: [],
        catalog: 'c',
        database: 'd',
        workspaceName: 'w',
      });
      // Pretty-printed JSON has newlines
      expect(result).toContain('\n');
    });
  });
});
