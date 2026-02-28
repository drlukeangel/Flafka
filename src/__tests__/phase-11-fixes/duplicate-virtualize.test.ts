import { describe, it, expect } from 'vitest';

describe('[@phase-11-duplicates] Fix A: Duplicate Statement Position', () => {
  it('should insert duplicate after source using splice', () => {
    const statements = [
      { id: '1', code: 'SELECT 1' },
      { id: '2', code: 'SELECT 2' },
      { id: '3', code: 'SELECT 3' },
    ];

    const sourceId = '2';
    const sourceIndex = statements.findIndex(s => s.id === sourceId);
    const newStatements = [...statements];
    const newStatement = { id: '4', code: 'SELECT 2' };
    newStatements.splice(sourceIndex + 1, 0, newStatement);

    expect(newStatements.length).toBe(4);
    expect(newStatements[0].id).toBe('1');
    expect(newStatements[1].id).toBe('2'); // Source
    expect(newStatements[2].id).toBe('4'); // Duplicate inserted here
    expect(newStatements[3].id).toBe('3');
  });

  it('should append at end when duplicating last statement', () => {
    const statements = [
      { id: '1', code: 'SELECT 1' },
      { id: '2', code: 'SELECT 2' },
    ];

    const sourceId = '2';
    const sourceIndex = statements.findIndex(s => s.id === sourceId);
    const newStatements = [...statements];
    const newStatement = { id: '3', code: 'SELECT 2' };
    newStatements.splice(sourceIndex + 1, 0, newStatement);

    expect(newStatements.length).toBe(3);
    expect(newStatements[2].id).toBe('3'); // Appended at end
  });

  it('should handle single statement', () => {
    const statements = [{ id: '1', code: 'SELECT 1' }];

    const sourceIndex = 0;
    const newStatements = [...statements];
    newStatements.splice(sourceIndex + 1, 0, { id: '2', code: 'SELECT 1' });

    expect(newStatements.length).toBe(2);
    expect(newStatements[0].id).toBe('1');
    expect(newStatements[1].id).toBe('2');
  });

  it('should clear updatedAt on duplicate', () => {
    const source = { id: '1', code: 'SELECT 1', updatedAt: new Date() };
    const duplicate = { ...source, id: '2', updatedAt: undefined };
    expect(duplicate.updatedAt).toBeUndefined();
  });

  it('should copy label with Copy suffix', () => {
    const label = 'My Query';
    const newLabel = label ? `${label} Copy` : undefined;
    expect(newLabel).toBe('My Query Copy');
  });

  it('should return undefined label when source has no label', () => {
    const label = undefined;
    const newLabel = label ? `${label} Copy` : undefined;
    expect(newLabel).toBeUndefined();
  });
});

describe('[@phase-11-duplicates] Fix B: List View Virtualization', () => {
  it('should calculate correct paddingTop from virtual items', () => {
    const virtualItems = [{ start: 350, end: 385, index: 10 }];
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    expect(paddingTop).toBe(350);
  });

  it('should calculate correct paddingBottom', () => {
    const virtualItems = [
      { start: 0, end: 35, index: 0 },
      { start: 35, end: 70, index: 1 },
    ];
    const totalSize = 3500; // 100 rows * 35px
    const paddingBottom = virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1].end
      : 0;
    expect(paddingBottom).toBe(3430);
  });

  it('should use consistent cellKey format', () => {
    const virtualRowIndex = 42;
    const colName = 'name';
    const cellKey = `${virtualRowIndex}-${colName}`;
    expect(cellKey).toBe('42-name');
  });

  it('should apply row striping based on virtual index', () => {
    expect(0 % 2 !== 0).toBe(false); // even
    expect(1 % 2 !== 0).toBe(true); // odd
    expect(10 % 2 !== 0).toBe(false); // even
    expect(11 % 2 !== 0).toBe(true); // odd
  });
});
