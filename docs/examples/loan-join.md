# Loan Join

Catch fraud the moment it happens. Joins every loan with its customer risk profile and flags suspicious activity. This example demonstrates a streaming JOIN between a loans topic and a customers reference table, enriching each loan event with customer risk data and generating fraud alerts in real-time.

## Metadata

- **Group:** Joins
- **Tags:** Quick Start, Join, Streaming

## Input Schema

**Table: LOANS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  amount DOUBLE,
  status STRING,
  created_at STRING,
  txn_id STRING,
  customer_id STRING
)
```

**Table: CUSTOMERS**

```sql
CREATE TABLE `{name}` (
  customer_id STRING NOT NULL,
  name STRING,
  risk_score INT,
  risk_level STRING,
  PRIMARY KEY (customer_id) NOT ENFORCED
)
```

## Output Schema

**Table: FRAUD-ALERTS**

```sql
CREATE TABLE `{name}` (
  `key` BYTES,
  loan_id STRING,
  customer_id STRING,
  amount DOUBLE,
  status STRING,
  txn_id STRING,
  customer_name STRING,
  risk_score INT,
  risk_level STRING,
  alert_reason STRING
)
```

## SQL

```sql
INSERT INTO `{rid}-FRAUD-ALERTS`
SELECT
  CAST(l.loan_id AS BYTES) as `key`,
  l.loan_id,
  l.customer_id,
  l.amount,
  l.status,
  l.txn_id,
  c.name AS customer_name,
  c.risk_score,
  c.risk_level,
  CASE
    WHEN c.risk_level = 'CRITICAL' THEN 'CRITICAL_RISK_CUSTOMER'
    WHEN c.risk_level = 'HIGH' THEN 'HIGH_RISK_CUSTOMER'
    ELSE 'LOW_RISK'
  END AS alert_reason
FROM `{rid}-LOANS` l
JOIN `{rid}-CUSTOMERS` c ON l.customer_id = c.customer_id
```

## Example Input

**Loans:**

```json
{"loan_id": "LN-2024-00001", "amount": 25000.0, "status": "APPROVED", "created_at": "2025-01-15T10:00:00Z", "txn_id": "TXN-0001", "customer_id": "C-001"}
{"loan_id": "LN-2024-00002", "amount": 50000.0, "status": "PENDING", "created_at": "2025-01-15T10:05:00Z", "txn_id": "TXN-0002", "customer_id": "C-002"}
{"loan_id": "LN-2024-00003", "amount": 120000.0, "status": "APPROVED", "created_at": "2025-01-15T10:10:00Z", "txn_id": "TXN-0003", "customer_id": "C-003"}
```

**Customers:**

```json
{"customer_id": "C-001", "name": "Alice Smith", "risk_score": 92, "risk_level": "CRITICAL"}
{"customer_id": "C-002", "name": "Bob Jones", "risk_score": 15, "risk_level": "LOW"}
{"customer_id": "C-003", "name": "Carol Davis", "risk_score": 78, "risk_level": "HIGH"}
```

## Expected Output

Each loan is enriched with the customer's risk profile. The alert reason is derived from the risk level.

```json
{"loan_id": "LN-2024-00001", "customer_id": "C-001", "amount": 25000.0, "status": "APPROVED", "txn_id": "TXN-0001", "customer_name": "Alice Smith", "risk_score": 92, "risk_level": "CRITICAL", "alert_reason": "CRITICAL_RISK_CUSTOMER"}
{"loan_id": "LN-2024-00002", "customer_id": "C-002", "amount": 50000.0, "status": "PENDING", "txn_id": "TXN-0002", "customer_name": "Bob Jones", "risk_score": 15, "risk_level": "LOW", "alert_reason": "LOW_RISK"}
{"loan_id": "LN-2024-00003", "customer_id": "C-003", "amount": 120000.0, "status": "APPROVED", "txn_id": "TXN-0003", "customer_name": "Carol Davis", "risk_score": 78, "risk_level": "HIGH", "alert_reason": "HIGH_RISK_CUSTOMER"}
```

## Steps to Run

1. Open the Flafka application and navigate to the Examples panel.
2. Select the **Loan Join** example from the Joins group.
3. Ensure both the `LOANS` topic and the `CUSTOMERS` topic are populated with data.
4. Click **Run** to start the join and enrichment job.
5. Open the `FRAUD-ALERTS` output topic to inspect the results.
6. Verify that each loan is joined with the correct customer record and the alert reason matches the risk level.
