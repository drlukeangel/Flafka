/**
 * [@settings-panel] Settings panel validation tests
 * Validates all editable settings sections and their unique IDs
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import { useWorkspaceStore } from '../../store/workspaceStore';

describe('[@settings-panel] Settings Panel with Unique IDs', () => {
  beforeEach(() => {
    const store = useWorkspaceStore.getState();
    store.setActiveNavItem('settings');
    store.setCatalog('default');
    store.setDatabase('cluster_0');
    store.setWorkspaceName('test-workspace');
  });

  describe('Environment Section', () => {
    it('should render unique ID input with correct ID attribute', () => {
      render(<App />);
      const uniqueIdInput = document.getElementById('settings-unique-id-input');
      expect(uniqueIdInput).toBeTruthy();
      expect(uniqueIdInput?.tagName).toBe('INPUT');
    });

    it('should display environment variable value in unique ID input', () => {
      render(<App />);
      const uniqueIdInput = document.getElementById('settings-unique-id-input') as HTMLInputElement;
      // Should show env var value or be empty if not set
      expect(uniqueIdInput?.value).toBeDefined();
    });

    it('should render catalog select with unique ID', () => {
      render(<App />);
      const catalogSelect = document.getElementById('settings-catalog-select');
      expect(catalogSelect).toBeTruthy();
      expect(catalogSelect?.tagName).toBe('SELECT');
    });

    it('should render database select with unique ID', () => {
      render(<App />);
      const databaseSelect = document.getElementById('settings-database-select');
      expect(databaseSelect).toBeTruthy();
      expect(databaseSelect?.tagName).toBe('SELECT');
    });

    it('should change catalog when select value changes', async () => {
      render(<App />);
      const catalogSelect = document.getElementById('settings-catalog-select') as HTMLSelectElement;

      fireEvent.change(catalogSelect, { target: { value: 'default' } });

      await waitFor(() => {
        expect(catalogSelect.value).toBe('default');
      });
    });

    it('should change database when select value changes', async () => {
      render(<App />);
      const databaseSelect = document.getElementById('settings-database-select') as HTMLSelectElement;

      fireEvent.change(databaseSelect, { target: { value: 'cluster_0' } });

      await waitFor(() => {
        expect(databaseSelect.value).toBe('cluster_0');
      });
    });
  });

  describe('Workspace Section', () => {
    it('should render export workspace button with unique ID', () => {
      render(<App />);
      const exportBtn = document.getElementById('settings-export-workspace-btn');
      expect(exportBtn).toBeTruthy();
      expect(exportBtn?.textContent).toContain('Export Workspace');
    });

    it('should render import workspace button with unique ID', () => {
      render(<App />);
      const importBtn = document.getElementById('settings-import-workspace-btn');
      expect(importBtn).toBeTruthy();
      expect(importBtn?.textContent).toContain('Import Workspace');
    });

    it('should have clickable action buttons', async () => {
      render(<App />);
      const exportBtn = document.getElementById('settings-export-workspace-btn');
      expect(() => {
        fireEvent.click(exportBtn!);
      }).not.toThrow();
    });
  });

  describe('Session Properties', () => {
    it('should render add property button with unique ID', () => {
      render(<App />);
      const addBtn = document.getElementById('settings-add-property-btn');
      expect(addBtn).toBeTruthy();
      expect(addBtn?.textContent).toContain('Add Property');
    });

    it('should render reset properties button with unique ID', () => {
      render(<App />);
      const resetBtn = document.getElementById('settings-reset-properties-btn');
      expect(resetBtn).toBeTruthy();
      expect(resetBtn?.textContent).toContain('Reset Defaults');
    });

    it('should create session property input with sanitized ID', async () => {
      const store = useWorkspaceStore.getState();
      store.setSessionProperty('sql.local_time_zone', 'UTC');

      render(<App />);

      const propInput = document.getElementById('settings-session-property-sql-local_time_zone');
      expect(propInput).toBeTruthy();
      expect((propInput as HTMLInputElement)?.value).toBe('UTC');
    });

    it('should create delete button for property with sanitized ID', async () => {
      const store = useWorkspaceStore.getState();
      store.setSessionProperty('sql.local_time_zone', 'UTC');

      render(<App />);

      const deleteBtn = document.getElementById('settings-session-property-delete-sql-local_time_zone');
      expect(deleteBtn).toBeTruthy();
      expect(deleteBtn?.textContent).toBe('×');
    });

    it('should update session property value', async () => {
      const store = useWorkspaceStore.getState();
      store.setSessionProperty('sql.local_time_zone', 'UTC');

      render(<App />);

      const propInput = document.getElementById('settings-session-property-sql-local_time_zone') as HTMLInputElement;
      fireEvent.change(propInput, { target: { value: 'America/New_York' } });

      await waitFor(() => {
        const updatedStore = useWorkspaceStore.getState();
        expect(updatedStore.sessionProperties['sql.local_time_zone']).toBe('America/New_York');
      });
    });

    it('should delete session property when delete button clicked', async () => {
      const store = useWorkspaceStore.getState();
      store.setSessionProperty('sql.local_time_zone', 'UTC');

      render(<App />);

      const deleteBtn = document.getElementById('settings-session-property-delete-sql-local_time_zone');
      fireEvent.click(deleteBtn!);

      await waitFor(() => {
        const updatedStore = useWorkspaceStore.getState();
        expect(updatedStore.sessionProperties['sql.local_time_zone']).toBeUndefined();
      });
    });

    it('should handle property keys with special characters', async () => {
      const store = useWorkspaceStore.getState();
      store.setSessionProperty('execution.checkpointing.interval', '60000');

      render(<App />);

      const propInput = document.getElementById('settings-session-property-execution-checkpointing-interval');
      expect(propInput).toBeTruthy();
    });
  });

  describe('All Settings Elements Present', () => {
    it('should have all required setting IDs in environment section', () => {
      render(<App />);
      expect(document.getElementById('settings-unique-id-input')).toBeTruthy();
      expect(document.getElementById('settings-catalog-select')).toBeTruthy();
      expect(document.getElementById('settings-database-select')).toBeTruthy();
    });

    it('should have all required setting IDs in workspace section', () => {
      render(<App />);
      expect(document.getElementById('settings-export-workspace-btn')).toBeTruthy();
      expect(document.getElementById('settings-import-workspace-btn')).toBeTruthy();
    });

    it('should have all required setting IDs in session properties section', () => {
      render(<App />);
      expect(document.getElementById('settings-add-property-btn')).toBeTruthy();
      expect(document.getElementById('settings-reset-properties-btn')).toBeTruthy();
    });
  });
});
