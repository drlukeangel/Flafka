# Table UDF -- Tradeline Explosion (Python)

Same tradeline explosion as the Java example, but implemented with Python UDFs. Write your UDF in Python and deploy it to Flink. This example uses the `LANGUAGE PYTHON` syntax and `LATERAL TABLE` with positional tuple fields (`t.f0`, `t.f1`, etc.).

> **Coming Soon** -- Python UDFs require Confluent Early Access enrollment. Contact your Confluent representative for access.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | UDFs |
| **Tags** | Quick Start, Python, UDF, Loan Example |

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

**Cell 1 -- Register the Python scalar extract UDF:**

```sql
CREATE FUNCTION `{extractFn}` AS 'extract_field'
  LANGUAGE PYTHON
  USING JAR 'confluent-artifact://{id}/{ver}'
```

**Cell 2 -- Register the Python table (explode) UDF:**

```sql
CREATE FUNCTION `{explodeFn}` AS 'explode_json_array'
  LANGUAGE PYTHON
  USING JAR 'confluent-artifact://{id}/{ver}'
```

**Cell 3 -- Explode tradelines using Python UDF with tuple syntax:**

```sql
INSERT INTO `{output}`
SELECT
  CAST(CONCAT(loan_id, '-', CAST(t.f0 AS STRING)) AS BYTES) AS `key`,
  loan_id,
  t.f0 AS tradeline_index,
  `{extractFn}`(t.f1, 'account_type') AS account_type,
  `{extractFn}`(t.f1, 'lender') AS lender,
  `{extractFn}`(t.f1, 'balance') AS balance,
  `{extractFn}`(t.f1, 'limit') AS credit_limit,
  `{extractFn}`(t.f1, 'status') AS status
FROM `{input}`,
  LATERAL TABLE(`{explodeFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.tradelines')) AS t
```

> **Note:** Python table UDFs return positional tuples. Fields are accessed as `t.f0`, `t.f1`, etc., rather than named fields like the Java version.

## Example Input

A single loan application with a nested tradelines array:

```json
{"loan_id": "LN-2024-00001", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"James\",\"last\":\"Smith\"}},\"loan\":{\"type\":\"CONVENTIONAL\",\"amount_requested\":\"350000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"742\",\"tradelines\":[{\"account_type\":\"MORTGAGE\",\"lender\":\"Chase\",\"balance\":\"280000\",\"limit\":\"300000\",\"status\":\"CURRENT\"},{\"account_type\":\"AUTO\",\"lender\":\"Wells Fargo\",\"balance\":\"18500\",\"limit\":\"25000\",\"status\":\"CURRENT\"},{\"account_type\":\"CREDIT_CARD\",\"lender\":\"Citi\",\"balance\":\"4200\",\"limit\":\"15000\",\"status\":\"CURRENT\"}]}},\"risk_level\":\"LOW\"}}}"}
```

## Expected Output

One input record produces three output rows (one per tradeline):

```json
{"loan_id": "LN-2024-00001", "tradeline_index": 0, "account_type": "MORTGAGE", "lender": "Chase", "balance": "280000", "credit_limit": "300000", "status": "CURRENT"}
{"loan_id": "LN-2024-00001", "tradeline_index": 1, "account_type": "AUTO", "lender": "Wells Fargo", "balance": "18500", "credit_limit": "25000", "status": "CURRENT"}
{"loan_id": "LN-2024-00001", "tradeline_index": 2, "account_type": "CREDIT_CARD", "lender": "Citi", "balance": "4200", "credit_limit": "15000", "status": "CURRENT"}
```

## Steps to Run

1. Enroll in Confluent Early Access for Python UDF support.
2. Package the Python UDFs (`extract_field` and `explode_json_array`) and upload as Confluent artifacts.
3. Create the `{rid}-LOAN-APPLICATIONS` input topic and table.
4. Create the `{rid}-LOAN-TRADELINES` output topic with the output DDL above.
5. Run **Cell 1** and **Cell 2** to register both Python UDFs.
6. Run **Cell 3** to start the tradeline explosion job.
7. Produce loan application records to the input topic.
8. Consume from `LOAN-TRADELINES` to verify one row per tradeline per loan.
