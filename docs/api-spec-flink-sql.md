# Confluent Cloud Flink SQL API — Statements Endpoint

**Discovered via live API testing 2026-03-03**

## GET List Statements

```
GET /sql/v1/organizations/{org_id}/environments/{env_id}/statements
```

### Query Parameters (tested)

| Parameter | Works | Type | Description |
|-----------|-------|------|-------------|
| `page_size` | YES | int | Max results per page (default ~100) |
| `page_token` | YES | string | Pagination cursor from `metadata.next` |
| `spec.compute_pool_id` | YES | string | Filter by compute pool ID (e.g., `lfcp-5k1zpn`) |
| `phase` | NO | - | **IGNORED** — returns all phases regardless |
| `status.phase` | NO | - | **IGNORED** — returns all phases regardless |

### Statement Response Schema

```json
{
  "name": "9itxypc-exec-udf",
  "spec": {
    "compute_pool_id": "lfcp-5k1zpn",
    "principal": "sa-gq05pdv",
    "statement": "INSERT INTO ...",
    "stopped": false,
    "properties": {
      "sql.current-catalog": "default",
      "sql.current-database": "cluster_0"
    }
  },
  "status": {
    "phase": "RUNNING",
    "detail": "",
    "scaling_status": {
      "last_updated": "2026-03-03T04:11:32Z",
      "scaling_state": "OK"
    },
    "traits": {
      "sql_kind": "INSERT_INTO",
      "is_append_only": true,
      "is_bounded": false,
      "schema": {}
    }
  },
  "metadata": {
    "created_at": "2026-03-03T04:11:20.197211Z",
    "updated_at": "2026-03-03T04:11:37.08754Z",
    "resource_version": "15"
  }
}
```

### Key Fields

| Field | Location | Values |
|-------|----------|--------|
| Phase | `status.phase` | `RUNNING`, `COMPLETED`, `FAILED`, `STOPPED`, `PENDING` |
| SQL Kind | `status.traits.sql_kind` | `INSERT_INTO`, `SELECT`, `CREATE_FUNCTION`, `CREATE_TABLE`, `DROP_TABLE`, `DROP_FUNCTION`, `SHOW_DATABASES`, `SHOW_CATALOGS` |
| SQL Text | `spec.statement` | Full SQL string |
| Pool ID | `spec.compute_pool_id` | e.g., `lfcp-5k1zpn` |
| Stopped | `spec.stopped` | `true`/`false` |
| Bounded | `status.traits.is_bounded` | `true` (batch) / `false` (streaming) |

### IMPORTANT: `spec.statement_type` DOES NOT EXIST

The statement type is at `status.traits.sql_kind`, NOT `spec.statement_type`.

### Statement Naming Patterns

| Prefix | Origin | sql_kind |
|--------|--------|----------|
| `cleanup-*` | System auto-cleanup | `DROP_TABLE`, `DROP_FUNCTION` |
| `bg-*` | Background/streaming queries | `SELECT` |
| User names | User-created | `INSERT_INTO`, `SELECT`, `CREATE_*` |

---

## Confluent Cloud Telemetry API

```
POST /v2/metrics/cloud/query
Host: api.telemetry.confluent.cloud
Auth: Basic (Cloud API key:secret)
```

### Request Body

```json
{
  "aggregations": [{ "metric": "io.confluent.flink/current_cfus", "agg": "SUM" }],
  "filter": {
    "field": "resource.compute_pool.id",
    "op": "EQ",
    "value": "lfcp-5k1zpn"
  },
  "group_by": ["resource.flink.statement_name"],
  "granularity": "PT1H",
  "intervals": ["2026-03-03T03:00:00.000Z/2026-03-03T04:00:00.000Z"]
}
```

### Required Fields

| Field | Required | Notes |
|-------|----------|-------|
| `aggregations[].metric` | YES | Metric name |
| `aggregations[].agg` | YES | `SUM`, `MIN`, or `MAX` |
| `granularity` | YES | `PT1M`..`P1D` or `ALL` |
| `intervals` | YES | ISO-8601 |

### Flink Metrics (discovered from Confluent Cloud UI)

| Metric | Description |
|--------|-------------|
| `io.confluent.flink/current_cfus` | CFU consumption |
| `io.confluent.flink/num_records_in` | Records consumed |
| `io.confluent.flink/num_records_out` | Records produced |
| `io.confluent.flink/pending_records` | Buffered records |
| `io.confluent.flink/operator/state_size_bytes` | State backend size |
