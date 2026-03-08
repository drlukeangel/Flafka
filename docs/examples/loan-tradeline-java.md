# Table UDF -- Tradeline Explosion (Java)

One loan, five credit accounts buried in a JSON array. `LATERAL TABLE` blows it apart -- one row per tradeline. This example uses two Java UDFs: a scalar extractor for individual fields and a table function that explodes JSON arrays into multiple rows.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | UDFs |
| **Tags** | Quick Start, Java, UDF, Loan Example |

## Input Schema

**Topic:** `{rid}-LOAN-APPLICATIONS`

```sql
CREATE TABLE `{name}` (
  loan_id        STRING,
  json_payload   STRING
)
```

## Output Schema

**Topic:** `{rid}-LOAN-TRADELINES`

```sql
CREATE TABLE `{name}` (
  `key`              BYTES,
  loan_id            STRING,
  tradeline_index    INT,
  account_type       STRING,
  lender             STRING,
  balance            STRING,
  credit_limit       STRING,
  status             STRING
)
```

## SQL

**Cell 1 -- Register the scalar extract UDF:**

```sql
CREATE FUNCTION `{extractFn}` AS 'com.fm.flink.udf.LoanDetailExtractor'
  USING JAR 'confluent-artifact://{id}/{ver}'
```

**Cell 2 -- Register the table (explode) UDF:**

```sql
CREATE FUNCTION `{explodeFn}` AS 'com.fm.flink.udf.JsonArrayExploder'
  USING JAR 'confluent-artifact://{id}/{ver}'
```

**Cell 3 -- Explode tradelines into individual rows:**

```sql
INSERT INTO `{output}`
SELECT
  CAST(CONCAT(loan_id, '-', CAST(t.array_index AS STRING)) AS BYTES) AS `key`,
  loan_id,
  t.array_index AS tradeline_index,
  `{extractFn}`(t.element_json, 'account_type') AS account_type,
  `{extractFn}`(t.element_json, 'lender') AS lender,
  `{extractFn}`(t.element_json, 'balance') AS balance,
  `{extractFn}`(t.element_json, 'limit') AS credit_limit,
  `{extractFn}`(t.element_json, 'status') AS status
FROM `{input}`,
  LATERAL TABLE(`{explodeFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.tradelines')) AS t
```

## Example Input

A single loan application with a nested tradelines array:

```json
{"loan_id": "LN-2024-00001", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"James\",\"last\":\"Smith\"}},\"loan\":{\"type\":\"CONVENTIONAL\",\"amount_requested\":\"350000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"742\",\"tradelines\":[{\"account_type\":\"MORTGAGE\",\"lender\":\"Chase\",\"balance\":\"280000\",\"limit\":\"300000\",\"status\":\"CURRENT\"},{\"account_type\":\"AUTO\",\"lender\":\"Wells Fargo\",\"balance\":\"18500\",\"limit\":\"25000\",\"status\":\"CURRENT\"},{\"account_type\":\"CREDIT_CARD\",\"lender\":\"Citi\",\"balance\":\"4200\",\"limit\":\"15000\",\"status\":\"CURRENT\"},{\"account_type\":\"CREDIT_CARD\",\"lender\":\"Amex\",\"balance\":\"1200\",\"limit\":\"10000\",\"status\":\"CURRENT\"},{\"account_type\":\"STUDENT\",\"lender\":\"Navient\",\"balance\":\"32000\",\"limit\":\"32000\",\"status\":\"DEFERRED\"}]}},\"risk_level\":\"LOW\"}}}"}
```

## Expected Output

One input record produces five output rows (one per tradeline):

```json
{"loan_id": "LN-2024-00001", "tradeline_index": 0, "account_type": "MORTGAGE", "lender": "Chase", "balance": "280000", "credit_limit": "300000", "status": "CURRENT"}
{"loan_id": "LN-2024-00001", "tradeline_index": 1, "account_type": "AUTO", "lender": "Wells Fargo", "balance": "18500", "credit_limit": "25000", "status": "CURRENT"}
{"loan_id": "LN-2024-00001", "tradeline_index": 2, "account_type": "CREDIT_CARD", "lender": "Citi", "balance": "4200", "credit_limit": "15000", "status": "CURRENT"}
{"loan_id": "LN-2024-00001", "tradeline_index": 3, "account_type": "CREDIT_CARD", "lender": "Amex", "balance": "1200", "credit_limit": "10000", "status": "CURRENT"}
{"loan_id": "LN-2024-00001", "tradeline_index": 4, "account_type": "STUDENT", "lender": "Navient", "balance": "32000", "credit_limit": "32000", "status": "DEFERRED"}
```

## Steps to Run

1. Build both UDF JARs (`LoanDetailExtractor` and `JsonArrayExploder`) and upload as Confluent artifacts.
2. Create the `{rid}-LOAN-APPLICATIONS` input topic and table.
3. Create the `{rid}-LOAN-TRADELINES` output topic with the output DDL above.
4. Run **Cell 1** and **Cell 2** to register both UDFs.
5. Run **Cell 3** to start the tradeline explosion job.
6. Produce loan application records (with nested tradelines arrays) to the input topic.
7. Consume from `LOAN-TRADELINES` to verify one row per tradeline per loan.
