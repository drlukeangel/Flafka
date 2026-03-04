import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/confluent-client', () => ({
  telemetryClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
  confluentClient: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
  fcpmClient: {
    get: vi.fn(),
  },
  handleApiError: (error: unknown) => {
    if (error instanceof Error) return new Error(error.message);
    return new Error('Unknown error');
  },
}));

vi.mock('../../config/environment', () => ({
  env: {
    orgId: 'test-org',
    environmentId: 'test-env',
    computePoolId: 'test-pool',
    flinkApiKey: 'test-key',
    flinkApiSecret: 'test-secret',
  },
}));

import { getStatementTelemetry } from '../../api/telemetry-api';
import { telemetryClient, confluentClient } from '../../api/confluent-client';

// Helper: build a telemetry API response with the flat key format the implementation reads
function mockTelemetryResponse(statementName: string, value: number) {
  return {
    data: {
      data: [
        {
          'resource.flink_statement.name': statementName,
          value,
        },
      ],
    },
  };
}

// Helper: build a confluentClient.get response for fetchRunningStatements
function mockStatementsResponse(statements: Array<{
  name: string;
  sql?: string;
  createdAt?: string;
  computePoolId?: string;
  phase?: string;
}>) {
  return {
    data: {
      data: statements.map((s) => ({
        name: s.name,
        spec: {
          statement: s.sql,
          compute_pool_id: s.computePoolId ?? 'test-pool',
        },
        status: {
          phase: s.phase ?? 'RUNNING',
        },
        metadata: {
          created_at: s.createdAt ?? '2026-03-01T10:00:00Z',
        },
      })),
    },
  };
}

