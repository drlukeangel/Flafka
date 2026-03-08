# Loan Validation with Dead-Letter Queue

Bad data should not disappear silently. This example routes valid loans to a validated topic and failed loans to a dead-letter queue with full rejection reasons. A custom `LoanValidator` UDF inspects credit scores, DTI ratios, and fraud screening results to determine validity.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | UDFs |
| **Tags** | Quick Start, UDF, Pattern |

## Input Schema

**Topic:** `{rid}-LOAN-APPLICATIONS`

```sql
CREATE TABLE `{name}` (
  loan_id        STRING,
  json_payload   STRING
)
```

## Output Schema

### Validated Loans

**Topic:** `{rid}-LOANS-VALIDATED`

```sql
CREATE TABLE `{name}` (
  `key`              BYTES,
  loan_id            STRING,
  applicant_name     STRING,
  loan_type          STRING,
  amount_requested   STRING,
  credit_score       STRING,
  risk_level         STRING,
  validation_status  STRING
)
```

### Dead-Letter Queue

**Topic:** `{rid}-LOANS-DEAD-LETTER`

```sql
CREATE TABLE `{name}` (
  `key`                BYTES,
  loan_id              STRING,
  json_payload         STRING,
  rejection_reasons    STRING,
  credit_score         STRING,
  dti_ratio            STRING,
  fraud_result         STRING
)
```

## SQL

**Cell 1 -- Register the scalar extract UDF:**

```sql
CREATE FUNCTION `{extractFn}` AS 'com.fm.flink.udf.LoanDetailExtractor'
  USING JAR 'confluent-artifact://{id}/{ver}'
```

**Cell 2 -- Register the validator UDF:**

```sql
CREATE FUNCTION `{validatorFn}` AS 'com.fm.flink.udf.LoanValidator'
  USING JAR 'confluent-artifact://{id}/{ver}'
```

**Cell 3 -- Route valid loans:**

```sql
INSERT INTO `{validated}`
SELECT
  CAST(loan_id AS BYTES) AS `key`,
  loan_id,
  `{extractFn}`(json_payload, 'application.applicant.name.first') AS applicant_name,
  `{extractFn}`(json_payload, 'application.loan.type') AS loan_type,
  `{extractFn}`(json_payload, 'application.loan.amount_requested') AS amount_requested,
  `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS credit_score,
  `{extractFn}`(json_payload, 'underwriting.risk_assessment.overall_risk') AS risk_level,
  'VALID' AS validation_status
FROM `{input}`
WHERE `{validatorFn}`(json_payload) = 'VALID'
```

**Cell 4 -- Route invalid loans to the dead-letter queue:**

```sql
INSERT INTO `{deadLetter}`
SELECT
  CAST(loan_id AS BYTES) AS `key`,
  loan_id,
  json_payload,
  `{validatorFn}`(json_payload) AS rejection_reasons,
  `{extractFn}`(json_payload, 'underwriting.risk_assessment.credit_analysis.bureau_data.score') AS credit_score,
  `{extractFn}`(json_payload, 'underwriting.risk_assessment.dti_ratio') AS dti_ratio,
  `{extractFn}`(json_payload, 'underwriting.fraud_screening.result') AS fraud_result
FROM `{input}`
WHERE `{validatorFn}`(json_payload) <> 'VALID'
```

## Example Input

A mix of valid and invalid loan applications:

```json
{"loan_id": "LN-2024-00001", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"James\",\"last\":\"Smith\"}},\"loan\":{\"type\":\"CONVENTIONAL\",\"amount_requested\":\"350000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"742\"}},\"overall_risk\":\"LOW\",\"dti_ratio\":\"0.32\"},\"fraud_screening\":{\"result\":\"PASS\"}}}"}
{"loan_id": "LN-2024-00002", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"Bob\",\"last\":\"Jones\"}},\"loan\":{\"type\":\"FHA\",\"amount_requested\":\"200000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"520\"}},\"overall_risk\":\"HIGH\",\"dti_ratio\":\"0.65\"},\"fraud_screening\":{\"result\":\"PASS\"}}}"}
{"loan_id": "LN-2024-00003", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"Alice\",\"last\":\"Wu\"}},\"loan\":{\"type\":\"CONVENTIONAL\",\"amount_requested\":\"450000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"790\"}},\"overall_risk\":\"LOW\",\"dti_ratio\":\"0.25\"},\"fraud_screening\":{\"result\":\"PASS\"}}}"}
{"loan_id": "LN-2024-00004", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"Dave\",\"last\":\"Lee\"}},\"loan\":{\"type\":\"JUMBO\",\"amount_requested\":\"800000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"680\"}},\"overall_risk\":\"MEDIUM\",\"dti_ratio\":\"0.55\"},\"fraud_screening\":{\"result\":\"FAIL\"}}}"}
```

## Expected Output

### Validated Loans

LN-00001 and LN-00003 pass all checks:

```json
{"loan_id": "LN-2024-00001", "applicant_name": "James", "loan_type": "CONVENTIONAL", "amount_requested": "350000", "credit_score": "742", "risk_level": "LOW", "validation_status": "VALID"}
{"loan_id": "LN-2024-00003", "applicant_name": "Alice", "loan_type": "CONVENTIONAL", "amount_requested": "450000", "credit_score": "790", "risk_level": "LOW", "validation_status": "VALID"}
```

### Dead-Letter Queue

LN-00002 has low credit score and high DTI; LN-00004 failed fraud screening:

```json
{"loan_id": "LN-2024-00002", "rejection_reasons": "CREDIT_SCORE_TOO_LOW;DTI_TOO_HIGH", "credit_score": "520", "dti_ratio": "0.65", "fraud_result": "PASS"}
{"loan_id": "LN-2024-00004", "rejection_reasons": "FRAUD_CHECK_FAILED;DTI_TOO_HIGH", "credit_score": "680", "dti_ratio": "0.55", "fraud_result": "FAIL"}
```

## Steps to Run

1. Build both UDF JARs (`LoanDetailExtractor` and `LoanValidator`) and upload as Confluent artifacts.
2. Create the `{rid}-LOAN-APPLICATIONS` input topic and table.
3. Create the `{rid}-LOANS-VALIDATED` output topic with the validated DDL above.
4. Create the `{rid}-LOANS-DEAD-LETTER` output topic with the dead-letter DDL above.
5. Run **Cell 1** and **Cell 2** to register both UDFs.
6. Run **Cell 3** to start the valid-loan routing job.
7. Run **Cell 4** to start the dead-letter routing job.
8. Produce loan application records to the input topic.
9. Consume from both output topics to verify valid loans are separated from rejected ones, and that rejection reasons are preserved.
