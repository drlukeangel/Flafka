# Loan PII Masking

Share loan data with analytics without exposing names, SSNs, or emails. Every record arrives pre-masked -- GDPR-ready. This example demonstrates how to use custom UDFs to extract nested JSON fields and apply PII masking patterns in a single streaming SQL statement.

## Metadata

| Field | Value |
|-------|-------|
| **Group** | UDFs |
| **Tags** | Quick Start, UDF, Pattern |

## Input Schema

```sql
CREATE TABLE `LOAN-APPLICATIONS` (
  loan_id STRING,
  json_payload STRING
)
```

## Output Schema

```sql
CREATE TABLE `LOANS-MASKED` (
  `key` BYTES,
  loan_id STRING,
  applicant_name STRING,
  applicant_email STRING,
  applicant_phone STRING,
  applicant_ssn STRING,
  loan_type STRING,
  amount_requested STRING,
  credit_score STRING,
  risk_level STRING
)
```

## SQL

### Cell 1 -- Register LoanDetailExtract UDF

```sql
CREATE FUNCTION `{extractFn}` AS 'com.example.udf.LoanDetailExtract';
```

### Cell 2 -- Register PiiMask UDF

```sql
CREATE FUNCTION `{maskFn}` AS 'com.example.udf.PiiMask';
```

### Cell 3 -- Extract and mask loan data

```sql
INSERT INTO `{output}` (
  `key`, loan_id, applicant_name, applicant_email, applicant_phone,
  applicant_ssn, loan_type, amount_requested, credit_score, risk_level
)
SELECT
  CAST(loan_id AS BYTES) as `key`,
  loan_id,
  `{maskFn}`(`{extractFn}`(json_payload, 'application.applicant.name.first'), 'name') as applicant_name,
  `{maskFn}`(`{extractFn}`(json_payload, 'application.applicant.contact.email'), 'email') as applicant_email,
  `{maskFn}`(`{extractFn}`(json_payload, 'application.applicant.contact.phone'), 'phone') as applicant_phone,
  `{maskFn}`(`{extractFn}`(json_payload, 'application.applicant.ssn_last_four'), 'ssn') as applicant_ssn,
  JSON_VALUE(json_payload, '$.application.loan.type') as loan_type,
  JSON_VALUE(json_payload, '$.application.loan.amount_requested') as amount_requested,
  JSON_VALUE(json_payload, '$.underwriting.risk_assessment.credit_analysis.bureau_data.score') as credit_score,
  JSON_VALUE(json_payload, '$.underwriting.risk_assessment.overall_risk') as risk_level
FROM `{input}`
```

## Example Input

Records on the `LOAN-APPLICATIONS` topic:

```json
{"loan_id": "LN-00001", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"James Smith\"},\"contact\":{\"email\":\"james.smith@example.com\",\"phone\":\"555-867-1234\"},\"ssn_last_four\":\"123-45-5678\"},\"loan\":{\"type\":\"CONVENTIONAL\",\"amount_requested\":\"350000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"742\"}},\"overall_risk\":\"LOW\"}}}"}
{"loan_id": "LN-00002", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"Maria Garcia\"},\"contact\":{\"email\":\"maria.garcia@corp.net\",\"phone\":\"555-432-9876\"},\"ssn_last_four\":\"987-65-4321\"},\"loan\":{\"type\":\"FHA\",\"amount_requested\":\"275000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"685\"}},\"overall_risk\":\"MEDIUM\"}}}"}
{"loan_id": "LN-00003", "json_payload": "{\"application\":{\"applicant\":{\"name\":{\"first\":\"Robert Lee\"},\"contact\":{\"email\":\"rlee@webmail.org\",\"phone\":\"555-111-5555\"},\"ssn_last_four\":\"456-78-9012\"},\"loan\":{\"type\":\"VA\",\"amount_requested\":\"420000\"}},\"underwriting\":{\"risk_assessment\":{\"credit_analysis\":{\"bureau_data\":{\"score\":\"798\"}},\"overall_risk\":\"LOW\"}}}"}
```

## Expected Output

Records on the `LOANS-MASKED` topic:

```json
{"loan_id": "LN-00001", "applicant_name": "J*** S***", "applicant_email": "j***@***.com", "applicant_phone": "***-***-1234", "applicant_ssn": "***-**-5678", "loan_type": "CONVENTIONAL", "amount_requested": "350000", "credit_score": "742", "risk_level": "LOW"}
{"loan_id": "LN-00002", "applicant_name": "M*** G***", "applicant_email": "m***@***.net", "applicant_phone": "***-***-9876", "applicant_ssn": "***-**-4321", "loan_type": "FHA", "amount_requested": "275000", "credit_score": "685", "risk_level": "MEDIUM"}
{"loan_id": "LN-00003", "applicant_name": "R*** L***", "applicant_email": "r***@***.org", "applicant_phone": "***-***-5555", "applicant_ssn": "***-**-9012", "loan_type": "VA", "amount_requested": "420000", "credit_score": "798", "risk_level": "LOW"}
```

## Steps to Run

1. **Create the input topic** `LOAN-APPLICATIONS` with the input schema DDL above.
2. **Register the UDFs** by executing SQL Cell 1 and Cell 2 to make `LoanDetailExtract` and `PiiMask` available.
3. **Create the output topic** `LOANS-MASKED` with the output schema DDL above.
4. **Deploy the pipeline** by executing SQL Cell 3. The INSERT statement will begin consuming from the input topic and producing masked records to the output topic.
5. **Produce sample records** to `LOAN-APPLICATIONS` using the example input JSON above.
6. **Verify output** by consuming from `LOANS-MASKED` and confirming all PII fields (name, email, phone, SSN) are masked while non-PII fields (loan_type, amount, score, risk) pass through unchanged.
