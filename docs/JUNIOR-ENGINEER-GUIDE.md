# Flink SQL Kickstarter Examples - Junior Engineer's Guide

Welcome! This guide will help you learn Flink SQL through hands-on examples. No prior streaming experience needed.

## What is Flink? (In Plain English)

**Apache Flink** is a tool for processing data that never stops flowing. Think of it like:
- Batch processing: "Give me all your sales data from January, I'll analyze it." (Old way)
- **Flink/Streaming**: "New sales orders pop in constantly. Show me real-time insights—counts, summaries, alerts—instantly." (New way)

Flink runs on **Kafka** topics (streaming data buckets), and you write **SQL queries** to process them.

---

## Beginner Concepts

### **Topic**
A Kafka topic is like a TV channel:
- Data (events) flow in one end
- Your Flink job watches and processes them
- Results flow to an output topic
- Multiple consumers can watch the same topic

### **Stream Card**
A testing widget in the workspace:
- Click the play (▶) button
- It sends sample data into a Kafka topic
- Great for practicing without real data sources

### **Compute Pool**
Your Flink server in the cloud:
- Confluent manages it—you don't set up servers
- You send SQL queries to it
- It processes your data and streams back results

### **CREATE TABLE**
Tells Flink: "Listen to this Kafka topic and interpret messages as rows."
- Defines columns (loan_id, amount, status, etc.)
- Specifies format (JSON, Avro, raw bytes, etc.)
- Examples: Schemaless Topic teaches `value.format='raw'`, Schema Override teaches computed columns

### **INSERT INTO ... SELECT**
A continuous query:
- SELECT: "Read from source topic"
- WHERE: "Apply filter rules"
- INSERT: "Write results to output topic"
- Runs 24/7, processing new data instantly

---

## Example Progression (Start Here!)

### **Tier 1: Understand the Basics**

#### 1. **Hello Flink** (Connectivity Test)
- **What you'll learn**: "Does my Flink setup work?"
- **Pattern**: Read topic → Display all records
- **SQL**: `SELECT * FROM JOKES`
- **Time to complete**: 2 minutes

#### 2. **Good Jokes Filter** (Filtering)
- **What you'll learn**: "How do I filter data in real time?"
- **Pattern**: Read topic → Keep rows where condition is true → Write to output
- **SQL**: `INSERT INTO GOOD-JOKES SELECT * FROM JOKES WHERE rating IN ('LOL', 'ROFL')`
- **Real-world use**: Only process high-priority orders, filter spam, route by type
- **Time to complete**: 3 minutes

#### 3. **Loan Filter** (Real Business Logic)
- **What you'll learn**: Same as Good Jokes, but with business data
- **Pattern**: Filter loans by status (keep only APPROVED)
- **Key concept**: CAST(loan_id AS BYTES) — Kafka needs binary keys
- **Real-world use**: Approve/deny workflows, compliance filtering
- **Time to complete**: 3 minutes

---

### **Tier 2: Time Windows & Aggregation**

#### 4. **Loan Aggregation** (Rolling Statistics)
- **What you'll learn**: "How do I count and sum over time?"
- **Pattern**: Group by status every 20 seconds, count loans, sum amounts
- **Key concepts**:
  - `TUMBLE()` window: Chops stream into fixed 20-second chunks
  - `COUNT(*)`: How many records in this window
  - `SUM(amount)`: Total $ in this window
  - `GROUP BY status`: Separate buckets for APPROVED, DENIED, PENDING
- **Real-world use**: Dashboard widgets, SLA tracking, portfolio monitoring
- **Time to complete**: 5 minutes

---

### **Tier 3: Advanced Patterns (Pick Your Interest!)**

#### 5. **Loan Dedup** (Exactly-Once Semantics)
- **What you'll learn**: "How do I handle duplicate events?"
- **Problem**: Networks fail. Kafka resends messages. Without dedup, you'd double-bill!
- **Solution**: ROW_NUMBER() ranks each duplicate, keep only rank #1
- **Key insight**: Streaming requires "exactly-once" guarantees
- **Real-world use**: Payment processing, financial transactions
- **Time to complete**: 7 minutes

