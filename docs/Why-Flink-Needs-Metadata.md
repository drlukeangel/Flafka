# Feature Request: Dynamic Topic Routing via Metadata Sink Columns in Confluent Cloud Flink SQL

**Author:** Flafka Engineering
**Date:** 2026-03-07
**Target Audience:** Confluent Product & Engineering Teams
**Classification:** Feature Request / Gap Analysis
**Severity:** High — blocks a core streaming pattern with no viable workaround on Confluent Cloud

---

## Executive Summary

Confluent Cloud Flink SQL supports `METADATA FROM '<key>'` column syntax — but the `ConfluentManagedTableSink` restricts writable metadata keys to only `headers` and `timestamp`. The `topic` key, which enables per-row dynamic topic routing in open-source Apache Flink, is explicitly excluded. This blocks a fundamental streaming pattern — **dynamic topic routing** — where a single Flink SQL statement routes events to multiple Kafka topics based on data-driven rules. The infrastructure is in place (the syntax parses, column ordering is enforced, metadata keys are validated against the sink), but `topic` is not whitelisted. On Confluent Cloud, achieving the same outcome requires N+1 running statements (each billed as a separate CFU), making the cost model untenable at scale. This document details the pattern, the gap (with exact error messages from live testing), the workaround cost, and a concrete proposal for resolution.

---

## Table of Contents

