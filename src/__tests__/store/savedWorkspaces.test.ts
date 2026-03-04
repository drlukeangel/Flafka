import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../../store/workspaceStore';
import * as flinkApi from '../../api/flink-api';

vi.mock('../../api/flink-api');

// Helper to reset store
function resetStore() {
  useWorkspaceStore.setState({
    statements: [
      { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date(), label: 'test-1' },
    ],
    streamCards: [],
    savedWorkspaces: [],
    streamsPanelOpen: false,
    schemaDatasets: [],
    toasts: [],
    workspaceName: 'My Workspace',
  });
}

describe('[@workspaces] saveCurrentWorkspace', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('creates a saved workspace entry with correct fields', () => {
    useWorkspaceStore.getState().saveCurrentWorkspace('Test WS');
    const { savedWorkspaces } = useWorkspaceStore.getState();
    expect(savedWorkspaces).toHaveLength(1);
    expect(savedWorkspaces[0].name).toBe('Test WS');
    expect(savedWorkspaces[0].statementCount).toBe(1);
    expect(savedWorkspaces[0].streamCardCount).toBe(0);
    expect(savedWorkspaces[0].statements[0].code).toBe('SELECT 1');
    expect(typeof savedWorkspaces[0].id).toBe('string');
  });

  it('captures statementName only for RUNNING statements', () => {
    useWorkspaceStore.setState({
      statements: [
        { id: 'stmt-1', code: 'INSERT INTO t SELECT 1', status: 'RUNNING', createdAt: new Date(), statementName: 'job-abc' },
        { id: 'stmt-2', code: 'SELECT 2', status: 'IDLE', createdAt: new Date(), statementName: 'job-xyz' },
      ],
    });
    useWorkspaceStore.getState().saveCurrentWorkspace('WS');
    const { savedWorkspaces } = useWorkspaceStore.getState();
    expect(savedWorkspaces[0].statements[0].statementName).toBe('job-abc');
    expect(savedWorkspaces[0].statements[1].statementName).toBeUndefined();
  });

  it('does NOT capture statementName for IDLE statements with statementName', () => {
    useWorkspaceStore.setState({
      statements: [
        { id: 'stmt-1', code: 'SELECT 1', status: 'IDLE', createdAt: new Date(), statementName: 'old-job' },
      ],
    });
    useWorkspaceStore.getState().saveCurrentWorkspace('WS');
    const snap = useWorkspaceStore.getState().savedWorkspaces[0].statements[0];
    expect(snap.statementName).toBeUndefined();
  });

  it('enforces max 20 workspaces and shows toast', () => {
    // Pre-fill 20
    const existing = Array.from({ length: 20 }, (_, i) => ({
      id: `ws-${i}`,
      name: `WS ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      statementCount: 0,
      streamCardCount: 0,
      statements: [],
      streamCards: [],
    }));
    useWorkspaceStore.setState({ savedWorkspaces: existing });
    useWorkspaceStore.getState().saveCurrentWorkspace('Overflow WS');
    expect(useWorkspaceStore.getState().savedWorkspaces).toHaveLength(20);
    const toast = useWorkspaceStore.getState().toasts.find((t) => t.type === 'error');
    expect(toast?.message).toContain('Max 20');
  });

  it('saves stream card mutable config fields', () => {
    useWorkspaceStore.setState({
      streamCards: [
        {
          id: 'card-1',
          topicName: 'my-topic',
          initialMode: 'consume',
          mode: 'produce-consume',
          dataSource: 'dataset',
          selectedDatasetId: 'ds-123',
          scanMode: 'latest-offset',
        },
      ],
    });
    useWorkspaceStore.getState().saveCurrentWorkspace('WS');
    const card = useWorkspaceStore.getState().savedWorkspaces[0].streamCards[0];
    expect(card.mode).toBe('produce-consume');
    expect(card.dataSource).toBe('dataset');
    expect(card.selectedDatasetId).toBe('ds-123');
    expect(card.scanMode).toBe('latest-offset');
  });

  it('falls back to initialMode when mode is not set', () => {
    useWorkspaceStore.setState({
      streamCards: [
        { id: 'card-1', topicName: 'my-topic', initialMode: 'produce-consume' },
      ],
    });
    useWorkspaceStore.getState().saveCurrentWorkspace('WS');
    const card = useWorkspaceStore.getState().savedWorkspaces[0].streamCards[0];
    expect(card.mode).toBe('produce-consume');
  });
});

describe('[@workspaces] deleteSavedWorkspace', () => {
  beforeEach(() => {
    resetStore();
    useWorkspaceStore.setState({
      savedWorkspaces: [
        { id: 'ws-1', name: 'WS 1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), statementCount: 0, streamCardCount: 0, statements: [], streamCards: [] },
        { id: 'ws-2', name: 'WS 2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), statementCount: 0, streamCardCount: 0, statements: [], streamCards: [] },
      ],
    });
  });

  it('removes the correct workspace', () => {
    useWorkspaceStore.getState().deleteSavedWorkspace('ws-1');
    const { savedWorkspaces } = useWorkspaceStore.getState();
    expect(savedWorkspaces).toHaveLength(1);
    expect(savedWorkspaces[0].id).toBe('ws-2');
  });

  it('is a no-op for unknown id', () => {
    useWorkspaceStore.getState().deleteSavedWorkspace('does-not-exist');
    expect(useWorkspaceStore.getState().savedWorkspaces).toHaveLength(2);
  });
});

describe('[@workspaces] renameSavedWorkspace', () => {
  beforeEach(() => {
    resetStore();
    useWorkspaceStore.setState({
      savedWorkspaces: [
        { id: 'ws-1', name: 'Old Name', createdAt: new Date().toISOString(), updatedAt: '2020-01-01T00:00:00.000Z', statementCount: 0, streamCardCount: 0, statements: [], streamCards: [] },
      ],
    });
  });

  it('updates name and updatedAt', () => {
    useWorkspaceStore.getState().renameSavedWorkspace('ws-1', 'New Name');
    const ws = useWorkspaceStore.getState().savedWorkspaces[0];
    expect(ws.name).toBe('New Name');
    expect(ws.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('ignores empty name', () => {
    useWorkspaceStore.getState().renameSavedWorkspace('ws-1', '');
    expect(useWorkspaceStore.getState().savedWorkspaces[0].name).toBe('Old Name');
  });
});

describe('[@workspaces] updateStreamCardConfig', () => {
  beforeEach(() => {
    resetStore();
    useWorkspaceStore.setState({
      streamCards: [
        { id: 'card-1', topicName: 'topic-a', initialMode: 'consume' },
        { id: 'card-2', topicName: 'topic-b', initialMode: 'produce-consume' },
      ],
    });
  });

  it('updates only the specified card', () => {
    useWorkspaceStore.getState().updateStreamCardConfig('card-1', { mode: 'produce-consume', dataSource: 'dataset' });
    const cards = useWorkspaceStore.getState().streamCards;
    expect(cards[0].mode).toBe('produce-consume');
    expect(cards[0].dataSource).toBe('dataset');
    expect(cards[1].mode).toBeUndefined();
  });

  it('merges partial updates', () => {
    useWorkspaceStore.getState().updateStreamCardConfig('card-1', { scanMode: 'latest-offset' });
    expect(useWorkspaceStore.getState().streamCards[0].scanMode).toBe('latest-offset');
    expect(useWorkspaceStore.getState().streamCards[0].mode).toBeUndefined();
  });
});

describe('[@workspaces] openSavedWorkspace', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  const buildWorkspace = (overrides = {}) => ({
    id: 'ws-saved',
    name: 'Saved WS',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    statementCount: 2,
    streamCardCount: 1,
    statements: [
      { id: 'old-s1', code: 'SELECT 1', label: 'Cell 1' },
      { id: 'old-s2', code: 'SELECT 2', label: 'Cell 2', statementName: 'job-running-1' },
    ],
    streamCards: [
      { topicName: 'my-topic', mode: 'produce-consume' as const, dataSource: 'synthetic' as const, selectedDatasetId: null, scanMode: 'earliest-offset' as const },
    ],
    ...overrides,
  });

  it('replaces statements with regenerated IDs', async () => {
    useWorkspaceStore.setState({ savedWorkspaces: [buildWorkspace()] });
    // Mock API call for reconnect
    vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({ status: { phase: 'RUNNING' } } as any);
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    const { statements } = useWorkspaceStore.getState();
    expect(statements).toHaveLength(2);
    expect(statements[0].id).not.toBe('old-s1');
    expect(statements[0].code).toBe('SELECT 1');
    expect(statements[1].id).not.toBe('old-s2');
  });

  it('sets workspaceName to snapshot name', async () => {
    useWorkspaceStore.setState({ savedWorkspaces: [buildWorkspace()] });
    vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({ status: { phase: 'RUNNING' } } as any);
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    expect(useWorkspaceStore.getState().workspaceName).toBe('Saved WS');
  });

  it('restores stream cards', async () => {
    useWorkspaceStore.setState({ savedWorkspaces: [buildWorkspace()] });
    vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({ status: { phase: 'RUNNING' } } as any);
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    const { streamCards } = useWorkspaceStore.getState();
    expect(streamCards).toHaveLength(1);
    expect(streamCards[0].topicName).toBe('my-topic');
    expect(streamCards[0].mode).toBe('produce-consume');
  });

  it('opens streams panel when stream cards are present', async () => {
    useWorkspaceStore.setState({ savedWorkspaces: [buildWorkspace()], streamsPanelOpen: false });
    vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({ status: { phase: 'RUNNING' } } as any);
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    expect(useWorkspaceStore.getState().streamsPanelOpen).toBe(true);
  });

  it('does not open streams panel when no stream cards', async () => {
    const ws = buildWorkspace({ streamCards: [], streamCardCount: 0 });
    useWorkspaceStore.setState({ savedWorkspaces: [ws], streamsPanelOpen: false });
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    expect(useWorkspaceStore.getState().streamsPanelOpen).toBe(false);
  });

  it('cancels current running statements before opening', async () => {
    useWorkspaceStore.setState({
      statements: [
        { id: 's-run', code: 'SELECT 1', status: 'RUNNING', createdAt: new Date(), statementName: 'active-job' },
      ],
      savedWorkspaces: [buildWorkspace({ statements: [{ id: 'new-s1', code: 'SELECT 99', label: 'Cell 1' }], streamCards: [] })],
    });
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    expect(flinkApi.cancelStatement).toHaveBeenCalledWith('active-job');
  });

  it('reconnect: still RUNNING → resumeStatementPolling called', async () => {
    const ws = buildWorkspace();
    useWorkspaceStore.setState({ savedWorkspaces: [ws] });
    vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({ status: { phase: 'RUNNING' }, spec: {} } as any);
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);
    const resumeSpy = vi.spyOn(useWorkspaceStore.getState(), 'resumeStatementPolling').mockResolvedValue();

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    // Wait for setTimeout(100ms) to fire
    await new Promise((r) => setTimeout(r, 150));
    expect(resumeSpy).toHaveBeenCalled();
    resumeSpy.mockRestore();
  });

  it('reconnect: spec.stopped=true → marks CANCELLED', async () => {
    const ws = buildWorkspace();
    useWorkspaceStore.setState({ savedWorkspaces: [ws] });
    vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({ status: { phase: 'RUNNING' }, spec: { stopped: true } } as any);
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    const runningStmt = useWorkspaceStore.getState().statements.find((s) => s.statementName === 'job-running-1');
    // statement should now have no statementName (cleared on cancel)
    expect(runningStmt).toBeUndefined();
    const stmts = useWorkspaceStore.getState().statements;
    expect(stmts.some((s) => s.status === 'CANCELLED')).toBe(true);
  });

  it('reconnect: 404 → marks IDLE', async () => {
    const ws = buildWorkspace();
    useWorkspaceStore.setState({ savedWorkspaces: [ws] });
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);
    vi.mocked(flinkApi.getStatementStatus).mockRejectedValue({ response: { status: 404 } });

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    const stmts = useWorkspaceStore.getState().statements;
    // The RUNNING statement (with statementName) should have become IDLE
    expect(stmts.some((s) => s.status === 'IDLE' && !s.statementName)).toBe(true);
  });

  it('reconnect: 5xx → keeps RUNNING, shows toast warning', async () => {
    const ws = buildWorkspace();
    useWorkspaceStore.setState({ savedWorkspaces: [ws] });
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);
    vi.mocked(flinkApi.getStatementStatus).mockRejectedValue({ response: { status: 503 } });

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    const stmts = useWorkspaceStore.getState().statements;
    // Statement with statementName should still be RUNNING
    expect(stmts.some((s) => s.status === 'RUNNING')).toBe(true);
    const toast = useWorkspaceStore.getState().toasts.find((t) => t.type === 'warning');
    expect(toast?.message).toContain('Reconnect check failed');
  });

  it('reconnect: COMPLETED → marks COMPLETED', async () => {
    const ws = buildWorkspace();
    useWorkspaceStore.setState({ savedWorkspaces: [ws] });
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);
    vi.mocked(flinkApi.getStatementStatus).mockResolvedValue({ status: { phase: 'COMPLETED' }, spec: {} } as any);

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    const stmts = useWorkspaceStore.getState().statements;
    expect(stmts.some((s) => s.status === 'COMPLETED')).toBe(true);
  });

  it('missing dataset → fallback to synthetic + warning toast', async () => {
    const ws = buildWorkspace({
      streamCards: [
        { topicName: 'my-topic', mode: 'produce-consume' as const, dataSource: 'dataset' as const, selectedDatasetId: 'missing-ds', scanMode: 'earliest-offset' as const },
      ],
    });
    useWorkspaceStore.setState({ savedWorkspaces: [ws], schemaDatasets: [] });
    vi.mocked(flinkApi.cancelStatement).mockResolvedValue(undefined as any);

    await useWorkspaceStore.getState().openSavedWorkspace('ws-saved');
    const cards = useWorkspaceStore.getState().streamCards;
    expect(cards[0].dataSource).toBe('synthetic');
    expect(cards[0].selectedDatasetId).toBeNull();
    const toast = useWorkspaceStore.getState().toasts.find((t) => t.type === 'warning' && t.message.includes('removed'));
    expect(toast).toBeDefined();
  });

  it('is a no-op for unknown workspace id', async () => {
    const before = useWorkspaceStore.getState().statements;
    await useWorkspaceStore.getState().openSavedWorkspace('does-not-exist');
    expect(useWorkspaceStore.getState().statements).toEqual(before);
  });
});
