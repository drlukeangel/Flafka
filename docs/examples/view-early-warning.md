# Servicer Early Warning System

Compute delinquency rates per servicer in 30-second tumbling windows. A spike above 10% means intervene. This example uses Flink's windowed aggregation with a FILTER clause to count delinquent payments and calculate a real-time delinquency rate per loan servicer.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | Views |
| **Tags** | Quick Start, Materialized View, Window, Risk |

## Input Schema

```sql
CREATE TABLE `PAYMENT-EVENTS` (
  payment_id STRING,
  servicer_id STRING,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  payment_date STRING
)
```

## Output Schema

```sql
CREATE TABLE `SERVICER-HEALTH` (
  servicer_id STRING NOT NULL,
  window_start STRING,
  window_end STRING,
  total_payments BIGINT,
  delinquent_payments BIGINT,
  delinquency_rate DOUBLE,
  PRIMARY KEY (servicer_id) NOT ENFORCED
)
```

## SQL

### Cell 1 -- Compute delinquency rate per servicer per window

```sql
INSERT INTO `SERVICER-HEALTH`
SELECT
  servicer_id,
  window_start,
  window_end,
  total_payments,
  delinquent_payments,
  CAST(delinquent_payments AS DOUBLE) / total_payments * 100 AS delinquency_rate
FROM (
  SELECT
    servicer_id,
    DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
    DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
    COUNT(*) AS total_payments,
    COUNT(*) FILTER (WHERE status = 'DELINQUENT') AS delinquent_payments
  FROM TABLE(
    TUMBLE(TABLE `PAYMENT-EVENTS`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
  )
  GROUP BY servicer_id, window_start, window_end
)
```

### Cell 2 -- Query servicers above threshold

```sql
SELECT * FROM `SERVICER-HEALTH`
WHERE delinquency_rate > 10.0
LIMIT 50
```

## Example Input

Records on the `PAYMENT-EVENTS` topic (all within the same 30-second window):

```json
{"payment_id": "PAY-0000001", "servicer_id": "SVC-001", "loan_id": "LN-00050", "amount": 1500.0, "status": "ON_TIME", "payment_date": "2025-01-01T03:00:00Z"}
{"payment_id": "PAY-0000002", "servicer_id": "SVC-001", "loan_id": "LN-00051", "amount": 2200.0, "status": "DELINQUENT", "payment_date": "2025-01-01T03:00:15Z"}
{"payment_id": "PAY-0000003", "servicer_id": "SVC-001", "loan_id": "LN-00052", "amount": 1800.0, "status": "ON_TIME", "payment_date": "2025-01-01T03:00:25Z"}
{"payment_id": "PAY-0000004", "servicer_id": "SVC-002", "loan_id": "LN-00100", "amount": 3000.0, "status": "ON_TIME", "payment_date": "2025-01-01T03:00:10Z"}
```

## Expected Output

### Windowed aggregation (Cell 1 output on `SERVICER-HEALTH`)

```json
{"servicer_id": "SVC-001", "window_start": "2025-01-01 03:00:00", "window_end": "2025-01-01 03:00:30", "total_payments": 3, "delinquent_payments": 1, "delinquency_rate": 33.33}
{"servicer_id": "SVC-002", "window_start": "2025-01-01 03:00:00", "window_end": "2025-01-01 03:00:30", "total_payments": 1, "delinquent_payments": 0, "delinquency_rate": 0.0}
```

### Alert query (Cell 2 output)

Only SVC-001 exceeds the 10% delinquency threshold (33.33% > 10%):

```json
{"servicer_id": "SVC-001", "window_start": "2025-01-01 03:00:00", "window_end": "2025-01-01 03:00:30", "total_payments": 3, "delinquent_payments": 1, "delinquency_rate": 33.33}
```

## Steps to Run

1. **Create the input topic** `PAYMENT-EVENTS` with the input schema DDL above. Ensure the topic has event-time semantics configured so that `$rowtime` is derived from the record timestamps.
2. **Create the output topic** `SERVICER-HEALTH` with the output schema DDL above.
3. **Deploy the windowed aggregation** by executing SQL Cell 1. The INSERT statement will consume payment events, group them into 30-second tumbling windows per servicer, and compute delinquency rates.
4. **Produce sample records** to `PAYMENT-EVENTS` using the example input JSON above. Ensure all four records have timestamps within the same 30-second window (03:00:00 to 03:00:29).
5. **Query at-risk servicers** by executing SQL Cell 2 to find servicers with delinquency rates above 10%.
6. **Verify** that SVC-001 shows 3 total payments, 1 delinquent, and a 33.33% rate, while SVC-002 shows 0% and is excluded from the alert query.