#### 6. **Loan Top-N** (Ranking Within Windows)
- **What you'll learn**: "Find the top 3 loans per window"
- **Pattern**: TUMBLE window + ROW_NUMBER() ranking + WHERE rownum <= 3
- **Real-world use**: Leaderboards, anomaly detection, alerting
- **Time to complete**: 7 minutes

#### 7. **Schemaless Topic** (Flexible Data)
- **What you'll learn**: "What if data arrives as raw JSON, not structured?"
- **Pattern**: Read raw bytes → Parse JSON → Extract fields → Type cast
- **Key concept**: `value.format='raw'` + `JSON_VALUE()` to extract fields
- **Real-world use**: Legacy systems, unstructured logs, third-party data
- **Time to complete**: 8 minutes

#### 8. **Schema Override** (Event Time & Watermarks)
- **What you'll learn**: "How do I handle out-of-order or late data?"
- **Pattern**: Add computed columns, define watermarks for late arrivals
- **Key concepts**:
  - Computed columns: `event_time AS TO_TIMESTAMP_LTZ(created_at, 3)`
  - Watermarks: Tell Flink "expect data up to 10 seconds late"
- **Real-world use**: Mobile devices (data arrives delayed), batch uploads
- **Time to complete**: 8 minutes

#### 9. **Loan Join** (Enrichment)
- **What you'll learn**: "How do I combine two streams?"
- **Pattern**: LOANS stream + CUSTOMERS stream → Joined output
- **Key insight**: Flink stores both streams in state, matches on customer_id
- **Real-world use**: Fraud detection, personalization, enrichment
- **Time to complete**: 10 minutes

---

## Learning Path Recommendations

### **Path A: "I want to process and filter data"**
1. Hello Flink
2. Good Jokes Filter
3. Loan Filter
4. Loan Aggregation
✅ You can now: Filter, count, sum, monitor in real time

### **Path B: "I need to deduplicate or rank data"**
1. Hello Flink
2. Loan Filter
3. Loan Dedup
4. Loan Top-N
✅ You can now: Ensure data quality, detect outliers

### **Path C: "I need to handle messy/flexible data"**
1. Hello Flink
2. Schemaless Topic
3. Schema Override
✅ You can now: Parse unstructured data, handle late arrivals

### **Path D: "I need to combine streams"**
1. Hello Flink
2. Loan Filter
3. Loan Join
✅ You can now: Enrich data, match events, fraud detection

---

## Running an Example Step-by-Step

### Setup
1. Open the Kickstarters panel (left sidebar)
2. Find your example
3. Click "Set Up Environment"

### Steps (Same for Every Example)
1. **Produce data**: Click ▶ on the stream card (e.g., "LOANS-whirling-sloth...")
   - Sends sample data into the Kafka topic
   - Wait for the counter to finish (e.g., "200 sent")
2. **Run SQL cells in order**: Each cell should show status → ✓ Completed or ✓ Running
   - Green checkmark = success
   - Red X = error (read the details)
3. **View results**: Last cell usually shows `SELECT * LIMIT 50` with results

### What to Expect
- First run: "Why is my SELECT showing nothing?"
  - ✓ Normal! Flink jobs take a few seconds to start
  - Re-run the SELECT after 2-3 seconds
- Aggregation example: "Why are results blank?"
  - ✓ Normal! Windows only emit when they close (every 20 seconds)
  - Wait 20+ seconds, then run the SELECT
- Error messages: Always read them
  - "Table XXX doesn't exist" → You forgot to run the CREATE TABLE step
  - "Column YYY not found" → Check your SELECT column names match CREATE TABLE

---

## Key SQL Patterns (Copy-Paste Ready!)

