# Aggregate UDF -- Weighted Average Credit Score

AVG treats a $500 loan the same as a $500K one. `WeightedAvg` does not. This example computes real portfolio risk metrics using a custom aggregate UDF that weights credit scores by loan amount within tumbling windows.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | UDFs |
| **Tags** | Quick Start, UDF, Windowed |

## Input Schema

**Topic:** `{rid}-LOAN-APPLICATIONS`

```sql
CREATE TABLE `{name}` (
  loan_id        STRING,
  json_payload   STRING
)
```

## Output Schema

**Topic:** `{rid}-LOAN-PORTFOLIO-STATS`

```sql
CREATE TABLE `{name}` (
  `key`                        BYTES,
  window_start                 STRING,
  window_end                   STRING,
  loan_count                   BIGINT,
  total_amount                 BIGINT,
  avg_credit_score             INT,
  weighted_avg_credit_score    INT
)
```

## SQL

**Cell 1 -- Register the scalar extract UDF:**

```sql
CREATE FUNCTION `{extractFn}` AS 'com.fm.flink.udf.LoanDetailExtractor'
  USING JAR 'confluent-artifact://{id}/{ver}'
```

**Cell 2 -- Register the aggregate UDF:**

```sql
CREATE FUNCTION `{weightedAvgFn}` AS 'com.fm.flink.udf.WeightedAvg'
  USING JAR 'confluent-artifact://{id}/{ver}'
```

**Cell 3 -- Compute windowed portfolio statistics:**

```sql
INSERT INTO `{output}` (`key`, window_start, window_end, loan_count, total_amount, avg_credit_score, weighted_avg_credit_score)
SELECT
  CAST('portfolio' AS BYTES) AS `key`,
  DATE_FORMAT(window_start, 'yyyy-MM-dd HH:mm:ss') AS window_start,
  DATE_FORMAT(window_end, 'yyyy-MM-dd HH:mm:ss') AS window_end,
  COUNT(*) AS loan_count,
  SUM(CAST(`{extractFn}`(json_payload, 'application.loan.amount_requested') AS BIGINT)) AS total_amount,
  AVG(CAST(`{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT)) AS avg_credit_score,
  `{weightedAvgFn}`(
    CAST(`{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS INT),
    CAST(`{extractFn}`(json_payload, 'application.loan.amount_requested') AS INT)
  ) AS weighted_avg_credit_score
FROM TABLE(
  TUMBLE(TABLE `{input}`, DESCRIPTOR($rowtime), INTERVAL '30' SECOND)
)
GROUP BY window_start, window_end
```

## Example Input

Five loan applications arriving within the same 30-second window:

```json
{"loan_id": "LN-001", "json_payload": "{\"application\":{\"loan\":{\"amount_requested\":\"350000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"742\"}}}}}"}
{"loan_id": "LN-002", "json_payload": "{\"application\":{\"loan\":{\"amount_requested\":\"275000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"680\"}}}}}"}
{"loan_id": "LN-003", "json_payload": "{\"application\":{\"loan\":{\"amount_requested\":\"520000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"790\"}}}}}"}
{"loan_id": "LN-004", "json_payload": "{\"application\":{\"loan\":{\"amount_requested\":\"150000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"620\"}}}}}"}
{"loan_id": "LN-005", "json_payload": "{\"application\":{\"loan\":{\"amount_requested\":\"450000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"710\"}}}}}"}
```

## Expected Output

One aggregated row per 30-second window. The weighted average is pulled toward higher-amount loans:

```json
{"window_start": "2025-01-15 10:00:00", "window_end": "2025-01-15 10:00:30", "loan_count": 5, "total_amount": 1745000, "avg_credit_score": 708, "weighted_avg_credit_score": 733}
```

> In this example, `avg_credit_score` is the simple average (708), while `weighted_avg_credit_score` (733) is higher because the largest loan ($520K) has the highest score (790), pulling the weighted average up.

## Steps to Run

1. Build both UDF JARs (`LoanDetailExtractor` and `WeightedAvg`) and upload as Confluent artifacts.
2. Create the `{rid}-LOAN-APPLICATIONS` input topic and table.
3. Create the `{rid}-LOAN-PORTFOLIO-STATS` output topic with the output DDL above.
4. Run **Cell 1** and **Cell 2** to register both UDFs.
5. Run **Cell 3** to start the windowed aggregation job.
6. Produce loan application records to the input topic within 30-second intervals.
7. Consume from `LOAN-PORTFOLIO-STATS` to verify aggregated window results.
