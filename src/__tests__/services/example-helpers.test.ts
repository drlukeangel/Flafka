import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTable } from '../../services/example-helpers';

// Mock the API
vi.mock('../../api/flink-api', () => ({
  executeSQL: vi.fn(),
  getStatementStatus: vi.fn(),
}));

import { executeSQL, getStatementStatus } from '../../api/flink-api';

const mockExecuteSQL = vi.mocked(executeSQL);
const mockGetStatementStatus = vi.mocked(getStatementStatus);

describe('[@example-helpers] createTable', () => {
  const onProgress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls executeSQL with the DDL and reports progress', async () => {
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-1' } as any);
    mockGetStatementStatus.mockResolvedValue({
      name: 'stmt-1',
      status: { phase: 'COMPLETED', detail: '' },
    } as any);

    await createTable('MY_TABLE', 'CREATE TABLE MY_TABLE (...)', onProgress);

    expect(onProgress).toHaveBeenCalledWith('Creating table MY_TABLE...');
    expect(mockExecuteSQL).toHaveBeenCalledWith('CREATE TABLE MY_TABLE (...)');
  });

  it('resolves when status becomes COMPLETED', async () => {
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-2' } as any);
    mockGetStatementStatus
      .mockResolvedValueOnce({ name: 'stmt-2', status: { phase: 'PENDING', detail: '' } } as any)
      .mockResolvedValueOnce({ name: 'stmt-2', status: { phase: 'COMPLETED', detail: '' } } as any);

    await expect(createTable('T', 'CREATE TABLE T (...)', onProgress)).resolves.toBeUndefined();
    expect(mockGetStatementStatus).toHaveBeenCalledTimes(2);
  });

  it('throws when status becomes FAILED', async () => {
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-3' } as any);
    mockGetStatementStatus.mockResolvedValue({
      name: 'stmt-3',
      status: { phase: 'FAILED', detail: 'Syntax error' },
    } as any);

    await expect(createTable('BAD', 'CREATE TABLE BAD (...)', onProgress)).rejects.toThrow('Syntax error');
  });

  it('throws generic error when FAILED has no detail', async () => {
    mockExecuteSQL.mockResolvedValue({ name: 'stmt-4' } as any);
    mockGetStatementStatus.mockResolvedValue({
      name: 'stmt-4',
      status: { phase: 'FAILED', detail: '' },
    } as any);

    await expect(createTable('BAD2', 'CREATE TABLE BAD2 (...)', onProgress)).rejects.toThrow('CREATE TABLE BAD2 failed');
  });
});