### Pattern 1: Simple Filter
```sql
INSERT INTO OUTPUT_TOPIC
SELECT *
FROM INPUT_TOPIC
WHERE status = 'APPROVED'
```

### Pattern 2: Count & Sum by Group
```sql
INSERT INTO STATS_TOPIC
SELECT status, COUNT(*) as count, SUM(amount) as total
FROM TABLE(TUMBLE(TABLE LOANS, DESCRIPTOR($rowtime), INTERVAL '30' SECOND))
GROUP BY window_start, window_end, status
```

### Pattern 3: Dedup (Keep First)
```sql
INSERT INTO DEDUPED_TOPIC
SELECT *
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY key_field ORDER BY $rowtime) as rn
  FROM INPUT_TOPIC
)
WHERE rn = 1
```

### Pattern 4: Parse JSON
```sql
INSERT INTO PARSED_TOPIC
SELECT
  JSON_VALUE(CAST(val AS STRING), '$.field_name') as field_name,
  CAST(JSON_VALUE(CAST(val AS STRING), '$.amount') AS DOUBLE) as amount
FROM RAW_INPUT_TOPIC
WHERE JSON_VALUE(CAST(val AS STRING), '$.field_name') IS NOT NULL
```

### Pattern 5: Join Two Streams
```sql
INSERT INTO ENRICHED_TOPIC
SELECT l.*, c.customer_name, c.risk_level
FROM LOANS l
JOIN CUSTOMERS c ON l.customer_id = c.customer_id
```

---

## Troubleshooting

### "My SQL won't run"
- Check for typos in table names (must match CREATE TABLE exactly, including backticks)
- Check for missing columns (SELECT clause references columns that don't exist)
- Check for invalid conditions (WHERE status = 'APPROVED' but status column is actually 'Status')

### "Results are empty"
- Did you produce data first? (Click ▶ on stream card)
- Is your filter too strict? (e.g., WHERE amount > 1000000)
- For aggregation: Did you wait long enough? (Windows emit on schedule, not instantly)

### "Error: Table already exists"
- Solution: Use `CREATE TABLE IF NOT EXISTS` (already in examples)

### "Error: Watermark conflict"
- Your schema defines a watermark on one column, but SQL references another
- Solution: Check that computed columns match the watermark definition

---

## Concepts Glossary

| Term | Simple Explanation |
|------|-------------------|
| **Topic** | A stream of events (like a data pipeline) |
| **Window** | A time-based chunk of data (e.g., "all events in the last 30 seconds") |
| **Watermark** | "I expect data up to this many seconds late" |
| **State** | Data Flink remembers between events (for joins, dedup, windowing) |
| **Exactly-once** | Each event is processed exactly one time, no duplicates |
| **Event time** | When the event actually happened (e.g., when a loan was submitted) |
| **Ingestion time** | When Flink received the event |
| **Stateless** | No memory between events (simple filter) |
| **Stateful** | Requires memory (joins, windows, dedup) |

---

## Next Steps After Examples

### Build Your Own Queries
- Start with a filter (WHERE clause)
- Add aggregation (COUNT, SUM)
- Add a window (TUMBLE, SESSION)
- Add a join (match two streams)

### Dive Into Production Concerns
- State TTL (how long to keep state in memory?)
- Checkpoint intervals (how often to save state?)
- Parallelism (how many parallel tasks?)
- Exactly-once vs at-least-once semantics

### Read the Docs
- [Flink SQL Docs](https://nightlies.apache.org/flink/flink-docs-master/docs/dev/table/sql/overview/)
- [Confluent Flink Docs](https://docs.confluent.io/flink/current/overview.html)

---

## Questions?

Each example has:
- 📊 **Data flow diagram** showing input → processor → output
- 💡 **Business context** explaining why this matters
- 🎯 **Use cases** where you'd use this pattern
- 📋 **Example input/output** to understand what happens

Read those sections first — they usually answer the question!

---

**Happy streaming! 🚀**
