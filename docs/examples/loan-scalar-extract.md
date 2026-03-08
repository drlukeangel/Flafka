# Scalar UDF -- Loan Detail Extraction

Loan JSON nested 7 levels deep? A custom Java UDF rips out credit scores, names, and risk levels into clean flat rows. The `LoanDetailExtractor` scalar function takes a JSON payload and a dot-delimited path, returning the value at that path as a string.

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

**Topic:** `{rid}-LOAN-DETAILS`

```sql
CREATE TABLE `{name}` (
  `key`              BYTES,
  loan_id            STRING,
  applicant_name     STRING,
  loan_type          STRING,
  amount_requested   STRING,
  credit_score       STRING,
  risk_level         STRING,
  dti_ratio          STRING,
  appraised_value    STRING,
  fraud_result       STRING
)
```

## SQL

**Cell 1 -- Register the UDF:**

```sql
CREATE FUNCTION `{fn}` AS 'com.fm.flink.udf.LoanDetailExtractor'
  USING JAR 'confluent-artifact://{id}/{ver}'
```

**Cell 2 -- Extract nested fields into flat rows:**

```sql
INSERT INTO `{output}`
SELECT
  CAST(NULL AS BYTES) AS `key`,
  loan_id,
  `{fn}`(json_payload, 'application.applicant.name.first') || ' ' ||
    `{fn}`(json_payload, 'application.applicant.name.last') AS applicant_name,
  `{fn}`(json_payload, 'application.loan.type') AS loan_type,
  `{fn}`(json_payload, 'application.loan.amount_requested') AS amount_requested,
  `{fn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS credit_score,
  `{fn}`(json_payload, 'underwriting.risk_assessment.risk_level') AS risk_level,
  `{fn}`(json_payload, 'underwriting.risk_assessment.dti_ratio') AS dti_ratio,
  `{fn}`(json_payload, 'application.collateral.appraised_value') AS appraised_value,
  `{fn}`(json_payload, 'underwriting.fraud_check.result') AS fraud_result
FROM `{input}`
```

## Example Input

Each record contains `loan_id` and a deeply nested `json_payload`:

```json
{"loan_id": "LN-2024-00001", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"James\",\"last\":\"Smith\"}},\"loan\":{\"type\":\"CONVENTIONAL\",\"amount_requested\":\"350000\"},\"collateral\":{\"appraised_value\":\"425000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"742\"}},\"risk_level\":\"LOW\",\"dti_ratio\":\"0.32\"},\"fraud_check\":{\"result\":\"PASS\"}}}"}
{"loan_id": "LN-2024-00002", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"Maria\",\"last\":\"Garcia\"}},\"loan\":{\"type\":\"FHA\",\"amount_requested\":\"275000\"},\"collateral\":{\"appraised_value\":\"310000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"680\"}},\"risk_level\":\"MEDIUM\",\"dti_ratio\":\"0.41\"},\"fraud_check\":{\"result\":\"PASS\"}}}"}
{"loan_id": "LN-2024-00003", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"Robert\",\"last\":\"Chen\"}},\"loan\":{\"type\":\"VA\",\"amount_requested\":\"520000\"},\"collateral\":{\"appraised_value\":\"550000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"790\"}},\"risk_level\":\"LOW\",\"dti_ratio\":\"0.28\"},\"fraud_check\":{\"result\":\"PASS\"}}}"}
```

## Expected Output

Flat, readable rows extracted from deeply nested JSON:

```json
{"loan_id": "LN-2024-00001", "applicant_name": "James Smith", "loan_type": "CONVENTIONAL", "amount_requested": "350000", "credit_score": "742", "risk_level": "LOW", "dti_ratio": "0.32", "appraised_value": "425000", "fraud_result": "PASS"}
{"loan_id": "LN-2024-00002", "applicant_name": "Maria Garcia", "loan_type": "FHA", "amount_requested": "275000", "credit_score": "680", "risk_level": "MEDIUM", "dti_ratio": "0.41", "appraised_value": "310000", "fraud_result": "PASS"}
{"loan_id": "LN-2024-00003", "applicant_name": "Robert Chen", "loan_type": "VA", "amount_requested": "520000", "credit_score": "790", "risk_level": "LOW", "dti_ratio": "0.28", "appraised_value": "550000", "fraud_result": "PASS"}
```

## Steps to Run

1. Build the `LoanDetailExtractor` UDF JAR and upload it as a Confluent artifact.
2. Create the `{rid}-LOAN-APPLICATIONS` input topic and table.
3. Create the `{rid}-LOAN-DETAILS` output topic with the output DDL above.
4. Run **Cell 1** to register the UDF with the artifact JAR reference.
5. Run **Cell 2** to start the extraction job.
6. Produce deeply nested loan JSON records to the input topic.
7. Consume from `LOAN-DETAILS` to verify flat, extracted output.
