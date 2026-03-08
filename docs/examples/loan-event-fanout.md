# Static Event Fan-Out

A single loan-events stream carries events for multiple departments. Hardcoded WHERE clauses route each event type to its own output topic, creating a simple fan-out pattern without any external lookup tables.

## Metadata

- **Group:** Basics
- **Skill Level:** Beginner
- **Tags:** WHERE, Fan-Out, Routing, Streaming

## Input Schema

**Table: LOAN-EVENTS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  event_id STRING,
  loan_id STRING,
  event_type STRING,
  amount DOUBLE,
  created_at STRING,
  department STRING
)
```

## Output Schema

**Table: EVENTS-UNDERWRITING**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  event_id STRING,
  loan_id STRING,
  event_type STRING,
  amount DOUBLE,
  created_at STRING
)
```

**Table: EVENTS-FINANCE**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  event_id STRING,
  loan_id STRING,
  event_type STRING,
  amount DOUBLE,
  created_at STRING
)
```

**Table: EVENTS-FORECLOSURES**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  event_id STRING,
  loan_id STRING,
  event_type STRING,
  amount DOUBLE,
  created_at STRING
)
```

## SQL

```sql
-- Route to underwriting
INSERT INTO `{rid}-EVENTS-UNDERWRITING`
SELECT CAST(event_id AS BYTES) AS `key`, event_id, loan_id, event_type, amount, created_at
FROM `{rid}-LOAN-EVENTS`
WHERE department = 'UNDERWRITING';

-- Route to finance
INSERT INTO `{rid}-EVENTS-FINANCE`
SELECT CAST(event_id AS BYTES) AS `key`, event_id, loan_id, event_type, amount, created_at
FROM `{rid}-LOAN-EVENTS`
WHERE department = 'FINANCE';

-- Route to foreclosures
INSERT INTO `{rid}-EVENTS-FORECLOSURES`
SELECT CAST(event_id AS BYTES) AS `key`, event_id, loan_id, event_type, amount, created_at
FROM `{rid}-LOAN-EVENTS`
WHERE department = 'FORECLOSURES'
```

## Completion Steps

1. Create the `LOAN-EVENTS` input topic and the three output topics (`EVENTS-UNDERWRITING`, `EVENTS-FINANCE`, `EVENTS-FORECLOSURES`).
2. Submit each `INSERT INTO` statement as a separate Flink job to start routing.
3. Produce events with different department values and verify each lands only in its designated output topic.