1. [The Pattern: Dynamic Event Routing with Fan-Out](#1-the-pattern-dynamic-event-routing-with-fan-out)
2. [The Problem: `topic` Is Not a Writable Metadata Key](#2-the-problem-topic-is-not-a-writable-metadata-key)
3. [The Workaround: N+1 Statements](#3-the-workaround-n1-statements)
4. [Cost Analysis: Flink vs. ksqlDB](#4-cost-analysis-flink-vs-ksqldb)
5. [What We Are Asking For](#5-what-we-are-asking-for)
6. [Appendix A: Complete Flink SQL Implementation (Confluent Cloud)](#appendix-a-complete-flink-sql-implementation-confluent-cloud)
7. [Appendix B: Ideal Implementation with METADATA Columns](#appendix-b-ideal-implementation-with-metadata-columns)
8. [Appendix C: ksqlDB Equivalent Implementation](#appendix-c-ksqldb-equivalent-implementation)
9. [Appendix D: Sample Datasets](#appendix-d-sample-datasets)
10. [Appendix E: Routing Rules Configuration](#appendix-e-routing-rules-configuration)

---

## 1. The Pattern: Dynamic Event Routing with Fan-Out

### Business Context

In mortgage and loan servicing, lifecycle events (originations, payments, modifications, foreclosures, terminations) flow through a central event stream. Multiple downstream departments need subsets of these events in real time:

- **Underwriting** needs new loan applications
- **Finance** needs payment and origination events
- **Collections** needs foreclosure and termination events

The routing rules change over time. Compliance requirements shift, new departments come online, existing departments need additional event types. The routing configuration must be updatable at runtime without redeploying any streaming jobs.

### The Architecture

The pattern has three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Event Stream                                          │
│  ┌─────────────┐                                                │
│  │ LOAN-EVENTS │  Append-only stream of lifecycle events        │
│  │ (Kafka topic)│  Fields: event_id, loan_id, event_type,       │
│  └──────┬──────┘  amount, department, created_at                │
│         │                                                        │
│  Layer 2: Routing Engine                                         │
│         │         ┌───────────────┐                              │
│         ├────────►│ ROUTING-RULES │  Compacted topic (upsert)   │
│         │         │ (Kafka topic) │  KEY: event_type             │
│         │         └───────┬───────┘  VAL: target_topics ARRAY   │
│         │                 │                                      │
│         ▼                 ▼                                      │
│  ┌──────────────────────────────┐                                │
│  │  TEMPORAL JOIN + UNNEST      │  Single Flink SQL statement    │
│  │  Matches each event to its   │  Explodes target_topics array  │
│  │  routing rule, fans out to   │  into one row per destination  │
│  │  N rows (one per target)     │                                │
│  └──────────────┬───────────────┘                                │
│                 │                                                │
│  Layer 3: Destination Topics                                     │
│                 │                                                │
│         ┌───────┼───────┐                                        │
│         ▼       ▼       ▼                                        │
│  ┌──────────┐ ┌─────┐ ┌────────────┐                            │
│  │UNDERWRITE│ │FINAN│ │COLLECTIONS │   Physical Kafka topics     │
│  │ING       │ │CE   │ │            │                             │
│  └──────────┘ └─────┘ └────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Pattern Matters

1. **Routing logic is data-driven.** Adding a new destination or changing which events go where is a data change (upsert to the routing-rules topic), not a code change.
2. **Fan-out is automatic.** One event can route to multiple destinations simultaneously. A `NEW_LOAN` event going to both Underwriting and Finance is expressed as `target_topics: ['underwriting', 'finance']` in the routing rule.
3. **Single query.** The entire routing engine is one SQL statement. There is one place to monitor, one place to debug, one unit of compute.

---

## 2. The Problem: `topic` Is Not a Writable Metadata Key

### How It Should Work

In open-source Apache Flink with the Kafka connector, a table can declare a `METADATA` column that maps to Kafka record metadata — specifically, the target topic:

```sql
CREATE TABLE routed_events_sink (
  `key`        BYTES,
  event_id     STRING,
  loan_id      STRING,
  event_type   STRING,
  amount       DOUBLE,
  department   STRING,
  target_topic STRING METADATA FROM 'topic'   -- ← Kafka target topic
) WITH (
  'connector' = 'kafka',
  'properties.bootstrap.servers' = 'broker:9092',
  'format' = 'json'
)
```

When Flink writes a row to this table, it reads the `target_topic` column value and uses it as the Kafka target topic for that specific record. Each row can go to a different topic. **One INSERT statement, unlimited destination topics, zero hardcoding.**

The complete routing engine becomes:

```sql
INSERT INTO routed_events_sink
SELECT
  CAST(e.event_id AS BYTES) AS `key`,
  e.event_id, e.loan_id, e.event_type, e.amount, e.department,
  t.target_topic
FROM loan_events e
JOIN routing_rules FOR SYSTEM_TIME AS OF e.`$rowtime` AS r
  ON e.event_type = r.event_type
CROSS JOIN UNNEST(r.target_topics) AS t(target_topic)
```

**One statement. One CFU. Routes to N topics. Fully dynamic.**

### What Actually Happens on Confluent Cloud (Tested 2026-03-07)

We systematically tested every variation of `METADATA` column syntax on Confluent Cloud Flink SQL. The results reveal that METADATA columns *are* partially supported — but `topic` is specifically excluded from the writable set.

#### Attempt 1: Open-Source Syntax (`METADATA NOT NULL`)

```sql
CREATE TABLE `routed-events` (
  target_topic STRING METADATA NOT NULL,
  ...
)
```

**Error:**
```
SQL parse failed. Encountered "NOT" at line 2, column 27.
Was expecting one of: "FROM" ... "COMMENT" ... "VIRTUAL" ... ")" ... "," ...
```

The bare `METADATA` keyword without `FROM` is not supported. The parser expects `METADATA FROM '<key>'` syntax.

#### Attempt 2: Correct Syntax (`METADATA FROM 'topic'`), Wrong Column Position

```sql
CREATE TABLE `routed-events` (
  target_topic STRING METADATA FROM 'topic',
  `key`        BYTES,
  event_id     STRING,
  ...
)
```

**Error:**
```
Physical columns must appear before any metadata and computed columns.
```

The `METADATA FROM` syntax IS recognized — the error is about column ordering, not syntax. Metadata columns must appear after all physical columns.

#### Attempt 3: Correct Syntax, Correct Position — The Smoking Gun

```sql
CREATE TABLE `routed-events` (
  `key`          BYTES,
  event_id       STRING,
  loan_id        STRING,
  event_type     STRING,
  amount         DOUBLE,
  department     STRING,
  target_topic   STRING METADATA FROM 'topic'
)
```

**Error:**
```
Invalid metadata key 'topic' in column 'target_topic' of table
'default.cluster_0.routed-events-laser-quokka-f696969'.
The DynamicTableSink class 'io.confluent.flink.table.connectors.ConfluentManagedTableSink'
supports the following metadata keys for writing: headers, timestamp
```

### The Finding

Confluent Cloud's Flink SQL **does** support `METADATA FROM '<key>'` columns. The syntax parses. The column ordering rules are enforced. The infrastructure validates metadata keys against the sink connector. But the `ConfluentManagedTableSink` — the only sink class available on Confluent Cloud — **only allows two writable metadata keys:**

| Metadata Key | Writable | Description |
|---|---|---|
| `headers` | Yes | Kafka record headers |
| `timestamp` | Yes | Kafka record timestamp |
| `topic` | **No** | Kafka target topic — **explicitly excluded** |

This is not a missing feature in the parser or the DDL surface. The plumbing is there. The `topic` metadata key is simply not whitelisted in `ConfluentManagedTableSink`. This is likely a deliberate product decision — Confluent Cloud manages topic-to-table bindings, and allowing per-row topic routing would bypass that managed layer.

**The result: the single-statement dynamic routing pattern is architecturally possible but product-blocked on Confluent Cloud Flink SQL.**

---

## 3. The Workaround: N+1 Statements

### Architecture With the Workaround

Without `METADATA` columns, we must:

1. Write all fan-out rows to an intermediate `ROUTED-EVENTS` table with a `target_topic` STRING column (a regular data column, not a metadata binding).
2. For each destination topic, spin up a separate Flink SQL statement that reads from `ROUTED-EVENTS` and filters by `target_topic`.

```
                    ┌───────────────────┐
                    │  ROUTING ENGINE   │  Statement 1 (1 CFU)
                    │  Temporal Join +  │
                    │  CROSS JOIN UNNEST│
                    └────────┬──────────┘
                             │
                             ▼
                    ┌───────────────────┐
                    │  ROUTED-EVENTS    │  Intermediate topic
                    │  (target_topic    │  (all fan-out rows land here)
                    │   column = label) │
                    └────────┬──────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │ Statement 2│  │ Statement 3│  │ Statement 4│
     │ WHERE =    │  │ WHERE =    │  │ WHERE =    │
     │'underwrite'│  │ 'finance'  │  │'collections│
     │ (1 CFU)    │  │ (1 CFU)    │  │ (1 CFU)    │
     └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
           │               │               │
           ▼               ▼               ▼
     ┌──────────┐    ┌─────────┐    ┌────────────┐
     │UNDERWRITE│    │ FINANCE │    │COLLECTIONS │
     │ING       │    │         │    │            │
     └──────────┘    └─────────┘    └────────────┘
```

### Statement Breakdown

```sql
-- Statement 1: Routing engine (fan-out)
INSERT INTO routed_events
SELECT
  CAST(e.event_id AS BYTES) AS `key`,
  t.target_topic,
  e.event_id, e.loan_id, e.event_type, e.amount, e.department
FROM loan_events e
JOIN routing_rules FOR SYSTEM_TIME AS OF e.`$rowtime` AS r
  ON e.event_type = r.event_type
CROSS JOIN UNNEST(r.target_topics) AS t(target_topic);

-- Statement 2: Underwriting consumer job
INSERT INTO underwriting
SELECT `key`, event_id, loan_id, event_type, amount, department
FROM routed_events
WHERE target_topic = 'underwriting';

-- Statement 3: Finance consumer job
INSERT INTO finance
SELECT `key`, event_id, loan_id, event_type, amount, department
FROM routed_events
WHERE target_topic = 'finance';

-- Statement 4: Collections consumer job
INSERT INTO collections
SELECT `key`, event_id, loan_id, event_type, amount, department
FROM routed_events
WHERE target_topic = 'collections';
```

### What's Wrong With This

1. **N+1 running statements.** Each destination requires its own Flink job. Adding a new department means deploying a new statement.
2. **N+1 CFUs.** Each statement consumes at least 1 CFU. Cost scales linearly with the number of destinations.
3. **Intermediate topic overhead.** The `ROUTED-EVENTS` topic stores every fan-out row — duplicating data that immediately gets filtered into destination topics. This doubles storage and doubles Kafka throughput charges.
4. **Consumer jobs are boilerplate.** Every subscriber statement is identical except for the `WHERE target_topic = '...'` value. This is exactly the kind of repetitive plumbing that `METADATA` columns eliminate.
5. **The routing is dynamic but the delivery is static.** The UNNEST-based routing engine is fully data-driven. But each consumer subscription is a hardcoded, separately-deployed Flink job. Adding a new destination requires both a data change (upsert routing rule) AND an infrastructure change (deploy new statement).

---

## 4. Cost Analysis: Flink vs. ksqlDB

### Confluent Cloud Flink SQL Pricing

- **Rate:** ~$0.115 per CFU per hour
- **Minimum:** 1 CFU per running statement
- **Model:** Cost scales with statement count AND throughput

### Confluent Cloud ksqlDB Pricing

- **Rate:** ~$0.12 per CSU per hour
- **Minimum:** 4 CSUs per cluster
- **Model:** Cost scales with throughput only; query count does not increase cost

### Comparison for This Pattern

| Destinations | Flink Statements | Flink Monthly Cost | ksqlDB Queries | ksqlDB Monthly Cost | Flink Premium |
|---|---|---|---|---|---|
| 3 | 4 | ~$335 | 4 | ~$350 | -4% (cheaper) |
| 5 | 6 | ~$500 | 6 | ~$350 | +43% |
| 10 | 11 | ~$920 | 11 | ~$350 | +163% |
| 20 | 21 | ~$1,760 | 21 | ~$350 | +403% |
| 50 | 51 | ~$4,280 | 51 | ~$350 | +1,123% |

**At 50 destinations, Flink costs 12x more than ksqlDB for the same pattern.**

### With METADATA Column Support

| Destinations | Flink Statements | Flink Monthly Cost | vs. Current Workaround |
|---|---|---|---|
| 3 | 1 | ~$84 | 75% savings |
| 10 | 1 | ~$84 | 91% savings |
| 50 | 1 | ~$84 | 98% savings |

**One statement. One CFU. Regardless of destination count.**

### ksqlDB Equivalent

ksqlDB achieves a similar result through `EXPLODE()` + persistent queries sharing cluster capacity. While ksqlDB still requires N consumer queries, they share a fixed-size cluster — cost does not scale linearly with query count.

```sql
-- ksqlDB: Fan-out with EXPLODE (equivalent to CROSS JOIN UNNEST)
CREATE STREAM routed_events AS
SELECT
  e.event_id, e.loan_id, e.event_type, e.amount, e.department,
  EXPLODE(r.target_topics) AS target_topic
FROM loan_events e
  JOIN routing_rules r ON e.event_type = r.event_type
EMIT CHANGES;

-- ksqlDB: Consumer subscription (runs on shared cluster, no additional cost)
CREATE STREAM underwriting AS
SELECT * FROM routed_events WHERE target_topic = 'underwriting' EMIT CHANGES;
```

---

## 5. What We Are Asking For

### Option A: Whitelist `topic` as a Writable Metadata Key (Preferred)

The infrastructure is already in place. Confluent Cloud's Flink SQL:
- Parses `METADATA FROM '<key>'` syntax correctly
- Enforces column ordering (physical before metadata)
- Validates metadata keys against the sink's supported set
- Already whitelists `headers` and `timestamp` for writing

The ask is surgical: **add `topic` to the writable metadata key set in `ConfluentManagedTableSink`.**

```sql
CREATE TABLE routed_events_sink (
  `key`          BYTES,
  event_id       STRING,
  ...
  target_topic   STRING METADATA FROM 'topic'   -- currently rejected, needs whitelisting
)
```

This enables the single-statement dynamic routing pattern that already works in open-source Apache Flink. It eliminates N consumer jobs, N CFUs, and the intermediate topic.

**Impact:** One statement, one CFU, unlimited dynamic routing. No parser changes, no DDL surface changes — just one entry added to a metadata key whitelist.

### Option B: Statement Pooling / Shared Compute

If per-row topic routing is architecturally incompatible with Confluent Cloud's managed topic model (e.g., because topics must be pre-provisioned or schema-registry-bound), an alternative is to allow multiple lightweight statements to share a single CFU pool — similar to how ksqlDB queries share a CSU cluster.

Concretely: if N filter statements read from the same source topic with trivial WHERE clauses, they should not each require a full CFU. A "statement group" or "query pool" concept would make fan-out patterns cost-comparable to ksqlDB.

### Option C: Allow User-Managed Kafka Connector Tables

Allow Confluent Cloud Flink tables to optionally specify Kafka connector properties, bypassing the managed table layer:

```sql
CREATE TABLE routed_events_sink (
  `key`          BYTES,
  event_id       STRING,
  ...
  target_topic   STRING METADATA FROM 'topic'
) WITH (
  'connector' = 'kafka',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'format' = 'json'
)
```

This would use the open-source Kafka connector (which already supports `topic` as a writable metadata key) instead of `ConfluentManagedTableSink`. Users accept responsibility for connector configuration in exchange for full metadata key support.

---

## Appendix A: Complete Flink SQL Implementation (Confluent Cloud)

This is the current workaround implementation running on Confluent Cloud Flink SQL. It requires N+1 statements.

### Table DDL

```sql
-- Input: Loan lifecycle events
CREATE TABLE `loan-events` (
  `key`        BYTES,
  event_id     STRING,
  loan_id      STRING,
  event_type   STRING,
  amount       DOUBLE,
  created_at   STRING,
  department   STRING
);

-- Input: Routing configuration (upsert/compacted)
CREATE TABLE `routing-rules` (
  event_type     STRING NOT NULL,
  target_topics  ARRAY<STRING>,
  updated_at     STRING,
  PRIMARY KEY (event_type) NOT ENFORCED
) WITH (
  'changelog.mode' = 'upsert'
);

-- Intermediate: Fan-out table (all routed rows land here)
CREATE TABLE `routed-events` (
  `key`          BYTES,
  target_topic   STRING,
  event_id       STRING,
  loan_id        STRING,
  event_type     STRING,
  amount         DOUBLE,
  department     STRING
);

-- Destination: Underwriting department topic
CREATE TABLE `underwriting` (
  `key`        BYTES,
  event_id     STRING,
  loan_id      STRING,
  event_type   STRING,
  amount       DOUBLE,
  department   STRING
);

-- Destination: Finance department topic
CREATE TABLE `finance` (
  `key`        BYTES,
  event_id     STRING,
  loan_id      STRING,
  event_type   STRING,
  amount       DOUBLE,
  department   STRING
);

-- Destination: Collections department topic
CREATE TABLE `collections` (
  `key`        BYTES,
  event_id     STRING,
  loan_id      STRING,
  event_type   STRING,
  amount       DOUBLE,
  department   STRING
);
```

### Statement 1: Routing Engine

```sql
INSERT INTO `routed-events`
SELECT
  CAST(e.event_id AS BYTES) AS `key`,
  t.target_topic,
  e.event_id,
  e.loan_id,
  e.event_type,
  e.amount,
  e.department
FROM `loan-events` e
JOIN `routing-rules` FOR SYSTEM_TIME AS OF e.`$rowtime` AS r
  ON e.event_type = r.event_type
CROSS JOIN UNNEST(r.target_topics) AS t(target_topic)
```

### Statements 2-4: Consumer Subscription Jobs

```sql
-- Statement 2
INSERT INTO `underwriting`
SELECT `key`, event_id, loan_id, event_type, amount, department
FROM `routed-events`
WHERE target_topic = 'underwriting';

-- Statement 3
INSERT INTO `finance`
SELECT `key`, event_id, loan_id, event_type, amount, department
FROM `routed-events`
WHERE target_topic = 'finance';

-- Statement 4
INSERT INTO `collections`
SELECT `key`, event_id, loan_id, event_type, amount, department
FROM `routed-events`
WHERE target_topic = 'collections';
```

### Verification Query

```sql
SELECT target_topic, event_type, COUNT(*) AS event_count
FROM `routed-events`
GROUP BY target_topic, event_type
```

---

## Appendix B: Ideal Implementation with Writable `topic` Metadata

This is how the pattern should work if Confluent whitelists `topic` as a writable metadata key in `ConfluentManagedTableSink` — one statement, one CFU, dynamic routing to N topics.

### Sink Table DDL (Confluent Cloud — requires `topic` to be whitelisted)

```sql
CREATE TABLE `routed-events-sink` (
  `key`          BYTES,
  event_id       STRING,
  loan_id        STRING,
  event_type     STRING,
  amount         DOUBLE,
  department     STRING,
  target_topic   STRING METADATA FROM 'topic'  -- physical columns MUST come first
)
```

> **Note:** No `WITH` clause needed on Confluent Cloud — the managed sink handles Kafka connectivity. Only the metadata key whitelist needs to change.

### Equivalent DDL (Open-Source Flink with Kafka Connector)

```sql
CREATE TABLE `routed-events-sink` (
  `key`          BYTES,
  event_id       STRING,
  loan_id        STRING,
  event_type     STRING,
  amount         DOUBLE,
  department     STRING,
  target_topic   STRING METADATA FROM 'topic'
) WITH (
  'connector' = 'kafka',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'format' = 'json'
)
```

### Single Routing Statement

```sql
INSERT INTO `routed-events-sink`
SELECT
  CAST(e.event_id AS BYTES) AS `key`,
  e.event_id,
  e.loan_id,
  e.event_type,
  e.amount,
  e.department,
  t.target_topic    -- maps to METADATA FROM 'topic', must be last
FROM `loan-events` e
JOIN `routing-rules` FOR SYSTEM_TIME AS OF e.`$rowtime` AS r
  ON e.event_type = r.event_type
CROSS JOIN UNNEST(r.target_topics) AS t(target_topic)
```

**Result:** Each row is written to the Kafka topic named in its `target_topic` column. A `NEW_LOAN` event with routing rule `['underwriting', 'finance']` produces two Kafka records — one in the `underwriting` topic, one in the `finance` topic. No intermediate table, no consumer jobs, no additional CFUs.

---

## Appendix C: ksqlDB Equivalent Implementation

This is the same pattern in ksqlDB. All queries share a single cluster — query count does not increase cost.

```sql
-- Input stream
CREATE STREAM loan_events (
  event_id VARCHAR,
  loan_id VARCHAR,
  event_type VARCHAR,
  amount DOUBLE,
  department VARCHAR
) WITH (
  kafka_topic = 'loan-events',
  value_format = 'JSON'
);

-- Routing rules table (backed by compacted topic)
CREATE TABLE routing_rules (
  event_type VARCHAR PRIMARY KEY,
  target_topics ARRAY<VARCHAR>,
  updated_at VARCHAR
) WITH (
  kafka_topic = 'routing-rules',
  value_format = 'JSON'
);

-- Routing engine: join + EXPLODE (ksqlDB's UNNEST equivalent)
CREATE STREAM routed_events AS
SELECT
  e.event_id,
  e.loan_id,
  e.event_type,
  e.amount,
  e.department,
  EXPLODE(r.target_topics) AS target_topic
FROM loan_events e
  JOIN routing_rules r ON e.event_type = r.event_type
EMIT CHANGES;

-- Consumer subscriptions (shared cluster, no per-query cost)
CREATE STREAM underwriting AS
SELECT * FROM routed_events
WHERE target_topic = 'underwriting' EMIT CHANGES;

CREATE STREAM finance AS
SELECT * FROM routed_events
WHERE target_topic = 'finance' EMIT CHANGES;

CREATE STREAM collections AS
SELECT * FROM routed_events
WHERE target_topic = 'collections' EMIT CHANGES;
```

---

## Appendix D: Sample Datasets

### LOAN-EVENTS (200 records, sample shown)

| event_id | loan_id | event_type | amount | created_at | department |
|---|---|---|---|---|---|
| EVT-00001 | LN-00042 | PAYMENT | 2500.00 | 2026-03-07T09:00:00.000Z | FINANCE |
| EVT-00002 | LN-00017 | NEW_LOAN | 350000.00 | 2026-03-07T09:00:02.000Z | UNDERWRITING |
| EVT-00003 | LN-00091 | FORECLOSURE | 175000.00 | 2026-03-07T09:00:04.000Z | COLLECTIONS |
| EVT-00004 | LN-00005 | MODIFICATION | 280000.00 | 2026-03-07T09:00:06.000Z | SERVICING |
| EVT-00005 | LN-00033 | TERMINATION | 95000.00 | 2026-03-07T09:00:08.000Z | COMPLIANCE |
| EVT-00006 | LN-00078 | NEW_LOAN | 425000.00 | 2026-03-07T09:00:10.000Z | UNDERWRITING |
| EVT-00007 | LN-00012 | PAYMENT | 1800.00 | 2026-03-07T09:00:12.000Z | FINANCE |
| EVT-00008 | LN-00055 | PAYMENT | 3200.00 | 2026-03-07T09:00:14.000Z | FINANCE |
| EVT-00009 | LN-00099 | FORECLOSURE | 210000.00 | 2026-03-07T09:00:16.000Z | SERVICING |
| EVT-00010 | LN-00028 | NEW_LOAN | 515000.00 | 2026-03-07T09:00:18.000Z | UNDERWRITING |

**Event type distribution (weighted):**
- NEW_LOAN: ~20%
- PAYMENT: ~40%
- MODIFICATION: ~15%
- FORECLOSURE: ~15%
- TERMINATION: ~10%

**Department distribution:** Uniform random across UNDERWRITING, FINANCE, SERVICING, FORECLOSURES, COMPLIANCE.

### Generator Code (TypeScript)

```typescript
const EVENT_TYPES = ['NEW_LOAN', 'PAYMENT', 'MODIFICATION', 'FORECLOSURE', 'TERMINATION'];
const EVENT_WEIGHTS = [0.20, 0.40, 0.15, 0.15, 0.10];
const DEPARTMENTS = ['UNDERWRITING', 'FINANCE', 'SERVICING', 'FORECLOSURES', 'COMPLIANCE'];

function generateLoanEventsDept(count: number): Record<string, unknown>[] {
  const results = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    results.push({
      key: null,
      event_id: `EVT-${String(i + 1).padStart(5, '0')}`,
      loan_id: `LN-${String(Math.floor(Math.random() * 100) + 1).padStart(5, '0')}`,
      event_type: pickWeighted(EVENT_TYPES, EVENT_WEIGHTS),
      amount: parseFloat((1000 + Math.random() * 499000).toFixed(2)),
      created_at: new Date(now - (count - i) * 2000).toISOString(),
      department: DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)],
    });
  }
  return results;
}
```

---

## Appendix E: Routing Rules Configuration

### Initial Rules (5 records)

| event_type | target_topics | updated_at |
|---|---|---|
| NEW_LOAN | `["underwriting", "finance"]` | 2026-03-07T10:00:00Z |
| PAYMENT | `["finance"]` | 2026-03-07T10:00:00Z |
| MODIFICATION | `["finance"]` | 2026-03-07T10:00:00Z |
| FORECLOSURE | `["collections"]` | 2026-03-07T10:00:00Z |
| TERMINATION | `["collections"]` | 2026-03-07T10:00:00Z |

### Routing Behavior

| Event Type | Fans Out To | Output Rows Per Event |
|---|---|---|
| NEW_LOAN | underwriting, finance | 2 |
| PAYMENT | finance | 1 |
| MODIFICATION | finance | 1 |
| FORECLOSURE | collections | 1 |
| TERMINATION | collections | 1 |

### Dynamic Update Example

To add `collections` as a destination for `PAYMENT` events, produce a single record to the routing-rules topic:

```json
{
  "event_type": "PAYMENT",
  "target_topics": ["finance", "collections"],
  "updated_at": "2026-03-07T11:00:00Z"
}
```

**Before update:** PAYMENT events → finance only (1 output row)
**After update:** PAYMENT events → finance + collections (2 output rows)

No Flink SQL changes. No redeployment. The temporal join picks up the new rule version immediately.

### Expected Fan-Out Distribution (200 input events)

With the default routing rules and weighted event distribution:

| target_topic | Event Types Received | Expected Row Count |
|---|---|---|
| underwriting | NEW_LOAN | ~40 |
| finance | NEW_LOAN, PAYMENT, MODIFICATION | ~40 + ~80 + ~30 = ~150 |
| collections | FORECLOSURE, TERMINATION | ~30 + ~20 = ~50 |
| **Total output rows** | | **~240** |

**200 input events produce ~240 output rows.** The difference (~40 extra rows) comes from NEW_LOAN events being duplicated across underwriting and finance. This is fan-out working correctly.

### Generator Code (TypeScript)

```typescript
function generateRoutingRulesArray(): Record<string, unknown>[] {
  return [
    { event_type: 'NEW_LOAN',      target_topics: ['underwriting', 'finance'], updated_at: new Date().toISOString() },
    { event_type: 'PAYMENT',       target_topics: ['finance'],                 updated_at: new Date().toISOString() },
    { event_type: 'MODIFICATION',  target_topics: ['finance'],                 updated_at: new Date().toISOString() },
    { event_type: 'FORECLOSURE',   target_topics: ['collections'],             updated_at: new Date().toISOString() },
    { event_type: 'TERMINATION',   target_topics: ['collections'],             updated_at: new Date().toISOString() },
  ];
}
```

---

## Summary

The `topic` metadata key is a single whitelist entry that eliminates an entire class of workarounds. The plumbing is already in place — Confluent Cloud Flink SQL parses `METADATA FROM '<key>'` syntax, enforces column ordering, and validates metadata keys against the sink connector. `headers` and `timestamp` are already writable. Adding `topic` to that list enables per-row dynamic topic routing with:

- **One statement instead of N+1** — eliminates consumer subscription jobs entirely
- **One CFU instead of N+1** — cost becomes independent of destination count
- **No intermediate topic** — eliminates the doubled storage and throughput
- **Full parity with open-source Flink** — the same `METADATA FROM 'topic'` pattern that works today

Without this change, Confluent Cloud Flink SQL forces users into an N+1 statement pattern that costs up to 12x more than the ksqlDB equivalent at 50 destinations, and makes Flink SQL strictly inferior to ksqlDB for fan-out routing patterns — on Confluent's own platform.

The fix is surgical. The ask is one entry in a whitelist.
