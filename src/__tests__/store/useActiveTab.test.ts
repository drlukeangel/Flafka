import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// We need to mock the store to control its state
let mockActiveTabId = 'tab-1';
const mockTabs: Record<string, any> = {
  'tab-1': {
    statements: [{ id: 's1' }, { id: 's2' }],
    workspaceName: 'Test Workspace',
    focusedStatementId: null,
  },
  'tab-2': {
    statements: [],
    workspaceName: 'Empty Workspace',
    focusedStatementId: null,
  },
};

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selectorOrShallow: any) => {
    // The hook calls useWorkspaceStore twice:
    // 1. with a simple selector for activeTabId
    // 2. with useShallow-wrapped selector for the tab data
    // Since vi.mock flattens this, we handle both cases
    if (typeof selectorOrShallow === 'function') {
      const state = { activeTabId: mockActiveTabId, tabs: mockTabs };
      return selectorOrShallow(state);
    }
    return selectorOrShallow;
  },
}));

// Mock zustand/shallow
vi.mock('zustand/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

import { useActiveTab } from '../../store/useActiveTab';

describe('[@use-active-tab] useActiveTab', () => {
  it('selects data from the active tab using the provided selector', () => {
    const { result } = renderHook(() => useActiveTab((t) => t.workspaceName));
    expect(result.current).toBe('Test Workspace');
  });

  it('returns statements from the active tab', () => {
    const { result } = renderHook(() => useActiveTab((t) => t.statements));
    expect(result.current).toHaveLength(2);
    expect(result.current[0].id).toBe('s1');
  });

  it('returns an object selector result', () => {
    const { result } = renderHook(() =>
      useActiveTab((t) => ({
        name: t.workspaceName,
        count: t.statements.length,
      }))
    );
    expect(result.current.name).toBe('Test Workspace');
    expect(result.current.count).toBe(2);
  });
});
