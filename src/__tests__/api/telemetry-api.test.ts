import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/confluent-client', () => ({
  telemetryClient: {
    post: vi.fn(),
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

vi.mock('../../api/flink-api', () => ({
  listStatements: vi.fn(),
}));

import { getStatementTelemetry } from '../../api/telemetry-api';
import { telemetryClient } from '../../api/confluent-client';
import { listStatements } from '../../api/flink-api';

function mockTelemetryResponse(statementName: string, value: number) {
  return {
    data: {
      data: [
        {
          resource: { flink: { statement_name: statementName } },
          value,
        },
      ],
    },
  };
}

describe('[@api] [@telemetry] telemetry-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should merge 5 metrics for a single statement', async () => {
    // 5 metric calls return data for the same statement
    vi.mocked(telemetryClient.post)
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 2))   // cfus
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 100)) // recordsIn
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 80))  // recordsOut
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 20))  // pendingRecords
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 1024)); // stateSizeBytes

    vi.mocked(listStatements).mockResolvedValueOnce([
      {
        name: 'stmt-1',
        spec: { statement: 'SELECT * FROM t1' },
        metadata: { created_at: '2026-03-01T10:00:00Z' },
      },
    ]);

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
    vi.mocked(telemetryClient.post)
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 4))   // cfus OK
      .mockRejectedValueOnce(new Error('timeout'))                  // recordsIn FAIL
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 50))  // recordsOut OK
      .mockRejectedValueOnce(new Error('timeout'))                  // pendingRecords FAIL
      .mockResolvedValueOnce(mockTelemetryResponse('stmt-1', 2048)); // stateSizeBytes OK

    vi.mocked(listStatements).mockResolvedValueOnce([]);

    const result = await getStatementTelemetry([]);

    expect(result).toHaveLength(1);
    expect(result[0].cfus).toBe(4);
    expect(result[0].recordsIn).toBeNull();
    expect(result[0].recordsOut).toBe(50);
    expect(result[0].pendingRecords).toBeNull();
    expect(result[0].stateSizeBytes).toBe(2048);
  });

  it('should return empty array when all metrics fail', async () => {
    vi.mocked(telemetryClient.post).mockRejectedValue(new Error('network error'));
    vi.mocked(listStatements).mockResolvedValueOnce([]);

    const result = await getStatementTelemetry([]);
    expect(result).toEqual([]);
  });

  it('should merge multiple statements correctly', async () => {
    const multiResponse = (values: Record<string, number>) => ({
      data: {
        data: Object.entries(values).map(([name, value]) => ({
          resource: { flink: { statement_name: name } },
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

    vi.mocked(listStatements).mockResolvedValueOnce([]);

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
    vi.mocked(telemetryClient.post).mockResolvedValue({ data: { data: [] } });
    vi.mocked(listStatements).mockResolvedValueOnce([]);

    await getStatementTelemetry([]);

    expect(telemetryClient.post).toHaveBeenCalledTimes(5);
    const body = vi.mocked(telemetryClient.post).mock.calls[0][1];
    expect(body).toMatchObject({
      aggregations: [{ metric: 'io.confluent.flink/current_cfus' }],
      filter: {
        field: 'resource.compute_pool.id',
        op: 'EQ',
      },
      group_by: ['resource.flink.statement_name'],
    });
  });

  it('should handle listStatements failure gracefully', async () => {
    vi.mocked(telemetryClient.post).mockResolvedValue(
      mockTelemetryResponse('stmt-1', 3)
    );
    vi.mocked(listStatements).mockRejectedValueOnce(new Error('auth error'));

    const result = await getStatementTelemetry([]);

    expect(result).toHaveLength(1);
    expect(result[0].statementName).toBe('stmt-1');
    expect(result[0].cfus).toBe(3);
    expect(result[0].sql).toBeUndefined();
  });

  it('should tag workspace vs external statements', async () => {
    vi.mocked(telemetryClient.post).mockResolvedValue(
      (() => {
        const data = [
          { resource: { flink: { statement_name: 'ws-stmt' } }, value: 1 },
          { resource: { flink: { statement_name: 'ext-stmt' } }, value: 2 },
        ];
        return { data: { data } };
      })()
    );
    vi.mocked(listStatements).mockResolvedValueOnce([]);

    const result = await getStatementTelemetry(['ws-stmt']);

    const ws = result.find((r) => r.statementName === 'ws-stmt');
    const ext = result.find((r) => r.statementName === 'ext-stmt');
    expect(ws?.isWorkspaceStatement).toBe(true);
    expect(ext?.isWorkspaceStatement).toBe(false);
  });
});
