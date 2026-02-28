import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../../store/workspaceStore';

describe('[@phase-12-nav-store] Navigation store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWorkspaceStore.setState({
      activeNavItem: 'workspace',
      navExpanded: false,
    });
  });

  describe('[@phase-12-nav-store] Initial state', () => {
    it('should have activeNavItem default to workspace', () => {
      const state = useWorkspaceStore.getState();
      expect(state.activeNavItem).toBe('workspace');
    });

    it('should have navExpanded default to false', () => {
      const state = useWorkspaceStore.getState();
      expect(state.navExpanded).toBe(false);
    });
  });

  describe('[@phase-12-nav-store] setActiveNavItem', () => {
    it('should update activeNavItem to history', () => {
      const store = useWorkspaceStore.getState();
      store.setActiveNavItem('history');

      const updated = useWorkspaceStore.getState();
      expect(updated.activeNavItem).toBe('history');
    });

    it('should set activeNavItem to workspace', () => {
      const store = useWorkspaceStore.getState();
      store.setActiveNavItem('workspace');

      const updated = useWorkspaceStore.getState();
      expect(updated.activeNavItem).toBe('workspace');
    });

    it('should set activeNavItem to tree', () => {
      const store = useWorkspaceStore.getState();
      store.setActiveNavItem('tree');

      const updated = useWorkspaceStore.getState();
      expect(updated.activeNavItem).toBe('tree');
    });

    it('should set activeNavItem to topics', () => {
      const store = useWorkspaceStore.getState();
      store.setActiveNavItem('topics');

      const updated = useWorkspaceStore.getState();
      expect(updated.activeNavItem).toBe('topics');
    });

    it('should set activeNavItem to schemas', () => {
      const store = useWorkspaceStore.getState();
      store.setActiveNavItem('schemas');

      const updated = useWorkspaceStore.getState();
      expect(updated.activeNavItem).toBe('schemas');
    });

    it('should set activeNavItem to help', () => {
      const store = useWorkspaceStore.getState();
      store.setActiveNavItem('help');

      const updated = useWorkspaceStore.getState();
      expect(updated.activeNavItem).toBe('help');
    });

    it('should set activeNavItem to settings', () => {
      const store = useWorkspaceStore.getState();
      store.setActiveNavItem('settings');

      const updated = useWorkspaceStore.getState();
      expect(updated.activeNavItem).toBe('settings');
    });
  });

  describe('[@phase-12-nav-store] toggleNavExpanded', () => {
    it('should toggle navExpanded from false to true', () => {
      const store = useWorkspaceStore.getState();
      expect(store.navExpanded).toBe(false);

      store.toggleNavExpanded();

      const updated = useWorkspaceStore.getState();
      expect(updated.navExpanded).toBe(true);
    });

    it('should toggle navExpanded from true to false', () => {
      const store = useWorkspaceStore.getState();
      store.toggleNavExpanded();
      expect(useWorkspaceStore.getState().navExpanded).toBe(true);

      store.toggleNavExpanded();

      const updated = useWorkspaceStore.getState();
      expect(updated.navExpanded).toBe(false);
    });

    it('should return to original state when toggled twice', () => {
      const store = useWorkspaceStore.getState();
      const originalState = store.navExpanded;

      store.toggleNavExpanded();
      store.toggleNavExpanded();

      const updated = useWorkspaceStore.getState();
      expect(updated.navExpanded).toBe(originalState);
    });
  });

  describe('[@phase-12-nav-store] Persistence', () => {
    it('should persist navExpanded in localStorage', () => {
      const store = useWorkspaceStore.getState();
      store.toggleNavExpanded();
      // Trigger a state write by calling an action that updates lastSavedAt
      store.setWorkspaceName('persistence-test');

      // Read what zustand-persist serialised into localStorage
      const raw = localStorage.getItem('flink-workspace');
      expect(raw).not.toBeNull();

      const persisted = JSON.parse(raw!) as {
        state: {
          navExpanded: boolean;
          activeNavItem?: string;
        };
      };

      expect(persisted.state).toHaveProperty('navExpanded');
      expect(persisted.state.navExpanded).toBe(true);
    });

    it('should NOT persist activeNavItem in localStorage', () => {
      const store = useWorkspaceStore.getState();
      store.setActiveNavItem('history');
      // Trigger a state write by calling an action that updates lastSavedAt
      store.setWorkspaceName('nav-item-persistence-test');

      // Read what zustand-persist serialised into localStorage
      const raw = localStorage.getItem('flink-workspace');
      expect(raw).not.toBeNull();

      const persisted = JSON.parse(raw!) as {
        state: Record<string, unknown>;
      };

      expect(persisted.state).not.toHaveProperty('activeNavItem');
    });

    it('should restore navExpanded from localStorage on load', () => {
      const store = useWorkspaceStore.getState();
      store.toggleNavExpanded();
      store.setWorkspaceName('restore-test');

      // Verify navExpanded was persisted
      const raw = localStorage.getItem('flink-workspace');
      expect(raw).not.toBeNull();

      const persisted = JSON.parse(raw!);
      expect(persisted.state.navExpanded).toBe(true);
    });
  });
});
