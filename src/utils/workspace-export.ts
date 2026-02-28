import type { WorkspaceExportData } from '../types';

export function exportWorkspace(state: WorkspaceExportData): string {
  return JSON.stringify({
    statements: state.statements,
    catalog: state.catalog,
    database: state.database,
    workspaceName: state.workspaceName,
    exportedAt: new Date().toISOString(),
    version: '1.0',
  }, null, 2);
}

export function generateExportFilename(workspaceName: string): string {
  const sanitized = workspaceName
    .replace(/[/\\:*?"<>|]/g, '_')
    .slice(0, 200);
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, -5);
  return `${sanitized}-${timestamp}.json`;
}

export function validateWorkspaceJSON(data: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('File must contain a valid JSON object');
    return { valid: false, errors };
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.statements)) {
    errors.push('Missing or invalid "statements" array');
  } else {
    if (obj.statements.length > 500) {
      errors.push(`Too many statements: ${obj.statements.length} (max 500)`);
    }

    obj.statements.forEach((stmt: unknown, idx: number) => {
      if (typeof stmt !== 'object' || !stmt) {
        errors.push(`Statement ${idx}: must be an object`);
      } else {
        const s = stmt as Record<string, unknown>;
        if (!s.id || typeof s.id !== 'string') {
          errors.push(`Statement ${idx}: missing required "id" (string)`);
        }
        if (!s.code || typeof s.code !== 'string') {
          errors.push(`Statement ${idx}: missing required "code" (string)`);
        }
        if (s.createdAt && typeof s.createdAt === 'string') {
          if (isNaN(Date.parse(s.createdAt))) {
            errors.push(`Statement ${idx}: invalid "createdAt" date string`);
          }
        } else if (s.createdAt === undefined) {
          errors.push(`Statement ${idx}: missing required "createdAt"`);
        } else {
          errors.push(`Statement ${idx}: "createdAt" must be a string`);
        }
      }
    });
  }

  if (!obj.catalog || typeof obj.catalog !== 'string') {
    errors.push('Missing or invalid "catalog" (string)');
  }

  if (!obj.database || typeof obj.database !== 'string') {
    errors.push('Missing or invalid "database" (string)');
  }

  if (!obj.workspaceName || typeof obj.workspaceName !== 'string') {
    errors.push('Missing or invalid "workspaceName" (string)');
  }

  return { valid: errors.length === 0, errors };
}