describe('[@api] [@telemetry] telemetry-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should merge 5 metrics for a single statement', async () => {
    vi.mocked(confluentClient.get).mockResolvedValueOnce(
      mockStatementsResponse([
        { name: 'stmt-1', sql: 'SELECT * FROM t1', createdAt: '2026-03-01T10:00:00Z' },
      ])
    );

    vi.mocked(telemetryClient.post)
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 2))    // cfus
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 100))  // recordsIn
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 80))   // recordsOut
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 20))   // pendingRecords
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 1024)); // stateSizeBytes

    const result = await getStatementTelemetry(['stmt-1']);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      statementName: 'stmt-1',
      cfus: 2,
      recordsIn: 100,
      recordsOut: 80,
      pendingRecords: 20,
      stateSizeBytes: 1024,
      sql: 'SELECT * FROM t1',
      createdAt: '2026-03-01T10:00:00Z',
      isWorkspaceStatement: true,
    });
  });

  it('should handle partial metric failure (3/5 succeed)', async () => {
    vi.mocked(confluentClient.get).mockResolvedValueOnce(
      mockStatementsResponse([
        { name: 'stmt-1', sql: 'SELECT 1', createdAt: '2026-03-01T10:00:00Z' },
      ])
    );

    vi.mocked(telemetryClient.post)
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 4))    // cfus OK
      .mockRejectedValueOnce(new Error('timeout'))                   // recordsIn FAIL
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 50))   // recordsOut OK
      .mockRejectedValueOnce(new Error('timeout'))                   // pendingRecords FAIL
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 2048)); // stateSizeBytes OK

    const result = await getStatementTelemetry([]);

    expect(result).toHaveLength(1);
    expect(result[0].cfus).toBe(4);
    expect(result[0].recordsIn).toBeNull();
    expect(result[0].recordsOut).toBe(50);
    expect(result[0].pendingRecords).toBeNull();
    expect(result[0].stateSizeBytes).toBe(2048);
  });

  it('should return empty array when fetchRunningStatements returns no statements', async () => {
    vi.mocked(confluentClient.get).mockResolvedValueOnce(
      mockStatementsResponse([])
    );

    // Telemetry should never be called when there are no running statements
    const result = await getStatementTelemetry([]);

    expect(result).toEqual([]);
    expect(telemetryClient.post).not.toHaveBeenCalled();
  });

  it('should return empty array when fetchRunningStatements fails', async () => {
    vi.mocked(confluentClient.get).mockRejectedValueOnce(new Error('auth error'));

    const result = await getStatementTelemetry([]);

    expect(result).toEqual([]);
    expect(telemetryClient.post).not.toHaveBeenCalled();
  });

  it('should return statements with null metrics when all metrics fail', async () => {
    vi.mocked(confluentClient.get).mockResolvedValueOnce(
      mockStatementsResponse([
        { name: 'stmt-1', sql: 'SELECT 1', createdAt: '2026-03-01T10:00:00Z' },
      ])
    );
    vi.mocked(telemetryClient.post).mockRejectedValue(new Error('network error'));

    const result = await getStatementTelemetry([]);

    expect(result).toHaveLength(1);
    expect(result[0].statementName).toBe('stmt-1');
    expect(result[0].cfus).toBeNull();
    expect(result[0].recordsIn).toBeNull();
    expect(result[0].recordsOut).toBeNull();
    expect(result[0].pendingRecords).toBeNull();
    expect(result[0].stateSizeBytes).toBeNull();
  });

  it('should merge multiple statements correctly', async () => {
    vi.mocked(confluentClient.get).mockResolvedValueOnce(
      mockStatementsResponse([
        { name: 'stmt-a', sql: 'SELECT a FROM ta', createdAt: '2026-03-01T10:00:00Z' },
        { name: 'stmt-b', sql: 'SELECT b FROM tb', createdAt: '2026-03-01T11:00:00Z' },
      ])
    );

    const multiResponse = (values: Record<string, number>) => ({
      data: {
        data: Object.entries(values).map(([name, value]) => ({
          'resource.flink_statement.name': name,
          value,
        })),
      },
    });

    vi.mocked(telemetryClient.post)
      .mockResolvedValueOnce(multiResponse({ 'stmt-a': 2, 'stmt-b': 6 }))
      .mockResolvedValueOnce(multiResponse({ 'stmt-a': 10, 'stmt-b': 30 }))
      .mockResolvedValueOnce(multiResponse({ 'stmt-a': 8, 'stmt-b': 25 }))
      .mockResolvedValueOnce(multiResponse({ 'stmt-a': 0, 'stmt-b': 5 }))
      .mockResolvedValueOnce(multiResponse({ 'stmt-a': 512, 'stmt-b': 4096 }));

    const result = await getStatementTelemetry(['stmt-a']);

    expect(result).toHaveLength(2);
    const a = result.find((r) => r.statementName === 'stmt-a');
    const b = result.find((r) => r.statementName === 'stmt-b');
    expect(a?.cfus).toBe(2);
    expect(a?.isWorkspaceStatement).toBe(true);
    expect(b?.cfus).toBe(6);
    expect(b?.isWorkspaceStatement).toBe(false);
  });

  it('should build correct POST body with compute pool filter', async () => {
    vi.mocked(confluentClient.get).mockResolvedValueOnce(
      mockStatementsResponse([
        { name: 'stmt-1' },
      ])
    );
    vi.mocked(telemetryClient.post).mockResolvedValue({ data: { data: [] } });

    await getStatementTelemetry([]);

    expect(telemetryClient.post).toHaveBeenCalledTimes(5);
    const body = vi.mocked(telemetryClient.post).mock.calls[0][1];
    expect(body).toMatchObject({
      aggregations: [{ metric: 'io.confluent.flink/statement_utilization/current_cfus' }],
      filter: {
        field: 'resource.compute_pool.id',
        op: 'EQ',
        value: 'test-pool',
      },
      group_by: ['resource.flink_statement.name'],
    });
  });

  it('should only include statements on the configured compute pool', async () => {
    // Two RUNNING statements but one is on a different pool — only our-pool one should appear
    vi.mocked(confluentClient.get).mockResolvedValueOnce({
      data: {
        data: [
          {
            name: 'stmt-on-pool',
            spec: { statement: 'SELECT 1', compute_pool_id: 'test-pool' },
            status: { phase: 'RUNNING' },
            metadata: { created_at: '2026-03-01T10:00:00Z' },
          },
          {
            name: 'stmt-other-pool',
            spec: { statement: 'SELECT 2', compute_pool_id: 'other-pool' },
            status: { phase: 'RUNNING' },
            metadata: { created_at: '2026-03-01T10:00:00Z' },
          },
        ],
      },
    });

    vi.mocked(telemetryClient.post).mockResolvedValue({ data: { data: [] } });

    const result = await getStatementTelemetry([]);

    expect(result).toHaveLength(1);
    expect(result[0].statementName).toBe('stmt-on-pool');
  });

  it('should tag workspace vs external statements', async () => {
    vi.mocked(confluentClient.get).mockResolvedValueOnce(
      mockStatementsResponse([
        { name: 'ws-stmt' },
        { name: 'ext-stmt' },
      ])
    );

    vi.mocked(telemetryClient.post).mockResolvedValue({
      data: {
        data: [
          { 'resource.flink_statement.name': 'ws-stmt', value: 1 },
          { 'resource.flink_statement.name': 'ext-stmt', value: 2 },
        ],
      },
    });

    const result = await getStatementTelemetry(['ws-stmt']);

    const ws = result.find((r) => r.statementName === 'ws-stmt');
    const ext = result.find((r) => r.statementName === 'ext-stmt');
    expect(ws?.isWorkspaceStatement).toBe(true);
    expect(ext?.isWorkspaceStatement).toBe(false);
  });

  it('should use the correct URL to fetch statements', async () => {
    vi.mocked(confluentClient.get).mockResolvedValueOnce(
      mockStatementsResponse([])
    );

    await getStatementTelemetry([]);

    expect(confluentClient.get).toHaveBeenCalledWith(
      '/sql/v1/organizations/test-org/environments/test-env/statements?page_size=1000&time_ordered=true'
    );
  });
});
