# ksqlDB Dynamic Event Routing — JSON Format

## Overview

Routes loan lifecycle events to department-specific Kafka topics using a **single routing engine** powered by `EXPLODE()` (ksqlDB's fan-out function) and a **stream-table join** against a live routing rules table. This is the **JSON variant** of the ksqlDB dynamic routing example — same pipeline logic, but with `VALUE_FORMAT = 'JSON'` instead of Avro.

**Why does a JSON variant exist?** JSON is simpler. There is no Schema Registry involvement, no struct-wrapped keys, and no Avro naming constraints. If you are learning how dynamic routing works, start here. Move to the Avro variant once you understand the pipeline and want to see how production serialization changes the DDL.

**Engine:** ksqlDB (all 8 SQL cells run on a ksqlDB cluster, not Flink)

## Pipeline Architecture

```
loan-events ─┐
              ├─ EXPLODE + stream-table join ─→ routed-events ─→ underwriting
routing-rules─┘                                                ─→ finance
                                                               ─→ collections
```

**How it works, step by step:**

1. **Routing rules** are produced to a Kafka topic as JSON. Each rule maps an `event_type` (like `NEW_LOAN`) to an array of `target_topics` (like `["underwriting", "finance"]`).
2. A ksqlDB **materialized TABLE** aggregates those rules so only the latest rule per event type is kept.
3. **Loan events** arrive on a second Kafka topic — each event has an `event_type` field.
4. The **routing engine** joins each event to its routing rule and calls `EXPLODE()` on the `target_topics` array. If a rule says `["underwriting", "finance"]`, one input row becomes two output rows — one tagged for underwriting, one for finance. This is the **fan-out**.
5. Three **consumer streams** filter the fan-out output by `target_topic` and write to department-specific topics.

The beauty: if you want to change where events go, you just produce a new routing rule. No SQL changes needed. The pipeline picks up the new rule and starts routing differently immediately.

## Key SQL

### Cell 1: Register Loan Events Stream

```sql
CREATE STREAM `{LOAN-EVENTS}` (
  `event_id` STRING,
  `loan_id` STRING,
  `event_type` STRING,
  `amount` DOUBLE,
  `created_at` STRING,
  `department` STRING
) WITH (
  KAFKA_TOPIC = '{LOAN-EVENTS}',
  VALUE_FORMAT = 'JSON'
);
```

**What this does:** Tells ksqlDB "there is a Kafka topic called LOAN-EVENTS, and here is its schema." ksqlDB does not create the topic — it already exists. It just registers it so you can query it with SQL.

**Why backtick-quote the column names?** ksqlDB uppercases all unquoted identifiers. If you write `event_id` without backticks, ksqlDB stores the column name as `EVENT_ID`. But the JSON data on the wire uses lowercase keys (`"event_id": "..."`). If the column name does not match the JSON key name exactly, ksqlDB cannot find the field and every value comes back as `NULL`. Backticks preserve the lowercase names.

### Cell 2: Register Routing Rules Stream

```sql
CREATE STREAM `{ROUTING-RULES}` (
  `event_type` STRING,
  `target_topics` ARRAY<STRING>,
  `updated_at` STRING
) WITH (
  KAFKA_TOPIC = '{ROUTING-RULES}',
  VALUE_FORMAT = 'JSON'
);
```

**What this does:** Registers the routing rules topic. Each message contains an `event_type` and an array of `target_topics` that event type should be routed to.

**Why is this simpler than the Avro variant?** Two things you do NOT need here:

1. **No `STRUCT KEY`** — When Flink creates an Avro topic with a `PRIMARY KEY`, it wraps that key column inside an Avro record struct. ksqlDB expects a bare string key, not a struct, so the Avro variant must declare `STRUCT<event_type STRING> KEY` to match the wrapper. JSON does not wrap keys in structs, so `event_type` is just a regular VALUE column here.

2. **No `KEY_SCHEMA_FULL_NAME`** — Avro requires every record to have a valid Java-style name (like `com.example.Event`). ksqlDB auto-generates this name from the stream name, but hyphenated topic names (like `routing-rules`) produce illegal Avro identifiers. The Avro variant needs `KEY_SCHEMA_FULL_NAME = 'RoutingRulesKey'` to override this. JSON does not use Schema Registry for keys at all, so the problem does not exist.

### Cell 3: Materialize Rules into a Lookup Table

```sql
CREATE TABLE `{ROUTING-RULES}-table` AS
SELECT
  `event_type`,
  LATEST_BY_OFFSET(`target_topics`) AS `target_topics`
FROM `{ROUTING-RULES}`
GROUP BY `event_type`
EMIT CHANGES;
```

**What this does:** Converts the routing rules stream (which may have multiple versions of the same rule) into a TABLE that keeps only the most recent rule per `event_type`. This is ksqlDB's equivalent of an upsert table.

**Why `LATEST_BY_OFFSET`?** A stream can have many records with `event_type = 'NEW_LOAN'` (one for each time the rule was updated). We only want the latest version. `LATEST_BY_OFFSET` picks the record with the highest Kafka offset — i.e., the most recently produced one.

**Why `GROUP BY event_type` (not `key_data->event_type`)?** This is another JSON simplification. In the Avro variant, `event_type` lives inside a struct key, so you must extract it with `key_data->event_type`. In JSON, `event_type` is a regular value column, so you just reference it directly.

### Cell 4: Routing Engine — EXPLODE + Stream-Table Join

```sql
CREATE STREAM `{ROUTED-EVENTS}`
WITH (KAFKA_TOPIC = '{ROUTED-EVENTS}', VALUE_FORMAT = 'JSON')
AS SELECT
  e.`event_id` AS `event_id`,
  EXPLODE(r.`target_topics`) AS `target_topic`,
  e.`loan_id` AS `loan_id`,
  e.`event_type` AS `event_type`,
  e.`amount` AS `amount`,
  e.`department` AS `department`
FROM `{LOAN-EVENTS}` e
  INNER JOIN `{ROUTING-RULES}-table` r
  ON e.`event_type` = r.`event_type`
EMIT CHANGES;
```

**What this does:** This is the heart of the pipeline. For each loan event:

1. **JOIN** — Look up the event's `event_type` in the routing rules table to find its `target_topics` array.
2. **EXPLODE** — Unpack the `target_topics` array into individual rows. If the array has 2 elements, one input row becomes 2 output rows.

**`EXPLODE()` vs Flink's `CROSS JOIN UNNEST`:** They do the same thing — turn one row with an array into multiple rows, one per array element. The syntax is different:

| Engine | Syntax |
|---|---|
| Flink SQL | `CROSS JOIN UNNEST(r.target_topics) AS t(target_topic)` |
| ksqlDB | `EXPLODE(r.target_topics) AS target_topic` |

**Why no `FOR SYSTEM_TIME AS OF`?** In Flink, a stream-table join requires you to specify `FOR SYSTEM_TIME AS OF e.$rowtime` to tell Flink which version of the table to use for each event. In ksqlDB, stream-table joins are temporal by default — ksqlDB always uses the latest table state at the time the event arrives. Less syntax, same result.

### Cells 5-7: Route to Department Topics

```sql
-- Cell 5: Underwriting
CREATE STREAM `{UNDERWRITING}`
WITH (KAFKA_TOPIC = '{UNDERWRITING}', VALUE_FORMAT = 'JSON')
AS SELECT `event_id`, `loan_id`, `event_type`, `amount`, `department`
FROM `{ROUTED-EVENTS}`
WHERE `target_topic` = '{UNDERWRITING}'
EMIT CHANGES;

-- Cell 6: Finance
CREATE STREAM `{FINANCE}`
WITH (KAFKA_TOPIC = '{FINANCE}', VALUE_FORMAT = 'JSON')
AS SELECT `event_id`, `loan_id`, `event_type`, `amount`, `department`
FROM `{ROUTED-EVENTS}`
WHERE `target_topic` = '{FINANCE}'
EMIT CHANGES;

-- Cell 7: Collections
CREATE STREAM `{COLLECTIONS}`
WITH (KAFKA_TOPIC = '{COLLECTIONS}', VALUE_FORMAT = 'JSON')
AS SELECT `event_id`, `loan_id`, `event_type`, `amount`, `department`
FROM `{ROUTED-EVENTS}`
WHERE `target_topic` = '{COLLECTIONS}'
EMIT CHANGES;
```

**What these do:** Each stream filters the fan-out output (`routed-events`) to just the events tagged for that department. The `WHERE` clause matches the `target_topic` value that `EXPLODE()` produced.

**Why three separate streams instead of one?** Each department gets its own Kafka topic. In a real system, the underwriting team consumes from the `underwriting` topic, the finance team from `finance`, and so on. They are independent consumers that do not need to see each other's events.

### Cell 8: Verify Fan-Out

```sql
SELECT `target_topic`, `event_type`, COUNT(*) AS `event_count`
FROM `{ROUTED-EVENTS}`
GROUP BY `target_topic`, `event_type`
EMIT CHANGES;
```

**What this does:** A push query that shows how many events were routed to each department, broken down by event type. This is your proof that fan-out is working: the total count across all departments should be greater than the 200 input events (because NEW_LOAN events get duplicated to two departments).

## JSON vs Avro Comparison

This table shows every difference between the JSON and Avro variants of this example. The pipeline logic is identical — only the serialization-related DDL changes.

| Aspect | JSON Variant (this example) | Avro Variant (`ksql-dynamic-routing`) |
|---|---|---|
| `VALUE_FORMAT` | `'JSON'` | `'AVRO'` |
| Schema Registry | Not used — JSON is self-describing | Required — Avro schemas registered automatically |
| Key declaration | `event_type` is a VALUE column | `STRUCT<event_type STRING> KEY` (Avro struct wrapper) |
| `KEY_FORMAT` | Not specified (default) | `KEY_FORMAT = 'AVRO'` |
| `KEY_SCHEMA_FULL_NAME` | Not needed | `'RoutingRulesKey'` (overrides illegal Avro name from hyphens) |
| GROUP BY in table | `GROUP BY event_type` | `GROUP BY key_data->event_type` (extract from struct) |
| Topic creation | Raw Kafka topics (`type: 'topic'`) | Flink DDL topics (schemas auto-registered) |
| Wire format | Human-readable `{"event_id":"..."}` | Compact binary (Avro-encoded) |
| Schema enforcement | None — any JSON structure accepted | Strict — must match registered Avro schema |
| Best for | Learning, debugging, external consumers | Production, performance, schema governance |

**Bottom line:** JSON is easier to set up and debug. Avro is safer and more efficient for production. The SQL logic does not change between them — only the `WITH (...)` clauses differ.

## Routing Rules

The `routing-rules` topic contains rules that map each `event_type` to one or more `target_topics`:

| event_type | target_topics | What it means |
|---|---|---|
| NEW_LOAN | [underwriting, finance] | New loans go to BOTH underwriting AND finance (fan-out!) |
| PAYMENT | [finance] | Payments go to finance only |
| MODIFICATION | [finance] | Modifications go to finance only |
| FORECLOSURE | [collections] | Foreclosures go to collections only |
| TERMINATION | [collections] | Terminations go to collections only |

### Dynamic Updates

Routing rules are not hardcoded in SQL. They live in a Kafka topic, which means you can change them at runtime by producing a new message:

```json
{"event_type": "PAYMENT", "target_topics": ["finance", "collections"], "updated_at": "2026-03-08T12:00:00Z"}
```

This upserts the PAYMENT rule to also include `collections`. The materialized table updates automatically, and the routing engine starts sending payments to both finance AND collections — without touching any SQL.

## Fan-Out Math

The example produces 200 input events with a weighted distribution. Because NEW_LOAN events fan out to 2 departments, the total output exceeds the input:

| event_type | ~Input Count | Targets | Output Rows |
|---|---|---|---|
| NEW_LOAN | ~40 | 2 (underwriting + finance) | ~80 |
| PAYMENT | ~80 | 1 (finance) | ~80 |
| MODIFICATION | ~30 | 1 (finance) | ~30 |
| FORECLOSURE | ~30 | 1 (collections) | ~30 |
| TERMINATION | ~20 | 1 (collections) | ~20 |
| **Total** | **200** | | **~240** |

**How to confirm fan-out is working:** Run Cell 8 (verify-fan-out). If the sum of `event_count` across all rows is greater than 200, fan-out is working. NEW_LOAN should appear under both `underwriting` and `finance` target topics.

## Running the Example Step by Step

### Prerequisites

- A running ksqlDB cluster (the ksqlDB engine toggle must be enabled in the app: `VITE_KSQL_ENABLED=true`)
- Kafka topics will be created automatically by the example runner

### Steps

1. **Open the example** — Select "ksqlDB Dynamic Routing (JSON)" from the example cards. The runner creates 6 raw Kafka topics and sets up 8 SQL cells in your workspace.

2. **Register source streams** (Cells 1-2) — Run the `register-events` and `register-rules` cells. These tell ksqlDB about the existing Kafka topics and their schemas. No data flows yet — these are just registrations.

3. **Produce routing rules** — Click the play button on the ROUTING-RULES stream card. This produces 5 JSON messages (one per event type) to the routing rules topic. You should see them appear in the stream card as human-readable JSON.

4. **Materialize the rules table** (Cell 3) — Run `materialize-rules-table`. This creates a persistent query that aggregates routing rules into a TABLE. After this step, ksqlDB has a live lookup table that maps event types to their target topics.

5. **Produce loan events** — Click the play button on the LOAN-EVENTS stream card. This produces 200 loan lifecycle events in JSON format to the loan events topic.

6. **Run the routing engine** (Cell 4) — Run `explode-routing-engine`. This is the core of the pipeline. Each event is joined to its routing rule, and `EXPLODE()` fans events out to multiple rows based on `target_topics`. Watch the ROUTED-EVENTS stream card — you should see events appearing with a `target_topic` column showing their destination.

7. **Route to departments** (Cells 5-7) — Run `route-underwriting`, `route-finance`, and `route-collections`. Each creates a persistent query that filters routed events by `target_topic` and writes to a department-specific topic.

8. **Observe fan-out** — Watch the department stream cards:
   - **UNDERWRITING** should show only NEW_LOAN events
   - **FINANCE** should show NEW_LOAN, PAYMENT, and MODIFICATION events
   - **COLLECTIONS** should show FORECLOSURE and TERMINATION events
   - Notice that NEW_LOAN appears in BOTH underwriting AND finance — that is the fan-out in action

9. **Verify with aggregation** (Cell 8) — Run `verify-fan-out` to see counts by department and event type. The total should be ~240 (greater than the 200 input events), proving fan-out works.

### Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| All column values are NULL | Backtick-quoting mismatch — column names do not match JSON keys | Make sure all column names in CREATE STREAM use backtick quotes |
| No rows in ROUTED-EVENTS | Rules table is empty — rules were not produced before the engine started | Produce routing rules first, then run the engine |
| Counts equal exactly 200 | No fan-out happening — all rules have single-element arrays | Check that NEW_LOAN rule has `["underwriting", "finance"]` (two targets) |
| Stream card shows "No schema found" | Expected! JSON topics have no Schema Registry schema | The stream card auto-detects this and produces JSON — this is correct behavior |

## Tables

| Table | Type | Role | Description |
|---|---|---|---|
| LOAN-EVENTS | Kafka topic | Source (input) | Loan lifecycle events (200 records): event_id, loan_id, event_type, amount, department |
| ROUTING-RULES | Kafka topic | Source (input) | Routing rules (5 records): event_type mapped to target_topics array |
| ROUTED-EVENTS | Kafka topic | Intermediate | Fan-out output (~240 rows): each event tagged with a target_topic |
| UNDERWRITING | Kafka topic | Destination | Filtered: NEW_LOAN events only |
| FINANCE | Kafka topic | Destination | Filtered: NEW_LOAN + PAYMENT + MODIFICATION events |
| COLLECTIONS | Kafka topic | Destination | Filtered: FORECLOSURE + TERMINATION events |

All 6 topics are created as raw Kafka topics (`type: 'topic'` in the example runner). No Avro schemas are registered in Schema Registry. The StreamCard producer detects the missing schema and falls back to JSON production automatically.
