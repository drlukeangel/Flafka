import { telemetryClient, confluentClient } from './confluent-client';
import { env } from '../config/environment';
import type { StatementTelemetry } from '../types';
import type { StatementResponse } from './flink-api';

const TELEMETRY_WINDOW_MS = 3600000; // 1 hour

const METRICS = [
  { key: 'cfus', metric: 'io.confluent.flink/statement_utilization/current_cfus' },
  { key: 'recordsIn', metric: 'io.confluent.flink/num_records_in' },
  { key: 'recordsOut', metric: 'io.confluent.flink/num_records_out' },
  { key: 'pendingRecords', metric: 'io.confluent.flink/pending_records' },
  { key: 'stateSizeBytes', metric: 'io.confluent.flink/operator/state_size_bytes' },
] as const;

type MetricKey = typeof METRICS[number]['key'];

// One-time flag to avoid spamming descriptors call
let descriptorsFetched = false;

/**
 * Fetch available Flink metric descriptors from the Telemetry API.
 * Called once on first load to discover correct metric names and labels.
 */
async function fetchMetricDescriptors(): Promise<void> {
  if (descriptorsFetched) return;
  descriptorsFetched = true;
  try {
    const response = await telemetryClient.get('/v2/metrics/cloud/descriptors/metrics?resource_type=flink');
    if (import.meta.env.DEV) {
      console.log('[Telemetry] Available Flink metrics:', response.data);
    }
  } catch (err: unknown) {
    if (import.meta.env.DEV) {
      const e = err as { response?: { status?: number; data?: unknown } };
      console.warn('[Telemetry] Failed to fetch descriptors:', e.response?.status, e.response?.data);
    }
  }
}

function buildQueryBody(metric: string): object {
  const now = new Date();
  const start = new Date(now.getTime() - TELEMETRY_WINDOW_MS);
  return {
    aggregations: [{ metric }],
    filter: {
      field: 'resource.compute_pool.id',
      op: 'EQ',
      value: env.computePoolId,
    },
    group_by: ['resource.flink_statement.name'],
    granularity: 'PT1H',
    intervals: [`${start.toISOString()}/${now.toISOString()}`],
  };
}

async function fetchMetric(metric: string): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const body = buildQueryBody(metric);
  if (import.meta.env.DEV) console.log(`[Telemetry] Fetching ${metric}`, JSON.stringify(body));
  const response = await telemetryClient.post('/v2/metrics/cloud/query', body);
  const data = response.data?.data;
  if (import.meta.env.DEV) console.log(`[Telemetry] ${metric} →`, data?.length ?? 0, 'points', response.data);
  if (Array.isArray(data)) {
    for (const point of data) {
      // API returns flat key: "resource.flink_statement.name"
      const name = point['resource.flink_statement.name'];
      const value = point.value;
      if (name && typeof value === 'number') {
        // Keep the latest (highest) value per statement
        const existing = result.get(name);
        if (existing === undefined || value > existing) {
          result.set(name, value);
        }
      }
    }
  }
  return result;
}

// Fetch RUNNING statements on this compute pool
// Mirrors the Confluent Cloud UI approach: page_size=1000, time_ordered=true
// Then filter client-side by compute pool + RUNNING phase
async function fetchRunningStatements(): Promise<StatementResponse[]> {
  const base = `/sql/v1/organizations/${env.orgId}/environments/${env.environmentId}/statements`;
  const url = `${base}?page_size=1000&time_ordered=true`;
  const response = await confluentClient.get(url);
  const all: StatementResponse[] = response.data?.data || [];

  if (import.meta.env.DEV) {
    const phaseCounts: Record<string, number> = {};
    for (const s of all) {
      const p = s.status?.phase || 'undefined';
      phaseCounts[p] = (phaseCounts[p] || 0) + 1;
    }
    console.log(`[Dashboard] ${all.length} total statements, phases:`, phaseCounts);
    const runningOnPool = all.filter(
      s => s.status?.phase === 'RUNNING' && s.spec?.compute_pool_id === env.computePoolId
    ).map(s => s.name);
    if (runningOnPool.length) console.log('[Dashboard] RUNNING on pool:', runningOnPool);
  }

  // Filter: RUNNING phase on our compute pool
  return all.filter(
    (s) => s.status?.phase === 'RUNNING' && s.spec?.compute_pool_id === env.computePoolId
  );
}

export async function getStatementTelemetry(
  workspaceStatementNames: string[]
): Promise<StatementTelemetry[]> {
  // Kick off descriptor discovery (one-time, non-blocking)
  fetchMetricDescriptors();

  // Fetch only RUNNING statements on this compute pool
  const statementsMap = new Map<string, { sql?: string; createdAt?: string; phase?: string }>();
  try {
    const running = await fetchRunningStatements();
    for (const s of running) {
      statementsMap.set(s.name, {
        sql: s.spec?.statement,
        createdAt: s.metadata?.created_at,
        phase: s.status?.phase,
      });
    }
  } catch {
    return [];
  }

  if (statementsMap.size === 0) return [];

  // Supplemental: fetch telemetry metrics in parallel (partial failure OK)
  const maps: Record<MetricKey, Map<string, number>> = {
    cfus: new Map(),
    recordsIn: new Map(),
    recordsOut: new Map(),
    pendingRecords: new Map(),
    stateSizeBytes: new Map(),
  };

  try {
    const metricResults = await Promise.allSettled(
      METRICS.map(({ metric }) => fetchMetric(metric))
    );
    metricResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        maps[METRICS[index].key] = result.value;
      } else if (import.meta.env.DEV) {
        console.warn(`[Telemetry] Metric ${METRICS[index].metric} failed:`, result.reason);
      }
    });
  } catch {
    // Telemetry failure is non-fatal — we still show statements from listStatements
  }

  const wsNames = new Set(workspaceStatementNames);

  // Build results — all user statements (system ones already filtered by fetchByPhase)
  return Array.from(statementsMap.entries()).map(([name, meta]) => ({
    statementName: name,
    cfus: maps.cfus.get(name) ?? null,
    recordsIn: maps.recordsIn.get(name) ?? null,
    recordsOut: maps.recordsOut.get(name) ?? null,
    pendingRecords: maps.pendingRecords.get(name) ?? null,
    stateSizeBytes: maps.stateSizeBytes.get(name) ?? null,
    sql: meta.sql,
    createdAt: meta.createdAt,
    isWorkspaceStatement: wsNames.has(name),
  }));
}
