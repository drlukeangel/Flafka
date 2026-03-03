import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as flinkApi from '../../api/flink-api';

vi.mock('../../api/flink-api');

describe('[@stream-store] Stream Panel Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useWorkspaceStore.setState({
      streamsPanelOpen: false,
      streamCards: [],
      backgroundStatements: [],
    });
    vi.clearAllMocks();
  });

  describe('toggleStreamsPanel', () => {
    it('toggles streamsPanelOpen from false to true', () => {
      useWorkspaceStore.getState().toggleStreamsPanel();
      expect(useWorkspaceStore.getState().streamsPanelOpen).toBe(true);
    });

    it('toggles streamsPanelOpen from true to false', () => {
      useWorkspaceStore.setState({ streamsPanelOpen: true });
      useWorkspaceStore.getState().toggleStreamsPanel();
      expect(useWorkspaceStore.getState().streamsPanelOpen).toBe(false);
    });

    it('preserves streamCards when closing (persistent panel)', () => {
      useWorkspaceStore.setState({
        streamsPanelOpen: true,
        streamCards: [
          { id: 'c1', topicName: 'topic-1' },
          { id: 'c2', topicName: 'topic-2' },
        ],
      });
      useWorkspaceStore.getState().toggleStreamsPanel();
      expect(useWorkspaceStore.getState().streamsPanelOpen).toBe(false);
      expect(useWorkspaceStore.getState().streamCards).toHaveLength(2);
    });
  });

  describe('addStreamCard / removeStreamCard', () => {
    it('adds a card to streamCards', () => {
      useWorkspaceStore.getState().addStreamCard('my-topic');
      const cards = useWorkspaceStore.getState().streamCards;
      expect(cards).toHaveLength(1);
      expect(cards[0].topicName).toBe('my-topic');
    });

    it('allows multiple cards for same topic', () => {
      useWorkspaceStore.getState().addStreamCard('my-topic');
      useWorkspaceStore.getState().addStreamCard('my-topic');
      expect(useWorkspaceStore.getState().streamCards).toHaveLength(2);
    });

    it('enforces max 10 cards', () => {
      for (let i = 0; i < 11; i++) {
        useWorkspaceStore.getState().addStreamCard(`topic-${i}`);
      }
      expect(useWorkspaceStore.getState().streamCards).toHaveLength(10);
    });

    it('removes a card by id from streamCards', () => {
      useWorkspaceStore.setState({
        streamCards: [
          { id: 'c1', topicName: 't1' },
          { id: 'c2', topicName: 't2' },
        ],
      });
      useWorkspaceStore.getState().removeStreamCard('c1');
      const cards = useWorkspaceStore.getState().streamCards;
      expect(cards).toHaveLength(1);
      expect(cards[0].topicName).toBe('t2');
    });
  });

  describe('executeBackgroundStatement', () => {
    it('cancels existing statement for same contextId before executing', async () => {
      const mockCancel = vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined);
      const mockExecute = vi.mocked(flinkApi.executeSQL).mockResolvedValue({
        name: 'bg-123-ctx1',
        status: { phase: 'COMPLETED' },
      } as any);
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({
        name: 'bg-123-ctx1',
        status: { phase: 'COMPLETED' },
      } as any);
      vi.mocked(flinkApi.getStatementResults).mockResolvedValue({
        results: { data: [] },
      });

      // Set up an existing background statement
      useWorkspaceStore.setState({
        backgroundStatements: [{
          id: 'old-id',
          contextId: 'ctx1',
          statementName: 'bg-old-ctx1',
          sql: 'SELECT 1',
          status: 'RUNNING',
          createdAt: new Date(),
        }],
      });

      await useWorkspaceStore.getState().executeBackgroundStatement('ctx1', 'SELECT 2');

      expect(mockCancel).toHaveBeenCalledWith('bg-old-ctx1');
    });

    it('names statement with bg- prefix', async () => {
      vi.mocked(flinkApi.executeSQL).mockResolvedValue({
        name: 'bg-test',
        status: { phase: 'COMPLETED' },
      } as any);
      vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({
        name: 'bg-test',
        status: { phase: 'COMPLETED' },
      } as any);
      vi.mocked(flinkApi.getStatementResults).mockResolvedValue({
        results: { data: [] },
      });

      await useWorkspaceStore.getState().executeBackgroundStatement('my-topic', 'SELECT 1');

      const bgStmts = useWorkspaceStore.getState().backgroundStatements;
      expect(bgStmts.length).toBeGreaterThan(0);
      expect(bgStmts[0].statementName).toMatch(/^bg-/);
    });
  });

  describe('cancelBackgroundStatement', () => {
    it('calls flinkApi.cancelStatement and sets status to CANCELLED', async () => {
      vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined);

      useWorkspaceStore.setState({
        backgroundStatements: [{
          id: 'bg-1',
          contextId: 'ctx1',
          statementName: 'bg-123-ctx1',
          sql: 'SELECT 1',
          status: 'RUNNING',
          createdAt: new Date(),
        }],
      });

      await useWorkspaceStore.getState().cancelBackgroundStatement('ctx1');

      expect(flinkApi.cancelStatement).toHaveBeenCalledWith('bg-123-ctx1');
      const stmt = useWorkspaceStore.getState().backgroundStatements.find((s) => s.contextId === 'ctx1');
      expect(stmt?.status).toBe('CANCELLED');
    });
  });

  describe('clearBackgroundStatements', () => {
    it('cancels all active statements and clears array', async () => {
      vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined);

      useWorkspaceStore.setState({
        backgroundStatements: [
          { id: '1', contextId: 'c1', statementName: 'bg-1', sql: 'S1', status: 'RUNNING', createdAt: new Date() },
          { id: '2', contextId: 'c2', statementName: 'bg-2', sql: 'S2', status: 'PENDING', createdAt: new Date() },
          { id: '3', contextId: 'c3', statementName: 'bg-3', sql: 'S3', status: 'COMPLETED', createdAt: new Date() },
        ],
      });

      await useWorkspaceStore.getState().clearBackgroundStatements();

      // Should have called cancel for RUNNING and PENDING (not COMPLETED)
      expect(flinkApi.cancelStatement).toHaveBeenCalledTimes(2);
      expect(useWorkspaceStore.getState().backgroundStatements).toEqual([]);
    });
  });

  describe('backgroundStatements NOT in workspace selectors', () => {
    it('backgroundStatements are not visible via statements selector', () => {
      useWorkspaceStore.setState({
        backgroundStatements: [{
          id: 'bg-1',
          contextId: 'ctx1',
          statementName: 'bg-123-ctx1',
          sql: 'SELECT 1',
          status: 'RUNNING',
          createdAt: new Date(),
        }],
      });

      // The main `statements` array should not contain background statements
      const statements = useWorkspaceStore.getState().statements;
      expect(statements.find((s) => s.id === 'bg-1')).toBeUndefined();
    });
  });

  describe('persistence exclusion', () => {
    it('backgroundStatements NOT present in localStorage after store mutation', () => {
      useWorkspaceStore.getState().addStreamCard('test-topic');
      useWorkspaceStore.getState().toggleStreamsPanel();

      const stored = localStorage.getItem('flink-workspace');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state).not.toHaveProperty('streamsPanelOpen');
        expect(parsed.state).not.toHaveProperty('streamCards');
        expect(parsed.state).not.toHaveProperty('backgroundStatements');
      }
    });
  });
});
