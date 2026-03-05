import { useCallback } from 'react';
import { useWorkspaceStore } from './workspaceStore';
import { useShallow } from 'zustand/shallow';
import type { TabState } from '../types';

/**
 * Hook to select state from the active tab with proper memoization.
 * Uses shallow equality to prevent unnecessary re-renders.
 *
 * Usage:
 *   const statements = useActiveTab(t => t.statements);
 *   const { statements, workspaceName } = useActiveTab(t => ({
 *     statements: t.statements,
 *     workspaceName: t.workspaceName,
 *   }));
 */
export function useActiveTab<T>(selector: (tab: TabState) => T): T {
  const activeTabId = useWorkspaceStore(s => s.activeTabId);
  return useWorkspaceStore(
    useShallow(
      useCallback(
        (s: { tabs: Record<string, TabState> }) => selector(s.tabs[activeTabId]),
        [activeTabId, selector]
      )
    )
  );
}
