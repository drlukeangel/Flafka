# Flafka API Layer Guide

This document covers every API client, function, and pattern in the Flafka project. It is intended as a comprehensive reference for developers who need to add new API calls, debug existing ones, or understand how the frontend communicates with Confluent Cloud services.

---

## Table of Contents

- [Overview](#overview)
- [API Clients](#api-clients)
- [Flink SQL API](#flink-sql-api)
- [ksqlDB API](#ksqldb-api)
- [Kafka REST Proxy API](#kafka-rest-proxy-api)
- [Schema Registry API](#schema-registry-api)
- [Artifact API](#artifact-api)
- [Telemetry API](#telemetry-api)
- [Proxy Configuration](#proxy-configuration)
- [Adding a New API Call](#adding-a-new-api-call)
- [Debugging Checklist](#debugging-checklist)

---

## Overview

### Request Flow

Every API call in Flafka follows this path:

```
React Component
  -> Zustand Store Action (workspaceStore / learnStore)
    -> API Function (src/api/*-api.ts)
      -> Axios Client Instance (src/api/*-client.ts)
        -> Vite Dev Proxy (vite.config.ts /api/* routes)
          -> Confluent Cloud Service (Flink, ksqlDB, Kafka, Schema Registry, etc.)
```

The Vite proxy is required because browsers block cross-origin requests to Confluent Cloud endpoints. In production, an nginx reverse proxy serves the same role.

### Authentication Pattern

All Confluent Cloud APIs use **HTTP Basic Auth**. The pattern is consistent across every client:

```typescript
const credentials = `${apiKey}:${apiSecret}`;
const encoded = btoa(credentials);
const header = `Basic ${encoded}`;
```

Credentials come from `VITE_*` environment variables, read once at module load time via `src/config/environment.ts`. Two clients (Kafka REST and Artifact) use a different pattern: they inject the auth header in a **request interceptor** so credentials are evaluated at call-time rather than module-load time. This means rotated keys take effect immediately without a page refresh.

**Credential scopes** -- different APIs use different key pairs:

| API Key Pair | Used By | Env Vars |
|---|---|---|
| Flink SQL API key | `confluentClient` | `VITE_FLINK_API_KEY` / `VITE_FLINK_API_SECRET` |
| Metrics / Cloud API key (SA-scoped) | `fcpmClient`, `telemetryClient`, `artifactClient` | `VITE_METRICS_KEY` / `VITE_METRICS_SECRET` |
| Schema Registry API key | `schemaRegistryClient` | `VITE_SCHEMA_REGISTRY_KEY` / `VITE_SCHEMA_REGISTRY_SECRET` |
| Kafka REST Proxy API key | `kafkaRestClient` | `VITE_KAFKA_API_KEY` / `VITE_KAFKA_API_SECRET` |
| ksqlDB API key | `ksqlClient` | `VITE_KSQL_API_KEY` / `VITE_KSQL_API_SECRET` |

### Environment Configuration

All environment variables are centralized in `src/config/environment.ts`. The `env` singleton is exported and used throughout the API layer. Required variables are validated at startup:

```typescript
// Required (app won't function without these):
VITE_ORG_ID, VITE_ENV_ID, VITE_COMPUTE_POOL_ID,
VITE_FLINK_API_KEY, VITE_FLINK_API_SECRET,
VITE_FLINK_CATALOG, VITE_FLINK_DATABASE

// Optional (features degrade gracefully):
VITE_SCHEMA_REGISTRY_URL, VITE_KAFKA_REST_ENDPOINT,
VITE_KSQL_ENDPOINT, VITE_METRICS_KEY, etc.
```

---

## API Clients

### Client Summary Table

| Client | File | Base URL | Target Service | Auth Injection | Timeout | Retry |
|---|---|---|---|---|---|---|
| `confluentClient` | `confluent-client.ts` | `/api/flink` | Flink SQL Gateway | Module-load header | default | 5xx retry |
| `fcpmClient` | `confluent-client.ts` | `/api/fcpm` | Confluent Cloud Management API | Module-load header | 15s | none |
| `telemetryClient` | `confluent-client.ts` | `/api/telemetry` | Confluent Telemetry API | Module-load header | 15s | none |
| `ksqlClient` | `ksql-client.ts` | `/api/ksql` | ksqlDB Cluster | Module-load header | default | 5xx retry |
| `kafkaRestClient` | `kafka-rest-client.ts` | `/api/kafka` | Kafka REST Proxy v3 | Per-request interceptor | 30s | none |
| `schemaRegistryClient` | `schema-registry-client.ts` | `/api/schema-registry` | Confluent Schema Registry | Module-load header | default | none |
| `artifactClient` | `artifact-client.ts` | `/api/artifact` | Confluent Artifact API | Per-request interceptor | 60s | 5xx retry |

### Retry Logic (`retryOn5xx`)

Three clients have automatic retry on transient server errors (HTTP 502, 503, 504):

- `confluentClient` (Flink SQL)
- `ksqlClient` (ksqlDB)
- `artifactClient` (Artifact/UDF)

The retry implementation is the same everywhere:

```typescript
function retryOn5xx(client: AxiosInstance, label: string) {
  client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const status = error.response?.status;
    const config = error.config;
    // Only retry 502, 503, 504
    if (!config || !status || status < 502 || status > 504) return Promise.reject(error);
    const retryCount = (config as { __retryCount?: number }).__retryCount ?? 0;
    if (retryCount >= 2) return Promise.reject(error);           // Max 2 retries
    (config as { __retryCount?: number }).__retryCount = retryCount + 1;
    const delay = (retryCount + 1) * 1500;                       // 1.5s, 3s
    await new Promise((r) => setTimeout(r, delay));
    return client.request(config);
  });
}
```

Key details:
- **Max 2 retries** (3 total attempts).
- **Linear backoff**: 1.5s after first failure, 3s after second.
- Only retries **gateway errors** (502/503/504). Does **not** retry 500 (server bug) or 4xx (client error).
- Retry count is stored on the Axios config object as `__retryCount` (survives request replay).

### Error Handling (`handleApiError`)

Defined in `confluent-client.ts`, this normalizes Axios errors into a consistent `ApiError` shape:

```typescript
export interface ApiError {
  status: number;
  message: string;
  details?: string;
}

export const handleApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const detail = data?.errors?.[0]?.detail ?? data?.detail;
    return {
      status: error.response?.status || 500,
      message: data?.message || error.message,
      details: detail,
    };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : 'Unknown error',
  };
};
```

This is used by **Flink API functions only**. The ksqlDB API has its own `handleKsqlError` (see below). Kafka REST, Schema Registry, and Artifact APIs let Axios errors propagate directly (with logging interceptors).

### Dev-Only Logging

Every client has request and response interceptors guarded by `import.meta.env.DEV`. In production builds, Vite tree-shakes these away. In dev, you'll see console output like:

```
[API] POST /sql/v1/organizations/.../statements
[API Response] 200 { name: "wobbling-penguin-a3f", ... }
[ksqlDB] POST /ksql
[Kafka REST] GET /kafka/v3/clusters/.../topics
[Schema Registry] GET /subjects
```

---

## Flink SQL API

**File:** `src/api/flink-api.ts`
**Client:** `confluentClient` (and `fcpmClient` for compute pool status)

### Statement Lifecycle

Flink SQL execution is **asynchronous**. You POST a SQL string and get back a statement name, then poll until it finishes.

```
1. executeSQL(sql)           -> POST /statements     -> { name, status.phase: "PENDING" }
2. getStatementStatus(name)  -> GET  /statements/{n} -> { status.phase: "RUNNING" }
3. getStatementStatus(name)  -> GET  /statements/{n} -> { status.phase: "COMPLETED" }
4. getStatementResults(name) -> GET  /statements/{n}/results -> { results.data, metadata.next }
5. getStatementResults(name, nextUrl) -> GET {nextUrl} -> next page of results
```

#### Phase Transitions

```
PENDING -> RUNNING -> COMPLETED   (bounded/batch queries)
PENDING -> RUNNING -> ...forever  (streaming queries -- stays RUNNING until cancelled)
PENDING -> RUNNING -> FAILED      (execution error)
        -> CANCELLED              (user cancelled via DELETE)
```

#### `executeSQL(sql, name?, sessionProperties?)`

Submits a SQL string to the Flink SQL gateway.

```typescript
const payload = {
  name: statementName,          // Auto-generated "wobbling-penguin-a3f" if omitted
  spec: {
    statement: sql,
    compute_pool_id: env.computePoolId,
    properties: {
      'sql.current-catalog': env.flinkCatalog,
      'sql.current-database': env.flinkDatabase,
      ...filterSessionProperties(sessionProperties),
    },
  },
};
```

Session properties are filtered through a `VALID_SESSION_PROPERTIES` allowlist before being sent. This prevents invalid properties from causing server-side 400 errors. The allowlist includes `sql.current-catalog`, `sql.current-database`, `sql.tables.scan.*`, `sql.state-ttl`, `sql.local-time-zone`, and a few others.

#### `getStatementResults(statementName, nextUrl?)`

Fetches result rows using **cursor-based pagination**.

- **First call** (no `nextUrl`): Hits `/statements/{name}/results`. If the first response is empty but has `metadata.next`, the function automatically follows the cursor once to get the initial batch.
- **Subsequent calls**: Pass `metadata.next` from the previous response. For streaming queries, this acts as a **long-poll** -- the server holds the connection until new rows are available.
- Cursor URLs come back as full absolute URLs (e.g., `https://flink.us-east-1.aws.confluent.cloud/sql/v1/...`). The function extracts just the `pathname + search` so it routes through the Vite proxy.

#### `pollForResults(statementName, maxAttempts?, intervalMs?)`

Convenience wrapper that polls `getStatementStatus` in a loop until COMPLETED or FAILED, then fetches results. Used by catalog introspection functions (`getCatalogs`, `getDatabases`, `getTables`, etc.).

- Default: 60 attempts, 1-second interval (1-minute timeout).
- Returns `unknown[][]` -- an array of rows, each row being an array of cell values.

#### `listStatements(pageSize?, onPage?, maxResults?, filterUniqueId?)`

Fetches **all** statements by following pagination automatically. The `onPage` callback fires after each page with a running accumulation of all results, enabling progressive rendering in the History panel.

`listStatementsFirstPage()` is a lighter variant that fetches only the first page (one API call) for quick refresh use cases.

#### Catalog Introspection

These functions use `executeSQL` + `pollForResults` internally to run SHOW/DESCRIBE commands:

| Function | SQL Executed | Returns |
|---|---|---|
| `getCatalogs()` | `SHOW CATALOGS` | `string[]` |
| `getDatabases(catalog)` | `SHOW DATABASES IN \`catalog\`` | `string[]` |
| `getTables(catalog, db)` | `SHOW TABLES IN \`catalog\`.\`db\`` | `string[]` |
| `getViews(catalog, db)` | `SHOW VIEWS IN \`catalog\`.\`db\`` | `string[]` |
| `getFunctions(catalog, db)` | `SHOW USER FUNCTIONS IN \`catalog\`.\`db\`` | `string[]` |
| `getTableSchema(catalog, db, table)` | `DESCRIBE \`catalog\`.\`db\`.\`table\`` | `Column[]` |

These all catch errors and return sensible defaults (e.g., the configured catalog/database from env) so the tree navigator degrades gracefully.

#### Statement Error Detail

Two functions provide error information:

- `getStatementExceptions(name)` -- fetches the `/statements/{name}/exceptions` endpoint for detailed error logs (exception class names, stack traces, timestamps). Returns `null` if no exceptions.
- `getStatementErrorDetail(name, detail?)` -- returns `detail` if provided (from `status.detail`), otherwise falls back to `getStatementExceptions`.

#### Compute Pool Status

```typescript
getComputePoolStatus()  // Uses fcpmClient, not confluentClient
// -> GET /fcpm/v2/compute-pools/{poolId}?environment={envId}
// Returns: { phase: string, currentCfu: number, maxCfu: number }
```

---

## ksqlDB API

**Files:** `src/api/ksql-client.ts` (Axios client), `src/api/ksql-api.ts` (API functions)

### How It Differs from Flink

| Aspect | Flink SQL | ksqlDB |
|---|---|---|
| Execution model | Async (POST -> poll -> results) | Sync for DDL/DML, streaming for queries |
| Content-Type | `application/json` | `application/vnd.ksql.v1+json` |
| Endpoints | `/sql/v1/.../statements` | `/ksql` (DDL/DML), `/query` (queries) |
| Statement lifecycle | Server-managed (name, phases) | Client-managed (fire and forget) |
| Auth header | `Authorization: Basic ...` | Same, but ksqlDB proxy also strips `Origin`/`Referer` |

### Two Endpoints

1. **`POST /ksql`** -- DDL, DML, SHOW, DESCRIBE, TERMINATE. Synchronous via Axios. Returns `KsqlStatementResponse[]`.
2. **`POST /query`** -- Push queries (`EMIT CHANGES`) and pull queries. Uses **`fetch()` + `ReadableStream`**, not Axios (because Axios doesn't support streaming response bodies in the browser).

### `executeKsql(sql, streamsProperties?)`

Sends DDL/DML to the `/ksql` endpoint:

```typescript
const body = { ksql: sql, streamsProperties: { ... } };
const response = await ksqlClient.post<KsqlStatementResponse[]>('/ksql', body);
```

Error handling is two-phase:
1. Axios throws on 4xx/5xx -- the catch block extracts the ksqlDB error from the response body.
2. Even 2xx responses can contain errors -- the function checks each item in the response array for `@type: 'statement_error'` or `commandStatus.status === 'ERROR'`.

### `executeKsqlQuery(sql, streamsProperties?, onRow?, abortSignal?)`

Runs push/pull queries via streaming. This is the most complex function in the API layer.

```typescript
// Uses native fetch, not Axios
const response = await fetch(`${KSQL_FETCH_BASE}/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/vnd.ksql.v1+json',
    'Authorization': getKsqlAuthHeader(),
  },
  body: JSON.stringify({ ksql: sql, streamsProperties }),
  signal: abortSignal,   // AbortController for cancellation
});

const reader = response.body.getReader();
// Read chunks, split by newline, parse JSON lines
```

The response is a **JSON array streamed line-by-line**:

```json
[
  {"schema": "`COL1` STRING, `COL2` INTEGER", "queryId": "q123"},
  {"row": {"columns": ["hello", 42]}},
  {"row": {"columns": ["world", 99]}},
  ...
  {"finalMessage": "Limit Reached"}
]
```

Key behaviors:
- **Header line**: First JSON object contains `schema` (column definitions as a ksqlDB schema string) and optional `queryId`. Parsed by `parseKsqlSchema()`.
- **Data rows**: Objects with `row.columns` array. Mapped to `Record<string, unknown>` using column names from the header.
- **FIFO buffer**: At most `MAX_ROWS` (5000) rows are kept in memory. Older rows are dropped.
- **`onRow` callback**: Called after each row with the current state (`columns`, `rows`, `queryId`, `totalRowsReceived`).
- **AbortError handling**: Caught and silently ignored (expected when push queries are cancelled).
- **In-band errors**: `errorMessage` objects in the stream throw immediately.

### `terminateQuery(queryId, retries?)`

Terminates a persistent ksqlDB query (e.g., a running CSAS/CTAS) with exponential backoff retry:

```typescript
// Retry schedule: 2s, 4s, 8s (exponential backoff)
const delay = 2000 * Math.pow(2, attempt);
```

Only retries on "command topic" timeout errors (the ksqlDB cluster's internal command topic can be slow under load). Other errors fail immediately.

### Three ksqlDB Error Formats

The `handleKsqlError(data)` function normalizes three distinct error shapes:

```typescript
// Format 1: DDL/DML command error (inside 2xx response)
{ commandStatus: { status: "ERROR", message: "Table already exists" } }

// Format 2: Statement error (can appear in 2xx or 4xx response)
{ "@type": "statement_error", error_code: 40001, message: "Line 1:1 ..." }

// Format 3: HTTP-level error (4xx/5xx response body)
{ error_code: 40100, message: "Unauthorized" }
```

The function checks all three shapes and also recurses into arrays (since the `/ksql` endpoint returns an array). Returns `{ message, errorCode? }`.

### Schema Parsing

`parseKsqlSchema(schemaStr)` converts ksqlDB schema strings into `Column[]`:

```
Input:  "`COL1` STRING, `COL2` INTEGER, `COL3` STRUCT<`F1` STRING, `F2` INT>"
Output: [{ name: "COL1", type: "STRING" }, { name: "COL2", type: "INTEGER" }, ...]
```

Handles nested types (STRUCT, ARRAY, MAP) by tracking angle-bracket depth so commas inside `<...>` are not treated as column separators.

---

## Kafka REST Proxy API

**Files:** `src/api/kafka-rest-client.ts` (client), `src/api/topic-api.ts` (functions)

All endpoints are scoped to a single Kafka cluster via `clusterPath()`:

```typescript
const clusterPath = () => `/kafka/v3/clusters/${env.kafkaClusterId}`;
```

### Topic Operations

| Function | Method | Path | Returns |
|---|---|---|---|
| `listTopics(filterUniqueId?)` | GET | `/kafka/v3/clusters/{id}/topics` | `KafkaTopic[]` |
| `getTopicDetail(topicName)` | GET | `.../topics/{name}` | `KafkaTopic` |
| `createTopic(request)` | POST | `.../topics` | `KafkaTopic` |
| `deleteTopic(topicName)` | DELETE | `.../topics/{name}` | `void` |

`listTopics` filters out system topics (those matching `^(_schemas.*|_confluent-.*|__confluent[-.].*)`) and optionally narrows to topics containing a `filterUniqueId` string for multi-user session isolation.

### Config Management

| Function | Method | Path | Returns |
|---|---|---|---|
| `getTopicConfigs(topicName, signal?)` | GET | `.../topics/{name}/configs` | `TopicConfig[]` |
| `alterTopicConfig(topicName, configName, value)` | POST | `.../topics/{name}/configs:alter` | `void` |

`getTopicConfigs` accepts an optional `AbortSignal` for request cancellation (used in React `useEffect` cleanup).

### Partition Info

| Function | Method | Path | Returns |
|---|---|---|---|
| `getTopicPartitions(topicName)` | GET | `.../topics/{name}/partitions` | `KafkaPartition[]` |
| `getPartitionOffsets(topicName, partitionId)` | GET | `.../topics/{name}/partitions/{id}/offsets` | `PartitionOffsets` |

### Record Production

```typescript
produceRecord(topicName, record, signal?)
// POST /kafka/v3/clusters/{id}/topics/{name}/records
```

The `record` object follows the Kafka REST Proxy v3 format with `key` (optional), `value` (with `type` and `data` fields), and optional `partition_id`.

---

## Schema Registry API

**Files:** `src/api/schema-registry-client.ts` (client), `src/api/schema-registry-api.ts` (functions)

Content-Type: `application/vnd.schemaregistry.v1+json`

The Schema Registry response interceptor **suppresses 404 error logging** because 404s are expected for subject-level config lookups (the code falls back to global config).

### Subject Management

| Function | Method | Path | Returns |
|---|---|---|---|
| `listSubjects(filterUniqueId?)` | GET | `/subjects` | `string[]` |
| `getSchemaDetail(subject, version?, options?)` | GET | `/subjects/{s}/versions/{v}` | `SchemaSubject` |
| `getSchemaVersions(subject)` | GET | `/subjects/{s}/versions` | `number[]` |
| `registerSchema(subject, schema, schemaType)` | POST | `/subjects/{s}/versions` | `{ id: number }` |
| `deleteSubject(subject)` | DELETE | `/subjects/{s}` | `number[]` |
| `deleteSchemaVersion(subject, version)` | DELETE | `/subjects/{s}/versions/{v}` | `number` |

#### AVRO Default Quirk

`getSchemaDetail` normalizes the response: the Schema Registry API **omits `schemaType`** when the type is AVRO (since AVRO is the default). The function sets `schemaType = 'AVRO'` explicitly so callers can always rely on it being present.

#### Auto-Tagging for Multi-User Isolation

`registerSchema` automatically appends a session tag suffix to the subject name:

```typescript
const suffix = `-${getSessionTag()}`;
const finalSubject = subject.endsWith(suffix) ? subject : `${subject}${suffix}`;
```

This means each user's schemas are namespaced, and `listSubjects(filterUniqueId)` returns only their own schemas.

### Compatibility Mode

| Function | Method | Returns |
|---|---|---|
| `getCompatibilityMode(subject)` | GET `/config/{s}` | `CompatibilityLevel` |
| `getCompatibilityModeWithSource(subject)` | GET `/config/{s}` | `{ level, isGlobal }` |
| `setCompatibilityMode(subject, level)` | PUT `/config/{s}` | `{ compatibility }` |
| `validateCompatibility(subject, schema, type, version?)` | POST `/compatibility/subjects/{s}/versions/{v}` | `{ is_compatible }` |

Both `getCompatibilityMode` and `getCompatibilityModeWithSource` try subject-level config first. On 404, they fall back to `GET /config` (global default). The `WithSource` variant also returns `isGlobal: boolean` so the UI can show "inherited" vs "custom" badges.

### Reverse Lookup

```typescript
getSubjectsForSchemaId(id, options?)
// GET /schemas/ids/{id}/subjects -> string[]
```

Finds all subjects referencing a specific schema ID. Useful for understanding which topics share the same schema definition.

---

## Artifact API

**Files:** `src/api/artifact-client.ts` (client), `src/api/artifact-api.ts` (functions)

The Artifact API manages Flink UDFs (user-defined functions) -- JAR/ZIP files uploaded to Confluent Cloud.

### UDF Lifecycle

```
1. getPresignedUploadUrl('JAR')     -> POST /artifact/v1/presigned-upload-url
2. uploadFileToPresignedUrl(url, file) -> POST to S3 presigned URL
3. createArtifact(request)           -> POST /artifact/v1/flink-artifacts
4. listArtifacts() / deleteArtifact() for management
```

### Functions

| Function | Method | Path | Returns |
|---|---|---|---|
| `listArtifacts(filterUniqueId?)` | GET | `/v1/flink-artifacts` | `FlinkArtifact[]` |
| `getArtifact(artifactId)` | GET | `/v1/flink-artifacts/{id}` | `FlinkArtifact` |
| `getPresignedUploadUrl(format?)` | POST | `/v1/presigned-upload-url` | `PresignedUploadUrlResponse` |
| `uploadFileToPresignedUrl(...)` | POST | S3 presigned URL (not proxied) | `void` |
| `createArtifact(request)` | POST | `/v1/flink-artifacts` | `FlinkArtifact` |
| `deleteArtifact(artifactId)` | DELETE | `/v1/flink-artifacts/{id}` | `void` |

All list/get/create calls pass `cloud`, `region`, and `environment` as query params or body fields.

### Presigned URL Upload Flow

The upload uses **S3 POST form upload** with policy fields:

```typescript
const formData = new FormData();
// Add all S3 policy fields first (order matters)
Object.entries(presignedResponse.upload_form_data).forEach(([key, value]) => {
  formData.append(key, value);
});
// File MUST be the last field
formData.append('file', file);

await fetch(presignedResponse.upload_url, {
  method: 'POST',
  body: formData,
  mode: 'no-cors',        // CORS blocks reading S3 response, but upload succeeds
  signal: abortSignal,
});
```

Key detail: The upload uses **`mode: 'no-cors'`**. The browser CAN reach S3 and the upload goes through, but CORS blocks reading the response. This is fine for uploads -- success is verified by polling the artifact API afterward.

### CORS Fallback (S3 Upload Proxy)

For cases where `no-cors` is insufficient, `vite.config.ts` includes a custom Vite plugin (`s3-upload-proxy`) that acts as a server-side proxy at `/api/s3-upload-proxy`. It reads the target S3 URL from the `X-Target-Url` header and forwards the multipart body server-side, avoiding CORS entirely.

---

## Telemetry API

**File:** `src/api/telemetry-api.ts`
**Client:** `telemetryClient` (from `confluent-client.ts`)

The Telemetry API powers the compute pool dashboard, showing per-statement resource usage.

### Metrics Collected

| Key | Metric Name | Description |
|---|---|---|
| `cfus` | `io.confluent.flink/statement_utilization/current_cfus` | CFU usage per statement |
| `recordsIn` | `io.confluent.flink/num_records_in` | Records consumed |
| `recordsOut` | `io.confluent.flink/num_records_out` | Records produced |
| `pendingRecords` | `io.confluent.flink/pending_records` | Records pending processing |
| `stateSizeBytes` | `io.confluent.flink/operator/state_size_bytes` | Flink operator state size |

### `getStatementTelemetry(workspaceStatementNames)`

Main entry point. Does three things:

1. **Fetches RUNNING statements** on the current compute pool (using `confluentClient`, not `telemetryClient`) with `page_size=1000`.
2. **Fetches all 5 metrics in parallel** using `Promise.allSettled` -- partial failure is OK, the dashboard still renders what it can.
3. **Merges** statement metadata with metric values, returning `StatementTelemetry[]`.

Each metric query uses a 1-hour window and groups by `resource.flink_statement.name`:

```typescript
{
  aggregations: [{ metric: 'io.confluent.flink/...' }],
  filter: { field: 'resource.compute_pool.id', op: 'EQ', value: env.computePoolId },
  group_by: ['resource.flink_statement.name'],
  granularity: 'PT1H',
  intervals: [`${start.toISOString()}/${now.toISOString()}`],
}
```

### Metric Descriptors

`fetchMetricDescriptors()` calls `GET /v2/metrics/cloud/descriptors/metrics?resource_type=flink` once on first load to discover available metric names. This is a diagnostic/discovery call -- the actual metric names are hardcoded in the `METRICS` array.

---

## Proxy Configuration

### Development: Vite Proxy

All proxy routes are defined in `vite.config.ts` under `server.proxy`:

| Local Path | Target | Rewrite Rule |
|---|---|---|
| `/api/flink` | `https://flink.{region}.{provider}.confluent.cloud` | Strip `/api/flink` prefix |
| `/api/fcpm` | `https://api.confluent.cloud` | Rewrite `/api/fcpm` to `/fcpm` |
| `/api/schema-registry` | `$VITE_SCHEMA_REGISTRY_URL` | Strip `/api/schema-registry` prefix |
| `/api/artifact` | `https://api.confluent.cloud` | Rewrite `/api/artifact` to `/artifact` |
| `/api/kafka` | `$VITE_KAFKA_REST_ENDPOINT` | Strip `/api/kafka` prefix |
| `/api/ksql` | `$VITE_KSQL_ENDPOINT` | Strip `/api/ksql` prefix |
| `/api/telemetry` | `https://api.telemetry.confluent.cloud` | Strip `/api/telemetry` prefix |

Every proxy route:
1. Sets `changeOrigin: true` (spoofs the Host header to match the target).
2. Forwards the `Authorization` header from the original request.
3. Strips the `/api/XXX` prefix so the target sees the real API path.

The ksqlDB proxy has an extra step -- it **removes `Origin` and `Referer` headers** because ksqlDB enforces CORS and rejects requests with browser origin headers.

### S3 Upload Proxy (Custom Plugin)

A custom Vite plugin named `s3-upload-proxy` is registered as server middleware at `/api/s3-upload-proxy`. It accepts POST requests with an `X-Target-Url` header containing the S3 presigned URL, and forwards the request body server-side. This avoids CORS issues with direct S3 uploads.

### Production: nginx

In production, an nginx reverse proxy replaces the Vite dev proxy. The same path prefixes (`/api/flink`, `/api/ksql`, etc.) are mapped to the corresponding Confluent Cloud endpoints using `proxy_pass` with environment variable substitution. The exact nginx config is outside this codebase but follows the same routing pattern.

---

## Adding a New API Call

Here is the step-by-step process for adding a new API call:

### 1. Identify the Right Client

Check the [Client Summary Table](#client-summary-table). If your call goes to an existing service, use the existing client. If it's a new service, create a new client file following the pattern in `kafka-rest-client.ts` (per-request auth) or `schema-registry-client.ts` (module-load auth).

### 2. Add the API Function

Create or extend a `*-api.ts` file. Follow the existing pattern:

```typescript
import { someClient } from './some-client';
import { env } from '../config/environment';

export async function myNewFunction(param: string): Promise<MyType> {
  const response = await someClient.get<MyType>(
    `/v1/some-endpoint/${encodeURIComponent(param)}`
  );
  return response.data;
}
```

Always `encodeURIComponent()` user-supplied path segments.

### 3. Add Proxy Route (if new service)

If your API call targets a new Confluent Cloud service, add a proxy entry in `vite.config.ts`:

```typescript
'/api/my-service': {
  target: env.VITE_MY_SERVICE_URL || 'http://localhost',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/my-service/, ''),
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq, req) => {
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization)
      }
    })
  }
}
```

### 4. Add Environment Variables

Add any new `VITE_*` vars to `src/config/environment.ts` in both the `EnvironmentConfig` interface and the `getEnv()` function. Add them to the `requiredVars` array if the app cannot function without them.

### 5. Wire to the Store

Call your API function from a Zustand store action in `workspaceStore.ts` (or the appropriate store). Components should never call API functions directly.

---

## Debugging Checklist

When an API call fails, check these in order:

1. **Browser DevTools Network tab** -- Is the request reaching the Vite proxy? Look for `/api/flink/...` or `/api/ksql/...` requests.

2. **Console logs** -- All clients log in dev mode. Look for `[API]`, `[ksqlDB]`, `[Kafka REST]`, `[Schema Registry]`, `[Telemetry]`, or `[Artifact API]` prefixes.

3. **Proxy rewriting** -- Is the path being rewritten correctly? A request to `/api/flink/sql/v1/...` should hit `https://flink.{region}.{provider}.confluent.cloud/sql/v1/...`. Check the Vite terminal for proxy logs.

4. **Auth headers** -- Is the `Authorization` header being forwarded? Some proxies strip it. Check the `configure` callback in `vite.config.ts`.

5. **CORS** -- If you see CORS errors, the request is probably bypassing the proxy. Check the base URL in the client -- it should be a relative path like `/api/flink`, not an absolute URL.

6. **Cursor URLs** -- Flink SQL returns absolute cursor URLs in `metadata.next` (e.g., `https://flink.us-east-1...`). These must be converted to relative paths before passing to Axios, or they'll bypass the proxy. Check `getStatementResults` and `listStatements` for the pattern.

7. **ksqlDB push queries** -- These use `fetch()`, not Axios. The `getKsqlAuthHeader()` and `KSQL_FETCH_BASE` exports from `ksql-client.ts` provide the auth header and base URL for fetch calls.

8. **5xx retries** -- If you're seeing repeated 502/503/504 errors, the retry logic will attempt 3 total calls with 1.5s/3s delays. Check the console for retry warnings like `[API] 502 -- retrying in 1500ms (attempt 1/2)`.

9. **Environment variables** -- Missing or empty `VITE_*` vars cause silent failures. Check the browser console at startup for `Missing required environment variables: ...`.

10. **Chrome cache** -- Chrome aggressively caches Vite dev server ES modules on localhost. If code changes don't seem to take effect, use an incognito window or Playwright headless for testing.
