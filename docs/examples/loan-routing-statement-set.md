# Dynamic Event Routing with EXECUTE STATEMENT SET

## Overview

Routes loan lifecycle events to department-specific topics using a **single routing engine** (temporal join + CROSS JOIN UNNEST) and **EXECUTE STATEMENT SET** to bundle all consumer INSERTs into one Flink job.

Available in two variants:
- **`loan-routing-json`** — Explicit `'value.format' = 'json'` in DDL
- **`loan-routing-avro`** — Confluent default (Avro + Schema Registry)

## Pipeline Architecture

```
loan-events ─┐
              ├─ TEMPORAL JOIN + UNNEST ─→ routed-events ─→ STATEMENT SET ─→ underwriting
routing-rules─┘                                                            ─→ finance
                                                                           ─→ collections
```

**Job 1 — Routing Engine:**
INSERT INTO routed-events via temporal join on routing-rules + CROSS JOIN UNNEST to fan each event to all its target topics.

**Job 2 — EXECUTE STATEMENT SET:**
All three consumer INSERTs bundled into a single Flink job. Each filters `routed-events` by `target_topic`.

## Key SQL

### Routing Engine (Job 1)

```sql
INSERT INTO `routed-events`
SELECT
  CAST(e.event_id AS BYTES) AS `key`,
  t.target_topic,
  e.event_id, e.loan_id, e.event_type, e.amount, e.department
FROM `loan-events` e
JOIN `routing-rules` FOR SYSTEM_TIME AS OF e.`$rowtime` AS r
  ON e.event_type = r.event_type
CROSS JOIN UNNEST(r.target_topics) AS t(target_topic)
```

### Statement Set (Job 2)

```sql
EXECUTE STATEMENT SET
BEGIN
  INSERT INTO `underwriting`
    SELECT `key`, event_id, loan_id, event_type, amount, department
    FROM `routed-events` WHERE target_topic = 'underwriting';
  INSERT INTO `finance`
    SELECT `key`, event_id, loan_id, event_type, amount, department
    FROM `routed-events` WHERE target_topic = 'finance';
  INSERT INTO `collections`
    SELECT `key`, event_id, loan_id, event_type, amount, department
    FROM `routed-events` WHERE target_topic = 'collections';
END;
```

## What This Replaces

| Old Example | Problem |
|---|---|
| Dynamic Event Routing (`loan-dynamic-routing`) | 4 separate INSERT jobs with WHERE clauses — N jobs for N departments |
| Dynamic Routing with Metadata Sinks (`loan-metadata-routing`) | CROSS JOIN UNNEST + 3 separate consumer jobs — still N+1 jobs |
| Dynamic Kafka Router UDF (`flink-udf-routing`) | UDF writes directly to Kafka broker — dangerous anti-pattern |

**EXECUTE STATEMENT SET** solves all three: one job for all consumers, no UDF needed, standard Flink SQL.

## Routing Rules

The `routing-rules` table maps each `event_type` to an `ARRAY<STRING>` of target topics:

| event_type | target_topics |
|---|---|
| NEW_LOAN | [underwriting, finance] |
| PAYMENT | [finance] |
| MODIFICATION | [finance] |
| FORECLOSURE | [collections] |
| TERMINATION | [collections] |

### Dynamic Updates

Upsert a routing rule to change routing at runtime — no SQL changes needed:
- Add `collections` to PAYMENT's `target_topics` → payments start flowing to collections
- Add a new event type → events of that type get routed immediately

## Fan-Out Math

With 200 input events (weighted distribution):
- ~40 NEW_LOAN → 2 targets each → ~80 routed rows
- ~80 PAYMENT → 1 target → ~80 routed rows
- ~30 MODIFICATION → 1 target → ~30 routed rows
- ~30 FORECLOSURE → 1 target → ~30 routed rows
- ~20 TERMINATION → 1 target → ~20 routed rows

Total: ~240 routed rows from 200 input events. Fan-out confirmed when total > input.

## JSON vs Avro

On Confluent Cloud, the serialization format is determined by **how data is produced**, not by DDL properties. Both variants use identical DDL — the difference is purely conceptual and in how the data appears on the wire.

| Aspect | JSON | Avro |
|---|---|---|
| DDL | Same as Avro | Same as JSON |
| Schema Registry | Schemas auto-registered (JSON Schema) | Schemas auto-registered (Avro) |
| Wire format | Human-readable JSON | Compact binary |
| When to use | Debugging, external consumers | Production, performance |

## Tables

| Table | Role | Schema Key | Description |
|---|---|---|---|
| LOAN-EVENTS | Source | `loan-events-dept[-json]` | Loan lifecycle events with department |
| ROUTING-RULES | Source | `routing-rules-array[-json]` | Upsert table mapping event_type → target_topics array |
| ROUTED-EVENTS | Intermediate | `routed-events-sink[-json]` | Fan-out output with target_topic column |
| UNDERWRITING | Destination | `routed-events-dept[-json]` | Filtered consumer: underwriting events |
| FINANCE | Destination | `routed-events-dept[-json]` | Filtered consumer: finance events |
| COLLECTIONS | Destination | `routed-events-dept[-json]` | Filtered consumer: collections events |
